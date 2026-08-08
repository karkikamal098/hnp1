#!/usr/bin/env node
/*
 * localize-images.js
 *
 * Downloads every Shopify-hosted image this site hot-links and rewrites the
 * markup to point at local copies under assets/img/shopify/.
 *
 *   node tools/localize-images.js --check   # report what would happen, download nothing
 *   node tools/localize-images.js           # download + rewrite
 *
 * Why this has to happen before the domain moves:
 *
 *   - ~321 references are https://hnpbuilding.com/cdn/shop/files/... — a
 *     DOMAIN-scoped path. The moment hnpbuilding.com points at Vercel (or at
 *     the new store), those resolve somewhere the file does not exist. The
 *     site logo is in this group, so it breaks on every page at once.
 *   - ~860 references are https://cdn.shopify.com/s/files/1/0580/4032/0129/...
 *     — that numeric segment is the OLD store's id. They keep working only
 *     while the old store stays open, and die permanently when it closes.
 *
 * Neither failure raises an error. Pages just render grey rectangles.
 *
 * Widths are preserved: the markup uses Shopify's ?width=N to build srcsets,
 * so each referenced width is downloaded as its own file and the srcset is
 * rewritten to match. Responsive behaviour is unchanged.
 *
 * Re-runnable: URLs already rewritten to assets/ are ignored, and files
 * already on disk are not re-downloaded.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img', 'shopify');
const OUT_REL = 'assets/img/shopify';
const CHECK = process.argv.includes('--check');
const CONCURRENCY = 8;

/* Social-card and schema.org image fields are read by crawlers that have no
 * page context, so a relative path resolves to nothing and the preview image
 * silently disappears. They must stay absolute. Matches the origin already
 * used by every canonical tag in the site. */
const SITE_ORIGIN = 'https://hnpbuilding.com';

/* Matches the full URL *including* query string, because the query is what
 * carries the width — and because replacing the exact string found in the
 * markup avoids having to parse srcset syntax at all. */
/* heic/heif are in here deliberately: the store contains straight-from-phone
 * uploads, browsers largely cannot render HEIC, and it only works today
 * because Shopify transcodes on the fly. Localising them as WebP removes both
 * the hotlink and the format problem. */
const REMOTE = /https:\/\/(?:cdn\.shopify\.com|hnpbuilding\.com)\/[^"'\s)]+?\.(?:png|jpe?g|webp|gif|heic|heif|avif)(?:\?[^"'\s)]*)?/gi;

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

/* full URL string -> { local, width, pages } */
const refs = new Map();

for (const file of files) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of s.matchAll(REMOTE)) {
    const url = m[0];
    if (!refs.has(url)) refs.set(url, { pages: new Set() });
    refs.get(url).pages.add(file);
  }
}

/* Two different widths of one image are two different files, so the width has
 * to be part of the name. Everything else in the query (Shopify's ?v= cache
 * buster) is irrelevant once the file is local and is dropped. */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const used = new Set();
for (const [url, info] of refs) {
  const u = new URL(url);
  const width = u.searchParams.get('width');
  const base = path.basename(u.pathname);
  const ext = path.extname(base) || '.png';
  let stem = slug(base.slice(0, -ext.length)) + (width ? `-${width}w` : '');

  /* Distinct source paths can share a basename. Suffix until unique so one
   * image never silently overwrites another. */
  let n = 2;
  while (used.has(stem)) stem = `${stem}-${n++}`;
  used.add(stem);

  info.stem = stem;
  info.width = width;
}

/* Shopify's CDN content-negotiates: ask for WebP and it transcodes on the fly.
 * Measured on this store's assets that is a ~90% saving (a 1.07 MB PNG comes
 * back as 92 KB), which is the difference between a ~350 MB repo and a ~30 MB
 * one. It also matches the .webp convention wire-photos.js already uses. */
const ACCEPT = 'image/webp,image/avif,image/*,*/*';
const extFor = (contentType, url) => {
  if (/webp/i.test(contentType || '')) return '.webp';
  return path.extname(new URL(url).pathname) || '.png';
};

(async () => {
  const queue = [...refs.entries()];
  const total = queue.length;
  const failed = [];
  let downloaded = 0, skipped = 0, bytes = 0;

  async function worker() {
    while (queue.length) {
      const [url, info] = queue.pop();

      /* The extension depends on what the CDN actually returns, so resolve the
       * local path against both candidates before deciding to skip. */
      const existing = ['.webp', path.extname(new URL(url).pathname) || '.png']
        .map((e) => path.join(OUT_DIR, info.stem + e))
        .find((p) => fs.existsSync(p));
      if (!CHECK && existing) {
        info.abs = existing;
        info.local = `${OUT_REL}/${path.basename(existing)}`;
        skipped++;
        continue;
      }

      try {
        const r = await fetch(url, { headers: { Accept: ACCEPT } });
        if (!r.ok) { failed.push([r.status, url, info.pages]); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        const name = info.stem + extFor(r.headers.get('content-type'), url);
        info.abs = path.join(OUT_DIR, name);
        info.local = `${OUT_REL}/${name}`;
        bytes += buf.length;
        if (!CHECK) fs.writeFileSync(info.abs, buf);
        downloaded++;
      } catch (e) {
        failed.push(['ERR', url, info.pages]);
      }
    }
  }

  if (!CHECK) fs.mkdirSync(OUT_DIR, { recursive: true });

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const mb = (bytes / 1048576).toFixed(1);
  console.log(`\nreferences found : ${total}`);
  console.log(`fetched          : ${downloaded}  (${mb} MB)`);
  if (skipped) console.log(`already on disk  : ${skipped}`);

  if (failed.length) {
    console.log(`\nCOULD NOT FETCH (${failed.length}) — left pointing at the remote URL so`);
    console.log(`tools/check-images.js keeps flagging them. These need a replacement photo:`);
    for (const [status, url, pages] of failed) {
      console.log(`  ${status}  ${url}`);
      console.log(`        on: ${[...pages].join(', ')}`);
    }
  }

  if (CHECK) {
    console.log('\n(--check: nothing downloaded, no files rewritten)');
    return;
  }

  /* Rewrite only URLs whose file actually landed on disk — a failed download
   * must not leave markup pointing at a local path that does not exist, which
   * would turn a detectable remote 404 into a silent local one. */
  let pagesChanged = 0;
  for (const file of files) {
    const full = path.join(ROOT, file);
    let s = fs.readFileSync(full, 'utf8');
    const before = s;

    for (const [url, info] of refs) {
      if (!info.abs || !fs.existsSync(info.abs)) continue;
      // split/join, not replace(): the replacement is a literal path and must
      // never be interpreted as $-backreference syntax.
      s = s.split(url).join(info.local);
    }

    /* Re-absolutise the crawler-facing image fields. The rewrite above is
     * correct for <img> (relative paths resolve against the page) but wrong
     * for og:image, twitter:image and JSON-LD "image", which are read out of
     * context by Facebook, LinkedIn, X and Google. */
    s = s
      .replace(/(property="og:image" content=")(assets\/)/g, (_, a, b) => `${a}${SITE_ORIGIN}/${b}`)
      .replace(/(name="twitter:image" content=")(assets\/)/g, (_, a, b) => `${a}${SITE_ORIGIN}/${b}`)
      .replace(/("image":")(assets\/)/g, (_, a, b) => `${a}${SITE_ORIGIN}/${b}`);

    if (s !== before) { fs.writeFileSync(full, s); pagesChanged++; }
  }

  console.log(`\npages rewritten  : ${pagesChanged}`);
  console.log(`\nNext: node tools/check-images.js`);
})();
