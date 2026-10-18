# Track T1.2 — SwitchBlade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship SwitchBlade V1 as a playable routine-step exercise bound to the Track kernel through `trackExerciseSpec`, end to end (engine, seed, validator, routine wiring, stats, docs).

**Architecture:** A fixed 15-slot path (five rounds of three darts) walked one slot per dart. The hit rule is the existing `anyRingEitherBull` and points the existing `boardScorePoints`. Two new per-dart policies carry the rest: `advanceEveryDart`, and `tallyRoundPoints`, which adds points to a round total. `passOnWrap(14)` restarts the path. Intent changes mid-visit through the shell's per-dart `intent` (spec §2.4), with no shell change. Wiring mirrors Hit Count (T1.1, PR #996) file by file.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (T1.2). Rules: `docs/game-rules/training/exercises/switchblade.md`. Model PR: `docs/superpowers/plans/2026-10-17-track-t1-hit-count.md`.

## Global Constraints

- **Branch:** `feat/track-t1-switchblade` (from `origin/main`). Never merge to `main`; never use `--no-verify`.
- **TDD** per `app/CLAUDE.md` §TDD: write the failing test first and watch it fail, then write the code. Run commands from `app/` with `npm test -- <path>`.
- **Comments:** no `//` or `/* */` comments inside function bodies. JSDoc above declarations only, with no decision history in prose.
- **Quality gates:**
  - fallow complexity ≤ 15 and CRAP ≤ 30.
  - `npm run validate:app` exits 0 with the type gate at 0/0/0.
  - `validate:app`'s `db:drift` needs `app/.env`; create it temporarily with the local DB URL, then delete it.
- **Existing tests and snapshots are append-only.** An assertion that lists every kind may gain the new kind, by a ledgered ruling, and only when the guarantee stays the same.
- **Migrations:** never modify `0001`–`0046`. This PR has no schema change.
- **Seed:** number `0039` (the highest on `main` is `0038`). Seed ids:
  - type `0199a000-0000-7000-8000-00000000000d`
  - ruleset `0199a100-0000-7000-8000-00000000000c`
  - template `0199b000-0000-7000-8000-000000000013`
- **No decision entry.** Spec §8 puts the wave's only decision in T1.1 (D469). Re-run `bash scripts/next-decision-id.sh` before the PR anyway; it should print `D470`.
- **Discovered work** goes to a GitHub issue labelled `discovered-work`; never fix it here.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- **Before the PR:** `cd app && npm run format && npm run format:check`.
- **Naming:**
  - code: `Switchblade` / `switchblade` / `SWITCHBLADE`;
  - display label: `SwitchBlade`;
  - panel: `"switchblade"`.

## Spec refinements (write back into the spec on approval)

1. **Type key.** The type key is `SWITCHBLADE` (ruleset `SWITCHBLADE_V1`), not the rules file's proposed `PATH_SCORING`. Each subject is its own type (spec §1), and Hit Count keyed by name.
2. **Config.** The config is the empty strict object, `{}`. The path is locked in V1 (rules file: "Shown, locked"; custom paths are V2+). It lives in the engine as `SWITCHBLADE_PATH`, as Bull Up keeps its rules in code (`BullUpV1Config`).
3. **Round totals policy.** Round totals come from a second new policy, `tallyRoundPoints(dartsPerRound)` (onDart), not engine-local code. This follows T1.1's refinement 2: D468 asks each policy to land with its first caller.
   - The onDart chain is `passOnWrap(14) ∘ advanceEveryDart ∘ tallyRoundPoints(3)`.
   - The tally runs first, so a dart's points land in the round it was thrown in.
4. **Extra state fields.** `SwitchbladeState` adds `slotIndex`, `hits`, `dartsThrown` and `status` to the spec's readouts.
   - The step metrics and summary need `hits` and `darts`, and get them without facts (`NO_FACTS`).
   - `hits` counts darts whose hit number equals their intended number, which matches the kernel's judgement for this path.
5. **Preview family.** The preview family is `switchblade`:
   - it judges on the number (`judgeOnTarget`, either bull on 25);
   - it captions the open visit's three slots from the round (`visitIndex % 5`).
6. **Golden observer.** `aimedOnCurrentBoardTarget(rate, field = "currentTarget")` takes the state field to read, so SwitchBlade's `currentSlot` reuses it.
7. **Integration fixture.** The routine-stats integration fixture gains SwitchBlade as step 13, after Hit Count, so existing steps keep their numbers. `statistics-sql.itest.ts`'s `toHaveLength(12)` becomes 13 by ruling, keeping the same guarantee: one step per kind.

## Review Focus

