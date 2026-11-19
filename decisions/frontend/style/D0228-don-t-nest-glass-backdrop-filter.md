---
id: D0228
status: accepted
date: 2026-08-22
origin: contemporaneous
original-date:
tags: [frontend/style, glass, surface]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Don't nest `glass` (backdrop-filter blur) elements

## Context and Problem Statement
reported as the seat name overlapping the score number on a real iPhone 12 Pro in production, not reproducible in this environment's Chromium-only Playwright at matching dimensions (390px width, heights from 844 down to 600) with realistic content, nor in the reporter's own desktop-simulated mobile viewport — pointing away from a layout/sizing bug (which chromium's box model would have shown identically) and toward a WebKit-specific rendering issue. Nested `backdrop-filter` is a documented WebKit compositing/stacking bug category, and grepping every other `glass` usage in the codebase (`ScoreInput.astro`, `Modal.astro`, `BoardInputPanel.astro`, `GameCard.astro`, every `result-modals/*.astro`) found none nested inside another `glass` ancestor — this was the one accidental exception, most likely introduced by copying the single-player container's own glass card styling onto the split scoreboard's outer shell without noticing the card underneath already supplies it.

## Decision Drivers
* A seat name overlapped the score number on a real iPhone 12 Pro in production, and the Chromium-only environment could not reproduce it.
* Nested `backdrop-filter` is a documented WebKit compositing and stacking bug category.
* A grep of every other `glass` usage found none nested inside another `glass` ancestor.

## Considered Options
* Drop the outer `glass` class from `SplitScoreboard.astro` (chosen).
* Enforce the rule with a check script. The record declines this because only one nested occurrence existed.

## Decision Outcome
Chosen option: "`SplitScoreboard.astro`'s outer grid drops its own `glass` class. It previously wrapped `SplitScoreboardHalf.astro` → `SinglePlayerDisplay.astro`, whose own card already carries `glass` — two nested `backdrop-filter: blur()` layers, one blurring the other's backdrop.".

### Consequences
the seat cards already provide the visible glass/blur surface, so removing the outer layer is visually unchanged (confirmed in Chromium; not confirmed against real WebKit in this sandboxed environment — flagged to the user for on-device re-verification, PR #158). Not elevated to a mechanically-enforced rule (no check script) since only this one nested occurrence existed; a future `glass`-on-`glass` addition is caught by review, not tooling. F15 (`FINDINGS.md`) tracks a related, unresolved sizing-pattern audit noticed during this investigation but out of this fix's scope.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-22

* Commit `d16edd54` (2026-08-22; adds the D228 row and finding F15): rebuilt Decision Drivers, and Considered Options.
