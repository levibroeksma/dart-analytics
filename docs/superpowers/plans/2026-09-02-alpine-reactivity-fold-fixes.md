# Alpine reactivity fold fixes (6 play controllers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six `*-play.data.ts` files (Score Training, Shanghai, Doubles Training, Around the Clock, Bob's 27, Singles Training) whose `state()` reads `this.engine?.state()` — a plain, non-reactive class instance — instead of folding `$store.game`'s own Alpine-tracked `stages`/`turns` fields, so `x-text`/`x-show` expressions re-render on every recorded dart.

**Architecture:** Every fix is the same one-line-of-reasoning substitution already shipped for TUOD and 501: `state()` becomes `foldXState({ stages: this.$store.game.stages, turns: this.$store.game.turns }, config)`. Two games (Score Training, Shanghai) already export their fold function from the engine module — pure `state()`-swap. Three games (Doubles Training, Around the Clock, Singles Training) already have their fold logic in a private, unexported module-level function that `deriveState()` delegates to — those need only the `export` keyword added, not a real extraction (see **Scope correction** below). One game (Bob's 27) genuinely inlines its fold logic inside the engine class's private `deriveState()` method and needs it extracted into a new exported `foldBobs27State` function first.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Scope correction against the spec's own claim

The spec (`docs/superpowers/specs/2026-09-02-alpine-reactivity-fold-fixes-design.md`) states for all four "Shape B" games that "each derive state through a **private** `deriveState()` method on the engine class, never extracted to a standalone function" and that each task "first extract[s] that method's body into an exported `foldXState(facts, config)` function." Reading the four engine modules directly shows this is only true for one of them:

- `doubles-training.engine.module.ts`: `deriveState()` already delegates to a module-level `function foldDoublesTrainingState(facts, config)` (line 138) — it is just not `export`ed.
- `around-the-clock.engine.module.ts`: same shape — `deriveState()` delegates to `function foldAroundTheClockState(facts, config)` (line 126), not exported. Its own JSDoc even says so explicitly: *"Module-private: the play page reads state through `this.engine?.state()`... so nothing outside this file calls it (mirroring `foldSinglesTrainingState` and `foldDoublesTrainingState`, which are private for the same reason)."*
- `singles-training.engine.module.ts`: same shape — `deriveState()` delegates to `function foldSinglesTrainingState(facts, config)` (line 191), not exported.
- `bobs27.engine.module.ts`: **this one matches the spec's description exactly** — `deriveState()` computes `seats`/`winningSideKey`/`status` inline, with no separate fold function to delegate to.

So three of the four "Shape B" tasks are `export` additions (plus, for Around the Clock, a one-sentence JSDoc correction since its comment explicitly asserts privacy that is about to become false); only Bob's 27 needs a real extraction. Task sizing below reflects this. No task in this plan is dropped or added relative to the spec — all six games still get their `state()` swapped — only the engine-module half of four of those tasks is smaller than the spec described.

## Global Constraints

- D224 (`scripts/check-test-coverage.sh`, pre-commit): a changed runtime `.ts` file needs a test in the same change set that imports it — coverage is by import, not filename. Every task below touches a test file that imports every source file it changes.
- Never put `//` or `/* */` comments inside a TypeScript function/method body (`app/CLAUDE.md`). JSDoc above a declaration is fine and used throughout this plan.
- `npm run validate:app` must pass — 0 errors, 0 warnings, 0 hints — before any task is claimed done.
- Specs are historical records once written; nothing in `docs/superpowers/specs/2026-09-02-alpine-reactivity-fold-fixes-design.md` is edited during implementation, including to reflect the scope correction above (that correction lives in this plan and, if needed, in `FINDINGS.md`/completion report, never as a spec rewrite).
- Every task uses a dedicated branch, checked out directly in the main working copy — no git worktrees (`git checkout -b fix/alpine-reactivity-fold-fixes`).
- Commit after each sub-step marked **Commit** below; never bundle two tasks' changes into one commit.
- Closes `FINDINGS.md` F31. The F31 entry is deleted from `FINDINGS.md` in Task 7, per the findings-log convention (`context-maintenance` skill), not before.

---

## Task 1: Score Training — fold `$store.game` instead of `engine.state()`

**Files:**
- Modify: `app/src/lib/game/score-training-play.data.ts:238-240`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `foldScoreTrainingState(facts: EngineFacts, config: Seated<ScoreTrainingSnapshot>, timerExpired: boolean): ScoreTrainingState` — already imported in this file (`@modules/game/score-training.engine.module`), already used by this file's own `finalScoreTrainingState()` helper.
- Produces: no new exports; `state()`'s return shape (`ScoreTrainingState | null`) is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/lib/game/score-training-play.data.test.ts` (the file already defines `gameStub`, `settingsStub`, `turnFact`, `rounds`, `BLOCK`, and imports `ScoreTrainingPlayContext`/`Seated`/`ScoreTrainingSnapshot`):

```ts
describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = scoreTrainingPlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = {
      ...scoreTrainingPlay(),
      $store: {
        game: gameStub({ configSnapshot: rounds(10) }),
        settings: settingsStub(),
      },
    } as ScoreTrainingPlayContext;
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [BLOCK],
      turns: [turnFact("t1", 1, 45)],
    });

    expect(play.totalScoreFor("participant-1")).toBe(45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "folds the store"`
Expected: FAIL on the second case — `totalScoreFor` reads `this.state()?.seats`, and `state()` currently returns `this.engine?.state() ?? null`; `play.engine` is `null`, so `totalScoreFor` returns `0`, not `45`.

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/score-training-play.data.ts`, replace lines 238-240:

```ts
    state(this: ScoreTrainingPlayContext): ScoreTrainingState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldScoreTrainingState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/score-training-play.data.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "fix: fold Score Training play state from the store, not engine.state()"
```

---

## Task 2: Shanghai — fold `$store.game` instead of `engine.state()`

**Files:**
- Modify: `app/src/lib/game/shanghai-play.data.ts:36-39` (import), `:176-178` (`state()`)
- Test: `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**
- Consumes: `foldShanghaiState(facts: EngineFacts, config: ShanghaiEngineConfig): ShanghaiState` — exported by `@modules/game/shanghai.engine.module`, not yet imported in this file.
- Produces: no new exports; `state()`'s return shape (`ShanghaiState | null`) is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/lib/game/shanghai-play.data.test.ts` (the file already defines `gameStub`, `settingsStub`, `makePlay`, `priorRoundsThroughNumber`, `STAGE`, `defaultConfig`):

```ts
describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = shanghaiPlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = makePlay();
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [STAGE],
      turns: priorRoundsThroughNumber(3),
    });

    expect(play.currentScore()).toBe("18");
  });
});
```

`priorRoundsThroughNumber(3)`'s own doc comment states it produces a score of `3 * sum(1..n)`; for `n = 3` that is `3 * 6 = 18`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts -t "folds the store"`
Expected: FAIL on the second case — `play.engine` is `null`, so `currentScore()` (which reads `this.state()`) returns `""`, not `"18"`.

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/shanghai-play.data.ts`, replace the import block at lines 36-39:

```ts
import {
  ShanghaiEngine,
  foldShanghaiState,
  zoneBucketOf,
} from "@modules/game/shanghai.engine.module";
```

Then replace lines 176-178:

```ts
    state(this: ShanghaiPlayContext): ShanghaiState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldShanghaiState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/shanghai-play.data.ts app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "fix: fold Shanghai play state from the store, not engine.state()"
```

---

## Task 3: Doubles Training — export the fold function, then swap `state()`

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts:138` (add `export`)
- Modify: `app/src/lib/game/doubles-training-play.data.ts:41` (import), `:104-106` (`state()`)
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `foldSeatStates`, `applyDoublesTrainingDart`, `initialSeatState` — already used internally by the existing private `foldDoublesTrainingState`; unchanged.
- Produces: `foldDoublesTrainingState(facts: EngineFacts, config: Seated<DoublesTrainingSnapshot>): DoublesTrainingState`, now exported from `@modules/game/doubles-training.engine.module` for the play controller (and this task's own new engine-module test) to import.

### Part A — export the fold function

- [ ] **Step 1: Write the failing test**

Add to `app/tests/modules/game/doubles-training.engine.module.test.ts` (the file already defines `config`, `hitObservationFor`, `missObservationFor`, and imports `doublesTrainingEngineFactory`):

```ts
import {
  applyDoublesTrainingDart,
  DoublesTrainingEngine,
  doublesTrainingEngineFactory,
  foldDoublesTrainingState,
  initialDoublesTrainingState,
} from "@modules/game/doubles-training.engine.module";
```

(replaces the existing import block's name list — add `foldDoublesTrainingState`, alphabetized alongside the others)

```ts
describe("foldDoublesTrainingState", () => {
  it("reproduces the engine's own state() for an equivalent fact log", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));

    const expected = engine.state();
    const folded = foldDoublesTrainingState(engine.facts(), config);

    expect(folded).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts -t "foldDoublesTrainingState"`
Expected: FAIL to compile/run — `foldDoublesTrainingState` is not exported from the module, so the import resolves to `undefined` and the test throws calling it.

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/doubles-training.engine.module.ts`, change line 138 from:

```ts
function foldDoublesTrainingState(
```

to:

```ts
export function foldDoublesTrainingState(
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/doubles-training.engine.module.ts app/tests/modules/game/doubles-training.engine.module.test.ts
git commit -m "fix: export foldDoublesTrainingState for the play controller to fold directly"
```

### Part B — swap the play controller's `state()`

- [ ] **Step 6: Write the failing test**

Add to `app/tests/lib/game/doubles-training-play.data.test.ts` (the file already defines `gameStub`, `settingsStub`, `makePlay`, `priorHitTurnsThroughDouble`, `STAGE`, `defaultConfig`):

```ts
describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = doublesTrainingPlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = makePlay();
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [STAGE],
      turns: priorHitTurnsThroughDouble(3),
    });

    expect(play.hitCount()).toBe("3");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts -t "folds the store"`
Expected: FAIL on the second case — `play.engine` is `null`, so `hitCount()` (which reads `this.state()`) returns `"0"`, not `"3"`.

- [ ] **Step 8: Write minimal implementation**

In `app/src/lib/game/doubles-training-play.data.ts`, replace line 41:

```ts
import {
  DoublesTrainingEngine,
  foldDoublesTrainingState,
} from "@modules/game/doubles-training.engine.module";
```

Then replace lines 104-106:

```ts
    state(this: DoublesTrainingPlayContext): DoublesTrainingState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldDoublesTrainingState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: PASS, full file.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/doubles-training-play.data.ts app/tests/lib/game/doubles-training-play.data.test.ts
git commit -m "fix: fold Doubles Training play state from the store, not engine.state()"
```

---

## Task 4: Around the Clock — export the fold function, then swap `state()`

**Files:**
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts:112-126` (JSDoc + `export`)
- Modify: `app/src/lib/game/around-the-clock-play.data.ts:45-50` (import), `:175-177` (`state()`)
- Test: `app/tests/modules/game/around-the-clock.engine.module.test.ts`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts`

**Interfaces:**
- Consumes: `foldSeatStates`, `applyAroundTheClockDart`, `initialSeatState`, `scoreCompareOutcome`, `dartsThrownBy`, `activeSeat` — already used internally by the existing private `foldAroundTheClockState`; unchanged.
- Produces: `foldAroundTheClockState(facts: EngineFacts, config: Seated<AroundTheClockSnapshot>): AroundTheClockState`, now exported from `@modules/game/around-the-clock.engine.module`.

### Part A — export the fold function and correct its stale "module-private" JSDoc

- [ ] **Step 1: Write the failing test**

Add to `app/tests/modules/game/around-the-clock.engine.module.test.ts` (the file already defines `config`, `numberHit`, `miss`, `bullHit`, and imports `AroundTheClockEngine`):

```ts
import {
  applyAroundTheClockDart,
  foldAroundTheClockState,
  initialAroundTheClockState,
  isAroundTheClockHit,
  AroundTheClockEngine,
  aroundTheClockEngineFactory,
} from "@modules/game/around-the-clock.engine.module";
```

(replaces the existing import block's name list — add `foldAroundTheClockState`)

```ts
describe("foldAroundTheClockState", () => {
  it("reproduces the engine's own state() for an equivalent fact log", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "TREBLE"));

    const expected = engine.state();
    const folded = foldAroundTheClockState(engine.facts(), config);

    expect(folded).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts -t "foldAroundTheClockState"`
Expected: FAIL — `foldAroundTheClockState` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/around-the-clock.engine.module.ts`, replace the JSDoc + declaration at lines 112-126:

```ts
/**
 * Folds the whole fact log into the session's state — the function the
 * engine's own `deriveState()` delegates to, and the play controller's own
 * `state()` folds directly against `$store.game`'s reactive fields, exactly
 * like `foldTuodState`/`foldFiveOhOneState`.
 *
 * Score-compare, fewest darts wins: both seats always play out their own
 * full circuit — a completed seat is skipped by `activeSeat`'s completion
 * predicate, handing every remaining turn to the other, so a miss's extra
 * visit never steals a turn from a seat that has already finished. The
 * match resolves only once both seats are `COMPLETE`.
 */
export function foldAroundTheClockState(
  facts: EngineFacts,
  config: Seated<AroundTheClockSnapshot>,
): AroundTheClockState {
```

(only the JSDoc text and the `function` → `export function` keyword change; the function body and closing brace are unchanged)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/around-the-clock.engine.module.ts app/tests/modules/game/around-the-clock.engine.module.test.ts
git commit -m "fix: export foldAroundTheClockState for the play controller to fold directly"
```

### Part B — swap the play controller's `state()`

- [ ] **Step 6: Write the failing test**

Add to `app/tests/lib/game/around-the-clock-play.data.test.ts` (the file already defines `gameStub`, `settingsStub`, `makePlay`, `priorTurnsThroughNumber`, `STAGE`, `defaultConfig`):

```ts
describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = aroundTheClockPlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = makePlay();
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [STAGE],
      turns: priorTurnsThroughNumber(3),
    });

    expect(play.turnsSoFar()).toBe("3");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts -t "folds the store"`
Expected: FAIL on the second case — `play.engine` is `null`, so `turnsSoFar()` (which reads `this.state()`) returns `"0"`, not `"3"`.

- [ ] **Step 8: Write minimal implementation**

In `app/src/lib/game/around-the-clock-play.data.ts`, replace the import block at lines 45-50:

```ts
import {
  applyAroundTheClockDart,
  AroundTheClockEngine,
  foldAroundTheClockState,
  initialAroundTheClockState,
  isAroundTheClockHit,
} from "@modules/game/around-the-clock.engine.module";
```

Then replace lines 175-177:

```ts
    state(this: AroundTheClockPlayContext): AroundTheClockState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldAroundTheClockState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: PASS, full file.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/around-the-clock-play.data.ts app/tests/lib/game/around-the-clock-play.data.test.ts
git commit -m "fix: fold Around the Clock play state from the store, not engine.state()"
```

---

## Task 5: Bob's 27 — extract `foldBobs27State`, then swap `state()`

Unlike the other three Shape B games, Bob's 27's `deriveState()` computes its state inline (no existing module-level fold function to export) — see **Scope correction** above.

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts:151-182` (extract `foldBobs27State`)
- Modify: `app/src/lib/game/bobs27-play.data.ts:47` (import), `:195-197` (`state()`)
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts`
- Test: `app/tests/lib/game/bobs27-play.data.test.ts`

**Interfaces:**
- Consumes: `foldSeatStates` (`./seat-state.module`), `eliminationWinner` (`./match-outcome.module`), `activeSeat` (`./seat-rota.module`) — all already imported by `bobs27.engine.module.ts`.
- Produces: `foldBobs27State(facts: EngineFacts, config: Seated<Bobs27Snapshot>): Bobs27State`, exported from `@modules/game/bobs27.engine.module`.

### Part A — extract the fold function

- [ ] **Step 1: Write the failing test**

Add to `app/tests/modules/game/bobs27.engine.module.test.ts` (the file already defines `config`, `hitObservationFor`, `missObservationFor`, and imports `bobs27EngineFactory`):

```ts
import {
  applyBobs27Dart,
  Bobs27Engine,
  bobs27EngineFactory,
  foldBobs27State,
  initialBobs27State,
} from "@modules/game/bobs27.engine.module";
```

(replaces the existing import block's name list — add `foldBobs27State`)

```ts
describe("foldBobs27State", () => {
  it("reproduces the engine's own state() for an equivalent fact log", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));

    const expected = engine.state();
    const folded = foldBobs27State(engine.facts(), config);

    expect(folded).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts -t "foldBobs27State"`
Expected: FAIL to compile/run — `foldBobs27State` does not exist in the module yet.

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/bobs27.engine.module.ts`, replace the private `deriveState()` method at lines 151-182:

```ts
  private deriveState(): Bobs27State {
    return foldBobs27State(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
    );
  }
```

and add the new exported function immediately above the `Bobs27Engine` class declaration (i.e. directly after `applyBobs27Dart`'s closing brace, before the class's own JSDoc at what is currently line 129):

```ts
/**
 * Folds the whole fact log into the session's state — the function the
 * engine's own `deriveState()` delegates to, and the play controller's own
 * `state()` folds directly against `$store.game`'s reactive fields, exactly
 * like `foldTuodState`/`foldFiveOhOneState`. Elimination: the first seat to
 * bust loses and the match ends immediately, the other seat winning.
 */
export function foldBobs27State(
  facts: EngineFacts,
  config: Seated<Bobs27Snapshot>,
): Bobs27State {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    (seat) => initialSeatState(config, seat),
    (state, observation) => applyBobs27Dart(config, state, observation),
  );

  const winningSideKey = eliminationWinner(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      failed: seat.status === "LOST",
    })),
  );
  const status: Bobs27State["status"] =
    seats.length === 1
      ? seats[0].status
      : winningSideKey !== null
        ? "COMPLETE"
        : "IN_PROGRESS";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey,
    seats,
  };
}
```

Note: `initialSeatState` is currently a module-private, non-exported function (`function initialSeatState(config, seat)` at line 33) that already takes `(config, seat)`, matching this call exactly — no change needed to it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`
Expected: PASS, full file — including every pre-existing test in this file, since `deriveState()` now delegates to `foldBobs27State` with byte-identical logic.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/bobs27.engine.module.ts app/tests/modules/game/bobs27.engine.module.test.ts
git commit -m "fix: extract foldBobs27State from Bobs27Engine.deriveState()"
```

### Part B — swap the play controller's `state()`

- [ ] **Step 6: Write the failing test**

Add to `app/tests/lib/game/bobs27-play.data.test.ts` (the file already defines `gameStub`/`makePlay` via the same pattern as the other three, `settingsStub`, `priorTurnsThroughBull`, `STAGE`, `defaultConfig`):

```ts
describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = bobs27Play() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = makePlay();
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [STAGE],
      turns: priorTurnsThroughBull(),
    });

    expect(play.currentTargetLabel()).toBe("BULL");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts -t "folds the store"`
Expected: FAIL on the second case — `play.engine` is `null`, so `currentTargetLabel()` (which reads `this.state()`) returns `""`, not `"BULL"`.

- [ ] **Step 8: Write minimal implementation**

In `app/src/lib/game/bobs27-play.data.ts`, replace line 47:

```ts
import {
  Bobs27Engine,
  foldBobs27State,
} from "@modules/game/bobs27.engine.module";
```

Then replace lines 195-197:

```ts
    state(this: Bobs27PlayContext): Bobs27State | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldBobs27State(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: PASS, full file.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/bobs27-play.data.ts app/tests/lib/game/bobs27-play.data.test.ts
git commit -m "fix: fold Bob's 27 play state from the store, not engine.state()"
```

---

## Task 6: Singles Training — export the fold function, then swap `state()`

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts:191` (add `export`)
- Modify: `app/src/lib/game/singles-training-play.data.ts:49` (import), `:288-290` (`state()`)
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `foldSeatStates`, `applySinglesTrainingDart`, `initialSeatState`, `eliminationWinner`, `scoreCompareOutcome`, `activeSeat` — already used internally by the existing private `foldSinglesTrainingState`; unchanged.
- Produces: `foldSinglesTrainingState(facts: EngineFacts, config: SinglesEngineConfig): SinglesTrainingState`, now exported from `@modules/game/singles-training.engine.module` (`SinglesEngineConfig = Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot>`, itself already exported-adjacent as a module-local type alias — unchanged).

### Part A — export the fold function

- [ ] **Step 1: Write the failing test**

Add to `app/tests/modules/game/singles-training.engine.module.test.ts` (the file already defines `config`, `hitObservationFor`, `missObservationFor`, and imports `singlesTrainingEngineFactory`):

```ts
import {
  applySinglesTrainingDart,
  foldSinglesTrainingState,
  initialSinglesTrainingState,
  SinglesTrainingEngine,
  singlesTrainingEngineFactory,
  singlesTrainingV2EngineFactory,
} from "@modules/game/singles-training.engine.module";
```

(replaces the existing import block's name list — add `foldSinglesTrainingState`)

```ts
describe("foldSinglesTrainingState", () => {
  it("reproduces the engine's own state() for an equivalent fact log", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

    const expected = engine.state();
    const folded = foldSinglesTrainingState(engine.facts(), config);

    expect(folded).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts -t "foldSinglesTrainingState"`
Expected: FAIL — `foldSinglesTrainingState` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/singles-training.engine.module.ts`, change line 191 from:

```ts
function foldSinglesTrainingState(
```

to:

```ts
export function foldSinglesTrainingState(
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/singles-training.engine.module.ts app/tests/modules/game/singles-training.engine.module.test.ts
git commit -m "fix: export foldSinglesTrainingState for the play controller to fold directly"
```

### Part B — swap the play controller's `state()`

- [ ] **Step 6: Write the failing test**

Add to `app/tests/lib/game/singles-training-play.data.test.ts` (the file already defines `gameStub`, `settingsStub`, `makePlay`, `priorTurnsThroughNumber`, `STAGE`, `defaultConfig`):

```ts
describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = singlesTrainingPlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = makePlay();
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [STAGE],
      turns: priorTurnsThroughNumber(3),
    });

    expect(play.currentTargetLabel()).toBe("4");
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts -t "folds the store"`
Expected: FAIL on the second case — `play.engine` is `null`, so `currentTargetLabel()` (which reads `this.state()`) returns `""`, not `"4"`.

- [ ] **Step 8: Write minimal implementation**

In `app/src/lib/game/singles-training-play.data.ts`, replace line 49:

```ts
import {
  foldSinglesTrainingState,
  SinglesTrainingEngine,
} from "@modules/game/singles-training.engine.module";
```

Then replace lines 288-290:

```ts
    state(this: SinglesTrainingPlayContext): SinglesTrainingState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldSinglesTrainingState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, full file.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "fix: fold Singles Training play state from the store, not engine.state()"
```

---

## Task 7: Context maintenance and gates

**Files:**
- Modify: `FINDINGS.md` (delete the F31 entry)
- Modify: any context-map/decision-ledger/knowledge-graph files the `context-maintenance` skill's own procedure identifies as stale

**Interfaces:**
- Consumes: nothing new — this task validates and documents Tasks 1-6's completed work.
- Produces: nothing new — no application code changes.

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits zero; the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run the full test suite once more from repo root**

Run: `cd app && npx vitest run`
Expected: PASS, entire suite — confirms none of the six independent task branches' changes interact badly when combined.

- [ ] **Step 3: Run the `context-maintenance` skill**

Follow its procedure exactly (`.claude/skills/context-maintenance/SKILL.md`). Delete the F31 entry from `FINDINGS.md` as part of this — F31 is now closed, and the log's own convention is to remove closed entries rather than mark them done.

- [ ] **Step 4: Run `run-all-gates`**

Follow the `run-all-gates` skill's procedure. Expected: every gate passes, including `scripts/check-test-coverage.sh` and `scripts/check-findings-log.sh`.

- [ ] **Step 5: Commit any doc-sync changes**

If Steps 3-4 produced any file changes beyond `FINDINGS.md` itself (context map, decision ledger, knowledge graph):

```bash
git add FINDINGS.md <any other files context-maintenance touched>
git commit -m "docs: context maintenance for Alpine reactivity fold fixes (closes F31)"
```

If Step 3 touched only `FINDINGS.md`, that change may be folded into the same commit — do not open a second commit for `FINDINGS.md` alone if nothing else changed.
