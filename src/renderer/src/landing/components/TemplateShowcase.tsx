import React, { useState } from 'react';
import { Film, Play, RotateCw } from 'lucide-react';

const TEMPLATES = [
  {
    id: 'hormozi',
    name: 'Hormozi Pop',
    category: 'High Retention',
    desc: 'Bold yellow & green karaoke text with strong black stroke. Perfect for short-form talking head videos.',
    bgGrad: 'from-amber-500/20 to-emerald-500/20',
    words: [
      { text: 'THE', color: '#ffffff' },
      { text: 'SECRET', color: '#10b981' },
      { text: 'TO', color: '#ffffff' },
      { text: 'VIRAL', color: '#f59e0b' },
      { text: 'CONTENT', color: '#ffffff' },
    ],
  },
  {
    id: 'beast',
    name: 'Beast Punch',
    category: 'High Energy',
    desc: 'Impact typography with high-contrast text background. Designed for fast-paced challenge videos.',
    bgGrad: 'from-red-500/20 to-amber-500/20',
    words: [
      { text: 'I', color: '#ffffff' },
      { text: 'SURVIVED', color: '#ef4444' },
      { text: '100', color: '#f59e0b' },
      { text: 'DAYS', color: '#ffffff' },
    ],
  },
  {
    id: 'clean',
    name: 'Clean Minimal',
    category: 'Educational',
    desc: 'Refined sans-serif subtitle with subtle backdrop. Ideal for tech reviews, tutorials, and podcasts.',
    bgGrad: 'from-sky-500/20 to-indigo-500/20',
    words: [
      { text: 'Understanding', color: '#f3f4f6' },
      { text: 'Modern', color: '#38bdf8' },
      { text: 'Design Systems', color: '#f3f4f6' },
    ],
  },
  {
    id: 'desi',
    name: 'Desi Gold',
    category: 'Cinematic',
    desc: 'Warm gold typography with deep shadow. Perfect for narrative storytelling and luxury content.',
    bgGrad: 'from-amber-500/20 to-yellow-600/20',
    words: [
      { text: 'A', color: '#ffffff' },
      { text: 'JOURNEY', color: '#fbbf24' },
      { text: 'THROUGH', color: '#ffffff' },
      { text: 'TIME', color: '#fbbf24' },
    ],
  },
];

export const TemplateShowcase: React.FC = () => {
  const [flippedId, setFlippedId] = useState<string | null>(null);

  return (
    <section id="templates" className="mx-auto max-w-7xl px-5 py-24">
      <div className="reveal text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
          <Film className="h-3.5 w-3.5" />
          Style Library
        </span>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl">
          Templates tuned for maximum retention
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
          Click any card to flip and inspect typography specs and karaoke colors.
        </p>
      </div>

      <div className="reveal mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map((t) => {
          const isFlipped = flippedId === t.id;
          return (
            <div
              key={t.id}
              className="perspective-1000 h-80 w-full cursor-pointer"
              onClick={() => setFlippedId(isFlipped ? null : t.id)}
            >
              <div
                className={`template-card relative h-full w-full rounded-xl border border-[#1f2633] bg-[#11141a] transition-transform duration-500 ${
                  isFlipped ? 'is-flipped' : ''
                }`}
              >
                {/* Front Side */}
                <div className="absolute inset-0 flex flex-col justify-between p-6 [backface-visibility:hidden]">
                  <div>
                    <span className="inline-block rounded bg-[#1f2633] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      {t.category}
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-neutral-100">{t.name}</h3>
                  </div>

                  {/* Preview Box */}
                  <div className={`relative flex h-28 items-center justify-center rounded-lg bg-gradient-to-br ${t.bgGrad} p-4 border border-white/5`}>
                    <div className="flex flex-wrap justify-center gap-1.5 text-center font-extrabold tracking-wide text-lg drop-shadow-md">
                      {t.words.map((w, idx) => (
                        <span key={idx} style={{ color: w.color }}>
                          {w.text}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Play className="h-3 w-3 fill-current" /> Interactive
                    </span>
                    <span className="inline-flex items-center gap-1 hover:text-white">
                      <RotateCw className="h-3 w-3" /> Flip details
                    </span>
                  </div>
                </div>

                {/* Back Side */}
                <div className="absolute inset-0 flex flex-col justify-between p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#171b23] rounded-xl border border-emerald-500/30">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400">{t.name} Specs</h4>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-300">{t.desc}</p>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-neutral-400 font-mono">
                    <div className="flex justify-between border-b border-[#252b38] pb-1">
                      <span>Stroke</span>
                      <span className="text-neutral-200">3px Solid Black</span>
                    </div>
                    <div className="flex justify-between border-b border-[#252b38] pb-1">
                      <span>Shadow</span>
                      <span className="text-neutral-200">0px 4px 12px</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Karaoke speed</span>
                      <span className="text-emerald-400">Frame-Sync</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full rounded bg-emerald-600/20 py-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                  >
                    Click to flip back
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};