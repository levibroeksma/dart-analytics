# Unify the 9 `*PlayContext` Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redefine each of the 9 hand-restated `*PlayContext` types in `app/src/lib/game/types.ts` as `PlayLifecycleContext<TConfig, TEngine, TResults> & { <per-game-only fields> }`, per `docs/superpowers/specs/2026-09-03-playcontext-type-unification-design.md` (closes FINDINGS.md F29).

**Architecture:** Pure type-level refactor, one file (`app/src/lib/game/types.ts`), no runtime behavior change. All 9 types are edited together in one task, per the finding's own scoping — a mixed state (some generic, some still hand-restated) would itself be a new inconsistency.

**Tech Stack:** TypeScript, Astro's type checker (`astro check`), Vitest.

## Global Constraints

- Closes FINDINGS.md F29.
- Pure type-level change — the runtime object shape every `*-play.data.ts` factory returns must not change.
- `astro check --minimumFailingSeverity hint` must report 0 errors/0 warnings/0 hints when done.
- No change to `PlayLifecycleContext` itself (`types.ts:247-269`), `play-lifecycle.ts`, or any `*-play.data.ts` file's logic — F27's separate plan owns the play-data lifecycle dedup.
- `app/CLAUDE.md`'s D224: a changed runtime `.ts` file needs a touched covering test. This plan's only changed file is `types.ts`, a pure type declaration file — no runtime logic changes, so no test file needs touching unless Step 9 (below) finds and fixes a genuine field-shape mismatch, in which case that file's covering test is touched too.

---

## Task 1: Redefine all 9 `*PlayContext` types as `PlayLifecycleContext<...> & {...}`

**Files:**
- Modify: `app/src/lib/game/types.ts`

**Interfaces:**
- Consumes: `PlayLifecycleContext<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>` (already defined at `types.ts:247-269` — not modified by this task).
- Produces: nothing new consumed by another task — this plan's only task besides context maintenance.

Do all 9 edits (Steps 1-9 below) before running any check — an intermediate state with some types migrated and others not is not itself meaningful to typecheck, and the finding explicitly scopes this as an all-9-at-once change.

- [ ] **Step 1: `ScoreTrainingPlayContext` (currently `types.ts:311-364`)**

Replace the full type (from `export type ScoreTrainingPlayContext = {` through its closing `};`) with:

```ts
export type ScoreTrainingPlayContext = PlayLifecycleContext<
  ScoreTrainingSnapshot,
  ScoreTrainingEngine,
  ScoreTrainingResultsSnapshot
> & {
  scoreInput: ScoreInputBuffer;
  pendingFinishScore: number | null;
  pendingDartObservation: DartObservation | null;
  showFinishConfirm: boolean;
  timer: SegmentTimer | null;
  visitMarkers(this: ScoreTrainingPlayContext): BoardMarker[];
  state(this: ScoreTrainingPlayContext): ScoreTrainingState | null;
  totalScoreFor(this: ScoreTrainingPlayContext, seatRef: string): number;
  threeDartAverageFor(this: ScoreTrainingPlayContext, seatRef: string): string;
  dartsThrownThisLegFor(
    this: ScoreTrainingPlayContext,
    seatRef: string,
  ): number;
  previousScoreThisLegFor(
    this: ScoreTrainingPlayContext,
    seatRef: string,
  ): string;
  remainingLabel(this: ScoreTrainingPlayContext): string;
  threeDartAverage(this: ScoreTrainingPlayContext): string;
  dartsThrownThisLeg(this: ScoreTrainingPlayContext): number;
  previousScoreThisLeg(this: ScoreTrainingPlayContext): string;
  retryReconciliation(this: ScoreTrainingPlayContext): Promise<void>;
  submitVisit(this: ScoreTrainingPlayContext): Promise<void>;
  confirmFinish(this: ScoreTrainingPlayContext): Promise<void>;
  cancelFinish(this: ScoreTrainingPlayContext): void;
  recordDart(
    this: ScoreTrainingPlayContext,
    observation: DartObservation,
  ): void;
  undoVisit(this: ScoreTrainingPlayContext): void;
  resultsTitle(this: ScoreTrainingPlayContext): string;
  back(this: ScoreTrainingPlayContext): Promise<void>;
  playAgain(this: ScoreTrainingPlayContext): Promise<void>;
  abandonAndExit(this: ScoreTrainingPlayContext): Promise<void>;
  destroy(this: ScoreTrainingPlayContext): void;
};
```

