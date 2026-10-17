# Track Kernel — PR 5 (Shanghai) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Shanghai (V1 + V2, Normal and Hard) onto the game shell and the Track kernel with no change in behaviour. The shell gains a hook that writes a closed visit's own total.

**Architecture:**
- Shanghai becomes:
  - a `DartGameSpec` bound to `dart-engine-shell.module.ts` (a hand-written class today);
  - a `TrackRules<ShanghaiTrackExt>` record over `applyTrackDart` / `foldTrackSeats`, with `ext = { zones, shanghai }`.
- A projection maps `TrackSeat` back to `ShanghaiSeatState`. Every export keeps its name and call shape: `initialShanghaiState`, `zoneBucketOf`, `activeTargetOf(state, config?)`, `applyShanghaiDart(state, observation, difficulty?)`, `foldShanghaiState(facts, config)`, `ShanghaiEngine` and both factories.
- Four policies land with this first caller: `boardScorePoints`, `recordVisitZone`, `halveOnBlank` and `shanghaiWin`. `zoneBucketOf` moves into `track-policies.ts`, and the engine re-exports it.
- One additive shell change (spec §6): an optional `DartGameSpec.closedVisitTotal(opened, closed, participantRef)`. When present, the shell writes its result to the closing turn's `totalScore`.
- Proof, as in PR 4:
  1. Goldens are recorded from the original engine in commit 1 (Shanghai has none).
  2. The differential oracle runs with an aimed generator at 1–3 seats, V1 and V2 Normal/Hard.

