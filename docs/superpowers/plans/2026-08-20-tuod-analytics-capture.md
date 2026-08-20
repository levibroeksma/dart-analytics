# TUOD Analytics Capture (VISUAL_BOARD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `TUOD_V1` the `ANALYTICS` + `VISUAL_BOARD` capability pair (board-tap, dart-by-dart checkout capture) alongside its existing `RECREATIONAL` + `QUICK_SCORE` capture, resolving the ruleset doc's bust-vs-scoreless-miss known limitation for board sessions.

**Architecture:** `TuodEngine` gains a second input shape (`DartObservation`) and dispatches `record()`/`undo()`/`wouldComplete()` on shape, never on stored mode (D198) — mirrors `OneTwentyOneEngine`'s dual-shape dart path exactly, simplified because TUOD has one visit per attempt and one stage for the whole session (no per-round stage bookkeeping). The validator, capability declaration, DB seed, and frontend each gain the parallel board-capture half already shipped for 501/Score Training/121.

**Tech Stack:** TypeScript, Vitest, Astro.js/Alpine.js, PostgreSQL (Neon) seed/verification SQL.

**Spec:** `docs/superpowers/specs/2026-08-20-tuod-analytics-design.md` (approved).

## Global Constraints

- No schema/migration change — `darts.location_x`/`location_y` and `chk_dart_location_pair` already exist.
- No new scoring rule, config field, or `v_*` view.
- F10 (ladder ceiling / bogey-number gap) is untouched — do not fix it in this work.
- `undo()` is an exact inverse of `record()` over `facts()`; unbounded undo depth (Pattern 18).
- `state()`/`facts()` return derived copies, never live/aliased internals.
- Engines dispatch on input shape, not stored mode (D198).
- A quick-score keypad total is refused while a board visit is open, mirroring 501/121 (D198's consequence) — never written across an open visit.
- `RULESET_CAPABILITIES` (`app/src/lib/game/rulesets/capabilities.ts`) and `database/seeds/0007_ruleset_version_capabilities.sql` must change together, or `capability-seed-parity.test.ts` fails.
- Decisions are append-only: never edit `decisions/game-engine.md`'s existing D153/D154/D198/D216/D217 blocks — this work adds a new D218 block only.
- No `.astro` component tests (D101) — `.astro` changes are verified by `astro check` + manual browser check.
- Every `//`/`/* */` comment inside a function/method body is forbidden in `app/src/**/*.ts` — put necessary detail in JSDoc above the declaration (exempt: `app/tests/`).
- Run `cd app && npm run format` before considering any task done; commit any formatting diffs.

---

## Task 1: Engine — dual-shape dispatch in `tuod.engine.module.ts`

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `TuodInput` union)
- Modify: `app/src/modules/game/tuod.engine.module.ts` (full dual-shape rewrite)
- Test: `app/tests/modules/game/tuod.engine.module.test.ts` (extend)

**Interfaces:**
- Consumes: `DartObservation` (`modules/game/types.ts`, already defined: `{ hitTargetNumber, hitZoneKey, locationX, locationY }`), `classify(x, y): BoardHit` (`@lib/game/board/board-geometry.module`), `TurnFact`/`DartFact`/`StageFact`/`EngineFacts` (`modules/game/types.ts`, unchanged shapes), `checkoutDartsRejection` (`./checkout-darts.module`, unchanged), `newClientKey()` (`./client-key.module`, unchanged).
- Produces: `TuodInput = TuodAttemptInput | DartObservation` (new exported type, `modules/game/types.ts`); `TuodEngine implements GameEngine<TuodInput, TuodState>` — `record(input: TuodInput)`, `undo(): boolean`, `wouldComplete(input: TuodInput): boolean`, `isComplete(): boolean`, `state(): TuodState`, `facts(): EngineFacts`, `expireTimer(): void` — all consumed by Task 3's `tuod-play.data.ts`.

- [ ] **Step 1: Add `TuodInput` to `modules/game/types.ts`**

Find the existing `TuodAttemptInput` type (around line 184) and add the union directly below it:

```typescript
/**
 * Every input `TuodEngine.record()` accepts. A `TuodAttemptInput` is a whole
 * visit reported by the keypad; a `DartObservation` is one board-tapped dart,
 * discriminated by the presence of `hitZoneKey` — mirrors `OneTwentyOneInput`.
 */
export type TuodInput = TuodAttemptInput | DartObservation;
```

(`DartObservation` is already defined further down the same file, so this is a forward reference to a type in the same module — valid TypeScript, no import needed.)

- [ ] **Step 2: Write the failing engine tests for the dart path**

Append to `app/tests/modules/game/tuod.engine.module.test.ts` (after the existing `describe("TUOD checkout dart counts", ...)` block, same file). These tests use `startingTarget: 40` so a single D20 dart (`locationX: 0, locationY: -166`, the same coordinate `one-twenty-one.engine.module.test.ts`/`one-twenty-one-play.data.test.ts` use for D20) checks out in one dart — the smallest fixture that exercises checkout, bust and miss without needing multi-dart arithmetic:

