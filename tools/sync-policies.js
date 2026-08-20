#!/usr/bin/env node
/*
 * sync-policies.js
 *
 * The legal pages on this site must carry the policy text from the Shopify
 * store WORD FOR WORD (decided 2026-08-20 — legal requirement). This script
 * fetches the live policies from the store's permanent domain
 * (j1rk0j-9d.myshopify.com — survives the apex cutover to Vercel), strips all
 * Shopify markup/CSS, and splices the verbatim text into this site's design
 * shell (between the `legal-toc` nav and the closing `section.band`).
 *
 * Only the words are copied. Heading TAGS are normalized to this site's
 * structure (the store uses <h1> for ToS sections and bold paragraphs for
 * shipping headings) — tags change, words never do. A page is only written
 * after verifying that every line of the fetched policy text appears in the
 * generated page; if verification fails, the page is left untouched and the
 * script exits non-zero so CI flags it instead of publishing a partial copy.
 *
 *   node tools/sync-policies.js            # fetch + write changed pages
 *   node tools/sync-policies.js --check    # report only, change nothing
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://j1rk0j-9d.myshopify.com';
const CHECK = process.argv.includes('--check');

const POLICIES = [
  { url: '/policies/privacy-policy', page: 'privacy-policy.html' },
  { url: '/policies/refund-policy', page: 'refund-policy.html' },
  { url: '/policies/shipping-policy', page: 'shipping-policy.html', transform: 'strongHeadings', dropLeadTitle: 'Shipping Policy' },
  { url: '/policies/terms-of-service', page: 'terms-of-service.html', transform: 'h1Headings' },
  { url: '/policies/legal-notice', page: 'legal-notice.html' },
  { url: '/pages/data-sharing-opt-out', page: 'data-sharing-opt-out.html', appendOptOutCallout: true },
];

function fetchHTML(url, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && hops < 5) {
        res.resume();
        const next = res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location;
        return resolve(fetchHTML(next, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' for ' + url)); }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const slug = (s) => decode(s).replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 50);

/* pull the policy body out of the Shopify page and strip everything that is
 * not the text itself: theme classes, editor artifacts, widgets, scripts */
function extractBody(html) {
  const m = html.match(/<div class="shopify-policy__body">([\s\S]*?)<\/div>\s*<\/div>/)
        || html.match(/<div class="page rte[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)
        || html.match(/<div class="rte">([\s\S]*?)<\/div>/);
  if (!m) return null;
  let b = m[1];
  b = b.replace(/^\s*<div class="rte">\s*/, '');
  b = b.replace(/<span class="[^"]*selectionAnchor[^"]*"><\/span>/g, '');
  b = b.replace(/ class="[A-Za-z0-9]+_selectionAnchorContainer"/g, '');
  b = b.replace(/ class="PDq2pG_[^"]*"/g, '');
  b = b.replace(/\?utm_source=[a-z.]+/g, '');
  b = b.replace(/<meta charset="utf-8">\s*/g, '');
  b = b.replace(/<link rel="stylesheet"[^>]*>\s*/g, '');
  b = b.replace(/<div id="pc--optOutFormContainer"[\s\S]*?\/>/g, '');
  b = b.replace(/<script[\s\S]*?<\/script>\s*/g, '');
  b = b.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, ''); // page <h1> carries the title
  // Shopify editor artifact: anchors with no href (e.g. around email addresses)
  // — unwrap them so the text stays but no dead link is rendered
  b = b.replace(/<a (?![^>]*href=)[^>]*>([\s\S]*?)<\/a>/g, '$1');
  return b.trim();
}

/* wrap the verbatim text into this site's <section id> structure + TOC */
function sectionize(body) {
  const parts = body.split(/(?=<h2)/);
  const toc = [];
  const out = [];
  parts.forEach((chunk, i) => {
    chunk = chunk.trim();
    if (!chunk) return;
    const h2 = chunk.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (h2) {
      const id = slug(h2[1]) || 's' + i;
      toc.push({ id, label: h2[1].replace(/<[^>]+>/g, '').trim() });
      out.push(`<section id="${id}">\n${chunk}\n</section>`);
    } else {
      out.push(`<section id="${i === 0 ? 'intro' : 's' + i}">\n${chunk}\n</section>`);
    }
  });
  const nav = toc.length >= 3
    ? `<nav class="legal-toc" aria-label="On this page">\n  <h2>On this page</h2>\n  <ol>${toc.map((t) => `<li><a href="#${t.id}">${t.label}</a></li>`).join('')}</ol>\n</nav>\n\n`
    : '';
  return nav + out.join('\n\n');
}