**Tech Stack:** TypeScript, Vitest, Bash, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§2 Shanghai row, §4 policy list, §5 Shanghai row, §6 visit-total hook, §7 method + quirk, §8 PR 5). Previous plan: `docs/superpowers/plans/2026-10-17-track-kernel-pr4-atc.md` (merged as #987).

## Global Constraints

- Branch `refactor/track-kernel-shanghai`, from `origin/main` at `bc180ba` or later. Never `--no-verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Types go in barrels (`modules/game/types.ts`, `interfaces.ts`). Tests import them from `@modules/types` / `@modules/interfaces`.
- No `//` comments inside function bodies. Use JSDoc above the declaration.
- Fallow:
  - cognitive complexity ≤ 15 per function;
  - duplication may rise while the legacy copy exists, but must be ≤ `main`'s count after Task 5.4 (record it in Task 5.1 Step 0).
- `cd app && npm run check` reports 0 errors, 0 warnings, 0 hints.
- `npm test`, `npm run check` and `npx fallow` run past the 120 s Bash limit. Run them in the background and wait on the output file. Do not edit files while a background run is live.
- This is a refactor:
  - Every existing test passes with **no edits**: `shanghai.engine.module.test.ts`, `shanghai-play.data` tests, `dart-engine-shell.module.test.ts`, `derived-aims`, `session-progress`, `shanghai-count`, `replay-*`, the DartBot contract test, and every existing golden.
  - New tests are appended only.
  - Existing snapshots stay unchanged.
- Preserve the quirk in spec §7 and do not fix it: Shanghai calls `activeSeat` without a completion predicate.
- The registry flip rides **commit 2**, because `check-engine-kernels.sh` runs pre-commit.
- The legacy copy must not leave an unused declaration behind (ts(6133) hint). Delete such functions from the copy.
- No D-entry: the hook sits inside D468 / spec §6. `bash scripts/next-decision-id.sh` printed D469 at plan time.

## Spec refinements made by this plan

1. **Policy names and shapes fixed.**

   | Policy | Slot | Behaviour |
   | --- | --- | --- |
   | `anyRingEitherBull` (reused) | hit | Same number, any of the five number rings. This is legacy's `zoneBucketOf(zone) !== null` set exactly. Spec §4's `sdtBucket` is therefore not added. |
   | `boardScorePoints` | points | A hit scores `boardScore(hitTargetNumber, hitZoneKey)`; a miss scores 0. |
   | `recordVisitZone` | onDart | Appends the dart's zone (hit) or `null` (miss) to `ext.zones`. `TExt extends { zones: (DartZoneKey \| null)[] }`. |
   | `halveOnBlank` | onVisitClose | `hitsThisVisit === 0`: `score = Math.round(score / 2)`. Otherwise the seat unchanged (same reference). |
   | `shanghaiWin` | onVisitClose | When `ext.zones`' hit buckets hold SINGLE, DOUBLE and TREBLE: `DONE` and `ext.shanghai = true`. Otherwise unchanged. |
   | `closeAfter(3)`, `advanceToEnd(19)`, `pathTarget` (reused) | visitOpen / onVisitClose / target | As on `main`. |

   - The kernel seat counts darts and hits. Shanghai's state carries the visit's zone list, so the list lives in `ext.zones`.
   - `SHANGHAI` versus `COMPLETE` both map to kernel `DONE`, so `ext.shanghai` records which.
   - Visit close order, as legacy: halve (Hard only) → `shanghaiWin` → `advanceToEnd(19)` if still `IN_PROGRESS` → `ext.zones = []`.

2. **The visit-total hook** (spec §6 named it `onVisitClosed(turn, before, after)`). It becomes:

   ```ts
   closedVisitTotal?(opened: TState, closed: TState, participantRef: string): number;
   ```

   - `opened` is the fold of `turnsBeforeVisit(turns, turn)`, i.e. the log as the visit opened. Legacy folded `turns.slice(0, -1)`; the closing turn is always last, so the two are the same.
   - `closed` is the fold after `completedAt` is stamped, as legacy.
   - "Before" in the spec meant the state before the *dart*. That cannot give a 3-dart visit's total.
   - The shell writes the result to `turn.totalScore`, then folds once more for the return value.
   - Specs without the hook keep the board-score sum `appendObservedDart` writes. They pay no extra fold.

3. **`TrackRules.outcome` deferred again.**
   - Shanghai is the only race-then-score engine, so a member would move one call without sharing it.
   - The race/score composition stays in `foldShanghaiState`, unchanged.
   - Re-check at PR 6. Target Scoring is timer-only, also unshared.

4. **Legacy's BULL guard goes.** Legacy `activeNumberAt` throws "Shanghai never reaches the BULL target".
   - No fold reaches it: `advanceToEnd(19)` stops at index 19.
   - `applyShanghaiDart` on a hand-built seat at index 20 would now judge BULL by `anyRingEitherBull` instead of throwing. No caller builds one: `derived-aims` only feeds folded seats.
   - Accepted.

5. **Key from the factory, not the snapshot.** Unlike ATC, legacy Shanghai takes the key as the constructor's third argument (default `SHANGHAI_V1`). The plain shell class does the same, so no subclass constructor is needed: `export class ShanghaiEngine extends dartGameEngineClass(shanghaiSpec) {}`.

6. **`aimedOnPath(path, rate)` joins `support/aimed-observations.ts`.** `aimedSinglesObservation` delegates to it with the same `rand()` draw order, so the Singles snapshot cannot move. Shanghai uses it directly, and no new generator file is needed. This avoids a fallow clone.

## Review Focus

1. **A Hard blank visit's turn total.** It is negative: minus half the prior score, rounding half up. The seat's turn totals sum to its score. Pinned in Task 5.3 (boundary test 1).
2. **Undo of a closing dart.** `totalScore` goes back to the board-score sum of the 2 darts left, and `completedAt` is cleared. Re-closing rewrites the counted total. Pinned in Task 5.3 (boundary test 2) and Task 5.2 (shell test).
3. **A duo after a Shanghai.** The other seat still reads `IN_PROGRESS`. `record` throws the *match*-ended message, and `wouldComplete` is false. Pinned in Task 5.3 (boundary test 3).
4. **A V2 engine rehydrated through its factory.** It keeps `SHANGHAI_V2` and Hard halving. Pinned in Task 5.3 (boundary test 4).
5. **Mid-visit `dartsThisVisit`.** It lists the hit zone or `null` per dart, and empties at close. A Shanghai on round 20 reads `SHANGHAI`, not `COMPLETE`. Pinned in Task 5.3 (boundary test 5) and the existing round-20 test.

---

### Task 5.1: Shared aimed input, goldens, legacy copy and oracle (commit 1)

**Files:**
- Modify: `app/tests/modules/game/support/aimed-observations.ts` (add `aimedOnPath`)
- Modify: `app/tests/modules/game/support/singles-observations.ts` (delegate)
- Create: `app/tests/modules/game/shanghai.golden.test.ts` (and its `__snapshots__` file)
- Create: `app/tests/modules/game/legacy/shanghai.legacy.ts`
- Create: `app/tests/modules/game/shanghai.oracle.test.ts`

**Interfaces:**
- Consumes: from `support/engine-oracle.ts`, `runOracle`, `goldenTrace`, `randomObservation`, `normalise` and `OracleEngine`; from board-progression, `numbersPath`.
- Produces:
  - `aimedOnPath(path: readonly BoardTarget[], rate: number): (rand: () => number, engine: OracleEngine) => DartObservation`;
  - `LegacyShanghaiEngine`, test-only and deleted in Task 5.4.

- [ ] **Step 0: Baseline.** Run `cd app && npx fallow` in the background. Record the duplication clone-group and line counts; those are `main`'s.

- [ ] **Step 1: Add `aimedOnPath`.** Append to `support/aimed-observations.ts`, and add `randomObservation` to its `./engine-oracle` import (`import { randomObservation, type OracleEngine } from "./engine-oracle";`):

```ts
/**
 * `rate` of darts on the active seat's target along `path`, in any ring
 * (either bull on BULL), otherwise `randomObservation`.
 */
export function aimedOnPath(
  path: readonly BoardTarget[],
  rate: number,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  return (rand, engine) => {
    if (rand() >= rate) return randomObservation(rand);
    return onActiveTarget(engine, path, rand, () => anyRing(rand));
  };
}
```

  Replace the body of `support/singles-observations.ts` with:

```ts
import { numbersPath } from "@modules/game/board-progression.module";
import type { OracleEngine } from "./engine-oracle";
import { aimedOnPath } from "./aimed-observations";
import type { DartObservation } from "@modules/types";

/**
 * 55 % a dart on the active seat's own target, in any ring (keypad SINGLE
 * included), otherwise `randomObservation`. Enough on-target darts that
 * HARD/EXTREME seats survive visits and reach BULL.
 */
export function aimedSinglesObservation(config: {
  targetOrder: readonly number[];
}): (rand: () => number, engine: OracleEngine) => DartObservation {
  return aimedOnPath(numbersPath(config.targetOrder), 0.55);
}
```

  Run `cd app && npx vitest run tests/modules/game/singles-training.golden.test.ts`. Expected: PASS, with no snapshot written (`git status` shows no `__snapshots__` change).

- [ ] **Step 2: Record the goldens** in `app/tests/modules/game/shanghai.golden.test.ts`. Do this before any engine change.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShanghaiEngine } from "@modules/game/shanghai.engine.module";
import { numbersPath } from "@modules/game/board-progression.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { aimedOnPath } from "./support/aimed-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type {
  RulesetVersionKey,
  Seated,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const observe = aimedOnPath(numbersPath(), 0.55);

const CONFIGS: Record<
  string,
  {
    key: RulesetVersionKey;
    config: Seated<ShanghaiSnapshot> | Seated<ShanghaiV2Snapshot>;
  }
> = {
  "v1 solo": { key: "SHANGHAI_V1", config: { seats: seats(1) } },
  "v1 duo": { key: "SHANGHAI_V1", config: { seats: seats(2) } },
  "v2 hard solo": {
    key: "SHANGHAI_V2",
    config: { difficulty: "HARD", seats: seats(1) },
  },
  "v2 hard trio": {
    key: "SHANGHAI_V2",
    config: { difficulty: "HARD", seats: seats(3) },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Shanghai — golden", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new ShanghaiEngine(config, undefined, key);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 260 && !engine.isComplete(); i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(observe(rand, engine));
      }
      expect(
        normalise({
          key: engine.rulesetVersionKey,
          facts: engine.facts(),
          state: engine.state(),
        }),
      ).toMatchSnapshot();
    });
  }
});

