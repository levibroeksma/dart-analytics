# Track Kernel — PR 4 (Around the Clock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Around the Clock (V1 + V2, timed and untimed) onto the game shell and the Track kernel with no change in behaviour. The shell gains a timer and a state-aware visit check.

**Architecture:**
- Around the Clock becomes two things:
  - a `DartGameSpec` bound to `dart-engine-shell.module.ts` (it is a hand-written class today);
  - a `TrackRules<AroundTheClockTrackExt>` record over `applyTrackDart` / `foldTrackSeats`, with `ext = { laps }`.
- A projection maps `TrackSeat` back to `AroundTheClockSeatState`. Every export keeps its name and call shape: `rulesOf`, `activeTargetOf`, `initialAroundTheClockState`, `isAroundTheClockHit`, `isClockHit`, `applyAroundTheClockDart(state, observation, rules?)`, `foldAroundTheClockState(facts, config, timerExpired?)`, `AroundTheClockEngine` and both factories.
- Six policies land with this first caller: `outerSingleOnly`, `advanceOnHit`, `closeAfterOrPastEnd`, `stepBackBelowHits`, `lapOnWrap` and `doneOnWrap`.
- Two additive shell changes:
  1. spec §6's timer: `expireTimer()` on every shell engine, and `timerExpired` as `fold`'s third argument;
  2. `isVisitOpen(turn, state)`. The shell passes the folded state, so a rule can close a visit short (bull completion, lap restart).
- Proof, as in PR 3:
  1. Goldens are recorded from the original engine in commit 1 (Around the Clock has none).
  2. The differential oracle runs with an aimed generator and timer expiry.

