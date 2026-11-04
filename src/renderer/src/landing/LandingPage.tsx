import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { TrustStrip } from './components/TrustStrip';
import { Features } from './components/Features';
import { TemplateShowcase } from './components/TemplateShowcase';
import { HowItWorks } from './components/HowItWorks';
import { Stats } from './components/Stats';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';

/**
 * AutoCaption Studio Landing Page
 *
 * Single-page marketing site for a local-first desktop video caption editor.
 * Sections are anchored via smooth-scroll nav links. All animations are
 * gated behind `prefers-reduced-motion` where practical.
 */
export const LandingPage: React.FC = () => {
  useEffect(() => {
    // Reveal-on-scroll observer
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0d11] text-[#f3f4f6]">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <TemplateShowcase />
        <HowItWorks />
        <Stats />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};