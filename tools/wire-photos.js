#!/usr/bin/env node
/*
 * wire-photos.js
 *
 * Takes the project photography dropped into assets/img/source/, generates
 * responsive WebP variants, and swaps them into the slots that currently show
 * Shopify product shots standing in for commercial work.
 *
 *   node tools/wire-photos.js            # process + wire
 *   node tools/wire-photos.js --check    # report what's present, change nothing
 *
 * Resizing runs through headless Chromium (already used elsewhere in this
 * project) so there is no native image dependency to install.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'img', 'source');
const OUT = path.join(ROOT, 'assets', 'img');
const WIDTHS = [400, 800, 1200, 1600, 2000];
const QUALITY = 0.82;
const CHECK = process.argv.includes('--check');

/* ---------------------------------------------------------------- slot map */
// name -> { alt, slots: [ [file, matcher, sizes] ] }
// `matcher` is the caption text currently in the slot, which uniquely
// identifies it within the page.
const PHOTOS = {
  'commercial-facade-seam': {
    alt: 'Standing-seam metal facade with perforated and bronze accent panels on a four-storey mixed-use building',
    slots: [
      ['product-facade-cladding.html', null, '(max-width:860px) 94vw, 52vw'],
      ['industry-commercial-developers.html', null, '(max-width:860px) 94vw, 48vw'],
      ['index.html', 'Facade &amp; Cladding', '(max-width:860px) 94vw, 58vw'],
    ],
  },
  'stainless-glass-balustrade': {
    alt: 'Stainless steel and glass balustrade on a rooftop terrace overlooking a coastal city at dusk',
    slots: [
      ['product-railings-guardrails.html', null, '(max-width:860px) 94vw, 52vw'],
      ['product-stair-railings.html', null, '(max-width:860px) 94vw, 52vw'],
      ['industry-hospitality.html', null, '(max-width:860px) 94vw, 48vw'],
      ['index.html', 'Stainless stair', '(max-width:860px) 94vw, 42vw'],
    ],
  },
  'corten-perforated-balconies': {
    alt: 'Corten steel laser-cut balcony screens on a mixed-use building at dusk, warm interior light behind the perforation',
    slots: [
      ['index.html', 'Corten privacy screen · laser-cut juniper', '100vw'],   // home hero
      ['product-privacy-screens.html', null, '(max-width:860px) 94vw, 52vw'],
      ['architects.html', 'Corten screen · laser-cut elevation', '(max-width:860px) 94vw, 48vw'],
    ],
  },
  'corten-clad-midrise': {
    alt: 'Weathered Corten steel cladding volumes on a mid-rise building with glass balconies in an urban street',
    slots: [
      ['industry-architects-builders.html', null, '(max-width:860px) 94vw, 48vw'],
      ['materials.html', 'Corten · weathered patina', '(max-width:860px) 94vw, 48vw'],
      ['projects.html', 'Corten water feature · terrace', '(max-width:860px) 94vw, 48vw'],
    ],
  },
};

const EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const findSource = (name) => {
  for (const e of EXT) {
    const p = path.join(SRC, name + e);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

/* ------------------------------------------------------------------ report */
const present = [], missing = [];
for (const name of Object.keys(PHOTOS)) (findSource(name) ? present : missing).push(name);

console.log(`source dir: ${path.relative(ROOT, SRC)}`);
present.forEach(n => console.log(`  found    ${n}`));
missing.forEach(n => console.log(`  MISSING  ${n}`));
if (CHECK || !present.length) {
  if (!present.length) console.log('\nNothing to do — drop the files in and re-run. See assets/img/README.md');
  process.exit(0);
}

/* --------------------------------------------------------------- resizing */
async function generate(names) {
  const { chromium } = require('playwright-core');
  // serve the source dir so canvas isn't tainted by file:// origin rules
  const server = http.createServer((req, res) => {
    const f = path.join(SRC, decodeURIComponent(req.url.slice(1)));
    if (!f.startsWith(SRC) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const page = await browser.newPage();
  const made = {};

  for (const name of names) {
    const src = findSource(name);
    const url = `http://127.0.0.1:${port}/${path.basename(src)}`;
    const variants = await page.evaluate(async ({ url, widths, q }) => {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
      });
      const out = [];
      for (const w of widths) {
        if (w > img.naturalWidth) continue;
        const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, w, h);
        out.push({ w, h, data: c.toDataURL('image/webp', q) });
      }
      return { natural: [img.naturalWidth, img.naturalHeight], out };
    }, { url, widths: WIDTHS, q: QUALITY });

    made[name] = { natural: variants.natural, files: [] };
    for (const v of variants.out) {
      const file = `${name}-${v.w}.webp`;
      fs.writeFileSync(path.join(OUT, file), Buffer.from(v.data.split(',')[1], 'base64'));
      made[name].files.push({ file, w: v.w, h: v.h });
      console.log(`  wrote assets/img/${file.padEnd(44)} ${Math.round(fs.statSync(path.join(OUT, file)).size / 1024)} KB`);
    }
  }
  await browser.close();
  server.close();
  return made;
}

/* ---------------------------------------------------------------- wiring */
function wire(made) {
  let swapped = 0, notFound = [];
  for (const [name, spec] of Object.entries(PHOTOS)) {
    const m = made[name];
    if (!m || !m.files.length) continue;
    const biggest = m.files[m.files.length - 1];
    const srcset = m.files.map(f => `assets/img/${f.file} ${f.w}w`).join(', ');
    const alt = spec.alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    for (const [file, matcher, sizes] of spec.slots) {
      const p = path.join(ROOT, file);
      if (!fs.existsSync(p)) { notFound.push(`${file} (no such page)`); continue; }
      let s = fs.readFileSync(p, 'utf8');

      // locate the target .ph block: the one carrying `matcher`, else the first
      const re = matcher
        ? new RegExp('(<div class="ph[^"]*has-img"[^>]*>)<img [^>]*>([\\s\\S]{0,400}?' +
            matcher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')')
        : /(<div class="ph[^"]*has-img"[^>]*>)<img [^>]*>()/;
      if (!re.test(s)) { notFound.push(`${file} :: ${matcher || 'first slot'}`); continue; }

      const eager = sizes === '100vw' || /pd-media|pgh|hero/.test(s.slice(0, s.search(re)).slice(-400));
      s = s.replace(re, (_, open, tail) =>
        open + `<img src="assets/img/${biggest.file}" srcset="${srcset}" sizes="${sizes}"`
        + ` width="${biggest.w}" height="${biggest.h}" alt="${alt}"`
        + (eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"')
        + ' decoding="async">' + tail);
      fs.writeFileSync(p, s);
      swapped++;
      console.log(`  wired ${file} ${matcher ? ':: ' + matcher : ''}`);
    }
  }
  console.log(`\nslots wired: ${swapped}`);
  if (notFound.length) {
    console.log('could not locate:');
    notFound.forEach(x => console.log('   ' + x));
  }
}

(async () => {
  console.log('\ngenerating responsive variants…');
  const made = await generate(present);
  console.log('\nwiring slots…');
  wire(made);
  console.log('\nDone. Re-run your audit to confirm.');
})();