```typescript
import type { DartObservation } from "@modules/types";

const boardConfig = () =>
  ({ ...config(), startingTarget: 40 }) satisfies TuodSnapshot;

/** D20 — 20 doubled, the board's own coordinate for it (see one-twenty-one.engine.module.test.ts). */
const DOUBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  locationX: 0,
  locationY: -166,
};

/** T20 — 60, an overshoot against a target of 40. */
const TREBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

/** S1 — 1, leaves 39 remaining: neither a bust nor a finish, just a thrown dart. */
const SINGLE_1: DartObservation = {
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  locationX: 6,
  locationY: 6,
};

/** An unseen dart: no coordinate, scores 0, changes nothing. */
const UNSEEN: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

describe("TuodEngine.record — dart-by-dart (VISUAL_BOARD)", () => {
  it("checks out on a single dart landing exactly on the target's double", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    const state = engine.record(DOUBLE_20);

    expect(state.currentTarget).toBe(50);
    expect(state.successes).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(40);
    expect(turn.completedAt).not.toBeNull();
    expect(turn.darts).toHaveLength(1);
    expect(turn.darts[0]).toMatchObject({
      hitZoneKey: "DOUBLE",
      hitTargetNumber: 20,
      score: 40,
      locationX: 0,
      locationY: -166,
    });
  });

  it("busts on a single dart that overshoots the target", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    const state = engine.record(TREBLE_20);

    expect(state.currentTarget).toBe(39);
    expect(state.failures).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(0);
    expect(turn.darts[0].score).toBe(60);
  });

  it("builds a visit dart-by-dart across multiple record() calls, closing on checkout", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();

    const state = engine.record(DOUBLE_20);
    expect(state.currentTarget).toBe(50);
    const turn = engine.facts().turns[0];
    expect(turn.completedAt).not.toBeNull();
    expect(turn.darts).toHaveLength(2);
    expect(turn.totalScore).toBe(1);
  });

  it("records a miss when the visit runs out of darts without checking out", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    engine.record(SINGLE_1);
    const state = engine.record(SINGLE_1);

    expect(state.currentTarget).toBe(39);
    expect(state.failures).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(0);
    expect(turn.darts).toHaveLength(3);
  });

  it("records an unseen dart as a scoreless, real dart row", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(UNSEEN);

    const turn = engine.facts().turns[0];
    expect(turn.darts[0]).toMatchObject({
      hitZoneKey: "MISS",
      hitTargetNumber: null,
      score: 0,
      locationX: null,
      locationY: null,
    });
  });

  it("refuses a keypad total while a board visit is open", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    expect(() => engine.record(MISS)).toThrow(/open (visit|attempt)/);
  });

  it("refuses to record a dart once the session is complete", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    engine.record(DOUBLE_20);
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(DOUBLE_20)).toThrow();
  });
});

describe("TuodEngine.undo — dart-shaped turns", () => {
  it("pops one dart, reopening the visit, without discarding the whole attempt", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    engine.record(DOUBLE_20);

    expect(engine.undo()).toBe(true);
    const turn = engine.facts().turns[0];
    expect(turn.darts).toHaveLength(1);
    expect(turn.completedAt).toBeNull();
    expect(turn.totalScore).toBe(1);
  });

  it("pops the whole turn once its last dart is undone", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("restores facts() byte for byte after recording and undoing a dart", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(DOUBLE_20);

    const beforeFacts = engine.facts();
    const beforeState = engine.state();

    engine.record(SINGLE_1);
    expect(engine.undo()).toBe(true);

    expect(engine.facts()).toEqual(beforeFacts);
    expect(engine.state()).toEqual(beforeState);
  });
});

describe("TuodEngine.wouldComplete — dart path, pure", () => {
  it("is true for a dart that checks out the last permitted attempt", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    expect(engine.wouldComplete(DOUBLE_20)).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("is true for a dart that busts the last permitted attempt", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    expect(engine.wouldComplete(TREBLE_20)).toBe(true);
  });

  it("is false for a dart that neither resolves the visit nor is the last permitted attempt", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 2,
    });
    expect(engine.wouldComplete(SINGLE_1)).toBe(false);
  });

  it("is true for the 3rd dart of the last permitted attempt even without a checkout", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    engine.record(SINGLE_1);
    engine.record(SINGLE_1);
    expect(engine.wouldComplete(SINGLE_1)).toBe(true);
  });

  it("does not mutate the fact log", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    const before = engine.facts();
    engine.wouldComplete(DOUBLE_20);
    expect(engine.facts()).toEqual(before);
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: FAIL — `engine.record` throws or misclassifies dart-shaped input (`TuodEngine.record` does not yet accept `DartObservation`), and `TuodInput` does not yet exist.

- [ ] **Step 4: Rewrite `tuod.engine.module.ts` with the dual-shape engine**

Replace the whole file:

```typescript
import type { TuodSnapshot } from "@lib/types";
import { classify } from "@lib/game/board/board-geometry.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { newClientKey } from "./client-key.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  StageFact,
  TuodAttemptInput,
  TuodInput,
  TuodState,
  TurnFact,
} from "./types";

/**
 * The ladder floor: the lowest target a double-out attempt can ever finish
 * from (D1 = 2). A failed attempt that would drop the target below this
 * clamps here instead, so the ladder never strands a session on a target no
 * double can finish.
 */
const MIN_FINISHABLE_TARGET = 2;

/**
 * The single stage a TUOD session is played under. Attempts are turns inside
 * it, not stages of their own — the ruleset has no per-attempt stage concept.
 */
