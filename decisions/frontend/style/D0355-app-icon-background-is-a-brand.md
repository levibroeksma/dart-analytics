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
<!-- backfill: pending -->

# App icon background is a brand-hue radial gradient, not flat black

## Context and Problem Statement
on the iOS Home Screen (tinted mode) the flat black icon read dark and flat beside other app icons, which carry top-lit depth.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/scripts/generate-app-icons.ts` paints the icon square with a radial gradient in the brand hue (237), lit from the top edge and falling to near-black, instead of `#000000`. The board is drawn on top unchanged — no filter, no blur. Applies to every generated icon (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).", because on the iOS Home Screen (tinted mode) the flat black icon read dark and flat beside other app icons, which carry top-lit depth.

### Consequences
Refines D176's output only; generator stays the single source, regenerate with `npm run icons:generate`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-22