Dropped (now inherited from `PlayLifecycleContext<ScoreTrainingSnapshot, ScoreTrainingEngine, ScoreTrainingResultsSnapshot>`): `loading`, `error`, `finished`, `hasActiveSession`, `loadingReconciliation`, `reconciliationFailed`, `completionStatus`, `completionError`, `playAgainError`, `playAgainLoading`, `resultsSnapshot`, `hiddenTurnKey`, `hiddenTimer`, `$store`, `engine`, `init`, `uploadAndCompleteSession`. Note: the original hand-written type declared `hiddenTimer: ReturnType<typeof setTimeout> | null` (required); the base declares it `hiddenTimer?: ReturnType<typeof setTimeout> | null` (optional) — a harmless widening (every real value still satisfies an optional field), not a behavior change. If `astro check` (Step 10) or `npm test` (Step 11) later surfaces an actual problem from this specific field, treat it per the Risk note below rather than silently working around it.

- [ ] **Step 2: `TuodPlayContext` (currently `types.ts:389-447`)**

Replace the full type with:

```ts
export type TuodPlayContext = PlayLifecycleContext<
  TuodSnapshot,
  TuodEngine,
  TuodResultsSnapshot
> & {
  scoreInput: ScoreInputBuffer;
  pendingAttempt: TuodAttemptInput | null;
  pendingCheckoutScore: number | null;
  pendingDartObservation: DartObservation | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  showDoubleConfirm: boolean;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<TuodSnapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
  timer: SegmentTimer | null;
  visitMarkers(this: TuodPlayContext): BoardMarker[];
  state(this: TuodPlayContext): TuodState | null;
  currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string;
  currentTargetLabel(this: TuodPlayContext): string;
  checkoutHintFor(this: TuodPlayContext, seatRef: string): string;
  checkoutHint(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  checkoutDartOptions(this: TuodPlayContext): CheckoutDartOptions;
  submitVisit(this: TuodPlayContext): Promise<void>;
  confirmDouble(this: TuodPlayContext): Promise<void>;
  cancelCheckout(this: TuodPlayContext): void;
  recordAttempt(this: TuodPlayContext, input: TuodAttemptInput): Promise<void>;
  recordDart(
    this: TuodPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: TuodPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoVisit(this: TuodPlayContext): void;
  resultsTitle(this: TuodPlayContext): string;
  back(this: TuodPlayContext): Promise<void>;
  playAgain(this: TuodPlayContext): Promise<void>;
  abandonAndExit(this: TuodPlayContext): Promise<void>;
  destroy(this: TuodPlayContext): void;
};
```

`$store` is re-declared (not dropped) because the original adds `checkoutHints?: CheckoutHintsStoreContext` on top of the base `PlayStoreContext<TuodSnapshot>` shape — TypeScript intersects same-named properties across `&`, so this re-declaration composes correctly with the base's own `$store: PlayStoreContext<TuodSnapshot>`. Dropped fields: same list as Step 1 minus `$store`/`engine` (which are replaced by the generic parameterization) plus `resultsSnapshot` (now `TResults`).

- [ ] **Step 3: `FiveOhOnePlayContext` (currently `types.ts:665-734`)**

Replace the full type with:

