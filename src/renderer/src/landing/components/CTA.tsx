import React, { useState, FormEvent } from 'react';
import { Mail, Send, Download, CheckCircle2 } from 'lucide-react';

export const CTA: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || status !== 'idle') return;
    setStatus('submitting');
    // Simulate API call - in reality this would go to a local backend or be handled differently
    await new Promise((r) => setTimeout(r, 1000));
    setStatus('success');
  };

  return (
    <section
      id="cta"
      className="mx-auto max-w-7xl px-5 py-24"
    >
      <div
        className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-[#11141a] to-amber-500/10 p-10 sm:p-16 text-center overflow-hidden"
      >
        {/* Decorative grid */}
        <div aria-hidden className="grid-bg absolute inset-0 opacity-50" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready to caption?
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl">
            Download the desktop app
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
              and start captioning offline
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-400">
            No account. No cloud. Just a single executable that runs on Windows, macOS, and Linux.
          </p>

          {status === 'success' ? (
            <div className="mt-6 flex flex-col items-center gap-4 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
              <p className="font-medium">Thanks! You'll get an email when the installer is ready.</p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Subscribe another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:max-w-md sm:mx-auto">
              <label htmlFor="cta-email" className="sr-only">
                Email address
              </label>
              <input
                id="cta-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status !== 'idle'}
                placeholder="your@email.com"
                className="flex-1 rounded-lg border border-[#252b38] bg-[#0b0d11] px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              <button
                type="submit"
                disabled={!email || status !== 'idle'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'submitting' ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
                    Joining...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Notify Me
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-4 text-xs text-neutral-500">
            No spam. Unsubscribe anytime. We only email for major releases.
          </p>
        </div>
      </div>

      {/* Alternative: direct download links (placeholder) */}
      <div className="reveal mt-12 grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
        {[
          { os: 'Windows', icon: '🪟', variant: 'primary' as const },
          { os: 'macOS', icon: '🍎', variant: 'secondary' as const },
          { os: 'Linux', icon: '🐧', variant: 'secondary' as const },
        ].map((item) => (
          <div
            key={item.os}
            className={`rounded-xl border p-6 transition-colors ${
              item.variant === 'primary'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-[#1f2633] bg-[#11141a] hover:border-emerald-500/30'
            }`}
          >
            <span className="text-3xl">{item.icon}</span>
            <div className="mt-2 font-semibold text-neutral-100">{item.os}</div>
            <p className="mt-1 text-xs text-neutral-400">
              {item.variant === 'primary' ? 'Available now' : 'Coming soon'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};