# Doubles Training Engine — Design (V1 Easy Mode, Engine Only)

Status: approved (brainstorming). Scope: pure game-logic engine only — no UI, no persistence, no config/session wiring.

Source ruleset: `docs/game-rules/rulesets/doubles-training.md`.

## 1. Scope & Non-Goals

**In scope:** pure-logic engine for Doubles Training V1 Easy mode — order D1→D20→bull, up to 3 darts per visit with early termination on hit, per-visit fact tracking (target, hit/miss, which dart hit), completion detection, one-dart-back undo.

**Non-goals (deferred):** Hard mode (stay until hit), Challenge mode (step-back/game-over), HIGH_TO_LOW/RANDOM order, multiplayer, computed ratios/stats (engine stores facts only — ratio calculation is a future consumer's job), `configuration_templates`/`ruleset_versions` wiring, turn/dart DB persistence, UI.

**Resolved from ruleset's open question:** only double bull (inner, 50) counts as a hit; outer bull (25) is a miss, consistent with how every other target in this trainer works (only the double counts).

## 2. Domain Model / Types

```ts
type DoublesTarget = { kind: "DOUBLE"; number: number } | { kind: "BULL" };
// Order (V1, fixed): DOUBLE 1..20, then BULL.

type VisitOutcome = {
  targetIndex: number;
  hit: boolean;
  hitDartNumber: 1 | 2 | 3 | null; // which dart hit (1st/2nd/3rd); null if all 3 missed
};

type DoublesTrainingState = {
  targetIndex: number;           // 0..20 (0-19 = D1-D20, 20 = BULL)
  dartsThisVisit: number;        // 0..3, darts thrown so far in the current visit
  visitHistory: VisitOutcome[];  // one entry per completed visit — the raw facts
  status: "IN_PROGRESS" | "COMPLETE";
};
```

No score field — unlike Bob's 27/Singles Training, Doubles Training V1 has no numeric scoring, only hit tracking. `visitHistory` is the fact store; ratios (overall, per-target) are derivable from it by a future caller, not computed here (Pattern 9 — store facts, derive statistics elsewhere).

## 3. Pure Reducer — `applyDart(state: DoublesTrainingState, hit: boolean): DoublesTrainingState`

1. If `state.status !== "IN_PROGRESS"`, throw.
2. `dartsThisVisit += 1`.
3. If `hit` is `true` → the visit resolves **now** (early on dart 1/2, or naturally on dart 3): record `{ targetIndex, hit: true, hitDartNumber: dartsThisVisit }` into `visitHistory`, reset `dartsThisVisit = 0`, then advance/complete (step 5).
4. If `hit` is `false`:
   - If `dartsThisVisit < 3`, return the updated state (visit continues, only `dartsThisVisit` changed).
   - If `dartsThisVisit === 3` (all three missed): record `{ targetIndex, hit: false, hitDartNumber: null }` into `visitHistory`, reset `dartsThisVisit = 0`, then advance/complete (step 5).
5. Advance/complete: if this was the `BULL` visit (`targetIndex === 20`) → `status = "COMPLETE"`. Else → `targetIndex += 1`, stays `IN_PROGRESS`.
6. Return a new state object (no mutation of the input or `visitHistory`).

No loss/death condition — same as Singles Training, `status` is only ever `IN_PROGRESS` or `COMPLETE`. The defining difference from the other two engines: a `true` on dart 1 or 2 short-circuits the visit instead of waiting for `dartsThisVisit === 3`.

Function is pure and side-effect free; `DoublesTrainingEngine` owns all mutable state and history.

## 4. Class API — `DoublesTrainingEngine`

Mirrors the call-site shape of `Bobs27Engine`/`SinglesTrainingEngine`, both present in this branch's tree (`app/src/modules/game/bobs27.engine.module.ts`, `app/src/modules/game/singles-training.engine.module.ts`). `recordDart` applies the reducer **before** pushing to history — pushing first and applying second was a bug fixed in both prior engines (a rejected dart, e.g. `recordDart` called after completion, otherwise left a phantom undo entry), so this spec bakes in the corrected ordering from the start.

```ts
class DoublesTrainingEngine {
  private state: DoublesTrainingState;
  private history: DoublesTrainingState[] = [];

  constructor() {
    this.state = { targetIndex: 0, dartsThisVisit: 0, visitHistory: [], status: "IN_PROGRESS" };
  }

  recordDart(hit: boolean): DoublesTrainingState {
    const next = applyDart(this.state, hit);
    this.history.push(this.state);
    this.state = next;
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/completion boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): DoublesTarget { /* derived from targetIndex */ }
  visitHistory(): VisitOutcome[] { return this.state.visitHistory; }
  isComplete(): boolean { return this.state.status === "COMPLETE"; }
}
```

No `currentScore`/`result` — there's no score or win/loss outcome in this game, only completion and the fact log.

`recordDart`'s throw only fires if a caller calls it again after completion without undoing first — correcting a completing dart always goes through `undoLastDart()` first.

## 5. Testing Plan

TDD per `app/CLAUDE.md`. Tests under `app/tests/modules/game/doubles-training.engine.module.test.ts` (mirrors source path).

**`applyDart` (pure, tested directly):**

- Hit on dart 1: visit resolves immediately (`hitDartNumber: 1`), target advances, `dartsThisVisit` reset to 0.
- Hit on dart 2 (after a dart-1 miss): visit resolves on dart 2 (`hitDartNumber: 2`), advances.
- Hit on dart 3 (after two misses): visit resolves naturally (`hitDartNumber: 3`), advances.
- All 3 miss: visit resolves after dart 3 with `{ hit: false, hitDartNumber: null }`, still advances.
- A miss on dart 1 or 2 alone (not yet 3): `dartsThisVisit` increments, no `visitHistory` entry yet, target unchanged.
- Full path completion (hit on dart 1 for all 21 targets): `status: "COMPLETE"`, `visitHistory.length === 21`, every entry `{ hit: true, hitDartNumber: 1 }`.
- Bull visit hit → `status: "COMPLETE"` (not just advance).
- Bull visit all-miss → also `status: "COMPLETE"` (session ends after the bull visit regardless of outcome).
- `applyDart` throws when called on a `COMPLETE` state.

**`DoublesTrainingEngine`:**

- `recordDart` delegates correctly; `currentTarget`/`visitHistory`/`isComplete` reflect state.
- `undoLastDart` reverts a hit-that-ended-the-visit dart (target and `dartsThisVisit` restored, the `visitHistory` entry removed).
- `undoLastDart` reverts a miss dart mid-visit (before the 3rd dart).
- `undoLastDart` reverts the completing dart (status back to `IN_PROGRESS`, `visitHistory` shortened, further `recordDart` calls succeed).
- `undoLastDart` returns `false` on empty history.
- Multiple sequential undos walk back further than one visit.
- `recordDart` rejected on a `COMPLETE` engine does not corrupt the undo history (exactly one `undoLastDart()` reverts the completing dart) — this is the exact bug class fixed in both prior engines, worth a direct test here from the start.

## 6. Out of Scope / Future Steps

- Hard mode, Challenge mode, HIGH_TO_LOW/RANDOM order (all V2+ per ruleset).
- Computed hit/miss ratios (overall and per-target) — derivable from `visitHistory` by a future consumer.
- UI, persistence to `turns`/`darts`, `configuration_templates`/`ruleset_versions` wiring (including seeding `DOUBLES_TRAINING` as a new `game_type` — not yet seeded, unlike Singles Training), multiplayer, session lifecycle.
