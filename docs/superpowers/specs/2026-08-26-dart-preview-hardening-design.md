# Dart Preview Hardening — Design

Status: Approved · Date: 2026-08-26

## Problem

Every per-dart recreational game mode (Bob's 27, Singles Training, Doubles
Training, Shanghai, Around the Clock) renders `VisitPreview.astro`, a 3-slot
strip showing each dart of the open visit as hit/miss/empty, then clearing it
after the visit resolves. The reveal-then-clear timer
(`play-lifecycle.ts:playCommitDart`) branches on input mode:

```ts
if (context.$store.game.inputModeKey === "VISUAL_BOARD") {
  context.hiddenTimer = setTimeout(() => { context.hiddenTurnKey = clientKey; }, 1500);
} else {
  context.hiddenTurnKey = resolvedTurn.clientKey; // same tick, no delay
}
```

Under tap/keypad input — the recreational entry path for all five games —
`hiddenTurnKey` is set in the same synchronous tick the 3rd dart is recorded,
before Alpine repaints. The "3 darts filled" state is therefore never
visibly rendered: the strip jumps from 2 filled to 3 empty in one frame.
Only `VISUAL_BOARD` (per-dart board-tap capture) shows the intended
1.5s hold.

`Bob's 27` additionally hand-rolls its own copy of this exact timer logic
inside `bobs27-play.data.ts` instead of calling the shared
`play-lifecycle.ts` module the other four games use — so the same bug
exists twice, independently.