describe("Shanghai — golden trace", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new ShanghaiEngine(config, prior, key),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          observe,
        }),
      ).toMatchSnapshot();
    });
  }
});
```

  - Run `cd app && npx vitest run tests/modules/game/shanghai.golden.test.ts`. Expected: 8 PASS, with snapshots written.
  - Open the `.snap` and check three things:
    1. some run or trace ends `SHANGHAI`;
    2. some run or trace has a seat `COMPLETE` (all 20 rounds);
    3. a Hard trace holds a negative turn `totalScore` (a halved blank visit).
  - If any check fails, use `aimedOnPath(numbersPath(), 0.65)` in this file only, delete the `.snap` and re-record. Record the rate for the PR body.

- [ ] **Step 3: Copy the legacy module.** Run `mkdir -p app/tests/modules/game/legacy && cp app/src/modules/game/shanghai.engine.module.ts app/tests/modules/game/legacy/shanghai.legacy.ts`. In the copy:
  - Rewrite `./x` imports as `@modules/game/x`, and `./types` / `./interfaces` as `@modules/types` / `@modules/interfaces`.
  - Delete both factory blocks and both `registerEngineFactory(...)` calls. Drop the `registerEngineFactory` and `GameEngineFactory` imports.
  - Rename the class to `LegacyShanghaiEngine`.
  - Remove `export` from every function.
  - Delete `initialShanghaiState`, because nothing else in the copy calls it. Keep `difficultyOf`, `initialSeatState`, `zoneBucketOf`, `activeTargetOf`, `activeNumberAt`, `isShanghai`, `applyShanghaiDart` and `foldShanghaiState`, because the class or the reducer reaches each.

- [ ] **Step 4: Write the oracle test** `app/tests/modules/game/shanghai.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { ShanghaiEngine } from "@modules/game/shanghai.engine.module";
import { numbersPath } from "@modules/game/board-progression.module";
import { LegacyShanghaiEngine } from "./legacy/shanghai.legacy";
import { runOracle } from "./support/engine-oracle";
import { aimedOnPath } from "./support/aimed-observations";
import type {
  RulesetVersionKey,
  Seated,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);
const V1 = "SHANGHAI_V1";
const V2 = "SHANGHAI_V2";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [
  string,
  RulesetVersionKey,
  Seated<ShanghaiSnapshot> | Seated<ShanghaiV2Snapshot>,
][] = [
  ["v1 solo", V1, { seats: seats(1) }],
  ["v1 duo", V1, { seats: seats(2) }],
  ["v1 trio", V1, { seats: seats(3) }],
  ["v2 normal duo", V2, { difficulty: "NORMAL", seats: seats(2) }],
  ["v2 hard solo", V2, { difficulty: "HARD", seats: seats(1) }],
  ["v2 hard duo", V2, { difficulty: "HARD", seats: seats(2) }],
  ["v2 hard trio", V2, { difficulty: "HARD", seats: seats(3) }],
];

describe("Shanghai — kernel vs legacy oracle", () => {
  for (const [name, key, cfg] of CASES) {
    it(
      `${name}: indistinguishable through every public method`,
      () => {
        runOracle({
          build: (prior) => new ShanghaiEngine(cfg, prior, key),
          legacy: (prior) => new LegacyShanghaiEngine(cfg, prior, key),
          seeds: SEEDS,
          steps: 260,
          undoRate: 0.12,
          rehydrateEvery: 19,
          observe: aimedOnPath(numbersPath(), 0.55),
        });
      },
      60_000,
    );
  }
});
```

- [ ] **Step 5: Run it.** Run `cd app && npx vitest run tests/modules/game/shanghai.oracle.test.ts`. Expected: 7 PASS, since both sides are the same code. Note the wall time. If a case nears 60 s, drop `steps` to 200 for all cases and say so in the PR body.

- [ ] **Step 6: Prove the oracle can fail.** Do each of these separately in the legacy copy; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. In `applyShanghaiDart`, change `Math.round(totalScore / 2)` to `Math.floor(totalScore / 2)`. The Hard cases must fail.
  2. In `record`, change `openTurn.totalScore = visitEnd - visitStart;` to `openTurn.totalScore = visitEnd;`. Every case must fail on `facts`.

- [ ] **Step 7: Gates and commit.**
  - `cd app && npm run check`, in the background → 0/0/0. A hint in the legacy copy means an unused declaration: delete it.
  - `npm test`, in the background → all PASS.

```bash
git add app/tests/modules/game
git commit -m "test(shanghai): freeze legacy engine, shared aimed input, goldens"
```

### Task 5.2: Shell visit-total hook

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`DartGameSpec.closedVisitTotal`)
- Modify: `app/src/modules/game/dart-engine-shell.module.ts`
- Test: `app/tests/modules/game/dart-engine-shell.module.test.ts` (append)

**Interfaces:**
- Consumes: the shell as on `main` (timer, state-aware visits).
- Produces: `DartGameSpec.closedVisitTotal?(opened: TState, closed: TState, participantRef: string): number`.

- [ ] **Step 1: Write the failing shell tests.** Append to `dart-engine-shell.module.test.ts`:

```ts
describe("closed visit totals", () => {
  const calls: [number, number, string][] = [];
  const Totalled = dartGameEngineClass<{ limit: number }, Toy>({
    ...spec,
    closedVisitTotal: (opened, closed, participantRef) => {
      calls.push([opened.darts, closed.darts, participantRef]);
      return closed.darts - opened.darts;
    },
  });

  it("writes the spec's total on the closing dart, from the state the visit opened on", () => {
    calls.length = 0;
    const engine = new Totalled({ limit: 10 });
    [T20, T20, T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.facts().turns[0].totalScore).toBe(3);
    expect(engine.facts().turns[1].totalScore).toBe(120);
    engine.record(T20);
    expect(engine.facts().turns[1].totalScore).toBe(3);
    expect(calls).toEqual([
      [0, 3, "p1"],
      [3, 6, "p1"],
    ]);
  });

  it("undo of the closing dart restores the board-score sum", () => {
    const engine = new Totalled({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    engine.undo();
    expect(engine.facts().turns[0]).toMatchObject({
      completedAt: null,
      totalScore: 120,
    });
  });

  it("leaves the board-score sum without the hook", () => {
    const engine = new Toy({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.facts().turns[0].totalScore).toBe(180);
  });
});
```

  Run `cd app && npx vitest run tests/modules/game/dart-engine-shell.module.test.ts`. Expected: the first two new tests FAIL (`totalScore` is 180, `calls` is empty); the third PASSES; tsc may flag `closedVisitTotal` as an unknown property, which is the same failure.

- [ ] **Step 2: Implement.** In `interfaces.ts`, `DartGameSpec`, after `wouldComplete`:

```ts
  /** The `totalScore` a closing visit persists, from the state before it opened and after it closed; without it the darts' board-score sum stays. */
  closedVisitTotal?(
    opened: TState,
    closed: TState,
    participantRef: string,
  ): number;
```

  In `dart-engine-shell.module.ts`:
  - Add `turnsBeforeVisit` to the `./turn-log.module` import.
  - The JSDoc gains, after the `completedAt` sentence: "A spec with `closedVisitTotal` then sets that turn's `totalScore`."
  - Replace `deriveState()` with:

```ts
    private foldTurns(turns: TurnFact[]): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns },
        this.config,
        this.timerExpired,
      );
    }

    private deriveState(): TState {
      return this.foldTurns(this.turns);
    }
