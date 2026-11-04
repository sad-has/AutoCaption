import React, { useState } from 'react';
import { Check, ShieldCheck, Download } from 'lucide-react';

export const Pricing: React.FC = () => {
  const [annually, setAnnually] = useState(true);

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-5 py-24">
      <div className="reveal text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Simple Pricing
        </span>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl">
          One desktop license, forever yours
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
          No monthly cloud subscriptions, no per-minute export fees.
        </p>

        {/* Billing Switch */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-xs ${!annually ? 'text-white font-semibold' : 'text-neutral-400'}`}>
            Lifetime Purchase
          </span>
          <button
            type="button"
            onClick={() => setAnnually(!annually)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
              annually ? 'bg-emerald-600' : 'bg-[#1f2633]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                annually ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs ${annually ? 'text-white font-semibold' : 'text-neutral-400'}`}>
            Pro Creator Bundle <span className="text-emerald-400">(Save 40%)</span>
          </span>
        </div>
      </div>

      <div className="reveal mx-auto mt-12 max-w-lg rounded-2xl border border-emerald-500/30 bg-[#11141a] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 rounded-bl-xl bg-emerald-500/10 border-l border-b border-emerald-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          Local-First Edition
        </div>

        <div className="text-center">
          <h3 className="text-xl font-bold text-neutral-100">AutoCaption Studio</h3>
          <div className="mt-4 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-extrabold tracking-tight text-white">
              {annually ? '$49' : '$79'}
            </span>
            <span className="text-sm font-semibold text-neutral-400">one-time</span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">Pay once. Use offline forever on up to 3 PCs.</p>
        </div>

        <ul className="mt-8 space-y-3 text-sm text-neutral-300">
          {[
            'Full local Whisper engine (tiny → large-v3)',
            'Unlimited video exports & zero watermarks',
            'All 4 retention caption templates',
            'Custom font loader (.ttf / .otf support)',
            'Burn-in video rendering & SRT/WebVTT export',
            '100% private — zero telemetry or cloud egress',
            '1 year of free updates',
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <a
          href="#cta"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-500"
        >
          <Download className="h-4 w-4" />
          Download Desktop App
        </a>
      </div>
    </section>
  );
};