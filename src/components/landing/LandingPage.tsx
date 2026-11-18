'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { AUTHOR } from '@/lib/site';
import { HeroVideo } from './HeroVideo';
import { LandingCameras } from './LandingCameras';
import { LandingControls } from './LandingControls';
import { LandingFaq } from './LandingFaq';
import { LandingGarage } from './LandingGarage';
import {
  FEATURE_ICONS,
  LANDING_STAGES,
  landingAsset,
  PLAY_HREF,
  STEP_ICONS,
  twoDigits,
} from './landingContent';

/** Scrolled this far (px), the floating nav turns compact and wide. */
const SCROLLED_AT = 24;

/**
 * Whether the page is scrolled past `threshold`. A passive listener; state
 * only changes when the threshold is crossed, so it doesn't re-render on
 * every scroll event.
 */
function useScrolled(threshold: number): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);
  return scrolled;
}

/**
 * Closes the phone menu on Escape (focus returns to its toggle) or on a tap
 * anywhere outside the nav, as a disclosure menu should.
 */
function useDismiss(
  open: boolean,
  close: () => void,
  nav: RefObject<HTMLElement | null>,
  toggle: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      toggle.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!nav.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close, nav, toggle]);
}

/** An inline SVG icon from `public/landing`, decorative. */
function Icon({ name, w, h }: { name: string; w: number; h: number }) {
  return <Image src={landingAsset(name)} alt="" width={w} height={h} unoptimized />;
}

function PlayButton({ large = false }: { large?: boolean }) {
  const m = useMessages();
  return (
    <a className={`pixel-btn play-button ${large ? 'large' : ''}`} href={PLAY_HREF}>
      {m.landing.play}
      <Icon name="icon-play.svg" w={16} h={16} />
    </a>
  );
}

/**
 * The /landing page, ported from the Figma Make design in
 * context/landing-page: hero, how it plays, the stage types, the garage,
 * the cameras, a final call to play and FAQs. The site's front page at
 * `/`; Play goes to the game at `/game`.
 */
export function LandingPage() {
  const m = useMessages();
  const t = m.landing;
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const scrolled = useScrolled(SCROLLED_AT);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useDismiss(menuOpen, close, navRef, toggleRef);

  return (
    <div className="landing-page">
      <main className="page-shell">
        <nav ref={navRef} className={`nav ${scrolled ? 'scrolled' : ''}`} aria-label={t.nav.label}>
          <a href="#top" className="nav-logo" aria-label={t.nav.home}>
            <Icon name="logo-nav.svg" w={132} h={58} />
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={t.nav.toggle}
          >
            <span />
            <span />
            <span />
          </button>
          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <a href="#gameplay" onClick={close}>
              {t.nav.gameplay}
            </a>
            <a href="#worlds" onClick={close}>
              {t.nav.world}
            </a>
            <a href="#garage" onClick={close}>
              {t.nav.garage}
            </a>
            <a href="#controls" onClick={close}>
              {t.nav.controls}
            </a>
          </div>
          <a className="pixel-btn nav-play" href={PLAY_HREF}>
            {t.play}
            <Icon name="icon-play.svg" w={16} h={16} />
          </a>
        </nav>

        <header id="top" className="hero">
          <div className="hero-backdrop" aria-hidden="true">
            <Image
              src={landingAsset('hero.webp')}
              alt=""
              width={2400}
              height={1566}
              priority
              sizes="1214px"
            />
            <HeroVideo />
          </div>
          <div className="hero-copy">
            <h1>
              <span>{t.hero.top}</span>
              <strong>{t.hero.bottom}</strong>
            </h1>
            <p>{t.hero.body}</p>
            <div className="hero-actions">
              <PlayButton />
              <a className="see-link" href="#gameplay">
                {t.hero.see}
                <Icon name="icon-arrow-down.svg" w={13} h={10} />
              </a>
            </div>
          </div>
        </header>

        <section className="ticker" aria-label={t.tickerLabel}>
          {t.ticker.map((item, i) => (
            <span key={item}>
              {i > 0 && <b aria-hidden="true">◆</b>}
              {item}
            </span>
          ))}
        </section>

        <section id="gameplay" className="content-section gameplay">
          <div className="section-heading">
            <h2>
              <span>{t.gameplay.top}</span>
              <strong>{t.gameplay.bottom}</strong>
            </h2>
            <p>{t.gameplay.body}</p>
          </div>
          <div className="steps">
            {t.gameplay.steps.map((step, i) => (
              <article className="step-card" key={step.title}>
                <div className="step-icon">
                  <Icon name={STEP_ICONS[i]!} w={28} h={28} />
                </div>
                <span className="step-number">{twoDigits(i + 1)}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <i />
              </article>
            ))}
          </div>
        </section>

        <section id="worlds" className="worlds">
          <div className="content-section">
            <div className="section-heading light">
              <h2>
                <span>{t.worlds.top}</span>
                <strong>{t.worlds.bottom}</strong>
              </h2>
              <p>{t.worlds.body}</p>
            </div>
            <div className="stage-rail">
              {LANDING_STAGES.map((id, i) => {
                const name = m.stageTypes[id];
                return (
                  <article className="stage-card" key={id}>
                    <Image
                      className="stage-image"
                      src={landingAsset(`stage-${id}.png`)}
                      alt={fill(t.worlds.alt, { name })}
                      width={511}
                      height={676}
                      sizes="(max-width: 620px) 70vw, 280px"
                    />
                    <div className="stage-meta">
                      <span>{twoDigits(i + 1)}</span>
                      <div>
                        <h3>{name}</h3>
                        <p>{t.worlds.stages[id].note}</p>
                      </div>
                      <b>{t.worlds.stages[id].surface}</b>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <LandingGarage />
        {/* How to drive first, then the four ways to watch it. */}
        <section id="controls" className="camera-section">
          <LandingControls />
          <LandingCameras />
        </section>

        <section className="feature-strip">
          <div className="content-section feature-grid">
            {t.features.map((f, i) => (
              <div className="feature" key={f.title}>
                <Icon name={FEATURE_ICONS[i]!} w={24} h={24} />
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <span>{t.cta.kicker}</span>
          <h2>
            {t.cta.line1}
            <br />
            {t.cta.line2}
          </h2>
          <p>{t.cta.body}</p>
          <PlayButton large />
        </section>

        <LandingFaq />

        <footer>
          <a href="#top" className="footer-logo" aria-label={t.nav.home}>
            <Icon name="logo-footer.svg" w={120} h={53} />
          </a>
          <p>
            {t.footer.by}{' '}
            <a href={AUTHOR.url} target="_blank" rel="noreferrer">
              {AUTHOR.name}
            </a>
            .
            <span className="footer-legal">
              {fill(m.footer.copyright, { year: new Date().getFullYear() })}
              <span aria-hidden="true"> · </span>
              <a href="/privacy">{m.footer.privacy}</a>
            </span>
          </p>
          <div>
            <a href="#gameplay">{t.nav.gameplay}</a>
            <a href="#worlds">{t.footer.worlds}</a>
            <a href="#controls">{t.nav.controls}</a>
            <a href={PLAY_HREF}>{t.play}</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