Segment computation itself (mapping a turn's darts to hit/miss/empty) is
duplicated: Singles Training, Shanghai, and Around the Clock each hand-roll
an identical-shaped `previewSegmentsFor()`; Bob's 27 and Doubles Training
share one helper (`doublesPathPreviewSegments`). No shared module or
architecture pattern governs any of this.

## Scope

**In scope:** the 5 games rendering `VisitPreview.astro` — Bob's 27, Singles
Training, Doubles Training, Shanghai, Around the Clock. Both single-player
and 1v1 (same turn log, no player-count branching in this code today).

**Out of scope:** 501, 121, Score Training, Ten Up One Down — these score by
visit total/checkout, not per-dart target, and correctly render no preview.
2v2 — no team/`sideKey`-group code exists yet to build against; this task
only confirms the fix stays turn/seat-scoped so 2v2 slots in later without
touching it again.

## Design

### 1. Uniform reveal timer

`playCommitDart` drops the `inputModeKey` branch. Every input mode gets the
same 1500ms reveal-then-clear:

```ts
if (resolvedTurn?.completedAt) {
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
  const clientKey = resolvedTurn.clientKey;
  context.hiddenTimer = setTimeout(() => {
    context.hiddenTurnKey = clientKey;
  }, 1500);
}
```

1500ms is kept (not changed to 2000ms) — it is the existing, already-shipped
board-mode timing; the defect is the missing delay under tap input, not the
duration.

### 2. Shared segment computation

New export in `play-lifecycle.ts`:

```ts
export function playPreviewSegments<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  classify: (darts: readonly DartFact[]) => PreviewSegment[],
): PreviewSegment[]
```

It owns the shared gate — no turn, or the turn matches `hiddenTurnKey`, all
3 empty — and pads/truncates to exactly 3 segments; `classify` is supplied
per game and produces the hit/miss/empty read for whatever darts exist on
the open turn. `doublesPathPreviewSegments` (Bob's 27 + Doubles Training)
keeps its own path-walk logic but is reshaped as one such `classify`
function rather than a full standalone gate — it stays in
`doubles-path-play.ts` since the path logic is genuinely per-ruleset, not
a duplicate.

One shared type replaces the 5 duplicate `{ status: "hit" | "miss" | "empty" }`
aliases:

```ts
export type PreviewSegment = { status: "hit" | "miss" | "empty" };
```

in `lib/game/types.ts`, re-exported (not duplicated) by each game's
`Bobs27PreviewSegment`-style alias, or those aliases are removed and callers
import `PreviewSegment` directly — decided at implementation time by
whichever is the smaller diff per file.

Singles Training, Shanghai, and Around the Clock's local
`previewSegmentsFor()` functions are removed; their `previewSegments()`
Alpine method calls `playPreviewSegments(this, classify)` with a
game-specific `classify` closure built from their existing per-dart
hit-test (`trainingPointsFor`, etc. — logic unchanged, only relocated to a
closure).

### 3. Bob's 27 onto the shared lifecycle

`bobs27-play.data.ts` stops hand-rolling `init`, `commitDart`, `undoVisit`,
`uploadAndCompleteSession`, `back`, `abandonAndExit`, `playAgain` and
delegates to `play-lifecycle.ts`'s `playInit`/`playCommitDart`/
`playUndoVisit`/`playUploadAndCompleteSession`/`playBack`/
`playAbandonAndExit`/`runPlayAgain` — the same pattern
`singles-training-play.data.ts` already follows. `previewSegments()` and
`visitMarkers()` become thin calls into `playPreviewSegments`/
`playVisitMarkers`. This removes the second, independent copy of the timer
bug and the duplicated lifecycle boilerplate.

### 4. Edge cases — verified, no change needed

`playUndoVisit` and `runPlayAgain` already `clearTimeout(context.hiddenTimer)`
before resetting `hiddenTurnKey` — confirmed in the current
`play-lifecycle.ts`. `playBack`/`playAbandonAndExit` navigate away
(`globalThis.location.href = "/games"`), tearing down the page's Alpine
scope, so a pending timer has nowhere to fire into. No new cleanup code is
required; removing the input-mode branch does not touch these paths.

### 5. Architecture hardening

New `docs/architecture/04-Architecture-patterns.md` entry, **Pattern 19 —
Shared Reveal-Then-Clear Preview**, following the existing pattern format
(`Principle` / `Pattern` diagram / `Application` / `Rule`):

- Principle: a per-dart game mode's visit preview is one shared mechanism,
  not a per-ruleset reimplementation.
- Pattern diagram: `commitDart → playCommitDart (uniform timer) →
  hiddenTurnKey → playPreviewSegments(context, classify) → VisitPreview.astro`.
- Application: timer duration and gating live once in `play-lifecycle.ts`;
  a new game mode supplies only a `classify` function; the mechanism is
  turn/seat-scoped, so 1v1 needs no special case and 2v2 (when its
  `sideKey`-group work lands) needs none here either.
- Rule: detail lives in `play-lifecycle.ts` and `07-Frontend/04-Modules-And-OOP.md`.

`08-Component-Inventory.md`'s `VisitPreview.astro` row is updated: Key props
column gains a note that segments come from the page's `previewSegments()`,
which every adopter now builds via the shared `playPreviewSegments()`.

A decision block is appended to `decisions/frontend/alpine.md` (routes here
per `DECISIONS.md` — `state`, `x-data` lifecycle) recording: the timer
duration is unified to 1500ms across input modes, and why (previously
diverged by accident, not by design); Bob's 27 is migrated onto
`play-lifecycle.ts`.

`FINDINGS.md` gains one entry: the 5 near-identical `*PlayContext` types
(each restating `hiddenTurnKey`/`hiddenTimer`/`previewSegments(...)` instead
of structurally reusing `PlayLifecycleContext`) are noticed but left as-is —
deeper generic unification is a separate task.

### Non-goals

- No 2000ms timer change (1500ms kept).
- No mechanical check-script enforcing the shared module's use (documented
  pattern + review, consistent with how `timer`/`toast`/`modal`/`chart`
  primitives are already governed).
- No 2v2 team/`sideKey`-group code.
- No refactor of the 5 duplicate `*PlayContext` type shapes beyond what
  `PreviewSegment` itself needs (logged to `FINDINGS.md` instead).

## Testing (TDD, mandatory)

- `play-lifecycle.test.ts`: `playCommitDart` schedules the same 1500ms
  delayed reveal under both `VISUAL_BOARD` and tap/keypad input modes (red:
  current test, if any, asserting the instant-clear branch; green: uniform
  delay).
- `play-lifecycle.test.ts`: new `playPreviewSegments` unit tests — hidden
  turn → 3 empty; no turn → 3 empty; partial turn (1–2 darts) padded to 3;
  `classify` result passed through unchanged.
- `bobs27-play.data.test.ts`: re-pointed at the shared-lifecycle behavior
  (same guarantees — reveal timing, undo-cancels-timer, upload/back/abandon
  — asserted against the new delegating implementation, not deleted).
- `singles-training-play.data.test.ts` / `shanghai-play.data.test.ts` /
  `around-the-clock-play.data.test.ts`: existing `previewSegments()`
  behavior tests updated to exercise the shared function path; same
  input/output contract, no test loosened.
- `doubles-training-play.data.test.ts`: unaffected in behavior (already
  used `doublesPathPreviewSegments`); verify no regression once that
  helper is reshaped as a `classify` callback.

## Context maintenance

Per root `CLAUDE.md`, run the `context-maintenance` skill before completion:
register the new pattern and decision, confirm `08-Component-Inventory.md`
edit, confirm `scripts/check-context-map.sh` / `check-decision-ids.sh` /
`check-findings-log.sh` pass, confirm branch/PR state.
