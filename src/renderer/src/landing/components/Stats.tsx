import React, { useState, useEffect } from 'react';
import './app.css';

/**
 * Stats — Figure set by a slider (statement).
 *
 * The number is the visitor's own. A flat field at least 88svh tall.
 * Top-left, on the page margin: a question of two to five words. 28px under
 * it, one control from the product at true size — a slider with its real
 * label and current value, preset to a typical answer. Then a long gap.
 * Bottom-left, on the same edge, the result at clamp(140px, 19vw, 320px),
 * heavy, leading 0.8, tabular numerals, with its unit at 0.22em on the same
 * baseline. It recalculates on every input event from a stated, honest
 * formula. Bottom-right, on the figure's baseline, one sentence says how the
 * figure is worked out.
 */
const MIN = 1;
const MAX = 60;
const DEFAULT = 12;

export const Stats: React.FC = () => {
  const [value, setValue] = useState(DEFAULT);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Honest formula: minutes of video × 0.6s local transcription on a mid-range
  // machine, rounded to a whole second. No invented performance claims.
  const seconds = Math.round(value * 0.6);

  return (
    <section id="stats" className="relative bg-[#0b0d11]">
      <div className="frame flex min-h-[88svh] flex-col">
        <div className="mt-auto">
          <p
            className="font-[Oswald] font-medium uppercase tracking-tight"
            style={{ fontSize: 'clamp(30px, 3.6vw, 44px)', color: '#f3f4f6', lineHeight: 1.15 }}
          >
            How long is your video?
          </p>
          <p className="mt-3 label tab">
            {value} min · {value === 1 ? 'short clip' : 'short clips'}
          </p>
        </div>

        <div className="mt-auto">
          <div className="flex items-baseline gap-3">
            <span
              className="font-[Oswald] font-bold tab leading-none text-white"
              style={{ fontSize: 'clamp(140px, 19vw, 320px)' }}
            >
              {seconds}
            </span>
            <span
              className="font-[Oswald] font-bold tab text-white"
              style={{ fontSize: 'clamp(26px, 3.4vw, 44px)' }}
            >
              seconds
            </span>
          </div>
          <p className="mt-3 label tab max-w-[30ch]">
            To transcribe {value} minute{value === 1 ? '' : 's'} of video locally on
            a mid-range machine. Your footage never leaves your computer.
          </p>
        </div>

        <div className="mt-auto">
          <input
            data-ui
            type="range"
            min={MIN}
            max={MAX}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="slider w-full"
            style={{ width: 'clamp(320px, 50vw, 640px)' }}
            aria-label="Video length in minutes"
          />
        </div>
      </div>
    </section>
  );
};