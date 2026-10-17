# Track Kernel — PR 6 (Target Scoring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Target Scoring's fold through the Track kernel with no change in behaviour. It is the first exercise on the kernel.

**Architecture:**
- Target Scoring stays a `DartExerciseSpec` on `dart-exercise-shell.module.ts`. Only `foldTargetScoringState` changes. It becomes:
  - a `TrackRules<ChainTrackExt>` record (`targetScoringRules(config)`), with `ext = { chain, finishedBest, hits }`;
  - one new kernel function, `foldTrackDarts(turns, initial, rules)`, which folds a solo seat over every dart in write order, since exercise facts log no seats;
  - a projection from the folded `TrackSeat` to the unchanged `TargetScoringState`.
- Every export keeps its name and call shape: `targetScoringPoints`, `targetScoringTargetLabel`, `foldTargetScoringState(facts, config, complete)`, `TargetScoringEngine`, `targetScoringEngineFactory`. Switching Target Scoring keeps importing `targetScoringPoints`.
- One policy lands with this first caller: `chainOnTarget(length)` (onDart). `sectionOf` in `track-policies.ts` gains `export`. `initialTrackSeat` widens its `seat` parameter from `SeatFact` to `SeatState`.
- The kernel gate `check-engine-kernels.sh` learns that an exercise imports the kernel as `@modules/game/track-kernel.module`, not `./track-kernel.module`.
- Proof, as in PR 5:
  1. The two goldens in `target-scoring.golden.test.ts` already exist, recorded from the original engine. Commit 1 adds aimed goldens, also recorded before the rebind.
  2. A differential oracle runs against a legacy copy, with an aimed generator, across five configs, with timer expiry.