/* verification: every text line of the fetched policy must appear verbatim
 * (after whitespace/entity normalization) in the generated page */
const norm = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|’/g, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|[“”]/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/[–—]/g, '-').replace(/\s+/g, ' ').toLowerCase();
const toText = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n');
function verify(sourceBody, pageHtml) {
  const pageTxt = norm(toText(pageHtml).replace(/\n/g, ' '));
  const lines = toText(sourceBody).split('\n').map((l) => norm(l.trim())).filter((l) => l.length > 10);
  return lines.filter((l) => !pageTxt.includes(l));
}

(async () => {
  let failures = 0;
  let written = 0;
  for (const spec of POLICIES) {
    const label = spec.page;
    let html;
    try { html = await fetchHTML(BASE + spec.url); }
    catch (e) { console.log(`  ${label}: FETCH FAILED (${e.message}) — left untouched`); failures++; continue; }

    let body = extractBody(html);
    if (!body || body.length < 200) { console.log(`  ${label}: no policy body found — left untouched`); failures++; continue; }

    if (spec.dropLeadTitle) {
      body = body.replace(new RegExp(`^<p[^>]*><strong>${spec.dropLeadTitle}<\\/strong>\\s*<\\/p>\\s*`), '');
    }
    // heading TAG normalization only — the words inside are untouched
    if (spec.transform === 'h1Headings') {
      body = body.replace(/<h1[^>]*>/g, '<h2>').replace(/<\/h1>/g, '</h2>');
    }
    if (spec.transform === 'strongHeadings') {
      body = body.replace(/<p[^>]*><strong>((?:(?!Effective Date)[^<]){3,80})<\/strong><\/p>/g, '<h2>$1</h2>');
    }

    let inner = sectionize(body);
    if (spec.appendOptOutCallout) {
      inner += '\n\n<section id="how-to-opt-out">\n<div class="callout"><p>To submit an opt-out request for your browser or your customer account, use the <a href="' + BASE + '/pages/data-sharing-opt-out" rel="noopener">opt-out form on our online store</a>, or email <a href="mailto:Info@hnpbuilding.com">Info@hnpbuilding.com</a> with your request. If your browser sends a Global Privacy Control signal, we treat it as a valid opt-out request automatically.</p></div>\n</section>';
    }

    const p = path.join(ROOT, spec.page);
    const current = fs.readFileSync(p, 'utf8');
    // pages with a TOC start the replaceable zone at the nav; short pages
    // (no TOC) start it at the first content <section> inside div.legal
    let navIdx = current.indexOf('<nav class="legal-toc"');
    if (navIdx < 0) {
      const legalIdx = current.indexOf('<div class="legal"');
      if (legalIdx >= 0) navIdx = current.indexOf('<section id=', legalIdx);
    }
    const tailM = current.match(/\r?\n    <\/div>\r?\n  <\/div>\r?\n<\/section>\r?\n\r?\n<section class="band">/);
    if (navIdx < 0 || !tailM || tailM.index < navIdx) { console.log(`  ${label}: splice markers not found — left untouched`); failures++; continue; }

    const next = current.slice(0, navIdx) + inner + current.slice(tailM.index);
    const missing = verify(body, next);
    if (missing.length) {
      console.log(`  ${label}: VERIFICATION FAILED — ${missing.length} line(s) would be lost; left untouched`);
      missing.slice(0, 3).forEach((l) => console.log('      ' + l.slice(0, 100)));
      failures++;
      continue;
    }

    if (next === current) { console.log(`  ${label}: up to date`); continue; }
    if (CHECK) { console.log(`  ${label}: CHANGED (would update)`); written++; continue; }
    fs.writeFileSync(p, next);
    console.log(`  ${label}: updated`);
    written++;
  }
  console.log(CHECK ? `\n(--check: ${written} page(s) out of date, nothing written)` : `\npages written: ${written}`);
  if (failures) { console.error(`\n${failures} page(s) could not be synced — manual review needed`); process.exit(1); }
})().catch((e) => { console.error('sync failed:', e.message); process.exit(1); });
