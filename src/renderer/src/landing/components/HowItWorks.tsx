import React from 'react';
import './app.css';

/**
 * How it works — One card, four fields (strip).
 *
 * Four flat colour fields stand side by side across the full viewport,
 * each 25vw wide and 84svh tall, butted together with no gaps. The same
 * caption job card from the product appears once in each field at the same
 * height, marked data-ui, further along every time: bare, then with an owner
 * and a due date, then half-ticked, then closed with its final figure.
 * Along the bottom of each field, one clause begins with its order word.
 */
const FIELDS = [
  {
    color: '#161a23',
    clause: 'First it lands here.',
    card: {
      title: 'vlog-ep09.mp4',
      status: 'Queued',
      owner: null,
      due: null,
      ticks: 0,
      total: 4,
      figure: null,
    },
  },
  {
    color: '#1a202c',
    clause: 'Then someone takes it.',
    card: {
      title: 'vlog-ep09.mp4',
      status: 'Transcribing',
      owner: 'You',
      due: 'in 2 min',
      ticks: 1,
      total: 4,
      figure: null,
    },
  },
  {
    color: '#1e2430',
    clause: 'Then it gets checked.',
    card: {
      title: 'vlog-ep09.mp4',
      status: 'Editing',
      owner: 'You',
      due: 'today',
      ticks: 2,
      total: 4,
      figure: null,
    },
  },
  {
    color: '#232a36',
    clause: 'Then it ships.',
    card: {
      title: 'vlog-ep09.mp4',
      status: 'Exported',
      owner: 'You',
      due: 'done',
      ticks: 4,
      total: 4,
      figure: '4K · 12:41',
    },
  },
];

export const HowItWorks: React.FC = () => (
  <section id="how" className="relative">
    <div className="flex w-full">
      {FIELDS.map((f, i) => {
        const c = f.card;
        return (
          <div
            key={i}
            className="relative flex w-1/4 flex-col"
            style={{ background: f.color, minHeight: '84svh' }}
          >
            <div className="p-6">
              <span className="font-[Oswald] text-xs tracking-[0.2em] uppercase text-[#8b93a2]">
                Caption job
              </span>
            </div>

            {/* The card, at true size, 38% down, centred, 260px wide. */}
            <div className="flex flex-1 items-center justify-center px-6">
              <div
                data-ui
                className="r panel-2 w-[260px] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="label tab truncate">{c.title}</span>
                  <span
                    className="label tab"
                    style={{ color: c.status === 'Queued' ? '#8b93a2' : '#10b981' }}
                  >
                    {c.status}
                  </span>
                </div>

                {c.owner && (
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="label">Owner</span>
                    <span className="text-[#f3f4f6] tab">{c.owner}</span>
                  </div>
                )}
                {c.due && (
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="label">Due</span>
                    <span className="text-[#f3f4f6] tab">{c.due}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1.5">
                  {Array.from({ length: c.total }).map((_, j) => (
                    <span
                      key={j}
                      className="h-2 w-2"
                      style={{
                        background: j < c.ticks ? '#10b981' : '#252b38',
                      }}
                    />
                  ))}
                </div>

                {c.figure && (
                  <div className="mt-3 border-t border-[#1a1f29] pt-3 text-right">
                    <span className="label tab">Output</span>
                    <p className="font-[Oswald] text-lg font-bold tab text-white">
                      {c.figure}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto p-6">
              <p
                className="font-[Oswald] font-medium uppercase tracking-tight"
                style={{ fontSize: 'clamp(20px, 2vw, 30px)', color: '#f3f4f6', lineHeight: 1.2 }}
              >
                {f.clause}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);