**Tech Stack:** TypeScript, Vitest, Bash, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§2 Target Scoring row, §3 refinements, §4 `chainOnTarget`, §5 Target Scoring row, §7 method, §8 PR 6, §9.5). Previous plan: `docs/superpowers/plans/2026-10-17-track-kernel-pr5-shanghai.md` (merged as #988).

## Global Constraints

- Branch `refactor/track-kernel-target-scoring`, from `origin/main` at `5b30cf2` or later. Never `--no-verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Types go in barrels (`modules/game/types.ts`, `interfaces.ts`). Tests import them from `@modules/types` / `@modules/interfaces`.
- No `//` comments inside function bodies. Use JSDoc above the declaration.
- Fallow:
  - cognitive complexity ≤ 15 per function;
  - duplication may rise while the legacy copy exists, but must be ≤ `main`'s count after Task 6.3 (record it in Task 6.1 Step 0).
- `cd app && npm run check` reports 0 errors, 0 warnings, 0 hints.
- `npm test`, `npm run check` and `npx fallow` run past the 120 s Bash limit. Run them in the background and wait on the output file. Do not edit files while a background run is live.
- This is a refactor:
  - Every existing test passes with **no edits**: `target-scoring.engine.module.test.ts`, `target-scoring.golden.test.ts`, `switching-target-scoring.engine.module.test.ts`, `dart-exercise-shell.module.test.ts`, the routine and adapter tests, `track-kernel.module.test.ts`, `track-policies.test.ts`, and every other golden.
  - New tests are appended only. Adding a name to an existing import line is allowed.
  - Existing snapshots stay unchanged.
- §7 lists no Target Scoring quirk. Preserve the rules exactly as they are: a miss on an empty chain keeps the target; the double of a number is a miss; a chain cut by the timer counts in `bestChain` but not in `markToBeat`.
- The registry flip rides **commit 2**, because `check-engine-kernels.sh` runs pre-commit.
- The legacy copy must not leave an unused declaration behind (ts(6133) hint). Delete such functions from the copy.
- No D-entry: this sits inside D468. `bash scripts/next-decision-id.sh` printed D469 at plan time.

## Spec refinements made by this plan

1. **Policy shapes fixed.**

   | Policy | Slot | Behaviour |
   | --- | --- | --- |
   | `pathTarget(numbersPath(config.targets))` (reused) | target | `numbersPath(order)` already maps 25 to `BULL` and every other number to `NUMBER`. |
   | `targetScoringPoints(sectionOf(target), obs)` (engine) | hit / points | Hit is `!== null`; points is `?? 0`. The engine's exported function stays the single scoring table. Spec §4's `singleOrTreble` is therefore not added, as `sdtBucket` was not in PR 5. |
   | `chainOnTarget(length)` | onDart | A hit adds `dart.points` to `ext.chain` and 1 to `ext.hits`. A miss with `ext.chain === 0` returns the seat unchanged (same reference). A miss ending a chain records `max(finishedBest[i] ?? 0, chain)` at the seat's `targetIndex`, sets `chain = 0`, and moves `targetIndex` to `(i + 1) % length`. |
   | `closeAfter(3)` (reused) | visitOpen | Bookkeeping only. There is no `onVisitClose`, so visit counters are never read. |

2. **Cycling lives in `chainOnTarget`.** §3 left "cycle" to land with its first caller. The wrap is the modulo inside the policy, and the stored index is always in range, so `pathTarget` needs no wrap. PR 7's `resetOnMiss` cycles differently (a hit advances, a miss restarts at 0). A shared helper waits until two policies would share it.

3. **`foldTrackDarts(turns, initial, rules)` joins the kernel.** `foldTrackSeats` maps `SeatFact`s to their own turns. An exercise logs no seats, and legacy folds every dart in write order, whoever threw it. `foldTrackDarts` does exactly that, from one given initial seat. `initialTrackSeat` widens `seat: SeatFact` to `seat: SeatState` (`participantRef` + `sideKey`). This is additive: every `SeatFact` is a `SeatState`.

4. **`trackExerciseSpec` deferred to PR 7.** §3's refinement says an adapter lands only when two engines' specs turn out identical. Target Scoring keeps its own `DartExerciseSpec`, with only `fold` routed through the kernel. PR 7 moves Switching Target Scoring onto the exercise shell, and the two specs can then be compared. §9.5's CLAUDE.md bullet becomes a note on the existing exercise-shell bullet instead.

5. **`TrackRules.outcome` deferred again.** Timer-only completion is `complete ? "COMPLETE" : "IN_PROGRESS"` in the projection. PR 7's engine is also timer-only, so re-check there. A one-line ternary is unlikely to earn a kernel member.

6. **`bestChain` is derived, not stored.** A chain only grows until a miss ends it. So legacy's running max equals the max over `finishedBest` and the live chain, which is the max of `bestChainByTarget`. The oracle proves it.

7. **The kernel gate accepts the alias import.** `check-engine-kernels.sh` matched only `from "./<kernel>-kernel.module"`. That fits engines in `modules/game/` and fails for any exercise. Both the `KERNEL_BOUND` check and the `PENDING`/`HAND_WRITTEN` "imports a kernel" check now also match `from "@modules/game/<kernel>-kernel.module"`. Two fixture cases pin it.

8. **Aimed goldens added.** The two existing goldens use `randomObservation`, which hits a 2–3 target list about 1 dart in 30. That pins little once the legacy copy is gone. Commit 1 records a new `target-scoring.aimed.golden.test.ts` from the original engine.

## Review Focus

1. **A smaller chain on a target seen before.** `markToBeat` and `bestChainByTarget` keep the larger finished chain, and a later shorter chain does not lower it. Pinned in Task 6.2 (boundary test 1).
2. **Undo of a chain-ending miss.** The target index goes back, the chain is restored, and `markToBeat` returns to its prior value. Pinned in Task 6.2 (boundary test 2).
3. **Bull-only and single-target configs.** `[25]`: outer bull 1, bullseye 3, a number dart a miss, and the wrap back to index 0. Pinned in Task 6.2 (boundary test 3) and the oracle.
4. **Live chain smaller than a finished one at expiry.** `bestChain` is the finished value, and `currentChain` is the live one. Pinned in Task 6.2 (boundary test 4).
5. **Rehydration after expiry, resumed.** Oracle case `full board, expired` with `resumeExpired: true`, and the aimed golden of the same name.

---

### Task 6.1: Aimed exercise input, aimed goldens, legacy copy and oracle (commit 1)

**Files:**
- Modify: `app/tests/modules/game/support/aimed-observations.ts` (extract `observationOn`, add `aimedOnCurrentTarget`)
- Create: `app/tests/modules/training/exercises/target-scoring.aimed.golden.test.ts` (and its `__snapshots__` file)
- Create: `app/tests/modules/training/exercises/legacy/target-scoring.legacy.ts`
- Create: `app/tests/modules/training/exercises/target-scoring.oracle.test.ts`

**Interfaces:**
- Consumes: from `support/engine-oracle.ts`, `runOracle`, `goldenTrace`, `randomObservation` and `OracleEngine`.
- Produces:
  - `aimedOnCurrentTarget(rate: number): (rand: () => number, engine: OracleEngine) => DartObservation`, which PR 7 reuses;
  - `LegacyTargetScoringEngine`, test-only and deleted in Task 6.3.

- [ ] **Step 0: Baseline.** Run `cd app && npx fallow` in the background. Record the duplication clone-group and line counts; those are `main`'s (132 groups / 5,887 lines at PR 5's merge; re-measure).

- [ ] **Step 1: Share the on-target observation.** In `support/aimed-observations.ts`, replace the body of `onActiveTarget` so that its bull and number branches move into a new exported helper. Keep the `rand()` draw order exactly, so the Singles, Shanghai and Around the Clock snapshots cannot move:

```ts
/**
 * A dart on `target`: either bull ring on BULL (one `rand()` draw),
 * otherwise the number in the ring `numberZone` picks.
 */
export function observationOn(
  target: BoardTarget,
  rand: () => number,
  numberZone: () => DartZoneKey,
): DartObservation {
  const base = { locationX: null, locationY: null };
  if (target.kind === "BULL")
    return {
      ...base,
      hitTargetNumber: 25,
      hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
    };
  return { ...base, hitTargetNumber: target.number, hitZoneKey: numberZone() };
}

/** A dart on the active seat's target along `path`; see `observationOn`. */
export function onActiveTarget(
  engine: OracleEngine,
  path: readonly BoardTarget[],
  rand: () => number,
  numberZone: () => DartZoneKey,
): DartObservation {
  const state = engine.state() as MultiSeatState<
    SeatState & { targetIndex: number }
  >;
  const target = targetAt(path, activeSeatState(state).targetIndex);
  return observationOn(target, rand, numberZone);
}
```

  Then append:

```ts
/**
 * `rate` of darts on an exercise's `currentTargetNumber`, in any ring
 * (either bull on 25), otherwise `randomObservation`.
 */
export function aimedOnCurrentTarget(
  rate: number,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  return (rand, engine) => {
    if (rand() >= rate) return randomObservation(rand);
    const { currentTargetNumber } = engine.state() as {
      currentTargetNumber: number;
    };
    const target: BoardTarget =
      currentTargetNumber === 25
        ? { kind: "BULL" }
        : { kind: "NUMBER", number: currentTargetNumber };
    return observationOn(target, rand, () => anyRing(rand));
  };
}
```

  Run `cd app && npx vitest run tests/modules/game/singles-training.golden.test.ts tests/modules/game/shanghai.golden.test.ts tests/modules/game/around-the-clock.golden.test.ts`. Expected: all PASS, and `git status` shows no `__snapshots__` change.

- [ ] **Step 2: Record the aimed goldens** in `app/tests/modules/training/exercises/target-scoring.aimed.golden.test.ts`. Do this before any engine change.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { TargetScoringConfigData } from "@lib/types";

const FULL_BOARD = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

const CASES: [string, TargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["bull first", { targets: [25, 20] }, false],
  ["single target", { targets: [20] }, false],
  ["full board, expired", { targets: FULL_BOARD }, true],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Target Scoring — aimed golden trace", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new TargetScoringEngine(config, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentTarget(0.6),
        }),
      ).toMatchSnapshot();
    });
  }
});
```

  Run `cd app && npx vitest run tests/modules/training/exercises/target-scoring.aimed.golden.test.ts`. Expected: 4 PASS, and 4 snapshots written. Open the snapshot. Each case must show some `bestChain` above 3 and a `targetIndex` other than 0 at least once in its steps or state. If one does not, the generator is wrong: fix it before going on.

- [ ] **Step 3: Copy the legacy module.** Run `mkdir -p app/tests/modules/training/exercises/legacy && cp app/src/modules/training/exercises/target-scoring.engine.module.ts app/tests/modules/training/exercises/legacy/target-scoring.legacy.ts`. In the copy:
  - Rewrite `./dart-exercise-shell.module`, `./interfaces` and `./types` as `@modules/training/exercises/dart-exercise-shell.module`, `@modules/training/exercises/interfaces` and `@modules/training/exercises/types`.
  - Delete the `targetScoringEngineFactory` block and the `registerDartExerciseEngineFactory(...)` call. Drop the `registerDartExerciseEngineFactory` and `dartExerciseEngineFactory` imports.
  - Rename the class to `LegacyTargetScoringEngine`. It stays exported.
  - Remove `export` from every function.
  - Delete `targetScoringTargetLabel`, because nothing else in the copy calls it. Keep `targetScoringPoints`, `intentFor`, `initialProgress`, `applyDart` and `foldTargetScoringState`, because the class or the reducer reaches each.

- [ ] **Step 4: Write the oracle test** `app/tests/modules/training/exercises/target-scoring.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { LegacyTargetScoringEngine } from "./legacy/target-scoring.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { TargetScoringConfigData } from "@lib/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);
const FULL_BOARD = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, TargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["with bull", { targets: [20, 25] }, false],
  ["single target", { targets: [20] }, false],
  ["bull only", { targets: [25] }, false],
  ["full board, expired", { targets: FULL_BOARD }, true],
];