```ts
export type FiveOhOnePlayContext = PlayLifecycleContext<
  FiveOhOneSnapshot,
  FiveOhOneEngine,
  FiveOhOneResultsSnapshot
> & {
  scoreInput: ScoreInputBuffer;
  pendingCheckoutScore: number | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showMatchFinishConfirm: boolean;
  botThrowing: boolean;
  $store: PlayStoreContext<FiveOhOneSnapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
  visitMarkers(this: FiveOhOnePlayContext): BoardMarker[];
  turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[];
  state(this: FiveOhOnePlayContext): FiveOhOneState | null;
  remainingScoreFor(this: FiveOhOnePlayContext, seatRef: string): number;
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLegFor(this: FiveOhOnePlayContext, seatRef: string): number;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  averageFor(this: FiveOhOnePlayContext, seatRef: string): string;
  average(this: FiveOhOnePlayContext): string;
  matchTitle(this: FiveOhOnePlayContext): string;
  previousScoreFor(this: FiveOhOnePlayContext, seatRef: string): string;
  previousScore(this: FiveOhOnePlayContext): string;
  legsWonFor(this: FiveOhOnePlayContext, seatRef: string): number;
  checkoutDartOptions(this: FiveOhOnePlayContext): CheckoutDartOptions;
  retryReconciliation(this: FiveOhOnePlayContext): Promise<void>;
  submitVisit(this: FiveOhOnePlayContext): Promise<void>;
  confirmDouble(this: FiveOhOnePlayContext): Promise<void>;
  cancelCheckout(this: FiveOhOnePlayContext): void;
  confirmMatchFinish(this: FiveOhOnePlayContext): Promise<void>;
  cancelMatchFinish(this: FiveOhOnePlayContext): void;
  recordVisit(
    this: FiveOhOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  recordDart(
    this: FiveOhOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: FiveOhOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: FiveOhOnePlayContext): void;
  maybeRunBotVisit(this: FiveOhOnePlayContext): Promise<void>;
  resultsTitle(this: FiveOhOnePlayContext): string;
  back(this: FiveOhOnePlayContext): Promise<void>;
  playAgain(this: FiveOhOnePlayContext): Promise<void>;
  abandonAndExit(this: FiveOhOnePlayContext): Promise<void>;
};
```

No `destroy()` — the original `FiveOhOnePlayContext` never declared one; do not add one.

- [ ] **Step 4: `OneTwentyOnePlayContext` (currently `types.ts:758-825`)**

Replace the full type with:

```ts
export type OneTwentyOnePlayContext = PlayLifecycleContext<
  OneTwentyOneSnapshot | OneTwentyOneV2Snapshot,
  OneTwentyOneEngine,
  OneTwentyOneResultsSnapshot
> & {
  scoreInput: ScoreInputBuffer;
  pendingCheckoutScore: number | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showSessionFinishConfirm: boolean;
  $store: PlayStoreContext<OneTwentyOneSnapshot | OneTwentyOneV2Snapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
  timer: SegmentTimer | null;
  visitMarkers(this: OneTwentyOnePlayContext): BoardMarker[];
  state(this: OneTwentyOnePlayContext): OneTwentyOneState | null;
  remainingInAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number;
  remainingInAttempt(this: OneTwentyOnePlayContext): number;
  currentTargetLabelFor(this: OneTwentyOnePlayContext, seatRef: string): string;
  currentTargetLabel(this: OneTwentyOnePlayContext): string;
  checkoutHint(this: OneTwentyOnePlayContext): string;
  visitsThisAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number;
  visitsThisAttempt(this: OneTwentyOnePlayContext): number;
  dartsThrownThisSession(this: OneTwentyOnePlayContext): number;
  durationType(this: OneTwentyOnePlayContext): OneTwentyOneDurationType;
  attemptLabel(this: OneTwentyOnePlayContext): string;
  remainingLabel(this: OneTwentyOnePlayContext): string;
  retryReconciliation(this: OneTwentyOnePlayContext): Promise<void>;
  submitVisit(this: OneTwentyOnePlayContext): Promise<void>;
  confirmDouble(this: OneTwentyOnePlayContext): Promise<void>;
  cancelCheckout(this: OneTwentyOnePlayContext): void;
  confirmSessionFinish(this: OneTwentyOnePlayContext): Promise<void>;
  cancelSessionFinish(this: OneTwentyOnePlayContext): void;
  checkoutDartOptions(this: OneTwentyOnePlayContext): CheckoutDartOptions;
  recordVisit(
    this: OneTwentyOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  recordDart(
    this: OneTwentyOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: OneTwentyOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: OneTwentyOnePlayContext): void;
  resultsTitle(this: OneTwentyOnePlayContext): string;
  back(this: OneTwentyOnePlayContext): Promise<void>;
  playAgain(this: OneTwentyOnePlayContext): Promise<void>;
  abandonAndExit(this: OneTwentyOnePlayContext): Promise<void>;
  destroy(this: OneTwentyOnePlayContext): void;
};
```

- [ ] **Step 5: `Bobs27PlayContext` (currently `types.ts:850-892`)**

