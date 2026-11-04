import React from 'react';

/**
 * Hero — the tabbed folder stack.
 *
 * The caption strip (a horizontal band) is the one motif. The hero is a stack
 * of five file folders: flat colour bands, each with a trapezoid tab holding
 * a section name. The front folder is the accent colour, open, and carries
 * the single action. Every folder links to its section and lends that
 * section its ground colour.
 */
const FOLDERS = [
  { name: 'Features', color: '#161a23', tabX: '6%' },
  { name: 'Showcase', color: '#1a202c', tabX: '24%' },
  { name: 'How it works', color: '#1e2430', tabX: '42%' },
  { name: 'Proof', color: '#232a36', tabX: '60%' },
  { name: 'Download', color: '#10b981', tabX: '78%' },
];

export const Hero: React.FC = () => (
  <section className="relative min-h-screen bg-[#0b0d11]">
    {/* Slim top row: wordmark centre, one link far right */}
    <div className="frame absolute top-0 left-0 right-0 flex h-24 items-center justify-between">
      <span className="font-mono text-xs tracking-[0.25em] text-[#8b93a2]">
        AUTOCAPTION.STUDIO
      </span>
      <a
        href="#features"
        className="text-sm text-[#8b93a2] transition-colors hover:text-white"
      >
        Features
      </a>
    </div>

    {/* Headline: one centred line of heavy condensed capitals */}
    <div className="frame absolute top-24 left-0 right-0 text-center">
      <h1
        className="font-[Oswald] font-bold uppercase tracking-tight leading-none text-white"
        style={{ fontSize: 'clamp(96px, 10vw, 160px)' }}
      >
        Offline captions.
      </h1>
      <p className="mt-6 font-[Playfair_Display] italic text-[20px] text-[#8b93a2] max-w-[46ch] mx-auto leading-relaxed">
        A desktop editor that turns your video into high-retention captions
        without ever uploading it to the cloud.
      </p>
    </div>

    {/* Folder stack — starts at 51% of the height */}
    <div className="absolute left-0 right-0" style={{ top: '51%' }}>
      <div className="frame relative">
        {FOLDERS.map((f, i) => {
          const isFront = i === FOLDERS.length - 1;
          const top = i * 64;
          return (
            <div
              key={f.name}
              className="absolute left-0 right-0"
              style={{ top }}
            >
              <div className="mx-auto w-[86%]">
                {/* Tab — trapezoid, cut with clip-path, at its own position and colour */}
                <div
                  className="tab h-10 -mb-px"
                  style={{ background: f.color, marginLeft: f.tabX, width: '20%' }}
                />
                {/* Band — the folder body. The front one is open and runs off the bottom. */}
                <div
                  className={`bg-[#0b0d11] ${isFront ? 'min-h-[70vh]' : 'h-24'}`}
                  style={{ background: f.color }}
                >
                  {isFront && (
                    <div className="flex h-full items-center justify-between px-10 pb-24">
                      <div>
                        <span className="font-[Oswald] text-xs tracking-[0.2em] text-white/60">
                          {f.name}
                        </span>
                      </div>
                      <a
                        href="#cta"
                        className="rounded-none bg-white px-7 py-3 text-sm font-bold uppercase tracking-wider text-[#0b0d11] transition-colors hover:bg-[#10b981]"
                      >
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Scroll cue */}
    <a
      href="#features"
      aria-label="Scroll to features"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[#8b93a2] transition-colors hover:text-white"
    >
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
    </a>
  </section>
);