function blockStage(): StageFact {
  return {
    clientKey: "block-1",
    stageTypeKey: "EXERCISE_BLOCK",
    parentClientKey: null,
    sequence: 1,
  };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Whether one reported attempt checked out. Success needs both a checkout and
 * a double as the finishing dart — the number of darts thrown at a double is
 * never consulted, because a visit can throw at several doubles and still miss
 * every one of them. An attempt that reached zero off a single or the bull's
 * outer ring is a failed attempt, exactly as it is in 501.
 */
function isTuodSuccess(input: TuodAttemptInput): boolean {
  return input.checkedOut && input.finishedOnDouble === true;
}

/**
 * Discriminates `TuodInput` by shape, never by session mode: only
 * `DartObservation` carries `hitZoneKey`, so its presence is a sound type
 * guard no matter which mode the session was created in — mirrors
 * `one-twenty-one.engine.module.ts`'s `isDartObservation`.
 */
function isDartObservation(input: TuodInput): input is DartObservation {
  return "hitZoneKey" in input;
}

/** The ladder as it stands before any attempt: on the configured start target. */
export function initialTuodState(config: TuodSnapshot): TuodState {
  return {
    currentTarget: config.startingTarget,
    attempts: 0,
    successes: 0,
    failures: 0,
    timerExpired: false,
  };
}

/**
 * Pure reducer: folds one resolved attempt onto a `TuodState`. A success moves
 * the next target up by `finishBonus`; a failure — a plain miss and a bust
 * alike, since a bust voids the one visit the attempt gets — moves it down by
 * `missPenalty`, floored at the double-out minimum so the ladder never falls
 * onto a target no double can finish. `timerExpired` is carried through
 * untouched: it is not a fold over attempts.
 */
export function applyTuodAttempt(
  config: TuodSnapshot,
  state: TuodState,
  succeeded: boolean,
): TuodState {
  return {
    ...state,
    currentTarget: succeeded
      ? state.currentTarget + config.finishBonus
      : Math.max(
          MIN_FINISHABLE_TARGET,
          state.currentTarget - config.missPenalty,
        ),
    attempts: state.attempts + 1,
    successes: succeeded ? state.successes + 1 : state.successes,
    failures: succeeded ? state.failures : state.failures + 1,
  };
}

/**
 * Ten Up One Down: a checkout ladder starting at `startingTarget`, climbing
 * `finishBonus` on a checked-out attempt and falling `missPenalty` on a failed
 * one, played for a ROUNDS or MINUTES duration. Under RECREATIONAL +
 * QUICK_SCORE the engine owns one turn per attempt, carrying the attempt
 * total with no dart rows; under ANALYTICS + VISUAL_BOARD it owns one dart at
 * a time, building the same one-turn-per-attempt shape dart-by-dart —
 * mirrors `OneTwentyOneEngine`'s dual-shape `record()`, simplified because
 * TUOD has exactly one visit per attempt and one stage for the whole session
 * (no per-round stage bookkeeping). The ladder is derived by folding every
 * CLOSED turn through `applyTuodAttempt`, never accumulated: a successful
 * attempt stores the score it counted and a failed one stores `0`, so a
 * positive total is exactly what marks a success on replay.
 */
export class TuodEngine implements GameEngine<TuodInput, TuodState> {
  readonly rulesetVersionKey = "TUOD_V1";
  private readonly stage: StageFact;
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: TuodSnapshot,
    prior?: EngineFacts,
  ) {
    const priorStage = prior?.stages[0];
    this.stage = priorStage ? { ...priorStage } : blockStage();
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * Folds every CLOSED turn as the attempt that produced it. Never called
   * with an open turn counted in — `deriveState()` is the only caller and
   * keeps an open board visit out of this fold on purpose, exactly as
   * `OneTwentyOneEngine.deriveClosedState` does.
   */
  private deriveClosedState(turns: readonly TurnFact[]): TuodState {
    let state = initialTuodState(this.config);
    for (const turn of turns) {
      if (turn.completedAt === null) continue;
      state = applyTuodAttempt(this.config, state, turn.totalScore > 0);
    }
    return state;
  }

  /**
   * Replays every CLOSED attempt as the outcome that produced it. A turn's
   * `totalScore` is the counted board score, and a failed attempt stores `0`,
   * so `totalScore > 0` reproduces the ladder exactly — the floor in
   * `applyTuodAttempt` runs on every step of the replay, so a rehydrated
   * session lands on the same target a live one folded to. An open board
   * visit contributes nothing until it resolves.
   */
  private deriveState(): TuodState {
    return {
      ...this.deriveClosedState(this.turns),
      timerExpired: this.timerExpired,
    };
  }

  /** How many attempts have actually resolved — an open board visit does not count yet. */
  private closedTurnCount(): number {
    return this.turns.filter((turn) => turn.completedAt !== null).length;
  }

  /**
   * The single completion rule, evaluated against an arbitrary attempt count so
   * both `isComplete()` (the count now) and `wouldComplete()` (the count one
   * attempt ahead) read it rather than restating it.
   */
  private completesAt(attemptCount: number): boolean {
    if (this.config.durationType === "ROUNDS") {
      return attemptCount >= this.config.durationValue;
    }
    return this.timerExpired && attemptCount >= 1;
  }

  /** The attempt still being thrown on the board, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /** Appends an empty attempt to the session's one stage and returns it. */
  private openNewVisit(): TurnFact {
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * The target `visit` was thrown at — every turn strictly before `visit` in
   * `this.turns` is always already closed (an engine only ever has one open
   * turn, the last one), so folding them through `deriveClosedState` is safe
   * and exact. Mirrors `OneTwentyOneEngine.remainingBeforeVisit`.
   */
  private targetBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return this.deriveClosedState(this.turns.slice(0, index)).currentTarget;
  }

  /**
   * Classifies one board observation into the target, zone, and score it
   * struck. A miss carries no coordinates, so it resolves to a scoreless hit
   * using the observation's own zone key rather than going through
   * `classify()` — mirrors `one-twenty-one.engine.module.ts`.
   */
  private resolveObservation(observation: DartObservation) {
    return observation.locationX === null || observation.locationY === null
      ? {
          targetNumber: null,
          zoneKey: observation.hitZoneKey,
          score: 0,
        }
      : classify(observation.locationX, observation.locationY);
  }

  /**
   * Why `record()` would refuse this attempt, or null when it would accept it.
   * `wouldComplete()` reads the same answer, which is what keeps the pure
   * predicate and the mutating call in agreement about what is playable. A
   * keypad total is refused while a board visit is open — mirrors
   * `FiveOhOneEngine.recordVisitTotal`'s guard (D198) — so the two input
   * shapes never write across each other.
   */
  private rejectionReason(input: TuodAttemptInput): string | null {
    if (this.isComplete()) {
      return "Cannot record an attempt once the session is complete; undo first to correct it.";
    }
    if (this.openVisit() !== null) {
      return "Finish the open attempt on the board before entering a keypad total.";
    }
    if (!isTuodSuccess(input)) {
      return null;
    }
    return checkoutDartsRejection(
      this.deriveState().currentTarget,
      input.dartsUsed,
      input.dartsAtDouble,
      this.config.maxDartsPerTurn,
    );
  }

  /**
   * Records that the MINUTES countdown has elapsed. The countdown itself lives
   * in `game.store.ts`, not the engine, so expiry arrives as an explicit call
   * rather than as a write through the object `state()` returned — that object
   * is a derived copy, and writing to it changes nothing.
   */
  expireTimer(): void {
    this.timerExpired = true;
  }

  /**
   * Applies the bust/checkout/out-of-darts rules to an attempt that just took
   * a dart, and stamps `completedAt` when it resolves. A busted attempt and
   * one that simply runs out of darts both store `0` — the ruleset doc's
   * known-limitation fix reads the difference off the darts themselves (an
   * overshoot / remaining-1 / reached-0-without-a-double pattern marks a
   * bust), never off `totalScore`.
   * @returns whether this dart resolved (closed) the attempt.
   */
  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.targetBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const checkedOut =
      remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }
    if (checkedOut) {
      visit.totalScore = thrown;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    const outOfDarts = visit.darts.length === this.config.maxDartsPerTurn;
    if (outOfDarts) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
    }
    return outOfDarts;
  }

  /**
   * Records one dart, opening a fresh attempt once the last one has resolved.
   * Mirrors `OneTwentyOneEngine.recordDart`; TUOD never opens a second stage,
   * unlike 121's per-round stage push, since the whole session is one
   * `EXERCISE_BLOCK`.
   * @throws when the session is already complete; the fact log is left
   *   untouched.
   */
  private recordDart(observation: DartObservation): TuodState {
    if (this.isComplete()) {
      throw new Error(
        "Cannot record an attempt once the session is complete; undo first to correct it.",
      );
    }

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit();

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    this.settleVisit(visit);
    return this.deriveState();
  }

  /**
   * Appends one whole-visit attempt reported by the keypad. A checkout stores
   * the target it was thrown at as the turn total, since the counted board
   * score of a double-out finish always equals it; any failure — a miss, a
   * checkout that did not finish on a double, or a bust — stores `0`.
   * `completedAt` is stamped here because a keypad attempt is a single visit
   * that resolves the moment it is reported.
   * @throws when the session has already ended, a board visit is open, or the
   *   attempt claims more darts than the ruleset allows; the fact log is left
   *   untouched in any case.
   */
  private recordAttemptTotal(input: TuodAttemptInput): TuodState {
    const before = this.deriveState();
    const reason = this.rejectionReason(input);
    if (reason) {
      throw new Error(reason);
    }

    const succeeded = isTuodSuccess(input);
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: succeeded ? before.currentTarget : 0,
      darts: [],
    });

    return this.deriveState();
  }

  record(input: TuodInput): TuodState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordAttemptTotal(input);
  }

  /**
   * Pops the last recorded dart or attempt, including one replayed from
   * persisted facts. Dispatches on the shape of the last recorded turn — a
   * turn built from a keypad total always has `darts: []`; a turn built from
   * a board dart always holds at least one dart from the moment it exists in
   * the log — mirrors `OneTwentyOneEngine.undo`. No stage is ever popped:
   * TUOD's whole session is one stage.
   * @returns true if a dart or an attempt was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    const last = this.turns.at(-1);
    if (!last) return false;
    return last.darts.length > 0 ? this.undoDart() : this.undoAttemptTotal();
  }

  private undoAttemptTotal(): boolean {
    return this.turns.pop() !== undefined;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();
    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
    return true;
  }

  /**
   * Whether recording `observation` right now would resolve the current (or a
   * fresh) attempt — by checkout, bust, or running out of darts — and that
   * resolution would be the session's last permitted attempt. Mirrors
   * `recordAttemptTotal`'s own `wouldComplete` reading (any resolved attempt
   * can end a duration-bounded session, success or not), computed without
   * mutating the fact log.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    if (this.isComplete()) return false;

    const visit = this.openVisit();
    const priorDarts = visit ? visit.darts : [];
    const target = visit
      ? this.targetBeforeVisit(visit)
      : this.deriveState().currentTarget;

    const resolved = this.resolveObservation(observation);
    const thrown =
      priorDarts.reduce((sum, dart) => sum + dart.score, 0) + resolved.score;
    const remainingAfter = target - thrown;
    const checkedOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);
    const dartCount = priorDarts.length + 1;
    const visitResolves =
      checkedOut || busted || dartCount === this.config.maxDartsPerTurn;

    if (!visitResolves) return false;
    return this.completesAt(this.closedTurnCount() + 1);
  }

  /**
   * Answers the finish-confirm gate without touching the fact log. An input
   * `record()` would reject never completes the session — the caller falls
   * through to `record()` and surfaces its error instead.
   */
  wouldComplete(input: TuodInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }
    if (this.rejectionReason(input) !== null) {
      return false;
    }
    return this.completesAt(this.closedTurnCount() + 1);
  }

  isComplete(): boolean {
    return this.completesAt(this.closedTurnCount());
  }

  state(): TuodState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...this.stage }], turns: cloneTurns(this.turns) };
  }
}

