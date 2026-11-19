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

# Board input is press-drag-release with a magnifier, not a tap

## Context and Problem Statement
The treble ring is ~10 mm tall on a board displayed ~0.65-3.2 px/mm, against a fingertip contact patch nearer 45 px. A bare tap cannot be aimed at that precision and, worse, cannot be *seen* to be wrong before it lands. A misclassified tap does not just mis-render: it writes a wrong `hitZoneKey` and coordinate pair into the fact log, and completed gameplay is immutable, so there is no correction path short of a new record.

## Decision Drivers
* The treble ring is about 10 mm tall on a board displayed at about 0.65-3.2 px/mm, against a fingertip contact patch near 45 px.
* A bare tap cannot be aimed at that precision, and the player cannot see it is wrong before it lands.
* A misclassified tap writes a wrong `hitZoneKey` and coordinate pair into the fact log. Completed gameplay is immutable, so only a new record corrects it.

## Considered Options
* A bare tap on the board.
* Press-drag-release with a magnifier beside the fingertip (chosen).

## Decision Outcome
Chosen option: "A `VISUAL_BOARD` dart is captured by press-drag-release on `BoardInputPanel.astro`. `pointerdown` opens `BoardMagnifier.astro` beside the fingertip — a second, unlabelled `DartBoard.astro` clipped to a circle, transformed so the pressed point sits under a crosshair, with the live resolved read below it. The commit happens on `pointerup`; `pointercancel` discards; a press that never moves commits at its own position. The keypad stays rendered for every session as the accessible alternative and is never swapped out for the board.".

### Consequences
The pointer surface needs `touch-none`, or the browser claims the drag as a scroll and `pointermove` stops arriving mid-gesture. Magnifier zoom is a multiple of the *displayed* board (`zoom x pxPerMm`, read live from the SVG's screen CTM) rather than an absolute scale, so magnification is constant across viewports. The magnifier is `position: fixed` and clamped against the visual viewport, because its anchor is `clientX`/`clientY`. The whole overlay is `aria-hidden` — it duplicates the read the live text already announces. `BoardMagnifier.astro`'s circle uses an OBJECT-form `:style` binding: Alpine's string form calls `setAttribute("style", ...)`, which wipes the static `--mag-zoom` custom property and silently drops the entire `transform` as invalid, rendering at 1x with every unit test still green.

* Neutral, because the pointer surface needs `touch-none`, or the browser claims the drag as a scroll and `pointermove` stops arriving mid-gesture.
* Good, because magnifier zoom is a multiple of the displayed board (`zoom x pxPerMm`, read live from the SVG's screen CTM), so magnification is constant across viewports.
* Neutral, because the magnifier is `position: fixed` and clamped against the visual viewport, since its anchor is `clientX`/`clientY`.
* Neutral, because the whole overlay is `aria-hidden`. It duplicates the read the live text already announces.
* Bad, because the `BoardMagnifier.astro` circle needs an OBJECT-form `:style` binding. Alpine's string form calls `setAttribute("style", ...)`, which wipes the static `--mag-zoom` custom property and drops the whole `transform` as invalid. The circle then renders at 1x with every unit test still green.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `8f6cd566` reports the real Alpine build driven with a pointer drag in Chromium: the magnifier read and its inner transform both track the pointer.

## Pros and Cons of the Options
### A bare tap
* Bad, because a tap cannot be aimed at ring precision with a fingertip patch near 45 px.
* Bad, because the player cannot see a wrong tap before it lands.
* Bad, because a misclassified tap writes a wrong `hitZoneKey` and coordinate pair into an immutable fact log.

### Press-drag-release with a magnifier
* Good, because the magnifier shows the live resolved read before the commit on `pointerup`, and `pointercancel` discards the dart.
* Bad, because the magnifier overlay carries the `touch-none`, `position: fixed` and OBJECT-form `:style` constraints listed under Consequences.

## Evidence / More Information
Decided: 2026-08-09
Referenced by D0204's `Supersedes:` line.

* Commit `20b4f9e5` (2026-08-09; adds the D199 row): rebuilt Considered Options and Consequences.
* Commit `8f6cd566` (2026-08-09): rebuilt Confirmation. The same commit reverses D199's final sentence through D201 and leaves the press-drag-release mechanism unchanged.
* Applied in: `docs/superpowers/plans/2026-10-08-game-play-redesign.md` (OBJECT-form `:style` note), `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md` (magnifier placement unchanged).