```

  - In `record`, replace the last two lines (`turn.completedAt = …; return this.deriveState();`) with:

```ts
      turn.completedAt = new Date().toISOString();
      if (spec.closedVisitTotal)
        turn.totalScore = spec.closedVisitTotal(
          this.foldTurns(turnsBeforeVisit(this.turns, turn)),
          this.deriveState(),
          turn.participantRef,
        );
      return this.deriveState();
```

  Re-run the shell test file. Expected: all PASS, the pre-existing tests included and unedited. Then run `npx vitest run tests/modules/game/doubles-training.golden.test.ts tests/modules/game/bobs27.golden.test.ts tests/modules/game/singles-training.golden.test.ts tests/modules/game/around-the-clock.golden.test.ts`. Expected: PASS, with no snapshot written.

- [ ] **Step 3: No commit yet.** It commits with Task 5.3, whose engine is the hook's first caller.

### Task 5.3: Track policies and the Shanghai rebind (commit 2)

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `ShanghaiTrackExt`)
- Modify: `app/src/modules/game/track-policies.ts` (move `zoneBucketOf`; append four policies)
- Modify: `app/src/modules/game/shanghai.engine.module.ts`
- Modify: `scripts/engine-kernels.txt` (Shanghai row → `KERNEL_BOUND`)
- Test: `app/tests/modules/game/track-policies.test.ts`, `app/tests/modules/game/shanghai.engine.module.test.ts` (append only)

**Interfaces:**
- Consumes: Task 5.2's hook; `pathTarget`, `anyRingEitherBull`, `closeAfter`, `advanceToEnd`, `applyTrackDart` and `foldTrackSeats` as on `main`.
- Produces:
  - `ShanghaiTrackExt = { zones: (DartZoneKey | null)[]; shanghai: boolean }` (in the `@modules/types` barrel);
  - `zoneBucketOf(zone: DartZoneKey): "SINGLE" | "DOUBLE" | "TREBLE" | null` (moved; still re-exported by the engine);
  - `boardScorePoints(_target: BoardTarget, observation: DartObservation, hit: boolean): number`;
  - `recordVisitZone<TExt extends { zones: (DartZoneKey | null)[] }>(seat: TrackSeat<TExt>, dart: JudgedDart): TrackSeat<TExt>`;
  - `halveOnBlank<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt>`;
  - `shanghaiWin<TExt extends { zones: (DartZoneKey | null)[]; shanghai: boolean }>(seat: TrackSeat<TExt>): TrackSeat<TExt>`.

- [ ] **Step 1: Write the boundary tests.** These characterise legacy behaviour at the projection's and the shell's seams. Append them to `shanghai.engine.module.test.ts`. That file already imports `ShanghaiEngine`, `shanghaiV2EngineFactory`, `applyShanghaiDart`, `DartObservation`, `DartZoneKey`, `ShanghaiSeatState`, `Seated`, `ShanghaiSnapshot` and `ShanghaiV2Snapshot`, and defines `SEATS`, `config` and `missObservation`.

```ts
describe("Shanghai — kernel seams", () => {
  const on = (number: number | null, zone: DartZoneKey): DartObservation => ({
    hitTargetNumber: number,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  });
  const hard: Seated<ShanghaiV2Snapshot> = {
    difficulty: "HARD",
    seats: SEATS,
  };
  const duo: Seated<ShanghaiSnapshot> = {
    seats: [
      ...SEATS,
      {
        participantRef: "participant-2",
        displayName: "B",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };

  it("1: a Hard blank visit persists a negative total, and turn totals sum to the score", () => {
    const engine = shanghaiV2EngineFactory.create(hard);
    [on(1, "TREBLE"), on(1, "TREBLE"), on(1, "SINGLE")].forEach((o) =>
      engine.record(o),
    );
    [missObservation(), on(5, "TREBLE"), missObservation()].forEach((o) =>
      engine.record(o),
    );
    const turns = engine.facts().turns;
    expect(turns.map((t) => t.totalScore)).toEqual([7, -3]);
    expect(engine.state().seats[0].totalScore).toBe(4);
  });

  it("2: undo of a closing dart restores the board sum; re-closing rewrites the counted total", () => {
    const engine = new ShanghaiEngine(config);
    [on(1, "SINGLE"), on(20, "TREBLE"), on(1, "DOUBLE")].forEach((o) =>
      engine.record(o),
    );
    expect(engine.facts().turns[0].totalScore).toBe(3);
    engine.undo();
    expect(engine.facts().turns[0]).toMatchObject({
      completedAt: null,
      totalScore: 61,
    });
    engine.record(on(1, "DOUBLE"));
    expect(engine.facts().turns[0].totalScore).toBe(3);
  });

  it("3: after a Shanghai in a duo, the other seat is IN_PROGRESS but the match refuses", () => {
    const engine = new ShanghaiEngine(duo);
    [on(1, "SINGLE"), on(1, "DOUBLE"), on(1, "TREBLE")].forEach((o) =>
      engine.record(o),
    );
    expect(engine.state().status).toBe("SHANGHAI");
    expect(engine.state().seats[1].status).toBe("IN_PROGRESS");
    expect(engine.wouldComplete(on(1, "SINGLE"))).toBe(false);
    expect(() => engine.record(on(1, "SINGLE"))).toThrow(
      "Cannot record a dart once the match has ended; undo first to correct it.",
    );
  });

  it("4: a V2 engine rehydrated through its factory keeps its key and Hard halving", () => {
    const engine = shanghaiV2EngineFactory.create(hard);
    [on(1, "TREBLE"), on(1, "SINGLE"), on(1, "SINGLE")].forEach((o) =>
      engine.record(o),
    );
    const resumed = shanghaiV2EngineFactory.create(hard, engine.facts());
    expect(resumed.rulesetVersionKey).toBe("SHANGHAI_V2");
    [missObservation(), missObservation(), missObservation()].forEach((o) =>
      resumed.record(o),
    );
    expect(resumed.state().seats[0].totalScore).toBe(3);
  });

  it("5: mid-visit zones keep null for a miss and empty at close", () => {
    const seat = (darts: DartObservation[]): ShanghaiSeatState =>
      darts.reduce<ShanghaiSeatState>(
        (state, o) => applyShanghaiDart(state, o),
        {
          participantRef: "participant-1",
          sideKey: "A",
          targetIndex: 0,
          totalScore: 0,
          dartsThisVisit: [],
          status: "IN_PROGRESS",
        },
      );
    expect(seat([on(1, "INNER_SINGLE"), on(2, "DOUBLE")])).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 0,
      totalScore: 1,
      dartsThisVisit: ["INNER_SINGLE", null],
      status: "IN_PROGRESS",
    });
    expect(
      seat([on(1, "INNER_SINGLE"), on(2, "DOUBLE"), on(1, "DOUBLE")]),
    ).toMatchObject({ targetIndex: 1, totalScore: 3, dartsThisVisit: [] });
  });
});
```

  Test 1's arithmetic: round 1 scores 3 + 3 + 1 = 7. Round 2's darts all miss the 2 (`on(5, …)` is off target), so the visit halves 7 to `Math.round(3.5) = 4`: a turn total of −3.

- [ ] **Step 2: Run them against the unchanged engine.** Run `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts`. Expected: PASS. These are characterisation tests. If one fails, the test is wrong, not the engine: fix its arithmetic or fixture.

- [ ] **Step 3: Write the failing policy tests.** In `track-policies.test.ts`, add `boardScorePoints, halveOnBlank, recordVisitZone, shanghaiWin, zoneBucketOf` to the import. Append inside `describe("track policies", ...)`, after the PR 4 block, which defines `on`, `FIVE` and `BULL`:

```ts
  it("boardScorePoints: a hit's board score, nothing for a miss", () => {
    expect(boardScorePoints(FIVE, on(5, "TREBLE"), true)).toBe(15);
    expect(boardScorePoints(FIVE, on(5, "DOUBLE"), true)).toBe(10);
    expect(boardScorePoints(FIVE, on(5, "OUTER_SINGLE"), true)).toBe(5);
    expect(boardScorePoints(FIVE, on(20, "TREBLE"), false)).toBe(0);
  });

  it("zoneBucketOf: single rings, double, treble; null otherwise", () => {
    expect(zoneBucketOf("INNER_SINGLE")).toBe("SINGLE");
    expect(zoneBucketOf("DOUBLE")).toBe("DOUBLE");
    expect(zoneBucketOf("TREBLE")).toBe("TREBLE");
    expect(zoneBucketOf("OUTER_BULL")).toBeNull();
    expect(zoneBucketOf("MISS")).toBeNull();
  });

  type Zones = { zones: (DartZoneKey | null)[]; shanghai: boolean };
  const zoned = (
    zones: (DartZoneKey | null)[],
    over: Partial<TrackSeat<Zones>> = {},
  ): TrackSeat<Zones> => ({
    ...initialTrackSeat(SEAT, { zones, shanghai: false }),
    ...over,
  });

  it("recordVisitZone: the zone on a hit, null on a miss, input untouched", () => {
    const before = zoned(["SINGLE"]);
    const dart = (hit: boolean) => ({
      observation: on(5, "TREBLE"),
      target: FIVE,
      hit,
      points: 0,
    });
    expect(recordVisitZone(before, dart(true)).ext.zones).toEqual([
      "SINGLE",
      "TREBLE",
    ]);
    expect(recordVisitZone(before, dart(false)).ext.zones).toEqual([
      "SINGLE",
      null,
    ]);
    expect(before.ext.zones).toEqual(["SINGLE"]);
  });

  it("halveOnBlank: a hitless visit halves the score, rounding half up", () => {
    expect(halveOnBlank(seat({ score: 15 })).score).toBe(8);
    expect(halveOnBlank(seat({ score: 16 })).score).toBe(8);
    expect(halveOnBlank(seat({ score: 0 })).score).toBe(0);
    const hit = seat({ score: 15, hitsThisVisit: 1 });
    expect(halveOnBlank(hit)).toBe(hit);
  });

  it("shanghaiWin: single, double and treble in any order finish the seat", () => {
    expect(shanghaiWin(zoned(["TREBLE", "OUTER_SINGLE", "DOUBLE"]))).toMatchObject(
      { status: "DONE", ext: { shanghai: true } },
    );
    for (const zones of [
      ["SINGLE", "SINGLE", "TREBLE"],
      ["DOUBLE", null, "TREBLE"],
    ] as (DartZoneKey | null)[][]) {
      const s = zoned(zones);
      expect(shanghaiWin(s)).toBe(s);
    }
  });
