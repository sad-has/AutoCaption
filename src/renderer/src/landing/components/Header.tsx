import React, { useState, useEffect } from 'react';
import { Menu, X, Download, Film } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Templates', href: '#templates' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300
        ${scrolled ? 'bg-[#0b0d11]/92 backdrop-blur-md border-b border-[#1f2633]' : 'bg-transparent'}
      `}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        {/* Brand */}
        <a href="#top" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Film className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-neutral-100">
            AutoCaption<span className="text-emerald-400">.Studio</span>
          </span>
          <span className="hidden rounded bg-[#171b24] px-1.5 py-0.5 text-[9px] font-semibold text-neutral-400 border border-[#262e3d] sm:inline">
            v0.1
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a
            href="#cta"
            className="hidden items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-emerald-500 sm:inline-flex"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#252b38] text-neutral-300 hover:bg-[#161922] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[#1f2633] bg-[#0b0d11] px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-[#161922] hover:text-neutral-100"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#cta"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-neutral-950"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};