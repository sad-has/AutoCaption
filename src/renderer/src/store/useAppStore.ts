import { create } from 'zustand';
import type {
  AspectRatio,
  CaptionSegment,
  CaptionStyle,
  MediaAsset,
  Project,
  ProjectRecord,
  UploadProgressEvent,
  TranscriptionJobProgress,
  TranscriptionModelOption,
  ExportJobProgress,
  ExportVideoOptions,
} from '../../../shared/types';
import { exportToSrt, exportToWebVtt } from '../../../shared/export/subtitles';
import { logger } from '../utils/logger';
import { chunkWordsIntoSegments } from '../../../shared/captionChunker';
import {
  adjustSegmentTimes as adjustSegmentTimesUtil,
  splitSegment as splitSegmentUtil,
  mergeSegments as mergeSegmentsUtil,
  updateWordInSegment as updateWordInSegmentUtil,
  detectSegmentOverlaps,
} from '../../../shared/captionEditor';
import type { CaptionAnimation, CaptionAnimationConfig, CaptionWord, CaptionTemplate } from '../../../shared/types';
import { DEFAULT_ANIMATION_CONFIG } from '../../../shared/animations/engine';
import {
  BUILTIN_TEMPLATES,
  getTemplateById,
  createTemplateFromStyle,
  duplicateTemplate,
  exportTemplateAsJson,
  validateTemplateJson,
} from '../../../shared/templates';
import { FONT_CATALOG, type FontDefinition, loadGoogleFont } from '../../../shared/fonts';

const defaultFallbackTemplate = BUILTIN_TEMPLATES[0]!;
export const defaultFallbackStyle: CaptionStyle = defaultFallbackTemplate.style;

export const STYLE_PRESETS: Record<string, CaptionStyle> = {
  ...Object.fromEntries(BUILTIN_TEMPLATES.map((t) => [t.id, t.style])),
  hormozi: {
    ...(BUILTIN_TEMPLATES.find((t) => t.id === 'modern-creator')?.style ?? defaultFallbackStyle),
    presetId: 'hormozi',
    activeWordColor: '#F59E0B',
  },
  beast: {
    ...(BUILTIN_TEMPLATES.find((t) => t.id === 'kinetic-bold')?.style ?? defaultFallbackStyle),
    presetId: 'beast',
    activeWordColor: '#10B981',
  },
  minimal: {
    ...(BUILTIN_TEMPLATES.find((t) => t.id === 'minimal-cinema')?.style ?? defaultFallbackStyle),
    presetId: 'minimal',
  },
  'desi-gold': {
    ...(BUILTIN_TEMPLATES.find((t) => t.id === 'hindi-friendly')?.style ?? defaultFallbackStyle),
    presetId: 'desi-gold',
  },
};