```

  Run `cd app && npx vitest run tests/modules/game/track-policies.test.ts`. Expected: FAIL, because the imports do not exist.

- [ ] **Step 4: Implement the policies.**
  - In `types.ts`, after `ShanghaiState`:

```ts
/** Shanghai's Track extras: the open visit's hit zones (`null` per miss) and whether the seat hit a Shanghai. */
export type ShanghaiTrackExt = {
  zones: (DartZoneKey | null)[];
  shanghai: boolean;
};
```

  - In `track-policies.ts`, change the board-progression import to `import { BULL_TARGET_NUMBER, boardScore, targetAt } from "./board-progression.module";`. Move `SINGLE_ZONE_KEYS` and `zoneBucketOf` from the engine verbatim, adding JSDoc `/** The single/double/treble bucket of a number ring; null for bull and miss. */`. Then append:

```ts
/** Points policy: a hit scores its board value, a miss nothing. */
export function boardScorePoints(
  _target: BoardTarget,
  observation: DartObservation,
  hit: boolean,
): number {
  return hit
    ? boardScore(observation.hitTargetNumber, observation.hitZoneKey)
    : 0;
}

/** Per-dart policy: log the dart's zone in `ext.zones` on a hit, `null` on a miss. */
export function recordVisitZone<
  TExt extends { zones: (DartZoneKey | null)[] },
