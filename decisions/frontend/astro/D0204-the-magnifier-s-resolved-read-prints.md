---
id: D0204
status: accepted
date: 2026-08-10
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The magnifier's resolved read prints above the circle, smaller

## Context and Problem Statement
Owner direction after using the shipped board. No architectural tradeoff beyond the geometry note above: `top`, not `bottom`, is required for the same reason `magnifierAnchorStyle` uses `top`/`left` — the anchor div has no explicit size, so any property measured from its own far edge (`bottom`, `right`) would create a circular sizing dependency.
D199 placed the resolved read below the magnifier circle at `text-sm`. After using the shipped board, the owner asked for it above the circle, smaller.

## Decision Drivers
* Owner direction after using the shipped board.
* The anchor div has no explicit size, so a property measured from its far edge (`bottom`, `right`) would create a circular sizing dependency. `top` is required.
* The label's height depends on its font size and is never known to the data layer.

## Considered Options
* Print the read above the circle at `text-xs`, positioned with `top` and `-translate-y-full` (chosen).
* Keep the read below the circle at `text-sm` (D199's placement).
* Anchor the label with `bottom` or `right`. It would create the circular sizing dependency.

## Decision Outcome
Chosen option: "`BoardMagnifier.astro`'s read (`TREBLE 20 · 60`) prints above the magnifier circle at `text-xs` (was `text-sm`, below). `board-input.data.ts` exports a pure `magnifierLabelStyle(view)`, mirroring `magnifierAnchorStyle`/`magnifierBoardStyle`: `top: -(magnifierSize / 2 + gap)px`, paired with a `-translate-y-full` class so the computed `top` lands under the label's own bottom edge rather than its top — the label's height depends on its font size and is never known to the data layer.".

### Consequences
`magnifierLabelStyle` is unit-tested directly (mutation-tested: reverting to the old below-placement formula fails both new tests). The visual result was verified by driving the real Alpine build in a headless browser against the project's own compiled CSS, confirming the label's bounding box sits entirely above the circle's.
* Good, because `magnifierLabelStyle` is unit-tested directly, and mutation testing showed that reverting to the old formula fails both new tests.
* Neutral, because the pure `magnifierLabelStyle(view)` mirrors `magnifierAnchorStyle` and `magnifierBoardStyle`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The two `magnifierLabelStyle` tests were the check, plus a headless-browser render that confirmed the label's bounding box sits above the circle's. The 2026-10-08 redesign removed the function and its tests.

## Pros and Cons of the Options
### Read above the circle, `top` with `-translate-y-full`
* Good, because the owner asked for it after using the board.
* Good, because `top` avoids the circular sizing dependency, and the translate class handles the unknown label height.

### Read below the circle
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-10
Supersedes: D199 (its "resolved read below it" placement clause only; the press-drag-release mechanism is unchanged)
Referenced by D0432's `Supersedes:` line.

* Commit `af3c4424` (2026-08-10; adds D204 and D205 in `decisions/frontend/astro.md`): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. No spec or plan names this record as its origin.
* Superseded in part by D432: `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md` moves the read inside the circle and removes `magnifierLabelStyle` and its tests; rebuilt the last sentence of Confirmation.
