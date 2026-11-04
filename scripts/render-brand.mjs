// Renders the brand assets in /assets into the files Next's app-router
// metadata conventions pick up: SVG favicon, PNG icon + Apple touch icon
// (180×180), the 512×512 manifest icon, the maskable launcher icons and the
// 1200×630 Open Graph image (social scrapers need raster).
//
// Launcher icons: Android masks installed icons to a circle, squircle or
// rounded square of its own and treats a transparent-cornered PNG as
// artwork to shrink onto a white disc (the "small square in a circle"); iOS
// paints transparent pixels black and rounds the corners itself. So the
// maskable and Apple icons are rendered full-bleed: the favicon's gradient
// covers the whole square and the mark is scaled into the middle (72 % for
// the 80 % safe circle maskable icons ask for; 84 % for iOS, which only
// rounds the corners).
// Re-run with `pnpm brand` whenever the SVGs change.
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'assets');
const app = path.join(root, 'src', 'app');
const icons = path.join(root, 'public', 'icons');

/** Inline the SVG so foreignObject, filters and embedded images all render. */
async function render(page, svg, { width, height, out, transparent }) {
  await page.setViewportSize({ width, height });
  const sized = svg.replace(
    /<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
    `<svg$1 width="${width}" height="${height}"`,
  );
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${sized}</body></html>`,
  );
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: out,
    clip: { x: 0, y: 0, width, height },
    omitBackground: transparent,
  });
  console.log(`wrote ${path.relative(root, out)} (${width}×${height})`);
}

/** The favicon's own gradient, as CSS, for the full-bleed square behind the scaled mark. */
const BLEED_BACKGROUND = 'linear-gradient(142deg, #b5d181 0%, #cca57c 100%)';

/** Full-bleed square: gradient edge to edge, the mark (without its rounded tile) at `scale`. */
async function renderBleed(page, svg, { size, scale, out }) {
  await page.setViewportSize({ width: size, height: size });
  const mark = svg
    .replace(/<rect width="180" height="180" rx="30"[^>]*\/>/, '')
    .replace(
      /<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
      `<svg$1 width="${size * scale}" height="${size * scale}"`,
    );
  await page.setContent(
    `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${BLEED_BACKGROUND}">${mark}</body></html>`,
  );
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(
    `wrote ${path.relative(root, out)} (${size}×${size}, full bleed, mark ${scale * 100}%)`,
  );
}

await mkdir(icons, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const favicon = await readFile(path.join(assets, 'favicon.svg'), 'utf8');
const og = await readFile(path.join(assets, 'og-image.svg'), 'utf8');

await copyFile(path.join(assets, 'favicon.svg'), path.join(app, 'icon0.svg'));
console.log('copied assets/favicon.svg → src/app/icon0.svg');
await render(page, favicon, {
  width: 192,
  height: 192,
  out: path.join(app, 'icon1.png'),
  transparent: true,
});
await renderBleed(page, favicon, { size: 180, scale: 0.84, out: path.join(app, 'apple-icon.png') });
await renderBleed(page, favicon, {
  size: 192,
  scale: 0.72,
  out: path.join(icons, 'maskable-192.png'),
});
await renderBleed(page, favicon, {
  size: 512,
  scale: 0.72,
  out: path.join(icons, 'maskable-512.png'),
});
await render(page, favicon, {
  width: 512,
  height: 512,
  out: path.join(app, 'icon2.png'),
  transparent: true,
});
await render(page, og, {
  width: 1200,
  height: 630,
  out: path.join(app, 'opengraph-image.png'),
  transparent: false,
});
await browser.close();