Replace the full type with:

```ts
export type Bobs27PlayContext = PlayLifecycleContext<
  Bobs27Snapshot,
  Bobs27Engine,
  Bobs27ResultsSnapshot
> & {
  botThrowing: boolean;
  visitMarkers(this: Bobs27PlayContext): BoardMarker[];
  state(this: Bobs27PlayContext): Bobs27State | null;
  currentTargetLabelFor(this: Bobs27PlayContext, seatRef: string): string;
  currentTargetLabel(this: Bobs27PlayContext): string;
  currentScoreFor(this: Bobs27PlayContext, seatRef: string): string;
  currentScore(this: Bobs27PlayContext): string;
  previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[];
  retryReconciliation(this: Bobs27PlayContext): Promise<void>;
  recordTap(this: Bobs27PlayContext, hit: boolean): Promise<void>;
  recordDart(
    this: Bobs27PlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: Bobs27PlayContext,
    observation: DartObservation,
  ): Promise<void>;
  maybeRunBotVisit(this: Bobs27PlayContext): Promise<void>;
  undoVisit(this: Bobs27PlayContext): Promise<void>;
  resultsTitle(this: Bobs27PlayContext): string;
  back(this: Bobs27PlayContext): Promise<void>;
  playAgain(this: Bobs27PlayContext): Promise<void>;
  abandonAndExit(this: Bobs27PlayContext): Promise<void>;
};
```

`$store` is fully dropped (not re-declared) — the original was plain `PlayStoreContext<Bobs27Snapshot>` with no extra fields, identical to what the generic base already provides. No `destroy()` — the original never declared one.

- [ ] **Step 6: `SinglesTrainingPlayContext` (currently `types.ts:918-973`)**

Replace the full type with:

```ts
export type SinglesTrainingPlayContext = PlayLifecycleContext<
  SinglesSnapshot | SinglesV2Snapshot,
  SinglesTrainingEngine,
  SinglesTrainingResultsSnapshot
> & {
  state(this: SinglesTrainingPlayContext): SinglesTrainingState | null;
  visitMarkers(this: SinglesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabelFor(
    this: SinglesTrainingPlayContext,
    seatRef: string,
  ): string;
  currentTargetLabel(this: SinglesTrainingPlayContext): string;
  currentPointsFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  currentPoints(this: SinglesTrainingPlayContext): string;
  isBullVisit(this: SinglesTrainingPlayContext): boolean;
  previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[];
  missCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  missCount(this: SinglesTrainingPlayContext): string;
  singleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  singleCount(this: SinglesTrainingPlayContext): string;
  doubleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  doubleCount(this: SinglesTrainingPlayContext): string;
  trebleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string;
  trebleCount(this: SinglesTrainingPlayContext): string;
  retryReconciliation(this: SinglesTrainingPlayContext): Promise<void>;
  recordTap(
    this: SinglesTrainingPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: SinglesTrainingPlayContext): void;
  resultsTitle(this: SinglesTrainingPlayContext): string;
  back(this: SinglesTrainingPlayContext): Promise<void>;
  playAgain(this: SinglesTrainingPlayContext): Promise<void>;
  abandonAndExit(this: SinglesTrainingPlayContext): Promise<void>;
};
```

`$store` fully dropped (plain `PlayStoreContext<SinglesSnapshot | SinglesV2Snapshot>`, identical to the generic base). No `destroy()`.

- [ ] **Step 7: `DoublesTrainingPlayContext` (currently `types.ts:1062-1107`)**

Replace the full type with:

```ts
export type DoublesTrainingPlayContext = PlayLifecycleContext<
  DoublesTrainingSnapshot,
  DoublesTrainingEngine,
  DoublesTrainingResultsSnapshot
> & {
  state(this: DoublesTrainingPlayContext): DoublesTrainingState | null;
  visitMarkers(this: DoublesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabelFor(
    this: DoublesTrainingPlayContext,
    seatRef: string,
  ): string;
  currentTargetLabel(this: DoublesTrainingPlayContext): string;
  hitCountFor(this: DoublesTrainingPlayContext, seatRef: string): string;
  hitCount(this: DoublesTrainingPlayContext): string;
  missCountFor(this: DoublesTrainingPlayContext, seatRef: string): string;
  missCount(this: DoublesTrainingPlayContext): string;
  previewSegments(this: DoublesTrainingPlayContext): DoublesPreviewSegment[];
  retryReconciliation(this: DoublesTrainingPlayContext): Promise<void>;
  recordTap(this: DoublesTrainingPlayContext, hit: boolean): Promise<void>;
  commitDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: DoublesTrainingPlayContext): void;
  resultsTitle(this: DoublesTrainingPlayContext): string;
  back(this: DoublesTrainingPlayContext): Promise<void>;
  playAgain(this: DoublesTrainingPlayContext): Promise<void>;
  abandonAndExit(this: DoublesTrainingPlayContext): Promise<void>;
};
```

`$store` fully dropped. No `destroy()`.

- [ ] **Step 8: `ShanghaiPlayContext` (currently `types.ts:1145-1191`)**

Replace the full type with:

```ts
export type ShanghaiPlayContext = PlayLifecycleContext<
  ShanghaiSnapshot | ShanghaiV2Snapshot,
  ShanghaiEngine,
  ShanghaiResultsSnapshot
> & {
  visitMarkers(this: ShanghaiPlayContext): BoardMarker[];
  recordDart(
    this: ShanghaiPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  state(this: ShanghaiPlayContext): ShanghaiState | null;
  currentTargetLabelFor(this: ShanghaiPlayContext, seatRef: string): string;
  currentTargetLabel(this: ShanghaiPlayContext): string;
  roundLabelFor(this: ShanghaiPlayContext, seatRef: string): string;
  roundLabel(this: ShanghaiPlayContext): string;
  currentScoreFor(this: ShanghaiPlayContext, seatRef: string): string;
  currentScore(this: ShanghaiPlayContext): string;
  isBullVisit(this: ShanghaiPlayContext): boolean;
  previewSegments(this: ShanghaiPlayContext): ShanghaiPreviewSegment[];
  retryReconciliation(this: ShanghaiPlayContext): Promise<void>;
  recordTap(
    this: ShanghaiPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: ShanghaiPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: ShanghaiPlayContext): void;
  resultsTitle(this: ShanghaiPlayContext): string;
  back(this: ShanghaiPlayContext): Promise<void>;
  playAgain(this: ShanghaiPlayContext): Promise<void>;
  abandonAndExit(this: ShanghaiPlayContext): Promise<void>;
};
```

`$store` fully dropped. No `destroy()`.

- [ ] **Step 9: `AroundTheClockPlayContext` (currently `types.ts:1222-1276`)**

Replace the full type with:

```ts
export type AroundTheClockPlayContext = PlayLifecycleContext<
  AroundTheClockSnapshot,
  AroundTheClockEngine,
  AroundTheClockResultsSnapshot
> & {
  visitMarkers(this: AroundTheClockPlayContext): BoardMarker[];
  recordDart(
    this: AroundTheClockPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  state(this: AroundTheClockPlayContext): AroundTheClockState | null;
  activeSeatState(
    this: AroundTheClockPlayContext,
  ): AroundTheClockSeatState | null;
  currentTargetLabelFor(
    this: AroundTheClockPlayContext,
    seatRef: string,
  ): string;
  currentTargetLabel(this: AroundTheClockPlayContext): string;
  turnsSoFarFor(this: AroundTheClockPlayContext, seatRef: string): string;
  turnsSoFar(this: AroundTheClockPlayContext): string;
  accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string;
  accuracy(this: AroundTheClockPlayContext): string;
  isBullVisit(this: AroundTheClockPlayContext): boolean;
  previewSegments(
    this: AroundTheClockPlayContext,
  ): AroundTheClockPreviewSegment[];
  retryReconciliation(this: AroundTheClockPlayContext): Promise<void>;
  recordTap(
    this: AroundTheClockPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: AroundTheClockPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: AroundTheClockPlayContext): void;
  resultsTitle(this: AroundTheClockPlayContext): string;
  back(this: AroundTheClockPlayContext): Promise<void>;
  playAgain(this: AroundTheClockPlayContext): Promise<void>;
  abandonAndExit(this: AroundTheClockPlayContext): Promise<void>;
};
```

`$store` fully dropped. No `destroy()`.

