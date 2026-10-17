# Track Kernel — PR 7 (Switching Target Scoring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Switching Target Scoring's fold through the Track kernel and move its hand-copied class onto the exercise shell, with no change in behaviour. This is the last PR of phase 1.

**Architecture:**
- `foldSwitchingTargetScoringState` becomes:
  - a `TrackRules<SequenceTrackExt>` record (`switchingTargetScoringRules(config)`), with `ext = { chain, finishedBest, hits, sequences }`;
  - the kernel's existing `foldTrackDarts` over one solo seat;
  - a projection from the folded `TrackSeat` to the unchanged `SwitchingTargetScoringState`.
- The hand-written `SwitchingTargetScoringEngine` class (with its copied log, undo, expiry and `facts()`) is deleted. A `DartExerciseSpec` bound to `dartExerciseEngineClass` replaces it, as Target Scoring does.
- Every export keeps its name and call shape: `foldSwitchingTargetScoringState(facts, config, complete)`, `SwitchingTargetScoringEngine`, `switchingTargetScoringEngineFactory`. The routine adapter's `instanceof SwitchingTargetScoringEngine` still holds.
- One policy lands with its first caller: `resetOnMiss(length)` (onDart). Target Scoring's `intentFor` is exported as `targetScoringIntent` and shared, as `targetScoringPoints` already is.
- No `trackExerciseSpec` and no `TrackRules.outcome` (refinements 3 and 4).
- Proof, as in PR 6:
  1. No golden exists for this engine. Commit 1 records aimed goldens from the original engine.
  2. A differential oracle runs the new shell-bound engine against a legacy copy of the hand-written one, across five configs, with timer expiry. It covers the shell move and the kernel rebind together.

