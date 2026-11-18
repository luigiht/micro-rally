import type { Metadata } from 'next';
import { Fugaz_One } from 'next/font/google';
import localFont from 'next/font/local';
import { LandingPage } from '@/components/landing/LandingPage';
import { en } from '@/i18n/messages/en';
import '@/components/landing/landing.css';

/**
 * The design's display face, self-hosted by next/font at build time (Figma's
 * font server is not used). DM Sans, its body face, comes from the root
 * layout, which the whole game shares.
 */
const display = Fugaz_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--landing-display',
});

/**
 * The headings' pixel face: CS Matbold Pixel (demo), © Craft Supply Co. Its
 * demo covers only A–Z, a–z and space; the rest falls back to Fugaz One.
 */
const pixel = localFont({
  src: '../components/landing/fonts/cs-matbold-pixel-demo.otf',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--landing-pixel',
  // No generated Arial stand-in: missing glyphs should fall through to Fugaz One.
  adjustFontFallback: false,
});

/** The site's front page; Play, and the installed app, go to the game at `/game`. */
export const metadata: Metadata = {
  title: { absolute: en.landing.title },
  description: en.landing.description,
  alternates: { canonical: '/' },
};

/**
 * Launched from a home screen, go straight to the game: installs made before
 * the game moved to `/game` still start at `/`, and some browsers keep the
 * page they were added from. Inline and first in the body, so it runs before
 * the page paints.
 */
const STANDALONE_TO_GAME = `if(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true)location.replace('/game'+location.search+location.hash)`;

export default function Landing() {
  return (
    <div className={`${display.variable} ${pixel.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: STANDALONE_TO_GAME }} />
      <LandingPage />
    </div>
  );
}
