---
id: D0199
status: superseded
date: 2026-08-09
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0201
---
<!-- backfill: pending -->

# Board input is press-drag-release with a magnifier, not a tap

## Context and Problem Statement
The treble ring is ~10 mm tall on a board displayed ~0.65-3.2 px/mm, against a fingertip contact patch nearer 45 px. A bare tap cannot be aimed at that precision and, worse, cannot be *seen* to be wrong before it lands. A misclassified tap does not just mis-render: it writes a wrong `hitZoneKey` and coordinate pair into the fact log, and completed gameplay is immutable, so there is no correction path short of a new record.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "A `VISUAL_BOARD` dart is captured by press-drag-release on `BoardInputPanel.astro`. `pointerdown` opens `BoardMagnifier.astro` beside the fingertip — a second, unlabelled `DartBoard.astro` clipped to a circle, transformed so the pressed point sits under a crosshair, with the live resolved read below it. The commit happens on `pointerup`; `pointercancel` discards; a press that never moves commits at its own position. The keypad stays rendered for every session as the accessible alternative and is never swapped out for the board.".

### Consequences
The pointer surface needs `touch-none`, or the browser claims the drag as a scroll and `pointermove` stops arriving mid-gesture. Magnifier zoom is a multiple of the *displayed* board (`zoom x pxPerMm`, read live from the SVG's screen CTM) rather than an absolute scale, so magnification is constant across viewports. The magnifier is `position: fixed` and clamped against the visual viewport, because its anchor is `clientX`/`clientY`. The whole overlay is `aria-hidden` — it duplicates the read the live text already announces. `BoardMagnifier.astro`'s circle uses an OBJECT-form `:style` binding: Alpine's string form calls `setAttribute("style", ...)`, which wipes the static `--mag-zoom` custom property and silently drops the entire `transform` as invalid, rendering at 1x with every unit test still green.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-09
Referenced by D0204's `Supersedes:` line.
