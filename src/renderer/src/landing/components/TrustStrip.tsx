import React from 'react';

const BRANDS = [
  'DaVinci Resolve',
  'Adobe Premiere Pro',
  'Final Cut Pro',
  'CapCut Pro',
  'OBS Studio',
  'HandBrake',
];

export const TrustStrip: React.FC = () => (
  <section className="border-y border-[#1a1f29] bg-[#0d1017] py-6">
    <div className="mx-auto max-w-7xl px-5">
      <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-widest text-neutral-600">
        Works with the tools you already use
      </p>
      <div className="marquee">
        {[...BRANDS, ...BRANDS].map((b, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-300"
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  </section>
);