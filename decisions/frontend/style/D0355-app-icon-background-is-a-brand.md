---
id: D0355
status: accepted
date: 2026-09-22
origin: contemporaneous
original-date:
tags: [frontend/style, icon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# App icon background is a brand-hue radial gradient, not flat black

## Context and Problem Statement
on the iOS Home Screen (tinted mode) the flat black icon read dark and flat beside other app icons, which carry top-lit depth.

## Decision Drivers
* On the iOS Home Screen in tinted mode, the flat black icon looked dark and flat beside other app icons.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`app/scripts/generate-app-icons.ts` paints the icon square with a radial gradient in the brand hue (237), lit from the top edge and falling to near-black, instead of `#000000`. The board is drawn on top unchanged — no filter, no blur. Applies to every generated icon (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).", because on the iOS Home Screen (tinted mode) the flat black icon read dark and flat beside other app icons, which carry top-lit depth.

### Consequences
Refines D176's output only; generator stays the single source, regenerate with `npm run icons:generate`.
* Neutral, because the commit regenerates all 5 outputs (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) and adds a test.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
A test in `app/tests/scripts/generate-app-icons.test.ts` checks that the composed SVG holds a `radialGradient`, paints it before the board, and has no `filter` or `feGaussianBlur`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-22

* Commit `5eaaa03b` (2026-09-22; edits `generate-app-icons.ts`, the 5 icon assets and its test): rebuilt Consequences and Confirmation.
* Refines D176 (output only).
