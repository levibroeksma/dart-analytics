# 501 Engine — Design (V1 Single-Leg, Engine Only)

Status: approved (brainstorming). Scope: pure game-logic engine only — no UI, no persistence, no config/session wiring.

Source ruleset: `docs/game-rules/rulesets/501.md`.

`FiveOhOneEngine` is the one, ongoing engine for 501 — this spec covers its V1 single-leg slice. Multi-leg match orchestration (first-to-N legs) is a later version of this same class, not a separate engine.

## 1. Scope & Non-Goals

**In scope:** `FiveOhOneEngine` V1 — single-leg logic only: starting score 501 (parameterized, so 301/701 work too), open in, double out, bust detection, checkout validation, one-visit-back undo. Recreational (turn-total) input — matches `RECREATIONAL` + `QUICK_SCORE` capture mode (turn totals only, no dart rows).

**Non-goals for this version (deferred to a later version of the same engine, not a separate class):** multi-leg match orchestration (first-to-N legs), analytics/per-dart capture mode, double in/master in/master out/straight out, alternate start scores as a config surface, multiplayer, `configuration_templates`/`ruleset_versions` wiring, turn/dart DB persistence, UI.

## 2. Domain Model / Types

```ts
type FiveOhOneCheckout = {
  dartsUsed: 1 | 2 | 3;         // how many darts were thrown this visit
  dartsOnDouble: 0 | 1 | 2 | 3;  // how many of those darts were aimed at/landed on a double
};

type FiveOhOneVisitOutcome = {
  scoreAttempted: number;
  isBust: boolean;
  remainingAfter: number;         // remaining score after this visit (unchanged from before if bust)
  checkout?: FiveOhOneCheckout;   // present only when this visit reached exactly 0 (win or a finished-on-non-double bust)
};

type FiveOhOneState = {
  remainingScore: number;
  visitHistory: FiveOhOneVisitOutcome[];
  status: "IN_PROGRESS" | "WON";
};

const FIVE_OH_ONE_START_SCORE = 501;
```

No dart-level fields (intended/hit zone) — recreational mode only stores the visit's attempted total and, when relevant, checkout dart counts. `visitHistory` is the fact store, same "store facts" principle as the other three engines (Pattern 9).

## 3. Pure Reducer — `applyVisit(state: FiveOhOneState, scoreAttempted: number, checkout?: FiveOhOneCheckout): FiveOhOneState`

1. If `state.status !== "IN_PROGRESS"`, throw.
2. `wouldRemain = state.remainingScore - scoreAttempted`.
3. Determine the outcome:
   - `wouldRemain < 0` → **bust** (overshoot).
   - `wouldRemain === 1` → **bust** (1 can never be finished under double-out — the minimum double is D1 = 2).
   - `wouldRemain === 0` → requires `checkout` with `dartsOnDouble >= 1` to count as a **win**; otherwise **bust** (reached 0 without a qualifying double).
   - `wouldRemain > 1` → legal reduction, not a bust.
4. Record a `FiveOhOneVisitOutcome`:
   - Bust: `{ scoreAttempted, isBust: true, remainingAfter: state.remainingScore, checkout }` (`checkout` only attached if one was passed — even a non-qualifying attempt is a fact worth keeping; `remainingScore` is unchanged).
   - Win: `{ scoreAttempted, isBust: false, remainingAfter: 0, checkout }`.
   - Legal reduction: `{ scoreAttempted, isBust: false, remainingAfter: wouldRemain }`.
5. `status = "WON"` only on the win case; otherwise stays `"IN_PROGRESS"`.
6. `remainingScore` becomes `remainingAfter` from the recorded outcome (i.e. unchanged on bust).
7. Return a new state object (no mutation of the input or `visitHistory`).

`checkout` is only consulted when `wouldRemain === 0`; if passed on a non-zero-result visit it's ignored (not an error — permissive, matches recreational input trust).

Function is pure and side-effect free; `FiveOhOneEngine` owns all mutable state and history.

