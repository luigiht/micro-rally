// Renders the brand assets in /assets into the files Next's app-router
// metadata conventions pick up: SVG favicon, PNG icon + Apple touch icon
// (180×180), the 512×512 manifest icon and the 1200×630 Open Graph image
// (social scrapers need raster).
// Re-run with `pnpm brand` whenever the SVGs change.
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'assets');
const app = path.join(root, 'src', 'app');

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
await render(page, favicon, {
  width: 180,
  height: 180,
  out: path.join(app, 'apple-icon.png'),
  transparent: true,
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
