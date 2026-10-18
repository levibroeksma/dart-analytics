# Track T1.3 — Doubles Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Doubles Lock V1 as a playable routine-step exercise bound to the Track kernel through `trackExerciseSpec`, end to end (engine, seed, validator, routine wiring, stats, docs).

**Architecture:** The path is `doublesPath` D20→D1 (20 targets, no bull). A dart hits only in the double (`isHitOn`) and scores no kernel points (`noPoints`). Everything happens at visit close:
- engine-local `tallyPassDarts` adds the visit's darts to the pass;
- the new policy `lockCheckpoint(bonus)` locks, advances or retreats;
- engine-local `closePass` composes `passOnWrap(19)` with its own reset of `lastLock`, `dartsPerPass` and `dartsThisPass`.

The bonus lives in the kernel `score`. Wiring mirrors SwitchBlade (T1.2, PR #997) file by file.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (T1.3). Rules: `docs/game-rules/training/exercises/doubles-lock.md`. Model plan: `docs/superpowers/plans/2026-10-18-track-t1-switchblade.md`.

## Global Constraints

- **Branch:** `feat/track-t1-doubles-lock` (from `origin/main`). Never merge to `main`; never use `--no-verify`.
- **TDD** per `app/CLAUDE.md` §TDD: write the failing test first and watch it fail, then write the code. Run commands from `app/` with `npm test -- <path>`.
- **Comments:** no `//` or `/* */` comments inside function bodies. JSDoc above declarations only, with no decision history in prose.
- **Quality gates:**
  - fallow complexity ≤ 15 and CRAP ≤ 30.
  - `npm run validate:app` exits 0 with the type gate at 0/0/0.
  - `validate:app`'s `db:drift` needs `app/.env`; create it temporarily with `DATABASE_URL=postgres://postgres@localhost:5433/integration?sslmode=disable`, then delete it.
- **Type-check after each code task.** Run `npm run check` at the end of Tasks 1–8 (T1.2 caught a path type error only after its engine task).
- **Existing tests and snapshots are append-only.** An assertion that lists every kind may gain the new kind, by a ledgered ruling, and only when the guarantee stays the same.
- **Migrations:** never modify `0001`–`0046`. This PR has no schema change.
- **Seed:** number `0040` (the highest on `main` is `0039`). Seed ids (none in use on `main`):
  - type `0199a000-0000-7000-8000-00000000000e`
  - ruleset `0199a100-0000-7000-8000-00000000000d`
  - template `0199b000-0000-7000-8000-000000000014`
- **No decision entry.** Spec §8 puts the wave's only decision in T1.1 (D469). Re-run `bash scripts/next-decision-id.sh` before the PR anyway; it should print `D470`.
- **Discovered work** goes to a GitHub issue labelled `discovered-work`; never fix it here.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- **Before the PR:** `cd app && npm run format && npm run format:check`.
- **Naming:**
  - code: `DoublesLock` / `doublesLock` / `DOUBLES_LOCK`; files `doubles-lock.*`;
  - display label: `Doubles Lock`;
  - panel: `"doubles-lock"`; preview family: `"doublesLock"`.

## Spec refinements (write back into the spec on approval)

1. **Type key.** `DOUBLES_LOCK` (ruleset `DOUBLES_LOCK_V1`), not the rules file's proposed `LOCK_LADDER`. Each subject is its own type and is keyed by name, as Hit Count and SwitchBlade are.
2. **Config.** The empty strict object, `{}`. The rules file locks path, lock threshold and bonus ("Shown, locked"), and duration is the routine step's. Path and bonus are engine constants: `DOUBLES_LOCK_PATH` and `DOUBLES_LOCK_BONUS = { 2: 50, 3: 100 }`.
3. **Lock rule.** `lockCheckpoint(bonus)` locks a visit when the bonus table names its hit count. With `{ 2: 50, 3: 100 }` this is exactly spec §2.3's "hits ≥ 2". The V2 Strict Lock variant then becomes `{ 3: 100 }`, with no new policy.
   - `LockBonus = Readonly<Partial<Record<number, number>>>`.
   - `LockTrackExt = { lastLock: number | null; locks: number }`, where `lastLock` is a path index.
4. **Pass bookkeeping.**
   - The ext gains `dartsThisPass`. Engine-local `tallyPassDarts` adds `seat.dartsThisVisit` to it at visit close, so §3's onDart stays "—". The kernel resets visit counters only after `onVisitClose` (`track-kernel.module.ts:60`).
   - The projection's `dartsThisPass` adds the open visit's `seat.dartsThisVisit`.
   - Engine-local `closePass(lastIndex)` runs `passOnWrap`. Past the end it also:
     - appends `dartsThisPass` to `dartsPerPass`;
     - zeroes `dartsThisPass`;
     - clears `lastLock`.
   - It stays engine-local: it is Doubles Lock's own composition (§2.3), not a shared policy.
   - onVisitClose is `closePass(19) ∘ lockCheckpoint(DOUBLES_LOCK_BONUS) ∘ tallyPassDarts`.
5. **Readouts.** Two fields are `BoardTarget`s, not numbers: `currentDouble`, and `lastLock` (`BoardTarget | null`). This lets `boardTargetLabel` and the golden helper reuse them.
   - The state adds `targetIndex`, `dartsPerPass`, `hits`, `dartsThrown` and `status`.
   - `hits` counts darts in the `DOUBLE` bed of their intended number, from facts. That is the kernel's `isHitOn` verdict for this path.
   - `bestPassDarts` is the fewest darts of any completed pass, or `null` before one.
6. **Step metrics.** `{ bonus: "sum", locks: "sum", darts: "sum", hits: "sum" }`, headline `bonus`, direction `higher`, rate `hits/darts`.
   - `bestPassDarts` is shown in the summary only. Step metrics aggregate by `sum` or `max`; a fewest-darts metric would need a new `min` aggregation, which is out of scope.
7. **Preview family.** `doublesLock`:
   - it judges with `judgeDouble`;
   - its captions are the current double ×3, from `currentTargetLabel`. That is Hit Count's caption rule (`hitCountCaptions`), since the target only moves at visit close.
   - `exerciseVisitLabels` feeds `currentTargetLabel` from `hitCountTargetLabel() || doublesLockTargetLabel()`.
8. **Golden observer.** `aimedOnCurrentBoardTarget(rate, field, ring = anyRing)` takes a third parameter, the ring picker. Doubles Lock aims at `"DOUBLE"`, so locks, retreats and a pass wrap all occur in the trace. Existing callers pass two arguments, so their snapshots do not change.
9. **Integration fixture.** The routine-stats integration fixture gains Doubles Lock as step 14, after SwitchBlade. `statistics-sql.itest.ts`'s `toHaveLength(13)` becomes 14 by ruling: one step per kind, same guarantee.

## Review Focus

1. **Retreat before any lock** goes to D20 (index 0), and after a pass wrap a blank visit ignores the previous pass's lock. Pinned in Task 1 (`retreats to the first target before any lock`) and Task 3 (`a pass clears the last lock`).
2. **Re-lock bonus.** Re-locking a double after a retreat pays its bonus again and counts a second lock. Pinned in Task 3 (`re-locking after a retreat pays again`).
3. **Lock on D1.** A lock on the last double pays, then wraps: `passes` 1, `lastLock` null, and the pass's darts are recorded. Pinned in Task 3 (`a lock on D1 pays then wraps`).
4. **Undo across the wrap.** Undoing the first dart of pass 2 restores the end of pass 1, `dartsPerPass` included. Pinned in Task 3 (`undo across a pass wrap`).
5. **`bestPassDarts` is the minimum, not the first.** With a slow pass then a fast one, it reads the fast one. Pinned in Task 3 (`best pass is the fewest darts`).

---

### Task 1: Policy `lockCheckpoint`

**Files:**
- Modify: `app/src/modules/game/types.ts` (after `SwitchbladeTrackExt`)
- Modify: `app/src/modules/game/track-policies.ts`
- Test: `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LockBonus = Readonly<Partial<Record<number, number>>>;
  export type LockTrackExt = { lastLock: number | null; locks: number };
  export type DoublesLockTrackExt = LockTrackExt & PassTrackExt & {
    dartsThisPass: number;
    dartsPerPass: number[];
  };
  lockCheckpoint<TExt extends LockTrackExt>(bonus: LockBonus): (seat: TrackSeat<TExt>) => TrackSeat<TExt> // onVisitClose
  ```

- [ ] **Step 1: Write the failing tests.** Append them, and add `lockCheckpoint` and `LockTrackExt` to the imports.

```ts
describe("lockCheckpoint", () => {
  const BONUS = { 2: 50, 3: 100 };
  const seatAt = (
    targetIndex: number,
    hitsThisVisit: number,
    lastLock: number | null = null,
  ): TrackSeat<LockTrackExt> => ({
    ...initialTrackSeat(SEAT, { lastLock, locks: 0 }),
    targetIndex,
    hitsThisVisit,
    dartsThisVisit: 3,
  });

  it("locks on three hits: +100, advance, remember the index", () => {
    const seat = lockCheckpoint<LockTrackExt>(BONUS)(seatAt(4, 3));
    expect(seat.score).toBe(100);
    expect(seat.targetIndex).toBe(5);
    expect(seat.ext).toEqual({ lastLock: 4, locks: 1 });
  });

  it("locks on two hits: +50", () => {
    const seat = lockCheckpoint<LockTrackExt>(BONUS)(seatAt(4, 2, 1));
    expect(seat.score).toBe(50);
    expect(seat.targetIndex).toBe(5);
    expect(seat.ext).toEqual({ lastLock: 4, locks: 1 });
  });

  it("advances on one hit without a lock or bonus", () => {
    const seat = lockCheckpoint<LockTrackExt>(BONUS)(seatAt(4, 1, 2));
    expect(seat.score).toBe(0);
    expect(seat.targetIndex).toBe(5);
    expect(seat.ext).toEqual({ lastLock: 2, locks: 0 });
  });

  it("retreats to the first target before any lock", () => {
    expect(lockCheckpoint<LockTrackExt>(BONUS)(seatAt(6, 0)).targetIndex).toBe(
      0,
    );
  });

  it("retreats to the last locked index on a blank visit", () => {
    const seat = lockCheckpoint<LockTrackExt>(BONUS)(seatAt(7, 0, 3));
    expect(seat.targetIndex).toBe(3);
    expect(seat.score).toBe(0);
    expect(seat.ext).toEqual({ lastLock: 3, locks: 0 });
  });

  it("locks only on a hit count the table names", () => {
    const strict = lockCheckpoint<LockTrackExt>({ 3: 100 });
    const two = strict(seatAt(4, 2));
    expect(two.targetIndex).toBe(5);
    expect(two.score).toBe(0);
    expect(two.ext.locks).toBe(0);
    expect(strict(seatAt(4, 3)).ext.locks).toBe(1);
  });

  it("never mutates the seat it was given", () => {
    const before = seatAt(4, 3);
    lockCheckpoint<LockTrackExt>(BONUS)(before);
    expect(before.ext).toEqual({ lastLock: null, locks: 0 });
    expect(before.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/game/track-policies.test.ts`
Expected: FAIL, because `lockCheckpoint` is not exported.

- [ ] **Step 3: Implement**

In `types.ts` (after `SwitchbladeTrackExt`):
```ts
/** A visit-close bonus table: the bonus a visit's hit count earns; a count it does not name earns no lock. */
export type LockBonus = Readonly<Partial<Record<number, number>>>;

/** A Track seat's checkpoint: the path index of its last lock, and how many locks it made. */
export type LockTrackExt = {
  lastLock: number | null;
  locks: number;
};

/** Doubles Lock's Track extras: the checkpoint, passes, and darts per pass. */
export type DoublesLockTrackExt = LockTrackExt &
  PassTrackExt & {
    dartsThisPass: number;
    dartsPerPass: number[];
  };
```

In `track-policies.ts`, import `LockBonus` and `LockTrackExt`, then append:
```ts
/**
 * Visit-close policy: a hit count `bonus` names locks the target — its
 * bonus to the score, the index kept as `ext.lastLock` — and advances; any
 * other hit advances; a blank visit retreats to the last lock, or the first
 * target before one.
 */
export function lockCheckpoint<TExt extends LockTrackExt>(
  bonus: LockBonus,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) => {
    const award = bonus[seat.hitsThisVisit];
    if (award !== undefined)
      return {
        ...seat,
        score: seat.score + award,
        targetIndex: seat.targetIndex + 1,
        ext: {
          ...seat.ext,
          lastLock: seat.targetIndex,
          locks: seat.ext.locks + 1,
        },
      };
    if (seat.hitsThisVisit > 0)
      return { ...seat, targetIndex: seat.targetIndex + 1 };
    return { ...seat, targetIndex: seat.ext.lastLock ?? 0 };
  };
}
```

- [ ] **Step 4: Run** the Step 2 command. Expected: PASS. Then run `npm run check`. Expected: 0 errors.

- [ ] **Step 5: Mutation checks.** Ledger each result for the PR body, and revert after each.
  - (a) `seat.ext.lastLock ?? 0` → `seat.ext.lastLock ?? seat.targetIndex`. Expected: `retreats to the first target…` fails.
  - (b) `lastLock: seat.targetIndex` → `lastLock: seat.targetIndex + 1`. Expected: a lock test fails.
  - (c) `seat.hitsThisVisit > 0` → `seat.hitsThisVisit >= 0`. Expected: a retreat test fails.

- [ ] **Step 6: Commit**
```bash
git add app/src/modules/game/types.ts app/src/modules/game/track-policies.ts app/tests/modules/game/track-policies.test.ts
git commit -m "feat(track): lockCheckpoint policy"
```

---

### Task 2: `DOUBLES_LOCK_V1` key and config

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces:
  - `ExerciseRulesetVersionKey` gains `"DOUBLES_LOCK_V1"`.
  - `DoublesLockV1Config = z.object({}).strict()`.
  - `DoublesLockConfigData`.
  - `EXERCISE_RULESET_CONFIGS.DOUBLES_LOCK_V1`.

- [ ] **Step 1: Write the failing tests.** Append them, and import `DoublesLockV1Config`.

```ts
describe("DoublesLockV1Config", () => {
  it("accepts the empty config — path and bonus are fixed", () => {
    expect(DoublesLockV1Config.safeParse({}).success).toBe(true);
  });

  it("rejects any key", () => {
    expect(DoublesLockV1Config.safeParse({ lockHits: 3 }).success).toBe(false);
    expect(DoublesLockV1Config.safeParse({ path: [] }).success).toBe(false);
  });

  it("is registered under DOUBLES_LOCK_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.DOUBLES_LOCK_V1).toBe(DoublesLockV1Config);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`
Expected: FAIL, because `DoublesLockV1Config` is not exported.

- [ ] **Step 3: Implement.** Add `| "DOUBLES_LOCK_V1"` to the key union, then append after `SwitchbladeConfigData`:

```ts
/**
 * Doubles Lock v1: D20 down to D1; two or three hits lock the double for a
 * 50 or 100 bonus, a blank visit retreats to the last lock
 * (`docs/game-rules/training/exercises/doubles-lock.md`). Path, threshold
 * and bonus are locked and duration is the routine step's, so the config
 * is the empty object.
 */
export const DoublesLockV1Config = z.object({}).strict();

export type DoublesLockConfigData = z.infer<typeof DoublesLockV1Config>;
```
Then add `DOUBLES_LOCK_V1: DoublesLockV1Config,` to `EXERCISE_RULESET_CONFIGS`.

- [ ] **Step 4: Run** the file. Expected: PASS.

Then run `npm run check`.
- Expected: a type error only in `services/exercise-rulesets/registry.ts`'s `Record` (Task 4 fills it).
- If one appears, add the Task 4 registry entry now and ledger a ruling, so every commit type-checks. (T1.2 needed none; check anyway.)

- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/exercises/rulesets/types.ts app/tests/lib/training/exercises/rulesets/types.test.ts
git commit -m "feat(doubles-lock): DOUBLES_LOCK_V1 ruleset key and config"
```

---

### Task 3: Doubles Lock engine, kernel row, golden

**Files:**
- Modify: `app/src/modules/training/exercises/types.ts` (add `DoublesLockState` after `SwitchbladeState`)
- Create: `app/src/modules/training/exercises/doubles-lock.engine.module.ts`
- Modify: `scripts/engine-kernels.txt`
- Modify: `app/tests/modules/game/support/aimed-observations.ts` (`ring` parameter)
- Test: `app/tests/modules/training/exercises/doubles-lock.engine.module.test.ts`, `app/tests/modules/training/exercises/doubles-lock.aimed.golden.test.ts`

**Interfaces:**
- Consumes:
  - Task 1's `lockCheckpoint` and `DoublesLockTrackExt`;
  - Task 2's config;
  - `trackExerciseSpec`, `isHitOn`, `doublesPath`, `doubleTargetIntent`, `noPoints`, `passOnWrap`, `pathTarget` and `closeAfter`.
- Produces:
  ```ts
  export type DoublesLockState = {
    currentDouble: BoardTarget;        // { kind: "DOUBLE", number: 20..1 }
    targetIndex: number;               // 0–19
    lastLock: BoardTarget | null;      // null before a lock in this pass
    bonus: number;                     // summed over every pass
    locks: number;                     // summed over every pass
    passes: number;
    dartsPerPass: number[];            // completed passes, in order
    bestPassDarts: number | null;      // fewest of dartsPerPass
    dartsThisPass: number;             // open visit included
    hits: number;
    dartsThrown: number;
    status: "IN_PROGRESS" | "COMPLETE";
  };
  export const DOUBLES_LOCK_PATH: readonly BoardTarget[];   // D20..D1
  export const DOUBLES_LOCK_BONUS: LockBonus;               // { 2: 50, 3: 100 }
  export function foldDoublesLockState(facts: EngineFacts, config: DoublesLockConfigData, complete: boolean): DoublesLockState;
  export class DoublesLockEngine;
  export const doublesLockEngineFactory;   // registered under DOUBLES_LOCK_V1
  ```

- [ ] **Step 1: Write the failing engine tests**

```ts
import { describe, expect, it } from "vitest";
import {
  DOUBLES_LOCK_PATH,
  DoublesLockEngine,
  doublesLockEngineFactory,
  foldDoublesLockState,
} from "@modules/training/exercises/doubles-lock.engine.module";
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
const D = (n: number) => dart(n, "DOUBLE");
const double = (number: number) => ({ kind: "DOUBLE", number }) as const;
const times = (n: number, d: DartObservation) =>
  Array.from({ length: n }, () => d);
const LADDER = Array.from({ length: 20 }, (_, i) => 20 - i);
const PERFECT_PASS = LADDER.flatMap((n) => times(3, D(n)));
const SLOW_PASS = [
  ...times(3, MISS),
  ...LADDER.flatMap((n) => [D(n), MISS, MISS]),
];

function play(engine: DoublesLockEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("Doubles Lock engine", () => {
  it("starts on D20 with no lock", () => {
    expect(new DoublesLockEngine({}).state()).toEqual({
      currentDouble: double(20),
      targetIndex: 0,
      lastLock: null,
      bonus: 0,
      locks: 0,
      passes: 0,
      dartsPerPass: [],
      bestPassDarts: null,
      dartsThisPass: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("walks D20 down to D1", () => {
    expect(DOUBLES_LOCK_PATH).toHaveLength(20);
    expect(DOUBLES_LOCK_PATH[0]).toEqual(double(20));
    expect(DOUBLES_LOCK_PATH[19]).toEqual(double(1));
  });

  it("one hit advances without a lock", () => {
    const state = play(new DoublesLockEngine({}), [D(20), MISS, MISS]);
    expect(state.currentDouble).toEqual(double(19));
    expect(state.lastLock).toBeNull();
    expect(state.bonus).toBe(0);
    expect(state.locks).toBe(0);
    expect(state.hits).toBe(1);
  });

  it("two hits lock for 50, three for 100", () => {
    const two = play(new DoublesLockEngine({}), [D(20), D(20), MISS]);
    expect(two.currentDouble).toEqual(double(19));
    expect(two.lastLock).toEqual(double(20));
    expect(two.bonus).toBe(50);
    expect(two.locks).toBe(1);
    const three = play(new DoublesLockEngine({}), times(3, D(20)));
    expect(three.bonus).toBe(100);
    expect(three.locks).toBe(1);
  });

  it("only the double counts", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20),
      MISS,
      MISS,
      dart(19, "TREBLE"),
      dart(19, "SINGLE"),
      D(20),
    ]);
    expect(state.hits).toBe(1);
    expect(state.currentDouble).toEqual(double(20));
  });

  it("retreats to D20 before any lock", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20),
      MISS,
      MISS,
      ...times(3, MISS),
    ]);
    expect(state.currentDouble).toEqual(double(20));
    expect(state.dartsThisPass).toBe(6);
  });

  it("retreats to the last locked double", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20), MISS, MISS,
      D(19), D(19), MISS,
      D(18), MISS, MISS,
      ...times(3, MISS),
    ]);
    expect(state.currentDouble).toEqual(double(19));
    expect(state.lastLock).toEqual(double(19));
    expect(state.bonus).toBe(50);
  });

  it("re-locking after a retreat pays again", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20), MISS, MISS,
      D(19), D(19), MISS,
      D(18), MISS, MISS,
      ...times(3, MISS),
      ...times(3, D(19)),
    ]);
    expect(state.bonus).toBe(150);
    expect(state.locks).toBe(2);
    expect(state.currentDouble).toEqual(double(18));
  });

  it("a perfect pass is 60 darts and 2,000 bonus, then restarts at D20", () => {
    const state = play(new DoublesLockEngine({}), PERFECT_PASS);
    expect(state).toMatchObject({
      currentDouble: double(20),
      targetIndex: 0,
      lastLock: null,
      bonus: 2000,
      locks: 20,
      passes: 1,
      dartsPerPass: [60],
      bestPassDarts: 60,
      dartsThisPass: 0,
      hits: 60,
      dartsThrown: 60,
    });
  });

  it("a lock on D1 pays then wraps", () => {
    const state = play(new DoublesLockEngine({}), [
      ...LADDER.slice(0, 19).flatMap((n) => [D(n), MISS, MISS]),
      D(1),
      D(1),
      MISS,
    ]);
    expect(state.bonus).toBe(50);
    expect(state.locks).toBe(1);
    expect(state.passes).toBe(1);
    expect(state.lastLock).toBeNull();
    expect(state.dartsPerPass).toEqual([60]);
    expect(state.currentDouble).toEqual(double(20));
  });

  it("a pass clears the last lock", () => {
    const state = play(new DoublesLockEngine({}), [
      ...PERFECT_PASS,
      D(20), MISS, MISS,
      ...times(3, MISS),
    ]);
    expect(state.currentDouble).toEqual(double(20));
    expect(state.lastLock).toBeNull();
  });

  it("best pass is the fewest darts", () => {
    const state = play(new DoublesLockEngine({}), [
      ...SLOW_PASS,
      ...PERFECT_PASS,
    ]);
    expect(state.passes).toBe(2);
    expect(state.dartsPerPass).toEqual([63, 60]);
    expect(state.bestPassDarts).toBe(60);
    expect(state.dartsThrown).toBe(123);
    expect(state.hits).toBe(80);
  });

  it("counts the open visit in darts this pass", () => {
    const state = play(new DoublesLockEngine({}), [D(20), MISS]);
    expect(state.dartsThisPass).toBe(2);
    expect(state.currentDouble).toEqual(double(20));
  });

  it("aims every dart at the current double", () => {
    const engine = new DoublesLockEngine({});
    play(engine, [D(20), MISS, MISS, MISS]);
    expect(
      engine.facts().turns.flatMap((turn) =>
        turn.darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey]),
      ),
    ).toEqual([
      [20, "DOUBLE"],
      [20, "DOUBLE"],
      [20, "DOUBLE"],
      [19, "DOUBLE"],
    ]);
  });

  it("writes one turn per three-dart visit", () => {
    const engine = new DoublesLockEngine({});
    play(engine, times(7, MISS));
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 1,
    ]);
  });

  it("undo across a pass wrap restores the end of pass 1", () => {
    const engine = new DoublesLockEngine({});
    const before = play(engine, PERFECT_PASS);
    engine.record(D(20));
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("rehydrates mid-visit after a lock", () => {
    const engine = new DoublesLockEngine({});
    const state = play(engine, [D(20), D(20), MISS, D(19)]);
    const rebuilt = new DoublesLockEngine({}, engine.facts());
    expect(rebuilt.state()).toEqual(state);
    rebuilt.record(D(19));
    expect(rebuilt.facts().turns[1]!.darts[1]).toMatchObject({
      intendedTargetNumber: 19,
      intendedZoneKey: "DOUBLE",
    });
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new DoublesLockEngine({});
    play(engine, PERFECT_PASS);
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a non-empty config", () => {
    expect(() => new DoublesLockEngine({ lockHits: 3 } as never)).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new DoublesLockEngine({});
    const state = play(engine, [D(20), D(20), MISS, D(19), MISS]);
    expect(foldDoublesLockState(engine.facts(), {}, false)).toEqual(state);
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("DOUBLES_LOCK_V1")).toBe(
      doublesLockEngineFactory,
    );
  });

  it("produces an events batch the API accepts", () => {
    const engine = new DoublesLockEngine({});
    play(engine, [D(20), D(20), MISS, D(19)]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/doubles-lock.engine.module.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

In `exercises/types.ts` (after `SwitchbladeState`; add `import type { BoardTarget } from "@modules/game/types";` — the leaf file, not the `@modules/types` barrel that re-exports this one):
```ts
/**
 * Doubles Lock state, derived by replaying `facts()` (`foldDoublesLockState`).
 * `currentDouble`/`targetIndex` locate the next dart; `lastLock` is this
 * pass's checkpoint; `bonus` and `locks` sum over every pass; `dartsPerPass`
 * lists each completed pass's darts, `bestPassDarts` the fewest.
 */
export type DoublesLockState = {
  currentDouble: BoardTarget;
  targetIndex: number;
  lastLock: BoardTarget | null;
  bonus: number;
  locks: number;
  passes: number;
  dartsPerPass: number[];
  bestPassDarts: number | null;
  dartsThisPass: number;
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

`doubles-lock.engine.module.ts`:
```ts
import type { DoublesLockConfigData } from "@lib/types";
import { DoublesLockV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  DartFact,
  DoublesLockTrackExt,
  EngineFacts,
  LockBonus,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  doublesPath,
  isHitOn,
} from "@modules/game/board-progression.module";
import {
  closeAfter,
  lockCheckpoint,
  noPoints,
  passOnWrap,
  pathTarget,
} from "@modules/game/track-policies";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { DoublesLockState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Doubles Lock seat never finishes; only the timer ends the exercise.";

/** The ladder: D20 down to D1. */
export const DOUBLES_LOCK_PATH: readonly BoardTarget[] = doublesPath(
  Array.from({ length: 20 }, (_, i) => 20 - i),
);

/** Two hits lock for 50, three for 100. */
export const DOUBLES_LOCK_BONUS: LockBonus = { 2: 50, 3: 100 };

const LAST_INDEX = DOUBLES_LOCK_PATH.length - 1;

function tallyPassDarts(
  seat: TrackSeat<DoublesLockTrackExt>,
): TrackSeat<DoublesLockTrackExt> {
  return {
    ...seat,
    ext: {
      ...seat.ext,
      dartsThisPass: seat.ext.dartsThisPass + seat.dartsThisVisit,
    },
  };
}

function closePass(
  seat: TrackSeat<DoublesLockTrackExt>,
): TrackSeat<DoublesLockTrackExt> {
  if (seat.targetIndex <= LAST_INDEX) return seat;
  const wrapped = passOnWrap<DoublesLockTrackExt>(LAST_INDEX)(seat);
  return {
    ...wrapped,
    ext: {
      ...wrapped.ext,
      lastLock: null,
      dartsPerPass: [...wrapped.ext.dartsPerPass, wrapped.ext.dartsThisPass],
      dartsThisPass: 0,
    },
  };
}

/**
 * Doubles Lock's Track rules: the ladder's doubles in order; a dart hits
 * only in the double (`isHitOn`) and scores nothing per dart. At a visit's
 * close the pass's darts are tallied, `lockCheckpoint` locks, advances or
 * retreats, and past D1 `closePass` starts a new pass with no lock.
 */
function doublesLockRules(): TrackRules<DoublesLockTrackExt> {
  const lock = lockCheckpoint<DoublesLockTrackExt>(DOUBLES_LOCK_BONUS);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(DOUBLES_LOCK_PATH),
    hit: isHitOn,
    points: noPoints,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) => closePass(lock(tallyPassDarts(seat))),
  };
}

function onIntendedDouble(dart: DartFact): boolean {
  return (
    dart.hitZoneKey === "DOUBLE" &&
    dart.hitTargetNumber === dart.intendedTargetNumber
  );
}

function projectDoublesLock(
  seat: TrackSeat<DoublesLockTrackExt>,
  _config: DoublesLockConfigData,
  complete: boolean,
  facts: EngineFacts,
): DoublesLockState {
  const darts = facts.turns.flatMap((turn) => turn.darts);
  const { lastLock, dartsPerPass } = seat.ext;
  return {
    currentDouble: DOUBLES_LOCK_PATH[seat.targetIndex],
    targetIndex: seat.targetIndex,
    lastLock: lastLock === null ? null : DOUBLES_LOCK_PATH[lastLock],
    bonus: seat.score,
    locks: seat.ext.locks,
    passes: seat.ext.passes,
    dartsPerPass,
    bestPassDarts: dartsPerPass.length ? Math.min(...dartsPerPass) : null,
    dartsThisPass: seat.ext.dartsThisPass + seat.dartsThisVisit,
    hits: darts.filter(onIntendedDouble).length,
    dartsThrown: darts.length,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const doublesLockSpec = trackExerciseSpec<
  DoublesLockConfigData,
  DoublesLockTrackExt,
  DoublesLockState
>({
  exerciseRulesetVersionKey: "DOUBLES_LOCK_V1",
  parse: (config) => DoublesLockV1Config.parse(config),
  rules: doublesLockRules,
  initialExt: () => ({
    lastLock: null,
    locks: 0,
    passes: 0,
    dartsThisPass: 0,
    dartsPerPass: [],
  }),
  project: projectDoublesLock,
  intent: (state) => doubleTargetIntent(state.currentDouble),
});

/** Doubles Lock's state from a fact log alone, through the same fold the engine uses. */
export function foldDoublesLockState(
  facts: EngineFacts,
  config: DoublesLockConfigData,
  complete: boolean,
): DoublesLockState {
  return doublesLockSpec.fold(facts, config, complete);
}

/** Doubles Lock exercise engine, built by the exercise shell. */
export class DoublesLockEngine extends dartExerciseEngineClass(
  doublesLockSpec,
) {}

export const doublesLockEngineFactory = dartExerciseEngineFactory(
  doublesLockSpec,
  DoublesLockEngine,
);

registerDartExerciseEngineFactory(doublesLockEngineFactory);
```
Notes:
- `DoublesLockState` must reach `@modules/types` the way `SwitchbladeState` does (the barrels are `export *`).
- `DartFact` is the name the facts' dart rows carry. If the type is exported under another name, use that; never use a cast.
- If `noPoints`'s arity does not fit `TrackRules["points"]`, wrap it: `points: () => 0`. Ledger a ruling.

- [ ] **Step 4: Run** the engine test. Expected: PASS. Then run `npm run check`. Expected: 0 errors.

- [ ] **Step 5: Add the kernel row.** Append it to `scripts/engine-kernels.txt` in path order (before `double-pattern`'s row if sorting puts it there; follow the file's order):
```
app/src/modules/training/exercises/doubles-lock.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/doubles-lock.md |
```
Run `bash scripts/check-engine-kernels.sh`. Expected: OK, with one more engine.

- [ ] **Step 6: Add the aimed golden.** In `aimed-observations.ts`:
  - give `aimedOnCurrentBoardTarget` a third parameter `ring: (rand: () => number) => DartZoneKey = anyRing`;
  - pass `() => ring(rand)` to `observationOn` in place of `() => anyRing(rand)`;
  - extend its JSDoc: "in the ring `ring` picks (any ring by default)".

Hit Count's and SwitchBlade's goldens call it with one or two arguments, so their snapshots must not change.

`doubles-lock.aimed.golden.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Lock — aimed golden trace", () => {
  for (const resumeExpired of [false, true]) {
    it(`resumeExpired ${resumeExpired}: seed 13 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new DoublesLockEngine({}, prior),
          seed: 13,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.7, "currentDouble", () => "DOUBLE"),
        }),
      ).toMatchSnapshot();
    });
  }
});
```
- Run it twice. The first run writes the snapshot. On the second, Expected: PASS with no write.
- Then run `npm test -- tests/modules/training/exercises/hit-count.aimed.golden.test.ts tests/modules/training/exercises/switchblade.aimed.golden.test.ts`. Expected: PASS, no write.
- Open the new snapshot and confirm that `passes` > 0, `locks` > 0 and a retreat occurs (`targetIndex` falls between steps).
- If `passes` stays 0, raise `rate` to 0.8 and ledger the change.

- [ ] **Step 7: Engine mutation spot-check.**
  - Change `closePass(lock(tallyPassDarts(seat)))` to `closePass(lock(seat))`. Expected: `a perfect pass…` fails (`dartsPerPass`).
  - Change `lastLock: null,` in `closePass` to nothing (keep the lock). Expected: `a pass clears the last lock` fails.
  - Change `Math.min` to `Math.max`. Expected: `best pass is the fewest darts` fails.
  - Revert all three, and ledger them.

- [ ] **Step 8: Commit**
```bash
git add app/src/modules/training/exercises/types.ts app/src/modules/training/exercises/doubles-lock.engine.module.ts app/tests/modules/training/exercises/doubles-lock.engine.module.test.ts app/tests/modules/training/exercises/doubles-lock.aimed.golden.test.ts app/tests/modules/training/exercises/__snapshots__/doubles-lock.aimed.golden.test.ts.snap app/tests/modules/game/support/aimed-observations.ts scripts/engine-kernels.txt
git commit -m "feat(doubles-lock): Doubles Lock engine bound to the Track kernel"
```

---

### Task 4: Server wiring

**Files:**
- Create: `app/src/services/exercise-rulesets/doubles-lock/doubles-lock.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts`, `app/src/services/types.ts`, `app/src/services/training-session.service.ts`, `app/src/pages/api/training-sessions/types.ts`
- Test: `app/tests/services/exercise-rulesets/doubles-lock.validator.test.ts`, `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/services/training-session.service.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`

**Interfaces:**
- Produces:
  - `doublesLockValidator: ExerciseRulesetValidator`.
  - `"DOUBLES_LOCK"` in `exerciseTypeKey` (the service type and both API Zod enums) and in `DART_EXERCISE_TYPE_KEYS`.
  - `"DOUBLES_LOCK_V1"` in `REGISTRY` and `DART_WRITING_RULESET_VERSION_KEYS`.

- [ ] **Step 1: Write the failing tests**

`doubles-lock.validator.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { doublesLockValidator } from "@services/exercise-rulesets/doubles-lock/doubles-lock.validator";

describe("doublesLockValidator", () => {
  it("accepts the empty config", () => {
    expect(doublesLockValidator.validateConfig({ config: {} })).toEqual({
      ok: true,
      config: {},
    });
  });

  it("refuses any key", () => {
    const result = doublesLockValidator.validateConfig({
      config: { lockHits: 3 },
    });
    expect(result.ok).toBe(false);
  });
});
```
Use `switchblade.validator.test.ts`'s call shape if `validateConfig` takes more.

Append to `registry.test.ts`, mirroring the two SwitchBlade cases:
- `resolves DOUBLES_LOCK_V1` → `doublesLockValidator`;
- `is true for Doubles Lock` → `exerciseRulesetWritesDarts("DOUBLES_LOCK_V1")` is true.

Append to `pages/api/training-sessions/types.test.ts` a copy of `accepts a SWITCHBLADE step` named `accepts a DOUBLES_LOCK step`, with:
- `exerciseTypeKey: "DOUBLES_LOCK"`;
- `exerciseRulesetVersionKey: "DOUBLES_LOCK_V1"`;
- `configuration: {}`.

Copy any second SwitchBlade case in that file the same way.

Append to `training-session.service.test.ts` a copy of the SWITCHBLADE capture-pair case, named for DOUBLES_LOCK, with:
- keys `"DOUBLES_LOCK"` / `"DOUBLES_LOCK_V1"`;
- configuration `{}`;
- ids `"et-dl"` / `"erv-dl"`;
- the same capture-pair assertions.

- [ ] **Step 2: Run** `npm test -- tests/services/exercise-rulesets tests/services/training-session.service.test.ts tests/pages/api/training-sessions/types.test.ts`
Expected: FAIL. The validator is missing, the enums reject `DOUBLES_LOCK`, and the capture pair is null.

- [ ] **Step 3: Implement**

`doubles-lock.validator.ts`:
```ts
import { DoublesLockV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Doubles Lock v1 asserts the config is empty — path, lock threshold and
 * bonus are fixed (`docs/game-rules/training/exercises/doubles-lock.md`).
 */
export const doublesLockValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = DoublesLockV1Config.safeParse(config);
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
- `registry.ts`: import it; add `DOUBLES_LOCK_V1: doublesLockValidator,` and `"DOUBLES_LOCK_V1",` in `DART_WRITING_RULESET_VERSION_KEYS`.
- `services/types.ts`: add `| "DOUBLES_LOCK"` after `| "SWITCHBLADE"`.
- `training-session.service.ts`: add `"DOUBLES_LOCK",` in `DART_EXERCISE_TYPE_KEYS`, and Doubles Lock to its JSDoc list.
- `pages/api/training-sessions/types.ts`: add `"DOUBLES_LOCK",` after `"SWITCHBLADE",` in both enums.

If fallow reports the validator as a duplicate, ledger a ruling. Duplicate-validator issue: search open `discovered-work` issues first; comment there if one exists, else file one. Do not refactor.

- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npm run check`: 0 errors.

- [ ] **Step 5: Commit**
```bash
git add app/src/services app/src/pages/api/training-sessions/types.ts app/tests/services app/tests/pages/api/training-sessions/types.test.ts
git commit -m "feat(doubles-lock): server validator, keys and capture pair"
```

---

### Task 5: Seed `0040` and verification

**Files:**
- Create: `database/seeds/0040_doubles_lock_exercise_type.sql`, `database/verification/0040_doubles_lock_seed_checks.sql`
- Modify: `database/README.md`

- [ ] **Step 1: Write the verification script first.** Copy `database/verification/0039_switchblade_seed_checks.sql` and replace:
  - `0039_switchblade` → `0040_doubles_lock`;
  - `SWITCHBLADE_V1` → `DOUBLES_LOCK_V1`;
  - `SWITCHBLADE` → `DOUBLES_LOCK`;
  - `SwitchBlade` → `Doubles Lock`;
  - check 3's name → `'the system template pins DOUBLES_LOCK_V1 with the empty configuration'` (predicate stays `t.default_configuration = '{}'::jsonb`);
  - the header purpose to match.

- [ ] **Step 2: Prove it fails.**
  - Start local Postgres if it is down: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgci/data -o '-p 5433 -k /var/tmp/pgci' -l /var/tmp/pgci/log start"`.
  - Create a temporary `app/.env` with the local DB URL.
  - Run `psql "postgres://postgres@localhost:5433/integration" -f database/verification/0040_doubles_lock_seed_checks.sql`.
  - Expected: checks 1–4 FAIL.

- [ ] **Step 3: Write the seed.** Copy `0039_switchblade_exercise_type.sql` and change:
  - **header:** the file name; purpose "Insert the DOUBLES_LOCK exercise type, its v1 ruleset and the Doubles Lock system template … Rules: docs/game-rules/training/exercises/doubles-lock.md. No routine is seeded: V1 is a routine step only."; the config paragraph becomes "The default configuration is empty: path, lock threshold and bonus are fixed in V1. Duration is the routine step's."
  - **`exercise_types`:**
    - id `'0199a000-0000-7000-8000-00000000000e'`;
    - key `'DOUBLES_LOCK'`;
    - name `'Doubles Lock'`;
    - description `'Walk the doubles from D20 down to D1. Two or three hits lock a double for a bonus; a blank visit sends you back to your last lock. The ladder repeats until the time runs out.'`
  - **`exercise_ruleset_versions`:**
    - id `'0199a100-0000-7000-8000-00000000000d'`;
    - type id `…00e`;
    - key `'DOUBLES_LOCK_V1'`;
    - description `'Initial Doubles Lock ruleset: D20 to D1; one hit advances, two lock for 50, three lock for 100; a blank visit retreats to the last lock, or D20 before one; passes repeat until time.'`
  - **`exercise_templates`:**
    - id `'0199b000-0000-7000-8000-000000000014'`;
    - type id `…00e`;
    - ruleset subselect on `'DOUBLES_LOCK_V1'`;
    - name `'Doubles Lock'`;
    - description `'D20 down to D1. Two hits lock a double for 50, three for 100; a blank visit falls back to your last lock.'`;
    - configuration `'{}'::jsonb`.

- [ ] **Step 4: Run** `cd app && npm run db:seed`, then the verification script.
  - Expected: `ALL 4 CHECKS PASSED`.
  - Run `npm run db:seed` again. Expected: no error (idempotent).
  - Delete `app/.env`.

- [ ] **Step 5: Update the README.**
  - Add the item `40. \`seeds/0040_doubles_lock_exercise_type.sql\`` after item 39.
  - Add a verification row after the `0039_switchblade` row:
```
| `verification/0040_doubles_lock_seed_checks.sql` | seed `0040`: the `DOUBLES_LOCK` type is published, `DOUBLES_LOCK_V1` is its version 1, the system template "Doubles Lock" pins it with the empty configuration, and `v_exercise_template_catalog` offers it (4 checks) (2026-10-18) |
```

- [ ] **Step 6: Commit**
```bash
git add database/seeds/0040_doubles_lock_exercise_type.sql database/verification/0040_doubles_lock_seed_checks.sql database/README.md
git commit -m "feat(doubles-lock): seed the DOUBLES_LOCK type and template"
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
  - `STEP_METRIC_SPECS.DOUBLES_LOCK = { metrics: { bonus: "sum", locks: "sum", darts: "sum", hits: "sum" }, headline: "bonus", direction: "higher", rates: [["hits", "darts"]] }`.
  - `stepMetrics("DOUBLES_LOCK", state, facts)` → `{ bonus: state.bonus, locks: state.locks, darts: state.dartsThrown, hits: state.hits }`.

- [ ] **Step 1: Write the failing tests**
  - **`step-metrics.module.test.ts`:** append a fixture.
    - `doublesLock = doublesLockEngineFactory.create({})`, played with `D20, D20, MISS, D19` using the file's `dart` helper.
    - Expected `{ bonus: 50, locks: 1, darts: 4, hits: 3 }`.
  - **`replay-step-games.ts`:** append to `EXERCISE_FIXTURES`:
    ```ts
      DOUBLES_LOCK: {
        rulesetKey: "DOUBLES_LOCK_V1",
        factory: doublesLockEngineFactory,
        config: {},
        darts: [
          dart(20, "DOUBLE"),
          dart(20, "DOUBLE"),
          dart(null, "MISS"),
          dart(19, "DOUBLE"),
        ],
      },
    ```
  - **`replay-fold-steps.test.ts`:** append a case modelled on the SWITCHBLADE one. Use `playExerciseKind("DOUBLES_LOCK")`; expect `finalState` `bonus` 50 and `locks` 1, and a replayed turn count of 2.
  - **`step-result.module.test.ts`:** append a case modelled on the SwitchBlade one, with:
    - session `"dl"`;
    - `exerciseRulesetVersionKey: "DOUBLES_LOCK_V1"`;
    - configuration `{}`;
    - darts in turn 1: `(1, 20, "DOUBLE", 40)`, `(2, 20, "DOUBLE", 40)` and `(3, null, "MISS", 0)`. The helper must take `hitTargetNumber`, because the miss has none; extend the local helper's parameters if the SwitchBlade one fixes it at 20.
    - Expect `foldStepResult("DOUBLES_LOCK", rows).metrics` to be `{ bonus: 50, locks: 1, darts: 3, hits: 2 }`.
  - **`replay-presenters-steps.test.ts`:** append a "covers Doubles Lock" case modelled on "covers SwitchBlade".
  - **`integration/fixtures/stats-routine.ts`:** append `exerciseStep(14, "DOUBLES_LOCK", {})` after the SwitchBlade step, and update the JSDoc above `ROUTINE_STEPS` to end "…then SwitchBlade, then Doubles Lock".
  - **`statistics-sql.itest.ts`:** change `toHaveLength(13)` to `toHaveLength(14)`. Ledger it as `Ruling: stepKinds length 13 → 14 — the assertion is "one step per kind", same guarantee — cost if wrong: none`.

- [ ] **Step 2: Run** `npm test -- tests/modules/stats tests/lib/stats`
Expected: FAIL, because `"DOUBLES_LOCK"` is not a `DartExerciseKind`.

- [ ] **Step 3: Implement**
  - **`types.ts`:** add `| "DOUBLES_LOCK"` to `DartExerciseKind`, and bump the JSDoc kind count by one ("twelve").
  - **`step-metrics.module.ts`:** add the spec above, and:
    ```ts
        case "DOUBLES_LOCK":
          return {
            bonus: numberField(state, "bonus", kind),
            locks: numberField(state, "locks", kind),
            darts: numberField(state, "dartsThrown", kind),
            hits: numberField(state, "hits", kind),
          };
    ```
  - **`step-result.module.ts` and `replay-fold.ts`:** add `import "@modules/training/exercises/doubles-lock.engine.module";` in sorted position.
  - **`replay-presenters.ts`:** add `DOUBLES_LOCK: "darts",` in `DARTS_METRIC_KEY`.

- [ ] **Step 4: Run** `npm test -- tests/modules/stats tests/lib/stats`. Expected: PASS. Then `npm run check`: 0 errors.
  - If fallow flags `stepMetrics`'s switch for complexity, ledger it and follow how the file handled earlier growth; do not restructure beyond that.

Then run the integration suite against local Postgres (migrated and seeded through `0040`): `DATABASE_URL="postgres://postgres@localhost:5433/integration" npm run test:integration`. Expected: all pass, and the sweep finds the DOUBLES_LOCK step.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/stats app/src/lib/stats app/tests/modules/stats app/tests/lib/stats app/tests/integration
git commit -m "feat(doubles-lock): step metrics, step result and replay"
```

---

### Task 7: Routine summary, step adapter

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`
- Create: `app/src/lib/training/routines/adapters/doubles-lock.adapter.ts`
- Modify:
  - `app/src/lib/training/routines/adapters/types.ts`
  - `adapters/step-adapter.registry.ts`
  - `app/src/lib/training/routines/types.ts` (slot)
  - `routine-play.data.ts` (initial `doublesLockEngine: null` only)
- Test:
  - `app/tests/modules/training/routines/routine-summary-engines.module.test.ts`
  - `app/tests/lib/training/routines/adapters/doubles-lock.adapter.test.ts`
  - `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`
  - `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Produces:
  - `summariseDoublesLock(state: DoublesLockState): RoutineStepSummary`.
  - `doublesLockAdapter`: key `"DOUBLES_LOCK"`, headerLabel and title `"Doubles Lock"`, panel `"doubles-lock"`.
  - `StepAdapterKey` gains `| "DOUBLES_LOCK"`; `StepPanel` gains `| "doubles-lock"`.
  - `RoutinePlayContext.doublesLockEngine: DoublesLockEngine | null`.

- [ ] **Step 1: Write the failing tests**

Summary (append):
```ts
  it("summariseDoublesLock reads bonus, locks, passes, best pass, darts and rate", () => {
    const engine = doublesLockEngineFactory.create({});
    [
      dart(20, "DOUBLE"),
      dart(20, "DOUBLE"),
      dart(null, "MISS"),
      dart(19, "DOUBLE"),
      dart(null, "MISS"),
      dart(null, "MISS"),
    ].forEach((d) => engine.record(d));

    expect(summariseDoublesLock(engine.state())).toEqual({
      stepKey: "DOUBLES_LOCK",
      label: "Doubles Lock",
      rows: [
        { label: "Bonus", value: "50" },
        { label: "Locks", value: "1" },
        { label: "Passes", value: "0" },
        { label: "Best pass", value: "—" },
        { label: "Darts", value: "6" },
        { label: "Hit rate", value: "50.00%" },
      ],
    });
  });

  it("summariseDoublesLock shows the best pass's darts once a pass is done", () => {
    const engine = doublesLockEngineFactory.create({});
    Array.from({ length: 20 }, (_, i) => 20 - i)
      .flatMap((n) => [dart(n, "DOUBLE"), dart(n, "DOUBLE"), dart(n, "DOUBLE")])
      .forEach((d) => engine.record(d));
    expect(summariseDoublesLock(engine.state()).rows[3]).toEqual({
      label: "Best pass",
      value: "60 darts",
    });
  });
```

`doubles-lock.adapter.test.ts`: copy `switchblade.adapter.test.ts`, then:
- use slot `doublesLockEngine`, `exerciseTypeKey: "DOUBLES_LOCK"` and `configuration: {}`;
- assert key `"DOUBLES_LOCK"`, headerLabel and title `"Doubles Lock"`, panel `"doubles-lock"`;
- `open()` builds a `DoublesLockEngine`;
- `summarise()` returns stepKey `"DOUBLES_LOCK"`;
- `close()` nulls the slot.

`step-adapter.registry.test.ts`:
- Append an `it` asserting `resolveStepAdapter("DOUBLES_LOCK")?.title` is `"Doubles Lock"` and `STEP_ADAPTERS.DOUBLES_LOCK` is `doublesLockAdapter`.
- Add `"DOUBLES_LOCK"` to the exhaustive key list, and `"DOUBLES_LOCK": "Doubles Lock"` to the inline title snapshot.
- Ledger `Ruling: step-adapter registry exhaustive lists gain DOUBLES_LOCK — "one adapter per kind", same guarantee — cost if wrong: none`.

`routine-play.data.test.ts`:
- This test goes here, not in Task 8, so the coverage gate passes on this commit's `routine-play.data.ts` change. Append:
```ts
describe("routinePlay — Doubles Lock", () => {
  it("starts with no Doubles Lock engine", () => {
    expect(makeStore().doublesLockEngine).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/training/routines tests/lib/training/routines/adapters tests/lib/training/routines/routine-play.data.test.ts`
Expected: FAIL, because `summariseDoublesLock`, the adapter and the slot are missing.

- [ ] **Step 3: Implement**

`routine-summary.module.ts`:
```ts
/**
 * Doubles Lock's result is its bonus and locks over every pass, then
 * passes, the best pass's darts, darts and hit rate.
 */
export function summariseDoublesLock(
  state: DoublesLockState,
): RoutineStepSummary {
  const { bonus, locks, darts, hits } = stepMetrics(
    "DOUBLES_LOCK",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "DOUBLES_LOCK",
    label: "Doubles Lock",
    rows: [
      { label: "Bonus", value: String(bonus) },
      { label: "Locks", value: String(locks) },
      { label: "Passes", value: String(state.passes) },
      {
        label: "Best pass",
        value:
          state.bestPassDarts === null ? "—" : `${state.bestPassDarts} darts`,
      },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}
```

`doubles-lock.adapter.ts`:
```ts
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import { summariseDoublesLock } from "@modules/training/routines/routine-summary.module";
import type { DoublesLockConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const doublesLockAdapter: StepAdapter = {
  key: "DOUBLES_LOCK",
  headerLabel: "Doubles Lock",
  title: "Doubles Lock",
  panel: "doubles-lock",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("DOUBLES_LOCK_V1");
    const created = factory?.create(
      result.configuration as DoublesLockConfigData,
    );
    ctx.doublesLockEngine =
      created instanceof DoublesLockEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.doublesLockEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.doublesLockEngine) return null;
    return summariseDoublesLock(ctx.doublesLockEngine.state());
  },
  close(ctx) {
    ctx.doublesLockEngine = null;
  },
};
```
Then:
- `adapters/types.ts`: add `| "DOUBLES_LOCK"` and `| "doubles-lock"`.
- Registry: import the adapter and add `DOUBLES_LOCK: doublesLockAdapter,`.
- `routines/types.ts`: add `doublesLockEngine: DoublesLockEngine | null;` after `switchbladeEngine`.
- `routine-play.data.ts`: add `doublesLockEngine: null,` after `switchbladeEngine: null,`.

- [ ] **Step 4: Run** the Step 2 command, then `npm run check`. Expected: PASS, with 0 type errors.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/training/routines/routine-summary.module.ts app/src/lib/training/routines app/tests/modules/training/routines app/tests/lib/training/routines
git commit -m "feat(doubles-lock): routine summary and step adapter"
```

---

### Task 8: Play surface

**Files:**
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `app/src/lib/training/routines/types.ts`, `app/src/lib/training/routines/exercise-preview.ts`
- Create: `app/src/components/layout/training/exercises/DoublesLockPanel.astro`
- Modify: `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/routine-play.data.test.ts`, `app/tests/lib/training/routines/exercise-preview.test.ts`

**Interfaces:**
- Consumes:
  - the `doublesLockEngine` slot (Task 7);
  - `DoublesLockState`;
  - `boardTargetLabel`.
- Produces on `RoutinePlayContext`:
  - `recordDoublesLockDart(observation)`;
  - `doublesLockBonus(): number`;
  - `doublesLockTargetLabel(): string`;
  - `doublesLockLastLockLabel(): string` (`"—"` before a lock);
  - `doublesLockPasses(): number`;
  - `doublesLockBestPass(): string` (`"—"` before a completed pass).
- Produces the preview family `"doublesLock"`.

- [ ] **Step 1: Write the failing tests**

`exercise-preview.test.ts`:
- Add `doublesLockEngine: null` to `none`. The type forces it; ledger `Ruling: preview test's none fixture gains the new slot — same "no engine open" guarantee`.
- Inside `describe("exerciseFamily")` (the `none` fixture lives there), append:
```ts
  it("maps the open Doubles Lock engine to its family", () => {
    expect(exerciseFamily({ ...none, doublesLockEngine: {} as never })).toBe(
      "doublesLock",
    );
  });
```
- Append:
```ts
describe("Doubles Lock preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey: "DOUBLE",
    }) as DartFact;

  it("judges a hit only in the intended double", () => {
    expect(judgeDart("doublesLock", aimed(20, "DOUBLE", 20))).toBe("hit");
    expect(judgeDart("doublesLock", aimed(20, "SINGLE", 20))).toBe("miss");
    expect(judgeDart("doublesLock", aimed(19, "DOUBLE", 20))).toBe("miss");
  });

  it("captions the visit with the current double", () => {
    expect(
      visitLabelsFor("doublesLock", {
        config: {},
        visitIndex: 0,
        currentTargetNumber: undefined,
        currentTargetLabel: "D18",
        targetIndex: 0,
        dartsInOpenVisit: 0,
      }),
    ).toEqual(["D18", "D18", "D18"]);
  });
});
```

`routine-play.data.test.ts`:
- Append `DOUBLES_LOCK_STEP`, copied from `SWITCHBLADE_STEP` with keys `DOUBLES_LOCK`/`DOUBLES_LOCK_V1` and `configuration: {}`.
- Then `describe("routinePlay — Doubles Lock play", …)`, copied from the SwitchBlade play block's setup, with these cases:
  - **start:** `doublesLockEngine` is not null; `doublesLockBonus()` 0; `doublesLockTargetLabel()` `"D20"`; `doublesLockLastLockLabel()` `"—"`; `doublesLockPasses()` 0; `doublesLockBestPass()` `"—"`.
  - **readouts:** after `D20, D20, MISS, D19`: bonus 50; target `"D19"`; last lock `"D20"`.
  - **preview:** after `D20, D20, MISS, D19`, `previewSegments()` equals `[{ status: "hit", label: "D19" }, { status: "empty", label: "D19" }, { status: "empty", label: "D19" }]`. If the open-visit preview shape differs from SwitchBlade's, match the shape Hit Count's preview test asserts and ledger it.
  - **routes a committed board dart:** `boardCommit.onCommit!(D20)` → `doublesLockEngine!.state().dartsThrown` 1.
  - **never completes on a dart:** after a full perfect pass (60 darts), `appendBatch` is not called and `isComplete()` is false; `doublesLockBestPass()` is `"60 darts"`.
  - **deadline expires and uploads:** `advanceTimersByTimeAsync(600_000)` → `appendBatch` called; `stepSummaries[0]` matches `{ stepKey: "DOUBLES_LOCK" }`.
- In the `board dispatch` `it.each`, add `["DOUBLES_LOCK", "doublesLockEngine"],` after the SWITCHBLADE row. Ledger `Ruling: board-dispatch table gains DOUBLES_LOCK — same "every slot routes" guarantee`.

- [ ] **Step 2: Run** `npm test -- tests/lib/training/routines/routine-play.data.test.ts tests/lib/training/routines/exercise-preview.test.ts`
Expected: FAIL, because the methods and family are missing.

- [ ] **Step 3: Implement**

`routines/types.ts`:
- `| "doublesLock"` in `ExercisePreviewFamily`;
- `| "doublesLockEngine"` in `ExerciseEngineSlots`;
- `| DoublesLockEngine` in `activeDartEngine`'s return type;
- signatures for `recordDoublesLockDart` and the five readouts.

`exercise-preview.ts`:
- Add `["doublesLockEngine", "doublesLock"]` to `ENGINE_FAMILIES`, `doublesLock: judgeDouble` to `JUDGES`, and `doublesLock: hitCountCaptions` to `CAPTIONS`.
- Extend `judgeDart`'s JSDoc: "Doubles Lock judges the intended double only."

`routine-play.data.ts`:
- Import `type DoublesLockEngine`.
- Add a `["doublesLockEngine", "recordDoublesLockDart"],` row after the SwitchBlade row in `DART_ENGINE_RECORDERS`.
- Add `| DoublesLockEngine` to `activeDartEngine`'s return type.
- Add `this.doublesLockEngine?.expireTimer();` to `startStepTimer` `onComplete`.
- In `exerciseVisitLabels`, change `currentTargetLabel: this.hitCountTargetLabel() || undefined,` to `currentTargetLabel: this.hitCountTargetLabel() || this.doublesLockTargetLabel() || undefined,`.
- Add the methods after the SwitchBlade block:
```ts
    /** Doubles Lock never ends on a dart; only the step deadline completes it. */
    recordDoublesLockDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.doublesLockEngine) return;
      this.doublesLockEngine.record(observation);
    },

    doublesLockBonus(this: RoutinePlayContext): number {
      return this.doublesLockEngine?.state().bonus ?? 0;
    },

    doublesLockTargetLabel(this: RoutinePlayContext): string {
      const target = this.doublesLockEngine?.state().currentDouble;
      return target === undefined ? "" : boardTargetLabel(target);
    },

    doublesLockLastLockLabel(this: RoutinePlayContext): string {
      const lock = this.doublesLockEngine?.state().lastLock;
      return lock ? boardTargetLabel(lock) : "—";
    },

    doublesLockPasses(this: RoutinePlayContext): number {
      return this.doublesLockEngine?.state().passes ?? 0;
    },

    doublesLockBestPass(this: RoutinePlayContext): string {
      const best = this.doublesLockEngine?.state().bestPassDarts;
      return best == null ? "—" : `${best} darts`;
    },
```

`DoublesLockPanel.astro`:
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="doublesLockBonus()"
  caption="BONUS"
  tiles={[
    { label: "Target", value: "doublesLockTargetLabel()" },
    { label: "Lock", value: "doublesLockLastLockLabel()" },
    { label: "Pass", value: "doublesLockPasses() + 1" },
    { label: "Best", value: "doublesLockBestPass()" },
  ]}
/>
```
In `play/index.astro`, import `DoublesLockPanel` beside `SwitchbladePanel` and mount it after the SwitchBlade block:
```astro
        <template x-if="adapter?.panel === 'doubles-lock' && doublesLockEngine">
          <DoublesLockPanel />
        </template>
```

- [ ] **Step 4: Run** the Step 2 command, then the full suite (`npm test`) and `npm run check`. Expected: all PASS, 0/0/0.

- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/routines app/src/components/layout/training/exercises/DoublesLockPanel.astro app/src/pages/training/routines/play/index.astro app/tests/lib/training/routines
git commit -m "feat(doubles-lock): routine play surface and panel"
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
  - `docs/game-rules/training/exercises/doubles-lock.md`
  - `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (refinements, if not already folded in on approval)

- [ ] **Step 1: Canonical docs.** Use minimal diffs and ISO dates `2026-10-18`.
  - **Pattern 18 version:** prepend `1.11.10 (Pattern 18: Doubles Lock bound through \`trackExerciseSpec\`; \`lockCheckpoint\` visit-close policy 2026-10-18; prior 1.11.9: …)`, keeping the chain. The TRACK row's tail becomes "Hit Count, SwitchBlade, Doubles Lock bound through `trackExerciseSpec` (D469)".
  - **Routines §17**, after SwitchBlade:
    ````markdown
    ## Doubles Lock

    Configuration:

    ```text
    duration: 15m

    path (fixed): D20 D19 … D1
    lock: 2 hits +50, 3 hits +100
    ```

    One visit of three darts at the current double; only the double counts. One hit advances; two or three lock the double for the bonus and advance; a blank visit retreats to the last locked double, or D20 before any lock in the pass. Past D1 the ladder restarts at D20 with no lock, until the time runs out. Rules: `docs/game-rules/training/exercises/doubles-lock.md`.

    **Implemented** (`DOUBLES_LOCK_V1`, `app/src/modules/training/exercises/doubles-lock.engine.module.ts`, seed `0040`): empty configuration (path, threshold and bonus are fixed in V1), bound to the Track kernel through `trackExerciseSpec` (D469) with `isHitOn`, `noPoints`, `lockCheckpoint({2: 50, 3: 100})` and `passOnWrap(19)` composed with a pass reset. Each dart carries the current double (`DOUBLE`); `score` is the board score. One turn per visit. State carries the bonus and locks over every pass, the current double, the last lock, passes, darts per pass and the best (fewest) pass. Time-bound only. Capture pair and upload path match Target Scoring (D277). Routine step only in V1 (2026-10-18).
    ````
  - **Section catalog:** add `| DOUBLES_LOCK | bonus, locks, darts, hits (sum) | bonus ↑ | hits/darts |` after SWITCHBLADE.
  - **Component inventory:** add `| \`DoublesLockPanel.astro\` | Doubles Lock play surface (2026-10-18): \`doublesLockBonus()\` BONUS with Target / Lock / Pass / Best tiles — a call to \`ExercisePanelShell\` | none (reads the routine play page scope) |` after SwitchbladePanel.
  - **File Inventory:**
    - Add rows for the seed, the verification script, the engine and the validator, mirroring the SwitchBlade rows' wording and place.
    - Add `doubles-lock.adapter.ts` to the adapters row, and bump its count ("thirteen").
    - Add `lockCheckpoint` (Doubles Lock, 2026-10-18) to the `track-policies.ts` row.
  - **Context-Map History:** add one row listing the changed files and "Doubles Lock V1 shipped on the Track kernel through `trackExerciseSpec`; policy `lockCheckpoint`; preview family `doublesLock`; seed `0040`. Track T1.3 (2026-10-18)".
  - **`modules/training/CLAUDE.md`:** add `doubles-lock` to the engine file list, and "(Hit Count, SwitchBlade, Doubles Lock)" where they are named as `trackExerciseSpec` users.
  - **Rules file:**
    - `Current version: V1 (shipped 2026-10-18)`. Use the actual merge-ready date.
    - Replace the Exercise type's "Type constant: `LOCK_LADDER` (proposed; …)" bullet with "Type constant: `DOUBLES_LOCK` (seed `0040`)."
  - **Spec:** fold in the refinements listed at the top of this plan (§2.3 `lockCheckpoint` row, §3 Doubles Lock row, §4 readouts, §7 fixture step 14) if not done at approval.

- [ ] **Step 2: Run** `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-game-rules.sh && bash scripts/check-doc-sync.sh && bash scripts/check-decision-ids.sh`
Expected: all OK. `check-context-map.sh` takes minutes; run it in the background.

- [ ] **Step 3: Commit**
```bash
git add docs app/src/modules/training/CLAUDE.md
git commit -m "docs(doubles-lock): routines, stats catalog, inventories, rules V1"
```

---

### Task 10: Gates

- [ ] **Step 1:** `cd app && npm run format && npm run format:check`. Commit any formatting diff as `style: format`.
- [ ] **Step 2:** `cd app && npm run validate:app`, with a temporary `app/.env` that you delete afterwards. Expected: exit 0, type gate 0/0/0, fallow clean.
  - If fallow flags `routine-play.data.ts` (CRAP or complexity), fix it at the cause within this task, and ledger the ruling.
- [ ] **Step 3:** Run every script in the `run-all-gates` skill's "Always run" and "app/ changed" lists, plus `bash scripts/test-check-engine-kernels.sh` and `bash scripts/check-engine-kernels.sh`. Expected: all OK. Record each result for the PR body.
- [ ] **Step 4:** `bash scripts/next-decision-id.sh`. Expected: `D470`; this PR adds no decision.
