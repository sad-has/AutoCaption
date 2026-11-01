import React, { useState } from 'react';
import {
  Sparkles,
  Sliders,
  Type,
  Palette,
  MoveVertical,
  Layers,
  Shield,
  Square,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Zap,
  AlertTriangle,
  RotateCcw,
  Highlighter,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { TemplateBrowser } from '../templates/TemplateBrowser';
import { FONT_CATALOG, type FontDefinition } from '@shared/fonts';
import type {
  TextAlignment,
  TextTransformation,
  CaptionAnimationPreset,
  CaptionAnimationConfig,
} from '@shared/types';
import { getAnimationExportSupport } from '@shared/animations/exportSupport';
import { cn } from '../../utils/cn';

type RightPanelTab = 'presets' | 'typography';

export const RightPanel: React.FC = () => {
  const {
    currentProject,
    updateStyle,
    showSafeMargins,
    toggleSafeMargins,
    userFonts,
    globalAnimation,
    updateGlobalAnimation,
    setSegmentAnimation,
    removeSegmentAnimationOverride,
    selectedSegmentId,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<RightPanelTab>('presets');
  const [animationScope, setAnimationScope] = useState<'global' | 'override'>('global');

  const style = currentProject.captionStyle;
  const currentFamily = style.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Montserrat';

  const allAvailableFontNames = [
    ...new Set([...userFonts.map((f: FontDefinition) => f.family), ...FONT_CATALOG.map((f: FontDefinition) => f.family)]),
  ];

  return (
    <aside className="flex h-full flex-col border-l border-[#1f2633] bg-[#0e1117] text-xs text-neutral-300 overflow-hidden select-none">
      {/* Panel Top Mode Switcher */}
      <div className="flex h-10 shrink-0 border-b border-[#1f2633] bg-[#0b0d11]">
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-colors border-r border-[#191f2b]',
            activeTab === 'presets'
              ? 'bg-[#141822] text-emerald-400 border-t-2 border-t-emerald-500'
              : 'text-neutral-400 hover:bg-[#10131a] hover:text-neutral-200'
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Presets & Templates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('typography')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-colors',
            activeTab === 'typography'
              ? 'bg-[#141822] text-emerald-400 border-t-2 border-t-emerald-500'
              : 'text-neutral-400 hover:bg-[#10131a] hover:text-neutral-200'
          )}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Customize Style</span>
        </button>
      </div>

      {/* Active Preset Indicator Strip */}
      <div className="flex items-center justify-between border-b border-[#1b222d] bg-[#10141c] px-3 py-1.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-400">Current:</span>
          <span className="font-semibold text-emerald-400 font-mono truncate max-w-[140px]">
            {style.templateName || style.presetId}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className="flex items-center gap-1 rounded bg-[#18212e] px-2 py-0.5 text-neutral-300 hover:bg-[#202c3e] hover:text-white border border-[#27354a] transition-colors"
        >
          <span>Browse Library</span>
        </button>
      </div>

      {/* TAB 1: PRESETS & TEMPLATES BROWSER */}
      {activeTab === 'presets' && (
        <TemplateBrowser onCustomizeClick={() => setActiveTab('typography')} />
      )}

      {/* TAB 2: TYPOGRAPHY & FINE-TUNE CONTROLS */}
      {activeTab === 'typography' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Typography Section */}
          <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                <Type className="h-3.5 w-3.5 text-emerald-400" />
                <span>Typography Engine</span>
              </div>
              <span className="text-[9px] font-mono text-neutral-400">
                {style.fontWeight} • {style.fontSize}px
              </span>
            </div>

            {/* Font Family */}
            <div>
              <label className="text-[10px] text-neutral-400 font-medium">Font Family</label>
              <select
                value={currentFamily}
                onChange={(e) =>
                  updateStyle({
                    fontFamily: `${e.target.value}, 'Noto Sans Devanagari', 'Poppins', sans-serif`,
                  })
                }
                className="mt-1 w-full rounded border border-[#262f40] bg-[#181d28] px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              >
                {allAvailableFontNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Weight */}
            <div>
              <label className="text-[10px] text-neutral-400 font-medium">Font Weight</label>
              <select
                value={style.fontWeight}
                onChange={(e) => updateStyle({ fontWeight: parseInt(e.target.value, 10) })}
                className="mt-1 w-full rounded border border-[#262f40] bg-[#181d28] px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value={300}>300 - Light</option>
                <option value={400}>400 - Regular</option>
                <option value={500}>500 - Medium</option>
                <option value={600}>600 - SemiBold</option>
                <option value={700}>700 - Bold</option>
                <option value={800}>800 - ExtraBold</option>
                <option value={900}>900 - Black</option>
              </select>
            </div>

            {/* Font Size Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Font Size</span>
                <span className="font-mono text-neutral-300">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min="18"
                max="80"
                value={style.fontSize}
                onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value, 10) })}
                className="mt-1 w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Text Transform Buttons */}
            <div>
              <label className="text-[10px] text-neutral-400 font-medium">Text Transform</label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'none' as TextTransformation, label: 'None' },
                    { id: 'uppercase' as TextTransformation, label: 'UPPER' },
                    { id: 'lowercase' as TextTransformation, label: 'lower' },
                    { id: 'capitalize' as TextTransformation, label: 'Title' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      updateStyle({
                        textTransform: t.id,
                        allCaps: t.id === 'uppercase',
                      })
                    }
                    className={cn(
                      'rounded border py-1 text-[10px] font-semibold transition-colors',
                      (style.textTransform === t.id || (t.id === 'uppercase' && style.allCaps))
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                        : 'border-[#262f40] bg-[#181d28] text-neutral-400 hover:text-neutral-200'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Alignment */}
            <div>
              <label className="text-[10px] text-neutral-400 font-medium">Text Alignment</label>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'left' as TextAlignment, label: 'Left', icon: AlignLeft },
                    { id: 'center' as TextAlignment, label: 'Center', icon: AlignCenter },
                    { id: 'right' as TextAlignment, label: 'Right', icon: AlignRight },
                  ] as const
                ).map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => updateStyle({ textAlign: a.id })}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded border py-1 text-[10px] font-semibold transition-colors',
                        (style.textAlign || 'center') === a.id
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                          : 'border-[#262f40] bg-[#181d28] text-neutral-400 hover:text-neutral-200'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Letter Spacing & Line Height */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Letter Space</span>
                  <span className="font-mono text-neutral-300">{style.letterSpacing}px</span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="10"
                  step="0.5"
                  value={style.letterSpacing}
                  onChange={(e) => updateStyle({ letterSpacing: parseFloat(e.target.value) })}
                  className="mt-1 w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Line Height</span>
                  <span className="font-mono text-neutral-300">{style.lineHeight}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.05"
                  value={style.lineHeight}
                  onChange={(e) => updateStyle({ lineHeight: parseFloat(e.target.value) })}
                  className="mt-1 w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Max Width % */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Maximum Width</span>
                <span className="font-mono text-neutral-300">{style.maxWidthPercent || 90}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="100"
                step="5"
                value={style.maxWidthPercent || 90}
                onChange={(e) => updateStyle({ maxWidthPercent: parseInt(e.target.value, 10) })}
                className="mt-1 w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </section>

          {/* Active Word Highlight & Focus Section */}
          <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                <Highlighter className="h-3.5 w-3.5 text-amber-400" />
                <span>Word Highlight & Focus</span>
              </div>
              <button
                type="button"
                onClick={() => updateStyle({ hasWordEmphasis: style.hasWordEmphasis === false ? true : false })}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-semibold border transition-colors',
                  style.hasWordEmphasis !== false
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#262f40] text-neutral-400'
                )}
              >
                {style.hasWordEmphasis !== false ? 'ENABLED' : 'OFF'}
              </button>
            </div>

            {style.hasWordEmphasis !== false && (
              <div className="space-y-2.5 pt-1 border-t border-[#1b222d]">
                {/* Highlight Style Mode */}
                <div>
                  <label className="text-[10px] text-neutral-400 font-medium">Highlight Focus Mode</label>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'word', label: 'Color' },
                        { id: 'sweep', label: 'Sweep' },
                        { id: 'pill', label: 'Pill' },
                        { id: 'box', label: 'Box' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => updateStyle({ highlightStyle: m.id })}
                        className={cn(
                          'rounded border py-1 text-[10px] font-semibold transition-colors',
                          (style.highlightStyle || 'word') === m.id
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                            : 'border-[#262f40] bg-[#181d28] text-neutral-400 hover:text-neutral-200'
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Highlight Color */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400">Active Text Color</label>
                    <div className="mt-1 flex items-center gap-1.5 rounded border border-[#262f40] bg-[#181d28] p-1">
                      <input
                        type="color"
                        value={style.activeWordColor || '#F59E0B'}
                        onChange={(e) => updateStyle({ activeWordColor: e.target.value })}
                        className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[10px] text-neutral-300 uppercase">
                        {style.activeWordColor || '#F59E0B'}
                      </span>
                    </div>
                  </div>

                  {(style.highlightStyle === 'pill' || style.highlightStyle === 'box') && (
                    <div>
                      <label className="text-[10px] text-neutral-400">Pill Background</label>
                      <div className="mt-1 flex items-center gap-1.5 rounded border border-[#262f40] bg-[#181d28] p-1">
                        <input
                          type="color"
                          value={style.activeWordBgColor || '#34D399'}
                          onChange={(e) => updateStyle({ activeWordBgColor: e.target.value })}
                          className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-neutral-300 uppercase truncate">
                          {style.activeWordBgColor || '#34D399'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Word Scale */}
                <div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Active Word Scale Pop</span>
                    <span className="font-mono text-neutral-300">
                      {(style.activeWordScale || 1.1).toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.4"
                    step="0.02"
                    value={style.activeWordScale || 1.1}
                    onChange={(e) => updateStyle({ activeWordScale: parseFloat(e.target.value) })}
                    className="mt-1 w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Color & Outline Stroke Section */}
          <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
              <Palette className="h-3.5 w-3.5 text-amber-400" />
              <span>Colors & Outline Stroke</span>
            </div>

            {/* Base Color & Outline Color */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400">Base Text</label>
                <div className="mt-1 flex items-center gap-1.5 rounded border border-[#262f40] bg-[#181d28] p-1">
                  <input
                    type="color"
                    value={style.textColor}
                    onChange={(e) => updateStyle({ textColor: e.target.value })}
                    className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-neutral-300 uppercase">
                    {style.textColor}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400">Outline Stroke</label>
                <div className="mt-1 flex items-center gap-1.5 rounded border border-[#262f40] bg-[#181d28] p-1">
                  <input
                    type="color"
                    value={style.strokeColor}
                    onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                    className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-neutral-300 uppercase">
                    {style.strokeColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Stroke Width Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Stroke Width</span>
                <span className="font-mono text-neutral-300">{style.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                value={style.strokeWidth}
                onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value, 10) })}
                className="mt-1 w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </section>

          {/* Drop Shadow Section */}
          <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                <span>Drop Shadow</span>
              </div>
              <button
                type="button"
                onClick={() => updateStyle({ hasShadow: !style.hasShadow })}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-semibold border transition-colors',
                  style.hasShadow
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#262f40] text-neutral-400'
                )}
              >
                {style.hasShadow ? 'ENABLED' : 'OFF'}
              </button>
            </div>

            {style.hasShadow && (
              <div className="space-y-2 pt-1 border-t border-[#1b222d]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-neutral-400">Shadow Color</label>
                  <input
                    type="color"
                    value={style.shadowColor.startsWith('#') ? style.shadowColor : '#000000'}
                    onChange={(e) => updateStyle({ shadowColor: e.target.value })}
                    className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Shadow Blur</span>
                    <span className="font-mono text-neutral-300">{style.shadowBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={style.shadowBlur}
                    onChange={(e) => updateStyle({ shadowBlur: parseInt(e.target.value, 10) })}
                    className="mt-1 w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Offset X</span>
                      <span className="font-mono text-neutral-300">{style.shadowOffsetX ?? 0}px</span>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      value={style.shadowOffsetX ?? 0}
                      onChange={(e) => updateStyle({ shadowOffsetX: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Offset Y</span>
                      <span className="font-mono text-neutral-300">{style.shadowOffsetY ?? 2}px</span>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      value={style.shadowOffsetY ?? 2}
                      onChange={(e) => updateStyle({ shadowOffsetY: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Box Backdrop Pill Section */}
          <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                <Square className="h-3.5 w-3.5 text-purple-400" />
                <span>Backdrop Box Pill</span>
              </div>
              <button
                type="button"
                onClick={() => updateStyle({ hasBox: !style.hasBox })}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-semibold border transition-colors',
                  style.hasBox
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#262f40] text-neutral-400'
                )}
              >
                {style.hasBox ? 'ENABLED' : 'OFF'}
              </button>
            </div>

            {style.hasBox && (
              <div className="space-y-2 pt-1 border-t border-[#1b222d]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-neutral-400">Box Color</label>
                  <input
                    type="color"
                    value={style.boxColor.startsWith('#') ? style.boxColor : '#000000'}
                    onChange={(e) => updateStyle({ boxColor: e.target.value })}
                    className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Box Opacity</span>
                    <span className="font-mono text-neutral-300">
                      {Math.round((style.boxOpacity ?? 0.8) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={style.boxOpacity ?? 0.8}
                    onChange={(e) => updateStyle({ boxOpacity: parseFloat(e.target.value) })}
                    className="mt-1 w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Padding X</span>
                      <span className="font-mono text-neutral-300">{style.boxPaddingX}px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="32"
                      value={style.boxPaddingX}
                      onChange={(e) => updateStyle({ boxPaddingX: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Padding Y</span>
                      <span className="font-mono text-neutral-300">{style.boxPaddingY}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="24"
                      value={style.boxPaddingY}
                      onChange={(e) => updateStyle({ boxPaddingY: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Corner Radius</span>
                    <span className="font-mono text-neutral-300">{style.boxCornerRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={style.boxCornerRadius}
                    onChange={(e) => updateStyle({ boxCornerRadius: parseInt(e.target.value, 10) })}
                    className="mt-1 w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Positioning & Safe Area Section */}
          <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                <MoveVertical className="h-3.5 w-3.5 text-emerald-400" />
                <span>Screen Placement</span>
              </div>
              <button
                type="button"
                onClick={toggleSafeMargins}
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold border transition-colors',
                  showSafeMargins
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#262f40] text-neutral-400'
                )}
                title="Toggle Safe Area Guides"
              >
                <Shield className="h-3 w-3" />
                <span>Safe Area</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Vertical Placement (From Bottom)</span>
                <span className="font-mono text-neutral-300">{style.positionYPercent}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                value={style.positionYPercent}
                onChange={(e) => updateStyle({ positionYPercent: parseInt(e.target.value, 10) })}
                className="mt-1 w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Horizontal Center</span>
                <span className="font-mono text-neutral-300">{style.positionXPercent ?? 50}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={style.positionXPercent ?? 50}
                onChange={(e) => updateStyle({ positionXPercent: parseInt(e.target.value, 10) })}
                className="mt-1 w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </section>

          {/* Caption Animation Engine Section */}
          {(() => {
            const selectedSeg = currentProject.captionSegments.find((s) => s.id === selectedSegmentId);
            const hasSegmentOverride = Boolean(selectedSeg?.animation);
            const isEditingOverride = animationScope === 'override' && Boolean(selectedSeg);

            const activeAnimConfig: CaptionAnimationConfig = isEditingOverride && selectedSeg?.animation
              ? {
                  preset: selectedSeg.animation.preset || selectedSeg.animation.type || globalAnimation.preset,
                  entranceDurationMs: selectedSeg.animation.entranceDurationMs ?? globalAnimation.entranceDurationMs,
                  exitDurationMs: selectedSeg.animation.exitDurationMs ?? globalAnimation.exitDurationMs,
                  intensity: selectedSeg.animation.intensity ?? globalAnimation.intensity,
                  wordEmphasis: selectedSeg.animation.wordEmphasis ?? globalAnimation.wordEmphasis,
                  highlightColor: selectedSeg.animation.highlightColor ?? globalAnimation.highlightColor,
                  delayMs: selectedSeg.animation.delayMs ?? globalAnimation.delayMs,
                  staggerMs: selectedSeg.animation.staggerMs ?? globalAnimation.staggerMs,
                }
              : globalAnimation;

            const handleAnimChange = (updates: Partial<CaptionAnimationConfig>) => {
              if (isEditingOverride && selectedSeg) {
                setSegmentAnimation(selectedSeg.id, {
                  ...activeAnimConfig,
                  ...updates,
                });
              } else {
                updateGlobalAnimation(updates);
              }
            };

            const exportCap = getAnimationExportSupport(activeAnimConfig.preset);

            return (
              <section className="rounded-lg border border-[#1f2633] bg-[#12161f] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span>Caption Animation Engine</span>
                  </div>

                  {selectedSeg && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAnimationScope('global')}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors border',
                          animationScope === 'global'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-[#181d28] text-neutral-400 border-[#262f40]'
                        )}
                      >
                        Global
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnimationScope('override')}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors border',
                          animationScope === 'override'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-[#181d28] text-neutral-400 border-[#262f40]'
                        )}
                        title={`Override animation for selected caption (${selectedSeg.text.substring(0, 15)}...)`}
                      >
                        Caption #{currentProject.captionSegments.findIndex((s) => s.id === selectedSeg.id) + 1}
                      </button>
                    </div>
                  )}
                </div>

                {isEditingOverride && (
                  <div className="flex items-center justify-between rounded bg-amber-500/10 p-2 text-[10px] text-amber-300 border border-amber-500/25">
                    <span>
                      Editing per-caption override for segment #
                      {currentProject.captionSegments.findIndex((s) => s.id === selectedSeg!.id) + 1}
                    </span>
                    {hasSegmentOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          removeSegmentAnimationOverride(selectedSeg!.id);
                          setAnimationScope('global');
                        }}
                        className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-200 hover:bg-amber-500/30"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Preset Selector */}
                <div>
                  <label className="text-[10px] text-neutral-400 font-medium">Animation Preset</label>
                  <select
                    value={activeAnimConfig.preset}
                    onChange={(e) =>
                      handleAnimChange({
                        preset: e.target.value as CaptionAnimationPreset,
                      })
                    }
                    className="mt-1 w-full rounded border border-[#262f40] bg-[#181d28] px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="pop">Pop (Dynamic Spring Scale)</option>
                    <option value="scale">Scale (High-Impact Zoom)</option>
                    <option value="fade">Fade (Smooth Alpha Dissolve)</option>
                    <option value="fade-in">Fade In (Cinematic Entrance)</option>
                    <option value="fade-out">Fade Out (Graceful Dissolve)</option>
                    <option value="highlight-sweep">Highlight Sweep (Luminance Flow)</option>
                    <option value="slide-up">Slide Up (Rising from Bottom)</option>
                    <option value="slide-down">Slide Down (Dropping from Top)</option>
                    <option value="typewriter">Typewriter (Sequential Cadence)</option>
                    <option value="word-reveal">Word Reveal (Word-by-Word Timed)</option>
                    <option value="karaoke-highlight">Karaoke Highlight (Spoken Text Tracking)</option>
                    <option value="emphasis-scale">Emphasis Scale (Active Word Sine Pulse)</option>
                    <option value="cinematic-letter-reveal">Cinematic Letter Reveal (Tracking & Blur)</option>
                    <option value="bounce">Bounce (Playful Vertical)</option>
                    <option value="none">None (Static Display)</option>
                  </select>
                </div>

                {/* Export Pipeline Compatibility Card */}
                <div className="rounded-lg border border-[#222a3a] bg-[#0c1017] p-2 space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-300">Export Pipeline Support:</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.2 text-[8px] font-mono border',
                          exportCap.supportLevelASS === 'full'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        )}
                      >
                        ASS: {exportCap.supportLevelASS.toUpperCase()}
                      </span>
                      <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 text-[8px] font-mono">
                        CANVAS: 60FPS
                      </span>
                    </div>
                  </div>
                  <p className="text-neutral-400 leading-relaxed text-[9px]">{exportCap.description}</p>
                  {exportCap.exportWarning && (
                    <div className="flex items-start gap-1 rounded bg-amber-500/10 p-1.5 text-[9px] text-amber-300 border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>{exportCap.exportWarning}</span>
                    </div>
                  )}
                </div>

                {activeAnimConfig.preset !== 'none' && (
                  <div className="space-y-2.5 pt-1 border-t border-[#1b222d]">
                    {/* Entrance Duration Slider */}
                    <div>
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>Entrance Duration</span>
                        <span className="font-mono text-neutral-300">
                          {activeAnimConfig.entranceDurationMs}ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="1000"
                        step="25"
                        value={activeAnimConfig.entranceDurationMs}
                        onChange={(e) =>
                          handleAnimChange({ entranceDurationMs: parseInt(e.target.value, 10) })
                        }
                        className="mt-1 w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Exit Duration Slider */}
                    <div>
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>Exit Duration</span>
                        <span className="font-mono text-neutral-300">
                          {activeAnimConfig.exitDurationMs}ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="800"
                        step="25"
                        value={activeAnimConfig.exitDurationMs}
                        onChange={(e) =>
                          handleAnimChange({ exitDurationMs: parseInt(e.target.value, 10) })
                        }
                        className="mt-1 w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Animation Intensity */}
                    <div>
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>Animation Intensity</span>
                        <span className="font-mono text-neutral-300">
                          {activeAnimConfig.intensity.toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="2.0"
                        step="0.1"
                        value={activeAnimConfig.intensity}
                        onChange={(e) =>
                          handleAnimChange({ intensity: parseFloat(e.target.value) })
                        }
                        className="mt-1 w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Delay & Stagger */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-neutral-400">
                          <span>Delay</span>
                          <span className="font-mono text-neutral-300">
                            {activeAnimConfig.delayMs || 0}ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="500"
                          step="25"
                          value={activeAnimConfig.delayMs || 0}
                          onChange={(e) =>
                            handleAnimChange({ delayMs: parseInt(e.target.value, 10) })
                          }
                          className="mt-1 w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-neutral-400">
                          <span>Stagger</span>
                          <span className="font-mono text-neutral-300">
                            {activeAnimConfig.staggerMs || 0}ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={activeAnimConfig.staggerMs || 0}
                          onChange={(e) =>
                            handleAnimChange({ staggerMs: parseInt(e.target.value, 10) })
                          }
                          className="mt-1 w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Word Emphasis & Highlight Color */}
                    <div className="pt-2 border-t border-[#1b222d] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-300 font-medium">
                          Active Word Emphasis
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleAnimChange({ wordEmphasis: !activeAnimConfig.wordEmphasis })
                          }
                          className={cn(
                            'rounded px-2 py-0.5 text-[10px] font-semibold border transition-colors',
                            activeAnimConfig.wordEmphasis
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                              : 'border-[#262f40] text-neutral-400'
                          )}
                        >
                          {activeAnimConfig.wordEmphasis ? 'ENABLED' : 'OFF'}
                        </button>
                      </div>

                      {activeAnimConfig.wordEmphasis && (
                        <div>
                          <label className="text-[10px] text-amber-400 font-medium">
                            Highlight Color
                          </label>
                          <div className="mt-1 flex items-center gap-1.5 rounded border border-[#262f40] bg-[#181d28] p-1">
                            <input
                              type="color"
                              value={activeAnimConfig.highlightColor || style.activeWordColor}
                              onChange={(e) =>
                                handleAnimChange({ highlightColor: e.target.value })
                              }
                              className="h-5 w-5 rounded border-0 bg-transparent cursor-pointer"
                            />
                            <span className="font-mono text-[10px] text-amber-400 uppercase">
                              {activeAnimConfig.highlightColor || style.activeWordColor}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}
    </aside>
  );
};
