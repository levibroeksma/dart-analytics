---
id: D0436
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Magnifier read sits above the circle in a glass pill

## Context and Problem Statement
the read inside the circle covered the zoomed board under the crosshair.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`BoardMagnifier`'s read pill moves out of the circle to 8px above its top edge, centred, styled by a new `glass-pill` utility — the `glass-button` wash over `oklch(4% 0.01 245 / 0.6)`, top/bottom borders 0.35/0.15, `0 2px 8px` shadow, `backdrop-blur-sm` — per Claude Design `Game Play Analytics.dc.html` §8a. The sized, translated frame now carries `--mag-zoom` and `magnifierBox()`; the clipped circle fills it, so the pill is not clipped.", because the read inside the circle covered the zoomed board under the crosshair.

### Consequences
markup + CSS; `glass-pill` pinned in `brand-tokens.test.ts`; `.astro` carries no unit test (D101). The placement clamp still sizes the circle only, so near the viewport top the pill may clip.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`glass-pill` is pinned in `app/tests/lib/ui/brand-tokens.test.ts` (commit `795d52f2`).

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-09
Supersedes: D432 (read placement clause only — now above the circle).

* Commit `795d52f2` (2026-10-09; adds the row): origin of the existing Context, Decision Outcome and Consequences text. It rebuilt no section here.
* Partly reverses D432, whose spec placed the read inside the circle (`docs/superpowers/specs/2026-10-08-game-play-redesign-design.md`, Decisions taken in brainstorming, item 2).
