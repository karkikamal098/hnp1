# Project photography

## How to add the four commercial images

Save each file into `assets/img/source/` using **exactly** these names
(any of .jpg / .jpeg / .png / .webp — the extension doesn't matter):

| Save as                              | Which image                                                        |
|--------------------------------------|--------------------------------------------------------------------|
| `commercial-facade-seam`             | Grey standing-seam facade, perforated + bronze accent panels, blue sky |
| `stainless-glass-balustrade`         | Stainless + glass balustrade, rooftop terrace at dusk, coastal city  |
| `corten-perforated-balconies`        | Corten laser-cut balcony screens at dusk, warm interior glow         |
| `corten-clad-midrise`                | Corten-clad volumes on a mid-rise with glass balconies, urban street |

Then run:

    node tools/wire-photos.js

That generates responsive WebP variants (400–2000px) into `assets/img/`
and swaps them into the slots listed below, replacing the Shopify
product shots currently standing in for commercial work.

## Where each image lands

**commercial-facade-seam** — proves large-format envelope capability
- `product-facade-cladding.html` — page hero
- `industry-commercial-developers.html` — page hero
- `index.html` — capability grid, "Facade & cladding systems"

**stainless-glass-balustrade** — proves code-rated railing work
- `product-railings-guardrails.html` — page hero
- `product-stair-railings.html` — page hero
- `industry-hospitality.html` — page hero
- `index.html` — capability grid, "Stair & balustrade systems"

**corten-perforated-balconies** — strongest image; commercial scale in your own product language
- `index.html` — **home hero** (replaces the residential garden screen)
- `product-privacy-screens.html` — page hero
- `architects.html` — page hero

**corten-clad-midrise** — weathered steel at building scale
- `industry-architects-builders.html` — page hero
- `materials.html` — Corten datasheet M.01
- `projects.html` — lead dossier

Anything not listed keeps its current Shopify product photography, which is
correct for the residential catalogue.
