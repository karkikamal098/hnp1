#!/usr/bin/env node
/*
 * check-images.js
 *
 * Every image on this site is either a local file under assets/img/ or a
 * hot-link into the Shopify store's CDN. The hot-links are the fragile half:
 * the store is edited by other people, and deleting a file there breaks pages
 * here silently — no error, no build failure, just a grey rectangle nobody
 * notices until they scroll past it. This checks them all in one pass.
 *
 *   node tools/check-images.js           # report broken images, exit 1 if any
 *   node tools/check-images.js --all     # also list the images that are fine
 *
 * Worth running before any deploy, and especially before the domain moves to
 * a different store — at that point every hnpbuilding.com/cdn/... reference
 * starts resolving against the new store, where those files do not exist.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOW_ALL = process.argv.includes('--all');
const CONCURRENCY = 12;

/* src, srcset and CSS url() all carry image references, so match the URLs
 * themselves rather than trying to parse attributes. */
const REMOTE = /https:\/\/(?:cdn\.shopify\.com|hnpbuilding\.com)\/[^"'\s)]+?\.(?:png|jpe?g|webp|gif|svg|heic|heif|avif)(?:\?[^"'\s)]*)?/gi;
const LOCAL = /(?:src|href)="(assets\/img\/[^"]+)"|(assets\/img\/[^"\s,]+\.(?:webp|png|jpe?g|svg))/gi;

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

/* url -> Set of pages referencing it. Deduped because the same image appears
 * many times over (srcset variants, repeated header/footer chrome). */
const remote = new Map();
const local = new Map();
const add = (map, key, file) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(file);
};

/* og:image and friends must be absolute, so our own assets appear as
 * https://hnpbuilding.com/assets/... . Those are this repo's files expressed
 * absolutely — check them on disk, not over HTTP. Fetching them would report
 * 404 until the domain points at Vercel, burying real breakage in noise. */
const OWN_ABSOLUTE = /^https:\/\/hnpbuilding\.com\/(assets\/.+)$/;

for (const file of files) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of s.matchAll(REMOTE)) {
    const url = m[0].split('?')[0];
    const own = url.match(OWN_ABSOLUTE);
    if (own) add(local, own[1], file);
    else add(remote, url, file);
  }
  for (const m of s.matchAll(LOCAL)) add(local, m[1] || m[2], file);
}

// Local files need no network round-trip — just check they exist on disk.
const brokenLocal = [...local.keys()].filter((p) => !fs.existsSync(path.join(ROOT, p)));

(async () => {
  const queue = [...remote.keys()];
  const total = queue.length;
  const brokenRemote = [];

  async function worker() {
    while (queue.length) {
      const url = queue.pop();
      try {
        const r = await fetch(url, { method: 'HEAD' });
        if (!r.ok) brokenRemote.push([r.status, url]);
        else if (SHOW_ALL) console.log(`  ok   ${url}`);
      } catch (e) {
        // Network failure is not the same as a missing image; label it so a
        // flaky connection is not mistaken for a deleted file.
        brokenRemote.push(['ERR', url]);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nremote images checked: ${total}   local images: ${local.size}`);

  if (brokenLocal.length) {
    console.log(`\nMISSING LOCAL FILES (${brokenLocal.length}):`);
    for (const p of brokenLocal.sort()) {
      console.log(`  ${p}\n      referenced by: ${[...local.get(p)].join(', ')}`);
    }
  }

  if (brokenRemote.length) {
    console.log(`\nBROKEN REMOTE IMAGES (${brokenRemote.length}):`);
    for (const [status, url] of brokenRemote.sort((a, b) => String(a[1]).localeCompare(b[1]))) {
      console.log(`  ${status}  ${url}\n      referenced by: ${[...remote.get(url)].join(', ')}`);
    }
  }

  const bad = brokenLocal.length + brokenRemote.length;
  console.log(bad ? `\n${bad} broken image(s).` : '\nAll images resolve.');
  if (bad) process.exitCode = 1;
})();
