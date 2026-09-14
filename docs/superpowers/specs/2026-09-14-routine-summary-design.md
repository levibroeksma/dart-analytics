<!--
status: design
scope: Balanced Training routine summary screen — per-exercise results at routine end, and the Finishing fact-upload gate
read-when: implementing app/src/modules/training/routine-summary.module.ts, app/src/components/layout/training/RoutineSummaryModal.astro, or the completion path in app/src/lib/training/balanced-training-play.data.ts / finishing-step.data.ts
updated: 2026-09-14
-->

# Routine Summary Screen — Design

## 1. Problem

Balanced Training ends with nothing to show for it. `advanceAfterStepCompletion`
(`app/src/lib/training/balanced-training-play.data.ts`) sees `status === "COMPLETE"`,
stops the session clock, resets the header store, calls `completeTraining`, and
redirects to `/training`. Every number the player just produced — points, darts,
accuracy, the target TUOD reached — is discarded at the moment the routine ends.

Reported as: "no summary screen shows up at the end. I expect all results of the
played exercises except for the warm up. The facts should be stored as well."

Two distinct defects hide behind that one sentence:

**(a) No summary.** There is no routine-level results screen at all. Each game's own
results modal exists (`ResultsModalShell` + `result-modals/*`), but inside the routine
TUOD's modal is suppressed — `play/index.astro` renders `TenUpOneDown` under
`x-show="!finished"` and swaps in a bare "Finishing complete." paragraph.

**(b) Finishing facts can be silently lost.** `finishing-step.data.ts` wraps TUOD's
`uploadAndCompleteSession` and calls `onStepComplete()` unconditionally. The shared
lifecycle it wraps (`playUploadAndCompleteSession` in `app/src/lib/game/play-lifecycle.ts`)
does not throw on an upload failure — it sets `completionStatus = "failed"`, writes
`completionError`, and returns. So a failed Finishing upload still advances the
routine, still completes the activity, and still redirects, with those darts never
persisted and no retry affordance anywhere on screen (TUOD's own modal, which owns
the Retry button, is the thing the routine hides).

Facts for the earlier steps are already stored: `uploadCurrentStepFacts` appends the
Switching and Double Pattern batches before each step advances, and Warm-Up throws no
darts so it has none. (b) is the only real storage hole.

## 2. Scope

In scope: the routine summary modal, the per-exercise result builders behind it, the
Finishing upload gate and its retry affordance.

Out of scope: any server-side read model for training history. The summary is derived
client-side from state already in memory (decided in brainstorming). A persisted,
re-openable routine history is a separate future feature and is not designed here.

## 3. Approach

Each non-Warm-Up step's result is captured at the moment that step completes, while
its engine is still in memory, by pure builder functions in a new module. The page
holds the captured list and renders it in a modal once the routine completes. No store
plumbing: the summary is read only inside the page's own Alpine scope, unlike the
header clock, which lives in `$store.trainingSession` because the layout scope is an
ancestor of the page's (D278).

## 4. Data shapes

New module `app/src/modules/training/routine-summary.module.ts`:

```ts
export type RoutineStatRow = { label: string; value: string };

export type RoutineStepSummary = {
  stepKey: "SWITCHING" | "DOUBLE_PATTERN" | "GAME";
  label: string;
  rows: RoutineStatRow[];
};
```

The row list is generic on purpose: the modal renders a nested `x-for` over
`steps → rows` and needs no per-exercise template branch.

Builders, each pure and unit-testable without Alpine:

| Builder | Input | Rows produced |
| ------- | ----- | ------------- |
| `summariseSwitching` | `SwitchingState`, `EngineFacts` | Points, Darts, Hit rate |
| `summariseDoublePattern` | `DoublePatternState` | Doubles hit, Darts, Hit rate |
| `summariseFinishing` | TUOD `resultsSnapshot` seat summary | Target reached, Double accuracy |

Derivations:

- **Switching hit rate** — a dart counts as a hit when `hitTargetNumber ===
  intendedTargetNumber`; both live on every `DartFact`, so no config lookup is
  needed. Rate is hits over `dartsThrown`.
- **Double Pattern hit rate** — `applyDoublePatternDart` awards exactly one point per
  double hit, so `totalPoints` *is* the hit count and the rate is
  `totalPoints / dartsThrown`. `totalPoints` is labelled "Doubles hit" for that reason.
- **Finishing** — reuses TUOD's existing `computeStats` output (`target`,
  `doubleAccuracy`) off `resultsSnapshot`; nothing is recomputed.

Formatting: a local `hitRateRow(hits, darts)` returns `"—"` when `darts === 0` and
otherwise delegates to `accuracyDisplay` (`app/src/lib/game/play-visit-stats.ts`), the
two-decimal percent helper TUOD's own `doubleAccuracy` already uses, so both accuracy
figures on the summary read the same way. Every value in a `RoutineStatRow` is already a display
string, so the modal formats nothing.

## 5. Completion flow

`advanceAfterStepCompletion` gains one capture call and stops redirecting:

```
await ctx.uploadCurrentStepFacts();      // unchanged
ctx.captureStepSummary();                // NEW — no-op for WARM_UP
…clear engines…                          // unchanged
const state = training.completeStep();
if (state.status === "COMPLETE") {
  ctx.stopSessionClock();                // clock frozen; final time kept
  ctx.$store.trainingSession.markComplete();
  ctx.routineFinished = true;            // modal renders immediately
  await ctx.completeRoutine();
  return;                                // no redirect
}
```

`captureStepSummary` reads the step that just finished — `activeDartEngine()` for
Switching and Double Pattern, `finishing.resultsSnapshot` for the Finishing step —
and pushes one `RoutineStepSummary` onto `ctx.stepSummaries`. It must run before the
engine fields are nulled. Warm-Up produces nothing.

`completeRoutine()` owns the save status, mirroring the shared lifecycle's vocabulary:

```
this.completionStatus = "saving"; this.completionError = "";
try   { await apiCompleteTraining(this.activityId); this.completionStatus = "succeeded"; }
catch { this.completionError = "Could not save your session. Check your connection and retry.";
        this.completionStatus = "failed"; }
```

Retry re-invokes `completeRoutine()`. `Done` is the only thing that navigates:
`$store.trainingSession.reset()` then `/training`. The store reset moves out of the
completion path — resetting there would blank the header and destroy the final time
the summary reports.

`markComplete()` is a new `trainingSession` store action: it leaves `elapsedSeconds`
frozen and switches the step label to `complete`, so the header reads `32:14 - complete`
behind the modal rather than naming a step that is over.

New page state on `balancedTrainingPlay`: `stepSummaries: RoutineStepSummary[]`,
`routineFinished: boolean`, `completionStatus: "idle" | "saving" | "succeeded" | "failed"`,
`completionError: string`.

## 6. Finishing upload gate

In `finishing-step.data.ts`:

```ts
base.uploadAndCompleteSession = async function (this: TuodPlayContext) {
  await originalUpload.call(this);
  if (this.completionStatus !== "succeeded") return;   // NEW
  await onStepComplete();
};
```

A failed Finishing upload therefore leaves the routine on the Finishing step with
`finished === true` and `completionStatus === "failed"`. The page's GAME branch
replaces its "Finishing complete." placeholder with a save-failed panel — the error
text plus a Retry button bound to `uploadAndCompleteSession()` — so the retry re-runs
the upload and, on success, advances into the summary. When the upload succeeds the
placeholder is not shown at all: the summary modal is what the player sees.

## 7. Components

New `app/src/components/layout/training/RoutineSummaryModal.astro`: overlay plus glass
card in the same idiom as `ResultsModalShell`, shown under `x-show="routineFinished"`.
Contents: title, total session time, a section per `RoutineStepSummary` (heading =
`label`, one line per `RoutineStatRow`), the save-status region with Retry, and a
`Done` button disabled while `completionStatus !== 'succeeded'`.

`StatRow.astro` is not usable inside the row loop — it takes its label as a build-time
prop and its value as an expression string, while these rows exist only at runtime — so
the modal emits the same `dl`/`dt`/`dd` shape with `x-text="row.label"` /
`x-text="row.value"` inside the nested `x-for`.

The modal sits in the page's own `x-data`, outside the GAME branch's nested
`x-data="finishing"`, so its `completionStatus` / `completionError` are the page's
routine-completion pair and never the Finishing step's identically named TUOD fields.
The save-failed panel of §6 is the reverse: it lives inside the `finishing` scope and
reads TUOD's.

`ResultsModalShell` is deliberately not reused. It hardcodes a two-button
"Back to games" / "Play again" row bound to a per-game `back()` / `playAgain()`
contract and a per-game `finished` flag; the routine has one action, a different
completion call, and a different owning flag. Wrapping it would mean parameterising
every one of those for a single extra caller.

## 8. Tests

New `app/tests/modules/training/routine-summary.module.test.ts` — each builder's rows
and values, including the zero-dart `"—"` fallback and a Switching fold where some
darts miss their intended target.

New `app/tests/lib/training/finishing-step.data.test.ts` — `onStepComplete` is not
called when the wrapped upload leaves `completionStatus === "failed"`; it is called
when the upload succeeds.

Additions to `app/tests/lib/training/balanced-training-play.data.test.ts`:

- Warm-Up completion adds no entry to `stepSummaries`.
- Switching and Double Pattern completion each add one entry, in step order.
- Final step completion sets `routineFinished` and does not redirect.
- `completeTraining` failure sets `completionStatus = "failed"` with an error; a retry
  that succeeds flips it to `"succeeded"`.
- `Done` resets `$store.trainingSession` and navigates to `/training`.

## 9. Context upkeep

- Decision appended to `decisions/frontend/alpine.md`: the routine summary is derived
  client-side from in-memory engine state with no read model, the Finishing advance is
  gated on a successful upload, and `ResultsModalShell` was not reused (with the reason
  from §7).
- `RoutineSummaryModal` registered in `docs/architecture/07-Frontend/08-Component-Inventory.md`.