>(seat: TrackSeat<TExt>, dart: JudgedDart): TrackSeat<TExt> {
  return {
    ...seat,
    ext: {
      ...seat.ext,
      zones: [
        ...seat.ext.zones,
        dart.hit ? dart.observation.hitZoneKey : null,
      ],
    },
  };
}

/** Visit-close policy: a visit with no hit halves the score, rounding half up. */
export function halveOnBlank<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  return seat.hitsThisVisit === 0
    ? { ...seat, score: Math.round(seat.score / 2) }
    : seat;
}

/** Visit-close policy: hits holding a single, a double and a treble finish the seat (`DONE`) and set `ext.shanghai`. */
export function shanghaiWin<
  TExt extends { zones: (DartZoneKey | null)[]; shanghai: boolean },
>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  const buckets = new Set(
    seat.ext.zones
      .filter((zone): zone is DartZoneKey => zone !== null)
      .map(zoneBucketOf),
  );
  return buckets.has("SINGLE") && buckets.has("DOUBLE") && buckets.has("TREBLE")
    ? { ...seat, status: "DONE", ext: { ...seat.ext, shanghai: true } }
    : seat;
}
```

  Re-run the policy tests. Expected: PASS.

- [ ] **Step 5: Rebind the engine.** Rewrite `shanghai.engine.module.ts` as follows, keeping every exported name. The JSDoc on `initialShanghaiState`, `activeTargetOf` and `foldShanghaiState` stays as on `main`, except where shown.

```ts
import type {
  Seated,
  SeatFact,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
} from "@lib/types";
import { numbersPath, targetAt } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, otherSeatsComplete } from "./seat-state.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  anyRingEitherBull,
  boardScorePoints,
  closeAfter,
  halveOnBlank,
  pathTarget,
  recordVisitZone,
  shanghaiWin,
} from "./track-policies";
import { raceWinner, scoreCompareWinner } from "./match-outcome.module";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  ShanghaiSeatState,
  ShanghaiState,
  ShanghaiTrackExt,
  TrackSeat,
  TurnFact,
} from "./types";

export { zoneBucketOf } from "./track-policies";

const LAST_TARGET_INDEX = 19;
const PATH = numbersPath();

type ShanghaiEngineConfig =
  Seated<ShanghaiSnapshot> | Seated<ShanghaiV2Snapshot>;

type ShanghaiDifficulty = ShanghaiV2Snapshot["difficulty"];

/* difficultyOf, initialSeatState, initialShanghaiState: unchanged from main. */

/** (JSDoc unchanged) */
export function activeTargetOf(
  state: ShanghaiSeatState,
  _config?: ShanghaiEngineConfig,
): BoardTarget {
  return targetAt(PATH, state.targetIndex);
}

const SESSION_ENDED =
  "Cannot record a dart once the session has ended; undo first to correct it.";

const MATCH_ENDED =
  "Cannot record a dart once the match has ended; undo first to correct it.";

/**
 * Shanghai as Track policies: rounds 1–20, any ring on the round's number
 * scores its board value, three-dart visits. On close a Hard blank visit
 * halves the score, a single/double/treble finishes the seat as a
 * Shanghai, otherwise the seat advances, finishing after round 20.
 */
function shanghaiRules(
  difficulty: ShanghaiDifficulty,
): TrackRules<ShanghaiTrackExt> {
  const advance = advanceToEnd<ShanghaiTrackExt>(LAST_TARGET_INDEX);
  const halve: (
    seat: TrackSeat<ShanghaiTrackExt>,
  ) => TrackSeat<ShanghaiTrackExt> =
    difficulty === "HARD" ? halveOnBlank : (seat) => seat;
  return {
    doneMessage: SESSION_ENDED,
    target: pathTarget(PATH),
    hit: anyRingEitherBull,
    points: boardScorePoints,
    onDart: recordVisitZone,
    visitOpen: closeAfter(3),
    onVisitClose: (seat) => {
      const judged = shanghaiWin(halve(seat));
      const moved = judged.status === "IN_PROGRESS" ? advance(judged) : judged;
      return { ...moved, ext: { ...moved.ext, zones: [] } };
    },
  };
}

/** Lifts a Shanghai seat into the kernel's shape: `totalScore` as the score, the zone list and Shanghai flag as the extra. */
function toTrackSeat(state: ShanghaiSeatState): TrackSeat<ShanghaiTrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: state.totalScore,
    dartsThisVisit: state.dartsThisVisit.length,
    hitsThisVisit: state.dartsThisVisit.filter((zone) => zone !== null).length,
    status: state.status === "IN_PROGRESS" ? "IN_PROGRESS" : "DONE",
    ext: {
      zones: state.dartsThisVisit,
      shanghai: state.status === "SHANGHAI",
    },
  };
}