## 4. Class API — `FiveOhOneEngine`

Mirrors `Bobs27Engine`/`SinglesTrainingEngine`/`DoublesTrainingEngine`'s call-site shape. `recordVisit` applies the reducer before pushing to history (apply-first, push-second — baked in from the start, same as the last two engines).

```ts
class FiveOhOneEngine {
  private state: FiveOhOneState;
  private history: FiveOhOneState[] = [];

  constructor(startingScore: number = FIVE_OH_ONE_START_SCORE) {
    this.state = { remainingScore: startingScore, visitHistory: [], status: "IN_PROGRESS" };
  }

  recordVisit(scoreAttempted: number, checkout?: FiveOhOneCheckout): FiveOhOneState {
    const next = applyVisit(this.state, scoreAttempted, checkout);
    this.history.push(this.state);
    this.state = next;
    return this.state;
  }

  /** Reverts exactly the last recorded visit, one at a time, even across win boundaries. */
  undoLastVisit(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentScore(): number { return this.state.remainingScore; }
  visitHistory(): FiveOhOneVisitOutcome[] { return this.state.visitHistory; }
  isComplete(): boolean { return this.state.status === "WON"; }
}
```

`startingScore` defaults to 501 but is a constructor parameter, so 301/701 (V2+ per ruleset) already work without engine changes when that config surface lands later.

`recordVisit`'s throw only fires if a caller calls it again after a win without undoing first — correcting a winning visit always goes through `undoLastVisit()` first.

## 5. Testing Plan

TDD per `app/CLAUDE.md`. Tests under `app/tests/modules/game/five-oh-one.engine.module.test.ts` (mirrors source path).

**`applyVisit` (pure, tested directly):**

- Legal reduction (e.g. 501 → 45 scored → 456 remaining): not a bust, stays `IN_PROGRESS`.
- Overshoot bust (score > remaining): remaining unchanged, `isBust: true`.
- Leaves-exactly-1 bust (`wouldRemain === 1`): bust even though not negative — 1 can never be finished under double-out.
- Reaches 0 with a valid checkout (`dartsOnDouble >= 1`): `status: "WON"`, `remainingAfter: 0`.
- Reaches 0 with no `checkout` passed: bust, remaining unchanged.
- Reaches 0 with `checkout.dartsOnDouble === 0` (finished on a non-double): bust, remaining unchanged, but the `checkout` fact is still recorded in the outcome.
- `checkout` passed on a visit that doesn't reach exactly 0: ignored, no effect, not an error.
- `applyVisit` throws when called on a `WON` state.

**`FiveOhOneEngine`:**

- `recordVisit` delegates correctly; `currentScore`/`visitHistory`/`isComplete` reflect state.
- `undoLastVisit` reverts a legal-reduction visit (score restored).
- `undoLastVisit` reverts a bust visit (`visitHistory` entry removed; score already was unchanged).
- `undoLastVisit` reverts the winning visit (status back to `IN_PROGRESS`, score restored, further `recordVisit` calls succeed).
- `undoLastVisit` returns `false` on empty history.
- Multiple sequential undos walk back further than one visit.
- `recordVisit` rejected on a `WON` engine does not corrupt the undo history (phantom-entry regression, same pattern as `SinglesTrainingEngine`/`DoublesTrainingEngine`).

## 6. Out of Scope / Future Steps

- Multi-leg match orchestration (first-to-N legs) — a later version of this same `FiveOhOneEngine`, not a separate class.
- Analytics/per-dart capture mode, double in/master in/master out/straight out, alternate start scores as a config surface, multiplayer.
- UI, persistence to `turns`/`darts`, `configuration_templates`/`ruleset_versions` wiring (existing seed data — `game_types` "501", `ruleset_versions` "501_V1", `configuration_templates` "501 — Quick Play" / "501 — Best of 5 Legs" — is already consistent with this V1 scope, unlike the Singles Training seed/doc mismatch), session lifecycle.