describe("Target Scoring — kernel vs legacy oracle", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(
      `${name}: indistinguishable through every public method`,
      () => {
        runOracle({
          build: (prior) => new TargetScoringEngine(config, prior),
          legacy: (prior) => new LegacyTargetScoringEngine(config, prior),
          seeds: SEEDS,
          steps: 260,
          undoRate: 0.12,
          rehydrateEvery: 19,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentTarget(0.6),
        });
      },
      60_000,
    );
  }
});
```

- [ ] **Step 5: Run it.** Run `cd app && npx vitest run tests/modules/training/exercises/target-scoring.oracle.test.ts`. Expected: 5 PASS, since both sides are the same code. Note the wall time. If a case nears 60 s, drop `steps` to 200 for all cases and say so in the PR body.

- [ ] **Step 6: Prove the oracle can fail.** Do each of these separately in the legacy copy; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. In `applyDart`, delete the line `if (progress.currentChain === 0) return { ...progress, dartsThrown };`. Every case must fail on `state`.
  2. In `targetScoringPoints`, change `if (dart.hitZoneKey === "TREBLE") return 3;` to `return 2;`. Every case with a number target must fail.

- [ ] **Step 7: Gates and commit.**
  - `cd app && npm run check`, in the background → 0/0/0. A hint in the legacy copy means an unused declaration: delete it.
  - `npm test`, in the background → all PASS.

```bash
git add app/tests/modules/game/support/aimed-observations.ts app/tests/modules/training/exercises
git commit -m "test(target-scoring): freeze legacy engine, aimed exercise input, aimed goldens"
```

### Task 6.2: Kernel solo fold, `chainOnTarget`, the rebind and the gate (commit 2)

**Files:**
- Modify: `app/src/modules/game/track-kernel.module.ts` (`foldTrackDarts`; widen `initialTrackSeat`)
- Modify: `app/src/modules/game/track-policies.ts` (export `sectionOf`; add `chainOnTarget`)
- Modify: `app/src/modules/game/types.ts` (`ChainTrackExt`)
- Modify: `app/src/modules/training/exercises/target-scoring.engine.module.ts` (rebind)
- Modify: `scripts/check-engine-kernels.sh`, `scripts/test-check-engine-kernels.sh`, `scripts/engine-kernels.txt`
- Test: `app/tests/modules/game/track-kernel.module.test.ts`, `app/tests/modules/game/track-policies.test.ts`, `app/tests/modules/training/exercises/target-scoring.engine.module.test.ts` (append only)

**Interfaces:**
- Consumes: `applyTrackDart`, `initialTrackSeat`, `pathTarget`, `closeAfter`, `numbersPath`, `TrackRules`, `TrackSeat`, `JudgedDart`, `SeatState`, `SOLO_PARTICIPANT_REF`.
- Produces:
  - `foldTrackDarts<TExt>(turns: readonly TurnFact[], initial: TrackSeat<TExt>, rules: TrackRules<TExt>): TrackSeat<TExt>`;
  - `initialTrackSeat<TExt>(seat: SeatState, ext: TExt, score = 0): TrackSeat<TExt>`;
  - `sectionOf(target: BoardTarget): number` (exported);
  - `chainOnTarget<TExt extends ChainTrackExt>(length: number): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt>`;
  - `type ChainTrackExt = { chain: number; finishedBest: (number | null)[]; hits: number }`.

- [ ] **Step 1: Write the boundary tests.** These characterise legacy behaviour at the projection's seams. Append them to the end of `target-scoring.engine.module.test.ts`. That file already imports `TargetScoringEngine` and defines `dart`, `MISS` and `play`.

```ts
describe("Target Scoring — kernel seams", () => {
  it("keeps the larger finished chain when a target comes round again", () => {
    const engine = new TargetScoringEngine({ targets: [20] });
    play(engine, [dart(20, "TREBLE"), dart(20, "SINGLE"), MISS]);
    const state = play(engine, [dart(20, "SINGLE"), MISS]);

    expect(state.targetIndex).toBe(0);
    expect(state.markToBeat).toBe(4);
    expect(state.bestChain).toBe(4);
    expect(state.bestChainByTarget).toEqual([
      { targetNumber: 20, bestChain: 4 },
    ]);
  });

  it("undoing a chain-ending miss restores the target, chain and mark", () => {
    const engine = new TargetScoringEngine({ targets: [20, 19] });
    play(engine, [dart(20, "TREBLE"), MISS, dart(19, "SINGLE"), MISS]);
    play(engine, [dart(20, "SINGLE"), MISS]);
    expect(engine.state().currentTargetNumber).toBe(19);
    engine.undo();

    expect(engine.state()).toMatchObject({
      currentTargetNumber: 20,
      targetIndex: 0,
      currentChain: 1,
      markToBeat: 3,
      hits: 3,
      dartsThrown: 5,
    });
  });

  it("scores a bull-only list and wraps it to itself", () => {
    const engine = new TargetScoringEngine({ targets: [25] });
    const state = play(engine, [
      dart(25, "OUTER_BULL"),
      dart(25, "INNER_BULL"),
      dart(20, "TREBLE"),
    ]);

    expect(state).toMatchObject({
      currentTargetNumber: 25,
      targetIndex: 0,
      currentChain: 0,
      bestChain: 4,
      markToBeat: 4,
      hits: 2,
      dartsThrown: 3,
    });
  });

  it("reports a finished best above a smaller live chain at expiry", () => {
    const engine = new TargetScoringEngine({ targets: [20, 19] });
    play(engine, [dart(20, "TREBLE"), dart(20, "TREBLE"), MISS]);
    play(engine, [dart(19, "SINGLE")]);
    engine.expireTimer();

    expect(engine.state()).toMatchObject({
      status: "COMPLETE",
      currentChain: 1,
      bestChain: 6,
      markToBeat: null,
      bestChainByTarget: [
        { targetNumber: 20, bestChain: 6 },
        { targetNumber: 19, bestChain: 1 },
      ],
    });
  });
});
```

- [ ] **Step 2: Run them against the unchanged engine.** Run `cd app && npx vitest run tests/modules/training/exercises/target-scoring.engine.module.test.ts`. Expected: PASS. These are characterisation tests. If one fails, the test is wrong, not the engine: fix its arithmetic or fixture, and ledger it.

- [ ] **Step 3: Write the failing kernel tests.** In `track-kernel.module.test.ts`, add `foldTrackDarts` to the `@modules/game/track-kernel.module` import. Append inside `describe("track kernel", ...)`, before its closing `});`:

```ts
  it("foldTrackDarts folds every dart in write order from one seat", () => {
    const turn = (darts: DartObservation[]) =>
      ({ participantRef: "solo", darts }) as unknown as TurnFact;
    const seat = foldTrackDarts(
      [turn([hitOn(1), MISS, hitOn(1)]), turn([hitOn(2)])],
      fresh(),
      toy,
    );
    expect(seat).toMatchObject({
      targetIndex: 1,
      score: 3,
      dartsThisVisit: 1,
      hitsThisVisit: 1,
      ext: { closed: [2] },
    });
  });

  it("foldTrackDarts with no darts returns the initial seat", () => {
    const initial = fresh();
    expect(foldTrackDarts([], initial, toy)).toBe(initial);
  });

  it("initialTrackSeat takes a bare seat state", () => {
    expect(
      initialTrackSeat({ participantRef: "solo", sideKey: "solo" }, null),
    ).toMatchObject({ participantRef: "solo", sideKey: "solo" });
  });
