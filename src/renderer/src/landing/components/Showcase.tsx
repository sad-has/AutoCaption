import React, { useState } from 'react';
import './app.css';

/**
 * Showcase — Object on a disc (index).
 *
 * Software has no photographs, so its pictures are its own interface. A flat
 * filled disc carries a caption fragment (the product's real output) in front
 * of it. A vertical list of item names at bottom-left selects which caption
 * shows; the selected name is in full ink, the rest at 25%.
 */
const ITEMS = [
  {
    name: 'Hormozi Pop',
    color: '#10b981',
    caption: ['THE', 'SECRET', 'TO', 'VIRAL', 'CONTENT'],
    highlight: 2,
  },
  {
    name: 'Beast Punch',
    color: '#f59e0b',
    caption: ['I', 'SURVIVED', '100', 'DAYS'],
    highlight: 1,
  },
  {
    name: 'Clean Minimal',
    color: '#38bdf8',
    caption: ['Understanding', 'Modern', 'Design'],
    highlight: 1,
  },
  {
    name: 'Desi Gold',
    color: '#fbbf24',
    caption: ['A', 'JOURNEY', 'THROUGH', 'TIME'],
    highlight: 1,
  },
];

export const Showcase: React.FC = () => {
  const [active, setActive] = useState(0);
  const item = ITEMS[active];

  return (
    <section id="showcase" className="relative min-h-[100vh] bg-[#0b0d11]">
      <div className="frame flex h-full min-h-[100vh] items-center">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left: the vertical list of item names */}
          <div className="flex flex-col">
            <span className="font-[Oswald] text-xs tracking-[0.2em] uppercase text-[#8b93a2]">
              Caption styles
            </span>
            <ul className="mt-6 flex flex-col">
              {ITEMS.map((it, i) => (
                <li key={it.name}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className="group flex items-center gap-3 py-3 text-left"
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0"
                      style={{ background: it.color }}
                    />
                    <span
                      className="font-[Oswald] font-medium uppercase tracking-tight transition-colors"
                      style={{
                        fontSize: 'clamp(24px, 2.6vw, 40px)',
                        color: i === active ? '#f3f4f6' : '#3a4150',
                        lineHeight: 1.15,
                      }}
                    >
                      {it.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: the disc with the caption object in front */}
          <div className="relative flex justify-center">
            <div
              className="flex items-center justify-center"
              style={{
                width: 'clamp(320px, 64vh, 640px)',
                height: 'clamp(320px, 64vh, 640px)',
                background: item.color,
                clipPath: 'circle(50%)',
              }}
            >
              <div
                data-ui
                className="caption flex flex-col items-center text-center"
                style={{ color: '#0b0d11' }}
              >
                {item.caption.map((w, i) => (
                  <span
                    key={w}
                    className={i === item.highlight ? 'word karaoke' : 'word'}
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};