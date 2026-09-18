# Board input panel: fill available space, pin buttons to bottom

Status: approved (user, 2026-09-18)

## Problem

On a VISUAL_BOARD session (501 and every other game/exercise sharing
`BoardInputPanel.astro` / `ExerciseBoardInputPanel.astro`), the dartboard
does not grow to use the space the play screen actually has available. On
a tall phone this leaves a visibly undersized board and a band of dead
space below the undo/bounce-out buttons, which end up floating mid-screen
instead of pinned to the bottom.

## Root cause

`BoardInputPanel.astro`'s outer wrapper (`mt-3 flex min-h-0 flex-col
items-center gap-3`) is **not itself a flex-grow participant** in its
parent's column (`FiveOhOne.astro` etc.: `flex flex-col flex-1 min-h-0
gap-3`). Because the wrapper's own height is therefore content-sized, not
flex-distributed, the inner board element's `flex-1` has no real leftover
space to grow into — its rendered size instead falls out of `aspect-square`
+ the hardcoded `max-h-[60vh]` cap, which is unrelated to how much space
the screen actually has left after the score panel.

Verified empirically (Tailwind-compiled static harness reproducing the
real class list + a real `viewBox`-based SVG, screenshotted via Playwright
at several viewport heights — see session transcript):

| Viewport | Current board size | Dead space below buttons |
| -------- | ------------------- | ------------------------- |
| 390×844 (≈12 Pro) | 300×300 (77% of width) | ~98px |
| 460×1000 (large phone) | 300×300 | ~600px |
| 390×480 (very short) | 288×288 | 0px, but score card is squashed to 68px tall and its number clips out of the card |

The last row is a second, previously-unnoticed defect: the `max-h-[60vh]`
cap does not actually protect the score section on short screens either —
it lets the board claim a fixed, width-driven size regardless of true
leftover space, starving the score card instead of the reverse (the
stated intent of the cap, per the component's own docstring).

The dart-landing calculation (`board-input.module.ts`'s `screenToBoard`)
converts pointer coordinates through the SVG's live `getScreenCTM()`, so
it is exact at any rendered board size — resizing the board has no effect
on hit-test correctness.

## Fix

Two one-line changes, applied identically to both components (they are
declared mirrors of each other):

1. Add `flex-1` to the outer wrapper, so it becomes a genuine flex-grow
   item of its parent's column and receives the real leftover vertical
   space.
2. Remove `max-h-[60vh]` from the inner board element. With (1) in place,
   `flex-1 min-h-0 aspect-square max-w-full` is sufficient — the browser's
   flexbox+aspect-ratio sizing already resolves to
   `min(available height, available width)` without a magic number, so it
   scales correctly on any screen instead of only ones near 60vh's
   assumption.

No other file changes. `ScoreInput`/`SinglePlayerDisplay`/etc. are
untouched; their existing `max-h-2/5` / fixed `h-2/5` caps already define
the score section's share and are orthogonal to this fix.

## Verified effect (same harness, after the fix)

| Viewport | Board size | Buttons | Score card |
| -------- | ---------- | ------- | ---------- |
| 390×844 (≈12 Pro) | 390×398 (full width) | flush to viewport bottom | unchanged, 322px |
| 460×1000 (large phone) | fills leftover space, no dead band below buttons | flush to bottom | unchanged |
| 390×480 (very short) | shrinks to 180×180 | flush to bottom, no overflow | grows to 176px, no longer clipped |

12 Pro is not byte-identical (the board now fills the full width instead
of leaving a margin) but is strictly better, not different in kind — same
proportions, same score card, no regression. This was called out to the
user and explicitly accepted in favor of the alternative (a device-width
special case to keep 12 Pro pixel-identical), which would reintroduce a
magic breakpoint for no behavioral benefit.

## Scope / non-goals

- Applies to every game/exercise interface via the two shared components —
  no per-game-interface edits.
- Does not touch hit-test/classification code (`board-geometry.module.ts`,
  `board-input.module.ts`) — confirmed size-independent by inspection.
- Does not touch the magnifier (`BoardMagnifier.astro`) — its placement
  math reads the live `pxPerMm`/viewport at call time, not the board's
  static size.
- Multiplayer (`SplitScoreboard`, fixed `h-2/5`) was not separately
  re-harnessed; the same mechanism applies (fixed sibling height + a now-
  genuinely-flexible board sibling), lower risk than the single-player
  `max-h-2/5` case that was tested.

## Files touched

- `app/src/components/layout/games/BoardInputPanel.astro`
- `app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro`