export const tuodEngineFactory: GameEngineFactory<
  TuodSnapshot,
  TuodInput,
  TuodState
> = {
  rulesetVersionKey: "TUOD_V1",
  create(config: TuodSnapshot, prior?: EngineFacts) {
    return new TuodEngine(config, prior);
  },
};

registerEngineFactory(tuodEngineFactory);
```

- [ ] **Step 5: Run the engine tests and confirm they all pass**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS — every existing quick-score test plus every new dart-path test.

- [ ] **Step 6: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors. (`TuodInput` used by Task 3's play-data file does not exist there yet, so this step only needs the engine module itself and its test file to be clean — `astro check` covers `.ts` files too, so confirm no new errors were introduced here specifically.)

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/tuod.engine.module.test.ts
git commit -m "feat(tuod): dual-shape engine dispatch for VISUAL_BOARD dart capture

TuodEngine now accepts a DartObservation alongside the existing
TuodAttemptInput, building one attempt dart-by-dart under board
capture while the keypad path is unchanged. Mirrors
OneTwentyOneEngine's dual-shape record()/undo()/wouldComplete()."
```

---

## Task 2: Validator, capability declaration, DB seed/verification

**Files:**
- Modify: `app/src/services/rulesets/tuod/tuod.validator.ts`
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Modify: `database/verification/0007_capability_seed_checks.sql`
- Modify: `app/tests/lib/game/rulesets/capabilities.test.ts`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`
- Test: `app/tests/services/rulesets/tuod/tuod.validator.test.ts` (extend)

**Interfaces:**
- Consumes: `isQuickScoreOrVisualBoardCapture`, `QUICK_SCORE_OR_VISUAL_BOARD_MODES`, `isQuickScoreCapture`, `validateQuickScoreTurns`, `exceedsRoundsLimit` (`../quick-score.validator`, unchanged); `isVisualBoardCapture`, `validateVisualBoardTurns` (`../visual-board.validator`, unchanged, signature `(batch, maxTurnScore) => BatchValidationResult`).
- Produces: `RULESET_CAPABILITIES.TUOD_V1 = [QUICK_SCORE, VISUAL_BOARD]` (consumed by `games-visibility.ts` at runtime, already generic — no code change there per the design).

- [ ] **Step 1: Write the failing validator tests for VISUAL_BOARD**

Append to `app/tests/services/rulesets/tuod/tuod.validator.test.ts`:

```typescript
function batchWithDarts(
  turns: Array<{
    totalScore: number;
    darts: Array<{
      hitTargetNumber: number | null;
      hitZoneKey: string;
      score: number;
      locationX: number | null;
      locationY: number | null;
    }>;
  }>,
) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: turns.map((turn, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: turn.totalScore,
          completedAt: "2026-08-20T10:00:00.000Z",
          darts: turn.darts.map((dart, j) => ({
            sequence: j + 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: dart.hitTargetNumber,
            hitZoneKey: dart.hitZoneKey,
            score: dart.score,
            locationX: dart.locationX,
            locationY: dart.locationY,
          })),
        })),
      },
    ],
  };
}

