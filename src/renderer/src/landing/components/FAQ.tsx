import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'Does AutoCaption Studio upload my video anywhere?',
    a: 'No. Everything runs locally on your machine. Video files, transcripts, and exports never leave your device unless you explicitly choose to share them.',
  },
  {
    q: 'Which Whisper models are supported?',
    a: 'All standard models: tiny, base, small, medium, and large-v3. You can download and switch between them in Settings. The app manages model caching automatically.',
  },
  {
    q: 'Can I use my own fonts?',
    a: 'Yes. Drop any .ttf or .otf file into the Fonts panel and it will be available immediately for all templates and exports.',
  },
  {
    q: 'What export formats are available?',
    a: 'Burned-in video (MP4/H.264, ProRes) and sidecar subtitles (SRT, WebVTT). Export defaults are configurable in Settings.',
  },
  {
    q: 'Is there a macOS / Linux version?',
    a: 'Windows is available now. macOS (Apple Silicon) and Linux (AppImage) builds are in active development — sign up for updates on the CTA section.',
  },
  {
    q: 'Do I need an internet connection?',
    a: 'Only for the initial model download (once per model size) and optional update checks. After that, it works 100% offline.',
  },
];

export const FAQ: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
      <div className="reveal text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
          Questions
        </span>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl">
          Frequently asked questions
        </h2>
      </div>

      <div className="reveal mt-10 space-y-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`faq-item rounded-xl border border-[#1f2633] bg-[#11141a] overflow-hidden transition-colors ${
                isOpen ? 'border-emerald-500/30 is-open' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-medium text-neutral-100 pr-8">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-neutral-400 transition-transform ${isOpen && 'rotate-180'}`}
                />
              </button>
              <div className="faq-answer px-4 pb-4 text-sm leading-relaxed text-neutral-400">
                {item.a}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};