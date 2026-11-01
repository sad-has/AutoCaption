import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  getBuiltInTemplates,
  getTemplateById,
  filterTemplates,
  toggleFavoriteTemplateId,
  createTemplateFromStyle,
  duplicateTemplate,
  exportTemplateAsJson,
  validateTemplateJson,
} from '../src/shared/templates';
import { CaptionTemplateSchema } from '../src/shared/schemas';
import type { CaptionSegment, CaptionStyle, CaptionTemplate } from '../src/shared/types';
import { useAppStore, defaultFallbackStyle } from '../src/renderer/src/store/useAppStore';
import { computeCaptionAnimation } from '../src/shared/animations/engine';
import { exportToAss, getAnimationExportSupport } from '../src/shared/export/subtitles';
import { resolveNormalizedCaptionRendering } from '../src/shared/rendering/captionRenderer';

describe('Phase 11: Premium Caption Template Engine', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      currentProject: {
        id: 'test-proj-p11',
        userId: 'test-user-p11',
        name: 'Premium Template Test',
        createdAt: '2026-10-31T00:00:00Z',
        updatedAt: '2026-10-31T00:00:00Z',
        version: 1,
        aspectRatio: '9:16',
        mediaAsset: null,
        captionStyle: { ...defaultFallbackStyle },
        captionSegments: [
          {
            id: 'seg-1',
            startMs: 0,
            endMs: 2000,
            text: 'THE SIGNATURE REVEAL',
            words: [
              { id: 'w1', text: 'THE', startMs: 0, endMs: 400 },
              { id: 'w2', text: 'SIGNATURE', startMs: 400, endMs: 1200 },
              { id: 'w3', text: 'REVEAL', startMs: 1200, endMs: 2000 },
            ],
          },
          {
            id: 'seg-2',
            startMs: 2000,
            endMs: 4000,
            text: 'CRAFTED WITH PRECISION',
            words: [
              { id: 'w4', text: 'CRAFTED', startMs: 2000, endMs: 2700 },
              { id: 'w5', text: 'WITH', startMs: 2700, endMs: 3100 },
              { id: 'w6', text: 'PRECISION', startMs: 3100, endMs: 4000 },
            ],
          },
        ],
      },
      selectedSegmentId: null,
      undoStack: [],
      redoStack: [],
      undoCount: 0,
      redoCount: 0,
      customTemplates: [],
      favoriteTemplateIds: [],
    });
  });

  describe('1. Template Library & Signature Presets Integrity', () => {
    it('contains all 23 built-in templates (12 legacy + 6 Phase 11 premium + 5 dual-font presets)', () => {
      const templates = getBuiltInTemplates();
      expect(templates.length).toBe(23);

      const ids = templates.map((t) => t.id);
      expect(new Set(ids).size).toBe(23); // Unique IDs guarantee

      // Verify 6 signature presets from Phase 11
      const signatureIds = [
        'velvet-signature',
        'golden-quill',
        'bold-verse',
        'clay-label',
        'spotlight-line',
        'kinetic-impact',
      ];

      signatureIds.forEach((id) => {
        expect(ids).toContain(id);
        const tpl = templates.find((t) => t.id === id);
        expect(tpl).toBeDefined();
        expect(tpl?.isBuiltIn).toBe(true);
        expect(tpl?.style).toBeDefined();
        expect(tpl?.style.fontFamily).toBeTruthy();
        expect(tpl?.style.textColor).toBeTruthy();
      });
    });

    it('strictly validates every built-in template against CaptionTemplateSchema', () => {
      BUILTIN_TEMPLATES.forEach((tpl) => {
        const result = CaptionTemplateSchema.safeParse(tpl);
        expect(result.success).toBe(true);
      });
    });

    it('verifies Velvet Signature design properties', () => {
      const tpl = getTemplateById('velvet-signature');
      expect(tpl).toBeDefined();
      expect(tpl?.category).toBe('luxury');
      expect(tpl?.style.fontFamily).toContain('Playfair Display');
      expect(tpl?.style.textColor).toBe('#FFFBF2');
      expect(tpl?.style.activeWordColor).toBe('#E2B874');
      expect(tpl?.style.animationType).toBe('fade');
    });

    it('verifies Golden Quill design properties', () => {
      const tpl = getTemplateById('golden-quill');
      expect(tpl).toBeDefined();
      expect(tpl?.category).toBe('luxury');
      expect(tpl?.style.fontFamily).toContain('Cinzel');
      expect(tpl?.style.textColor).toBe('#F7E7CE');
      expect(tpl?.style.activeWordColor).toBe('#E5C158');
      expect(tpl?.style.animationType).toBe('fade-in');
    });

    it('verifies Bold Verse design properties', () => {
      const tpl = getTemplateById('bold-verse');
      expect(tpl).toBeDefined();
      expect(tpl?.category).toBe('bold');
      expect(tpl?.style.fontFamily).toContain('Anton');
      expect(tpl?.style.textTransform).toBe('uppercase');
      expect(tpl?.style.strokeWidth).toBeGreaterThanOrEqual(4);
      expect(tpl?.style.activeWordColor).toBe('#00F0FF');
      expect(tpl?.style.animationType).toBe('scale');
    });

    it('verifies Clay Label compact pill container properties', () => {
      const tpl = getTemplateById('clay-label');
      expect(tpl).toBeDefined();
      expect(tpl?.category).toBe('creator');
      expect(tpl?.style.hasBox).toBe(true);
      expect(tpl?.style.boxColor).toBe('#1E293B');
      expect(tpl?.style.boxCornerRadius).toBe(16);
      expect(tpl?.style.activeWordColor).toBe('#34D399');
      expect(tpl?.style.highlightStyle).toBe('pill');
    });

    it('verifies Spotlight Line hyper-focused contrast properties', () => {
      const tpl = getTemplateById('spotlight-line');
      expect(tpl).toBeDefined();
      expect(tpl?.category).toBe('minimal');
      expect(tpl?.style.fontFamily).toContain('Outfit');
      expect(tpl?.style.activeWordColor).toBe('#FFFFFF');
      expect(tpl?.style.animationType).toBe('word-reveal');
    });
  });

  describe('2. Filter, Search & Favorites Engine', () => {
    it('filters templates by category', () => {
      const luxury = filterTemplates(BUILTIN_TEMPLATES, { category: 'luxury' });
      expect(luxury.length).toBeGreaterThanOrEqual(2);
      luxury.forEach((tpl) => expect(tpl.category).toBe('luxury'));

      const creator = filterTemplates(BUILTIN_TEMPLATES, { category: 'creator' });
      expect(creator.length).toBeGreaterThanOrEqual(3);
      creator.forEach((tpl) => expect(tpl.category).toBe('creator'));
    });

    it('searches templates across names, descriptions and tags', () => {
      const resultsByTag = filterTemplates(BUILTIN_TEMPLATES, { search: 'quill' });
      expect(resultsByTag.length).toBeGreaterThanOrEqual(1);
      expect(resultsByTag[0]?.id).toBe('golden-quill');

      const resultsByName = filterTemplates(BUILTIN_TEMPLATES, { search: 'Velvet' });
      expect(resultsByName.length).toBeGreaterThanOrEqual(1);
      expect(resultsByName[0]?.id).toBe('velvet-signature');
    });

    it('toggles and filters favorite templates correctly', () => {
      let favorites: string[] = [];
      favorites = toggleFavoriteTemplateId('golden-quill', favorites);
      expect(favorites).toEqual(['golden-quill']);

      favorites = toggleFavoriteTemplateId('clay-label', favorites);
      expect(favorites).toEqual(['golden-quill', 'clay-label']);

      // Filter by favorites only
      const favTemplates = filterTemplates(BUILTIN_TEMPLATES, {
        favoritesOnly: true,
        favoriteIds: favorites,
      });
      expect(favTemplates.map((t) => t.id)).toEqual(['golden-quill', 'clay-label']);

      // Untoggle
      favorites = toggleFavoriteTemplateId('golden-quill', favorites);
      expect(favorites).toEqual(['clay-label']);
    });
  });

  describe('3. Template Creator, Duplicate & JSON Schema Validation', () => {
    it('creates custom template from active style', () => {
      const custom = createTemplateFromStyle(
        'Vibrant Neon Glow',
        {
          ...defaultFallbackStyle,
          textColor: '#00FFCC',
          fontSize: 48,
        },
        'creator',
        'Custom high-energy style'
      );

      expect(custom.id).toMatch(/^tpl_/);
      expect(custom.name).toBe('Vibrant Neon Glow');
      expect(custom.category).toBe('creator');
      expect(custom.isBuiltIn).toBe(false);
      expect(custom.style.textColor).toBe('#00FFCC');

      const validated = CaptionTemplateSchema.safeParse(custom);
      expect(validated.success).toBe(true);
    });

    it('duplicates existing template cleanly with (Copy) suffix', () => {
      const source = getTemplateById('velvet-signature')!;
      const dup = duplicateTemplate(source);

      expect(dup.id).not.toBe(source.id);
      expect(dup.name).toBe('Velvet Signature (Copy)');
      expect(dup.isBuiltIn).toBe(false);
      expect(dup.style.textColor).toBe(source.style.textColor);
    });

    it('exports and validates JSON template accurately', () => {
      const source = getTemplateById('clay-label')!;
      const json = exportTemplateAsJson(source);

      expect(json).toContain('"name": "Clay Label"');
      expect(json).toContain('"category": "creator"');

      const validation = validateTemplateJson(json);
      expect(validation.success).toBe(true);
      expect(validation.template?.name).toBe('Clay Label');
    });

    it('rejects malformed or invalid JSON input', () => {
      const badJson = '{ "name": "Broken", brokenJson: true ';
      const validation = validateTemplateJson(badJson);
      expect(validation.success).toBe(false);
      expect(validation.error).toBeTruthy();

      const invalidSchema = JSON.stringify({ name: 'Missing Style', id: '123' });
      const schemaValidation = validateTemplateJson(invalidSchema);
      expect(schemaValidation.success).toBe(false);
      expect(schemaValidation.error).toBeTruthy();
    });
  });

  describe('4. Store Scope Application: Apply to All vs Apply to Selected', () => {
    it('applies template to all captions and updates project style while preserving transcript content', () => {
      const store = useAppStore.getState();
      const originalSegments = [...store.currentProject.captionSegments];

      store.applyTemplateToScope('golden-quill', 'all');

      const updatedState = useAppStore.getState();
      expect(updatedState.currentProject.captionStyle.presetId).toBe('golden-quill');
      expect(updatedState.currentProject.captionStyle.fontFamily).toContain('Cinzel');

      // Transcript content and word timestamps must be strictly preserved
      expect(updatedState.currentProject.captionSegments.length).toBe(originalSegments.length);
      expect(updatedState.currentProject.captionSegments[0]?.text).toBe(originalSegments[0]?.text);
      expect(updatedState.currentProject.captionSegments[0]?.words?.length).toBe(
        originalSegments[0]?.words?.length
      );
    });

    it('applies template to selected caption only via styleOverrides', () => {
      const store = useAppStore.getState();
      useAppStore.setState({ selectedSegmentId: 'seg-1' });

      store.applyTemplateToScope('bold-verse', 'selected');

      const updatedState = useAppStore.getState();
      const seg1 = updatedState.currentProject.captionSegments.find((s) => s.id === 'seg-1');
      const seg2 = updatedState.currentProject.captionSegments.find((s) => s.id === 'seg-2');

      // seg-1 must have styleOverrides
      expect(seg1?.styleOverrides).toBeDefined();
      expect(seg1?.styleOverrides?.presetId).toBe('bold-verse');
      expect(seg1?.styleOverrides?.fontFamily).toContain('Anton');

      // seg-2 must NOT have styleOverrides
      expect(seg2?.styleOverrides).toBeUndefined();

      // Undo must restore seg-1
      expect(updatedState.undoCount).toBe(1);
      store.undo();

      const restoredState = useAppStore.getState();
      const restoredSeg1 = restoredState.currentProject.captionSegments.find((s) => s.id === 'seg-1');
      expect(restoredSeg1?.styleOverrides).toBeUndefined();
    });
  });

  describe('5. Animation Engine & ASS Subtitle Export Integration', () => {
    it('computes scale animation preset correctly', () => {
      const seg = useAppStore.getState().currentProject.captionSegments[0]!;
      const tpl = getTemplateById('bold-verse')!;

      // Mid-segment time
      const anim = computeCaptionAnimation({
        currentTimeMs: 1000,
        segment: seg,
        style: tpl.style,
      });

      expect(anim.isVisible).toBe(true);
      expect(anim.transform).toContain('scale');
    });

    it('computes highlight-sweep animation preset and word luminance states', () => {
      const seg = useAppStore.getState().currentProject.captionSegments[0]!;
      const tpl = getTemplateById('kinetic-impact')!;

      // Time during second word (startMs: 400, endMs: 1200)
      const anim = computeCaptionAnimation({
        currentTimeMs: 800,
        segment: seg,
        style: tpl.style,
      });

      expect(anim.isVisible).toBe(true);
      expect(anim.wordStates).toBeDefined();
      expect(anim.wordStates?.[1]?.isHighlighted).toBe(true);
      expect(anim.wordStates?.[1]?.color).toBe(tpl.style.activeWordColor);
    });

    it('exports ASS subtitles with native fade tags for new templates', () => {
      const segs = useAppStore.getState().currentProject.captionSegments;
      const tpl = getTemplateById('velvet-signature')!;

      const ass = exportToAss({
        segments: segs,
        style: tpl.style,
        videoWidth: 1080,
        videoHeight: 1920,
        title: 'Velvet Export',
      });

      expect(ass).toContain('[Script Info]');
      expect(ass).toContain('Playfair Display');
      expect(ass).toContain('{\\fad(300,220)}THE SIGNATURE REVEAL');
    });

    it('verifies export support metadata for all animation presets', () => {
      const fadeInCap = getAnimationExportSupport('fade-in');
      expect(fadeInCap.isFullySupported).toBe(true);
      expect(fadeInCap.status).toBe('native');

      const fadeOutCap = getAnimationExportSupport('fade-out');
      expect(fadeOutCap.isFullySupported).toBe(true);
      expect(fadeOutCap.status).toBe('native');

      const scaleCap = getAnimationExportSupport('scale');
      expect(scaleCap.status).toBe('fallback');
    });
  });

  describe('6. Dual-Font Templates & Keyword Font Pairing Engine', () => {
    const dualFontIds = [
      'viral-impact-duo',
      'editorial-glamour',
      'cyber-tech-punch',
      'cinematic-chronicle',
      'comic-pop-arcade',
    ];

    it('contains at least 5 distinct dual-font templates with paired primary and secondary fonts', () => {
      dualFontIds.forEach((id) => {
        const tpl = getTemplateById(id);
        expect(tpl).toBeDefined();
        expect(tpl?.isBuiltIn).toBe(true);
        expect(tpl?.style.fontFamily).toBeTruthy();
        expect(tpl?.style.secondaryFontFamily).toBeTruthy();
        expect(tpl?.style.fontFamily).not.toEqual(tpl?.style.secondaryFontFamily);
      });
    });

    it('resolves secondary font family for highlighted words in normalized caption rendering', () => {
      const tpl = getTemplateById('viral-impact-duo')!;
      const testSeg: CaptionSegment = {
        id: 'seg-dual-1',
        startMs: 0,
        endMs: 2000,
        text: 'MAKE IT VIRAL NOW',
        words: [
          { id: 'w1', text: 'MAKE', startMs: 0, endMs: 400 },
          { id: 'w2', text: 'IT', startMs: 400, endMs: 800 },
          { id: 'w3', text: 'VIRAL', startMs: 800, endMs: 1400, highlighted: true },
          { id: 'w4', text: 'NOW', startMs: 1400, endMs: 2000 },
        ],
      };

      const normalized = resolveNormalizedCaptionRendering({
        segment: testSeg,
        style: tpl.style,
        currentTimeMs: 100,
        canvasWidth: 1080,
        canvasHeight: 1920,
      });

      expect(normalized.secondaryFontFamily).toBeTruthy();
      expect(normalized.secondaryFontName).toBe('Anton');
      const highlightedWord = normalized.words?.find((w) => w.isMainWord);
      expect(highlightedWord).toBeDefined();
      expect(highlightedWord?.fontFamily).toBe(tpl.style.secondaryFontFamily);
    });

    it('computes distinct font family in animation engine for highlighted main words', () => {
      const tpl = getTemplateById('editorial-glamour')!;
      const testSeg: CaptionSegment = {
        id: 'seg-dual-2',
        startMs: 0,
        endMs: 2000,
        text: 'ELEGANT LUXURY AURA',
        words: [
          { id: 'w1', text: 'ELEGANT', startMs: 0, endMs: 600 },
          { id: 'w2', text: 'LUXURY', startMs: 600, endMs: 1400, highlighted: true },
          { id: 'w3', text: 'AURA', startMs: 1400, endMs: 2000 },
        ],
      };

      const anim = computeCaptionAnimation({
        currentTimeMs: 1000,
        segment: testSeg,
        style: tpl.style,
      });

      expect(anim.isVisible).toBe(true);
      const highlightedState = anim.wordStates?.find((w) => w.isMainWord);
      expect(highlightedState).toBeDefined();
      expect(highlightedState?.fontFamily).toBe(tpl.style.secondaryFontFamily);
    });

    it('exports ASS subtitles with inline \\fn override tags for dual-font keywords', () => {
      const tpl = getTemplateById('viral-impact-duo')!;
      const testSegs: CaptionSegment[] = [
        {
          id: 'seg-dual-3',
          startMs: 0,
          endMs: 2000,
          text: 'GO VIRAL TODAY',
          words: [
            { id: 'w1', text: 'GO', startMs: 0, endMs: 500 },
            { id: 'w2', text: 'VIRAL', startMs: 500, endMs: 1500, highlighted: true },
            { id: 'w3', text: 'TODAY', startMs: 1500, endMs: 2000 },
          ],
        },
      ];

      const ass = exportToAss({
        segments: testSegs,
        style: tpl.style,
        videoWidth: 1080,
        videoHeight: 1920,
        title: 'Dual-Font ASS Export',
      });

      // Verify that ASS contains \fn tags switching to Anton and back to Montserrat
      expect(ass).toContain('\\fnAnton');
      expect(ass).toContain('\\fnMontserrat');
      // Verify boldness and active word burst scale are injected
      expect(ass).toContain('\\b1');
      expect(ass).toContain('\\fscx');
    });

    it('exports ASS subtitles with pop animation spring tags and active word burst for viral-impact-duo', () => {
      const tpl = getTemplateById('viral-impact-duo')!;
      const testSegs: CaptionSegment[] = [
        {
          id: 'seg-pop-1',
          startMs: 0,
          endMs: 1500,
          text: 'PUNCHY VIRAL MOMENT',
          words: [
            { id: 'w1', text: 'PUNCHY', startMs: 0, endMs: 500 },
            { id: 'w2', text: 'VIRAL', startMs: 500, endMs: 1000, highlighted: true },
            { id: 'w3', text: 'MOMENT', startMs: 1000, endMs: 1500 },
          ],
        },
      ];

      const ass = exportToAss({
        segments: testSegs,
        style: tpl.style,
        videoWidth: 1080,
        videoHeight: 1920,
        enableWordEmphasis: true,
      });

      // Spring pop entrance transform
      expect(ass).toContain('\\fscx75\\fscy75\\t(');
      // Word burst animation on active word
      expect(ass).toContain('\\t(0,110,\\fscx');
      // Prominent outline stroke on active word
      expect(ass).toContain('\\bord');
      expect(ass).toContain('\\b1');
    });

    it('exports ASS subtitles with vertical \\move animation tags for cyber-tech-punch', () => {
      const tpl = getTemplateById('cyber-tech-punch')!;
      const testSegs: CaptionSegment[] = [
        {
          id: 'seg-slide-1',
          startMs: 0,
          endMs: 1200,
          text: 'CYBER TECH PUNCH',
          words: [
            { id: 'w1', text: 'CYBER', startMs: 0, endMs: 400 },
            { id: 'w2', text: 'TECH', startMs: 400, endMs: 800, highlighted: true },
            { id: 'w3', text: 'PUNCH', startMs: 800, endMs: 1200 },
          ],
        },
      ];

      const ass = exportToAss({
        segments: testSegs,
        style: tpl.style,
        videoWidth: 1080,
        videoHeight: 1920,
        enableWordEmphasis: true,
      });

      // \move tag for slide-up motion
      expect(ass).toContain('\\move(540,');
      expect(ass).toContain('\\fnBebas Neue');
    });

    it('exports ASS subtitles with bounce keyframe transforms for comic-pop-arcade', () => {
      const tpl = getTemplateById('comic-pop-arcade')!;
      const testSegs: CaptionSegment[] = [
        {
          id: 'seg-bounce-1',
          startMs: 0,
          endMs: 1200,
          text: 'RETRO ARCADE COMIC',
          words: [
            { id: 'w1', text: 'RETRO', startMs: 0, endMs: 400 },
            { id: 'w2', text: 'ARCADE', startMs: 400, endMs: 800, highlighted: true },
            { id: 'w3', text: 'COMIC', startMs: 800, endMs: 1200 },
          ],
        },
      ];

      const ass = exportToAss({
        segments: testSegs,
        style: tpl.style,
        videoWidth: 1080,
        videoHeight: 1920,
        enableWordEmphasis: true,
      });

      // Squash and stretch bounce tag
      expect(ass).toContain('\\fscy125\\fscx90');
      expect(ass).toContain('\\fnRighteous');
    });

    it('exports ASS subtitles with letter spacing interpolation for cinematic-chronicle', () => {
      const tpl = getTemplateById('cinematic-chronicle')!;
      const testSegs: CaptionSegment[] = [
        {
          id: 'seg-cin-1',
          startMs: 0,
          endMs: 1500,
          text: 'LEGENDARY CHRONICLE HERO',
          words: [
            { id: 'w1', text: 'LEGENDARY', startMs: 0, endMs: 500 },
            { id: 'w2', text: 'CHRONICLE', startMs: 500, endMs: 1000, highlighted: true },
            { id: 'w3', text: 'HERO', startMs: 1000, endMs: 1500 },
          ],
        },
      ];

      const ass = exportToAss({
        segments: testSegs,
        style: tpl.style,
        videoWidth: 1080,
        videoHeight: 1920,
        enableWordEmphasis: true,
      });

      // Letter spacing \fsp tag
      expect(ass).toContain('\\fsp');
      expect(ass).toContain('\\fnCinzel');
    });
  });
});
