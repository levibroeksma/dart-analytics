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

# Brand Style is the token source; coral error; weight 500

## Context and Problem Statement
phased UI work needs every Brand Style value as a token first; the design uses 500 for values and mono labels, and one warning hue reads clearer than two.

## Decision Drivers
* Phased UI work needs every Brand Style value as a token first.
* The design uses weight 500 for values and mono labels.
* One warning hue reads clearer than two.
* The spec accepts a visual shift now and restyles no components in this task.

## Considered Options
* Tokens follow the Claude Design `Brand Style.dc.html` reference, with coral error and weight 500 allowed (chosen).
* Rename tokens to match the design (rejected: names stay semantic).
* Add icon or asset files (rejected: design colour variants map to `currentColor` icons).

## Decision Outcome
Chosen option: "`global.css` tokens follow the Claude Design `Brand Style.dc.html` reference. Error hue is coral `oklch(68% 0.15 30)`; `--missed`/`--missed-muted` alias `--error`/`--error-muted`. New tokens: `--placeholder`, `--accent-deep-blue`, `--scrim`, `--gradient-blue-glass`; type scale `text-hero|title|value|tile|card-title|button|eyebrow|eyebrow-lg`; radii `rounded-row|key|switch|board|sheet`; `size-hit` (44px). Surfaces: `glass` drops its shadow; new `glass-blue`, `glass-info`, `inset-well`, `inset-well-muted`, `glass-sheet`. `.accent-orb` and `.field-inset` build on them. Weight 500 (`font-medium`) is allowed; `check-style-tokens.sh` no longer bans it. Names stay semantic; no icon or asset files are added — design colour variants map to `currentColor` icons.", because phased UI work needs every Brand Style value as a token first; the design uses 500 for values and mono labels, and one warning hue reads clearer than two.

### Consequences
errors, destructive buttons and alerts turn coral; glass cards lose their drop shadow. Components adopt the new tokens in later phases. Token presence is pinned by `tests/lib/ui/brand-tokens.test.ts`.

* Good, because later phases can compose screens from tokens alone.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/lib/ui/brand-tokens.test.ts` pins token presence.

## Pros and Cons of the Options
### Brand Style as token source
* Good, because every Brand Style value is a token before a component uses it.
* Neutral, because the spec accepts a visual shift now.

## Evidence / More Information
Decided: 2026-10-08
Supersedes: D108, D126 and D161 (the `font-medium` ban only); D426 (500→400 rendering note).
Referenced by D0499's `Supersedes:` line.

* `docs/superpowers/specs/2026-10-08-brand-tokens-design.md` (Decisions taken, Mapping, Assets, Docs, Verification, Out of scope): rebuilt Decision Drivers, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-10-08-brand-tokens.md` (D428 step, test file): rebuilt Confirmation.
* Commit `3937c500` (2026-10-08; adds the D428 row).
* Applied in: `docs/superpowers/specs/2026-10-08-modal-sheets-design.md`, `docs/superpowers/specs/2026-10-08-login-redesign-design.md`.