function loadStoredCustomTemplates(): CaptionTemplate[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem('autocaption_custom_templates');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistCustomTemplates(templates: CaptionTemplate[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('autocaption_custom_templates', JSON.stringify(templates));
  } catch {
    // quota exceeded or storage blocked
  }
}

function loadStoredFavoriteTemplates(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem('autocaption_favorite_templates');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFavoriteTemplates(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('autocaption_favorite_templates', JSON.stringify(ids));
  } catch {
    // quota exceeded or storage blocked
  }
}

const INITIAL_DEMO_SEGMENTS: CaptionSegment[] = [
  {
    id: 'demo-seg-1',
    startMs: 0,
    endMs: 2400,
    text: 'HOW TO BUILD VIRAL REELS',
    isDemo: true,
    words: [
      { id: 'w1', text: 'HOW', startMs: 0, endMs: 400 },
      { id: 'w2', text: 'TO', startMs: 400, endMs: 800 },
      { id: 'w3', text: 'BUILD', startMs: 800, endMs: 1400 },
      { id: 'w4', text: 'VIRAL', startMs: 1400, endMs: 1900, highlighted: true },
      { id: 'w5', text: 'REELS', startMs: 1900, endMs: 2400 },
    ],
  },
  {
    id: 'demo-seg-2',
    startMs: 2400,
    endMs: 5100,
    text: 'WITHOUT SPENDING HOURS ON SUBTITLES',
    isDemo: true,
    words: [
      { id: 'w6', text: 'WITHOUT', startMs: 2400, endMs: 3000 },
      { id: 'w7', text: 'SPENDING', startMs: 3000, endMs: 3700 },
      { id: 'w8', text: 'HOURS', startMs: 3700, endMs: 4300, highlighted: true },
      { id: 'w9', text: 'ON', startMs: 4300, endMs: 4600 },
      { id: 'w10', text: 'SUBTITLES', startMs: 4600, endMs: 5100 },
    ],
  },
  {
    id: 'demo-seg-3',
    startMs: 5100,
    endMs: 8200,
    text: '100 PERCENT LOCAL AND PRIVATE',
    isDemo: true,
    words: [
      { id: 'w11', text: '100', startMs: 5100, endMs: 5700, highlighted: true },
      { id: 'w12', text: 'PERCENT', startMs: 5700, endMs: 6400 },
      { id: 'w13', text: 'LOCAL', startMs: 6400, endMs: 7200, highlighted: true },
      { id: 'w14', text: 'AND', startMs: 7200, endMs: 7500 },
      { id: 'w15', text: 'PRIVATE', startMs: 7500, endMs: 8200 },
    ],
  },
];

interface AppState {
  // Navigation
  activeView: 'editor' | 'settings';
  leftPanelTab: 'media' | 'projects' | 'fonts';
  bottomPanelTab: 'timeline' | 'segments';

  // Project & Content
  currentProject: Project;
  recentProjects: Project[];
  dbProjects: ProjectRecord[];
  isLoadingProjects: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'offline';
  saveConflict: boolean;
  serverVersion: number;
  undoCount: number;
  redoCount: number;

  // Video Upload
  activeUpload: UploadProgressEvent | null;

  // Viewport, Media & Playback
  aspectRatio: AspectRatio;
  showSafeMargins: boolean;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number; // 0 - 1
  isMuted: boolean;
  isScrubbing: boolean;
  zoomLevel: number;
  selectedSegmentId: string | null;

  // Media Loading & Error States
  mediaLoading: boolean;
  mediaError: string | null;
  mediaWarning: string | null;

  // Panels geometry
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;

  // Actions
  setActiveView: (view: 'editor' | 'settings') => void;
  setLeftPanelTab: (tab: 'media' | 'projects' | 'fonts') => void;
  setBottomPanelTab: (tab: 'timeline' | 'segments') => void;
  setProjectName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  toggleSafeMargins: () => void;
  setCurrentTimeMs: (ms: number) => void;
  setDurationMs: (ms: number) => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setIsScrubbing: (scrubbing: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  setSelectedSegmentId: (id: string | null) => void;

  // Media loading & error actions
  setMediaLoading: (loading: boolean) => void;
  setMediaError: (error: string | null) => void;
  setMediaWarning: (warning: string | null) => void;

  // Caption styling & Template system
  applyPreset: (presetId: string) => void;
  applyTemplate: (template: CaptionTemplate) => void;
  applyTemplateToScope: (templateId: string, scope: 'all' | 'selected') => void;
  updateStyle: (partial: Partial<CaptionStyle>) => void;
  customTemplates: CaptionTemplate[];
  favoriteTemplateIds: string[];
  toggleFavoriteTemplate: (id: string) => void;
  saveCustomTemplate: (name: string, category?: CaptionTemplate['category'], description?: string) => CaptionTemplate;
  duplicateTemplateAction: (templateId: string, newName?: string) => CaptionTemplate | undefined;
  deleteCustomTemplate: (templateId: string) => void;
  importTemplateFromJson: (jsonString: string) => { success: boolean; error?: string; template?: CaptionTemplate };
  exportTemplateJsonString: (templateId: string) => string | null;

  // Custom User Fonts
  userFonts: FontDefinition[];
  registerUserFont: (font: FontDefinition) => void;

  // Undo & Redo History
  undoStack: CaptionSegment[][];
  redoStack: CaptionSegment[][];
  undo: () => void;
  redo: () => void;

  // Timeline features
  isSnappingEnabled: boolean;
  setIsSnappingEnabled: (enabled: boolean) => void;
  showWordBlocks: boolean;
  setShowWordBlocks: (show: boolean) => void;
  seekToSegment: (id: string) => void;

  // Media & segments
  importMedia: (asset: MediaAsset) => void;
  replaceMedia: (asset: MediaAsset) => void;
  removeMedia: () => void;
  updateSegmentText: (id: string, text: string) => void;
  adjustSegmentTimes: (id: string, startMs: number, endMs: number) => void;
  splitSegment: (id: string, options?: { splitTimeMs?: number; wordIndex?: number }) => void;
  mergeSegments: (idA: string, idB: string) => void;
  mergeWithNext: (id: string) => void;
  deleteSegment: (id: string) => void;
  addSegment: (atMs?: number, durationMs?: number) => void;
  updateWord: (segmentId: string, wordId: string, updates: Partial<CaptionWord>) => void;
  revertSegmentToOriginal: (id: string) => void;
  setCaptionAnimation: (id: string, animation: CaptionAnimation) => void;
  setCaptionStyleOverride: (id: string, override: Partial<CaptionStyle>) => void;
  getOverlappingSegmentIds: () => Set<string>;

  // Caption Animation Engine
  globalAnimation: CaptionAnimationConfig;
  updateGlobalAnimation: (updates: Partial<CaptionAnimationConfig>) => void;
  setSegmentAnimation: (segmentId: string, animation?: CaptionAnimationConfig) => void;
  removeSegmentAnimationOverride: (segmentId: string) => void;

  // Panel resizing
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;

  // Supabase Project Management Actions
  fetchProjects: () => Promise<void>;
  createProject: (name?: string, aspectRatio?: AspectRatio) => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  recoverProject: (projectId: string) => Promise<void>;
  resolveConflict: (choice: 'overwrite' | 'reload') => Promise<void>;
  triggerAutoSave: () => void;
  saveProjectNow: () => Promise<void>;

  // Upload Actions
  startVideoUpload: (filePath: string) => Promise<void>;
  retryActiveUpload: () => Promise<void>;
  cancelActiveUpload: () => Promise<void>;
  dismissUpload: () => void;

  // Speech-to-Text Transcription (Groq Whisper)
  activeTranscriptionJob: TranscriptionJobProgress | null;
  transcriptionError: string | null;
  isTranscribing: boolean;
  transcriptionModalOpen: boolean;
  availableModels: TranscriptionModelOption[];
  hasGroqApiKey: boolean;
  setTranscriptionModalOpen: (open: boolean) => void;
  clearTranscriptionError: () => void;
  fetchTranscriptionModels: () => Promise<void>;
  startTranscription: (options?: {
    model?: string;
    language?: string;
    temperature?: number;
    wordsPerSegment?: number;
  }) => Promise<boolean>;
  rechunkCaptions: (wordsPerSegment: number) => void;
  cancelTranscription: () => Promise<void>;
  handleTranscriptionProgress: (progress: TranscriptionJobProgress) => void;

  // Subtitle & Video Export
  isExportModalOpen: boolean;
  activeExportJob: ExportJobProgress | null;
  exportError: string | null;
  isExporting: boolean;
  setExportModalOpen: (open: boolean) => void;
  clearExportError: () => void;
  startVideoExport: (options?: Partial<ExportVideoOptions>) => Promise<string | null>;
  cancelVideoExport: (jobId: string) => Promise<void>;
  downloadSubtitles: (format: 'srt' | 'vtt') => Promise<void>;
  handleExportProgress: (progress: ExportJobProgress) => void;
}

let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  activeView: 'editor',
  leftPanelTab: 'media',
  bottomPanelTab: 'timeline',

  dbProjects: [],
  isLoadingProjects: false,
  saveStatus: 'saved',
  saveConflict: false,
  serverVersion: 1,
  undoStack: [],
  redoStack: [],
  undoCount: 0,
  redoCount: 0,
  isSnappingEnabled: true,
  showWordBlocks: true,
  customTemplates: loadStoredCustomTemplates(),
  favoriteTemplateIds: loadStoredFavoriteTemplates(),
  userFonts: [],
  globalAnimation: { ...DEFAULT_ANIMATION_CONFIG },
  activeUpload: null,

  // Transcription State
  activeTranscriptionJob: null,
  transcriptionError: null,
  isTranscribing: false,
  transcriptionModalOpen: false,

  // Export State
  isExportModalOpen: false,
  activeExportJob: null,
  exportError: null,
  isExporting: false,
  availableModels: [
    {
      id: 'whisper-large-v3-turbo',
      name: 'Whisper Large v3 Turbo (Recommended)',
      description: 'Fastest transcription with high accuracy and low latency.',
      isDefault: true,
    },
    {
      id: 'whisper-large-v3',
      name: 'Whisper Large v3',
      description: 'Maximum multilingual quality and robust accents recognition.',
      isDefault: false,
    },
  ],
  hasGroqApiKey: false,

  aspectRatio: '9:16',
  showSafeMargins: true,
  currentTimeMs: 0,
  durationMs: 0,
  isPlaying: false,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  isScrubbing: false,
  zoomLevel: 1,
  selectedSegmentId: 'demo-seg-1',

  mediaLoading: false,
  mediaError: null,
  mediaWarning: null,

  leftPanelWidth: 260,
  rightPanelWidth: 320,
  bottomPanelHeight: 230,

  currentProject: {
    id: 'proj-1',
    name: 'Viral Short Project #1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mediaAsset: null, // Empty state by default
    captionSegments: INITIAL_DEMO_SEGMENTS,
    captionStyle: { ...(STYLE_PRESETS['hormozi'] ?? defaultFallbackStyle) },
    aspectRatio: '9:16',
  },

  recentProjects: [
    {
      id: 'demo-proj-1',
      name: '[DEMO] Alex Hormozi Style Reel',
      createdAt: '2026-10-29T10:00:00.000Z',
      updatedAt: '2026-10-30T14:20:00.000Z',
      mediaAsset: null,
      captionSegments: INITIAL_DEMO_SEGMENTS,
      captionStyle: { ...(STYLE_PRESETS['hormozi'] ?? defaultFallbackStyle) },
      aspectRatio: '9:16',
      isDemo: true,
    },
    {
      id: 'demo-proj-2',
      name: '[DEMO] Product Explainer Shorts',
      createdAt: '2026-10-28T09:15:00.000Z',
      updatedAt: '2026-10-29T11:45:00.000Z',
      mediaAsset: null,
      captionSegments: [],
      captionStyle: { ...(STYLE_PRESETS['minimal'] ?? defaultFallbackStyle) },
      aspectRatio: '16:9',
      isDemo: true,
    },
  ],

  setActiveView: (view) => {
    logger.info('Store', `Switched active view to ${view}`);
    set({ activeView: view });
  },

  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),

  setProjectName: (name) => {
    set((state) => ({
      currentProject: { ...state.currentProject, name, updatedAt: new Date().toISOString() },
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  setAspectRatio: (aspectRatio) => {
    logger.info('Store', `Aspect ratio set to ${aspectRatio}`);
    set((state) => ({
      aspectRatio,
      currentProject: { ...state.currentProject, aspectRatio },
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  toggleSafeMargins: () => set((state) => ({ showSafeMargins: !state.showSafeMargins })),

  setCurrentTimeMs: (ms) => {
    const clamped = Math.max(0, ms);
    set({ currentTimeMs: clamped });
  },

  setDurationMs: (durationMs) => set({ durationMs: Math.max(0, durationMs) }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(volume, 1)), isMuted: volume === 0 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setIsScrubbing: (isScrubbing) => set({ isScrubbing }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel: Math.max(0.2, Math.min(zoomLevel, 3)) }),
  setSelectedSegmentId: (selectedSegmentId) => set({ selectedSegmentId }),

  setMediaLoading: (mediaLoading) => set({ mediaLoading }),
  setMediaError: (mediaError) => set({ mediaError, mediaLoading: false }),
  setMediaWarning: (mediaWarning) => set({ mediaWarning }),

  applyPreset: (presetKey) => {
    const state = get();
    const template = getTemplateById(presetKey, state.customTemplates);
    const style = template?.style || STYLE_PRESETS[presetKey];
    if (style) {
      logger.info('Store', `Applied caption preset/template: ${presetKey}`);
      // Auto-load Google Font if applicable
      const baseFamily = style.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
      const fontDef = FONT_CATALOG.find((f) => f.family.toLowerCase() === baseFamily?.toLowerCase());
      if (fontDef) loadGoogleFont(fontDef);

      const animPreset = style.animation?.preset || style.animationType;
      const animUpdates = animPreset ? { ...style.animation, preset: animPreset } : style.animation;

      set((s) => ({
        currentProject: {
          ...s.currentProject,
          captionStyle: { ...style },
        },
        globalAnimation: animUpdates ? { ...s.globalAnimation, ...animUpdates } : s.globalAnimation,
        saveStatus: 'unsaved',
      }));
      get().triggerAutoSave();
    }
  },

  applyTemplate: (template) => {
    logger.info('Store', `Applying template: ${template.name} (${template.id})`);
    const baseFamily = template.style.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
    const fontDef = FONT_CATALOG.find((f) => f.family.toLowerCase() === baseFamily?.toLowerCase());
    if (fontDef) loadGoogleFont(fontDef);

    const animPreset = template.style.animation?.preset || template.style.animationType;
    const animUpdates = animPreset ? { ...template.style.animation, preset: animPreset } : template.style.animation;

    set((state) => ({
      currentProject: {
        ...state.currentProject,
        captionStyle: { ...template.style },
      },
      globalAnimation: animUpdates ? { ...state.globalAnimation, ...animUpdates } : state.globalAnimation,
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  applyTemplateToScope: (templateId, scope) => {
    const state = get();
    const template = getTemplateById(templateId, state.customTemplates);
    if (!template) return;

    if (scope === 'selected' && state.selectedSegmentId) {
      // Save current segments snapshot for undo
      const snapshot: CaptionSegment[] = JSON.parse(
        JSON.stringify(state.currentProject.captionSegments)
      );
      const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

      // Load fonts
      const baseFamily = template.style.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
      const fontDef = FONT_CATALOG.find((f) => f.family.toLowerCase() === baseFamily?.toLowerCase());
      if (fontDef) loadGoogleFont(fontDef);

      const updatedSegments = state.currentProject.captionSegments.map((seg) =>
        seg.id === state.selectedSegmentId
          ? {
              ...seg,
              styleOverrides: {
                ...seg.styleOverrides,
                ...template.style,
              },
            }
          : seg
      );

      set({
        undoStack: newUndo,
        redoStack: [],
        undoCount: newUndo.length,
        redoCount: 0,
        currentProject: {
          ...state.currentProject,
          captionSegments: updatedSegments,
        },
        saveStatus: 'unsaved',
      });
      get().triggerAutoSave();
    } else {
      get().applyTemplate(template);
    }
  },

  toggleFavoriteTemplate: (id) => {
    const state = get();
    const updated = state.favoriteTemplateIds.includes(id)
      ? state.favoriteTemplateIds.filter((favId) => favId !== id)
      : [...state.favoriteTemplateIds, id];
    persistFavoriteTemplates(updated);
    set({ favoriteTemplateIds: updated });
  },

  updateStyle: (partial) => {
    // If font family changed, trigger dynamic Google font loader
    if (partial.fontFamily) {
      const baseFamily = partial.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
      const fontDef = FONT_CATALOG.find((f) => f.family.toLowerCase() === baseFamily?.toLowerCase());
      if (fontDef) loadGoogleFont(fontDef);
    }

    set((state) => ({
      currentProject: {
        ...state.currentProject,
        captionStyle: {
          ...state.currentProject.captionStyle,
          ...partial,
        },
      },
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  saveCustomTemplate: (name, category = 'custom', description = '') => {
    const state = get();
    const newTemplate = createTemplateFromStyle(name, state.currentProject.captionStyle, category, description);
    const updated = [newTemplate, ...state.customTemplates];
    persistCustomTemplates(updated);
    set({ customTemplates: updated });
    logger.info('Store', `Saved custom template: ${newTemplate.name} (${newTemplate.id})`);
    return newTemplate;
  },

  duplicateTemplateAction: (templateId, newName) => {
    const state = get();
    const source = getTemplateById(templateId, state.customTemplates);
    if (!source) return undefined;

    const dup = duplicateTemplate(source, newName);
    const updated = [dup, ...state.customTemplates];
    persistCustomTemplates(updated);
    set({ customTemplates: updated });
    logger.info('Store', `Duplicated template: ${dup.name} from ${source.name}`);
    return dup;
  },

  deleteCustomTemplate: (templateId) => {
    const state = get();
    const updated = state.customTemplates.filter((t) => t.id !== templateId);
    persistCustomTemplates(updated);
    set({ customTemplates: updated });
    logger.info('Store', `Deleted custom template: ${templateId}`);
  },

  importTemplateFromJson: (jsonString) => {
    const result = validateTemplateJson(jsonString);
    if (!result.success || !result.template) {
      return { success: false, error: result.error || 'Failed to validate template' };
    }

    const state = get();
    // Prevent duplicate IDs
    const imported: CaptionTemplate = {
      ...result.template,
      id: `tpl_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isBuiltIn: false,
    };
    const updated = [imported, ...state.customTemplates];
    persistCustomTemplates(updated);
    set({ customTemplates: updated });

    // Also auto-apply the imported template so user can see it right away!
    get().applyTemplate(imported);

    return { success: true, template: imported };
  },

  exportTemplateJsonString: (templateId) => {
    const state = get();
    const template = getTemplateById(templateId, state.customTemplates);
    if (!template) return null;
    return exportTemplateAsJson(template);
  },

  registerUserFont: (font) => {
    set((state) => ({
      userFonts: [...state.userFonts, font],
    }));
  },

  importMedia: (asset) => {
    logger.info('Store', `Media imported: ${asset.name} (${asset.durationMs}ms, ${asset.width}x${asset.height})`);
    set((state) => ({
      currentProject: {
        ...state.currentProject,
        mediaAsset: asset,
        aspectRatio: asset.aspectRatio,
      },
      aspectRatio: asset.aspectRatio,
      durationMs: asset.durationMs,
      currentTimeMs: 0,
      isPlaying: false,
      mediaLoading: false,
      mediaError: null,
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  replaceMedia: (asset) => {
    logger.info('Store', `Replacing video with: ${asset.name}`);
    set((state) => ({
      currentProject: {
        ...state.currentProject,
        mediaAsset: asset,
        aspectRatio: asset.aspectRatio,
      },
      aspectRatio: asset.aspectRatio,
      durationMs: asset.durationMs,
      currentTimeMs: 0,
      isPlaying: false,
      mediaLoading: false,
      mediaError: null,
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  removeMedia: () => {
    logger.info('Store', 'Removing current media asset');
    set((state) => ({
      currentProject: {
        ...state.currentProject,
        mediaAsset: null,
      },
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
      mediaLoading: false,
      mediaError: null,
      mediaWarning: null,
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  // -------------------------------------------------------------
  // Undo & Redo History System
  // -------------------------------------------------------------
  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const [previous, ...restUndo] = state.undoStack;
    if (!previous) return;
    const currentSnapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newRedo = [currentSnapshot, ...state.redoStack].slice(0, 50);

    set({
      undoStack: restUndo,
      redoStack: newRedo,
      undoCount: restUndo.length,
      redoCount: newRedo.length,
      currentProject: {
        ...state.currentProject,
        captionSegments: previous,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const [next, ...restRedo] = state.redoStack;
    if (!next) return;
    const currentSnapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [currentSnapshot, ...state.undoStack].slice(0, 50);

    set({
      undoStack: newUndo,
      redoStack: restRedo,
      undoCount: newUndo.length,
      redoCount: restRedo.length,
      currentProject: {
        ...state.currentProject,
        captionSegments: next,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  setIsSnappingEnabled: (enabled) => set({ isSnappingEnabled: enabled }),
  setShowWordBlocks: (show) => set({ showWordBlocks: show }),

  seekToSegment: (id) => {
    const state = get();
    const seg = state.currentProject.captionSegments.find((s) => s.id === id);
    if (seg) {
      set({ selectedSegmentId: id, currentTimeMs: seg.startMs });
    }
  },

  getOverlappingSegmentIds: () => {
    return detectSegmentOverlaps(get().currentProject.captionSegments);
  },

  // -------------------------------------------------------------
  // Advanced Caption Operations (with undo preservation)
  // -------------------------------------------------------------
  updateSegmentText: (id, text) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: state.currentProject.captionSegments.map((seg) => {
          if (seg.id !== id) return seg;
          return { ...seg, text };
        }),
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  adjustSegmentTimes: (id, startMs, endMs) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = adjustSegmentTimesUtil(
      state.currentProject.captionSegments,
      id,
      startMs,
      endMs,
      state.durationMs > 0 ? state.durationMs : undefined
    );

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  splitSegment: (id, options) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const splitOpts = options || { splitTimeMs: state.currentTimeMs };
    const updated = splitSegmentUtil(state.currentProject.captionSegments, id, splitOpts);

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  mergeSegments: (idA, idB) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = mergeSegmentsUtil(state.currentProject.captionSegments, idA, idB);

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      selectedSegmentId: idA,
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  mergeWithNext: (id) => {
    const state = get();
    const sorted = [...state.currentProject.captionSegments].sort((a, b) => a.startMs - b.startMs);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx === -1 || idx >= sorted.length - 1) return;
    const nextSeg = sorted[idx + 1]!;
    get().mergeSegments(id, nextSeg.id);
  },

  deleteSegment: (id) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: state.currentProject.captionSegments.filter((seg) => seg.id !== id),
      },
      selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  addSegment: (atMs, durationMs) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const startMs = atMs !== undefined ? Math.max(0, Math.round(atMs)) : state.currentTimeMs;
    const dur = durationMs && durationMs > 0 ? durationMs : 2000;
    const endMs = startMs + dur;

    const newSeg: CaptionSegment = {
      id: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      startMs,
      endMs,
      text: 'NEW CAPTION',
      words: [{ id: `w_${Date.now()}`, text: 'NEW', startMs, endMs }],
      trackId: 'C1',
      originalText: 'NEW CAPTION',
      originalWords: [{ id: `w_${Date.now()}`, text: 'NEW', startMs, endMs }],
      isDemo: false,
    };

    const nextSegments = [...state.currentProject.captionSegments, newSeg].sort(
      (a, b) => a.startMs - b.startMs
    );

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: nextSegments,
      },
      selectedSegmentId: newSeg.id,
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  updateWord: (segmentId, wordId, updates) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = updateWordInSegmentUtil(
      state.currentProject.captionSegments,
      segmentId,
      wordId,
      updates
    );

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  revertSegmentToOriginal: (id) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = state.currentProject.captionSegments.map((seg) => {
      if (seg.id !== id || !seg.originalText) return seg;
      const origWords = seg.originalWords
        ? JSON.parse(JSON.stringify(seg.originalWords))
        : seg.words;
      return {
        ...seg,
        text: seg.originalText,
        words: origWords,
      };
    });

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  setCaptionAnimation: (id, animation) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = state.currentProject.captionSegments.map((seg) =>
      seg.id === id ? { ...seg, animation } : seg
    );

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  updateGlobalAnimation: (updates) => {
    set((state) => ({
      globalAnimation: {
        ...state.globalAnimation,
        ...updates,
      },
      currentProject: {
        ...state.currentProject,
        captionStyle: {
          ...state.currentProject.captionStyle,
          animation: {
            ...(state.currentProject.captionStyle.animation || state.globalAnimation),
            ...updates,
          },
          animationType: updates.preset || state.currentProject.captionStyle.animationType,
        },
      },
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  setSegmentAnimation: (segmentId, animation) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = state.currentProject.captionSegments.map((seg) => {
      if (seg.id !== segmentId) return seg;
      if (!animation) {
        const copy = { ...seg };
        delete copy.animation;
        return copy;
      }
      return {
        ...seg,
        animation: {
          ...animation,
          type: animation.preset,
        },
      };
    });

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  removeSegmentAnimationOverride: (segmentId) => {
    get().setSegmentAnimation(segmentId, undefined);
  },

  setCaptionStyleOverride: (id, override) => {
    const state = get();
    const snapshot: CaptionSegment[] = JSON.parse(
      JSON.stringify(state.currentProject.captionSegments)
    );
    const newUndo = [snapshot, ...state.undoStack].slice(0, 50);

    const updated = state.currentProject.captionSegments.map((seg) =>
      seg.id === id
        ? { ...seg, styleOverrides: { ...seg.styleOverrides, ...override } }
        : seg
    );

    set({
      undoStack: newUndo,
      redoStack: [],
      undoCount: newUndo.length,
      redoCount: 0,
      currentProject: {
        ...state.currentProject,
        captionSegments: updated,
      },
      saveStatus: 'unsaved',
    });
    get().triggerAutoSave();
  },

  setLeftPanelWidth: (width) => set({ leftPanelWidth: Math.max(180, Math.min(width, 420)) }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(240, Math.min(width, 480)) }),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(140, Math.min(height, 460)) }),

  // -------------------------------------------------------------
  // Supabase Project Management Actions
  // -------------------------------------------------------------
  fetchProjects: async () => {
    set({ isLoadingProjects: true });
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.listProjects();
        if (res.success) {
          set({ dbProjects: res.projects });
        }
      }
    } catch (err) {
      logger.error('Store', 'Failed to fetch projects', err);
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  createProject: async (name, aspectRatio = '9:16') => {
    const projName = name || `Project ${new Date().toLocaleDateString()}`;
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.createProject({
          name: projName,
          aspectRatio,
        });

        if (res.success && res.project) {
          const p = res.project;
          const newCurrent: Project = {
            id: p.id,
            name: p.name,
            aspectRatio: p.aspectRatio,
            captionStyle: p.captionStyle,
            captionSegments: p.captionSegments,
            mediaAsset: null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            version: p.version,
            userId: p.userId,
          };

          set({
            currentProject: newCurrent,
            aspectRatio: p.aspectRatio,
            durationMs: 0,
            currentTimeMs: 0,
            saveStatus: 'saved',
            saveConflict: false,
          });

          await get().fetchProjects();
          return;
        }
      }

      // Offline / browser fallback
      const fallbackId = `proj-${Date.now()}`;
      set({
        currentProject: {
          id: fallbackId,
          name: projName,
          aspectRatio,
          captionStyle: { ...(STYLE_PRESETS['hormozi'] ?? defaultFallbackStyle) },
          captionSegments: [],
          mediaAsset: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        aspectRatio,
        durationMs: 0,
        currentTimeMs: 0,
        saveStatus: 'saved',
      });
    } catch (err) {
      logger.error('Store', 'Error creating project', err);
    }
  },

  openProject: async (projectId: string) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.getProject(projectId);
        if (res.success && res.project) {
          const p = res.project;
          let mediaAsset: MediaAsset | null = null;

          if (p.videoStoragePath) {
            // Get fresh signed URL for playback
            const urlRes = await window.electronAPI.getSignedUrl(p.videoStoragePath, 86400);
            const streamUrl = urlRes.signedUrl || p.videoStoragePath;

            mediaAsset = {
              id: p.videoId || `media-${Date.now()}`,
              name: p.videoName || 'video.mp4',
              filePath: p.videoStoragePath,
              streamUrl,
              durationMs: p.videoDurationMs || 0,
              width: p.videoWidth || 1080,
              height: p.videoHeight || 1920,
              sizeBytes: 0,
              fps: p.videoFps || 30,
              aspectRatio: p.aspectRatio,
              createdAt: p.createdAt,
            };
          }

          const opened: Project = {
            id: p.id,
            name: p.name,
            aspectRatio: p.aspectRatio,
            captionStyle: p.captionStyle,
            captionSegments: p.captionSegments,
            mediaAsset,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            version: p.version,
            userId: p.userId,
          };

          set({
            currentProject: opened,
            aspectRatio: p.aspectRatio,
            durationMs: mediaAsset?.durationMs || 0,
            currentTimeMs: 0,
            saveStatus: 'saved',
            saveConflict: false,
          });

          return;
        }
      }

      // Check recent projects fallback
      const state = get();
      const localFound = state.recentProjects.find((p) => p.id === projectId);
      if (localFound) {
        set({
          currentProject: { ...localFound },
          aspectRatio: localFound.aspectRatio,
          durationMs: localFound.mediaAsset?.durationMs || 0,
          currentTimeMs: 0,
          saveStatus: 'saved',
        });
      }
    } catch (err) {
      logger.error('Store', `Failed to open project ${projectId}`, err);
    }
  },

  renameProject: async (projectId: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;

    try {
      const state = get();
      if (state.currentProject.id === projectId) {
        set((s) => ({
          currentProject: { ...s.currentProject, name: cleanName },
        }));
        await get().saveProjectNow();
      } else if (window.electronAPI) {
        const pRes = await window.electronAPI.getProject(projectId);
        if (pRes.success && pRes.project) {
          await window.electronAPI.updateProject({
            id: projectId,
            name: cleanName,
            version: pRes.project.version,
          });
          await get().fetchProjects();
        }
      }
    } catch (err) {
      logger.error('Store', 'Rename project failed', err);
    }
  },

  duplicateProject: async (projectId: string) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.duplicateProject(projectId);
        if (res.success && res.project) {
          await get().fetchProjects();
        }
      }
    } catch (err) {
      logger.error('Store', 'Duplicate project failed', err);
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteProject(projectId);
      }

      const state = get();
      if (state.currentProject.id === projectId) {
        // Open the next project or create a fresh one
        const remaining = state.dbProjects.filter((p) => p.id !== projectId);
        if (remaining.length > 0 && remaining[0]) {
          await get().openProject(remaining[0].id);
        } else {
          await get().createProject('New Project');
        }
      }
      await get().fetchProjects();
    } catch (err) {
      logger.error('Store', 'Delete project failed', err);
    }
  },

  recoverProject: async (projectId: string) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.recoverProject(projectId);
        if (res.success && res.project) {
          await get().openProject(res.project.id);
        }
      }
    } catch (err) {
      logger.error('Store', 'Recovery failed', err);
    }
  },

  resolveConflict: async (choice: 'overwrite' | 'reload') => {
    const state = get();
    if (choice === 'reload') {
      await get().openProject(state.currentProject.id);
    } else {
      // Overwrite server version
      set((s) => ({
        currentProject: {
          ...s.currentProject,
          version: state.serverVersion,
        },
        saveConflict: false,
      }));
      await get().saveProjectNow();
    }
  },

  triggerAutoSave: () => {
    set({ saveStatus: 'unsaved' });
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(() => {
      void get().saveProjectNow();
    }, 800);
  },

  saveProjectNow: async () => {
    const state = get();
    const proj = state.currentProject;

    if (state.saveConflict) {
      logger.warn('Store', 'Skipping auto-save due to active version conflict');
      return;
    }

    set({ saveStatus: 'saving' });

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.updateProject({
          id: proj.id,
          name: proj.name,
          aspectRatio: proj.aspectRatio,
          captionStyle: proj.captionStyle,
          captionSegments: proj.captionSegments,
          videoId: proj.mediaAsset?.id || null,
          videoStoragePath: proj.mediaAsset?.filePath || null,
          videoName: proj.mediaAsset?.name || null,
          videoDurationMs: proj.mediaAsset?.durationMs || null,
          videoWidth: proj.mediaAsset?.width || null,
          videoHeight: proj.mediaAsset?.height || null,
          videoFps: proj.mediaAsset?.fps || null,
          version: proj.version || 1,
        });

        if (res.conflict) {
          set({
            saveStatus: 'conflict',
            saveConflict: true,
            serverVersion: res.serverVersion || 1,
          });
          logger.warn('Store', 'Concurrent modification conflict detected');
          return;
        }

        if (res.success && res.project) {
          set((s) => ({
            currentProject: {
              ...s.currentProject,
              version: res.project?.version,
              updatedAt: res.project?.updatedAt || new Date().toISOString(),
            },
            saveStatus: 'saved',
            saveConflict: false,
          }));

          // Backup local recovery snapshot
          try {
            localStorage.setItem(`autocaption_recovery_${proj.id}`, JSON.stringify(res.project));
          } catch {
            // Ignore localStorage quota
          }

          return;
        }
      }

      // Offline / browser fallback
      set({ saveStatus: 'offline' });
      try {
        localStorage.setItem(`autocaption_recovery_${proj.id}`, JSON.stringify(proj));
      } catch {
        // Ignore
      }
    } catch (err) {
      logger.warn('Store', 'Autosave error, falling back to local snapshot', err);
      set({ saveStatus: 'offline' });
    }
  },

  // -------------------------------------------------------------
  // Video Upload Lifecycle
  // -------------------------------------------------------------
  startVideoUpload: async (filePath: string) => {
    const state = get();
    try {
      set({
        activeUpload: {
          uploadId: 'init',
          fileName: filePath.split(/[/\\]/).pop() || 'video.mp4',
          bytesUploaded: 0,
          totalBytes: 0,
          percentage: 0,
          status: 'validating',
        },
      });

      if (window.electronAPI) {
        const res = await window.electronAPI.startUpload({
          filePath,
          projectId: state.currentProject.id,
          maxSizeBytes: 500 * 1024 * 1024,
        });

        if (!res.success) {
          set((s) => ({
            activeUpload: s.activeUpload
              ? {
                  ...s.activeUpload,
                  status: 'error',
                  error: res.error || 'Upload failed',
                }
              : null,
          }));
        }
      }
    } catch (err) {
      logger.error('Store', 'startVideoUpload threw error', err);
      set((s) => ({
        activeUpload: s.activeUpload
          ? {
              ...s.activeUpload,
              status: 'error',
              error: err instanceof Error ? err.message : 'Upload failed',
            }
          : null,
      }));
    }
  },

  retryActiveUpload: async () => {
    const upload = get().activeUpload;
    if (!upload || !window.electronAPI) return;

    set((s) => ({
      activeUpload: s.activeUpload
        ? { ...s.activeUpload, status: 'uploading', error: null }
        : null,
    }));

    await window.electronAPI.retryUpload(upload.uploadId);
  },

  cancelActiveUpload: async () => {
    const upload = get().activeUpload;
    if (!upload || !window.electronAPI) return;

    await window.electronAPI.cancelUpload(upload.uploadId);
    set((s) => ({
      activeUpload: s.activeUpload
        ? { ...s.activeUpload, status: 'cancelled' }
        : null,
    }));
  },

  dismissUpload: () => {
    set({ activeUpload: null });
  },

  // Transcription Actions
  setTranscriptionModalOpen: (open: boolean) => {
    set({ transcriptionModalOpen: open });
  },

  clearTranscriptionError: () => {
    set({ transcriptionError: null });
  },

  fetchTranscriptionModels: async () => {
    if (window.electronAPI?.getTranscriptionModels) {
      try {
        const res = await window.electronAPI.getTranscriptionModels();
        if (res.success && res.models) {
          set({
            availableModels: res.models,
            hasGroqApiKey: Boolean(res.hasApiKey),
          });
        }
      } catch (err) {
        logger.warn('Store', 'Failed to fetch transcription models via IPC', err);
      }
      return;
    }

    // Fallback: fetch via dev server when running in browser mode
    try {
      const resp = await fetch('/api/dev/transcription/models');
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.models) {
          set({
            availableModels: data.models,
            hasGroqApiKey: Boolean(data.hasApiKey),
          });
        }
      }
    } catch (err) {
      logger.warn('Store', 'Failed to fetch transcription models via dev server', err);
    }
  },

  startTranscription: async (options) => {
    const state = get();
    const media = state.currentProject.mediaAsset;

    if (!media) {
      set({ transcriptionError: 'No video is currently loaded in this project. Please import or select a video first.' });
      return false;
    }

    set({ isTranscribing: true, transcriptionError: null });

    // Mode 1: Electron Desktop App (native IPC with local filesystem path)
    if (window.electronAPI?.startTranscription && media.filePath) {
      try {
        const result = await window.electronAPI.startTranscription({
          projectId: state.currentProject.id,
          videoFilePath: media.filePath,
          model: options?.model || 'whisper-large-v3-turbo',
          language: options?.language || 'auto',
          temperature: options?.temperature ?? 0,
          wordsPerSegment: options?.wordsPerSegment ?? 0,
        });

        if (!result.success || !result.jobId) {
          set({
            isTranscribing: false,
            transcriptionError: result.error || 'Failed to start transcription job.',
          });
          return false;
        }

        set({
          activeTranscriptionJob: {
            jobId: result.jobId,
            projectId: state.currentProject.id,
            status: 'queued',
            percentage: 0,
            progress: 0,
            stage: 'Transcription job queued...',
          },
        });

        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ isTranscribing: false, transcriptionError: msg });
        return false;
      }
    }

    // Mode 2: Browser Mode / Web dev server fallback
    try {
      const file = media.browserFile;
      if (!file) {
        // If in Electron but only filePath exists
        if (window.electronAPI?.startTranscription && media.filePath) {
          const result = await window.electronAPI.startTranscription({
            projectId: state.currentProject.id,
            videoFilePath: media.filePath,
            model: options?.model || 'whisper-large-v3-turbo',
            language: options?.language || 'auto',
            temperature: options?.temperature ?? 0,
            wordsPerSegment: options?.wordsPerSegment ?? 0,
          });
          if (!result.success || !result.jobId) {
            set({
              isTranscribing: false,
              transcriptionError: result.error || 'Failed to start transcription job.',
            });
            return false;
          }
          set({
            activeTranscriptionJob: {
              jobId: result.jobId,
              projectId: state.currentProject.id,
              status: 'queued',
              percentage: 0,
              progress: 0,
              stage: 'Transcription job queued...',
            },
          });
          return true;
        }

        set({
          isTranscribing: false,
          transcriptionError: 'Video file data is not available. Please drag and drop the video file again into the player.',
        });
        return false;
      }

      set({
        activeTranscriptionJob: {
          jobId: `dev-${Date.now()}`,
          projectId: state.currentProject.id,
          status: 'processing',
          percentage: 15,
          progress: 15,
          stage: 'Extracting 16kHz audio from video with FFmpeg...',
        },
      });

      const params = new URLSearchParams();
      params.set('model', options?.model || 'whisper-large-v3-turbo');
      if (options?.language) params.set('language', options.language);
      if (options?.temperature !== undefined) params.set('temperature', String(options.temperature));
      if (options?.wordsPerSegment !== undefined) params.set('wordsPerSegment', String(options.wordsPerSegment));

      const res = await fetch(`/api/dev/transcription/start?${params.toString()}`, {
        method: 'POST',
        body: file,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }

      set((s) => ({
        activeTranscriptionJob: s.activeTranscriptionJob
          ? { ...s.activeTranscriptionJob, percentage: 85, stage: 'Formatting and applying timestamps...' }
          : null,
      }));

      const data = await res.json();
      if (!data.success || !data.segments) {
        throw new Error(data.error || 'Failed to transcribe audio.');
      }

      set((s) => ({
        currentProject: {
          ...s.currentProject,
          captionSegments: data.segments,
        },
        selectedSegmentId: data.segments[0]?.id || null,
        isTranscribing: false,
        activeTranscriptionJob: {
          jobId: `dev-done`,
          projectId: s.currentProject.id,
          status: 'completed',
          percentage: 100,
          progress: 100,
          stage: `Transcription complete! ${data.segments.length} captions generated.`,
        },
        saveStatus: 'saved',
      }));

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isTranscribing: false, transcriptionError: msg });
      return false;
    }
  },

  rechunkCaptions: (wordsPerSegment: number) => {
    const state = get();
    const currentSegments = state.currentProject.captionSegments;
    if (currentSegments.length === 0) return;

    // Collect all words preserving timing
    const allWords = currentSegments.flatMap((s) => s.words);
    if (allWords.length === 0) return;

    let newSegments: CaptionSegment[] = [];
    if (wordsPerSegment > 0) {
      newSegments = chunkWordsIntoSegments(allWords, wordsPerSegment);
    } else {
      // Natural/single continuous segment if wordsPerSegment is 0
      newSegments = [
        {
          id: `seg_${Date.now()}`,
          startMs: allWords[0]!.startMs,
          endMs: allWords[allWords.length - 1]!.endMs,
          text: allWords.map((w) => w.text).join(' '),
          words: allWords,
          isDemo: false,
        },
      ];
    }

    set((s) => ({
      currentProject: {
        ...s.currentProject,
        captionSegments: newSegments,
      },
      selectedSegmentId: newSegments[0]?.id || null,
      saveStatus: 'unsaved',
    }));
    get().triggerAutoSave();
  },

  cancelTranscription: async () => {
    const job = get().activeTranscriptionJob;
    if (!job || !window.electronAPI?.cancelTranscription) return;

    try {
      await window.electronAPI.cancelTranscription(job.jobId);
      set((s) => ({
        isTranscribing: false,
        activeTranscriptionJob: s.activeTranscriptionJob
          ? { ...s.activeTranscriptionJob, status: 'cancelled', stage: 'Cancelled by user.' }
          : null,
      }));
    } catch (err) {
      logger.warn('Store', 'Failed to cancel transcription job', err);
    }
  },

  handleTranscriptionProgress: (progress: TranscriptionJobProgress) => {
    const currentJob = get().activeTranscriptionJob;
    if (currentJob && currentJob.jobId !== progress.jobId) {
      return;
    }

    set({ activeTranscriptionJob: progress });

    if (progress.status === 'completed') {
      logger.info('Store', `Transcription completed for job ${progress.jobId}. Fetching updated project.`);
      set({ isTranscribing: false });

      if (progress.captionSegments && progress.captionSegments.length > 0) {
        set((s) => ({
          currentProject: {
            ...s.currentProject,
            captionSegments: progress.captionSegments!,
          },
          selectedSegmentId: progress.captionSegments![0]?.id || null,
          saveStatus: 'saved',
        }));
      }

      const projectId = progress.projectId || get().currentProject.id;
      if (window.electronAPI?.getProject) {
        window.electronAPI.getProject(projectId).then((res) => {
          if (res.success && res.project) {
            set((s) => ({
              currentProject: {
                ...s.currentProject,
                captionSegments: res.project!.captionSegments || [],
              },
              selectedSegmentId: res.project!.captionSegments?.[0]?.id || null,
              saveStatus: 'saved',
            }));
          }
        }).catch((err) => {
          logger.error('Store', 'Failed to reload project after transcription', err);
        });
      }
    } else if (progress.status === 'failed') {
      set({
        isTranscribing: false,
        transcriptionError: progress.error || 'Transcription job failed.',
      });
    } else if (progress.status === 'cancelled') {
      set({ isTranscribing: false });
    }
  },

  // Subtitle & Video Export Actions
  setExportModalOpen: (open: boolean) => {
    set({ isExportModalOpen: open, ...(open ? { exportError: null } : {}) });
  },

  clearExportError: () => {
    set({ exportError: null });
  },

  handleExportProgress: (progress: ExportJobProgress) => {
    set({ activeExportJob: progress });
    if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
      set({ isExporting: false });
    }
    if (progress.status === 'failed') {
      set({ exportError: progress.error || 'Video export failed.' });
    }
  },

  cancelVideoExport: async (jobId: string) => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.cancelExport) {
        await window.electronAPI.cancelExport(jobId);
      } else {
        await fetch(`/api/dev/export/cancel?jobId=${jobId}`, { method: 'POST' });
      }
      set({ isExporting: false, activeExportJob: null });
    } catch (err: unknown) {
      logger.error('Store', 'Cancel video export failed', err);
    }
  },

  downloadSubtitles: async (format: 'srt' | 'vtt') => {
    const state = get();
    const segments = state.currentProject.captionSegments;
    const title = state.currentProject.name || 'AutoCaption';

    if (!segments || segments.length === 0) {
      set({ exportError: 'No captions found in this project to export.' });
      return;
    }

    try {
      let content = '';
      if (format === 'srt') {
        content = exportToSrt(segments);
      } else {
        content = exportToWebVtt(segments, title);
      }

      if (typeof window !== 'undefined' && window.electronAPI?.exportSubtitles) {
        try {
          const res = await window.electronAPI.exportSubtitles({
            projectId: state.currentProject.id,
            projectName: title,
            format,
            captionSegments: segments,
          });
          if (res.content) {
            content = res.content;
          }
        } catch {
          // fallback to client-generated content
        }
      }

      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${safeTitle}_subtitles.${format}`;
      const blob = new Blob([content], {
        type: format === 'srt' ? 'text/plain;charset=utf-8' : 'text/vtt;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.info('Store', `Downloaded ${format.toUpperCase()} subtitles: ${filename}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ exportError: `Subtitle export failed: ${msg}` });
    }
  },

  startVideoExport: async (options?: Partial<ExportVideoOptions>): Promise<string | null> => {
    const state = get();
    const { currentProject } = state;

    if (!currentProject.mediaAsset && !options?.videoPath) {
      set({ exportError: 'Please import a video into your project before exporting.' });
      return null;
    }

    set({ isExporting: true, exportError: null, activeExportJob: null });

    let finalVideoPath = options?.videoPath || currentProject.mediaAsset?.filePath;

    // In web mode without Electron, ensure raw browser video is uploaded to the dev server before export
    if (typeof window !== 'undefined' && !window.electronAPI) {
      const browserFile = currentProject.mediaAsset?.browserFile;
      const isSimpleFileName = finalVideoPath && !finalVideoPath.includes('/') && !finalVideoPath.includes('\\');
      if (browserFile && (!finalVideoPath || isSimpleFileName)) {
        try {
          const formData = new FormData();
          formData.append('file', browserFile);
          const uploadRes = await fetch('/api/dev/media/upload', {
            method: 'POST',
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            if (uploadJson.success && uploadJson.filePath) {
              finalVideoPath = uploadJson.filePath;
              if (currentProject.mediaAsset) {
                currentProject.mediaAsset.filePath = uploadJson.filePath;
              }
            }
          }
        } catch (uploadErr) {
          logger.warn('Store', 'Pre-export media upload to dev server failed:', uploadErr);
        }
      }
    }

    const exportInput = {
      projectId: currentProject.id,
      projectName: currentProject.name,
      videoPath: finalVideoPath,
      aspectRatio: options?.aspectRatio || currentProject.aspectRatio || state.aspectRatio || '9:16',
      resolution: options?.resolution || 'original',
      quality: options?.quality || 'standard',
      fps: options?.fps,
      burnInCaptions: options?.burnInCaptions ?? true,
      styleOverride: options?.styleOverride,
      captionSegments: currentProject.captionSegments,
      captionStyle: currentProject.captionStyle,
    };

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.startExport) {
        const result = await window.electronAPI.startExport(exportInput);
        if (result.success && result.jobId) {
          logger.info('Store', `Video export started with job ID: ${result.jobId}`);
          return result.jobId;
        } else {
          set({
            isExporting: false,
            exportError: result.error || 'Failed to start video export worker.',
          });
          return null;
        }
      } else {
        // Dev server / web fallback
        const res = await fetch('/api/dev/export/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportInput),
        });
        const data = await res.json();
        if (data.success && data.jobId) {
          logger.info('Store', `Web dev video export started: ${data.jobId}`);

          // Poll dev server for export progress
          const pollInterval = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/dev/export/status?jobId=${data.jobId}`);
              const statusData = await statusRes.json();
              if (statusData.success && statusData.job) {
                get().handleExportProgress(statusData.job);
                if (
                  statusData.job.status === 'completed' ||
                  statusData.job.status === 'failed' ||
                  statusData.job.status === 'cancelled'
                ) {
                  clearInterval(pollInterval);
                }
              }
            } catch {
              clearInterval(pollInterval);
            }
          }, 500);

          return data.jobId;
        } else {
          set({
            isExporting: false,
            exportError: data.error || 'Export service unavailable in current environment.',
          });
          return null;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isExporting: false, exportError: msg });
      return null;
    }
  },
}));

// Wire up global upload progress listener if running inside Electron
if (typeof window !== 'undefined' && window.electronAPI?.onUploadProgress) {
  window.electronAPI.onUploadProgress((progress) => {
    useAppStore.setState({ activeUpload: progress });

    if (progress.status === 'completed' && progress.signedUrl) {
      const state = useAppStore.getState();

      const newAsset: MediaAsset = {
        id: progress.videoId || `media-${Date.now()}`,
        name: progress.fileName,
        filePath: state.currentProject.mediaAsset?.filePath || progress.storagePath || progress.fileName,
        streamUrl: progress.signedUrl,
        durationMs: state.durationMs,
        width: 1080,
        height: 1920,
        sizeBytes: progress.totalBytes,
        fps: 30,
        aspectRatio: state.aspectRatio,
        createdAt: new Date().toISOString(),
      };

      state.importMedia(newAsset);
      logger.info('Store', `Cloud video upload attached to project: ${progress.fileName}`);
    }
  });
}

// Wire up global transcription progress listener if running inside Electron
if (typeof window !== 'undefined' && window.electronAPI?.onTranscriptionProgress) {
  window.electronAPI.onTranscriptionProgress((progress) => {
    useAppStore.getState().handleTranscriptionProgress(progress);
  });
}

// Wire up global export progress listener if running inside Electron
if (typeof window !== 'undefined' && window.electronAPI?.onExportProgress) {
  window.electronAPI.onExportProgress((progress) => {
    useAppStore.getState().handleExportProgress(progress);
  });
}