```

- [ ] **Step 4: Write the failing policy tests.** In `track-policies.test.ts`, add `chainOnTarget` and `sectionOf` to the `@modules/game/track-policies` import, and `ChainTrackExt` to the `@modules/types` import. Append inside `describe("track policies", ...)`, before its closing `});`. The block reuses `on`, `FIVE`, `BULL` and `SEAT`:

```ts
  const chained = (
    over: Partial<TrackSeat<ChainTrackExt>> = {},
    ext: Partial<ChainTrackExt> = {},
  ): TrackSeat<ChainTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      chain: 0,
      finishedBest: [null, null, null],
      hits: 0,
      ...ext,
    }),
    ...over,
  });
  const thrown = (hit: boolean, points: number) => ({
    observation: on(5, hit ? "TREBLE" : "DOUBLE"),
    target: FIVE,
    hit,
    points,
  });

  it("sectionOf: a NUMBER target's number, 25 for BULL", () => {
    expect(sectionOf(FIVE)).toBe(5);
    expect(sectionOf(BULL)).toBe(25);
  });

  it("chainOnTarget: a hit grows the chain and counts", () => {
    expect(
      chainOnTarget(3)(chained({}, { chain: 2, hits: 2 }), thrown(true, 3)),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 5, hits: 3 } });
  });

  it("chainOnTarget: a miss on an empty chain changes nothing", () => {
    const s = chained({ targetIndex: 1 });
    expect(chainOnTarget(3)(s, thrown(false, 0))).toBe(s);
  });

  it("chainOnTarget: a miss ends the chain, keeps the best, moves on", () => {
    expect(
      chainOnTarget(3)(
        chained({ targetIndex: 1 }, { chain: 2, finishedBest: [null, 5, null] }),
        thrown(false, 0),
      ),
    ).toMatchObject({
      targetIndex: 2,
      ext: { chain: 0, finishedBest: [null, 5, null] },
    });
    expect(
      chainOnTarget(3)(
        chained({ targetIndex: 2 }, { chain: 4 }),
        thrown(false, 0),
      ),
    ).toMatchObject({
      targetIndex: 0,
      ext: { chain: 0, finishedBest: [null, null, 4] },
    });
  });
```

- [ ] **Step 5: Run them.** Run `cd app && npx vitest run tests/modules/game/track-kernel.module.test.ts tests/modules/game/track-policies.test.ts`. Expected: FAIL. `foldTrackDarts`, `chainOnTarget` and `sectionOf` are not exported, and `ChainTrackExt` is not a type. The `initialTrackSeat` test fails only at type level; vitest does not type-check, so it may pass at runtime. Ledger that if so.

- [ ] **Step 6: Implement the kernel and policy.**
  - `modules/game/types.ts`, after `JudgedDart`:

```ts
/** Chain bookkeeping for a Track seat (Target Scoring): the live chain, the best finished chain per path index, and hits so far. */
export type ChainTrackExt = {
  chain: number;
  finishedBest: (number | null)[];
  hits: number;
};
```

  - `track-kernel.module.ts`: import `SeatState` from `./types` alongside the existing names. Change `initialTrackSeat`'s first parameter to `seat: SeatState`. Keep `SeatFact` for `foldTrackSeats`. Append:

```ts
/**
 * Folds one seat over every dart in `turns`, in write order, whoever threw
 * it — the solo exercise's fold, since its facts log no seats.
 */
