import React, { useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  Star,
  Search,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  Check,
  RotateCcw,
  Sliders,
  X,
  Film,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { BUILTIN_TEMPLATES, filterTemplates, type FilterTemplatesOptions } from '@shared/templates';
import type { CaptionTemplate, CaptionTemplateCategory } from '@shared/types';
import { cn } from '../../utils/cn';

interface TemplateBrowserProps {
  onCustomizeClick?: () => void;
}

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({ onCustomizeClick }) => {
  const {
    currentProject,
    customTemplates,
    favoriteTemplateIds,
    toggleFavoriteTemplate,
    applyTemplate,
    applyTemplateToScope,
    saveCustomTemplate,
    duplicateTemplateAction,
    deleteCustomTemplate,
    importTemplateFromJson,
    exportTemplateJsonString,
    selectedSegmentId,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CaptionTemplateCategory | 'all'>('all');
  const [selectedTab, setSelectedTab] = useState<'all' | 'builtin' | 'custom'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Template creation dialog state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<CaptionTemplateCategory>('custom');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  // Import JSON status
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const style = currentProject.captionStyle;

  // Combine built-in and user custom templates
  const allTemplates = useMemo<CaptionTemplate[]>(() => {
    return [...BUILTIN_TEMPLATES, ...customTemplates];
  }, [customTemplates]);

  // Apply filters
  const filteredTemplates = useMemo(() => {
    const filterOpts: FilterTemplatesOptions = {
      category: selectedCategory,
      search: searchQuery,
      favoritesOnly,
      favoriteIds: favoriteTemplateIds,
      tab: selectedTab,
    };
    return filterTemplates(allTemplates, filterOpts);
  }, [allTemplates, selectedCategory, searchQuery, favoritesOnly, favoriteTemplateIds, selectedTab]);

  // Selected segment info
  const selectedSegment = useMemo(() => {
    if (!selectedSegmentId) return null;
    return currentProject.captionSegments.find((s) => s.id === selectedSegmentId) || null;
  }, [currentProject.captionSegments, selectedSegmentId]);

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    saveCustomTemplate(newTemplateName, newTemplateCategory, newTemplateDesc);
    setIsCreateModalOpen(false);
    setNewTemplateName('');
    setNewTemplateDesc('');
    setSelectedTab('custom');
    setImportFeedback({
      type: 'success',
      message: `Template "${newTemplateName.trim()}" created successfully.`,
    });
    setTimeout(() => setImportFeedback(null), 3000);
  };

  const handleExportJson = (templateId: string, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = exportTemplateJsonString(templateId);
    if (!jsonStr) return;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importTemplateFromJson(content);
      if (!res.success) {
        setImportFeedback({ type: 'error', message: res.error || 'Invalid template JSON formatting.' });
      } else {
        setSelectedTab('custom');
        setImportFeedback({
          type: 'success',
          message: `Imported template "${res.template?.name}" successfully.`,
        });
        setTimeout(() => setImportFeedback(null), 4000);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const categories: { id: CaptionTemplateCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All Styles' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'bold', label: 'Bold' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'editorial', label: 'Editorial' },
    { id: 'documentary', label: 'Doc' },
    { id: 'creator', label: 'Creator' },
    { id: 'multilingual', label: 'Hindi' },
    { id: 'custom', label: 'My Custom' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs text-neutral-300">
      {/* Top Header & Search Bar */}
      <div className="border-b border-[#1b222e] bg-[#0c0e14] p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200 text-xs flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Template Library
            </span>
            <span className="rounded bg-[#161c27] px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono border border-[#212a3b]">
              {filteredTemplates.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1 rounded bg-emerald-600/20 px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 transition-colors"
              title="Save current styling as a new reusable template"
            >
              <Plus className="h-3 w-3" />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded bg-[#161b26] px-2 py-1 text-[11px] text-neutral-300 hover:bg-[#202737] border border-[#232b3b] transition-colors"
              title="Import template JSON file"
            >
              <Upload className="h-3 w-3 text-neutral-400" />
              <span>Import</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Search input with favorites toggle */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search templates, fonts, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-[#222a3a] bg-[#121620] pl-8 pr-7 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={cn(
              'flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium border transition-colors',
              favoritesOnly
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-[#141824] text-neutral-400 border-[#222a3a] hover:text-neutral-200'
            )}
            title="Filter starred favorite templates"
          >
            <Star className={cn('h-3.5 w-3.5', favoritesOnly ? 'fill-amber-400 text-amber-400' : 'text-neutral-400')} />
          </button>
        </div>

        {/* Tabs: All / Built-in / Custom */}
        <div className="flex rounded bg-[#10141e] p-0.5 border border-[#1d2433]">
          <button
            type="button"
            onClick={() => setSelectedTab('all')}
            className={cn(
              'flex-1 rounded py-1 text-[11px] font-medium transition-colors text-center',
              selectedTab === 'all'
                ? 'bg-[#1b2230] text-emerald-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            All Presets
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('builtin')}
            className={cn(
              'flex-1 rounded py-1 text-[11px] font-medium transition-colors text-center',
              selectedTab === 'builtin'
                ? 'bg-[#1b2230] text-emerald-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            Built-in ({BUILTIN_TEMPLATES.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('custom')}
            className={cn(
              'flex-1 rounded py-1 text-[11px] font-medium transition-colors text-center',
              selectedTab === 'custom'
                ? 'bg-[#1b2230] text-emerald-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            My Templates ({customTemplates.length})
          </button>
        </div>

        {/* Category Pills Slider */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-[#232b3a]">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                selectedCategory === cat.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#131722] text-neutral-400 hover:text-neutral-200 border border-[#1f2636]'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Feedback message banner */}
        {importFeedback && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded p-2 text-[11px] border leading-tight',
              importFeedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            )}
          >
            {importFeedback.type === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="flex-1">{importFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Scope Indicator Bar: Shows Selected Caption vs Global */}
      <div className="flex items-center justify-between border-b border-[#181f2c] bg-[#0e121a] px-3 py-1.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-400">Target:</span>
          {selectedSegment ? (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-400 border border-emerald-500/25">
              Selected Caption #{selectedSegment.id.replace('demo-seg-', '').slice(0, 6)}
            </span>
          ) : (
            <span className="text-neutral-300 font-medium">All Captions (Project Default)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCustomizeClick && (
            <button
              type="button"
              onClick={onCustomizeClick}
              className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
              title="Customize active style in inspector"
            >
              <Sliders className="h-2.5 w-2.5" />
              <span>Customize</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const defTpl = BUILTIN_TEMPLATES[0];
              if (defTpl) applyTemplate(defTpl);
            }}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Reset to default template"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Templates Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-neutral-400">
            <Film className="h-8 w-8 text-neutral-600 mb-2" />
            <p className="font-semibold text-neutral-300">No templates found</p>
            <p className="text-[11px] mt-1 text-neutral-500 max-w-[220px]">
              Try adjusting your search query, clearing category filters, or creating your first custom template.
            </p>
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const isDefaultActive = style.presetId === template.id || style.templateName === template.name;
            const isFav = favoriteTemplateIds.includes(template.id) || !!template.isFavorite;

            return (
              <div
                key={template.id}
                className={cn(
                  'group relative flex flex-col rounded-lg border p-3 transition-all',
                  isDefaultActive
                    ? 'border-emerald-500/60 bg-[#131b26] ring-1 ring-emerald-500/30 shadow-md'
                    : 'border-[#1f2636] bg-[#11151e] hover:border-[#2d374d] hover:bg-[#141924]'
                )}
              >
                {/* Header: Title, Category Badge, Star Favorite */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-neutral-100 text-xs truncate">{template.name}</span>
                    {template.isBuiltIn ? (
                      <span className="rounded bg-[#18202d] px-1.5 py-0.2 text-[8px] font-mono text-neutral-400 border border-[#242f44]">
                        PRO
                      </span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[8px] font-semibold text-amber-400 border border-amber-500/25">
                        MY
                      </span>
                    )}
                    {Boolean(template.style.secondaryFontFamily) && (
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[8px] font-semibold text-indigo-300 border border-indigo-500/35">
                        DUAL-FONT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteTemplate(template.id);
                      }}
                      className={cn(
                        'p-1 rounded transition-colors',
                        isFav
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-neutral-500 hover:text-neutral-300 opacity-60 group-hover:opacity-100'
                      )}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={cn('h-3.5 w-3.5', isFav && 'fill-amber-400')} />
                    </button>
                    {isDefaultActive && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="mt-1 text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                )}

                {/* Live Rendered Visual Preview Box */}
                <div
                  className="mt-2.5 flex items-center justify-center rounded bg-[#090b0f] py-2.5 px-3 border border-[#1b2230] overflow-hidden select-none"
                  style={{
                    backgroundColor: template.style.hasBox
                      ? template.style.boxColor.startsWith('#')
                        ? `${template.style.boxColor}dd`
                        : template.style.boxColor
                      : '#090b0f',
                    padding: template.style.hasBox
                      ? `${template.style.boxPaddingY}px ${template.style.boxPaddingX}px`
                      : '10px 12px',
                    borderRadius: template.style.hasBox ? `${template.style.boxCornerRadius}px` : '6px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: `${template.style.fontFamily}, 'Noto Sans Devanagari', 'Poppins', sans-serif`,
                      fontSize: '13px',
                      fontWeight: template.style.fontWeight,
                      letterSpacing: `${Math.min(template.style.letterSpacing, 2)}px`,
                      textTransform: template.style.textTransform || 'none',
                      color: template.style.textColor,
                      WebkitTextStroke:
                        template.style.strokeWidth > 0
                          ? `1px ${template.style.strokeColor}`
                          : undefined,
                      textShadow: template.style.hasShadow
                        ? `0 1px 3px ${template.style.shadowColor}`
                        : undefined,
                    }}
                  >
                    <span>{template.name}</span>
                    {(template.style.hasWordEmphasis || template.style.secondaryFontFamily) && (
                      <span
                        className="ml-1.5 font-bold inline-block"
                        style={{
                          fontFamily: template.style.secondaryFontFamily
                            ? `${template.style.secondaryFontFamily}, ${template.style.fontFamily}, 'Noto Sans Devanagari', 'Poppins', sans-serif`
                            : undefined,
                          fontWeight: template.style.secondaryFontWeight || 900,
                          color: template.style.activeWordColor || '#CCFF00',
                          backgroundColor:
                            template.style.highlightStyle === 'pill'
                              ? template.style.activeWordBgColor || 'rgba(52, 211, 153, 0.22)'
                              : undefined,
                          padding: template.style.highlightStyle === 'pill' ? '1px 5px' : undefined,
                          borderRadius: template.style.highlightStyle === 'pill' ? '9999px' : undefined,
                        }}
                      >
                        {template.style.secondaryFontFamily ? 'VIRAL' : 'Sample'}
                      </span>
                    )}
                  </span>
                </div>

                {/* Actions Bar */}
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#1c2331] text-[10px]">
                  <span className="capitalize text-neutral-400 font-mono text-[9px]">{template.category}</span>

                  <div className="flex items-center gap-1.5">
                    {/* Apply to Selected Button */}
                    {selectedSegmentId && (
                      <button
                        type="button"
                        onClick={() => applyTemplateToScope(template.id, 'selected')}
                        className="rounded bg-[#1a2332] px-2 py-0.5 text-neutral-300 hover:bg-[#253247] hover:text-emerald-400 border border-[#2b3952] transition-colors"
                        title="Apply this template only to the currently selected caption"
                      >
                        To Selected
                      </button>
                    )}

                    {/* Apply to All Button */}
                    <button
                      type="button"
                      onClick={() => applyTemplateToScope(template.id, 'all')}
                      className={cn(
                        'rounded px-2.5 py-0.5 font-semibold transition-colors',
                        isDefaultActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-emerald-600/90 text-white hover:bg-emerald-500 shadow-sm'
                      )}
                      title="Apply this template to all captions"
                    >
                      {isDefaultActive ? 'Active' : 'Apply All'}
                    </button>

                    {/* Secondary menu: Duplicate, Export, Delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateTemplateAction(template.id);
                      }}
                      className="rounded p-1 text-neutral-400 hover:bg-[#1a212f] hover:text-neutral-200 transition-colors"
                      title="Duplicate template"
                    >
                      <Copy className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleExportJson(template.id, template.name, e)}
                      className="rounded p-1 text-neutral-400 hover:bg-[#1a212f] hover:text-neutral-200 transition-colors"
                      title="Export template as JSON"
                    >
                      <Download className="h-3 w-3" />
                    </button>

                    {!template.isBuiltIn && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomTemplate(template.id);
                        }}
                        className="rounded p-1 text-red-400/80 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        title="Delete custom template"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Custom Template Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#252f44] bg-[#10141d] p-4 text-xs shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#1c2433] pb-2.5">
              <span className="font-semibold text-neutral-100 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Save as Reusable Template
              </span>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Neon Reels Style"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full rounded border border-[#232c3f] bg-[#141924] px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value as CaptionTemplateCategory)}
                  className="w-full rounded border border-[#232c3f] bg-[#141924] px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="creator">Creator</option>
                  <option value="luxury">Luxury</option>
                  <option value="cinematic">Cinematic</option>
                  <option value="bold">Bold</option>
                  <option value="minimal">Minimal</option>
                  <option value="editorial">Editorial</option>
                  <option value="documentary">Documentary</option>
                  <option value="multilingual">Hindi / Multilingual</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe font choice, shadow, and ideal use case..."
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  className="w-full rounded border border-[#232c3f] bg-[#141924] px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c2433]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded px-3 py-1.5 text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
