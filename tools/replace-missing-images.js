#!/usr/bin/env node
/*
 * replace-missing-images.js
 *
 * Five photographs were deleted from the old Shopify store while this site
 * still referenced them, so those slots rendered as grey boxes. This maps each
 * dead image to the closest equivalent in the NEW store's catalogue, downloads
 * it locally (same WebP treatment as localize-images.js), and rewrites both the
 * URL and the alt text so the description still matches what is shown.
 *
 *   node tools/replace-missing-images.js --check
 *   node tools/replace-missing-images.js
 *
 * The substitutions are editorial judgements, listed explicitly below so they
 * can be reviewed and swapped rather than being buried in a diff. Replacements
 * are sourced from the new store (.../1/0978/8001/5148/...), so nothing here
 * depends on the old store staying alive.
 *
 * Re-runnable: once a slot no longer references the dead file, it is skipped.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img', 'shopify');
const OUT_REL = 'assets/img/shopify';
const CHECK = process.argv.includes('--check');
const NEW_CDN = 'https://cdn.shopify.com/s/files/1/0978/8001/5148/files';
const SITE_ORIGIN = 'https://hnpbuilding.com';

const MAP = [
  {
    dead: 'privacy_screen.jpg',
    stem: 'allium-bloom-privacy-screen',
    url: `${NEW_CDN}/ChatGPT_Image_Aug_3_2026_07_50_01_PM.png`,
    alt: 'Custom Corten steel Allium Bloom privacy screen with laser-cut floral pattern',
    was: ['Privacy screen', 'Custom Privacy Screens by H&amp;P Building – Premium Decorative Steel Screens, Made in the USA'],
  },
  {
    dead: 'high_resolution_image_1.jpg',
    stem: 'botanical-privacy-panels',
    url: `${NEW_CDN}/ChatGPTImageAug3_2026_08_10_00PM.png`,
    alt: 'Corten steel botanical privacy panels with decorative perforated pattern',
    was: ['Corten steel privacy screens with organic bubble perforation pattern at a residential entry',
          'Custom Privacy Screens by H&amp;P Building – Premium Decorative Steel Screens, Made in the USA'],
  },
  {
    // Metadata only on product-facade-cladding.html — og:image, twitter:image
    // and the JSON-LD Product image. No visible <img>, hence no alt to fix.
    dead: 'high_res_image_1_1.jpg',
    stem: 'architectural-corten-wall-panels',
    url: `${NEW_CDN}/Moderncortensteelpanelinstallation.png`,
    alt: 'Architectural Corten steel wall panels forming a custom feature wall',
    was: [],
  },
  {
    dead: '1496b468-047b-440d-b465-96954cbae64f_040d7d8b-949d-4cf0-b157-b99c5acd0027-removebg-preview.png',
    stem: 'terra-cascade-water-feature',
    url: `${NEW_CDN}/ChatGPT_Image_Aug_5_2026_10_45_35_AM.png`,
    alt: 'Terra Cascade custom Corten steel water feature',
    was: ['Water feature'],
  },
  {
    dead: '1496b468-047b-440d-b465-96954cbae64f_040d7d8b-949d-4cf0-b157-b99c5acd0027.jpg',
    stem: 'three-spout-water-feature',
    url: `${NEW_CDN}/ChatGPT_Image_Aug_5_2026_01_23_02_PM.png`,
    alt: 'Custom Corten steel three-spout architectural water feature',
    was: ['Mystic Flow Water Feature - Contemporary Corten Steel for Serene Outdoor Spaces'],
  },
];

const ACCEPT = 'image/webp,image/avif,image/*,*/*';
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

/* Find every width the dead image is requested at, so the replacement is
 * downloaded at exactly the same set and the existing srcset stays valid. */
function widthsFor(dead) {
  const widths = new Set();
  const esc = dead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`[^"'\\s]*${esc}(\\?[^"'\\s)]*)?`, 'g');
  for (const file of files) {
    const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of s.matchAll(re)) {
      const q = m[1] || '';
      const w = /[?&]width=(\d+)/.exec(q);
      widths.add(w ? w[1] : null);
    }
  }
  return widths;
}

(async () => {
  let totalBytes = 0, wrote = 0;

  for (const entry of MAP) {
    entry.widths = widthsFor(entry.dead);
    entry.local = new Map();

    if (!entry.widths.size) { console.log(`  ${entry.dead}: no longer referenced, skipping`); continue; }

    console.log(`\n${entry.dead}`);
    console.log(`  -> ${path.basename(entry.url)}`);
    console.log(`     widths: ${[...entry.widths].map((w) => w || 'none').join(', ')}`);

    for (const w of entry.widths) {
      const src = w ? `${entry.url}?width=${w}` : entry.url;
      const name = `${entry.stem}${w ? `-${w}w` : ''}.webp`;
      const abs = path.join(OUT_DIR, name);
      entry.local.set(w, `${OUT_REL}/${name}`);

      if (CHECK) continue;
      if (fs.existsSync(abs)) continue;

      const r = await fetch(src, { headers: { Accept: ACCEPT } });
      if (!r.ok) { console.log(`     FAILED ${r.status} at width ${w}`); entry.local.delete(w); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      totalBytes += buf.length;
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(abs, buf);
    }
  }

  if (CHECK) { console.log('\n(--check: nothing downloaded, no files rewritten)'); return; }

  for (const file of files) {
    const full = path.join(ROOT, file);
    let s = fs.readFileSync(full, 'utf8');
    const before = s;

    for (const entry of MAP) {
      if (!entry.local || !entry.local.size) continue;
      const esc = entry.dead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`https://[^"'\\s)]*${esc}(\\?[^"'\\s)]*)?`, 'g');

      s = s.replace(re, (match, query) => {
        const w = /[?&]width=(\d+)/.exec(query || '');
        const local = entry.local.get(w ? w[1] : null);
        // No local file for this width: leave the dead URL so check-images.js
        // keeps reporting it, rather than pointing at a file that isn't there.
        return local || match;
      });

      // Alt text describes the old photograph, so it has to move with it.
      for (const old of entry.was) {
        s = s.split(`alt="${old}"`).join(`alt="${entry.alt}"`);
      }
    }

    /* Same trap localize-images.js documents: a relative path is right for
     * <img> but wrong for og:image, twitter:image and JSON-LD "image", which
     * crawlers resolve with no page context. Re-absolutise those. */
    s = s
      .replace(/(property="og:image" content=")(assets\/)/g, (_, a, b) => `${a}${SITE_ORIGIN}/${b}`)
      .replace(/(name="twitter:image" content=")(assets\/)/g, (_, a, b) => `${a}${SITE_ORIGIN}/${b}`)
      .replace(/("image":")(assets\/)/g, (_, a, b) => `${a}${SITE_ORIGIN}/${b}`);

    if (s !== before) { fs.writeFileSync(full, s); wrote++; }
  }

  console.log(`\ndownloaded: ${(totalBytes / 1048576).toFixed(1)} MB`);
  console.log(`pages rewritten: ${wrote}`);
  console.log(`\nNext: node tools/check-images.js`);
})();
