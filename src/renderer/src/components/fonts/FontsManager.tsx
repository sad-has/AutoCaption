import React, { useState, useRef, useEffect } from 'react';
import {
  Type,
  Check,
  Search,
  UploadCloud,
  ShieldCheck,
  Globe,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  FONT_CATALOG,
  type FontCategory,
  type FontDefinition,
  validateFontFile,
  loadGoogleFont,
} from '@shared/fonts';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';

const CATEGORY_TABS: { id: FontCategory | 'all' | 'user'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hindi', label: 'Hindi / Dev' },
  { id: 'bold', label: 'Bold' },
  { id: 'condensed', label: 'Condensed' },
  { id: 'sans-serif', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'display', label: 'Display' },
  { id: 'monospace', label: 'Mono' },
  { id: 'user', label: 'Custom' },
];

export const FontsManager: React.FC = () => {
  const { currentProject, updateStyle, userFonts, registerUserFont } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FontCategory | 'all' | 'user'>('all');
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preload visible fonts so specimens render accurately
  useEffect(() => {
    FONT_CATALOG.forEach((font: FontDefinition) => {
      if (font.source === 'Google Fonts') {
        loadGoogleFont(font);
      }
    });
  }, []);

  const allAvailableFonts: FontDefinition[] = [...userFonts, ...FONT_CATALOG];

  const filteredFonts = allAvailableFonts.filter((font) => {
    const matchesSearch =
      font.family.toLowerCase().includes(searchTerm.toLowerCase()) ||
      font.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      font.categoryLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      font.sampleText.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'user') return font.source === 'User Upload';
    if (selectedCategory === 'hindi') return font.supportsHindi;
    return font.category === selectedCategory;
  });

  const handleApplyFont = (font: FontDefinition) => {
    if (font.source === 'Google Fonts') {
      loadGoogleFont(font);
    }
    // Always chain Hindi fallback fonts for reliable multi-language captioning
    const fontStack = `${font.family}, 'Noto Sans Devanagari', 'Poppins', sans-serif`;
    updateStyle({ fontFamily: fontStack });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const validation = await validateFontFile(file);
      if (!validation.isValid) {
        setUploadStatus({
          type: 'error',
          message: validation.error || 'Failed font file security verification.',
        });
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Safe registration via browser FontFace API - never executed as code
      const cleanFamily = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim() || 'CustomFont';

      const buffer = await file.arrayBuffer();
      const fontFace = new FontFace(cleanFamily, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);

      const userFontDef: FontDefinition = {
        family: cleanFamily,
        displayName: cleanFamily,
        category: 'sans-serif',
        categoryLabel: `Custom (${validation.format?.toUpperCase() || 'Font'})`,
        source: 'User Upload',
        license: 'User Provided / Validated Container',
        licenseType: 'User Verified',
        weights: [400, 700],
        supportsHindi: false,
        sampleText: 'USER CUSTOM FONT',
      };

      registerUserFont(userFontDef);
      handleApplyFont(userFontDef);

      setUploadStatus({
        type: 'success',
        message: `Successfully registered and applied font "${cleanFamily}"!`,
      });
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error reading and registering font.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentFamilyName = currentProject.captionStyle.fontFamily
    .split(',')[0]
    ?.replace(/['"]/g, '')
    .trim()
    .toLowerCase();

  return (
    <div className="flex h-full flex-col text-xs text-neutral-300 overflow-hidden bg-[#0e1117]">
      {/* Catalog Header */}
      <div className="p-3 border-b border-[#1f2633] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-200 tracking-wider uppercase text-[10px]">
            <Type className="h-3.5 w-3.5 text-emerald-400" />
            <span>Font Catalog ({allAvailableFonts.length})</span>
          </div>
          <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3" />
            OFL 1.1 / Apache
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Search fonts, styles, categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[#212836] bg-[#12161f] pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#232b3a]">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium transition-colors',
                selectedCategory === cat.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#141822] text-neutral-400 hover:text-neutral-200 hover:bg-[#181e2b] border border-[#212836]'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Zone & Alerts */}
      <div className="px-3 pt-2">
        <div className="flex items-center justify-between rounded-lg border border-[#202737] bg-[#121620] p-2">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-emerald-400" />
            <div className="text-[10px]">
              <div className="font-semibold text-neutral-200">Upload Font File</div>
              <div className="text-neutral-500">.ttf, .otf, .woff, .woff2 (Max 15MB)</div>
            </div>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Validating...' : 'Browse'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {uploadStatus && (
          <div
            className={cn(
              'mt-2 flex items-start gap-1.5 rounded p-2 text-[10px]',
              uploadStatus.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-300 border border-red-500/30'
            )}
          >
            {uploadStatus.type === 'success' ? (
              <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{uploadStatus.message}</span>
          </div>
        )}
      </div>

      {/* Font Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredFonts.length === 0 ? (
          <div className="py-8 text-center text-neutral-500">
            <p className="text-xs">No fonts found matching your filter.</p>
          </div>
        ) : (
          filteredFonts.map((font) => {
            const isSelected = currentFamilyName === font.family.toLowerCase();

            return (
              <div
                key={font.family}
                onClick={() => handleApplyFont(font)}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border p-2.5 transition-all cursor-pointer select-none',
                  isSelected
                    ? 'border-emerald-500/60 bg-[#141e2a] shadow-sm ring-1 ring-emerald-500/20'
                    : 'border-[#202735] bg-[#12151c] hover:border-[#2e3749] hover:bg-[#151923]'
                )}
              >
                {/* Font Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-neutral-100 text-xs">{font.displayName}</span>
                    {font.supportsHindi && (
                      <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.2 text-[8px] font-medium text-amber-400 border border-amber-500/20">
                        <Globe className="h-2.5 w-2.5" />
                        हिन्दी
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="rounded bg-[#1a212e] px-1.5 py-0.2 text-[8px] font-mono text-neutral-400 border border-[#252f42]">
                      {font.licenseType}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                </div>

                {/* Subtitle / Details */}
                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span>{font.categoryLabel}</span>
                  <span className="text-[9px] text-neutral-500">{font.source}</span>
                </div>

                {/* Font Specimen Render */}
                <div
                  className="mt-0.5 rounded bg-[#0a0c10] px-2.5 py-2 text-center text-sm font-semibold text-neutral-100 border border-[#1b212c] transition-all overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{
                    fontFamily: `${font.family}, 'Noto Sans Devanagari', 'Poppins', sans-serif`,
                  }}
                >
                  {font.sampleText}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Multilingual Support Footer */}
      <div className="p-2.5 border-t border-[#1f2633] bg-[#0b0d12] flex items-center gap-1.5 text-[9px] text-neutral-400">
        <Info className="h-3 w-3 text-emerald-400 shrink-0" />
        <span>Multilingual guarantee: Hindi glyphs automatically resolve to Noto Sans Devanagari & Poppins fallback.</span>
      </div>
    </div>
  );
};