**Tech Stack:** TypeScript, Vitest, Bash, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§2 ATC row, §4 policy list, §5 ATC row, §6 timer, §7 method + quirk, §8 PR 4). Previous plan: `docs/superpowers/plans/2026-10-17-track-kernel-pr3-singles.md` (merged as #986).

## Global Constraints

- Branch `refactor/track-kernel-atc`, from `origin/main` at `6a284e9` or later. Never `--no-verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Types go in barrels (`modules/game/types.ts`, `interfaces.ts`). Tests import them from `@modules/types` / `@modules/interfaces`.
- No `//` comments inside function bodies. Use JSDoc above the declaration.
- Fallow:
  - cognitive complexity ≤ 15 per function;
  - duplication may rise while the legacy copy exists, but must be ≤ `main`'s count after Task 4.4 (record it in Task 4.1 Step 0).
- `cd app && npm run check` reports 0 errors, 0 warnings, 0 hints.
- `npm test` and `npm run check` run past the 120 s Bash limit. Run them with `run_in_background` and wait on the output file. Do not edit files while a background run is live.
- This is a refactor:
  - Every existing test passes with **no edits**: `around-the-clock.engine.module.test.ts`, `around-the-clock-play.data` tests, `dart-engine-shell.module.test.ts`, `derived-aims`, `session-progress`, `replay-*`, `atc-darts-per-target`, the DartBot contract test, and every existing golden.
  - New tests are appended only.
  - Existing snapshots stay unchanged, `target-scoring.golden.test.ts`'s in particular. It uses `goldenTrace` with `expireAt`.
- Preserve the quirk in spec §7 and do not fix it: timed mode picks the winner by fewest darts, not laps (`scoreCompareOutcome(..., "LOWEST")` over `dartsThrownBy`).
- The registry flip rides **commit 2**, because `check-engine-kernels.sh` runs pre-commit.
- The legacy copy must not leave an unused declaration behind (ts(6133) hint). Delete such functions from the copy.
- No D-entry: both shell changes sit inside D468 / spec §6. Confirm D469 is still free with `bash scripts/next-decision-id.sh` (it was at plan time).

## Spec refinements made by this plan

1. **Policy names and shapes fixed.** In spec §4, `advanceOnHit`, `stepBackBelowHits(n)` and `lapOnWrap` are names only. "Past the end" means `targetIndex > lastIndex`. The kernel never calls `target()` there, because the visit closes on that same dart.

   | Policy | Slot | Behaviour |
   | --- | --- | --- |
   | `outerSingleOnly` | hit | NUMBER: same number and `OUTER_SINGLE`. BULL: either bull (delegates to `anyRingEitherBull`). |
   | `advanceOnHit` | onDart | On a hit: `targetIndex + 1`, and `hitsThisVisit` back to 0, so the hit is spent on the target it left. On a miss: the seat unchanged. |
   | `closeAfterOrPastEnd(darts, lastIndex)` | visitOpen | Open while `dartsThisVisit < darts` and `targetIndex <= lastIndex`. |
   | `stepBackBelowHits(n)` | onVisitClose | At least `n` hits: `targetIndex + 1`. Fewer: `max(0, targetIndex − 1)`. |
   | `lapOnWrap(lastIndex)` | onVisitClose | Past the end: `targetIndex` 0 and `ext.laps + 1`. `TExt extends { laps: number }`. |
   | `doneOnWrap(lastIndex)` | onVisitClose | Past the end: `targetIndex = lastIndex`, `DONE`. |

   - Easy (n = 0) is `advanceOnHit` plus `wrap`.
   - 1/2/3-dart difficulties are `wrap ∘ stepBackBelowHits(n)`.
   - `wrap` is `lapOnWrap` when timed, `doneOnWrap` when untimed.
   - `advanceToEnd` is not reused: it finishes *on* the last index at visit close, not past it mid-visit.
   - Zeroing `hitsThisVisit` in `advanceOnHit` reproduces legacy Easy, where `hitsThisVisit` always reads 0.

2. **`isAroundTheClockHit` / `isClockHit` become delegates to the policies.** They stay exported, since play.data, replay-presenters and derived-aims call them.
   - Legacy counted *any non-MISS zone* with the target's number. The policy counts the five number rings.
   - They differ only on an illegal pair: a number of 1–20 with a bull zone.
   - That pair cannot reach the engine:
     - `chk_dart_target_consistency` (migration 0007) rejects it;
     - every input surface emits legal pairs;
     - `randomObservation` emits only legal pairs.
   - Accepted.

3. **Shell timer** (spec §6):
   - `DartGameSpec.fold(facts, config, timerExpired: boolean)`.
   - `ShellGameEngine.expireTimer(): void` sets a private flag that every fold reads.
   - `undo()` leaves the flag set; legacy ATC does the same. The exercise shell differs here, because its expiry *is* completion.
   - A rehydrated engine starts unexpired. The play page re-calls `expireTimer()` on resume (`play-countdown.ts`).
   - Timerless specs ignore the third argument.

4. **Shell visit check reads state.**
   - The signature becomes `DartGameSpec.isVisitOpen(turn, state)`.
   - The shell calls it twice:
     - as the reuse predicate, with the state *before* the dart;
     - after appending, with the state *after* it. `completedAt` is stamped when it reads false.
   - The reason: a turn alone cannot tell that a bull completion or lap restart closed the visit short, and legacy stamped on the reducer's `dartsThisVisit === 0`.
   - Existing specs take one parameter, so they are unaffected. The cost is one extra fold on a closing dart only.

5. **Key read off the snapshot's shape.** Legacy picks V1/V2 from `"pathDirection" in config`, whatever factory built it.
   - `AroundTheClockEngine` subclasses the shell class with a two-parameter constructor that passes `keyOf(config)`.
   - The factory's third argument is ignored, which preserves this exactly.

6. **The outcome stays in the fold. `TrackRules.outcome` is still not added.**
   - Spec §5 and the code agree that ATC is not a race. It is `scoreCompare LOWEST` on darts.
   - Doubles, Singles and ATC each make one `scoreCompareOutcome` call, so a member would move code without removing any.
   - Re-check at PR 5: Shanghai is race-then-score, the first outcome no current engine has.
   - The timed-expiry overlay (`timedSeatDone`) also stays in the fold, because it reads `completedAt` off the turns.

7. **The oracle gains `resumeExpired?: boolean`** (`runOracle` and `goldenTrace`).
   - When true, a rehydration past `expireAt` re-calls `expireTimer()` on the rebuilt engine(s), as the play page does.
   - Opt-in, so `target-scoring.golden.test.ts`'s snapshot cannot move.
   - Without it, a rehydration within 19 steps of `expireAt` would erase the expiry, and the expired paths would go unexercised.

## Review Focus

1. **A bull completion or lap restart on dart 1 or 2 in a duo.**
   - That turn is stamped.
   - The next dart opens a new turn for the *other* seat.
   - Pinned in Task 4.3 (boundary test 5).
2. **Expiry, then undo.**
   - `timerExpired` stays true.
   - The reopened 2-dart visit reads `IN_PROGRESS`, and its closing dart completes the run.
   - Pinned in Task 4.3 (boundary test 6) and Task 4.2 (shell test).
3. **Easy's `hitsThisVisit`.** It reads 0 after any number of mid-visit advances; the play page and stats read the seat state. Pinned in Task 4.3 (boundary test 1).
4. **A V2 snapshot through the V1 factory, or the bare constructor.** The engine still reports `AROUND_THE_CLOCK_V2`. Pinned in Task 4.3 (boundary test 7).
5. **OUTER_SINGLE on BULL.** Either bull ring counts; on a number, only the outer single does. Pinned in Task 4.3 (boundary test 3) and the policy tests.

---

### Task 4.1: Aimed input, resumable expiry, goldens, legacy copy and oracle (commit 1)

**Files:**
- Modify: `app/tests/modules/game/support/engine-oracle.ts` (`resumeExpired`)
- Modify: `app/tests/modules/game/support/engine-oracle.test.ts` (append)
- Create: `app/tests/modules/game/support/clock-observations.ts`
- Create: `app/tests/modules/game/around-the-clock.golden.test.ts` (and its `__snapshots__` file)
- Create: `app/tests/modules/game/legacy/around-the-clock.legacy.ts`
- Create: `app/tests/modules/game/around-the-clock.oracle.test.ts`

**Interfaces:**
- Consumes:
  - from `support/engine-oracle.ts`: `runOracle`, `goldenTrace`, `randomObservation`, `normalise` and `OracleEngine`;
  - from the engine module: `rulesOf`;
  - from board-progression: `targetAt`;
  - from seat-state: `activeSeatState`.
- Produces:
  - `OracleOptions.resumeExpired?: boolean` and `TraceOptions.resumeExpired?: boolean`;
  - `aimedClockObservation(config: AroundTheClockEngineConfig): (rand: () => number, engine: OracleEngine) => DartObservation`;
  - `LegacyAroundTheClockEngine`, test-only and deleted in Task 4.4.

- [ ] **Step 0: Baseline.** Run `cd app && npx fallow`. Record the duplication clone-group count; that is `main`'s count.

- [ ] **Step 1: Write the failing `resumeExpired` tests.** Append inside `describe("runOracle", ...)` in `engine-oracle.test.ts`:

```ts
  it("re-expires both rebuilt engines after a rehydration past expireAt when resumeExpired", () => {
    const calls: string[] = [];
    const tagged =
      (tag: string) =>
      (prior?: EngineFacts): OracleEngine => {
        const e = counter()(prior);
        e.expireTimer = () => calls.push(tag);
        return e;
      };
    runOracle({
      build: tagged("next"),
      legacy: tagged("old"),
      seeds: [1],
      steps: 6,
      expireAt: 1,
      rehydrateEvery: 3,
      resumeExpired: true,
    });
    expect(calls).toEqual(["next", "old", "next", "old", "next", "old"]);
  });
```

  Steps 0–5. Step 1 expires (2 calls). The rehydrations after steps 2 and 5 are both past `expireAt` (2 + 2). Append inside `describe("goldenTrace", ...)`:

```ts
  it("re-expires the rebuilt engine after a rehydration past expireAt when resumeExpired", () => {
    let calls = 0;
    goldenTrace({
      build: (prior) => {
        const e = counter()(prior);
        e.expireTimer = () => {
          calls += 1;
        };
        return e;
      },
      seed: 1,
      steps: 6,
      undoRate: 0,
      rehydrateEvery: 3,
      expireAt: 1,
      resumeExpired: true,
    });
    expect(calls).toBe(3);
  });
```

  - If `EngineFacts` / `OracleEngine` are not yet imported in the test file, add them: `@modules/types` and `./engine-oracle` respectively.
  - Run `cd app && npx vitest run tests/modules/game/support/engine-oracle.test.ts`. Expected: both FAIL, with counts of 2 and 1.

- [ ] **Step 2: Implement `resumeExpired`.** In `engine-oracle.ts`:
  - Add `resumeExpired?: boolean;` to `OracleOptions` and `TraceOptions`.
  - Add, above `rehydrate`:

```ts
/** Whether a rebuild after `step` must re-expire, as the play page's countdown resume does. */
function resumesExpired(
  opts: { expireAt?: number; resumeExpired?: boolean },
  step: number,
): boolean {
  return (
    opts.resumeExpired === true &&
    opts.expireAt !== undefined &&
    step >= opts.expireAt
  );
}
```

  - In `runOracle`, after `pair = rehydrate(pair, opts, where);`, wrap the two into a block:

```ts
      if (every > 0 && step % every === every - 1) {
        pair = rehydrate(pair, opts, where);
        if (resumesExpired(opts, step)) {
          pair.next.expireTimer?.();
          pair.old.expireTimer?.();
          compare(pair, `${where} (resumed expired)`);
        }
      }
```

  - In `goldenTrace`, the same:

```ts
    if (step % opts.rehydrateEvery === opts.rehydrateEvery - 1) {
      engine = opts.build(engine.facts());
      if (resumesExpired(opts, step)) engine.expireTimer?.();
    }
```

  - Re-run the file. Expected: all PASS.
  - Run `npx vitest run tests/modules/training/exercises/target-scoring.golden.test.ts tests/modules/game/bobs27.golden.test.ts tests/modules/game/doubles-training.golden.test.ts tests/modules/game/singles-training.golden.test.ts`. Expected: PASS, with no snapshot written.

- [ ] **Step 3: Write the aimed generator** `app/tests/modules/game/support/clock-observations.ts`:

```ts
import { targetAt } from "@modules/game/board-progression.module";
import { rulesOf } from "@modules/game/around-the-clock.engine.module";
import { activeSeatState } from "@modules/game/seat-state.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import type { AroundTheClockEngineConfig } from "@lib/types";
import type {
  AroundTheClockState,
  DartObservation,
  DartZoneKey,
} from "@modules/types";

const RINGS: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

/**
 * 70 % a dart on the active seat's target, otherwise `randomObservation`.
 * Under OUTER_SINGLE, 70 % of on-target number darts take the outer single.
 * Enough on-target darts that HARD/PRO seats reach BULL, and Easy timed runs lap.
 */
export function aimedClockObservation(
  config: AroundTheClockEngineConfig,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  const { path, segmentRule } = rulesOf(config);
  return (rand, engine) => {
    if (rand() >= 0.7) return randomObservation(rand);
    const seat = activeSeatState(engine.state() as AroundTheClockState);
    const target = targetAt(path, seat.targetIndex);
    const base = { locationX: null, locationY: null };
    if (target.kind === "BULL")
      return {
        ...base,
        hitTargetNumber: 25,
        hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
      };
    const zone =
      segmentRule === "OUTER_SINGLE" && rand() < 0.7
        ? "OUTER_SINGLE"
        : RINGS[Math.floor(rand() * RINGS.length)]!;
    return { ...base, hitTargetNumber: target.number, hitZoneKey: zone };
  };
}
```

  If `activeSeatState`'s parameter type rejects the cast, use the PR 3 fallback: `engine.state() as Parameters<typeof activeSeatState>[0]`, and read `targetIndex` off a `{ targetIndex: number }` cast.

- [ ] **Step 4: Record the goldens** in `app/tests/modules/game/around-the-clock.golden.test.ts`. Do this before any engine change.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { aimedClockObservation } from "./support/clock-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type {
  AroundTheClockEngineConfig,
  AroundTheClockV2Snapshot,
  Seated,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const v2 = (
  n: number,
  over: Partial<AroundTheClockV2Snapshot>,
): Seated<AroundTheClockV2Snapshot> => ({
  pathDirection: "LOW_TO_HIGH",
  oddsFirst: false,
  segmentRule: "ANY",
  difficulty: "EASY",
  durationType: "UNTIMED",
  durationValue: null,
  ...over,
  seats: seats(n),
});
const TIMED = { durationType: "MINUTES", durationValue: 10 } as const;

const CONFIGS: Record<
  string,
  { config: AroundTheClockEngineConfig; expireAt?: number }
> = {
  "v1 duo": { config: { seats: seats(2) } },
  "v2 hard outer-single, high-to-low odds-first duo": {
    config: v2(2, {
      pathDirection: "HIGH_TO_LOW",
      oddsFirst: true,
      segmentRule: "OUTER_SINGLE",
      difficulty: "HARD",
    }),
  },
  "v2 easy timed solo, expires": {
    config: v2(1, TIMED),
    expireAt: 150,
  },
  "v2 pro timed trio, expires": {
    config: v2(3, { difficulty: "PRO", ...TIMED }),
    expireAt: 200,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Around the Clock — golden", () => {
  for (const [name, { config, expireAt }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new AroundTheClockEngine(config);
      const observe = aimedClockObservation(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 260 && !engine.isComplete(); i += 1) {
        if (i === expireAt) engine.expireTimer();
        else if (rand() < 0.1) engine.undo();
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

describe("Around the Clock — golden trace", () => {
  for (const [name, { config, expireAt }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new AroundTheClockEngine(config, prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt,
          resumeExpired: true,
          observe: aimedClockObservation(config),
        }),
      ).toMatchSnapshot();
    });
  }
});
```

  - Run `cd app && npx vitest run tests/modules/game/around-the-clock.golden.test.ts`. Expected: 8 PASS, with snapshots written.
  - Open the `.snap` and check four things:
    1. an Easy timed trace has `laps` ≥ 1;
    2. some untimed seat is `COMPLETE`;
    3. the HARD/PRO traces show a `targetIndex` decrease, the step-back;
    4. a timed trace ends `COMPLETE` after `expire`.
  - If any check fails, raise the aim rate from 0.7 to 0.8 and re-record.

- [ ] **Step 5: Copy the legacy module.** Run `cp app/src/modules/game/around-the-clock.engine.module.ts app/tests/modules/game/legacy/around-the-clock.legacy.ts`. In the copy:
  - Rewrite `./x` imports as `@modules/game/x`, and `./types` / `./interfaces` as `@modules/types` / `@modules/interfaces`.
  - Delete both factory blocks and both `registerEngineFactory(...)` calls. Drop the `registerEngineFactory`, `GameEngineFactory`, `Seated`, `AroundTheClockSnapshot` and `AroundTheClockV2Snapshot` imports.
  - Rename the class to `LegacyAroundTheClockEngine`.
  - Remove `export` from every function.
  - Delete `initialAroundTheClockState` and `activeTargetOf`: nothing else in the copy calls them. Keep `rulesOf`, `isAroundTheClockHit`, `isClockHit`, `applyAroundTheClockDart`, `foldAroundTheClockState`, `timedSeatDone` and `targetOnPath`, because the class or the reducer reaches each.

- [ ] **Step 6: Write the oracle test** `app/tests/modules/game/around-the-clock.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
import { LegacyAroundTheClockEngine } from "./legacy/around-the-clock.legacy";
import { runOracle } from "./support/engine-oracle";
import { aimedClockObservation } from "./support/clock-observations";
import type {
  AroundTheClockEngineConfig,
  AroundTheClockV2Snapshot,
  Seated,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const v2 = (
  n: number,
  over: Partial<AroundTheClockV2Snapshot> = {},
): Seated<AroundTheClockV2Snapshot> => ({
  pathDirection: "LOW_TO_HIGH",
  oddsFirst: false,
  segmentRule: "ANY",
  difficulty: "EASY",
  durationType: "UNTIMED",
  durationValue: null,
  ...over,
  seats: seats(n),
});
const TIMED = { durationType: "MINUTES", durationValue: 10 } as const;
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, AroundTheClockEngineConfig, number?][] = [
  ["v1 solo", { seats: seats(1) }],
  ["v1 duo", { seats: seats(2) }],
  [
    "v2 intermediate outer-single trio",
    v2(3, { difficulty: "INTERMEDIATE", segmentRule: "OUTER_SINGLE" }),
  ],
  [
    "v2 hard duo, high-to-low odds-first",
    v2(2, { difficulty: "HARD", pathDirection: "HIGH_TO_LOW", oddsFirst: true }),
  ],
  ["v2 pro solo", v2(1, { difficulty: "PRO" })],
  ["v2 easy timed duo, expires", v2(2, TIMED), 140],
  [
    "v2 hard outer-single timed trio, expires",
    v2(3, { difficulty: "HARD", segmentRule: "OUTER_SINGLE", ...TIMED }),
    180,
  ],
];

describe("Around the Clock — kernel vs legacy oracle", () => {
  for (const [name, cfg, expireAt] of CASES) {
    it(
      `${name}: indistinguishable through every public method`,
      () => {
        runOracle({
          build: (prior) => new AroundTheClockEngine(cfg, prior),
          legacy: (prior) => new LegacyAroundTheClockEngine(cfg, prior),
          seeds: SEEDS,
          steps: 260,
          undoRate: 0.12,
          rehydrateEvery: 19,
          expireAt,
          resumeExpired: true,
          observe: aimedClockObservation(cfg),
        });
      },
      60_000,
    );
  }
});
```

- [ ] **Step 7: Run it.** Run `cd app && npx vitest run tests/modules/game/around-the-clock.oracle.test.ts`. Expected: 7 PASS, since both sides are the same code. Note the wall time. If a case nears 60 s, drop `steps` to 200 for all cases and say so in the PR body.

- [ ] **Step 8: Prove the oracle can fail.** In the legacy copy's reducer, change `targetIndex: Math.max(0, state.targetIndex - 1),` to `targetIndex: state.targetIndex,`. Run again. Expected: FAIL in the INTERMEDIATE/HARD cases. Revert, re-run, confirm PASS, and record the result for the PR body.

- [ ] **Step 9: Gates and commit.**
  - `cd app && npm run check`, in the background → 0/0/0. A hint in the legacy copy means an unused declaration: delete it.
  - `npm test`, in the background → all PASS.

```bash
git add app/tests/modules/game
git commit -m "test(atc): freeze legacy engine, aimed oracle input, resumable expiry, goldens"
```

### Task 4.2: Shell timer and state-aware visit check

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`DartGameSpec.fold`, `DartGameSpec.isVisitOpen`, `ShellGameEngine`)
- Modify: `app/src/modules/game/dart-engine-shell.module.ts`
- Test: `app/tests/modules/game/dart-engine-shell.module.test.ts` (append)

**Interfaces:**
- Consumes: the shell as on `main` (multi-key).
- Produces:
  - `DartGameSpec.fold(facts: EngineFacts, config: TConfig, timerExpired: boolean): TState`;
  - `DartGameSpec.isVisitOpen(turn: TurnFact, state: TState): boolean`;
  - `ShellGameEngine.expireTimer(): void`.

- [ ] **Step 1: Write the failing shell tests.** Append to `dart-engine-shell.module.test.ts`:

```ts
describe("timer and state-aware visits", () => {
  const timedSpec: DartGameSpec<{ limit: number }, Toy> = {
    ...spec,
    fold: (facts, config, timerExpired) => {
      const state = spec.fold(facts, config, timerExpired);
      return timerExpired ? { ...state, status: "COMPLETE" } : state;
    },
  };
  const Timed = dartGameEngineClass(timedSpec);

  it("threads expireTimer() into fold, and undo leaves it set", () => {
    const engine = new Timed({ limit: 10 });
    engine.record(T20);
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(true);
  });

  it("starts unexpired when rehydrated", () => {
    const engine = new Timed({ limit: 10 });
    engine.record(T20);
    engine.expireTimer();
    expect(new Timed({ limit: 10 }, engine.facts()).isComplete()).toBe(false);
  });

  it("closes a visit short when isVisitOpen reads the folded state", () => {
    const Short = dartGameEngineClass<{ limit: number }, Toy>({
      ...spec,
      isVisitOpen: (t, s) => t.darts.length < 3 && s.darts !== 2,
    });
    const engine = new Short({ limit: 10 });
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[1].completedAt).toBeNull();
  });
});
```

  On the 3rd dart, the reuse check sees `before.darts === 2` and refuses turn 1. Turn 2 then holds 1 dart under `after.darts === 3`, so it stays open.

  Run `cd app && npx vitest run tests/modules/game/dart-engine-shell.module.test.ts`. Expected: the three new tests FAIL. `expireTimer` is not a function, and `s` is undefined in `isVisitOpen`.

- [ ] **Step 2: Implement.** In `interfaces.ts`, `DartGameSpec`:

```ts
  /** Folds the log; `timerExpired` is the shell's `expireTimer()` flag (timerless specs ignore it). */
  fold(facts: EngineFacts, config: TConfig, timerExpired: boolean): TState;
```

```ts
  /** Whether `turn` still takes darts, given the folded state before the dart (reuse) or after it (close). */
  isVisitOpen(turn: TurnFact, state: TState): boolean;
```

  In `ShellGameEngine`:

```ts
  /** Marks the run's clock as run out; every fold reads it as `timerExpired`. Undo leaves it set. */
  expireTimer(): void;
```

  In `dart-engine-shell.module.ts`:
  - The JSDoc becomes: "Builds a `GameEngine` class over one `EXERCISE_BLOCK` stage from `spec`. `undo()` pops one dart (`undoLastDart`) and leaves an expired timer set; a rehydrated engine starts unexpired. `completedAt` is stamped when `isVisitOpen` reads false on the state after the dart. `isComplete()` is any status other than `IN_PROGRESS`."
  - Add `private timerExpired = false;` after `turns`.
  - `deriveState()` passes `this.timerExpired` as `fold`'s third argument.
  - `record` becomes:

```ts
    record(observation: DartObservation): TState {
      const before = this.deriveState();
      const refusal = spec.refusal(before);
      if (refusal !== null) throw new Error(refusal);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        (last) => spec.isVisitOpen(last, before),
      );
      appendObservedDart(turn, observation, spec.intent(before, this.config));
      const after = this.deriveState();
      if (spec.isVisitOpen(turn, after)) return after;
      turn.completedAt = new Date().toISOString();
      return this.deriveState();
    }
```

  - Add after `wouldComplete`:

```ts
    expireTimer(): void {
      this.timerExpired = true;
    }
```

  Re-run the shell test file. Expected: all PASS, the pre-existing tests included and unedited. Then run `npx vitest run tests/modules/game/doubles-training.golden.test.ts tests/modules/game/bobs27.golden.test.ts tests/modules/game/singles-training.golden.test.ts`. Expected: PASS, with no snapshot written.

- [ ] **Step 3: No commit yet.** It commits with Task 4.3, whose engine is the shell's first caller of both changes.

### Task 4.3: Track policies and the Around the Clock rebind (commit 2)

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `AroundTheClockTrackExt`)
- Modify: `app/src/modules/game/track-policies.ts` (append six policies)
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts`
- Modify: `scripts/engine-kernels.txt` (ATC row → `KERNEL_BOUND`)
- Test: `app/tests/modules/game/track-policies.test.ts`, `app/tests/modules/game/around-the-clock.engine.module.test.ts` (append only)

**Interfaces:**
- Consumes: Task 4.2's shell; `pathTarget`, `noPoints`, `anyRingEitherBull`, `applyTrackDart` and `foldTrackSeats` as on `main`.
- Produces:
  - `AroundTheClockTrackExt = { laps: number }` (in the `@modules/types` barrel);
  - `outerSingleOnly(target: BoardTarget, observation: DartObservation): boolean`;
  - `advanceOnHit<TExt>(seat: TrackSeat<TExt>, dart: JudgedDart): TrackSeat<TExt>`;
  - `closeAfterOrPastEnd<TExt>(darts: number, lastIndex: number): (seat: TrackSeat<TExt>) => boolean`;
  - `stepBackBelowHits<TExt>(hits: number): (seat: TrackSeat<TExt>) => TrackSeat<TExt>`;
  - `lapOnWrap<TExt extends { laps: number }>(lastIndex: number): (seat: TrackSeat<TExt>) => TrackSeat<TExt>`;
  - `doneOnWrap<TExt>(lastIndex: number): (seat: TrackSeat<TExt>) => TrackSeat<TExt>`.
- The engine's exports keep their names and call shapes (see Architecture).

- [ ] **Step 1: Write the boundary tests.** These characterise legacy behaviour at the projection's and the shell's seams. Append them to `around-the-clock.engine.module.test.ts`, which already defines `SEATS`, `config`, `SEAT`, `seatAt`, `run`, `v2`, `TIMED` and `miss`, and imports `AroundTheClockEngine`, `aroundTheClockEngineFactory` and `DartObservation`. Add `DartZoneKey` to the `@modules/types` type import.

```ts
describe("Around the Clock — Track kernel boundaries", () => {
  const dart = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });
  const duo = [
    SEATS[0],
    {
      ...SEATS[0],
      participantRef: "participant-2",
      displayName: "P2",
      sideKey: "B",
    },
  ];

  it("1: Easy advances twice in one visit and never counts hits", () => {
    expect(run(v2(), [dart(1, "TREBLE"), dart(2, "DOUBLE")])).toEqual(
      seatAt(2, { dartsThisVisit: 2 }),
    );
  });

  it("2: a 1-dart visit judged on its third dart steps back, floored at the first target", () => {
    const hard = v2({ difficulty: "HARD" });
    expect(run(hard, [dart(6, "TREBLE"), miss(), miss()], seatAt(5))).toEqual(
      seatAt(4),
    );
    expect(run(hard, [dart(1, "TREBLE"), miss(), miss()])).toEqual(seatAt(0));
    expect(run(hard, [dart(6, "TREBLE"), miss()], seatAt(5))).toEqual(
      seatAt(5, { dartsThisVisit: 2, hitsThisVisit: 1 }),
    );
  });

  it("3: OUTER_SINGLE counts only the outer single on a number, either bull on BULL", () => {
    const outer = v2({ segmentRule: "OUTER_SINGLE" });
    expect(run(outer, [dart(1, "INNER_SINGLE")])).toEqual(
      seatAt(0, { dartsThisVisit: 1 }),
    );
    expect(run(outer, [dart(1, "OUTER_SINGLE")])).toEqual(
      seatAt(1, { dartsThisVisit: 1 }),
    );
    expect(run(outer, [dart(25, "OUTER_BULL")], seatAt(20))).toEqual(
      seatAt(20, { status: "COMPLETE" }),
    );
  });

  it("4: timed PRO laps on three bull hits", () => {
    const pro = v2({ difficulty: "PRO", ...TIMED });
    expect(
      run(pro, [0, 1, 2].map(() => dart(25, "INNER_BULL")), seatAt(20)),
    ).toEqual(seatAt(0, { laps: 1 }));
  });

  it("5: an untimed Easy duo's bull on dart one closes that visit and hands over", () => {
    const engine = new AroundTheClockEngine({ ...v2(), seats: duo });
    const own = [
      miss(),
      ...Array.from({ length: 20 }, (_, i) => dart(i + 1, "TREBLE")),
    ];
    for (let visit = 0; visit < 7; visit += 1) {
      for (const d of own.slice(visit * 3, visit * 3 + 3)) engine.record(d);
      for (let i = 0; i < 3; i += 1) engine.record(miss());
    }
    const state = engine.record(dart(25, "OUTER_BULL"));
    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.activeParticipantRef).toBe("participant-2");
    const bullTurn = engine.facts().turns.at(-1)!;
    expect(bullTurn.participantRef).toBe("participant-1");
    expect(bullTurn.darts).toHaveLength(1);
    expect(bullTurn.completedAt).not.toBeNull();
    engine.record(miss());
    const next = engine.facts().turns.at(-1)!;
    expect(next.participantRef).toBe("participant-2");
    expect(next.darts).toHaveLength(1);
    expect(next.completedAt).toBeNull();
  });

  it("6: expiry survives undo; the reopened visit's closing dart completes the run", () => {
    const engine = new AroundTheClockEngine(v2(TIMED));
    for (let i = 0; i < 3; i += 1) engine.record(miss());
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toMatchObject({
      status: "IN_PROGRESS",
      timerExpired: true,
    });
    expect(engine.wouldComplete(miss())).toBe(true);
    engine.record(miss());
    expect(engine.isComplete()).toBe(true);
  });

  it("7: the ruleset key is read off the snapshot's shape", () => {
    expect(new AroundTheClockEngine(v2()).rulesetVersionKey).toBe(
      "AROUND_THE_CLOCK_V2",
    );
    expect(new AroundTheClockEngine(config).rulesetVersionKey).toBe(
      "AROUND_THE_CLOCK_V1",
    );
    expect(
      aroundTheClockEngineFactory.create(v2() as never).rulesetVersionKey,
    ).toBe("AROUND_THE_CLOCK_V2");
  });
});
```

  The arithmetic, on the default V2 path (`LOW_TO_HIGH`, not odds-first), where index *i* is number *i* + 1 and index 20 is BULL:
  - **Test 2:** at index 5 (target 6), 1 hit is below HARD's 2, so the seat steps back to index 4. At index 0, the floor holds.
  - **Test 5:**
    - Seat A's own darts are a miss, then 1–20, in 7 three-dart visits. That leaves A on BULL after 20 hits.
    - Seat B misses through 7 visits.
    - A's bull on dart 1 of visit 8 completes A and closes that turn short.
    - The next dart is B's, on a new turn.

- [ ] **Step 2: Run them against the unchanged engine.** Run `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts`. Expected: PASS. These are characterisation tests. If one fails, the test is wrong, not the engine: fix its arithmetic or fixture.

- [ ] **Step 3: Write the failing policy tests.** In `track-policies.test.ts`, add `advanceOnHit, closeAfterOrPastEnd, doneOnWrap, lapOnWrap, outerSingleOnly, stepBackBelowHits` to the import. Append inside `describe("track policies", ...)`, after the PR 3 block, which defines `on`, `FIVE` and `BULL`:

```ts
  it("outerSingleOnly: only the outer single on the number, either bull on BULL", () => {
    expect(outerSingleOnly(FIVE, on(5, "OUTER_SINGLE"))).toBe(true);
    for (const zone of ["SINGLE", "INNER_SINGLE", "DOUBLE", "TREBLE"] as const)
      expect(outerSingleOnly(FIVE, on(5, zone))).toBe(false);
    expect(outerSingleOnly(FIVE, on(6, "OUTER_SINGLE"))).toBe(false);
    expect(outerSingleOnly(BULL, on(25, "OUTER_BULL"))).toBe(true);
    expect(outerSingleOnly(BULL, on(25, "INNER_BULL"))).toBe(true);
    expect(outerSingleOnly(BULL, on(null, "MISS"))).toBe(false);
  });

  const judged = (hit: boolean) => ({
    observation: on(5, "TREBLE"),
    target: FIVE,
    hit,
    points: 0,
  });

  it("advanceOnHit: a hit moves on and spends the hit; a miss changes nothing", () => {
    expect(
      advanceOnHit(
        seat({ targetIndex: 4, hitsThisVisit: 1, dartsThisVisit: 2 }),
        judged(true),
      ),
    ).toMatchObject({ targetIndex: 5, hitsThisVisit: 0, dartsThisVisit: 2 });
    const unchanged = seat({ targetIndex: 4 });
    expect(advanceOnHit(unchanged, judged(false))).toBe(unchanged);
  });

  it("closeAfterOrPastEnd(3, 20): open below 3 darts while on the path", () => {
    const open = closeAfterOrPastEnd(3, 20);
    expect(open(seat({ dartsThisVisit: 2, targetIndex: 20 }))).toBe(true);
    expect(open(seat({ dartsThisVisit: 3, targetIndex: 4 }))).toBe(false);
    expect(open(seat({ dartsThisVisit: 1, targetIndex: 21 }))).toBe(false);
  });

  it("stepBackBelowHits(2): enough hits move on, fewer step back, floored at 0", () => {
    const judge = stepBackBelowHits(2);
    expect(judge(seat({ targetIndex: 4, hitsThisVisit: 2 })).targetIndex).toBe(5);
    expect(judge(seat({ targetIndex: 20, hitsThisVisit: 3 })).targetIndex).toBe(
      21,
    );
    expect(judge(seat({ targetIndex: 4, hitsThisVisit: 1 })).targetIndex).toBe(3);
    expect(judge(seat({ targetIndex: 0, hitsThisVisit: 0 })).targetIndex).toBe(0);
  });

  it("lapOnWrap(20): past the end restarts at 0 and counts a lap", () => {
    const lap = lapOnWrap<{ laps: number }>(20);
    const base = initialTrackSeat(SEAT, { laps: 1 });
    expect(lap({ ...base, targetIndex: 21 })).toMatchObject({
      targetIndex: 0,
      status: "IN_PROGRESS",
      ext: { laps: 2 },
    });
    const onBull = { ...base, targetIndex: 20 };
    expect(lap(onBull)).toBe(onBull);
  });

  it("doneOnWrap(20): past the end finishes on the last target", () => {
    expect(doneOnWrap(20)(seat({ targetIndex: 21 }))).toMatchObject({
      targetIndex: 20,
      status: "DONE",
    });
    const onBull = seat({ targetIndex: 20 });
    expect(doneOnWrap(20)(onBull)).toBe(onBull);
  });
```

  Run `cd app && npx vitest run tests/modules/game/track-policies.test.ts`. Expected: the six new tests FAIL on the missing exports.

- [ ] **Step 4: Implement the policies.**

  In `modules/game/types.ts`, directly after `AroundTheClockSeatState`, add:

```ts
/** Around the Clock's Track extras: timed-run laps completed. */
export type AroundTheClockTrackExt = { laps: number };
```

  Append to `track-policies.ts`, adding `JudgedDart` to the `./types` import:

```ts
/** Hit policy: the outer single on a NUMBER target's number, either bull on BULL. */
export function outerSingleOnly(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") return anyRingEitherBull(target, observation);
  return (
    observation.hitTargetNumber === target.number &&
    observation.hitZoneKey === "OUTER_SINGLE"
  );
}

/**
 * Per-dart policy: a hit moves to the next target at once — past the last
 * index at the path's end — and is spent on the target it left, so
 * `hitsThisVisit` reads 0.
 */
export function advanceOnHit<TExt>(
  seat: TrackSeat<TExt>,
  dart: JudgedDart,
): TrackSeat<TExt> {
  return dart.hit
    ? { ...seat, targetIndex: seat.targetIndex + 1, hitsThisVisit: 0 }
    : seat;
}

/** Visit policy: open until `darts` darts are thrown or the seat moves past `lastIndex`. */
export function closeAfterOrPastEnd<TExt>(
  darts: number,
  lastIndex: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) =>
    seat.dartsThisVisit < darts && seat.targetIndex <= lastIndex;
}

/** Visit-close policy: at least `hits` hits move to the next target, fewer step back one, never below the first. */
export function stepBackBelowHits<TExt>(
  hits: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) => ({
    ...seat,
    targetIndex:
      seat.hitsThisVisit >= hits
        ? seat.targetIndex + 1
        : Math.max(0, seat.targetIndex - 1),
  });
}

/** Visit-close policy: past `lastIndex`, restart at the first target and count a lap. */
export function lapOnWrap<TExt extends { laps: number }>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex > lastIndex
      ? {
          ...seat,
          targetIndex: 0,
          ext: { ...seat.ext, laps: seat.ext.laps + 1 },
        }
      : seat;
}

/** Visit-close policy: past `lastIndex`, finish (`DONE`) on the last target. */
export function doneOnWrap<TExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex > lastIndex
      ? { ...seat, targetIndex: lastIndex, status: "DONE" }
      : seat;
}
```

  Re-run `track-policies.test.ts`. Expected: all PASS.

- [ ] **Step 5: Rebind the engine.** Rewrite `around-the-clock.engine.module.ts` as follows, keeping every exported name.

  **Imports become:**

```ts
import type {
  AroundTheClockEngineConfig,
  RulesetVersionKey,
  SeatFact,
} from "@lib/types";
import { clockPath, numbersPath, targetAt } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, otherSeatsComplete } from "./seat-state.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceOnHit,
  anyRingEitherBull,
  closeAfterOrPastEnd,
  doneOnWrap,
  lapOnWrap,
  noPoints,
  outerSingleOnly,
  pathTarget,
  stepBackBelowHits,
} from "./track-policies";
import { dartsThrownBy } from "./turn-log.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  AroundTheClockRules,
  AroundTheClockSeatState,
  AroundTheClockState,
  AroundTheClockTrackExt,
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  TrackSeat,
  TurnFact,
} from "./types";
```

  **Keep unchanged:**
  - `HITS_REQUIRED`, `V1_RULES`, `rulesOf`, `targetOnPath` and `activeTargetOf`;
  - `initialSeatState` and `initialAroundTheClockState`;
  - `timedSeatDone`;
  - `foldAroundTheClockState`'s expiry overlay, outcome block and `activeParticipantRef` block.

  **Delete:**
  - `STAGE`;
  - the hand-written class, `aroundTheClockEngineFactory` and `aroundTheClockV2EngineFactory` as written;
  - the bodies of `isAroundTheClockHit` / `isClockHit`, which are replaced below.

  **Replace the two hit functions with:**

```ts
/** Any ring on a NUMBER target's number, either bull on BULL (`anyRingEitherBull`). */
export function isAroundTheClockHit(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  return anyRingEitherBull(target, observation);
}

/** The hit policy `rules.segmentRule` selects: any ring, or the outer single only; either bull on BULL. */
function hitPolicy(
  rules: AroundTheClockRules,
): (target: BoardTarget, observation: DartObservation) => boolean {
  return rules.segmentRule === "ANY" ? anyRingEitherBull : outerSingleOnly;
}

/** Whether `observation` hits `target` under `rules.segmentRule`. */
export function isClockHit(
  rules: AroundTheClockRules,
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  return hitPolicy(rules)(target, observation);
}
```

  **Add before `applyAroundTheClockDart`:**

```ts
const SESSION_ENDED =
  "Cannot record a dart once the session has ended; undo first to correct it.";

/**
 * Around the Clock as Track policies: the resolved path, the segment rule's
 * hit test, no points, three-dart visits that also close when the seat moves
 * past BULL. Easy advances on each hit mid-visit; a 1/2/3-dart difficulty
 * judges the visit on close and steps back below the bar. Past BULL a timed
 * seat laps and an untimed one is done.
 */
function clockRules(
  rules: AroundTheClockRules,
): TrackRules<AroundTheClockTrackExt> {
  const lastIndex = rules.path.length - 1;
  const wrap = rules.timed
    ? lapOnWrap<AroundTheClockTrackExt>(lastIndex)
    : doneOnWrap<AroundTheClockTrackExt>(lastIndex);
  const judge = stepBackBelowHits<AroundTheClockTrackExt>(rules.hitsRequired);
  const easy = rules.hitsRequired === 0;
  return {
    doneMessage: SESSION_ENDED,
    target: pathTarget(rules.path),
    hit: hitPolicy(rules),
    points: noPoints,
    onDart: easy ? advanceOnHit : undefined,
    visitOpen: closeAfterOrPastEnd(3, lastIndex),
    onVisitClose: easy ? wrap : (seat) => wrap(judge(seat)),
  };
}

/** Lifts a clock seat into the kernel's shape: no score, `laps` as the extra. */
function toTrackSeat(
  state: AroundTheClockSeatState,
): TrackSeat<AroundTheClockTrackExt> {
  const { laps, status, ...progress } = state;
  return {
    ...progress,
    score: 0,
    status: status === "COMPLETE" ? "DONE" : "IN_PROGRESS",
    ext: { laps },
  };
}

/** Projects a kernel seat back to the clock's seat state; no clock policy puts a seat `OUT`. */
function toClockSeat(
  seat: TrackSeat<AroundTheClockTrackExt>,
): AroundTheClockSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    dartsThisVisit: seat.dartsThisVisit,
    hitsThisVisit: seat.hitsThisVisit,
    laps: seat.ext.laps,
    status: seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE",
  };
}
```

  If `exactOptionalPropertyTypes` rejects `onDart: undefined` (it is off at plan time), use `...(easy ? { onDart: advanceOnHit } : {})`.

  **`applyAroundTheClockDart`.**
  - Keep the signature and the `@throws`.
  - The JSDoc lead becomes "Pure reducer, via the Track kernel:". Keep the rest of the rule prose.
  - The body becomes:

```ts
  return toClockSeat(
    applyTrackDart(toTrackSeat(state), observation, clockRules(rules)),
  );
```

  **`foldAroundTheClockState`.** The `folded` line becomes:

```ts
  const folded = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ laps: 0 }),
    clockRules(rules),
  ).map(toClockSeat);
```

  **Spec, class and factories.** These replace the old class and factories. Move the old class JSDoc's game paragraph onto the class, `record()`'s short-visit paragraph onto `isClockVisitOpen`, and `wouldComplete()`'s onto `wouldCompleteSession`. Drop what the shell now owns: `completedAt`, undo, `expireTimer` and facts.

```ts
const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * Open while the turn is unstamped, short of three darts, the active seat's,
 * and that seat's folded visit still counts darts — a bull completion or a
 * timed lap restart closes it short (1 or 2 darts), and a closed visit is
 * never reused, by the other seat or the same one.
 */
function isClockVisitOpen(
  turn: TurnFact,
  state: AroundTheClockState,
): boolean {
  if (turn.completedAt !== null || turn.darts.length >= 3) return false;
  if (turn.participantRef !== state.activeParticipantRef) return false;
  return activeSeatState(state).dartsThisVisit > 0;
}

/**
 * Whether `observation` would complete the WHOLE session, not merely the
 * active seat's circuit: solo, those are the same; 1v1, every other seat
 * must already be finished. A timed seat completes only on the dart that
 * closes its visit after expiry.
 */
function wouldCompleteSession(
  state: AroundTheClockState,
  observation: DartObservation,
  config: AroundTheClockEngineConfig,
): boolean {
  const seat = activeSeatState(state);
  if (seat.status !== "IN_PROGRESS") return false;
  const rules = rulesOf(config);
  const after = applyAroundTheClockDart(seat, observation, rules);
  const seatDone = rules.timed
    ? state.timerExpired && after.dartsThisVisit === 0
    : after.status === "COMPLETE";
  return (
    seatDone &&
    otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status === "COMPLETE",
    )
  );
}

/** Around the Clock's rules for the dart engine shell, V1 and V2; refused once the active seat has finished its own circuit. */
const clockSpec: DartGameSpec<AroundTheClockEngineConfig, AroundTheClockState> =
  {
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    rulesetVersionKeys: ["AROUND_THE_CLOCK_V2"],
    stageOwnership: "PER_SEAT",
    fold: foldAroundTheClockState,
    refusal: (state) =>
      activeSeatState(state).status === "IN_PROGRESS" ? null : SESSION_ENDED,
    intent: () => NO_INTENT,
    isVisitOpen: isClockVisitOpen,
    wouldComplete: wouldCompleteSession,
  };

/** The ruleset key a snapshot's shape names: a `pathDirection` field is V2. */
function keyOf(config: AroundTheClockEngineConfig): RulesetVersionKey {
  return "pathDirection" in config
    ? "AROUND_THE_CLOCK_V2"
    : "AROUND_THE_CLOCK_V1";
}

/**
 * Around the Clock (Pattern 18), built by the dart engine shell: a 21-target
 * path (V1: 1..20, then BULL; V2: direction and odds-first order, BULL last)
 * walked per seat under the snapshot's rules. Score-compare: both seats
 * always play their whole circuit, then whichever finished in fewer darts
 * wins. A timed V2 run ends only through `expireTimer()`. The key is read
 * off the snapshot's shape, whatever key a factory passes.
 */
export class AroundTheClockEngine extends dartGameEngineClass(clockSpec) {
  constructor(config: AroundTheClockEngineConfig, prior?: EngineFacts) {
    super(config, prior, keyOf(config));
  }
}

export const aroundTheClockEngineFactory = dartGameEngineFactory(
  clockSpec,
  AroundTheClockEngine,
);

export const aroundTheClockV2EngineFactory = dartGameEngineFactory(
  clockSpec,
  AroundTheClockEngine,
  "AROUND_THE_CLOCK_V2",
);

registerEngineFactory(aroundTheClockEngineFactory);
registerEngineFactory(aroundTheClockV2EngineFactory);
```

  - `foldAroundTheClockState`, `applyAroundTheClockDart`, `isClockVisitOpen` and `wouldCompleteSession` are hoisted function declarations.
  - `SESSION_ENDED` and `NO_INTENT` must sit above `clockSpec`.
  - `foldAroundTheClockState(facts, config, timerExpired = false)` is assignable to the spec's three-argument `fold`.
  - The factories' config types widen to the `AroundTheClockEngineConfig` union. If `npm run check` flags a caller, fix the type at that call site, never with a cast in the engine.
  - `play.data` narrows with `instanceof AroundTheClockEngine`, which the subclass keeps.

- [ ] **Step 6: Flip the registry row** in `scripts/engine-kernels.txt` to:

```
app/src/modules/game/around-the-clock.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/rulesets/around-the-clock.md |
```

- [ ] **Step 7: Run everything.**
  - `cd app && npm test`, in the background. Expected: all PASS, including:
    - the 7 oracle cases;
    - the 8 ATC goldens, with **no snapshot written** (`git status` shows no `__snapshots__` change);
    - every pre-existing ATC, play-data, shell, derived-aims, replay, session-progress, stats-section and DartBot-contract test, unedited;
    - every other golden.
  - `bash scripts/check-game-engines.sh`. Expected: OK. The ATC line lists `AROUND_THE_CLOCK_V1 AROUND_THE_CLOCK_V2`.

- [ ] **Step 8: Prove the oracle catches a rebind slip.** Do each of these separately; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. Drop `hitsThisVisit: 0` from `advanceOnHit`. The Easy cases must fail on `state`. The policy test fails too, which is expected.
  2. In `isClockVisitOpen`, replace the last line with `return true;`. The cases must fail on `facts`, because short visits go unstamped.

- [ ] **Step 9: Gates.**
  - `cd app && npm run check`, in the background → 0/0/0.
  - `cd app && npx fallow`:
    - complexity clean;
    - dead-code clean (every new policy, `expireTimer` and the spec's new parameters have callers);
    - duplication recorded.
  - From the repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-engines.sh`.

- [ ] **Step 10: Commit** (Task 4.2 + 4.3 together).

```bash
git add app/src/modules/game app/tests/modules/game scripts/engine-kernels.txt
git commit -m "refactor(atc): shell + Track kernel; shell timer and state-aware visit close"
```

### Task 4.4: Delete the legacy copy, docs, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/game/legacy/around-the-clock.legacy.ts`, `app/tests/modules/game/around-the-clock.oracle.test.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md` (shell paragraph ~line 818; Track row ~line 830; version 1.11.4)
- Modify: `docs/architecture/00-File-Inventory.md` (the `track-policies.ts` row)
- Modify: `docs/architecture/00-Context-Map-History.md` (append a row)
- Modify: `app/src/modules/game/CLAUDE.md` (shell bullet)

- [ ] **Step 1: Delete the legacy copy and the oracle.**
  - The guarantee stays with `around-the-clock.golden.test.ts`. It was recorded from the original engine in commit 1 and passed unchanged in Task 4.3 Step 7.
  - Commit 1 keeps the oracle's proof in history.
  - Remove `app/tests/modules/game/legacy/` if it is empty.
  - `support/clock-observations.ts` stays, because the goldens use it.

- [ ] **Step 2: Update `04-Architecture-patterns.md`.**
  - In the shell paragraph (~line 818), after "…as Singles Training V1–V3 does.", insert: "A timed spec reads `timerExpired`, the shell's `expireTimer()` flag, as `fold`'s third argument, and `isVisitOpen` sees the folded state, so a rule can close a visit short (Around the Clock)."
  - In the Track row status cell, write: `built — Doubles Training, Bob's 27, Singles Training, Around the Clock bound (D468)`.
  - Version line: `1.11.4 (Pattern 18: Around the Clock bound to the Track kernel; the game shell gains a timer and a state-aware visit close 2026-10-17, D468; prior 1.11.3: …`. Keep the rest of the chain.

- [ ] **Step 3: Update the File Inventory.** In the `track-policies.ts` row, append "; `outerSingleOnly`, `advanceOnHit`, `closeAfterOrPastEnd`, `stepBackBelowHits`, `lapOnWrap`, `doneOnWrap` (Around the Clock, 2026-10-17)". Where a row cites the 04 version, update it to 1.11.4.

- [ ] **Step 4: Update `app/src/modules/game/CLAUDE.md`.** In the shell bullet, after "(Singles Training, 2026-10-17).", insert: "A timed spec reads `timerExpired` as `fold`'s third argument (set by the shell's `expireTimer()`); `isVisitOpen(turn, state)` sees the folded state, so a visit can close short (Around the Clock, 2026-10-17)."

- [ ] **Step 5: Add the history row** to `00-Context-Map-History.md`:

```
| `around-the-clock.engine.module.ts`, `dart-engine-shell.module.ts`, `track-policies.ts`, `modules/game/{types,interfaces}.ts`, `modules/game/CLAUDE.md`, their tests, `support/{engine-oracle,clock-observations}.ts`, `around-the-clock.golden.test.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (v1.11.4), `00-File-Inventory.md` | Around the Clock moved onto the game shell and bound to the Track kernel (goldens recorded pre-rebind, oracle with aimed input and resumable expiry); shell gains `expireTimer()` / `timerExpired` in `fold` and a state-aware `isVisitOpen`; policies `outerSingleOnly`, `advanceOnHit`, `closeAfterOrPastEnd`, `stepBackBelowHits`, `lapOnWrap`, `doneOnWrap`. Track PR 4, D468 (2026-10-17) | historical |
```

- [ ] **Step 6: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. In particular:
  - `npm test` is green, with the count equal to Task 4.3's minus the 7 oracle tests;
  - `npx fallow` duplication is ≤ the Task 4.1 Step 0 baseline;
  - `check-doc-links.sh`, `check-context-budget.sh` (update the `00-Context-Map.md` token claims if they drift), `check-decision-ids.sh`, `check-engine-kernels.sh` and `check-game-engines.sh` pass;
  - `cd app && npm run format` has been run, any diff committed, and `npm run format:check` is clean.

- [ ] **Step 7: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/game app/src/modules/game/CLAUDE.md docs
git commit -m "test(atc): drop legacy copy; goldens hold the guarantee (D468)"
git push -u origin refactor/track-kernel-atc
```

  Open the PR per `finishing-a-dart-branch`, with the body following `.github/pull_request_template.md`. Include:
  - the oracle cases, seeds and steps, expiry steps, `resumeExpired`, and the aimed rate;
  - all three mutation-check results (Task 4.1 Step 8, Task 4.3 Step 8 ×2);
  - fallow duplication before and after;
  - the §7 timed-winner quirk, named as preserved;
  - refinements 2 (illegal-pair hit divergence), 5 (key from shape) and 6 (outcome deferral).

  End the body with the generated line plus the session link. Subscribe and drive to green. Merge `origin/main` in (never rebase) on conflict.