1. **Pass wrap on the 15th dart.** It wraps to slot 0, round 1, with `passes` 1, and round 5's points stay in `roundTotals[4]`. Pinned in Task 3 (`wraps after the bull slot and keeps round five's points`).
2. **Undo across the wrap.** Undoing the first dart of pass 2 restores pass 1's final state. Pinned in Task 3 (`undo across a pass wrap`).
3. **Bull slot.** Outer bull scores 25, bullseye scores 50, and a 20 on the bull slot scores 0; intent is `25`/`INNER_BULL`. Pinned in Task 3 (`bull slot scores either bull`).
4. **Rehydrate mid-visit at a switch.** After dart 2 of round 2, a rebuilt engine reads `currentSlot` T19 and stamps the next dart `19`/`TREBLE`. Pinned in Task 3 (`rehydrates mid-visit at the switch`).
5. **Non-empty config refused.** A non-empty config is refused at parse, by both the server validator and the engine. Pinned in Task 2 and Task 3/4.

---

### Task 1: Policies `advanceEveryDart`, `tallyRoundPoints`

**Files:**
- Modify: `app/src/modules/game/types.ts` (ext types after `HitCountTrackExt`)
- Modify: `app/src/modules/game/track-policies.ts`
- Test: `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RoundTallyExt = { roundTotals: number[] };
  export type SwitchbladeTrackExt = RoundTallyExt & PassTrackExt;
  advanceEveryDart<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt>                          // onDart
  tallyRoundPoints<TExt extends RoundTallyExt>(dartsPerRound: number): (seat, dart) => seat // onDart
  ```

- [ ] **Step 1: Write the failing tests.** Append them, and add `advanceEveryDart`, `tallyRoundPoints` and `SwitchbladeTrackExt` to the imports.

```ts
describe("SwitchBlade policies", () => {
  const seatAt = (
    targetIndex: number,
    ext: Partial<SwitchbladeTrackExt> = {},
  ): TrackSeat<SwitchbladeTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      passes: 0,
      roundTotals: [0, 0, 0, 0, 0],
      ...ext,
    }),
    targetIndex,
  });
  const judged = (points: number): JudgedDart => ({
    observation: {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    },
    target: { kind: "TREBLE", number: 20 },
    hit: points > 0,
    points,
  });

  it("advanceEveryDart moves one target per dart, hit or miss", () => {
    expect(advanceEveryDart(seatAt(4)).targetIndex).toBe(5);
    expect(advanceEveryDart(seatAt(14)).targetIndex).toBe(15);
  });

  it("advanceEveryDart leaves score and ext alone", () => {
    const seat = { ...seatAt(2, { passes: 3 }), score: 40 };
    const moved = advanceEveryDart(seat);
    expect(moved.score).toBe(40);
    expect(moved.ext).toBe(seat.ext);
  });

  it("tallyRoundPoints adds the dart's points to its target's round", () => {
    const seat = tallyRoundPoints<SwitchbladeTrackExt>(3)(
      seatAt(5, { roundTotals: [10, 20, 0, 0, 0] }),
      judged(57),
    );
    expect(seat.ext.roundTotals).toEqual([10, 77, 0, 0, 0]);
  });

  it("tallyRoundPoints maps a round's first and last target to that round", () => {
    const tally = tallyRoundPoints<SwitchbladeTrackExt>(3);
    expect(tally(seatAt(12), judged(50)).ext.roundTotals).toEqual([
      0, 0, 0, 0, 50,
    ]);
    expect(tally(seatAt(14), judged(25)).ext.roundTotals).toEqual([
      0, 0, 0, 0, 25,
    ]);
    expect(tally(seatAt(3), judged(60)).ext.roundTotals).toEqual([
      0, 60, 0, 0, 0,
    ]);
  });

  it("tallyRoundPoints never mutates the seat it was given", () => {
    const before = seatAt(0);
    tallyRoundPoints<SwitchbladeTrackExt>(3)(before, judged(60));
    expect(before.ext.roundTotals).toEqual([0, 0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/game/track-policies.test.ts`
Expected: FAIL, because `advanceEveryDart` and `tallyRoundPoints` are not exported.

- [ ] **Step 3: Implement**

In `types.ts` (after `HitCountTrackExt`):
```ts
/** Points per round for a Track seat whose path is cut into equal rounds (SwitchBlade). */
export type RoundTallyExt = {
  roundTotals: number[];
};

/** SwitchBlade's Track extras. */
export type SwitchbladeTrackExt = RoundTallyExt & PassTrackExt;
```

In `track-policies.ts`, import `RoundTallyExt` and append:
```ts
/** Per-dart policy: step to the next target after every dart, hit or miss. */
export function advanceEveryDart<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  return { ...seat, targetIndex: seat.targetIndex + 1 };
}

/** Per-dart policy: add the dart's points to `ext.roundTotals` at the current target's round, `dartsPerRound` targets to a round. */
export function tallyRoundPoints<TExt extends RoundTallyExt>(
  dartsPerRound: number,
): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt> {
  return (seat, dart) => {
    const round = Math.floor(seat.targetIndex / dartsPerRound);
    const roundTotals = [...seat.ext.roundTotals];
    roundTotals[round] = (roundTotals[round] ?? 0) + dart.points;
    return { ...seat, ext: { ...seat.ext, roundTotals } };
  };
}
```

- [ ] **Step 4: Run** the Step 2 command. Expected: PASS.

- [ ] **Step 5: Mutation checks.** Ledger each result for the PR body, and revert after each.
  - `advanceEveryDart`:
    - (a) `+ 1` → `+ 0`;
    - (b) `+ 1` → `+ 2`.
    - Expected: a policy test fails each time.
  - `tallyRoundPoints`:
    - (a) `Math.floor(seat.targetIndex / dartsPerRound)` → `seat.targetIndex % dartsPerRound`;
    - (b) `+ dart.points` → `+ 1`.
    - Expected: a policy test fails each time.

- [ ] **Step 6: Commit**
```bash
git add app/src/modules/game/types.ts app/src/modules/game/track-policies.ts app/tests/modules/game/track-policies.test.ts
git commit -m "feat(track): advanceEveryDart and tallyRoundPoints policies"
```

---

### Task 2: `SWITCHBLADE_V1` key and config

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces:
  - `ExerciseRulesetVersionKey` gains `"SWITCHBLADE_V1"`.
  - `SwitchbladeV1Config = z.object({}).strict()`.
  - `SwitchbladeConfigData`.
  - `EXERCISE_RULESET_CONFIGS.SWITCHBLADE_V1`.

- [ ] **Step 1: Write the failing tests.** Append them, and import `SwitchbladeV1Config`.

```ts
describe("SwitchbladeV1Config", () => {
  it("accepts the empty config — the path is fixed", () => {
    expect(SwitchbladeV1Config.safeParse({}).success).toBe(true);
  });

  it("rejects any key, a custom path included", () => {
    expect(SwitchbladeV1Config.safeParse({ path: [] }).success).toBe(false);
    expect(SwitchbladeV1Config.safeParse({ rounds: 5 }).success).toBe(false);
  });

  it("is registered under SWITCHBLADE_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.SWITCHBLADE_V1).toBe(SwitchbladeV1Config);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`
Expected: FAIL, because `SwitchbladeV1Config` is not exported.

- [ ] **Step 3: Implement.** Add `| "SWITCHBLADE_V1"` to the key union, then append after `HitCountTarget`:

```ts
/**
 * SwitchBlade v1: five rounds on a fixed path — T20, T20, then T20, T19,
 * T18, T17 or the bullseye — scored at board value on each dart's own
 * number (`docs/game-rules/training/exercises/switchblade.md`). The path is
 * locked and duration is the routine step's, so the config is the empty
 * object.
 */
export const SwitchbladeV1Config = z.object({}).strict();

export type SwitchbladeConfigData = z.infer<typeof SwitchbladeV1Config>;
```
Then add `SWITCHBLADE_V1: SwitchbladeV1Config,` to `EXERCISE_RULESET_CONFIGS`.

- [ ] **Step 4: Run** the file. Expected: PASS.

Then run `npm run check`.
- Expected: a type error only in `services/exercise-rulesets/registry.ts`'s `Record` (Task 4 fills it).
- If one appears, add the Task 4 registry entry now and ledger a ruling, so every commit type-checks.

- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/exercises/rulesets/types.ts app/tests/lib/training/exercises/rulesets/types.test.ts
git commit -m "feat(switchblade): SWITCHBLADE_V1 ruleset key and config"
```

---

### Task 3: SwitchBlade engine, kernel row, golden

**Files:**
- Modify: `app/src/modules/training/exercises/types.ts` (add `SwitchbladeSlot`, `SwitchbladeState`)
- Create: `app/src/modules/training/exercises/switchblade.engine.module.ts`
- Modify: `scripts/engine-kernels.txt`
- Modify: `app/tests/modules/game/support/aimed-observations.ts` (`field` parameter)
- Test: `app/tests/modules/training/exercises/switchblade.engine.module.test.ts`, `app/tests/modules/training/exercises/switchblade.aimed.golden.test.ts`

**Interfaces:**
- Consumes:
  - Task 1's policies and `SwitchbladeTrackExt`;
  - Task 2's config;
  - `trackExerciseSpec`, `anyRingEitherBull`, `boardScorePoints`, `passOnWrap`, `pathTarget`, `closeAfter` and `sectionOf`.
- Produces:
  ```ts
  export type SwitchbladeSlot = { kind: "TREBLE"; number: number } | { kind: "BULL" };
  export type SwitchbladeState = {
    currentSlot: SwitchbladeSlot;
    slotIndex: number;          // 0–14
    round: number;              // 1–5
    total: number;
    roundTotals: number[];      // 5, summed over every pass
    passes: number;
    hits: number;
    dartsThrown: number;
    status: "IN_PROGRESS" | "COMPLETE";
  };
  export const SWITCHBLADE_PATH: readonly SwitchbladeSlot[];   // 15 slots
  export function switchbladeRoundSlots(roundIndex: number): readonly SwitchbladeSlot[]; // 0-based, wraps mod 5
  export function switchbladeIntent(slot: SwitchbladeSlot): DartIntent;
  export function foldSwitchbladeState(facts: EngineFacts, config: SwitchbladeConfigData, complete: boolean): SwitchbladeState;
  export class SwitchbladeEngine;
  export const switchbladeEngineFactory;   // registered under SWITCHBLADE_V1
  ```

- [ ] **Step 1: Write the failing engine tests**

```ts
import { describe, expect, it } from "vitest";
import {
  foldSwitchbladeState,
  SWITCHBLADE_PATH,
  switchbladeEngineFactory,
  SwitchbladeEngine,
  switchbladeIntent,
  switchbladeRoundSlots,
} from "@modules/training/exercises/switchblade.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";
import type { DartObservation } from "@modules/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}
const MISS = dart(null, "MISS");
const T = (n: number) => dart(n, "TREBLE");
const times = (n: number, d: DartObservation) =>
  Array.from({ length: n }, () => d);
const PERFECT_PASS = [
  T(20), T(20), T(20),
  T(20), T(20), T(19),
  T(20), T(20), T(18),
  T(20), T(20), T(17),
  T(20), T(20), dart(25, "INNER_BULL"),
];
const TREBLE_20 = { kind: "TREBLE", number: 20 } as const;

function play(engine: SwitchbladeEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("SwitchBlade engine", () => {
  it("starts on round one's first slot", () => {
    expect(new SwitchbladeEngine({}).state()).toEqual({
      currentSlot: TREBLE_20,
      slotIndex: 0,
      round: 1,
      total: 0,
      roundTotals: [0, 0, 0, 0, 0],
      passes: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("lays out five rounds: T20, T20, then the switch", () => {
    expect(SWITCHBLADE_PATH).toHaveLength(15);
    expect(switchbladeRoundSlots(1)).toEqual([
      TREBLE_20,
      TREBLE_20,
      { kind: "TREBLE", number: 19 },
    ]);
    expect(switchbladeRoundSlots(4)[2]).toEqual({ kind: "BULL" });
    expect(switchbladeRoundSlots(5)).toEqual(switchbladeRoundSlots(0));
  });

  it("scores board value on the slot's number in any ring", () => {
    const state = play(new SwitchbladeEngine({}), [
      T(20),
      dart(20, "SINGLE"),
      dart(20, "DOUBLE"),
    ]);
    expect(state.total).toBe(120);
    expect(state.roundTotals).toEqual([120, 0, 0, 0, 0]);
    expect(state.hits).toBe(3);
  });

  it("scores nothing off the slot's number", () => {
    const state = play(new SwitchbladeEngine({}), [
      ...times(5, MISS),
      T(20),
    ]);
    expect(state.total).toBe(0);
    expect(state.hits).toBe(0);
    expect(state.round).toBe(3);
  });

  it("switches the slot mid-visit and stamps each dart with its own slot", () => {
    const engine = new SwitchbladeEngine({});
    const state = play(engine, times(5, MISS));
    expect(state.currentSlot).toEqual({ kind: "TREBLE", number: 19 });
    expect(state.round).toBe(2);
    engine.record(T(19));
    expect(
      engine.facts().turns[1]!.darts.map((d) => [
        d.intendedTargetNumber,
        d.intendedZoneKey,
      ]),
    ).toEqual([
      [20, "TREBLE"],
      [20, "TREBLE"],
      [19, "TREBLE"],
    ]);
    expect(engine.state().roundTotals[1]).toBe(57);
  });

  it("bull slot scores either bull", () => {
    const outer = play(new SwitchbladeEngine({}), [
      ...times(14, MISS),
      dart(25, "OUTER_BULL"),
    ]);
    expect(outer.total).toBe(25);
    const inner = play(new SwitchbladeEngine({}), [
      ...times(14, MISS),
      dart(25, "INNER_BULL"),
    ]);
    expect(inner.total).toBe(50);
    const twenty = play(new SwitchbladeEngine({}), [...times(14, MISS), T(20)]);
    expect(twenty.total).toBe(0);
    const engine = new SwitchbladeEngine({});
    play(engine, times(15, MISS));
    expect(engine.facts().turns[4]!.darts[2]).toMatchObject({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("wraps after the bull slot and keeps round five's points", () => {
    const state = play(new SwitchbladeEngine({}), [
      ...times(14, MISS),
      dart(25, "INNER_BULL"),
    ]);
    expect(state.passes).toBe(1);
    expect(state.slotIndex).toBe(0);
    expect(state.round).toBe(1);
    expect(state.currentSlot).toEqual(TREBLE_20);
    expect(state.roundTotals).toEqual([0, 0, 0, 0, 50]);
  });

  it("a perfect pass totals 872 and two passes sum per round", () => {
    const one = play(new SwitchbladeEngine({}), PERFECT_PASS);
    expect(one.total).toBe(872);
    expect(one.roundTotals).toEqual([180, 177, 174, 171, 170]);
    const two = play(new SwitchbladeEngine({}), [
      ...PERFECT_PASS,
      ...PERFECT_PASS,
    ]);
    expect(two.roundTotals).toEqual([360, 354, 348, 342, 340]);
    expect(two.passes).toBe(2);
    expect(two.hits).toBe(30);
    expect(two.dartsThrown).toBe(30);
  });

  it("writes one turn per three-dart round", () => {
    const engine = new SwitchbladeEngine({});
    play(engine, times(7, MISS));
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 1,
    ]);
  });

  it("undo across a pass wrap restores the end of pass 1", () => {
    const engine = new SwitchbladeEngine({});
    const before = play(engine, PERFECT_PASS);
    engine.record(T(20));
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("rehydrates mid-visit at the switch", () => {
    const engine = new SwitchbladeEngine({});
    const state = play(engine, [...times(3, T(20)), T(20), MISS]);
    const rebuilt = new SwitchbladeEngine({}, engine.facts());
    expect(rebuilt.state()).toEqual(state);
    rebuilt.record(T(19));
    expect(rebuilt.facts().turns[1]!.darts[2]).toMatchObject({
      intendedTargetNumber: 19,
      intendedZoneKey: "TREBLE",
    });
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new SwitchbladeEngine({});
    play(engine, times(45, MISS));
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a non-empty config", () => {
    expect(
      () => new SwitchbladeEngine({ path: [] } as never),
    ).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new SwitchbladeEngine({});
    const state = play(engine, [T(20), MISS, dart(20, "SINGLE"), T(20)]);
    expect(foldSwitchbladeState(engine.facts(), {}, false)).toEqual(state);
  });

  it("switchbladeIntent aims at the treble, or the bullseye on the bull slot", () => {
    expect(switchbladeIntent({ kind: "TREBLE", number: 18 })).toEqual({
      intendedTargetNumber: 18,
      intendedZoneKey: "TREBLE",
    });
    expect(switchbladeIntent({ kind: "BULL" })).toEqual({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("SWITCHBLADE_V1")).toBe(
      switchbladeEngineFactory,
    );
  });

  it("produces an events batch the API accepts", () => {
    const engine = new SwitchbladeEngine({});
    play(engine, [T(20), MISS, dart(20, "SINGLE"), MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/switchblade.engine.module.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

In `exercises/types.ts` (after `HitCountState`):
```ts
/** One SwitchBlade path slot: a treble, or the bull. */
export type SwitchbladeSlot =
  | { kind: "TREBLE"; number: number }
  | { kind: "BULL" };

/**
 * SwitchBlade state, derived by replaying `facts()` (`foldSwitchbladeState`).
 * `currentSlot`/`slotIndex`/`round` locate the next dart; `roundTotals`
 * sums each round's board points over every pass.
 */
export type SwitchbladeState = {
  currentSlot: SwitchbladeSlot;
  slotIndex: number;
  round: number;
  total: number;
  roundTotals: number[];
  passes: number;
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

`switchblade.engine.module.ts`:
```ts
import type { SwitchbladeConfigData } from "@lib/types";
import { SwitchbladeV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartIntent,
  EngineFacts,
  SwitchbladeTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  advanceEveryDart,
  anyRingEitherBull,
  boardScorePoints,
  closeAfter,
  passOnWrap,
  pathTarget,
  sectionOf,
  tallyRoundPoints,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { SwitchbladeSlot, SwitchbladeState } from "./types";

const DARTS_PER_ROUND = 3;
const ROUNDS = 5;
const DONE_MESSAGE =
  "A SwitchBlade seat never finishes; only the timer ends the exercise.";

const treble = (number: number): SwitchbladeSlot => ({
  kind: "TREBLE",
  number,
});

/** The fixed path: each round two darts at T20, then T20, T19, T18, T17 or the bull. */
export const SWITCHBLADE_PATH: readonly SwitchbladeSlot[] = [
  treble(20),
  treble(19),
  treble(18),
  treble(17),
  { kind: "BULL" },
].flatMap((third) => [treble(20), treble(20), third]);

/** Round `roundIndex`'s three slots (0-based, wrapping every five rounds). */
export function switchbladeRoundSlots(
  roundIndex: number,
): readonly SwitchbladeSlot[] {
  const start = (roundIndex % ROUNDS) * DARTS_PER_ROUND;
  return SWITCHBLADE_PATH.slice(start, start + DARTS_PER_ROUND);
}

/** The bed each dart is aimed at: its slot's treble, or the bullseye. */
export function switchbladeIntent(slot: SwitchbladeSlot): DartIntent {
  return {
    intendedTargetNumber: sectionOf(slot),
    intendedZoneKey: slot.kind === "BULL" ? "INNER_BULL" : "TREBLE",
  };
}

/**
 * SwitchBlade's Track rules: one path slot per dart; a dart on its slot's
 * number in any ring (either bull on the bull slot) scores its board value;
 * `tallyRoundPoints` books it to its round, `advanceEveryDart` moves on and
 * `passOnWrap` restarts the path after the bull slot.
 */
function switchbladeRules(): TrackRules<SwitchbladeTrackExt> {
  const tally = tallyRoundPoints<SwitchbladeTrackExt>(DARTS_PER_ROUND);
  const wrap = passOnWrap<SwitchbladeTrackExt>(SWITCHBLADE_PATH.length - 1);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(SWITCHBLADE_PATH),
    hit: anyRingEitherBull,
    points: boardScorePoints,
    onDart: (seat, dart) => wrap(advanceEveryDart(tally(seat, dart))),
    visitOpen: closeAfter(DARTS_PER_ROUND),
  };
}

function projectSwitchblade(
  seat: TrackSeat<SwitchbladeTrackExt>,
  _config: SwitchbladeConfigData,
  complete: boolean,
  facts: EngineFacts,
): SwitchbladeState {
  const darts = facts.turns.flatMap((turn) => turn.darts);
  return {
    currentSlot: SWITCHBLADE_PATH[seat.targetIndex],
    slotIndex: seat.targetIndex,
    round: Math.floor(seat.targetIndex / DARTS_PER_ROUND) + 1,
    total: seat.score,
    roundTotals: seat.ext.roundTotals,
    passes: seat.ext.passes,
    hits: darts.filter(
      (dart) =>
        dart.intendedTargetNumber !== null &&
        dart.hitTargetNumber === dart.intendedTargetNumber,
    ).length,
    dartsThrown: darts.length,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const switchbladeSpec = trackExerciseSpec<
  SwitchbladeConfigData,
  SwitchbladeTrackExt,
  SwitchbladeState
>({
  exerciseRulesetVersionKey: "SWITCHBLADE_V1",
  parse: (config) => SwitchbladeV1Config.parse(config),
  rules: switchbladeRules,
  initialExt: () => ({
    roundTotals: Array.from({ length: ROUNDS }, () => 0),
    passes: 0,
  }),
  project: projectSwitchblade,
  intent: (state) => switchbladeIntent(state.currentSlot),
});

/** SwitchBlade's state from a fact log alone, through the same fold the engine uses. */
export function foldSwitchbladeState(
  facts: EngineFacts,
  config: SwitchbladeConfigData,
  complete: boolean,
): SwitchbladeState {
  return switchbladeSpec.fold(facts, config, complete);
}

/** SwitchBlade exercise engine, built by the exercise shell. */
export class SwitchbladeEngine extends dartExerciseEngineClass(
  switchbladeSpec,
) {}

export const switchbladeEngineFactory = dartExerciseEngineFactory(
  switchbladeSpec,
  SwitchbladeEngine,
);

registerDartExerciseEngineFactory(switchbladeEngineFactory);
```
`SwitchbladeSlot` / `SwitchbladeState` must reach `@modules/types` the way `HitCountState` does; check the barrel and follow it.

- [ ] **Step 4: Run** the engine test. Expected: PASS.
  - If `pathTarget(SWITCHBLADE_PATH)` rejects the slot type, fix it at the type with no cast: `SwitchbladeSlot` is a structural subset of `BoardTarget`.
  - If fallow flags the `hits` filter's complexity, extract a named `onIntendedNumber(dart)` above the projection.

- [ ] **Step 5: Add the kernel row.** Append it to `scripts/engine-kernels.txt`, keeping path order:
```
app/src/modules/training/exercises/switchblade.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/switchblade.md |
```
Run `bash scripts/check-engine-kernels.sh`. Expected: OK, with one more engine.

- [ ] **Step 6: Add the aimed golden.** In `aimed-observations.ts`:
  - give `aimedOnCurrentBoardTarget` a second parameter `field = "currentTarget"`;
  - read `(engine.state() as Record<string, BoardTarget>)[field]`;
  - extend its JSDoc to say "the board target in state field `field` (default `currentTarget`)".

Hit Count's golden calls it with one argument, so its snapshot must not change.

`switchblade.aimed.golden.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("SwitchBlade — aimed golden trace", () => {
  for (const resumeExpired of [false, true]) {
    it(`resumeExpired ${resumeExpired}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SwitchbladeEngine({}, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.6, "currentSlot"),
        }),
      ).toMatchSnapshot();
    });
  }
});
```
Run it twice. The first run writes the snapshot. On the second, Expected: PASS with no write.
Then run `npm test -- tests/modules/training/exercises/hit-count.aimed.golden.test.ts`. Expected: PASS, no write.
Open the new snapshot and confirm `passes` > 0 (the trace crosses a wrap).

- [ ] **Step 7: Engine mutation spot-check.**
  - Change `wrap(advanceEveryDart(tally(seat, dart)))` to `tally(wrap(advanceEveryDart(seat)), dart)`. Expected: `wraps after the bull slot…` fails.
  - Change `wrap(...)` to `advanceEveryDart(...)`. Expected: fails.
  - Revert both, and ledger them.

- [ ] **Step 8: Commit**
```bash
git add app/src/modules/training/exercises/types.ts app/src/modules/training/exercises/switchblade.engine.module.ts app/tests/modules/training/exercises/switchblade.engine.module.test.ts app/tests/modules/training/exercises/switchblade.aimed.golden.test.ts app/tests/modules/training/exercises/__snapshots__/switchblade.aimed.golden.test.ts.snap app/tests/modules/game/support/aimed-observations.ts scripts/engine-kernels.txt
git commit -m "feat(switchblade): SwitchBlade engine bound to the Track kernel"
```

---

### Task 4: Server wiring

**Files:**
- Create: `app/src/services/exercise-rulesets/switchblade/switchblade.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts`, `app/src/services/types.ts`, `app/src/services/training-session.service.ts`, `app/src/pages/api/training-sessions/types.ts`
- Test: `app/tests/services/exercise-rulesets/switchblade.validator.test.ts`, `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/services/training-session.service.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`

**Interfaces:**
- Produces:
  - `switchbladeValidator: ExerciseRulesetValidator`.
  - `"SWITCHBLADE"` in `exerciseTypeKey` (the service type and both API Zod enums) and in `DART_EXERCISE_TYPE_KEYS`.
  - `"SWITCHBLADE_V1"` in `REGISTRY` and `DART_WRITING_RULESET_VERSION_KEYS`.

- [ ] **Step 1: Write the failing tests**

`switchblade.validator.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { switchbladeValidator } from "@services/exercise-rulesets/switchblade/switchblade.validator";

describe("switchbladeValidator", () => {
  it("accepts the empty config", () => {
    expect(switchbladeValidator.validateConfig({ config: {} })).toEqual({
      ok: true,
      config: {},
    });
  });

  it("refuses a custom path", () => {
    const result = switchbladeValidator.validateConfig({
      config: { path: [] },
    });
    expect(result.ok).toBe(false);
  });
});
```
Use `hit-count.validator.test.ts`'s call shape if `validateConfig` takes more.

Append to `registry.test.ts`, mirroring the two Hit Count cases:
- `resolves SWITCHBLADE_V1` → `switchbladeValidator`;
- `is true for SwitchBlade` → `exerciseRulesetWritesDarts("SWITCHBLADE_V1")` is true.

Append to `pages/api/training-sessions/types.test.ts` a copy of `accepts a HIT_COUNT step` named `accepts a SWITCHBLADE step`, with:
- `exerciseTypeKey: "SWITCHBLADE"`;
- `exerciseRulesetVersionKey: "SWITCHBLADE_V1"`;
- `configuration: {}`.

Copy any second Hit Count case in that file the same way.

Append to `training-session.service.test.ts` a copy of `inserts HIT_COUNT under the ANALYTICS/VISUAL_BOARD capture pair`, named for SWITCHBLADE, with:
- keys `"SWITCHBLADE"` / `"SWITCHBLADE_V1"`;
- configuration `{}`;
- ids `"et-sb"` / `"erv-sb"`;
- the same capture-pair assertions.

- [ ] **Step 2: Run** `npm test -- tests/services/exercise-rulesets tests/services/training-session.service.test.ts tests/pages/api/training-sessions/types.test.ts`
Expected: FAIL. The validator is missing, the enums reject `SWITCHBLADE`, and the capture pair is null.

- [ ] **Step 3: Implement**

`switchblade.validator.ts`:
```ts
import { SwitchbladeV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * SwitchBlade v1 asserts the config is empty — the path is fixed
 * (`docs/game-rules/training/exercises/switchblade.md`).
 */
export const switchbladeValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = SwitchbladeV1Config.safeParse(config);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { ok: true, config: parsed.data as Record<string, unknown> };
  },
};
```
Then:
- `registry.ts`: import it; add `SWITCHBLADE_V1: switchbladeValidator,` and `"SWITCHBLADE_V1",` in `DART_WRITING_RULESET_VERSION_KEYS`.
- `services/types.ts`: add `| "SWITCHBLADE"` after `| "HIT_COUNT"`.
- `training-session.service.ts`: add `"SWITCHBLADE",` in `DART_EXERCISE_TYPE_KEYS`, and SwitchBlade to its JSDoc list.
- `pages/api/training-sessions/types.ts`: add `"SWITCHBLADE",` after `"HIT_COUNT",` in both enums.

If fallow reports the validator as a duplicate, ledger a ruling. Duplicate-validator issue: search open `discovered-work` issues first; comment there if one exists, else file one. Do not refactor.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add app/src/services app/src/pages/api/training-sessions/types.ts app/tests/services app/tests/pages/api/training-sessions/types.test.ts
git commit -m "feat(switchblade): server validator, keys and capture pair"
```

---

### Task 5: Seed `0039` and verification

**Files:**
- Create: `database/seeds/0039_switchblade_exercise_type.sql`, `database/verification/0039_switchblade_seed_checks.sql`
- Modify: `database/README.md`

- [ ] **Step 1: Write the verification script first.** Copy `database/verification/0038_hit_count_seed_checks.sql` and replace:
  - `0038_hit_count` → `0039_switchblade`;
  - `HIT_COUNT` → `SWITCHBLADE`;
  - `HIT_COUNT_V1` → `SWITCHBLADE_V1`;
  - `Big Trebles` → `SwitchBlade`;
  - check 3's name → `'the system template pins SWITCHBLADE_V1 with the empty configuration'`, with its predicate `AND t.default_configuration = '{}'::jsonb;`;
  - the header purpose to match.

- [ ] **Step 2: Prove it fails.**
  - Create a temporary `app/.env` with the local DB URL. Postgres runs locally, as in T1.1.
  - Run `psql "$URL" -f database/verification/0039_switchblade_seed_checks.sql`.
  - Expected: checks 1–4 FAIL.

- [ ] **Step 3: Write the seed.** Copy `0038_hit_count_exercise_type.sql` and change:
  - **header:** the file name; purpose "Insert the SWITCHBLADE exercise type, its v1 ruleset and the SwitchBlade system template … Rules: docs/game-rules/training/exercises/switchblade.md. No routine is seeded: V1 is a routine step only."; the config paragraph becomes "The default configuration is empty: the path is fixed in V1. Duration is the routine step's."
  - **`exercise_types`:**
    - id `'0199a000-0000-7000-8000-00000000000d'`;
    - key `'SWITCHBLADE'`;
    - name `'SwitchBlade'`;
    - description `'Five three-dart rounds on a fixed path — two darts at T20, then a switch — scoring board points on each dart''s own number; the path repeats until the time runs out.'`
  - **`exercise_ruleset_versions`:**
    - id `'0199a100-0000-7000-8000-00000000000c'`;
    - type id `…00d`;
    - key `'SWITCHBLADE_V1'`;
    - description `'Initial SwitchBlade ruleset: fixed path T20 T20 then T20/T19/T18/T17/bull; board score on the slot''s number, either bull on the bull slot; passes repeat until time.'`
  - **`exercise_templates`:**
    - id `'0199b000-0000-7000-8000-000000000013'`;
    - type id `…00d`;
    - ruleset subselect on `'SWITCHBLADE_V1'`;
    - name `'SwitchBlade'`;
    - description `'Two darts at T20, then T20, T19, T18, T17 and the bullseye. Score board points on each dart''s own number.'`;
    - configuration `'{}'::jsonb`.

- [ ] **Step 4: Run** `cd app && npm run db:seed`, then the verification script.
  - Expected: `ALL 4 CHECKS PASSED`.
  - Run `npm run db:seed` again. Expected: no error (idempotent).
  - Delete `app/.env`.

- [ ] **Step 5: Update the README.**
  - Add the item `39. \`seeds/0039_switchblade_exercise_type.sql\`` after item 38.
  - Add a verification row after the `0038_hit_count` row:
```
| `verification/0039_switchblade_seed_checks.sql` | seed `0039`: the `SWITCHBLADE` type is published, `SWITCHBLADE_V1` is its version 1, the system template "SwitchBlade" pins it with the empty configuration, and `v_exercise_template_catalog` offers it (4 checks) (2026-10-18) |
```

- [ ] **Step 6: Commit**
```bash
git add database/seeds/0039_switchblade_exercise_type.sql database/verification/0039_switchblade_seed_checks.sql database/README.md
git commit -m "feat(switchblade): seed the SWITCHBLADE type and template"
```

---

### Task 6: Stats

**Files:**
- Modify:
  - `app/src/modules/stats/types.ts`
  - `app/src/modules/stats/step-metrics.module.ts`
  - `app/src/modules/stats/sections/step-result.module.ts`
  - `app/src/lib/stats/replay-fold.ts`
  - `app/src/lib/stats/replay-presenters.ts`
- Test:
  - `app/tests/modules/stats/step-metrics.module.test.ts`
  - `app/tests/modules/stats/sections/step-result.module.test.ts`
  - `app/tests/lib/stats/replay-step-games.ts`
  - `app/tests/lib/stats/replay-fold-steps.test.ts`
  - `app/tests/lib/stats/replay-presenters-steps.test.ts`
  - `app/tests/integration/fixtures/stats-routine.ts`
  - `app/tests/integration/statistics-sql.itest.ts`

**Interfaces:**
- Produces:
  - `STEP_METRIC_SPECS.SWITCHBLADE = { metrics: { points: "sum", darts: "sum", hits: "sum" }, headline: "points", direction: "higher", rates: [["hits", "darts"]] }`.
  - `stepMetrics("SWITCHBLADE", state, facts)` → `{ points: state.total, darts: state.dartsThrown, hits: state.hits }`.

- [ ] **Step 1: Write the failing tests**
  - **`step-metrics.module.test.ts`:** append a fixture.
    - `switchblade = switchbladeEngineFactory.create({})`, played with `T20, S20, MISS, T20` using the file's `dart` helper.
    - Expected `{ points: 140, darts: 4, hits: 3 }`.
  - **`replay-step-games.ts`:** append to `EXERCISE_FIXTURES`:
    ```ts
      SWITCHBLADE: {
        rulesetKey: "SWITCHBLADE_V1",
        factory: switchbladeEngineFactory,
        config: {},
        darts: [
          dart(20, "TREBLE"),
          dart(20, "SINGLE"),
          dart(null, "MISS"),
          dart(20, "TREBLE"),
        ],
      },
    ```
  - **`replay-fold-steps.test.ts`:** append a case modelled on the HIT_COUNT one. Use `playExerciseKind("SWITCHBLADE")`; expect `finalState` `total` 140 and a replayed turn count of 2.
  - **`step-result.module.test.ts`:** append a case modelled on the HIT_COUNT one, with:
    - session `"sb"`;
    - `exerciseRulesetVersionKey: "SWITCHBLADE_V1"`;
    - configuration `{}`;
    - darts `(1, 20, "TREBLE", 60)` and `(1, 20, "SINGLE", 20)`.
    - Expect `foldStepResult("SWITCHBLADE", rows).metrics` to be `{ points: 80, darts: 2, hits: 2 }`.
    - Intended target and zone must be stamped as the engine would: `20`/`TREBLE`. Copy the helper the Hit Count case uses.
  - **`replay-presenters-steps.test.ts`:** append a "covers SwitchBlade" case modelled on "covers Hit Count".
  - **`integration/fixtures/stats-routine.ts`:** append `exerciseStep(13, "SWITCHBLADE", {})` after the Hit Count step, and update the JSDoc above `ROUTINE_STEPS` to end "…then Hit Count, then SwitchBlade".
  - **`statistics-sql.itest.ts`:** change `toHaveLength(12)` to `toHaveLength(13)`. Ledger it as `Ruling: stepKinds length 12 → 13 — the assertion is "one step per kind", same guarantee — cost if wrong: none`.

- [ ] **Step 2: Run** `npm test -- tests/modules/stats tests/lib/stats`
Expected: FAIL, because `"SWITCHBLADE"` is not a `DartExerciseKind`.

- [ ] **Step 3: Implement**
  - **`types.ts`:** add `| "SWITCHBLADE"` to `DartExerciseKind`, and bump the JSDoc kind count by one.
  - **`step-metrics.module.ts`:** add the spec above, and:
    ```ts
        case "SWITCHBLADE":
          return {
            points: numberField(state, "total", kind),
            darts: numberField(state, "dartsThrown", kind),
            hits: numberField(state, "hits", kind),
          };
    ```
  - **`step-result.module.ts` and `replay-fold.ts`:** add `import "@modules/training/exercises/switchblade.engine.module";` in sorted position.
  - **`replay-presenters.ts`:** add `SWITCHBLADE: "darts",` in `DARTS_METRIC_KEY`.

- [ ] **Step 4: Run** `npm test -- tests/modules/stats tests/lib/stats`. Expected: PASS.

Then run the integration suite against local Postgres (migrated and seeded through `0039`): `npm run test:integration`. Expected: all pass, and the sweep finds the SWITCHBLADE step.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/stats app/src/lib/stats app/tests/modules/stats app/tests/lib/stats app/tests/integration
git commit -m "feat(switchblade): step metrics, step result and replay"
```

---

### Task 7: Routine summary, step adapter

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`
- Create: `app/src/lib/training/routines/adapters/switchblade.adapter.ts`
- Modify: `app/src/lib/training/routines/adapters/types.ts`, `adapters/step-adapter.registry.ts`, `app/src/lib/training/routines/types.ts` (slot), `routine-play.data.ts` (initial `switchbladeEngine: null` only)
- Test: `app/tests/modules/training/routines/routine-summary-engines.module.test.ts`, `app/tests/lib/training/routines/adapters/switchblade.adapter.test.ts`, `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`

**Interfaces:**
- Produces:
  - `summariseSwitchblade(state: SwitchbladeState): RoutineStepSummary`.
  - `switchbladeAdapter`: key `"SWITCHBLADE"`, headerLabel and title `"SwitchBlade"`, panel `"switchblade"`.
  - `StepAdapterKey` gains `| "SWITCHBLADE"`; `StepPanel` gains `| "switchblade"`.
  - `RoutinePlayContext.switchbladeEngine: SwitchbladeEngine | null`.

- [ ] **Step 1: Write the failing tests**

Summary (append):
```ts
  it("summariseSwitchblade reads total, round totals, passes, darts and rate", () => {
    const engine = switchbladeEngineFactory.create({});
    [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
      dart(20, "TREBLE"),
      dart(null, "MISS"),
      dart(19, "TREBLE"),
    ].forEach((d) => engine.record(d));

    expect(summariseSwitchblade(engine.state())).toEqual({
      stepKey: "SWITCHBLADE",
      label: "SwitchBlade",
      rows: [
        { label: "Total", value: "197" },
        { label: "Round 1", value: "80" },
        { label: "Round 2", value: "117" },
        { label: "Round 3", value: "0" },
        { label: "Round 4", value: "0" },
        { label: "Round 5", value: "0" },
        { label: "Passes", value: "0" },
        { label: "Darts", value: "6" },
        { label: "Hit rate", value: "66.67%" },
      ],
    });
  });

  it("summariseSwitchblade shows no rate before a dart", () => {
    const engine = switchbladeEngineFactory.create({});
    expect(summariseSwitchblade(engine.state()).rows.at(-1)).toEqual({
      label: "Hit rate",
      value: "—",
    });
  });
```

`switchblade.adapter.test.ts`: copy `hit-count.adapter.test.ts`, then:
- use slot `switchbladeEngine`, `exerciseTypeKey: "SWITCHBLADE"` and `configuration: {}`;
- assert key `"SWITCHBLADE"`, headerLabel and title `"SwitchBlade"`, panel `"switchblade"`;
- `open()` builds a `SwitchbladeEngine`;
- `summarise()` returns stepKey `"SWITCHBLADE"`;
- `close()` nulls the slot.

`step-adapter.registry.test.ts`:
- Append an `it` asserting `resolveStepAdapter("SWITCHBLADE")?.title` is `"SwitchBlade"` and `STEP_ADAPTERS.SWITCHBLADE` is `switchbladeAdapter`.
- Add `"SWITCHBLADE"` to the exhaustive key list, and `"SWITCHBLADE": "SwitchBlade"` to the inline title snapshot.
- Ledger `Ruling: step-adapter registry exhaustive lists gain SWITCHBLADE — "one adapter per kind", same guarantee — cost if wrong: none`.

- [ ] **Step 2: Run** `npm test -- tests/modules/training/routines tests/lib/training/routines/adapters`
Expected: FAIL, because `summariseSwitchblade` and the adapter are missing.

- [ ] **Step 3: Implement**

`routine-summary.module.ts`:
```ts
/**
 * SwitchBlade's result is its total, then each round's points summed over
 * every pass, then passes, darts and hit rate.
 */
export function summariseSwitchblade(
  state: SwitchbladeState,
): RoutineStepSummary {
  const { points, darts, hits } = stepMetrics("SWITCHBLADE", state, NO_FACTS);
  return {
    stepKey: "SWITCHBLADE",
    label: "SwitchBlade",
    rows: [
      { label: "Total", value: String(points) },
      ...state.roundTotals.map((total, index) => ({
        label: `Round ${index + 1}`,
        value: String(total),
      })),
      { label: "Passes", value: String(state.passes) },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}
```

`switchblade.adapter.ts`:
```ts
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import { summariseSwitchblade } from "@modules/training/routines/routine-summary.module";
import type { SwitchbladeConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const switchbladeAdapter: StepAdapter = {
  key: "SWITCHBLADE",
  headerLabel: "SwitchBlade",
  title: "SwitchBlade",
  panel: "switchblade",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("SWITCHBLADE_V1");
    const created = factory?.create(
      result.configuration as SwitchbladeConfigData,
    );
    ctx.switchbladeEngine =
      created instanceof SwitchbladeEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.switchbladeEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.switchbladeEngine) return null;
    return summariseSwitchblade(ctx.switchbladeEngine.state());
  },
  close(ctx) {
    ctx.switchbladeEngine = null;
  },
};
```
Then:
- `adapters/types.ts`: add `| "SWITCHBLADE"` and `| "switchblade"`.
- Registry: import the adapter and add `SWITCHBLADE: switchbladeAdapter,`.
- `routines/types.ts`: add `switchbladeEngine: SwitchbladeEngine | null;` after `hitCountEngine`.
- `routine-play.data.ts`: add `switchbladeEngine: null,` after `hitCountEngine: null,`.

- [ ] **Step 4: Run** the Step 2 command, then `npm run check`. Expected: PASS, with 0 type errors.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/training/routines/routine-summary.module.ts app/src/lib/training/routines app/tests/modules/training/routines app/tests/lib/training/routines/adapters
git commit -m "feat(switchblade): routine summary and step adapter"
```

---

### Task 8: Play surface

**Files:**
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `app/src/lib/training/routines/types.ts`, `app/src/lib/training/routines/exercise-preview.ts`
- Create: `app/src/components/layout/training/exercises/SwitchbladePanel.astro`
- Modify: `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/routine-play.data.test.ts`, `app/tests/lib/training/routines/exercise-preview.test.ts`

**Interfaces:**
- Consumes:
  - the `switchbladeEngine` slot (Task 7);
  - `SwitchbladeState`;
  - `switchbladeRoundSlots` and `boardTargetLabel`.
- Produces on `RoutinePlayContext`:
  - `recordSwitchbladeDart(observation)`;
  - `switchbladeTotal(): number`;
  - `switchbladeSlotLabel(): string`;
  - `switchbladeRound(): number`;
  - `switchbladePasses(): number`.
- Produces the preview family `"switchblade"`.

- [ ] **Step 1: Write the failing tests**

`exercise-preview.test.ts`:
- Add `switchbladeEngine: null` to `none`. The type forces it; ledger `Ruling: preview test's none fixture gains the new slot — same "no engine open" guarantee`.
- Append:
```ts
describe("SwitchBlade preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
    intendedZoneKey: DartZoneKey,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey,
    }) as DartFact;

  it("maps the open SwitchBlade engine to its family", () => {
    expect(
      exerciseFamily({ ...none, switchbladeEngine: {} as never }),
    ).toBe("switchblade");
  });

  it("judges a hit on the slot's number in any ring, either bull on 25", () => {
    expect(judgeDart("switchblade", aimed(20, "SINGLE", 20, "TREBLE"))).toBe("hit");
    expect(judgeDart("switchblade", aimed(19, "TREBLE", 20, "TREBLE"))).toBe("miss");
    expect(judgeDart("switchblade", aimed(25, "OUTER_BULL", 25, "INNER_BULL"))).toBe("hit");
  });

  it("captions the round's three slots, wrapping every five rounds", () => {
    const input = (visitIndex: number) => ({
      config: {},
      visitIndex,
      currentTargetNumber: undefined,
      targetIndex: 0,
      dartsInOpenVisit: 0,
    });
    expect(visitLabelsFor("switchblade", input(1))).toEqual(["T20", "T20", "T19"]);
    expect(visitLabelsFor("switchblade", input(4))).toEqual(["T20", "T20", "BULL"]);
    expect(visitLabelsFor("switchblade", input(5))).toEqual(["T20", "T20", "T20"]);
  });
});
```

`routine-play.data.test.ts`:
- Append `describe("routinePlay — SwitchBlade", …)` (no engine before start). Then `SWITCHBLADE_STEP`, copied from `HIT_COUNT_STEP` with keys `SWITCHBLADE`/`SWITCHBLADE_V1` and `configuration: {}`.
- Then `describe("routinePlay — SwitchBlade play", …)`, copied from the Hit Count play block's setup, with these cases:
  - **start:** `switchbladeEngine` is not null; `switchbladeTotal()` 0; `switchbladeSlotLabel()` `"T20"`; `switchbladeRound()` 1; `switchbladePasses()` 0.
  - **readouts:** after `T20, S20, MISS, T20, MISS`: total 140; round 2; slot label `"T19"`.
  - **preview:** after `T20, S20, MISS, T20, MISS`, `previewSegments()` equals `[{ status: "hit", label: "T20" }, { status: "miss" }, { status: "empty", label: "T19" }]`.
  - **routes a committed board dart:** `boardCommit.onCommit!(T20)` → `switchbladeEngine!.state().dartsThrown` 1.
  - **never completes on a dart:** after 60 darts, `appendBatch` is not called and `isComplete()` is false.
  - **deadline expires and uploads:** `advanceTimersByTimeAsync(600_000)` → `appendBatch` called; `stepSummaries[0]` matches `{ stepKey: "SWITCHBLADE" }`.
- In the `board dispatch` `it.each`, add `["SWITCHBLADE", "switchbladeEngine"],` after the HIT_COUNT row. Ledger `Ruling: board-dispatch table gains SWITCHBLADE — same "every slot routes" guarantee`.

- [ ] **Step 2: Run** `npm test -- tests/lib/training/routines/routine-play.data.test.ts tests/lib/training/routines/exercise-preview.test.ts`
Expected: FAIL, because the methods and family are missing.

- [ ] **Step 3: Implement**

`routines/types.ts`:
- `| "switchblade"` in `ExercisePreviewFamily`;
- `| "switchbladeEngine"` in `ExerciseEngineSlots`;
- `| SwitchbladeEngine` in `activeDartEngine`'s return type;
- signatures for `recordSwitchbladeDart` and the four readouts.

`exercise-preview.ts`:
- Import `boardTargetLabel` and `switchbladeRoundSlots`, then add:
```ts
function switchbladeCaptions(input: VisitLabelInput): Captions {
  return switchbladeRoundSlots(input.visitIndex).map(boardTargetLabel);
}
```
- Add `["switchbladeEngine", "switchblade"]` to `ENGINE_FAMILIES`, `switchblade: judgeOnTarget` to `JUDGES`, and `switchblade: switchbladeCaptions` to `CAPTIONS`.
- Extend `judgeDart`'s JSDoc: "SwitchBlade judges on the number, any ring."

`routine-play.data.ts`:
- Import `type SwitchbladeEngine`.
- Add a `["switchbladeEngine", "recordSwitchbladeDart"],` row after the Hit Count row in `DART_ENGINE_RECORDERS`.
- Add `| SwitchbladeEngine` to `activeDartEngine`'s return type.
- Add `this.switchbladeEngine?.expireTimer();` to `startStepTimer` `onComplete`.
- Add the methods:
```ts
    /** SwitchBlade never ends on a dart; only the step deadline completes it. */
    recordSwitchbladeDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.switchbladeEngine) return;
      this.switchbladeEngine.record(observation);
    },

    switchbladeTotal(this: RoutinePlayContext): number {
      return this.switchbladeEngine?.state().total ?? 0;
    },

    switchbladeSlotLabel(this: RoutinePlayContext): string {
      const slot = this.switchbladeEngine?.state().currentSlot;
      return slot === undefined ? "" : boardTargetLabel(slot);
    },

    switchbladeRound(this: RoutinePlayContext): number {
      return this.switchbladeEngine?.state().round ?? 1;
    },

    switchbladePasses(this: RoutinePlayContext): number {
      return this.switchbladeEngine?.state().passes ?? 0;
    },
```

`SwitchbladePanel.astro`:
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="switchbladeTotal()"
  caption="TOTAL"
  tiles={[
    { label: "Target", value: "switchbladeSlotLabel()" },
    { label: "Round", value: "switchbladeRound()" },
    { label: "Pass", value: "switchbladePasses() + 1" },
  ]}
/>
```
In `play/index.astro`, import `SwitchbladePanel` beside `HitCountPanel` and mount it after the Hit Count block:
```astro
        <template x-if="adapter?.panel === 'switchblade' && switchbladeEngine">
          <SwitchbladePanel />
        </template>
```

- [ ] **Step 4: Run** the Step 2 command, then the full suite (`npm test`) and `npm run check`. Expected: all PASS, 0/0/0.

- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/routines app/src/components/layout/training/exercises/SwitchbladePanel.astro app/src/pages/training/routines/play/index.astro app/tests/lib/training/routines
git commit -m "feat(switchblade): routine play surface and panel"
```

---

### Task 9: Docs

**Files:**
- Modify:
  - `docs/architecture/04-Architecture-patterns.md`
  - `docs/architecture/09-Training/01-Routines.md`
  - `docs/architecture/10-Statistics/01-Section-Catalog.md`
  - `docs/architecture/07-Frontend/08-Component-Inventory.md`
  - `docs/architecture/00-File-Inventory.md`
  - `docs/architecture/00-Context-Map-History.md`
  - `app/src/modules/training/CLAUDE.md`
  - `docs/game-rules/training/exercises/switchblade.md`
  - `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (refinements, if not already folded in on approval)

- [ ] **Step 1: Canonical docs.** Use minimal diffs and ISO dates `2026-10-18`.
  - **Pattern 18 version:** prepend `1.11.9 (Pattern 18: SwitchBlade bound through \`trackExerciseSpec\`; per-dart intent changes mid-visit 2026-10-18; prior 1.11.8: …)`, keeping the chain. The TRACK row's tail becomes "Hit Count, SwitchBlade bound through `trackExerciseSpec` (D469)".
  - **Routines §17**, after Hit Count:
    ````markdown
    ## SwitchBlade

    Configuration:

    ```text
    duration: 8m

    path (fixed):
        round 1: T20 T20 T20
        round 2: T20 T20 T19
        round 3: T20 T20 T18
        round 4: T20 T20 T17
        round 5: T20 T20 bullseye
    ```

    One visit per round, each dart at its own slot. A dart on its slot's number scores its board value in any ring; the bull slot takes either bull (25 or 50). After round five the path starts again until the time runs out. Rules: `docs/game-rules/training/exercises/switchblade.md`.

    **Implemented** (`SWITCHBLADE_V1`, `app/src/modules/training/exercises/switchblade.engine.module.ts`, seed `0039`): empty configuration (the path is fixed in V1), bound to the Track kernel through `trackExerciseSpec` (D469) with `anyRingEitherBull`, `boardScorePoints`, `tallyRoundPoints(3)`, `advanceEveryDart` and `passOnWrap(14)`. Each dart carries its slot's number (`25` on the bull slot) and bed (`TREBLE`, `INNER_BULL`) — the aim changes mid-visit; `score` is the board score. One turn per round. State carries the total, per-round totals summed over every pass, passes, hits, darts and the current slot. Time-bound only. Capture pair and upload path match Target Scoring (D277). Routine step only in V1 (2026-10-18).
    ````
  - **Section catalog:** add `| SWITCHBLADE | points, darts, hits (sum) | points ↑ | hits/darts |` after HIT_COUNT.
  - **Component inventory:** add `| \`SwitchbladePanel.astro\` | SwitchBlade play surface (2026-10-18): \`switchbladeTotal()\` TOTAL with Target / Round / Pass tiles — a call to \`ExercisePanelShell\` | none (reads the routine play page scope) |` after HitCountPanel.
  - **File Inventory:**
    - Add rows for the seed, the verification script, the engine and the validator, mirroring the Hit Count rows' wording and place.
    - Add `switchblade.adapter.ts` to the adapters row.
    - Add `advanceEveryDart`, `tallyRoundPoints` (SwitchBlade, 2026-10-18) to the `track-policies.ts` row.
  - **Context-Map History:** add one row listing the changed files and "SwitchBlade V1 shipped on the Track kernel through `trackExerciseSpec`; policies `advanceEveryDart`, `tallyRoundPoints`; preview family `switchblade`; seed `0039`. Track T1.2 (2026-10-18)".
  - **`modules/training/CLAUDE.md`:** add `switchblade` to the engine file list, and "(Hit Count, SwitchBlade)" where Hit Count is named as a `trackExerciseSpec` user.
  - **Rules file:**
    - `Current version: V1 (shipped 2026-10-18)`. Use the actual merge-ready date.
    - Replace the Exercise type's "Type constant: `PATH_SCORING` (proposed; …)" bullet with "Type constant: `SWITCHBLADE` (seed `0039`)."
    - Leave the open question on 882 vs 872. The engine test proves a perfect pass is 872, so add one line under it: "The V1 engine's perfect pass totals 872 (`switchblade.engine.module.test.ts`)."
  - **Spec:** fold in the refinements listed at the top of this plan (§3 SwitchBlade row, §4 readouts) if not done at approval.

- [ ] **Step 2: Run** `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-game-rules.sh && bash scripts/check-doc-sync.sh && bash scripts/check-decision-ids.sh`
Expected: all OK.

- [ ] **Step 3: Commit**
```bash
git add docs app/src/modules/training/CLAUDE.md
git commit -m "docs(switchblade): routines, stats catalog, inventories, rules V1"
```

---

### Task 10: Gates

- [ ] **Step 1:** `cd app && npm run format && npm run format:check`. Commit any formatting diff as `style: format`.
- [ ] **Step 2:** `cd app && npm run validate:app`, with a temporary `app/.env` that you delete afterwards. Expected: exit 0, type gate 0/0/0, fallow clean.
  - If fallow flags `routine-play.data.ts` (CRAP or complexity), fix it at the cause within this task, and ledger the ruling.
- [ ] **Step 3:** Run every script in the `run-all-gates` skill's "Always run" and "app/ changed" lists, plus `bash scripts/test-check-engine-kernels.sh` and `bash scripts/check-engine-kernels.sh`. Expected: all OK. Record each result for the PR body.
- [ ] **Step 4:** `bash scripts/next-decision-id.sh`. Expected: `D470`; this PR adds no decision.
