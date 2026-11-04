import React, { useState } from 'react';

/**
 * Features — Sentences with switches (band).
 *
 * Four capabilities, each one plain sentence ending in a working toggle.
 * Every sentence is a full-bleed band 20vh tall, butted against the next.
 * Off, a band is the page ground and the sentence is the soft ink. On, the
 * band fills with a palette colour, the sentence turns to full ink, and a
 * second line appears beneath stating the consequence in figures.
 */
const BANDS = [
  {
    sentence: 'Transcribe your video on your own machine.',
    onColor: '#10b981',
    consequence: 'tiny · base · small · medium · large-v3 — all local.',
  },
  {
    sentence: 'Burn captions into the video or export clean subtitles.',
    onColor: '#f59e0b',
    consequence: 'SRT · WebVTT · MP4/H.264 · ProRes.',
  },
  {
    sentence: 'Style every word with a retention caption template.',
    onColor: '#38bdf8',
    consequence: 'Hormozi Pop · Beast Punch · Clean Minimal · Desi Gold.',
  },
  {
    sentence: 'Ship it without an internet connection.',
    onColor: '#10b981',
    consequence: 'Zero cloud egress. Zero accounts. Zero telemetry.',
  },
];

export const Features: React.FC = () => {
  const [on, setOn] = useState<Set<number>>(new Set([0, 3]));

  const toggle = (i: number) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section id="features" className="relative">
      {BANDS.map((b, i) => {
        const isOn = on.has(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            aria-pressed={isOn}
            className="group relative flex w-full cursor-pointer items-center justify-between border-b border-[#1a1f29] px-[clamp(16px,2.4vw,32px)] py-[clamp(40px,5vh,80px)] text-left transition-colors duration-300"
            style={{
              background: isOn ? b.onColor : '#0b0d11',
              color: isOn ? '#0b0d11' : '#f3f4f6',
            }}
          >
            <span
              className="font-[Oswald] font-medium uppercase tracking-tight leading-snug"
              style={{ fontSize: 'clamp(28px, 3.4vw, 56px)' }}
            >
              {b.sentence}
            </span>

            {/* Toggle — built in em so it matches the type size */}
            <span
              data-ui
              className="relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
              style={{ background: isOn ? '#0b0d11' : '#161a23' }}
              onClick={(e) => {
                e.stopPropagation();
                toggle(i);
              }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                style={{ transform: isOn ? 'translateX(28px)' : 'translateX(0)' }}
              />
            </span>

            {isOn && (
              <span
                className="absolute bottom-6 left-[clamp(16px,2.4vw,32px)] font-[Oswald] text-xs tracking-[0.2em] uppercase"
                style={{ color: '#0b0d11' }}
              >
                {b.consequence}
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
};