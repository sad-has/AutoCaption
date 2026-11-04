import React from 'react';

/**
 * Proof — Large marks on tiles (grid).
 *
 * A board of filled tiles, four across and two rows deep, with 8px gaps,
 * spanning the full content width. Each tile is about 3:2, one step lighter
 * or darker than the page ground, with no border. One tile, twice the width
 * of the others and placed first, is in the accent colour and carries the
 * heading. Tiles hold the name set at 28–32px bold, top-left with 24px
 * padding. Tiles sit still; there is no hover lift.
 */
const TILES = [
  { name: 'AutoCaption', wide: true, accent: true },
  { name: 'CapCut', wide: false, accent: false },
  { name: 'DaVinci Resolve', wide: false, accent: false },
  { name: 'Premiere Pro', wide: false, accent: false },
  { name: 'Final Cut Pro', wide: false, accent: false },
  { name: 'HandBrake', wide: false, accent: false },
  { name: 'OBS Studio', wide: false, accent: false },
  { name: 'FFmpeg', wide: false, accent: false },
];

export const Proof: React.FC = () => (
  <section id="proof" className="relative bg-[#0b0d11] py-24">
    <div className="frame">
      <div className="grid grid-cols-4 gap-2">
        {TILES.map((t, i) => (
          <div
            key={t.name}
            className={`relative overflow-hidden p-6 ${t.wide ? 'col-span-2' : 'col-span-1'} min-h-[150px] flex flex-col justify-between`}
            style={{
              background: t.accent ? '#10b981' : i % 2 === 0 ? '#11141a' : '#161a23',
              color: t.accent ? '#0b0d11' : '#f3f4f6',
            }}
          >
            <span
              className="font-[Oswald] font-bold uppercase tracking-tight"
              style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.1 }}
            >
              {t.name}
            </span>
            {t.accent && (
              <span
                className="font-[Oswald] text-xs tracking-[0.2em] uppercase self-start"
                style={{ color: '#0b0d11' }}
              >
                Built for this
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);