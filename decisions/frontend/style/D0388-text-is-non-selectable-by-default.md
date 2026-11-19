---
id: D0388
status: accepted
date: 2026-10-02
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, Tailwind]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Text is non-selectable by default; selection is an opt-in

## Context and Problem Statement
the app is mobile-first and installed as a web app. A long press on a label, score or button highlighted text and, on iOS, opened the copy/share callout — behaviour of a document, not an app. One base rule fixes it everywhere; per-element `select-none` (as on `DartBoard.astro`) only ever covered the spots someone remembered.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`global.css` `@layer base` sets `user-select: none` (with the `-webkit-` prefix) and `-webkit-touch-callout: none` on `body`. The same layer restores `user-select: text` on `input`, `textarea`, `[contenteditable]` and the `.select-text` class. Anything a player may need to copy opts in with Tailwind's `select-text` utility; nothing else is touched.".

### Consequences
desktop browsers lose text selection too; scoping to `@media (pointer: coarse)` is the escape hatch if that is ever wanted. Form fields are exempted explicitly because iOS Safari can block caret placement and paste under an inherited `none`. Existing `select-none` classes stay as harmless no-ops and are not added anew. `.astro`/CSS carry no unit test (D101); the proof is the rule in `global.css`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-02
