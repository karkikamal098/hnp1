#!/usr/bin/env node
/*
 * sync-catalogue.js
 *
 * Pulls the live, public product feed from hnpbuilding.com and drops a
 * "Featured designs" showcase into each product-system page that has real,
 * off-the-shelf SKUs behind it (Screens, Water, Fire, Planters, Edging,
 * Sculpture). Facade & Cladding, Railings & Guardrails, Stair Railings and
 * Custom Fabrication are bespoke/quote-only and are left untouched.
 *
 * Deliberately no cart, no checkout, no Shopify buy links: every card routes
 * to this site's own RFQ form (contact.html) with the project name and
 * material pre-filled via query string — one conversion path, not two.
 *
 * No credentials required — /products.json is Shopify's public storefront
 * feed, the same one every visitor's browser can already fetch.
 *
 *   node tools/sync-catalogue.js            # fetch + wire
 *   node tools/sync-catalogue.js --check    # report only, change nothing
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const FEED = 'https://hnpbuilding.com/products.json?limit=250';
const CHECK = process.argv.includes('--check');

/*
 * A product is classified ONCE, by the first rule it matches in this priority
 * order — not independently tested against every page. Without that, a title
 * like "Modern Corten Steel Fountain – Sculptural Outdoor Water Feature" would
 * match both the water-feature and the sculpture regex (the word "Sculptural"
 * is just a marketing adjective there) and could land on the wrong page
 * depending on which page's script ran first. Ordering water/fire/stair ahead
 * of sculpture means the specific, structural word wins over a stray adjective.
 */
const RULES = [
  ['water',     /(water|fountain|cascade|basin|reflect|falls|stream|pond)/i],
  ['fire',      /(fire ?pit|firepit|fireplace|fire bowl|fire table|vulcano)/i],
  ['stair',     /(stair|riser|tread|balustrade)/i],
  ['planter',   /(planter|tree grate|tree guard|trellis|raised bed)/i],
  ['edging',    /(edging|lawn edg|garden steps|border)/i],
  ['sculpture', /(sculpt|horse|mustang|garden ring|wall art|memorial)/i],
  ['screen',    /(screen|privacy|panel|cladding|facade)/i],
];
const classify = (title) => (RULES.find(([, re]) => re.test(title)) || [null])[0];

/* page -> { sheet ref prefix, category, material label } */
const PAGES = {
  'product-privacy-screens.html':      { sref: 'B.01', cat: 'screen', material: 'Not sure — advise me' },
  'product-water-features.html':       { sref: 'B.05', cat: 'water', material: 'Corten Steel' },
  'product-fire-features.html':        { sref: 'B.06', cat: 'fire', material: 'Corten Steel' },
  'product-planters.html':             { sref: 'B.07', cat: 'planter', material: 'Corten Steel' },
  'product-edging-furnishings.html':   { sref: 'B.08', cat: 'edging', material: 'Corten Steel' },
  'product-sculpture-structures.html': { sref: 'B.09', cat: 'sculpture', material: 'Not sure — advise me' },
};
const COUNT = 3;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const money = (n) => '$' + Math.round(+n).toLocaleString('en-US');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const cleanTitle = (t) => t.replace(/[🌿🔥™]/g, '').replace(/\s*[|–-]\s*(Made in the USA|Custom.*)$/i, '')
  .replace(/\s+/g, ' ').trim();

