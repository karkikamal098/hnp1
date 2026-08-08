#!/usr/bin/env node
/*
 * add-portal-link.js
 *
 * Adds the "Client login" link that points at the Shopify customer account
 * portal (hnpbuilding.com/account) into the topbar and the footer contact
 * column of every page.
 *
 *   node tools/add-portal-link.js            # insert
 *   node tools/add-portal-link.js --check    # report only, change nothing
 *
 * Why a script and not 27 hand edits: the topbar and footer are duplicated
 * verbatim across every page, so this is the same situation sync-catalogue.js
 * already solves. Re-runnable — a page that already carries the link is left
 * alone, so this can be run again after new pages are added.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

const PORTAL = 'https://hnpbuilding.com/account';
const LINK = `<a href="${PORTAL}">Client login</a>`;

/*
 * Two insertion points per page, each identified by a literal that is present
 * exactly once in all 27 files (verified before writing this script):
 *
 *  - topbar: the "Talk to fabrication" tel: link closes .tb-right, so the
 *    login link goes immediately after it as the last utility link.
 *  - footer: the sales@ mailto closes the contact/company column in both
 *    footer variants (Systems/Practice/Contact on 9 pages,
 *    Systems/Explore/Company on the other 18). Anchoring on the mailto rather
 *    than on the <h4> heading means one rule covers both variants.
 */
const SITES = [
  {
    name: 'topbar',
    anchor: '<a href="tel:+17206099307" title="(720) 609-9307 — click to copy">Talk to fabrication</a>',
  },
  {
    name: 'footer',
    anchor: '<a href="mailto:sales@hnpbuilding.com">sales@hnpbuilding.com</a>',
  },
];

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

let changed = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  const full = path.join(ROOT, file);
  let s = fs.readFileSync(full, 'utf8');

  if (s.includes(PORTAL)) {
    console.log(`  ${file}: already linked, skipping`);
    skipped++;
    continue;
  }

  /*
   * Insert into every site before writing anything, so a page that is missing
   * one of the two anchors is left completely untouched rather than half done.
   */
  let next = s;
  const missing = [];
  for (const { name, anchor } of SITES) {
    const hits = next.split(anchor).length - 1;
    if (hits !== 1) {
      missing.push(`${name} anchor found ${hits}x (expected 1)`);
      continue;
    }
    // Function replacer, not a string: a literal "$" in the replacement is
    // otherwise parsed as backreference syntax ($1, $&, ...). Same trap
    // sync-catalogue.js documents at its own write step.
    next = next.replace(anchor, () => anchor + LINK);
  }

  if (missing.length) {
    console.log(`  ${file}: SKIPPED — ${missing.join('; ')}`);
    failed++;
    continue;
  }

  console.log(`  ${file}: + topbar, + footer`);
  if (!CHECK) fs.writeFileSync(full, next);
  changed++;
}

console.log(
  `\n${CHECK ? '(--check: no files written) ' : ''}` +
  `pages linked: ${changed}, already had it: ${skipped}, could not place: ${failed}`
);
if (failed) process.exitCode = 1;