/** Projects a kernel seat back to Shanghai's seat state; a `DONE` seat is `SHANGHAI` or `COMPLETE` by its flag. */
function toShanghaiSeat(
  seat: TrackSeat<ShanghaiTrackExt>,
): ShanghaiSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    totalScore: seat.score,
    dartsThisVisit: seat.ext.zones,
    status: seatStatus(seat),
  };
}

function seatStatus(
  seat: TrackSeat<ShanghaiTrackExt>,
): ShanghaiSeatState["status"] {
  if (seat.ext.shanghai) return "SHANGHAI";
  return seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE";
}

/**
 * Pure reducer, via the Track kernel: folds one dart observation onto one
 * seat's `ShanghaiSeatState`. `difficulty` defaults to `"NORMAL"`. Under
 * `"HARD"`, a visit with zero target hits halves `totalScore` (round half
 * up); a visit with a hit is never penalized. A single/double/treble visit
 * is a Shanghai; otherwise round 20's close completes the seat.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyShanghaiDart(
  state: ShanghaiSeatState,
  observation: DartObservation,
  difficulty: ShanghaiDifficulty = "NORMAL",
): ShanghaiSeatState {
  return toShanghaiSeat(
    applyTrackDart(toTrackSeat(state), observation, shanghaiRules(difficulty)),
  );
}

/** (JSDoc unchanged) */
export function foldShanghaiState(
  facts: EngineFacts,
  config: ShanghaiEngineConfig,
): ShanghaiState {
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ zones: [], shanghai: false }),
    shanghaiRules(difficultyOf(config)),
  ).map(toShanghaiSeat);

  /* raceResult, allTerminal, compareResult, status and the return: unchanged from main. */
}

const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/** The match-ended message first — a Shanghai ends the match while another seat still reads `IN_PROGRESS` — then the seat's own. */
function shanghaiRefusal(state: ShanghaiState): string | null {
  if (state.status !== "IN_PROGRESS") return MATCH_ENDED;
  return activeSeatState(state).status === "IN_PROGRESS"
    ? null
    : SESSION_ENDED;
}

/**
 * Whether `observation` would end the WHOLE match: it completes a Shanghai,
 * or closes the active seat's round 20 while every other seat has ended.
 * False once the match has already ended.
 */
function wouldCompleteMatch(
  state: ShanghaiState,
  observation: DartObservation,
): boolean {
  if (state.status !== "IN_PROGRESS") return false;
  const seat = activeSeatState(state);
  if (seat.status !== "IN_PROGRESS" || seat.dartsThisVisit.length < 2)
    return false;
  const after = applyShanghaiDart(seat, observation);
  if (after.status === "SHANGHAI") return true;
  return (
    after.status === "COMPLETE" &&
    otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status !== "IN_PROGRESS",
    )
  );
}

/** A seat's running score in `state`; 0 for a participant not seated. */
function scoreOf(state: ShanghaiState, participantRef: string): number {
  return (
    state.seats.find((seat) => seat.participantRef === participantRef)
      ?.totalScore ?? 0
  );
}

/** Three-dart visits: a turn takes darts until it holds three. */
function isShanghaiVisitOpen(turn: TurnFact): boolean {
  return turn.darts.length < 3;
}

/**
 * Shanghai's rules for the dart engine shell, V1 and V2. A closed visit
 * persists its counted total — the change it made to the seat's score — so
 * a Hard halving is a negative visit total and a seat's turn totals sum to
 * its score.
 */
const shanghaiSpec: DartGameSpec<ShanghaiEngineConfig, ShanghaiState> = {
  rulesetVersionKey: "SHANGHAI_V1",
  rulesetVersionKeys: ["SHANGHAI_V2"],
  stageOwnership: "PER_SEAT",
  fold: foldShanghaiState,
  refusal: shanghaiRefusal,
  intent: () => NO_INTENT,
  isVisitOpen: isShanghaiVisitOpen,
  wouldComplete: wouldCompleteMatch,
  closedVisitTotal: (opened, closed, participantRef) =>
    scoreOf(closed, participantRef) - scoreOf(opened, participantRef),
};

/**
 * Shanghai (Pattern 18), built by the dart engine shell: rounds 1..20, three
 * darts each at that round's own number, per seat. A single/double/treble
 * Shanghai on any seat's visit ends the whole match immediately —
 * score-compare's own race-shaped exception. Otherwise every seat plays all
 * 20 rounds, then the higher total score wins.
 */
export class ShanghaiEngine extends dartGameEngineClass(shanghaiSpec) {}

export const shanghaiEngineFactory = dartGameEngineFactory(
  shanghaiSpec,
  ShanghaiEngine,
);

export const shanghaiV2EngineFactory = dartGameEngineFactory(
  shanghaiSpec,
  ShanghaiEngine,
  "SHANGHAI_V2",
);

registerEngineFactory(shanghaiEngineFactory);
registerEngineFactory(shanghaiV2EngineFactory);
```

  The two `/* … unchanged from main */` markers stand for code to keep exactly as it is; do not write them into the file. Delete `STAGE`, `activeNumberAt`, `isShanghai`, `SINGLE_ZONE_KEYS` and the local `zoneBucketOf` (now in the policies). Drop imports that fall unused (`RulesetVersionKey`, `foldSeatStates`, `boardScore`, the turn-log helpers, `GameEngine`, `GameEngineFactory`, `DartZoneKey`).

  If fallow rejects the `export { zoneBucketOf } from …` re-export, rule it: keep `zoneBucketOf` exported from the engine as on `main`, and have `shanghaiWin` take a `bucketOf` argument instead.

- [ ] **Step 6: Flip the registry row** in `scripts/engine-kernels.txt` to:

```
app/src/modules/game/shanghai.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/rulesets/shanghai.md | Track PR 5
```

  Match the column format of the ATC row exactly.

- [ ] **Step 7: Run everything.**
  - `cd app && npm test`, in the background. Expected: all PASS, including:
    - the 7 oracle cases;
    - the 8 Shanghai goldens, with **no snapshot written** (`git status` shows no `__snapshots__` change);
    - every pre-existing Shanghai, play-data, shell, derived-aims, shanghai-count, replay, session-progress and DartBot-contract test, unedited;
    - every other golden.
  - `bash scripts/check-game-engines.sh`. Expected: OK. The Shanghai line lists `SHANGHAI_V1 SHANGHAI_V2`.

- [ ] **Step 8: Prove the oracle catches a rebind slip.** Do each of these separately; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. In `shanghaiRules`, make `halve` the identity for every difficulty. The Hard cases must fail on `state`.
  2. Delete `closedVisitTotal` from `shanghaiSpec`. Every case must fail on `facts`. Boundary tests 1 and 2 fail too, which is expected.

- [ ] **Step 9: Gates.**
  - `cd app && npm run check`, in the background → 0/0/0.
  - `cd app && npx fallow`:
    - complexity clean;
    - dead-code clean (every new policy and `closedVisitTotal` have callers);
    - duplication recorded.
  - From the repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-engines.sh`.