- [ ] **Step 10: Type-check**

Run: `cd app && npx astro check --minimumFailingSeverity hint`
Expected: `0 errors, 0 warnings, 0 hints`. If it reports a mismatch on any specific field (a hand-copied type that had silently diverged from `PlayLifecycleContext`'s own shape, or from what a real `*-play.data.ts` factory actually returns), that is real signal — read the reported file/line, determine which side is authoritative (the runtime factory's actual returned shape wins; a type declaration is descriptive, not the source of truth), and fix the type declaration in this same file to match. This is the Risk this plan's spec calls out explicitly, not a blocker to work around — do not loosen a field to `unknown`/`any` to silence it.

- [ ] **Step 11: Run the full test suite**

Run: `cd app && npm test`
Expected: full suite passes with the same pass count as before this task's changes (a pure type-declaration edit changes no runtime behavior, so no test should newly fail or newly need updating — unless Step 10 found and fixed a genuine field mismatch, in which case only that file's own covering test changes, per D224).

- [ ] **Step 12: Run `npx fallow`**

Run: `cd app && npx fallow`
Expected: 0 above threshold — this refactor removes duplicated field declarations, so duplication should not increase.

- [ ] **Step 13: Commit**

```bash
git add app/src/lib/game/types.ts
git commit -m "$(cat <<'EOF'
refactor: unify the 9 *PlayContext types onto PlayLifecycleContext (F29)

Each of Bobs27PlayContext, SinglesTrainingPlayContext,
DoublesTrainingPlayContext, ShanghaiPlayContext,
AroundTheClockPlayContext, FiveOhOnePlayContext,
OneTwentyOnePlayContext, ScoreTrainingPlayContext, and TuodPlayContext
now reads as PlayLifecycleContext<TConfig, TEngine, TResults> & { ... }
instead of hand-restating PlayLifecycleContext's own ~15 fields. Pure
type-level change; no runtime object shape differs.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 2: Context maintenance and final validation

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (new Version History entry, written by the `context-maintenance` skill)
- Modify: `FINDINGS.md` (delete the F29 block)

**Interfaces:**
- Consumes: Task 1's finished diff.
- Produces: nothing — terminal task.

- [ ] **Step 1: Delete the F29 block from FINDINGS.md**

Read the current block first: `grep -n -A6 '^### F29' FINDINGS.md`. Delete the entire `### F29 — ...` heading line through its `Proposed:` line, plus the blank line immediately after it.

- [ ] **Step 2: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 3: Run the full validation sequence**

Run: `cd app && npx astro check --minimumFailingSeverity hint && npx fallow && npm test`
Expected: all pass, matching Task 1's own Steps 10-12 results (nothing changed between Task 1's commit and here except the `FINDINGS.md` edit).

- [ ] **Step 4: Invoke the `context-maintenance` skill**

Run the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule. It will add a new Version History entry for this plan to `docs/architecture/00-Context-Map-History.md`, confirm no `00-File-Inventory.md` row went stale (no new/removed file, `types.ts`'s own row's description may need a one-line mention that the 9 `*PlayContext` types are now generic-based), and re-run the Findings gate.

- [ ] **Step 5: Commit the context-maintenance output**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: context maintenance for playcontext-type-unification plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

## Testing

- No new test file — this is a pure type-declaration refactor with no runtime behavior change (root `CLAUDE.md`'s D224 exemption for type-only edits). `astro check --minimumFailingSeverity hint` (0/0/0) is the actual verification: TypeScript's own structural check proves every existing consumer (`*-play.data.ts`'s `Alpine.data()` factory return, any `.astro` destructuring) still typechecks against the refactored types.
- `cd app && npm test` full suite must show the same pass count as immediately before this plan — any change in pass count is a signal to investigate before proceeding, not to route around.
- `.astro` markup itself is not unit tested (D101) — no new test needed there regardless.

## Non-goals

- No change to `PlayLifecycleContext` itself, `play-lifecycle.ts`'s implementation, or the play-data duplication F27 targets — separate plan (`docs/superpowers/plans/2026-09-03-play-data-lifecycle-dedup.md`).
- No behavior change to any `*-play.data.ts` factory's returned object shape.
- No further generalization beyond the 9 named types — no new shared base for the per-game halves.
