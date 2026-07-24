# Singles Training Engine — Design (V1, Engine Only)

Status: approved (brainstorming). Scope: pure game-logic engine only — no UI, no persistence, no config/session wiring.

Source ruleset: `docs/game-rules/rulesets/singles-training.md`.

## 1. Scope & Non-Goals

**In scope:** pure-logic engine for Singles Training V1 — order LOW_TO_HIGH (1→20→bull), EASY difficulty (score whatever ring is hit, miss=0), 3-dart visits, training-point scoring (Single=1/Double=2/Treble=3, bull outer=1/inner=2), session completion detection, one-dart-back undo.

**Non-goals (deferred):** HIGH_TO_LOW/RANDOM order, HARD/EXTREME/PROFESSIONAL difficulty (all V2+ per ruleset), multiplayer, `configuration_templates`/`ruleset_versions` wiring, turn/dart DB persistence, UI.

**Flagged, not fixed here:** `database/seeds/0002_default_templates.sql` already ships "Singles — Normal, High to Low" and "Singles — Hard, Random Order" presets referencing V2+ config values (`order_mode: "HIGH_TO_LOW"`/`"RANDOM"`, `difficulty: "NORMAL"`/`"HARD"`) ahead of the ruleset doc, which marks those as TBD/V2+. This is a seed/doc inconsistency outside this engine-only spec's scope — see §6.

## 2. Domain Model / Types

```ts
type SinglesTarget = { kind: "NUMBER"; number: number } | { kind: "BULL" };
// Order (V1, fixed): NUMBER 1..20, then BULL. Not configurable in V1.

type DartRing = "SINGLE" | "DOUBLE" | "TREBLE" | "MISS";

type SinglesTrainingState = {
  targetIndex: number;        // 0..20 (0-19 = 1-20, 20 = BULL)
  totalPoints: number;        // starts at 0
  dartsThisVisit: number;     // 0..3, count only (no penalty/hit-tracking needed)
  status: "IN_PROGRESS" | "COMPLETE";
};

const SINGLES_TRAINING_START_POINTS = 0;
```

Points per dart, by ring:

- `NUMBER` target: `SINGLE` → 1, `DOUBLE` → 2, `TREBLE` → 3, `MISS` → 0.
- `BULL` target: `SINGLE` (outer bull, 25) → 1, `DOUBLE` (inner bull, 50) → 2, `MISS` → 0. `TREBLE` is not a physically valid ring for bull (no treble bull zone exists) — the caller must never send it; the engine treats it as 0 defensively, but this is a caller invariant, not a real case to design around.

The caller pre-classifies each dart's ring relative to the current target before calling the engine (the engine never sees raw hit-target/hit-zone data — that classification is a UI/capture concern, out of scope here).

## 3. Pure Reducer — `applyDart(state: SinglesTrainingState, ring: DartRing): SinglesTrainingState`

1. If `state.status !== "IN_PROGRESS"`, throw (caller error — must `undoLastDart()` first to correct a completing dart).
2. `totalPoints += pointsFor(currentTarget, ring)` — always applied immediately (no penalty/batching case here, unlike Bob's 27; every dart just adds its point value, including 0 for a miss).
3. `dartsThisVisit += 1`.
4. If `dartsThisVisit < 3`, return the updated state (visit not finished).
5. Visit finished (3rd dart): reset `dartsThisVisit = 0`.
6. If this was the `BULL` visit (`targetIndex === 20`) → `status = "COMPLETE"`. Else → `targetIndex += 1`, stays `IN_PROGRESS`.
7. Return a new state object (no mutation of the input).

No loss/death condition exists in V1 (Easy difficulty — misses just score 0, per ruleset). `status` is only ever `IN_PROGRESS` or `COMPLETE`.

Function is pure and side-effect free; `SinglesTrainingEngine` owns all mutable state and history.

## 4. Class API — `SinglesTrainingEngine`

Mirrors the call-site shape of `app/src/modules/game/bobs27.engine.module.ts`'s `Bobs27Engine`, delegating logic to `applyDart`.

```ts
class SinglesTrainingEngine {
  private state: SinglesTrainingState;
  private history: SinglesTrainingState[] = [];

  constructor(startingPoints: number = SINGLES_TRAINING_START_POINTS) {
    this.state = { targetIndex: 0, totalPoints: startingPoints, dartsThisVisit: 0, status: "IN_PROGRESS" };
  }

  recordDart(ring: DartRing): SinglesTrainingState {
    this.history.push(this.state);
    this.state = applyDart(this.state, ring);
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/completion boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): SinglesTarget { /* derived from targetIndex */ }
  currentPoints(): number { return this.state.totalPoints; }
  isComplete(): boolean { return this.state.status === "COMPLETE"; }
}
```

No `result()` method — unlike Bob's 27 there's no win/loss outcome, just completion (`isComplete()`).

`recordDart`'s throw only fires if a caller calls it again after completion without undoing first — correcting a completing dart always goes through `undoLastDart()` first.

## 5. Testing Plan

TDD per `app/CLAUDE.md`. Tests under `app/tests/modules/game/singles-training.engine.module.test.ts` (mirrors source path).

**`applyDart` (pure, tested directly):**

- `SINGLE` on a `NUMBER` target: +1 point, target unchanged, visit continues.
- `DOUBLE` on a `NUMBER` target: +2 points.
- `TREBLE` on a `NUMBER` target: +3 points.
- `MISS`: +0 points, `dartsThisVisit` still increments.
- A 3-dart visit (mixed rings) sums correctly and advances `targetIndex` after the 3rd dart.
- Full path completion (all `TREBLE` on every `NUMBER` target, `DOUBLE` on `BULL`): reaches `status: "COMPLETE"` with the correct summed `totalPoints`.
- `BULL` target: `SINGLE` (outer) → +1, `DOUBLE` (inner) → +2.
- `BULL` visit's 3rd dart sets `status: "COMPLETE"` (not just advances).
- `applyDart` throws when called on a `COMPLETE` state.

**`SinglesTrainingEngine`:**

- `recordDart` delegates correctly; `currentTarget`/`currentPoints`/`isComplete` reflect state.
- `undoLastDart` reverts a single dart (points decrement undone).
- `undoLastDart` reverts the 3rd dart of a visit (target/`dartsThisVisit` restored, not yet advanced).
- `undoLastDart` reverts the completing dart (status back to `IN_PROGRESS`, further `recordDart` calls succeed).
- `undoLastDart` returns `false` on empty history.
- Multiple sequential undos walk back further than one visit.

## 6. Out of Scope / Future Steps

- Fix the seed/ruleset inconsistency: `database/seeds/0002_default_templates.sql`'s "Singles — Normal, High to Low" and "Singles — Hard, Random Order" presets reference `HIGH_TO_LOW`/`RANDOM` order and `NORMAL`/`HARD` difficulty ahead of the ruleset doc's V1 scope (LOW_TO_HIGH + EASY only). Needs a separate decision/fix — either update the ruleset doc to declare these V1, or correct the seed data. Not resolved by this engine spec.
- HIGH_TO_LOW / RANDOM order, HARD/EXTREME/PROFESSIONAL difficulty (V2+ per ruleset).
- UI, persistence to `turns`/`darts`, `configuration_templates`/`ruleset_versions` wiring, multiplayer, session lifecycle.