- [ ] **Step 10: Commit** (Task 5.2 + 5.3 together).

```bash
git add app/src/modules/game app/tests/modules/game scripts/engine-kernels.txt
git commit -m "refactor(shanghai): shell + Track kernel; shell closed-visit total hook"
```

### Task 5.4: Delete the legacy copy, docs, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/game/legacy/shanghai.legacy.ts`, `app/tests/modules/game/shanghai.oracle.test.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md` (shell paragraph ~line 818; Track row ~line 830; version 1.11.5)
- Modify: `docs/architecture/00-File-Inventory.md` (the `track-policies.ts` row)
- Modify: `docs/architecture/00-Context-Map-History.md` (append a row)
- Modify: `app/src/modules/game/CLAUDE.md` (shell bullet)

- [ ] **Step 1: Delete the legacy copy and the oracle.**
  - The guarantee stays with `shanghai.golden.test.ts`. It was recorded from the original engine in commit 1 and passed unchanged in Task 5.3 Step 7.
  - Commit 1 keeps the oracle's proof in history.
  - Remove `app/tests/modules/game/legacy/` if it is empty.

- [ ] **Step 2: Update `04-Architecture-patterns.md`.**
  - In the shell paragraph (~line 818), after "…so a rule can close a visit short (Around the Clock).", insert: "A spec may persist a closed visit's own total through `closedVisitTotal(opened, closed, participantRef)`, given the state before the visit opened and after it closed (Shanghai)."
  - In the Track row status cell, write: `built — Doubles Training, Bob's 27, Singles Training, Around the Clock, Shanghai bound (D468)`.
  - Version line: `1.11.5 (Pattern 18: Shanghai bound to the Track kernel; the game shell gains a closed-visit total hook 2026-10-17, D468; prior 1.11.4: …`. Keep the rest of the chain.

- [ ] **Step 3: Update the File Inventory.** In the `track-policies.ts` row, append "; `zoneBucketOf`, `boardScorePoints`, `recordVisitZone`, `halveOnBlank`, `shanghaiWin` (Shanghai, 2026-10-17)". Where a row cites the 04 version, update it to 1.11.5.

- [ ] **Step 4: Update `app/src/modules/game/CLAUDE.md`.** In the shell bullet, after "…so a visit can close short (Around the Clock, 2026-10-17).", insert: "A spec's optional `closedVisitTotal(opened, closed, participantRef)` sets a closing visit's `totalScore` (Shanghai, 2026-10-17)."

- [ ] **Step 5: Add the history row** to `00-Context-Map-History.md`:

```
| `shanghai.engine.module.ts`, `dart-engine-shell.module.ts`, `track-policies.ts`, `modules/game/{types,interfaces}.ts`, `modules/game/CLAUDE.md`, their tests, `support/{aimed,singles}-observations.ts`, `shanghai.golden.test.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (v1.11.5), `00-File-Inventory.md` | Shanghai moved onto the game shell and bound to the Track kernel (goldens recorded pre-rebind, oracle at 1–3 seats, V1 and V2 Normal/Hard); shell gains the optional `closedVisitTotal` hook; policies `zoneBucketOf` (moved), `boardScorePoints`, `recordVisitZone`, `halveOnBlank`, `shanghaiWin`. Track PR 5, D468 (2026-10-17) | historical |
```

- [ ] **Step 6: Check the §7 quirk is on file.** Read issue #983. If it does not cover "Shanghai calls `activeSeat` without a completion predicate", file one per `capturing-discovered-work`, after a probe test shows the quirk on the current engine. Do not fix it.

- [ ] **Step 7: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. In particular:
  - `npm test` is green, with the count equal to Task 5.3's minus the 7 oracle tests;
  - `npx fallow` duplication is ≤ the Task 5.1 Step 0 baseline. If the golden's `seat`/`seats` helpers push it over, move them to `support/seats.ts` and import them in `shanghai.golden.test.ts` only;
  - `check-doc-links.sh`, `check-context-budget.sh` (update the `00-Context-Map.md` token claims if they drift), `check-decision-ids.sh`, `check-engine-kernels.sh` and `check-game-engines.sh` pass;
  - `cd app && npm run format` has been run, any diff committed, and `npm run format:check` is clean.

- [ ] **Step 8: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/game app/src/modules/game/CLAUDE.md docs
git commit -m "test(shanghai): drop legacy copy; goldens hold the guarantee (D468)"
git push -u origin refactor/track-kernel-shanghai
```

  Open the PR per `finishing-a-dart-branch`, with the body following `.github/pull_request_template.md`. Include:
  - the oracle cases, seeds, steps and the aimed rate;
  - all four mutation-check results (Task 5.1 Step 6 ×2, Task 5.3 Step 8 ×2);
  - fallow duplication before and after;
  - the §7 `activeSeat` quirk, named as preserved;
  - refinements 2 (hook shape), 3 (outcome deferral) and 4 (BULL guard).

  End the body with the generated line plus the session link. Subscribe and drive to green. Merge `origin/main` in (never rebase) on conflict.