(async () => {
  console.log('fetching ' + FEED);
  const feed = await fetchJSON(FEED);
  const products = feed.products || [];
  console.log('live products: ' + products.length);

  // classify once, up front, so every product has exactly one category
  const byCat = {};
  for (const p of products) {
    const c = classify(p.title);
    if (c) (byCat[c] = byCat[c] || []).push(p);
  }

  let sectionsWritten = 0;
  for (const [file, spec] of Object.entries(PAGES)) {
    const matches = (byCat[spec.cat] || []).filter((p) => p.images.length && p.variants.some(v => v.available));
    if (!matches.length) { console.log(`  ${file}: no live matches, skipping`); continue; }

    // prefer variety: cheapest, a mid-range, and the most recently updated
    const byPrice = [...matches].sort((a, b) => +a.variants[0].price - +b.variants[0].price);
    const chosen = [
      byPrice[0],
      byPrice[Math.floor(byPrice.length / 2)],
      [...matches].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0],
    ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, COUNT);

    console.log(`  ${file}: ${matches.length} live matches, featuring ${chosen.map(p => p.handle).join(', ')}`);
    if (CHECK) continue;

    const cards = chosen.map((p) => {
      const title = cleanTitle(p.title);
      const price = p.variants[0].price;
      const img = p.images[0].src.split('?')[0];
      const alt = esc(title);
      const href = 'contact.html?project=' + encodeURIComponent(title)
        + '&material=' + encodeURIComponent(spec.material);
      return `<article class="cap span-4" data-reveal><a href="${href}">`
        + `<div class="ph has-img"><img src="${img}?width=1100" `
        + `srcset="${img}?width=400 400w, ${img}?width=800 800w, ${img}?width=1100 1100w" `
        + `sizes="(max-width:860px) 94vw, 32vw" width="${p.images[0].width}" height="${p.images[0].height}" `
        + `alt="${alt}" loading="lazy" decoding="async"><span class="corner">${money(price)}</span></div>`
        + `<div class="cbody"><div class="cref">From our current range</div><h3>${esc(title)}</h3>`
        + `<p>Request this design as shown, or specify your own dimensions and finish.</p></div></a></article>`;
    }).join('');

    const section = `
<section class="section" style="background:var(--paper-2);border-block:1px solid var(--line)">
  <div class="wrap">
    <div class="sheet-head" data-reveal><div class="sref">${spec.sref}·D —<br>Designs</div><div class="st"><span class="eyebrow">From our current range</span><h2 class="h-lg">Featured designs.</h2><p class="lede" style="margin-top:1rem">A sample of what we've built recently in this system. Every design shown is available as-is or as a starting point for your own — request the one you like and we'll quote it to your dimensions and finish.</p></div></div>
    <div class="cap-grid" style="margin-top:2.5rem">${cards}</div>
  </div>
</section>
<!-- SYNC:CATALOGUE:END -->
`;

    const p = path.join(ROOT, file);
    let s = fs.readFileSync(p, 'utf8');
    // re-runnable: replace a previous sync block if present, else insert
    // right after the "Key features" section (before "Related products").
    // IMPORTANT: `section` contains real dollar prices (e.g. "$18,900"). When a
    // string is passed as the second argument to String.replace(), any "$" in
    // it is parsed as backreference syntax ($1, $2, $&, ...) — so "$18,900"
    // silently became "<capture group 1>8,900" the first time this ran. Using
    // a function replacer instead means the replacement text is inserted
    // literally, with no special handling of "$".
    if (s.includes('<!-- SYNC:CATALOGUE:END -->')) {
      s = s.replace(/\n<section class="section" style="background:var\(--paper-2\)[\s\S]*?<!-- SYNC:CATALOGUE:END -->\n/, () => section);
    } else {
      const marker = /(<\/section>\s*\n)(<section class="section">\s*\n\s*<div class="wrap">\s*\n\s*<div class="sheet-head" data-reveal><div class="sref">B\.\d+·R)/;
      if (!marker.test(s)) { console.log(`    could not find insertion point in ${file}`); continue; }
      s = s.replace(marker, (_, g1, g2) => g1 + section + g2);
    }
    // guard against this exact class of bug recurring silently
    if (!s.includes(section.trim().slice(0, 60))) {
      console.log(`    WARNING: ${file} does not contain the expected section after write — check manually`);
    }
    fs.writeFileSync(p, s);
    sectionsWritten++;
  }
  console.log(CHECK ? '\n(--check: no files written)' : `\nsections written: ${sectionsWritten}`);
})().catch((e) => { console.error('sync failed:', e.message); process.exit(1); });