describe("tuodValidator.validateConfig — VISUAL_BOARD", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = tuodValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("still rejects a mode pair neither capture half supports", () => {
    const result = tuodValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("tuodValidator.validateBatch — VISUAL_BOARD", () => {
  it("accepts a checkout dart re-deriving to the target's double", () => {
    // D20 at (0, -166) — the same coordinate one-twenty-one.validator.test.ts
    // and one-twenty-one.engine.module.test.ts use for D20.
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithDarts([
        {
          totalScore: 40,
          darts: [
            {
              hitTargetNumber: 20,
              hitZoneKey: "DOUBLE",
              score: 40,
              locationX: 0,
              locationY: -166,
            },
          ],
        },
      ]),
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a dart whose claimed score disagrees with its coordinate", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithDarts([
        {
          totalScore: 40,
          darts: [
            {
              hitTargetNumber: 20,
              hitZoneKey: "DOUBLE",
              score: 999,
              locationX: 0,
              locationY: -166,
            },
          ],
        },
      ]),
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a dartless keypad turn inside a VISUAL_BOARD session", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithDarts([{ totalScore: 41, darts: [] }]),
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("still enforces the quick-score path when the session is RECREATIONAL", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([132]),
      existingTurnCount: 0,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the validator tests and confirm they fail**

Run: `cd app && npx vitest run tests/services/rulesets/tuod/tuod.validator.test.ts`
Expected: FAIL — `validateConfig` rejects `ANALYTICS + VISUAL_BOARD` (only `isQuickScoreCapture` is checked today), and `validateBatch` does not accept the new `captureModeKey`/`inputModeKey` arguments in a way that dispatches to `validateVisualBoardTurns`.

- [ ] **Step 3: Rewrite `tuod.validator.ts`**

Replace the whole file:

```typescript
import { TuodConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_OR_VISUAL_BOARD_MODES,
  exceedsRoundsLimit,
  isQuickScoreCapture,
  isQuickScoreOrVisualBoardCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
} from "../visual-board.validator";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

/** The highest three-dart double-out finish on a standard board (T20 T20 D25). */
const MAX_THREE_DART_CHECKOUT = 170;

/**
 * The highest total one TUOD turn can legitimately carry, under either
 * capture mode. A failed attempt scores 0 and a successful one scores exactly
 * the target it was thrown at, so the bound is the highest target the ladder
 * can ever present — capped by the fact that no checkout above 170 exists at
 * all.
 *
 * A ROUNDS session caps the attempt count at `duration_value`, and the ladder
 * climbs at most `finish_bonus` per attempt from `starting_target`, so even an
 * all-success session cannot present a target above
 * `starting_target + finish_bonus * (duration_value - 1)`. A MINUTES session
 * has no attempt cap, so only the checkout ceiling constrains it. The tighter
 * of the two is the real bound: for the seeded 10-round preset that is 131,
 * well below 170, and a turn claiming more could not have been produced by any
 * play of that configuration.
 */
function maxTurnScore(config: Record<string, unknown>): number {
  if (config.duration_type !== "ROUNDS") return MAX_THREE_DART_CHECKOUT;

  const startingTarget = config.starting_target as number;
  const finishBonus = config.finish_bonus as number;
  const durationValue = config.duration_value as number;
  const ladderCeiling = startingTarget + finishBonus * (durationValue - 1);
  return Math.min(ladderCeiling, MAX_THREE_DART_CHECKOUT);
}

/**
 * TUOD supports two mode pairs. Under RECREATIONAL + QUICK_SCORE every turn
 * is a whole attempt with no dart rows. Under ANALYTICS + VISUAL_BOARD every
 * dart carries a landing coordinate, re-derived and cross-checked by
 * `validateVisualBoardTurns` — mirrors `one-twenty-one.validator.ts`.
 */
export const tuodValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`TUOD V1 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`],
      };
    }
    const parsed = TuodConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({
    config,
    batch,
    existingTurnCount,
    captureModeKey,
    inputModeKey,
  }): BatchValidationResult {
    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch, maxTurnScore(config));
    }

    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [`unsupported mode pair ${captureModeKey} + ${inputModeKey}`],
      };
    }

    const turns = validateQuickScoreTurns(batch, maxTurnScore(config));
    if (!turns.valid) return turns;

    if (exceedsRoundsLimit(config, batch, existingTurnCount)) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [`session is limited to ${config.duration_value} attempts`],
      };
    }

    return { valid: true };
  },
};
```

- [ ] **Step 4: Run the validator tests and confirm they pass**

Run: `cd app && npx vitest run tests/services/rulesets/tuod/tuod.validator.test.ts`
Expected: PASS — all existing quick-score tests plus the new VISUAL_BOARD ones.

- [ ] **Step 5: Declare the capability pair in `capabilities.ts`**

In `app/src/lib/game/rulesets/capabilities.ts`, change:

```typescript
  TUOD_V1: [QUICK_SCORE],
```

to:

```typescript
  TUOD_V1: [QUICK_SCORE, VISUAL_BOARD],
```

- [ ] **Step 6: Fix `capabilities.test.ts`'s now-stale assertion**

In `app/tests/lib/game/rulesets/capabilities.test.ts`, remove this test (TUOD now has a visual engine path, so the assertion is false):

```typescript
  it("rejects visual board for a game with no visual engine path", () => {
    expect(supportsMode("TUOD_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(false);
  });
```

Add `"TUOD_V1"` to the `capableRulesets("ANALYTICS", "VISUAL_BOARD")` list assertion (keep it alphabetically sorted, matching the existing `.sort()` call):

```typescript
  it("lists every visual-capable ruleset", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "121_V1",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
```

Add a new assertion next to the existing `supportsMode` tests confirming TUOD now accepts the pair:

```typescript
  it("accepts visual board for TUOD now that it has a board engine path", () => {
    expect(supportsMode("TUOD_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });
```

- [ ] **Step 7: Fix `games-visibility.test.ts`'s now-stale assertion and comment**

In `app/tests/lib/game/rulesets/games-visibility.test.ts`, update the top comment (lines 4-9):

```typescript
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Every carded ruleset now declares a pair under both
// RECREATIONAL and ANALYTICS.
```

Change the ANALYTICS test (previously excluded TUOD_V1) to include it:

```typescript
  it("shows every ANALYTICS-capable carded game under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(
      [
        "SCORE_TRAINING_V1",
        "501_V1",
        "BOBS27_V1",
        "SINGLES_V1",
        "DOUBLES_TRAINING_V1",
        "SHANGHAI_V1",
        "121_V1",
        "AROUND_THE_CLOCK_V1",
        "TUOD_V1",
      ].sort(),
    );
  });
```

Remove the now-redundant test that only made sense while TUOD was quick-score-only:

```typescript
  it("never hides TUOD_V1 under ANALYTICS when it has an active session", () => {
    const keys = visibleGames("ANALYTICS", "TUOD_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("TUOD_V1");
  });
```

(The generic "never hides a game with an active session" test right above it already covers this case for every ruleset, TUOD included, once TUOD is ANALYTICS-capable — this special-cased test's whole reason for existing was the exception, which no longer holds.)

- [ ] **Step 8: Append the seed row**

In `database/seeds/0007_ruleset_version_capabilities.sql`, change:

```sql
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
```

to:

```sql
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('TUOD_V1', 'ANALYTICS', 'VISUAL_BOARD'),
```

Also update the file's own header comment — the "Correction over the original task-2 brief" note lists which rulesets are `RECREATIONAL + DETAILED_DARTS` vs the rest; it does not mention TUOD's pair count, so no further edit is needed there.

- [ ] **Step 9: Update `0007_capability_seed_checks.sql`'s row counts and VALUES lists**

In `database/verification/0007_capability_seed_checks.sql`, change every `14` that means "declared row count" to `15`, and add `('TUOD_V1', 'ANALYTICS', 'VISUAL_BOARD')` to every VALUES list that enumerates the 14/15 triples (there are three: Step 1's assertion text, Step 2's VALUES list, Step 4's VALUES list):

Step 1 (around line 53-60):

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 15 declared rows',
    CASE
        WHEN count(*) = 15 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 15, found %s', count(*))
FROM ruleset_version_capabilities;
```

Step 2's VALUES list (around line 91-107) — add the new row after `('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),`:

```sql
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('TUOD_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
    ) AS declared(ruleset_key, capture_key, input_key)
```

Step 2's own count check (around line 118-127), change both `14`s to `15`:

```sql
INSERT INTO verification_results
SELECT '2',
    'all 15 declared triples were actually checked',
    CASE
        WHEN count(*) = 15 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 15 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

Step 4's VALUES list (around line 186-202) — same addition as Step 2's:

```sql
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('TUOD_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
            ) AS declared(ruleset_key, capture_key, input_key)
```

Also update the file's own header comment listing what it proves (no numbers there to change, just leave as-is — it describes the checks generically).

- [ ] **Step 10: Run the full capability/parity/validator test suite**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts tests/lib/game/rulesets/games-visibility.test.ts tests/lib/game/rulesets/capability-seed-parity.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts tests/services/rulesets/tuod/tuod.validator.test.ts`
Expected: PASS — `capability-seed-parity.test.ts` is fully generic (it diffs the seed file against `RULESET_CAPABILITIES` by regex, no per-ruleset hardcoding) and now finds the two sides agree on 15 triples; `capability-validator-parity.test.ts`'s `rulesetKeys.length` stays 9 (no new ruleset added, just a new pair) so it needs no edit and should already pass.

- [ ] **Step 11: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors.

- [ ] **Step 12: Commit**

```bash
git add app/src/services/rulesets/tuod/tuod.validator.ts app/src/lib/game/rulesets/capabilities.ts database/seeds/0007_ruleset_version_capabilities.sql database/verification/0007_capability_seed_checks.sql app/tests/lib/game/rulesets/capabilities.test.ts app/tests/lib/game/rulesets/games-visibility.test.ts app/tests/services/rulesets/tuod/tuod.validator.test.ts
git commit -m "feat(tuod): declare ANALYTICS + VISUAL_BOARD capability

tuodValidator now dispatches validateBatch on capture mode
(validateVisualBoardTurns vs validateQuickScoreTurns);
RULESET_CAPABILITIES.TUOD_V1 gains VISUAL_BOARD, mirrored into
seed 0007 (14 -> 15 rows) and its verification script."
```

---

## Task 3: Frontend — board input on the TUOD play screen

**Files:**
- Modify: `app/src/lib/game/types.ts` (extend `TuodPlayContext`)
- Modify: `app/src/lib/game/tuod-play.data.ts` (add `recordDart`/`commitDart`, board wiring, dual-dispatch finish confirm)
- Modify: `app/src/components/layout/games/interfaces/TenUpOneDown.astro` (add `BoardInputPanel`, gate keypad)
- Test: `app/tests/lib/game/tuod-play.data.test.ts` (extend)

**Interfaces:**
- Consumes: `boardInputData(onCommit)` (`@lib/game/board-input.data`, unchanged — returns `{ input, board, pointerX, pointerY, syncBoard, magnifier*, onPointer*, recordUnseen, visitMarkers }`), `DartObservation` (`@modules/types`), `TuodEngine.record`/`wouldComplete`/`isComplete` (Task 1, now accept `TuodInput`).
- Produces: `TuodPlayContext.recordDart(observation)`, `TuodPlayContext.commitDart(observation)`, `TuodPlayContext.pendingDartObservation: DartObservation | null` — consumed by `BoardInputPanel.astro` (already generic, reads `recordDart`/`board`/`visitMarkers` etc. off whatever Alpine component includes it, same as `OneTwentyOne`/`FiveOhOne`).

- [ ] **Step 1: Extend `TuodPlayContext` in `lib/game/types.ts`**

Find the `TuodPlayContext` type (starts around line 243) and add three members. Change:

```typescript
export type TuodPlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: TuodResultsSnapshot | null;
  pendingAttempt: TuodAttemptInput | null;
  pendingCheckoutScore: number | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  showDoubleConfirm: boolean;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<TuodSnapshot>;
  engine: TuodEngine | null;
  timer: SegmentTimer | null;
  currentTargetLabel(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string;
  init(this: TuodPlayContext): Promise<void>;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  checkoutDartOptions(this: TuodPlayContext): CheckoutDartOptions;
  submitVisit(this: TuodPlayContext): Promise<void>;
  confirmDouble(this: TuodPlayContext): Promise<void>;
  cancelCheckout(this: TuodPlayContext): void;
  recordAttempt(this: TuodPlayContext, input: TuodAttemptInput): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoAttempt(this: TuodPlayContext): void;
  uploadAndCompleteSession(this: TuodPlayContext): Promise<void>;
  back(this: TuodPlayContext): Promise<void>;
  playAgain(this: TuodPlayContext): Promise<void>;
  abandonAndExit(this: TuodPlayContext): Promise<void>;
  destroy(this: TuodPlayContext): void;
};
```

to (adding `pendingDartObservation`, `recordDart`, `commitDart`):

```typescript
export type TuodPlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: TuodResultsSnapshot | null;
  pendingAttempt: TuodAttemptInput | null;
  pendingCheckoutScore: number | null;
  pendingDartObservation: DartObservation | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  showDoubleConfirm: boolean;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<TuodSnapshot>;
  engine: TuodEngine | null;
  timer: SegmentTimer | null;
  currentTargetLabel(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string;
  init(this: TuodPlayContext): Promise<void>;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  checkoutDartOptions(this: TuodPlayContext): CheckoutDartOptions;
  submitVisit(this: TuodPlayContext): Promise<void>;
  confirmDouble(this: TuodPlayContext): Promise<void>;
  cancelCheckout(this: TuodPlayContext): void;
  recordAttempt(this: TuodPlayContext, input: TuodAttemptInput): Promise<void>;
  recordDart(this: TuodPlayContext, observation: DartObservation): Promise<void>;
  commitDart(this: TuodPlayContext, observation: DartObservation): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoAttempt(this: TuodPlayContext): void;
  uploadAndCompleteSession(this: TuodPlayContext): Promise<void>;
  back(this: TuodPlayContext): Promise<void>;
  playAgain(this: TuodPlayContext): Promise<void>;
  abandonAndExit(this: TuodPlayContext): Promise<void>;
  destroy(this: TuodPlayContext): void;
};
```

`DartObservation` is already imported at the top of `lib/game/types.ts` (line 17 of the earlier read) — no new import needed.

- [ ] **Step 2: Write the failing frontend tests**

The file has no shared `createPlay()` helper — every existing test inlines `const component = { ...tuodPlay(), $store: { game: store, settings: settingsStub() } };` then calls `await component.init.call(component);`, which runs the real D88 reconciliation path (mocked `fetchActiveSessions` resolves `[{ ...ACTIVE_SESSION }]`) and rebuilds `component.engine` from `store.configSnapshot` via `resumeEngine` — so tests must go through `init()` rather than assigning `.engine` directly, exactly like the file's existing tests do. Append a new `describe` block at the end of the file, after the last existing one:

```typescript
import type { DartObservation } from "@modules/types";

/** D20 — the same board coordinate used across every other engine/play test for D20. */
const DOUBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  locationX: 0,
  locationY: -166,
};

/** T20 — an overshoot against a target of 40. */
const TREBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

describe("recordDart (board input)", () => {
  it("records a checkout dart and mirrors it into the store", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(10), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(40);
    expect(store.turns[0].darts[0].hitZoneKey).toBe("DOUBLE");
    expect(component.error).toBe("");
  });

  it("records a busted dart the same way, scoring the turn 0", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(10), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, TREBLE_20);

    expect(store.turns[0].totalScore).toBe(0);
    expect(store.turns[0].darts[0].score).toBe(60);
  });

  it("defers a dart that would end the session to the finish confirm", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(1), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);

    expect(component.showFinishConfirm).toBe(true);
    expect(component.pendingDartObservation).toEqual(DOUBLE_20);
    expect(store.turns).toHaveLength(0);
  });

  it("confirmFinish commits a pending dart and completes the session", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(1), startingTarget: 40 },
    });
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);
    await component.confirmFinish.call(component);

    expect(component.pendingDartObservation).toBeNull();
    expect(component.showFinishConfirm).toBe(false);
    expect(component.finished).toBe(true);
  });

  it("cancelFinish discards a pending dart without recording it", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(1), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordDart.call(component, DOUBLE_20);
    expect(component.showFinishConfirm).toBe(true);

    component.cancelFinish.call(component);

    expect(component.pendingDartObservation).toBeNull();
    expect(component.showFinishConfirm).toBe(false);
    expect(store.turns).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: FAIL — `play.recordDart` does not exist yet (`tuodPlay()` has no such method).

- [ ] **Step 4: Add `self` closure, `recordDart`/`commitDart`, and board wiring to `tuod-play.data.ts`**

In `app/src/lib/game/tuod-play.data.ts`, add two imports at the top (alongside the existing ones):

```typescript
import { boardInputData } from "@lib/game/board-input.data";
```

and extend the type import block to include `DartObservation`:

```typescript
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  EngineFacts,
  TuodAttemptInput,
  TurnFact,
} from "@modules/types";
```

Change the function signature and top of the returned object — from:

```typescript
export function tuodPlay() {
  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as TuodResultsSnapshot | null,
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    pendingAttempt: null as TuodAttemptInput | null,
    pendingCheckoutScore: null as number | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    showDoubleConfirm: false,
    showFinishConfirm: false,
    engine: null as TuodEngine | null,
    timer: null as SegmentTimer | null,
```

to:

```typescript
/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to every
 * directive-driven call — mirrors `one-twenty-one-play.data.ts`'s own `self`
 * pattern.
 */
export function tuodPlay() {
  let self: TuodPlayContext;

  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as TuodResultsSnapshot | null,
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    pendingAttempt: null as TuodAttemptInput | null,
    pendingCheckoutScore: null as number | null,
    pendingDartObservation: null as DartObservation | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    showDoubleConfirm: false,
    showFinishConfirm: false,
    engine: null as TuodEngine | null,
    timer: null as SegmentTimer | null,
    ...boardInputData((observation) => self.recordDart(observation)),
```

In `init()`, assign `self` on the first line of the method body — change:

```typescript
    async init(this: TuodPlayContext) {
      this.loadingReconciliation = true;
```

to:

```typescript
    async init(this: TuodPlayContext) {
      self = this;
      this.loadingReconciliation = true;
```

Add `recordDart` and `commitDart` methods right after the existing `recordAttempt` method:

```typescript
    /**
     * The board's per-dart counterpart to `recordAttempt`: every dart the
     * player throws arrives here from `boardInputData`'s `onCommit`. A dart
     * that would end the session is gated behind `showFinishConfirm` — the
     * same dialog the keypad path defers to — because recording it uploads
     * and completes the session immediately and that step is irreversible;
     * any other dart commits straight away. Mirrors
     * `one-twenty-one-play.data.ts`'s `recordDart`.
     */
    async recordDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.error = "";
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    /**
     * Records one dart against the engine and refreshes displayed state,
     * exactly as `recordAttempt` does for a whole visit — shared by the
     * immediate path (`recordDart`) and the deferred finish confirm
     * (`confirmFinish`).
     */
    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (!this.engine) return;

      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }

      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },
```

Change `confirmFinish` to dispatch on whichever input is pending — from:

```typescript
    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;
      if (this.pendingAttempt === null) return;

      const input = this.pendingAttempt;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },
```

to:

```typescript
    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }

      if (this.pendingAttempt === null) return;
      const input = this.pendingAttempt;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },
```

Change `cancelFinish` to also clear a pending dart — from:

```typescript
    cancelFinish(this: TuodPlayContext) {
      if (!this.showFinishConfirm) return;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;
    },
```

to:

```typescript
    cancelFinish(this: TuodPlayContext) {
      if (!this.showFinishConfirm) return;
      this.pendingAttempt = null;
      this.pendingDartObservation = null;
      this.showFinishConfirm = false;
    },
```

Also add `pendingDartObservation = null` to `playAgain()`'s reset block, alongside the existing `this.pendingAttempt = null;` line, so a replayed session does not carry over a stale pending dart from the prior one.

- [ ] **Step 5: Run the frontend tests and confirm they pass**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Add `BoardInputPanel` and gate the keypad in `TenUpOneDown.astro`**

Replace the whole file:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <SinglePlayerDisplay
    isTarget={true}
    target="currentTargetLabel()"
    class="max-h-2/5 h-full"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        <StatRow
          label="Attempts"
          value="$store.game.turns.length"
        />
        <StatRow
          label="Successes"
          value="$store.game.turns.filter((t) => t.totalScore > 0).length"
        />
        <StatRow
          label="Failures"
          value="$store.game.turns.filter((t) => t.totalScore === 0).length"
        />
      </dl>
    </div>
  </SinglePlayerDisplay>

  <div
    class="flex justify-center items-center gap-2 px-3"
    x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
    x-cloak
  >
    <p
      class="text-lg font-bold font-mono text-muted-foreground"
      x-text="remainingLabel()"
    >
    </p>
  </div>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showFinishConfirm || finished"
    padDisabled="showDoubleConfirm || showFinishConfirm || finished"
    undoClick="undoAttempt()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showFinishConfirm || finished"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
    class="px-3"
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

(Only two changes from the current file: the `BoardInputPanel` import + its element at the bottom, and `x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"` + `x-cloak` added to `ScoreInput` — the exact `OneTwentyOne.astro`/`FiveOhOne.astro` diff. `undoClick`/`undoDisabled` are untouched: `undoAttempt()` already dispatches correctly regardless of which input shape produced the last turn, since `TuodEngine.undo()` handles both.)

- [ ] **Step 7: Typecheck**

Run: `cd app && npx astro check`
Expected: 0 errors.

- [ ] **Step 8: Manual browser verification**

Start the dev server in the background (`astro dev --background`, per `app/CLAUDE.md`), then:
1. Set the app mode to Analytics (`ANALYTICS` capture mode) in Settings.
2. Start a new TUOD session — confirm the board (not the keypad) renders.
3. Tap a dart that overshoots the target — confirm it registers as a failed attempt (target drops by 1) and the board shows the dart marker.
4. Tap a dart that lands exactly on the current target's double — confirm the attempt is recorded as a success (target climbs by 10).
5. Throw a 2-dart visit (a non-resolving dart, then a checkout dart) — confirm both darts appear against the same attempt before it resolves.
6. Undo — confirm it pops one dart at a time, not the whole attempt, until the attempt itself disappears.
7. Switch back to Recreational mode mid-testing (new session) — confirm the keypad flow (D217's `CheckoutConfirm` dialog) still works exactly as before.
8. Stop the dev server (`astro dev stop`).

Expected: every step above behaves as described; no console errors.

- [ ] **Step 9: Format**

Run: `cd app && npm run format`
Expected: no diff, or only whitespace/quote-style changes from the new code — commit any.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/tuod-play.data.ts app/src/components/layout/games/interfaces/TenUpOneDown.astro app/tests/lib/game/tuod-play.data.test.ts
git commit -m "feat(tuod): board input on the play screen

tuodPlay() gains recordDart/commitDart wired through
boardInputData, dispatching the same finish-confirm gate the
keypad path already uses. TenUpOneDown.astro renders
BoardInputPanel and hides the keypad under VISUAL_BOARD, mirroring
OneTwentyOne.astro/FiveOhOne.astro."
```

---

## Task 4: Docs — known-limitation scoping and decision entry

**Files:**
- Modify: `docs/game-rules/rulesets/ten-up-one-down.md`
- Modify: `decisions/game-engine.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Scope the Known Limitations section to QUICK_SCORE**

In `docs/game-rules/rulesets/ten-up-one-down.md`, replace the "Known limitations" section:

```markdown
## Known limitations

**A bust cannot be told apart from a scoreless attempt**, for the same reason 501 cannot: both persist as a turn total of `0` with no dart rows. Bust rate is therefore not computable, and checkout percentage undercounts attempts. Recovering either requires DETAILED_DARTS capture or a schema revision adding an attempted-score / void-visit fact; both are on the deferred list in `DECISIONS.md`. <!-- 2026-07-26 -->
```

with:

```markdown
## Known limitations

**Under RECREATIONAL + QUICK_SCORE, a bust cannot be told apart from a scoreless attempt**: both persist as a turn total of `0` with no dart rows. Bust rate is therefore not computable under this capture mode, and checkout percentage undercounts attempts. Recovering either requires DETAILED_DARTS/VISUAL_BOARD capture or a schema revision adding an attempted-score / void-visit fact for QUICK_SCORE itself; QUICK_SCORE sessions remain unfixable, since completed gameplay is immutable and no per-dart fact exists to recover from. <!-- 2026-07-26 -->

**Retired for ANALYTICS + VISUAL_BOARD sessions.** Every dart carries a real landing coordinate and score, so a bust and a plain miss are distinguishable by the pattern in the persisted darts: a bust's darts show an overshoot, a remaining score of exactly 1, or reaching 0 without the last dart in a double; a miss's three darts land short of the target with none of those patterns. No `v_*` view yet queries this distinction — the fact log supports it, and building the view is future work. <!-- 2026-08-20 -->
```

- [ ] **Step 2: Append the D218 decision entry**

In `decisions/game-engine.md`, append a new entry after D217 (the file's last block), following the same `### D2NN — <title>` format D216/D217 use:

```markdown

### D218 — Ten Up One Down joins the dual-capture set (ANALYTICS + VISUAL_BOARD)
Status: Accepted · Date: 2026-08-20
Decision: `TuodEngine` gains a second `record()`/`undo()`/`wouldComplete()` shape for `DartObservation`, dispatching on input shape per D198, never on stored mode — mirrors `OneTwentyOneEngine`'s dual-shape dart path, simplified because TUOD has exactly one visit per attempt and one `EXERCISE_BLOCK` stage for the whole session (no per-round stage bookkeeping to add). `tuodValidator.validateConfig` now accepts `ANALYTICS + VISUAL_BOARD` via `isQuickScoreOrVisualBoardCapture`, and `validateBatch` dispatches to `validateVisualBoardTurns` under it. `RULESET_CAPABILITIES.TUOD_V1` becomes `[QUICK_SCORE, VISUAL_BOARD]`, mirrored into seed `0007` (14 → 15 rows) and its verification script. `TenUpOneDown.astro` renders `BoardInputPanel` and hides the keypad under `VISUAL_BOARD`, exactly like `OneTwentyOne.astro`/`FiveOhOne.astro`; the D217 `CheckoutConfirm` dialog stays QUICK_SCORE-only, bypassed entirely under board capture the same way 501/121 already bypass their own keypad confirm.
Reason: TUOD (D153/D216/D217) was the only ruleset left declaring `RECREATIONAL + QUICK_SCORE` alone — 501, Score Training and 121 had already paired it with `ANALYTICS + VISUAL_BOARD` (D189/D198, `2026-08-15-121-shanghai-atc-analytics-design.md`). Doing the same for TUOD was also the chosen way to resolve the ruleset doc's own stated known limitation (bust indistinguishable from a scoreless miss): real per-dart facts under `VISUAL_BOARD` make the two recomputable from the fact log alone, with no new field — an explicit design goal for this work, not an incidental side effect.
Consequences: `docs/game-rules/rulesets/ten-up-one-down.md`'s Known Limitations section is now scoped to `QUICK_SCORE` and gains a "Retired for VISUAL_BOARD sessions" note, matching D189's wording for 501. No `v_*` view yet surfaces the newly-derivable bust/miss distinction — that remains future work. F10 (the ladder's missing ceiling) is untouched, an unrelated open finding. `capabilities.test.ts`'s "rejects visual board for a game with no visual engine path" assertion (written when TUOD was the one ruleset without a board path) and `games-visibility.test.ts`'s TUOD-specific active-session carve-out test are both removed as no-longer-true special cases, not re-pointed at a different guarantee — the games-visibility generic "never hides a game with an active session" test already covers TUOD once it is ANALYTICS-capable.
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-rules/rulesets/ten-up-one-down.md decisions/game-engine.md
git commit -m "docs(tuod): scope known-limitation to QUICK_SCORE; record D218

The bust-vs-scoreless-miss ambiguity is now VISUAL_BOARD-resolved,
matching D189's 501 precedent. D218 records TUOD joining the
dual-capture set — decisions/** stays append-only, D153/D216/D217
are unchanged."
```

---

## Task 5: Full validation and context maintenance

**Files:** none new — this task runs the repo's validation gates and the context-maintenance checklist across everything Tasks 1-4 touched.

**Interfaces:** none.

- [ ] **Step 1: Run the full app validation suite**

Run: `cd app && npm run validate:app`
Expected: passes — typecheck, lint, full Vitest suite (including `scripts/check-game-engines.sh`, `scripts/check-game-wiring.sh`, `scripts/check-refinement-coverage.sh`, and every other pre-commit structural gate `app/CLAUDE.md` lists), format check.

If anything fails, fix it in place (do not weaken or delete a check to pass it) and re-run until clean.

- [ ] **Step 2: Refresh the knowledge graph**

Run: `bash scripts/refresh-graph.sh` (from repo root)
Expected: `graphify-out/graph.json` updates to reflect the new `TuodInput` type, the dual-shape `TuodEngine`, and the validator/capability changes. If the `graphifyy` CLI is not installed in this container, the script warns instead of failing (per `app/CLAUDE.md`) — note in the completion report that a fresh CI-driven refresh (`.github/workflows/graph.yml`) will supersede this on merge to `main`, per D185; do not hand-edit `graphify-out/graph.json`.

- [ ] **Step 3: Confirm no FINDINGS.md entry is needed for this task, and check off nothing more than what was asked**

Re-read `FINDINGS.md`. This task's scope was fixed by the approved spec (Task 1-4 above); if anything was noticed along the way that the spec did not ask for (e.g., an unrelated stale comment, a different bug), it must be logged in `FINDINGS.md` and raised in the completion report — never fixed in this same pass, per the root `CLAUDE.md` Hard Invariant. F10 (the TUOD ladder's missing ceiling) is the one known pre-existing finding this work deliberately leaves untouched; confirm it is still present in `FINDINGS.md` unchanged.

- [ ] **Step 4: Final commit (context maintenance only, if anything changed)**

If `scripts/refresh-graph.sh` produced a diff and CI's own `chore/graph-refresh` PR mechanism is not expected to run in this environment, commit the graph update separately:

```bash
git add graphify-out/graph.json
git commit -m "chore: refresh knowledge graph after TUOD analytics capture"
```

(Skip this step entirely if the script only warned, or if the repo's convention is to leave graph refresh to CI per D185 — confirm against `.github/workflows/graph.yml` before committing a local graph diff.)

- [ ] **Step 5: Push the branch**

```bash
git push -u origin claude/tuod-analytics-plan-os3v5f
```

Do not open a pull request unless the user explicitly asks for one.

---

## Spec Coverage Check (self-review)

- §1 Engine → Task 1 (all bullet points: `TuodInput`, `isDartObservation`, `resolveObservation`, `record` dispatch, `recordDart`/`settleVisit`, `undo` dispatch, `wouldComplete` dispatch, real coordinates never fabricated).
- §2 Validator → Task 2, Steps 1-4.
- §3 Capability & seed → Task 2, Steps 5-10.
- §4 Frontend → Task 3.
- §5 Docs → Task 4.
- §6 Testing → engine tests (Task 1), validator tests (Task 2), play-data tests (Task 3); parity/wiring tests re-verified in Task 2 Step 10 and Task 5 Step 1; no `.astro` tests written, per D101.
- §7 Edge cases → covered by Task 1's `settleVisit`/`recordDart` construction (a bust closes the turn immediately, so no later dart can land against it) and Task 3's reliance on the existing generic `resumeEngine`/timer-expiry paths, unchanged from the quick-score-only engine.
- Out of scope / deferred → no task adds a `v_*` view, touches F10, or changes `checkout-darts.module.ts`/`CheckoutConfirm.astro`.
- Context Maintenance → Task 4 (docs, decision) + Task 5 (graph, findings check).

No gaps found against the spec.
