# Redirect reference map — hnpbuilding.com

Purpose: Shopify continues to serve `/products/*`, `/collections/*`, `/blogs/*` and checkout — no redirects
needed there. This doc only covers the **top-level CMS pages** on Shopify (`/pages/*`) that this static
site now has direct equivalents for. Once hosting is decided, port this into whichever mechanism applies
(Shopify's own URL Redirects admin panel if Shopify still owns the domain, or a platform redirect file
such as Netlify `_redirects` / Vercel `vercel.json` if the static site owns the domain).

Format: `old URL` → `new URL` — confidence note.

## Direct matches (safe to redirect as-is)

| Old (Shopify) | New (static site) | Notes |
|---|---|---|
| `/pages/about-us` | `/about.html` | direct |
| `/pages/contact` | `/contact.html` | direct |
| `/pages/catalog` | `/products.html` | direct — "catalog" → products hub |
| `/pages/architects-and-builders` | `/industry-architects-builders.html` | direct |
| `/pages/landscape-architects` | `/industry-landscape-architects.html` | direct |
| `/pages/urban-planners-and-municipalities` | `/industry-municipal-public.html` | direct |
| `/pages/custom-made` | `/product-custom-fabrication.html` | direct |

## Best-fit matches (needs a quick sign-off, not a 1:1 name match)

| Old (Shopify) | Suggested new | Why |
|---|---|---|
| `/pages/garden-and-landscape-design` | `/industry-landscape-architects.html` | closest topical overlap; could instead point to `/product-planters.html` or `/product-edging-furnishings.html` if that page was more product-focused — confirm intent |
| `/pages/private-building-owners` | `/industry-commercial-developers.html` (or `/architects.html` hub) | no dedicated "private owners" audience page currently exists — pick a landing spot |

## No static equivalent — needs a decision

| Old (Shopify) | Issue |
|---|---|
| `/pages/data-sharing-opt-out` | Legal/compliance page — likely should stay live on Shopify rather than redirect, since the static site has no privacy/legal infrastructure |
| `/pages/materials-for-metal-seat-cushions` | Oddly specific legacy page, no static equivalent. Best guess `/materials.html`, but content scope doesn't match — confirm this page is still needed at all |
| `/pages/materials-for-seat-cushions` | Same as above — appears to be a duplicate/legacy page |

## Collections → category pages (for reference only — not needed if Shopify keeps serving `/collections/*`)

| Old (Shopify) | Closest static category | Confidence |
|---|---|---|
| `/collections/water-feature` | `/product-water-features.html` | direct |
| `/collections/speacilized-fountain-collections` | `/product-water-features.html` | direct |
| `/collections/corten-steel-driveway-gate` | `/product-custom-fabrication.html` | best-fit (no dedicated "gates" page exists) |
| `/collections/custom-made-corten-steel-flexible-lawn-edging` | `/product-edging-furnishings.html` | direct |
| `/collections/custom-corten-steel-garden-steps` | `/product-stair-railings.html` | direct |
| `/collections/custom-made-garden-ring` | `/product-edging-furnishings.html` | best-fit |
| `/collections/custom-made-planter-box` | `/product-planters.html` | direct |
| `/collections/door` | `/product-custom-fabrication.html` | best-fit |
| `/collections/fencing` | `/product-privacy-screens.html` | best-fit |
| `/collections/fire-pit` | `/product-fire-features.html` | direct |
| `/collections/earth` | unclear — no obvious static match | flag |
| `/collections/garden-objects` | `/product-edging-furnishings.html` | best-fit |
| `/collections/fire-objects` | `/product-fire-features.html` | direct |
| `/collections/street-furniture` | `/product-edging-furnishings.html` | direct |
| `/collections/wellness-wellbeings` | `/product-water-features.html` | best-fit (spa/plunge-pool adjacent) |
| `/collections/custom-made` | `/product-custom-fabrication.html` | direct |
| `/collections/stair-risers` | `/product-stair-railings.html` | direct |

## Note on category coverage

Two static category pages have no matching SKUs in the old Shopify catalog:
- `product-facade-cladding.html` (Facade & Cladding)
- `product-railings-guardrails.html` (Railings & Guardrails)

