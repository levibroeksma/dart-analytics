# Bob's 27 Engine — Design (V1 Traditional, Engine Only)

Status: approved (brainstorming). Scope: pure game-logic engine only — no UI, no persistence, no config/session wiring.

Source ruleset: `docs/game-rules/rulesets/bobs-27.md`.

## 1. Scope & Non-Goals

**In scope:** pure-logic engine for Bob's 27, V1 Traditional, single player. Target progression D1→D20→bull, 3-dart visits, scoring (hits add immediately; full-miss visit subtracts once), win/loss detection, one-dart-back undo.

**Non-goals (deferred):** Easy/beginner variant, multiplayer, DartBot, `configuration_templates`/`ruleset_versions` integration, turn/dart DB row mapping, dart-fact recording (intended/hit zone), session lifecycle, UI (confirmation modal, summary modal).

## 2. Domain Model / Types

```ts
type Bobs27Target = { kind: "DOUBLE"; number: number } | { kind: "BULL" };
// Path: DOUBLE 1..20, then BULL. Fixed constant in V1 — not configurable.

type Bobs27State = {
  targetIndex: number;      // 0..20 (0-19 = D1-D20, 20 = BULL)
  score: number;             // starts at 27
  dartsThisVisit: boolean[]; // hits so far in current visit, max length 3
  status: "IN_PROGRESS" | "WON" | "LOST";
};

const BOBS27_START_SCORE = 27;
const BULL_HIT_VALUE = 50; // inner bull only counts as a hit; outer 25 = miss
```

Target value for scoring: `DOUBLE n` → `n`; `BULL` → `50`.

`BULL` is conceptually "double bull" (inner bull, 50) — the path's final double, consistent with D1-D20 all being doubles. Outer bull (25) is not a distinct target in V1; it counts as a miss.

## 3. Pure Reducer — `applyDart(state: Bobs27State, hit: boolean): Bobs27State`

1. If `state.status !== "IN_PROGRESS"`, throw (caller error — must `undoLastDart()` first to correct a game-ending dart).
2. Append `hit` to `dartsThisVisit`.
3. If `hit` is `true`: `score += targetValue` **immediately** (this dart, not deferred to visit end).
4. If `dartsThisVisit.length < 3`, return the updated state (visit not finished).
5. Visit finished (3rd dart just recorded):
   - If all 3 darts missed (`dartsThisVisit` all `false`): `score -= 1 * targetValue`.
   - Reset `dartsThisVisit = []`.
6. Determine end state:
   - If `score <= 0` → `status = "LOST"`.
   - Else if this was the BULL visit (`targetIndex === 20`) → `status = "WON"`.
   - Else → `targetIndex += 1`, stays `IN_PROGRESS`.
7. Return a new state object (no mutation of the input).

Edge case: a full-miss on BULL that drops score to ≤0 → `LOST` takes priority over the bull-completion `WON` check (encoded by step 6's ordering).

Function is pure and side-effect free; `Bobs27Engine` owns all mutable state and history.

## 4. Class API — `Bobs27Engine`

Mirrors the call-site shape of `app/src/modules/game/score-training.engine.module.ts`'s `ScoreTrainingEngine`, delegating logic to `applyDart`.

```ts
class Bobs27Engine {
  private state: Bobs27State;
  private history: Bobs27State[] = [];

  constructor(startingScore = BOBS27_START_SCORE) {
    this.state = { targetIndex: 0, score: startingScore, dartsThisVisit: [], status: "IN_PROGRESS" };
  }

  recordDart(hit: boolean): Bobs27State {
    const next = applyDart(this.state, hit);
    this.history.push(this.state);
    this.state = next;
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/game-over boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): Bobs27Target { /* derived from targetIndex */ }
  currentScore(): number { return this.state.score; }
  isGameOver(): boolean { return this.state.status !== "IN_PROGRESS"; }
  result(): "WON" | "LOST" | null {
    return this.state.status === "IN_PROGRESS" ? null : this.state.status;
  }
}
```

`recordDart`'s throw only fires if a caller calls it again after game-over without undoing first — correcting a game-ending dart always goes through `undoLastDart()` first.

## 5. Testing Plan

TDD per `app/CLAUDE.md`. Tests under `app/tests/modules/game/bobs27.engine.module.test.ts` (mirrors source path).

**`applyDart` (pure, tested directly):**

- Single hit on D1: score 27→28, target unchanged, visit continues.
- 3 hits on D1: score 27→30, each applied on its own dart (verify intermediate values after dart 1 and 2).
- 3 misses on D1: score unchanged after darts 1 and 2; drops to 26 only after the 3rd.
- Mixed hit/miss/hit on D1: 2 hits → 27→29, visit resolves as non-full-miss (no penalty), advances to D2.
- Full path completion with all hits → reaches BULL, 3 bull hits (+50 each) → `WON`.
- Score driven to exactly 0 by a full-miss visit → `LOST`.
- Full miss on BULL dropping score ≤0 → `LOST` wins over `WON`.
- Full miss on BULL with score remaining positive → `WON`.
- `applyDart` throws when called on a `WON`/`LOST` state.

**`Bobs27Engine`:**

- `recordDart` delegates correctly; `currentTarget`/`currentScore`/`isGameOver`/`result` reflect state.
- `undoLastDart` reverts a hit (score decrement undone).
- `undoLastDart` reverts a full-miss visit's 3rd dart (penalty undone, visit re-opened, `dartsThisVisit` restored).
- `undoLastDart` reverts a game-ending dart (status back to `IN_PROGRESS`, subsequent `recordDart` calls succeed).
- `undoLastDart` returns `false` on empty history (fresh engine).
- Multiple sequential undos walk back further than one visit.

## 6. Out of Scope / Future Steps

- UI: last-dart confirmation modal (same pattern as Score Training), submit → summary modal, cancel → `undoLastDart()`.
- Persistence: mapping `Bobs27State`/dart history to `turns`/`darts` runtime rows, dart-level intended/hit zone facts.
- `configuration_templates` / `ruleset_versions` / `exercise_configurations` wiring (game_type seed, config presets — see `10-Database-Agent-Guide.md` §"Add a new game type").
- Easy/beginner variant, multiplayer, DartBot (per `docs/game-rules/rulesets/bobs-27.md` "Later versions").
- Session lifecycle integration (start/complete `exercise_sessions`).

## 7. Open Questions Resolved From Ruleset Doc

- Bull scoring: inner bull (50) only counts as a hit; outer 25 counts as a miss for this game (resolved during brainstorming, supersedes the "open question" note in `docs/game-rules/rulesets/bobs-27.md`).
- Multi-hit math: confirmed — each hit adds the target's face value, applied per-dart as it happens (not batched at visit end).
- Bull identity: inner bull (50) is "double bull" — the path's final double, same category as D1-D20. Forward-compat note for the later persistence step: `darts.hit_target_number` is constrained to 1-25 and bull's *target number* is 25 regardless of inner/outer; `BULL_HIT_VALUE = 50` is a *score* value (double bull), not a target number — don't conflate the two when mapping engine state to `darts` rows.
