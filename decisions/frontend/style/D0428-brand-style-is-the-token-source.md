---
id: D0428
status: accepted
date: 2026-10-08
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, token, glass, icon, font, colour]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Brand Style is the token source; coral error; weight 500

## Context and Problem Statement
phased UI work needs every Brand Style value as a token first; the design uses 500 for values and mono labels, and one warning hue reads clearer than two.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`global.css` tokens follow the Claude Design `Brand Style.dc.html` reference. Error hue is coral `oklch(68% 0.15 30)`; `--missed`/`--missed-muted` alias `--error`/`--error-muted`. New tokens: `--placeholder`, `--accent-deep-blue`, `--scrim`, `--gradient-blue-glass`; type scale `text-hero|title|value|tile|card-title|button|eyebrow|eyebrow-lg`; radii `rounded-row|key|switch|board|sheet`; `size-hit` (44px). Surfaces: `glass` drops its shadow; new `glass-blue`, `glass-info`, `inset-well`, `inset-well-muted`, `glass-sheet`. `.accent-orb` and `.field-inset` build on them. Weight 500 (`font-medium`) is allowed; `check-style-tokens.sh` no longer bans it. Names stay semantic; no icon or asset files are added — design colour variants map to `currentColor` icons.", because phased UI work needs every Brand Style value as a token first; the design uses 500 for values and mono labels, and one warning hue reads clearer than two.

### Consequences
errors, destructive buttons and alerts turn coral; glass cards lose their drop shadow. Components adopt the new tokens in later phases. Token presence is pinned by `tests/lib/ui/brand-tokens.test.ts`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-08
Supersedes: D108, D126 and D161 (the `font-medium` ban only); D426 (500→400 rendering note).
Referenced by D0499's `Supersedes:` line.