export function foldTrackDarts<TExt>(
  turns: readonly TurnFact[],
  initial: TrackSeat<TExt>,
  rules: TrackRules<TExt>,
): TrackSeat<TExt> {
  return turns
    .flatMap((turn) => turn.darts)
    .reduce((seat, dart) => applyTrackDart(seat, dart, rules), initial);
}
```

  - `track-policies.ts`: add `export` to `function sectionOf`. Add `ChainTrackExt` to the `./types` import. Append:

```ts
/**
 * Per-dart policy (Target Scoring): a hit adds its points to the chain; a
 * miss that ends a live chain keeps the target's best finished chain and
 * moves to the next of `length` targets, wrapping after the last. A miss on
 * an empty chain changes nothing.
 */
export function chainOnTarget<TExt extends ChainTrackExt>(
  length: number,
): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt> {
  return (seat, dart) => {
    const { chain, finishedBest, hits } = seat.ext;
    if (dart.hit)
      return {
        ...seat,
        ext: { ...seat.ext, chain: chain + dart.points, hits: hits + 1 },
      };
    if (chain === 0) return seat;
    const best = [...finishedBest];
    best[seat.targetIndex] = Math.max(best[seat.targetIndex] ?? 0, chain);
    return {
      ...seat,
      targetIndex: (seat.targetIndex + 1) % length,
      ext: { ...seat.ext, chain: 0, finishedBest: best },
    };
  };
}
```

  Run Step 5's command again. Expected: PASS.

- [ ] **Step 7: Rebind the engine.** In `target-scoring.engine.module.ts`:
  - Delete `type Progress`, `initialProgress` and `applyDart`.
  - Keep `targetScoringPoints`, `targetScoringTargetLabel`, `intentFor`, `targetScoringSpec`, the class, the factory and the registration exactly as on `main`.
  - Replace the imports with:

```ts
import type { TargetScoringConfigData } from "@lib/types";
import { TargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  ChainTrackExt,
  DartFact,
  DartIntent,
  DartObservation,
  EngineFacts,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  BULL_TARGET_NUMBER,
  numbersPath,
} from "@modules/game/board-progression.module";
import {
  foldTrackDarts,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import {
  chainOnTarget,
  closeAfter,
  pathTarget,
  sectionOf,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import type { DartExerciseSpec } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { TargetScoringState } from "./types";
```

  - After `DARTS_PER_VISIT`, add:

```ts
const DONE_MESSAGE =
  "A Target Scoring seat never finishes; only the timer ends the exercise.";
const SOLO_SEAT = {
  participantRef: SOLO_PARTICIPANT_REF,
  sideKey: SOLO_PARTICIPANT_REF,
};
```

  - Where `Progress`, `initialProgress` and `applyDart` were, insert:

```ts
/**
 * Target Scoring's Track rules: the config's targets in order; a dart hits
 * when `targetScoringPoints` scores it and adds those points; `chainOnTarget`
 * builds the chain and cycles to the next target on a miss that ends one.
 * Visits close after three darts and carry no rule of their own.
 */
function targetScoringRules(
  config: TargetScoringConfigData,
): TrackRules<ChainTrackExt> {
  const pointsOn = (target: BoardTarget, observation: DartObservation) =>
    targetScoringPoints(sectionOf(target), observation);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(numbersPath(config.targets)),
    hit: (target, observation) => pointsOn(target, observation) !== null,
    points: (target, observation) => pointsOn(target, observation) ?? 0,
    onDart: chainOnTarget(config.targets.length),
    visitOpen: closeAfter(DARTS_PER_VISIT),
  };
}

function initialSeat(config: TargetScoringConfigData): TrackSeat<ChainTrackExt> {
  return initialTrackSeat(SOLO_SEAT, {
    chain: 0,
    finishedBest: config.targets.map(() => null),
    hits: 0,
  });
}
```

  - Replace `foldTargetScoringState`'s body. Keep its JSDoc, but change "mirroring `foldSwitchingState`" to "folded through the Track kernel's `foldTrackDarts`":

```ts
export function foldTargetScoringState(
  facts: EngineFacts,
  config: TargetScoringConfigData,
  complete: boolean,
): TargetScoringState {
  const seat = foldTrackDarts(
    facts.turns,
    initialSeat(config),
    targetScoringRules(config),
  );
  const { chain, finishedBest, hits } = seat.ext;
  const bestChainByTarget = config.targets.map((targetNumber, index) => ({
    targetNumber,
    bestChain: Math.max(
      finishedBest[index] ?? 0,
      index === seat.targetIndex ? chain : 0,
    ),
  }));

  return {
    currentTargetNumber: config.targets[seat.targetIndex],
    targetIndex: seat.targetIndex,
    currentChain: chain,
    bestChain: Math.max(0, ...bestChainByTarget.map((entry) => entry.bestChain)),
    markToBeat: finishedBest[seat.targetIndex],
    bestChainByTarget,
    hits,
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}
```

  - If `npm run check` reports `DartFact` unused, it is not: `targetScoringPoints` still takes `Pick<DartFact, ...>`. Any other unused import goes.

- [ ] **Step 8: Teach the gate the alias import.** In `scripts/check-engine-kernels.sh`:
  - Header comment: change `KERNEL_BOUND  -> the file imports ./<kernel>-kernel.module` to `KERNEL_BOUND  -> the file imports ./<kernel>-kernel.module (exercises: @modules/game/<kernel>-kernel.module)`.
  - `imports_kernel`: change the pattern to `grep -qE "from \"(\./|@modules/game/)[a-z-]+-kernel\.module\"" "$path" && imports_kernel=1`.
  - `KERNEL_BOUND`: change the check to `grep -qE "from \"(\./|@modules/game/)${slug}-kernel\.module\"" "$path" || fail "$path is KERNEL_BOUND but does not import ./${slug}-kernel.module"`. The message stays, because the existing fixture greps it.

  In `scripts/test-check-engine-kernels.sh`, before the `echo "test-check-engine-kernels: ..."` line, add:

```bash
T=$(tree); printf 'import { a } from "@modules/game/track-kernel.module";\n' > "$T/app/src/modules/game/foo.engine.module.ts"; row TRACK KERNEL_BOUND docs/game-rules/rulesets/foo.md "" "$T"
expect pass "KERNEL_BOUND with alias import" "$T"

T=$(tree); printf 'import { a } from "@modules/game/track-kernel.module";\n' > "$T/app/src/modules/game/foo.engine.module.ts"; row TRACK PENDING docs/game-rules/rulesets/foo.md "Track PR 9" "$T"
expect fail "stale PENDING row, alias import" "$T" "imports a kernel but is marked PENDING"
```

  Run `bash scripts/test-check-engine-kernels.sh` before the gate edit (expected: the two new cases FAIL), then after it (expected: 12 passed, 0 failed).

- [ ] **Step 9: Flip the registry row** in `scripts/engine-kernels.txt` to:

```
app/src/modules/training/exercises/target-scoring.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/target-scoring.md |
```

  Run `bash scripts/check-engine-kernels.sh`. Expected: OK.

- [ ] **Step 10: Run everything.**
  - `cd app && npm test`, in the background. Expected: all PASS, including:
    - the 5 oracle cases;
    - the 4 existing and 4 aimed Target Scoring goldens, with **no snapshot written** (`git status` shows no `__snapshots__` change);
    - every pre-existing Target Scoring, Switching Target Scoring, shell, routine and adapter test, unedited;
    - every other golden.

- [ ] **Step 11: Prove the oracle catches a rebind slip.** Do each of these separately; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. In `chainOnTarget`, delete `if (chain === 0) return seat;`. Every case must fail on `state`. The policy test for the empty chain fails too, which is expected.
  2. In `chainOnTarget`, change `hits: hits + 1` to `hits`. Every case must fail on `state.hits`.

- [ ] **Step 12: Gates.**
  - `cd app && npm run check`, in the background → 0/0/0.
  - `cd app && npx fallow`:
    - complexity clean;
    - dead-code clean (`foldTrackDarts`, `chainOnTarget`, `sectionOf` and `ChainTrackExt` have callers);
    - duplication recorded.
  - From the repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-engine-kernels.sh && bash scripts/test-check-engine-kernels.sh && bash scripts/check-game-engines.sh`.

- [ ] **Step 13: Commit.**

```bash
git add app/src/modules/game app/src/modules/training/exercises app/tests/modules/game app/tests/modules/training/exercises scripts/check-engine-kernels.sh scripts/test-check-engine-kernels.sh scripts/engine-kernels.txt
git commit -m "refactor(target-scoring): fold through the Track kernel; chainOnTarget, foldTrackDarts"
```

### Task 6.3: Delete the legacy copy, docs, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/training/exercises/legacy/target-scoring.legacy.ts`, `app/tests/modules/training/exercises/target-scoring.oracle.test.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md` (Track row ~line 830; gate bullet ~line 837; version 1.11.6)
- Modify: `docs/architecture/00-File-Inventory.md` (`track-kernel.module.ts`, `track-policies.ts`, `target-scoring.engine.module.ts`, `check-engine-kernels.sh` rows)
- Modify: `docs/architecture/00-Context-Map-History.md` (append a row)
- Modify: `app/src/modules/training/CLAUDE.md` (exercise-shell bullet)

- [ ] **Step 1: Delete the legacy copy and the oracle.**
  - The guarantee stays with `target-scoring.golden.test.ts` and `target-scoring.aimed.golden.test.ts`. Both were recorded from the original engine and passed unchanged in Task 6.2 Step 10.
  - Commit 1 keeps the oracle's proof in history.
  - Remove `app/tests/modules/training/exercises/legacy/` if it is empty.

- [ ] **Step 2: Update `04-Architecture-patterns.md`.**
  - In the Track row status cell, write: `built — Doubles Training, Bob's 27, Singles Training, Around the Clock, Shanghai, Target Scoring bound (D468)`.
  - In the bullet on `scripts/check-engine-kernels.sh` (~line 839), after "holds it true against the code's imports", insert "(`./<kernel>-kernel.module` in `modules/game/`, `@modules/game/<kernel>-kernel.module` from an exercise)".
  - Version line: `1.11.6 (Pattern 18: Target Scoring, the first exercise, bound to the Track kernel through `foldTrackDarts`; the kernel gate accepts the exercise import 2026-10-17, D468; prior 1.11.5: …`. Keep the rest of the chain.

- [ ] **Step 3: Update the File Inventory.**
  - `track-kernel.module.ts` row: append "; `foldTrackDarts` for a solo exercise's seatless log, `initialTrackSeat` takes a `SeatState` (Target Scoring, 2026-10-17)".
  - `track-policies.ts` row: append "; `chainOnTarget`, `sectionOf` exported (Target Scoring, 2026-10-17)".
  - `target-scoring.engine.module.ts` row: append "; folds through the Track kernel (D468, 2026-10-17)".
  - `check-engine-kernels.sh` row: append "; accepts an exercise's `@modules/game/` kernel import (2026-10-17)".
  - Where a row cites the 04 version, update it to 1.11.6.

- [ ] **Step 4: Update `app/src/modules/training/CLAUDE.md`.** Replace the bullet "A clockless timed dart exercise is a `DartExerciseSpec` bound to `exercises/dart-exercise-shell.module.ts`; Target Scoring is the reference shape. (2026-10-16, D462)" with: "A clockless timed dart exercise is a `DartExerciseSpec` bound to `exercises/dart-exercise-shell.module.ts`; Target Scoring is the reference shape. (2026-10-16, D462) A Track-family exercise folds its log through the kernel's `foldTrackDarts` with a `TrackRules` record, as Target Scoring does; there is no exercise adapter yet (Track spec §3). (2026-10-17, D468)".

- [ ] **Step 5: Add the history row** to `00-Context-Map-History.md`:

```
| `target-scoring.engine.module.ts`, `track-kernel.module.ts`, `track-policies.ts`, `modules/game/types.ts`, `modules/training/CLAUDE.md`, their tests, `support/aimed-observations.ts`, `target-scoring.aimed.golden.test.ts`, `scripts/{check,test-check}-engine-kernels.sh`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (v1.11.6), `00-File-Inventory.md` | Target Scoring bound to the Track kernel, the first exercise (aimed goldens recorded pre-rebind, oracle over five configs with timer expiry); kernel gains `foldTrackDarts`; policy `chainOnTarget`, `sectionOf` exported; the kernel gate accepts the exercise import. Track PR 6, D468 (2026-10-17) | historical |
```

- [ ] **Step 6: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. In particular:
  - `npm test` is green, with the count equal to Task 6.2's minus the 5 oracle tests;
  - `npx fallow` duplication is ≤ the Task 6.1 Step 0 baseline. If the aimed golden's `FULL_BOARD`/timer setup pushes it over, accept a rise only if fallow names the existing golden files as the clone pair, and say so in the PR body; otherwise extract the shared piece;
  - `check-doc-links.sh`, `check-context-budget.sh` (update the `00-Context-Map.md` token claims if they drift), `check-decision-ids.sh`, `check-doc-sync.sh`, `check-engine-kernels.sh` and `check-game-engines.sh` pass;
  - `cd app && npm run format` has been run, any diff committed, and `npm run format:check` is clean.

- [ ] **Step 7: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/training/exercises app/src/modules/training/CLAUDE.md docs
git commit -m "test(target-scoring): drop legacy copy; goldens hold the guarantee (D468)"
git push -u origin refactor/track-kernel-target-scoring
```

  Open the PR per `finishing-a-dart-branch`, with the body following `.github/pull_request_template.md`. Include:
  - the oracle cases, seeds, steps and the aimed rate;
  - all four mutation-check results (Task 6.1 Step 6 ×2, Task 6.2 Step 11 ×2);
  - fallow duplication before and after;
  - refinements 2 (cycling), 3 (`foldTrackDarts`), 4 (`trackExerciseSpec` deferred), 5 (outcome deferred) and 7 (gate).

  End the body with the generated line plus the session link. Subscribe and drive to green. Merge `origin/main` in (never rebase) on conflict.