This is expected, not a gap — the new site's 10 systems are a deliberate rebuild, not a mirror of the old
catalog. The old Shopify data in this doc is used only to map redirects and avoid losing SEO on existing
indexed URLs; it isn't a checklist of what the new site is required to carry.

## Products (89 SKUs) → category page

Grouped by best-fit static category. Not an exhaustive redirect list (Shopify keeps serving these URLs
per your coexist decision) — kept here as the categorization backbone used to enrich each category page's
copy with real catalog details.

**Water Features** (`product-water-features.html`) — ~35 SKUs: rustic-cascade, elemental-flow, terracascade,
patina-falls, mystic-flow, sunset-stream (x2), echo-falls, corten-cascade (+2 copies), rustic-harmony,
earthbound-serenity, arc-of-serenity, aura-cascade, timeless-stream, steel-serenity, verdant-veil,
horizon-cascade, autumn-flow, sculpted-oasis, ember-basin, custom-size-corten-cascade, modern-corten-steel-waterfall-fountain
(+2 copies), elegant-corten-steel-fountain-bowl (28"/48"/54", multiple copies), modern-corten-steel-water-fountain,
modern-corten-steel-outdoor-fountain-circular-bowl, corten-steel-water-fountain-bowl, modern-corten-steel-fountain-sculptural,
corten-steel-waterfall-fountain-reflecting-pool (+copy), 304-stainless-steel-round-water-feature-bowl,
modern-custom-made-corten-steel-water-feature-submersible-pump, plunge-pool (x2)

**Privacy Screens** (`product-privacy-screens.html`) — ~16 SKUs: custom-privacy-screens-by-h-p-building,
custom-made-corten-steel-outdoor-privacy-screens (+copy), corten-steel-fence-fire-resistant (+copy — do **not**
use for Fire Features, confirmed mislabeled elsewhere on site), corten-steel-decorative-privacy-screen-laser-cut-floral,
premium-corten-steel-garden-panels, coast-redwood-forest-privacy-screen (+copy), decorative-corten-steel-privacy-panels-laser-cut-art,
corten-steel-pool-equipment-enclosure, modern-corten-steel-privacy-panels-with-built-in-planters (+2 copies),
custom-made-size-outdoor-privacy-screen variants (metal wall art / sculpture crossover — see Sculpture below)

**Sculpture & Structures** (`product-sculpture-structures.html`) — ~7 SKUs: custom-made-size-outdoor-privacy-metal-wall-art
variants (large metal wall sculpture — crossover with Privacy Screens, pick one canonical category),
elevate-your-property mustang/pony horse sculpture, bronze-mustang-horse-sculpture

**Fire Features** (`product-fire-features.html`) — ~6 SKUs: corten-steel-round-fire-pit-24, square-corten-steel-fire-pit-24,
modern-corten-steel-fire-pit-kit-43, hnp-fp071-fire-pit-with-wood-storage-and-wheels, vulcano-square-corten-steel-gas-fire-pit,
modern-suspended-black-fireplace-hanging-gas-fireplace

**Planters** (`product-planters.html`) — ~7 SKUs: custom-made-planter-box (+2 copies), corten-steel-raised-garden-bed
(+copy), corten-steel-planter-with-trellis (+copy), modern-corten-steel-raised-garden-bed-copy

**Stair Railings** (`product-stair-railings.html`) — ~3 SKUs: custom-made-corten-steel-garden-steps,
custom-copper-patina-stair-risers (+copy)

**Custom Fabrication** (`product-custom-fabrication.html`) — ~9 SKUs: modern-corten-steel-driveway-gate,
custom-made-corten-steel-gates, custom-made-size-pedestrian-gate, custom-modern-steel-driveway-gate-laser-cut
(+copy), custom-corten-steel-garden-gate-laser-cut-tree-design (+copy), custom-made-garden-ring

**Edging & Site Furnishings** (`product-edging-furnishings.html`) — 1 SKU: custom-made-corten-steel-flexible-lawn-edging
(thin coverage — worth checking Shopify for more site-furnishings SKUs that may exist under different naming)

**Facade & Cladding / Railings & Guardrails** — 0 matching SKUs (see gap note above)
