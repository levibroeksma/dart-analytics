<!--
status: historical
scope: design record for F39/F40/F41 cleanup
read-when: never (historical record only)
updated: 2026-08-28
-->
# Engine Findings Cleanup (F39/F40/F41) — Design

## Purpose

Close 3 findings left open by `docs/superpowers/plans/2026-08-27-engine-duplication-cleanup.md`: F39 (duplicated `isDartObservation` guard), F40 (duplicated `EXERCISE_BLOCK` `STAGE` constant), F41 (two unconsolidated "state before this visit" techniques). No behavior change — pure mechanical extraction plus one doc note.

## F39 — shared `isDartObservationInput` guard

`five-oh-one.engine.module.ts`, `one-twenty-one.engine.module.ts`, `tuod.engine.module.ts` each declare an identical private guard:

```ts
function isDartObservation(input: XxxInput): input is DartObservation {
  return "hitZoneKey" in input;
}
```

Each `XxxInput` is `XxxVisitInput | DartObservation` (`app/src/modules/game/types.ts`). Add to `turn-log.module.ts`:

```ts
export function isDartObservationInput<T>(
  input: T | DartObservation,
): input is DartObservation {
  return "hitZoneKey" in (input as object);
}
```

Each of the 3 engines drops its local `isDartObservation` function and imports `isDartObservationInput` from `turn-log.module.ts`, calling it as `isDartObservationInput(input)` at every existing call site (2 call sites per engine — `record`/`wouldComplete`-family methods). `score-training.engine.module.ts`'s own guard (`typeof input !== "number"`) is a different check on a different input shape and is out of scope.

## F40 — shared `exerciseBlockStage()` builder

`around-the-clock.engine.module.ts`, `bobs27.engine.module.ts`, `doubles-training.engine.module.ts`, `score-training.engine.module.ts`, `shanghai.engine.module.ts`, `singles-training.engine.module.ts` each declare:

```ts
const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};
```

Add to `turn-log.module.ts`, matching the naming convention of 501's `legStage(sequence)` / 121's `roundStage(sequence)`:

```ts
export function exerciseBlockStage(): StageFact {
  return {
    clientKey: "block-1",
    stageTypeKey: "EXERCISE_BLOCK",
    parentClientKey: null,
    sequence: 1,
  };
}
```

Each of the 6 engines replaces its `const STAGE: StageFact = {...}` literal with `const STAGE = exerciseBlockStage();` and adds the import. Every existing call site (`{ ...STAGE }`, `STAGE.clientKey`, the one non-spread read in `score-training.engine.module.ts:147`) is untouched — the builder returns a fresh object per call, so the module-level `const STAGE` in each file still names one object for that file's lifetime, identical to today.

## F41 — shared `turnsBeforeVisit` slice helper

`one-twenty-one.engine.module.ts`'s `seatBeforeVisit` and `tuod.engine.module.ts`'s `targetBeforeVisit` both do:

```ts
const index = this.turns.indexOf(visit);
// ...foldXxxState({ stages, turns: this.turns.slice(0, index) }, ...)
```

— the same technique (locate the visit, slice the log up to it, refold), feeding two different fold functions with different return shapes. That shared slice step is real duplication and is extracted; the differing fold calls are not, since they are genuinely engine-specific. Add to `turn-log.module.ts`:

```ts
/**
 * Every turn strictly before `visit` in `turns` — for folding the log up to
 * the moment `visit` opened. Safe and exact because an engine only ever has
 * one open turn (the last one), so every earlier turn is always closed.
 */
export function turnsBeforeVisit(
  turns: readonly TurnFact[],
  visit: TurnFact,
): TurnFact[] {
  return turns.slice(0, turns.indexOf(visit));
}
```

`OneTwentyOneEngine.seatBeforeVisit` and `TuodEngine.targetBeforeVisit` each replace their own `const index = ...; ...turns.slice(0, index)` pair with `turnsBeforeVisit(this.turns, visit)`, importing it from `turn-log.module.ts`.

`FiveOhOneEngine.remainingBeforeVisit` is **not** touched: it computes a running total via `.filter().reduce()` over `totalScore`, never folds a full state, and needs no visit index at all — a genuinely different technique, not a 3rd copy of the same one. Add one sentence to `docs/architecture/04-Architecture-patterns.md` Pattern 18 (near the existing `turn-log.module.ts`/`seat-state.module.ts` paragraph) documenting the two-technique split as intentional: slice-and-refold (`turnsBeforeVisit`) when the full seat/engine state is needed, manual reduce when only a running total is.

## Files

- Modify: `app/src/modules/game/turn-log.module.ts` (3 new exports)
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`, `one-twenty-one.engine.module.ts`, `tuod.engine.module.ts` (F39)
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts`, `bobs27.engine.module.ts`, `doubles-training.engine.module.ts`, `score-training.engine.module.ts`, `shanghai.engine.module.ts`, `singles-training.engine.module.ts` (F40)
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`, `tuod.engine.module.ts` (F41, same files as F39 — same commit is fine, different functions)
- Modify: `app/tests/modules/game/turn-log.module.test.ts` (new tests for all 3 exports)
- Modify: `docs/architecture/04-Architecture-patterns.md` (F41 doc note)
- Delete: F39/F40/F41 blocks from `FINDINGS.md` on completion

## Non-goals

- No change to `score-training.engine.module.ts`'s own `isDartObservation` (different check).
- No change to `five-oh-one.engine.module.ts`'s `remainingBeforeVisit` (different technique, by design).
- No change to `legStage`/`roundStage` (per-sequence, not duplicated across files).
- F42 (why `fallow` didn't flag the pre-fix duplication) stays open — it's an investigation task, not a code change, out of scope here.

## Testing

Each touched runtime file gets a covering test edit per D224. `turn-log.module.test.ts` gets 3 new small test blocks (one per export). Each engine's existing test suite already exercises the call sites being rewired — no new engine-level test needed unless a rewire changes behavior (it doesn't), but D224 still requires the engine test files be touched, so add one trivial-but-real regression assertion per touched engine confirming its guard/stage/slice still works post-rewire (mirrors the previous plan's Task 5 resolution of the same gate gap).
