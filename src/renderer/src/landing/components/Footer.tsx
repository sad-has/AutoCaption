import React from 'react';
import { Film, Twitter, Github, Linkedin, Mail } from 'lucide-react';

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Templates', href: '#templates' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Changelog', href: '#' },
  ],
  Resources: [
    { label: 'Documentation', href: '#' },
    { label: 'Keyboard Shortcuts', href: '#' },
    { label: 'Whisper Models', href: '#' },
    { label: 'Community', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'EULA', href: '#' },
    { label: 'Licenses', href: '#' },
  ],
};

const SOCIALS = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Mail, href: '#', label: 'Email' },
];

export const Footer: React.FC = () => (
  <footer className="border-t border-[#1f2633] bg-[#0d1017]">
    <div className="mx-auto max-w-7xl px-5 py-12 lg:py-16">
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-5">
        {/* Brand */}
        <div className="lg:col-span-2">
          <a href="#top" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Film className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-neutral-100">
              AutoCaption<span className="text-emerald-400">.Studio</span>
            </span>
          </a>
          <p className="mt-4 max-w-xs text-sm text-neutral-400">
            Local-first desktop video caption editor. High-retention cinematic captions without the cloud.
          </p>
          <div className="mt-6 flex gap-4">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#252b38] text-neutral-400 transition-colors hover:border-emerald-500/40 hover:text-white"
                aria-label={s.label}
              >
                <s.icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(FOOTER_LINKS).map(([title, links]) => (
          <nav key={title} className="hidden lg:block">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {title}
            </h4>
            <ul className="mt-4 space-y-2">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-neutral-400 transition-colors hover:text-emerald-400"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#1f2633] pt-8 text-center sm:flex-row">
        <p className="text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} AutoCaption Studio. Built for creators who value privacy.
        </p>
        <div className="flex items-center gap-4 text-[11px] text-neutral-500">
          <span>v0.1.0</span>
          <span className="h-3 w-px bg-[#252b38]" />
          <a href="#" className="hover:text-white">Privacy</a>
          <a href="#" className="hover:text-white">Terms</a>
          <a href="#" className="hover:text-white">Contact</a>
        </div>
      </div>
    </div>
  </footer>
);