**Tech Stack:** TypeScript, Vitest, Bash, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§2 Switching Target Scoring row, §3 refinements, §4 `resetOnMiss`, §5 Switching TS row, §7 method, §8 PR 7, §9.5). Previous plan: `docs/superpowers/plans/2026-10-17-track-kernel-pr6-target-scoring.md` (merged as #990).

## Global Constraints

- Branch `refactor/track-kernel-switching-target-scoring`, from `origin/main` at `433a393` or later. Never `--no-verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Types go in barrels (`modules/game/types.ts`, `interfaces.ts`). Tests and the legacy copy import them from `@modules/types` / `@modules/interfaces`, never `@modules/training/exercises/types` (`check-type-barrels.sh`).
- No `//` comments inside function bodies. Use JSDoc above the declaration.
- Fallow:
  - cognitive complexity ≤ 15 per function;
  - dead code clean (a test-support export with no caller is un-exported);
  - duplication may rise while the legacy copy exists, but must be ≤ `main`'s count after Task 7.3 (record it in Task 7.1 Step 0).
- `cd app && npm run check` reports 0 errors, 0 warnings, 0 hints.
- `npm test`, `npm run check` and `npx fallow` run past the 120 s Bash limit. Run them as `( cmd > file 2>&1; echo EXIT $? >> file )` in the background and wait on the file. Do not edit files while a background run is live.
- This is a refactor:
  - Every existing test passes with **no edits**: `switching-target-scoring.engine.module.test.ts`, `target-scoring.engine.module.test.ts`, both Target Scoring goldens, `dart-exercise-shell.module.test.ts`, the adapter, routine and step-metrics tests, `track-kernel.module.test.ts`, `track-policies.test.ts`, and every other golden.
  - New tests are appended only. Adding a name to an existing import line is allowed.
  - Existing snapshots stay unchanged.
- §7 lists no Switching Target Scoring quirk. Preserve the rules exactly:
  - a hit advances, and the last target wraps to the first and counts a sequence;
  - a miss, anywhere in the sequence or visit, resets the chain and restarts at the first target;
  - a miss on an empty chain records nothing;
  - `markToBeat` is one value across all targets (not per target, unlike Target Scoring);
  - a chain cut by the timer counts in `bestChain` but not in `markToBeat`.
- The registry flip rides **commit 2**, because `check-engine-kernels.sh` runs pre-commit.
- The legacy copy must not leave an unused declaration behind (ts(6133) hint).
- No D-entry: this sits inside D468. `bash scripts/next-decision-id.sh` printed D469 at plan time.

## Spec refinements made by this plan

1. **Policy shapes fixed.**

   | Policy | Slot | Behaviour |
   | --- | --- | --- |
   | `pathTarget(numbersPath(config.targets))` (reused) | target | As Target Scoring. |
   | `targetScoringPoints(sectionOf(target), obs)` (engine) | hit / points | As Target Scoring: hit is `!== null`, points is `?? 0`. |
   | `resetOnMiss(length)` | onDart | A hit adds `dart.points` to `ext.chain` and 1 to `ext.hits`, and moves `targetIndex` to `(i + 1) % length`; landing on 0 adds 1 to `ext.sequences`. A miss sets `targetIndex = 0` and `chain = 0`; when the chain was above 0 it sets `finishedBest = max(finishedBest ?? 0, chain)`. |
   | `closeAfter(3)` (reused) | visitOpen | Bookkeeping only; there is no `onVisitClose`. |

   `SequenceTrackExt = { chain: number; finishedBest: number | null; hits: number; sequences: number }` joins `modules/game/types.ts`. It is not `ChainTrackExt`: this exercise keeps one mark, not one per target, and counts sequences.

2. **No shared cycle helper.** `chainOnTarget` wraps on a chain-ending miss; `resetOnMiss` wraps on a hit and resets on a miss. Each is one modulo on a different branch. A helper would share `(i + 1) % length` and nothing else. §3's "cycling lands with its first caller" closes here: cycling is the modulo inside the onDart policy that needs it.

3. **`trackExerciseSpec` is not added.** Compared, the two specs are the same shape: `intent` reads `currentTargetNumber` through one shared `targetScoringIntent`, and `isVisitOpen` is three darts. They differ only in `exerciseRulesetVersionKey`, `parse` and `fold`, which are data each engine must supply anyway. An adapter would save two one-line fields per caller, for two callers. §3's rule ("an adapter lands only if two specs turn out identical") is met in shape but not worth a layer. Reopen it if a third Track exercise lands. The shared piece is `targetScoringIntent`, exported from Target Scoring's module.

4. **`TrackRules.outcome` is not added.** Both Track exercises are timer-only: `complete ? "COMPLETE" : "IN_PROGRESS"` in the projection, which the shell's `expireTimer()` already owns. A kernel member would carry no rule. Closed for phase 1; the games keep theirs in their folds.

5. **The hand-copied shell is deleted.** The class, `INITIAL_PROGRESS` and `applyDart` go. `dartExerciseEngineClass` replaces the class. Its behaviour matches the old class method by method: the same refusal text once expired, `undo()` reverses expiry first, `completedAt` stamped on the third dart, the config parsed once. The new class also carries `spec`, which no caller reads. The oracle proves the match.

6. **`bestChain` is derived, not stored.** A chain only grows until a miss ends it, and each miss folds it into `finishedBest`. So legacy's running max equals `max(finishedBest ?? 0, chain)`. The oracle proves it.

7. **Aimed goldens added.** None exist for this engine. Commit 1 records `switching-target-scoring.aimed.golden.test.ts` from the original engine, reusing PR 6's `aimedOnCurrentTarget`.

## Review Focus

1. **A miss right after a full sequence.** The index is already 0 and the chain is live. The miss must record the mark, keep `completedSequences`, and clear the chain. Pinned in Task 7.2 (boundary test 1).
2. **Undo of the dart that completes a sequence.** `completedSequences` drops back, and the index returns to the last target. Pinned in Task 7.2 (boundary test 2).
3. **A shorter later chain.** `markToBeat` keeps the larger value. Pinned in Task 7.2 (boundary test 3).
4. **A miss on the opening dart.** Nothing is recorded: `markToBeat` stays `null`. Pinned in Task 7.2 (boundary test 4).
5. **The shell swap seen from the routine layer.** `factory.create` returns an instance of the exported class, so the adapter's `instanceof` holds. Pinned in Task 7.2 (boundary test 5); rehydration after expiry is pinned by the oracle case `expired, resumed` and the aimed golden of the same name.

---

### Task 7.1: Aimed goldens, legacy copy and oracle (commit 1)

**Files:**
- Create: `app/tests/modules/training/exercises/switching-target-scoring.aimed.golden.test.ts` (and its `__snapshots__` file)
- Create: `app/tests/modules/training/exercises/legacy/switching-target-scoring.legacy.ts`
- Create: `app/tests/modules/training/exercises/switching-target-scoring.oracle.test.ts`

**Interfaces:**
- Consumes:
  - from `support/engine-oracle.ts`: `runOracle`, `goldenTrace`;
  - from `support/aimed-observations.ts`: `aimedOnCurrentTarget(rate)`.
- Produces: `LegacySwitchingTargetScoringEngine`, test-only, deleted in Task 7.3.

- [ ] **Step 0: Baseline.** Run `cd app && npx fallow` in the background. Record the duplication clone-group and line counts; those are `main`'s (134 groups / 5,925 lines after PR 6; re-measure). Record the `npm test` file and test counts too.

- [ ] **Step 1: Record the aimed goldens** in `app/tests/modules/training/exercises/switching-target-scoring.aimed.golden.test.ts`. Do this before any engine change.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { SwitchingTargetScoringConfigData } from "@lib/types";

const CASES: [string, SwitchingTargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["bull last", { targets: [20, 19, 25] }, false],
  ["bull first", { targets: [25, 1, 20] }, false],
  ["expired, resumed", { targets: [3, 17, 25] }, true],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Switching Target Scoring — aimed golden trace", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SwitchingTargetScoringEngine(config, prior),
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

  Run `cd app && npx vitest run tests/modules/training/exercises/switching-target-scoring.aimed.golden.test.ts`. Expected: 4 PASS, and 4 snapshots written. Open the snapshot. Each case must show, at least once, `completedSequences` above 0, a non-null `markToBeat`, and a `targetIndex` of 2. If one does not, the generator is wrong: fix it before going on.

- [ ] **Step 2: Copy the legacy module.** Run `mkdir -p app/tests/modules/training/exercises/legacy && cp app/src/modules/training/exercises/switching-target-scoring.engine.module.ts app/tests/modules/training/exercises/legacy/switching-target-scoring.legacy.ts`. In the copy:
  - Delete the `import { registerDartExerciseEngineFactory } from "./dart-engine.registry";` line.
  - Replace the `./interfaces` import with `import type { DartExerciseEngine } from "@modules/interfaces";`.
  - Move `SwitchingTargetScoringState` from the `./types` import into the existing `@modules/types` type import, and delete the `./types` line.
  - Rewrite `./solo-participant.module` and `./target-scoring.engine.module` as `@modules/training/exercises/solo-participant.module` and `@modules/training/exercises/target-scoring.engine.module`.
  - Delete the `switchingTargetScoringEngineFactory` block and the `registerDartExerciseEngineFactory(...)` call.
  - Rename the class to `LegacySwitchingTargetScoringEngine`. It stays exported.
  - Remove `export` from `foldSwitchingTargetScoringState`.

  The copy reads the live `targetScoringPoints`. Task 7.2 does not touch it, so both sides score alike by construction; the mutation checks below therefore target the copy's own reducer.

- [ ] **Step 3: Write the oracle test** `app/tests/modules/training/exercises/switching-target-scoring.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { LegacySwitchingTargetScoringEngine } from "./legacy/switching-target-scoring.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { SwitchingTargetScoringConfigData } from "@lib/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, SwitchingTargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["bull last", { targets: [20, 19, 25] }, false],
  ["bull first", { targets: [25, 1, 20] }, false],
  ["bull middle", { targets: [6, 25, 11] }, false],
  ["expired, resumed", { targets: [3, 17, 25] }, true],
];

describe("Switching Target Scoring — kernel vs legacy oracle", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(
      `${name}: indistinguishable through every public method`,
      () => {
        runOracle({
          build: (prior) => new SwitchingTargetScoringEngine(config, prior),
          legacy: (prior) =>
            new LegacySwitchingTargetScoringEngine(config, prior),
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

- [ ] **Step 4: Run it.** Run `cd app && npx vitest run tests/modules/training/exercises/switching-target-scoring.oracle.test.ts`. Expected: 5 PASS, since both sides are the same code. Note the wall time. If a case nears 60 s, drop `steps` to 200 for all cases and say so in the PR body.

- [ ] **Step 5: Prove the oracle can fail.** Do each of these separately in the legacy copy's `applyDart`; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. In the miss branch, change `targetIndex: 0,` to `targetIndex: progress.targetIndex,`. Every case must fail.
  2. In the hit branch, change `progress.completedSequences + (targetIndex === 0 ? 1 : 0),` to `progress.completedSequences,`. Every case must fail on `state.completedSequences`.

- [ ] **Step 6: Gates and commit.**
  - `cd app && npm run check`, in the background → 0/0/0. A hint in the legacy copy means an unused declaration: delete it.
  - `npm test`, in the background → all PASS.
  - From the repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-no-inline-comments.sh`.

```bash
git add app/tests/modules/training/exercises
git commit -m "test(switching-target-scoring): freeze legacy engine, aimed goldens, oracle"
```

  Run `task-done` only after the commit lands.

### Task 7.2: `resetOnMiss`, the rebind and the shell (commit 2)

**Files:**
- Modify: `app/src/modules/game/types.ts` (`SequenceTrackExt`)
- Modify: `app/src/modules/game/track-policies.ts` (`resetOnMiss`)
- Modify: `app/src/modules/training/exercises/target-scoring.engine.module.ts` (export `intentFor` as `targetScoringIntent`)
- Modify: `app/src/modules/training/exercises/switching-target-scoring.engine.module.ts` (rebind onto the kernel and the shell)
- Modify: `scripts/engine-kernels.txt`
- Test: `app/tests/modules/game/track-policies.test.ts`, `app/tests/modules/training/exercises/target-scoring.engine.module.test.ts`, `app/tests/modules/training/exercises/switching-target-scoring.engine.module.test.ts` (append only)

**Interfaces:**
- Consumes: `foldTrackDarts`, `initialTrackSeat`, `pathTarget`, `closeAfter`, `sectionOf`, `numbersPath`, `dartExerciseEngineClass`, `dartExerciseEngineFactory`, `targetScoringPoints`, `TrackRules`, `TrackSeat`, `JudgedDart`, `DartExerciseSpec`, `SOLO_PARTICIPANT_REF`.
- Produces:
  - `type SequenceTrackExt = { chain: number; finishedBest: number | null; hits: number; sequences: number }`;
  - `resetOnMiss<TExt extends SequenceTrackExt>(length: number): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt>`;
  - `targetScoringIntent(target: number): DartIntent` (exported from `target-scoring.engine.module.ts`).

- [ ] **Step 1: Write the boundary tests.** These characterise legacy behaviour at the projection's seams. Append them to the end of `switching-target-scoring.engine.module.test.ts`. That file already imports `SwitchingTargetScoringEngine` and `switchingTargetScoringEngineFactory`, and defines `CONFIG` (`[20, 19, 18]`), `dart`, `MISS` and `play`.

```ts
describe("Switching Target Scoring — kernel seams", () => {
  it("a miss right after a full sequence records the mark and keeps the count", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "TREBLE"), dart(19, "SINGLE"), dart(18, "SINGLE")]);
    const state = play(engine, [MISS]);

    expect(state).toMatchObject({
      targetIndex: 0,
      currentChain: 0,
      bestChain: 5,
      markToBeat: 5,
      completedSequences: 1,
      hits: 3,
      dartsThrown: 4,
    });
  });

  it("undoing the dart that completes a sequence restores the count and target", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    play(engine, [dart(20, "SINGLE"), dart(19, "SINGLE"), dart(18, "TREBLE")]);
    expect(engine.state().completedSequences).toBe(1);
    engine.undo();

    expect(engine.state()).toMatchObject({
      currentTargetNumber: 18,
      targetIndex: 2,
      currentChain: 2,
      completedSequences: 0,
      hits: 2,
    });
  });

  it("keeps the larger mark when a later chain is shorter", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    const state = play(engine, [
      dart(20, "TREBLE"),
      dart(19, "TREBLE"),
      MISS,
      dart(20, "SINGLE"),
      MISS,
    ]);

    expect(state).toMatchObject({ markToBeat: 6, bestChain: 6 });
  });

  it("a miss on the opening dart records nothing", () => {
    const engine = new SwitchingTargetScoringEngine(CONFIG);
    const state = play(engine, [MISS]);

    expect(state).toMatchObject({
      targetIndex: 0,
      currentChain: 0,
      bestChain: 0,
      markToBeat: null,
      hits: 0,
      dartsThrown: 1,
    });
  });

  it("the factory builds the exported class", () => {
    expect(
      switchingTargetScoringEngineFactory.create(CONFIG),
    ).toBeInstanceOf(SwitchingTargetScoringEngine);
  });
});
```

- [ ] **Step 2: Run them against the unchanged engine.** Run `cd app && npx vitest run tests/modules/training/exercises/switching-target-scoring.engine.module.test.ts`. Expected: PASS. These are characterisation tests. If one fails, the test is wrong, not the engine: fix its arithmetic or fixture, and ledger it.

- [ ] **Step 3: Write the failing intent test.** In `target-scoring.engine.module.test.ts`, add `targetScoringIntent` to the `@modules/training/exercises/target-scoring.engine.module` import. Append at the end of the file:

```ts
describe("targetScoringIntent", () => {
  it("aims at the treble on a number and the bullseye on the bull", () => {
    expect(targetScoringIntent(20)).toEqual({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
    });
    expect(targetScoringIntent(25)).toEqual({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });
});
```

- [ ] **Step 4: Write the failing policy tests.** In `track-policies.test.ts`, add `resetOnMiss` to the `@modules/game/track-policies` import, and `SequenceTrackExt` to the `@modules/types` import. Append inside `describe("track policies", ...)`, before its closing `});`. The block reuses `on`, `FIVE`, `SEAT` and `initialTrackSeat`:

```ts
  const sequenced = (
    over: Partial<TrackSeat<SequenceTrackExt>> = {},
    ext: Partial<SequenceTrackExt> = {},
  ): TrackSeat<SequenceTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      chain: 0,
      finishedBest: null,
      hits: 0,
      sequences: 0,
      ...ext,
    }),
    ...over,
  });
  const struck = (hit: boolean, points: number) => ({
    observation: on(5, hit ? "TREBLE" : "DOUBLE"),
    target: FIVE,
    hit,
    points,
  });

  it("resetOnMiss: a hit grows the chain and moves to the next target", () => {
    expect(
      resetOnMiss(3)(sequenced({}, { chain: 1, hits: 1 }), struck(true, 3)),
    ).toMatchObject({
      targetIndex: 1,
      ext: { chain: 4, hits: 2, sequences: 0 },
    });
  });

  it("resetOnMiss: a hit on the last target wraps and counts a sequence", () => {
    expect(
      resetOnMiss(3)(
        sequenced({ targetIndex: 2 }, { chain: 2, hits: 2 }),
        struck(true, 1),
      ),
    ).toMatchObject({
      targetIndex: 0,
      ext: { chain: 3, hits: 3, sequences: 1 },
    });
  });

  it("resetOnMiss: a miss restarts and keeps the larger mark", () => {
    expect(
      resetOnMiss(3)(
        sequenced({ targetIndex: 2 }, { chain: 4, finishedBest: 3 }),
        struck(false, 0),
      ),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 0, finishedBest: 4 } });
    expect(
      resetOnMiss(3)(
        sequenced({ targetIndex: 1 }, { chain: 2, finishedBest: 5 }),
        struck(false, 0),
      ),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 0, finishedBest: 5 } });
  });

  it("resetOnMiss: a miss on an empty chain records no mark", () => {
    expect(
      resetOnMiss(3)(sequenced(), struck(false, 0)),
    ).toMatchObject({ targetIndex: 0, ext: { chain: 0, finishedBest: null } });
  });
```

- [ ] **Step 5: Run them.** Run `cd app && npx vitest run tests/modules/game/track-policies.test.ts tests/modules/training/exercises/target-scoring.engine.module.test.ts`. Expected: FAIL. `resetOnMiss` and `targetScoringIntent` are not exported; `SequenceTrackExt` is type-only, so vitest may not flag it.

- [ ] **Step 6: Implement the type, policy and shared intent.**
  - `modules/game/types.ts`, after `ChainTrackExt`:

```ts
/** Sequence bookkeeping for a Track seat (Switching Target Scoring): the live chain, the best chain a miss ended, hits so far, and full passes through the path. */
export type SequenceTrackExt = {
  chain: number;
  finishedBest: number | null;
  hits: number;
  sequences: number;
};
```

  - `track-policies.ts`: add `SequenceTrackExt` to the `./types` import. Append:

```ts
/**
 * Per-dart policy (Switching Target Scoring): a hit adds its points to the
 * chain and moves to the next of `length` targets, counting a sequence when
 * it wraps to the first; a miss restarts at the first target and ends the
 * chain, keeping the best chain a miss has ended.
 */
export function resetOnMiss<TExt extends SequenceTrackExt>(
  length: number,
): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt> {
  return (seat, dart) => {
    const { chain, finishedBest, hits, sequences } = seat.ext;
    if (dart.hit) {
      const targetIndex = (seat.targetIndex + 1) % length;
      return {
        ...seat,
        targetIndex,
        ext: {
          ...seat.ext,
          chain: chain + dart.points,
          hits: hits + 1,
          sequences: sequences + (targetIndex === 0 ? 1 : 0),
        },
      };
    }
    return {
      ...seat,
      targetIndex: 0,
      ext: {
        ...seat.ext,
        chain: 0,
        finishedBest:
          chain > 0 ? Math.max(finishedBest ?? 0, chain) : finishedBest,
      },
    };
  };
}
```

  - `target-scoring.engine.module.ts`: rename `function intentFor` to `export function targetScoringIntent`, and its one caller in `targetScoringSpec` (`intent: (state) => targetScoringIntent(state.currentTargetNumber)`). Nothing else changes.

  Run Step 5's command again. Expected: PASS.

- [ ] **Step 7: Rebind the engine.** Replace the whole of `switching-target-scoring.engine.module.ts` with:

```ts
import type { SwitchingTargetScoringConfigData } from "@lib/types";
import { SwitchingTargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  DartObservation,
  EngineFacts,
  SequenceTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import { numbersPath } from "@modules/game/board-progression.module";
import {
  foldTrackDarts,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import {
  closeAfter,
  pathTarget,
  resetOnMiss,
  sectionOf,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import type { DartExerciseSpec } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import {
  targetScoringIntent,
  targetScoringPoints,
} from "./target-scoring.engine.module";
import type { SwitchingTargetScoringState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_TARGET_SCORING_V1" as const;
const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Switching Target Scoring seat never finishes; only the timer ends the exercise.";
const SOLO_SEAT = {
  participantRef: SOLO_PARTICIPANT_REF,
  sideKey: SOLO_PARTICIPANT_REF,
};

/**
 * Switching Target Scoring's Track rules: the config's three targets in
 * order, scored as Target Scoring; `resetOnMiss` advances on a hit, wrapping
 * after the last, and restarts the sequence on a miss. Visits close after
 * three darts and carry no rule of their own.
 */
function switchingTargetScoringRules(
  config: SwitchingTargetScoringConfigData,
): TrackRules<SequenceTrackExt> {
  const pointsOn = (target: BoardTarget, observation: DartObservation) =>
    targetScoringPoints(sectionOf(target), observation);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(numbersPath(config.targets)),
    hit: (target, observation) => pointsOn(target, observation) !== null,
    points: (target, observation) => pointsOn(target, observation) ?? 0,
    onDart: resetOnMiss(config.targets.length),
    visitOpen: closeAfter(DARTS_PER_VISIT),
  };
}

function initialSeat(): TrackSeat<SequenceTrackExt> {
  return initialTrackSeat(SOLO_SEAT, {
    chain: 0,
    finishedBest: null,
    hits: 0,
    sequences: 0,
  });
}

/**
 * Folds the whole fact log into Switching Target Scoring state — a pure
 * function of `facts`/`config`/`complete`, folded through the Track kernel's
 * `foldTrackDarts`. Darts are replayed in write order, which is what
 * reproduces each dart's target.
 */
export function foldSwitchingTargetScoringState(
  facts: EngineFacts,
  config: SwitchingTargetScoringConfigData,
  complete: boolean,
): SwitchingTargetScoringState {
  const seat = foldTrackDarts(
    facts.turns,
    initialSeat(),
    switchingTargetScoringRules(config),
  );
  const { chain, finishedBest, hits, sequences } = seat.ext;

  return {
    currentTargetNumber: config.targets[seat.targetIndex],
    targetIndex: seat.targetIndex,
    currentChain: chain,
    bestChain: Math.max(finishedBest ?? 0, chain),
    markToBeat: finishedBest,
    completedSequences: sequences,
    hits,
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Switching Target Scoring's rules for the exercise shell: Target Scoring's
 * points on a three-target sequence — a hit advances, a miss resets the chain
 * and restarts the sequence
 * (`docs/game-rules/training/exercises/switching-target-scoring.md`). One
 * three-dart visit per `TurnFact`; the sequence carries across visits.
 */
const switchingTargetScoringSpec: DartExerciseSpec<
  SwitchingTargetScoringConfigData,
  SwitchingTargetScoringState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => SwitchingTargetScoringV1Config.parse(config),
  fold: foldSwitchingTargetScoringState,
  intent: (state) => targetScoringIntent(state.currentTargetNumber),
  isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
};

/** Switching Target Scoring exercise engine (D264), built by the exercise shell. */
export class SwitchingTargetScoringEngine extends dartExerciseEngineClass(
  switchingTargetScoringSpec,
) {}

export const switchingTargetScoringEngineFactory = dartExerciseEngineFactory(
  switchingTargetScoringSpec,
  SwitchingTargetScoringEngine,
);

registerDartExerciseEngineFactory(switchingTargetScoringEngineFactory);
```

  If `npm run check` reports a type mismatch where `routine-play.data.ts` or `lib/training/routines/types.ts` names `SwitchingTargetScoringEngine`, compare with how they name `TargetScoringEngine` (already shell-built) and match it; ledger the ruling. Do not edit those files otherwise.

- [ ] **Step 8: Flip the registry row** in `scripts/engine-kernels.txt` to:

```
app/src/modules/training/exercises/switching-target-scoring.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/switching-target-scoring.md |
```

  Run `bash scripts/check-engine-kernels.sh`. Expected: OK.

- [ ] **Step 9: Run everything.** `cd app && npm test`, in the background. Expected: all PASS, including:
  - the 5 oracle cases;
  - the 4 aimed goldens, with **no snapshot written** (`git status` shows no `__snapshots__` change);
  - every pre-existing Switching Target Scoring, Target Scoring, shell, routine, adapter and step-metrics test, unedited;
  - every other golden.

- [ ] **Step 10: Prove the oracle catches a rebind slip.** Do each of these separately; each must FAIL, then revert and confirm PASS. Record both for the PR body.
  1. In `resetOnMiss`, change `sequences: sequences + (targetIndex === 0 ? 1 : 0),` to `sequences,`. Every case must fail on `state.completedSequences`.
  2. In `resetOnMiss`, change the `finishedBest:` value to `finishedBest,`. Every case must fail on `state.markToBeat`.

  The policy tests fail too, which is expected.

- [ ] **Step 11: Gates.**
  - `cd app && npm run check`, in the background → 0/0/0.
  - `cd app && npx fallow`:
    - complexity clean;
    - dead-code clean (`resetOnMiss`, `SequenceTrackExt` and `targetScoringIntent` have callers);
    - duplication recorded.
  - From the repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-engine-kernels.sh && bash scripts/test-check-engine-kernels.sh && bash scripts/check-game-engines.sh`.

- [ ] **Step 12: Commit.**

```bash
git add app/src/modules/game app/src/modules/training/exercises app/tests/modules/game app/tests/modules/training/exercises scripts/engine-kernels.txt
git commit -m "refactor(switching-target-scoring): fold through the Track kernel on the exercise shell; resetOnMiss"
```

### Task 7.3: Delete the legacy copy, docs, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/training/exercises/legacy/switching-target-scoring.legacy.ts`, `app/tests/modules/training/exercises/switching-target-scoring.oracle.test.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md` (Track row ~line 830; version 1.11.6)
- Modify: `docs/architecture/00-File-Inventory.md` (`track-policies.ts`, `target-scoring.engine.module.ts`, `switching-target-scoring.engine.module.ts` rows)
- Modify: `docs/architecture/00-Context-Map-History.md` (append a row)
- Modify: `app/src/modules/training/CLAUDE.md` (exercise-shell bullet)

- [ ] **Step 1: Delete the legacy copy and the oracle.**
  - The guarantee stays with `switching-target-scoring.aimed.golden.test.ts`, recorded from the original engine and unchanged through Task 7.2 Step 9, plus the existing unit tests.
  - Commit 1 keeps the oracle's proof in history.
  - Remove `app/tests/modules/training/exercises/legacy/` if it is empty.

- [ ] **Step 2: Update `04-Architecture-patterns.md`.**
  - Track row status cell: `built — Doubles Training, Bob's 27, Singles Training, Around the Clock, Shanghai, Target Scoring, Switching Target Scoring bound (D468)`.
  - Version line: `1.11.7 (Pattern 18: Switching Target Scoring bound to the Track kernel and moved onto the exercise shell; Track phase 1 complete 2026-10-17, D468; prior 1.11.6: …`. Keep the rest of the chain.

- [ ] **Step 3: Update the File Inventory.**
  - `track-policies.ts` row: append "; `resetOnMiss` (Switching Target Scoring, 2026-10-17)".
  - `target-scoring.engine.module.ts` row: append "; exports `targetScoringIntent`, shared with Switching Target Scoring (2026-10-17)".
  - `switching-target-scoring.engine.module.ts` row: replace "`SwitchingTargetScoringEngine`/factory for" with "`SwitchingTargetScoringEngine`/factory (exercise-shell spec, folds through the Track kernel, D468, 2026-10-17) for".
  - Where a row cites the 04 version, update it to 1.11.7.

- [ ] **Step 4: Update `app/src/modules/training/CLAUDE.md`.** In the exercise-shell bullet, replace "A Track-family exercise folds its log through the kernel's `foldTrackDarts` with a `TrackRules` record, as Target Scoring does; there is no exercise adapter yet (Track spec §3). (2026-10-17, D468)" with: "A Track-family exercise folds its log through the kernel's `foldTrackDarts` with a `TrackRules` record, as Target Scoring and Switching Target Scoring do. There is no `trackExerciseSpec` adapter: the two specs differ only in key, `parse` and `fold`, and share `targetScoringIntent` (Track spec §3). (2026-10-17, D468)".

- [ ] **Step 5: Add the history row** to `00-Context-Map-History.md`:

```
| `switching-target-scoring.engine.module.ts`, `target-scoring.engine.module.ts`, `track-policies.ts`, `modules/game/types.ts`, `modules/training/CLAUDE.md`, their tests, `switching-target-scoring.aimed.golden.test.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (v1.11.7), `00-File-Inventory.md` | Switching Target Scoring bound to the Track kernel and moved from its hand-copied class onto the exercise shell (aimed goldens recorded pre-rebind, oracle over five configs with timer expiry); policy `resetOnMiss`; `targetScoringIntent` shared; no `trackExerciseSpec` or `outcome`. Track PR 7, phase 1 complete, D468 (2026-10-17) | historical |
```

- [ ] **Step 6: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. In particular:
  - `npm test` is green, with the count equal to Task 7.2's minus the 5 oracle tests;
  - `npx fallow` duplication is ≤ the Task 7.1 Step 0 baseline. If the aimed golden's setup pushes it over, accept a rise only if fallow names the existing aimed golden files as the clone pair, and say so in the PR body; otherwise extract the shared piece;
  - `check-doc-links.sh`, `check-context-budget.sh` (update the `00-Context-Map.md` token claims if they drift), `check-decision-ids.sh`, `check-doc-sync.sh`, `check-engine-kernels.sh` and `check-game-engines.sh` pass;
  - `cd app && npm run format` has been run, any diff committed, and `npm run format:check` is clean.

- [ ] **Step 7: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/training/exercises app/src/modules/training/CLAUDE.md docs
git commit -m "test(switching-target-scoring): drop legacy copy; goldens hold the guarantee (D468)"
git push -u origin refactor/track-kernel-switching-target-scoring
```

  Open the PR per `finishing-a-dart-branch`, with the body following `.github/pull_request_template.md`. Include:
  - the oracle cases, seeds, steps and the aimed rate;
  - all four mutation-check results (Task 7.1 Step 5 ×2, Task 7.2 Step 10 ×2);
  - fallow duplication before and after;
  - refinements 2 (no cycle helper), 3 (no `trackExerciseSpec`), 4 (no `outcome`) and 5 (shell swap);
  - that this closes phase 1.

  End the body with the generated line plus the session link. Subscribe and drive to green. Merge `origin/main` in (never rebase) on conflict.
