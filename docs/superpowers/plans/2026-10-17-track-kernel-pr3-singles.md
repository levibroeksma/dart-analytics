# Track Kernel — PR 3 (Singles Training) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Singles Training onto the game shell and the Track kernel with no change in behaviour. The shell gains the ability to serve several ruleset keys (V1–V3) from one spec.

**Architecture:**
- Singles Training becomes two things:
  - a `DartGameSpec` bound to `dart-engine-shell.module.ts` (it is a hand-written class today);
  - a `TrackRules<null>` record over `applyTrackDart` / `foldTrackSeats`.
- A projection maps `TrackSeat<null>` back to `SinglesTrainingSeatState`. The exported reducer, fold, `initialSinglesTrainingState`, `activeTargetOf` and `state()` keep their shape.
- Three policies land with this first caller: `anyRingEitherBull`, `pointsTable` and `outBelowHits`.
- The shell's multi-key change is additive (spec §6): `DartGameSpec.rulesetVersionKeys?`, a third constructor argument, and a third factory argument. `check-game-engines.sh` learns to read the new array.
- Proof runs in two stages:
  1. The differential oracle, with a new aimed-dart generator, proves the rebind against a frozen legacy copy.
  2. Goldens recorded in commit 1 hold the guarantee after the legacy copy is gone.

**Tech Stack:** TypeScript, Vitest, Bash, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (§2 Singles row, §5 Singles row, §6 `rulesetVersionKeys`, §7 method, §8 PR 3). Previous plan: `docs/superpowers/plans/2026-10-17-track-kernel-pr2-bobs27.md` (merged as #985).

## Global Constraints

- Branch `refactor/track-kernel-singles`, from `origin/main` at `d4071b0` or later. Never `--no-verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Types go in barrels (`modules/game/types.ts`, `interfaces.ts`). Tests import them from `@modules/types` / `@modules/interfaces`, never `@modules/game/types` (`check-type-barrels.sh`).
- No `//` comments inside function bodies. Use JSDoc above the declaration.
- Fallow: cognitive complexity ≤ 15 per function. Duplication may rise while the legacy copy exists, but must not exceed `main`'s count after Task 3.4. Record `main`'s count in Task 3.1 Step 0.
- `cd app && npm run check` reports 0 errors, 0 warnings, 0 hints.
- Run `npm test` from `app/`. `npm test` and `npm run check` run past the 120 s Bash limit, so run them with `run_in_background` and wait on the output file.
- This is a refactor:
  - Every existing test passes with **no edits**, in particular `singles-training.engine.module.test.ts`, `singles-training-play.data.test.ts`, `dart-engine-shell.module.test.ts` and the DartBot contract test.
  - New tests are appended only.
  - Existing snapshots stay unchanged.
- Preserve the quirk named in spec §7 and do not fix it: `activeSeat` is called without a completion predicate.
- `check-engine-kernels.sh` runs pre-commit and rejects a kernel-importing engine still marked `PENDING`. The registry flip therefore rides **commit 2**, not commit 3.
- The legacy copy must not leave an unused declaration behind. Un-exporting a function nobody else in the file calls trips ts(6133) as a hint, and that fails the 0-hint bar. Delete such functions from the copy.
- No D-entry. The multi-key shell is spec §6's additive change, inside D468. Confirm with `bash scripts/next-decision-id.sh` that D469 is still free (it was at plan time).

## Spec refinements made by this plan

1. **Policy names and shapes fixed:**

   | Spec name | Plan shape | Behaviour |
   | --- | --- | --- |
   | `anyRingEitherBull` | `(target, observation) => boolean` | NUMBER: same number and zone ∈ {SINGLE, INNER_SINGLE, OUTER_SINGLE, DOUBLE, TREBLE}. BULL: 25 and OUTER_BULL or INNER_BULL. |
   | `pointsTable` | `pointsTable(table: PointsTable)` | `PointsTable = { number: Partial<Record<DartZoneKey, number>>; bull: Partial<Record<DartZoneKey, number>> }`. The dart scores the target-kind row's entry for its zone, only when it lands on the target's own section. Otherwise it scores 0. |
   | `outBelowHits(n)` | `(seat) => seat` | On visit close, `OUT` when `hitsThisVisit < n`. With `n = 0` it never fires (EASY). |

   STANDARD and ACCURACY are two tables, not two policies. This reproduces `standardPointsFor` / `accuracyPointsFor` exactly, including:
   - keypad `SINGLE` scores 0 under ACCURACY;
   - a NUMBER-target dart on a bull zone scores 0.

   `isHitOn` from `board-progression` is **not** reused. It counts only INNER_BULL on BULL.

2. **Shell multi-key** (spec §6):
   - `DartGameSpec.rulesetVersionKeys?: readonly RulesetVersionKey[]` lists the extra keys the spec serves. `rulesetVersionKey` stays the default.
   - The shell class constructor takes an optional third `rulesetVersionKey` (default `spec.rulesetVersionKey`), as Singles' class does today.
   - `dartGameEngineFactory(spec, Engine, rulesetVersionKey = spec.rulesetVersionKey)` builds one factory per key. It throws at module load for a key the spec does not serve.
   - The constructor stays unguarded, as the legacy class was.
   - `check-game-engines.sh` reads keys from `rulesetVersionKeys: [...]` as well as `rulesetVersionKey: "…"`. Without that, it would see one Singles key and silently skip the multi-key resume check.
3. **The outcome stays in the fold. `TrackRules.outcome` is still not added.**
   - Singles and Bob's 27 share elimination, but the shared code is already one function (`eliminationWinner`).
   - The two compositions differ: Bob's 27 never falls back to a score compare, while Singles does.
   - An `outcome` member would move code without removing any.
   - Re-check at PR 4: Around the Clock is a race, and the third distinct outcome shape.
4. **No extras: `TExt = null`.** Singles' seat state already carries `dartsThisVisit` / `hitsThisVisit` as numbers, the kernel's own shape. `totalPoints` maps to `score`.
5. **Goldens are recorded in commit 1, before the rebind.** Singles has no golden file today; Bob's 27 already had one. Recording first means commit 2 proves itself against snapshots taken from the original engine, as well as against the oracle.
6. **The oracle gains an `observe` option.** `randomObservation` lands on the active target about 4 % of the time. Under HARD/EXTREME almost every seat would then die on its first visit, and the advance/complete paths would go untested.
   - `OracleOptions` and `TraceOptions` take `observe?: (rand, engine) => DartObservation`, defaulting to `randomObservation`.
   - The oracle passes the **legacy** engine.
   - Singles uses an aimed generator that hits the active seat's target 55 % of the time.
   - Existing goldens are unaffected, since the default is unchanged.

## Review Focus

1. **A blank BULL visit under HARD.** The seat must be `LOST`, not `COMPLETE`: OUT is checked before the path end. Pinned in Task 3.3 (boundary test 1).
2. **ACCURACY with a wrong-ring hit** (INNER_SINGLE on target). It counts toward the HARD/EXTREME mandatory hits but scores 0. Pinned in Task 3.3 (boundary test 3).
3. **EXTREME with one hit.** The seat is `LOST`, but that hit's points are still added: points accrue per dart, before the visit is judged. Pinned in Task 3.3 (boundary test 2).
4. **A V2/V3 session resumed from facts.** The rehydrated engine keeps its own `rulesetVersionKey` and is still a `SinglesTrainingEngine`, since the play page narrows with `instanceof`. Pinned in Task 3.3 (boundary test 5) and Task 3.2 (shell tests).
5. **A duo elimination mid-rotation.** The match is `COMPLETE` with the other side winning, while that seat is still `IN_PROGRESS`. The next `record` throws the *match-ended* message, not the session one. Pinned in Task 3.3 (boundary test 4).

---

### Task 3.1: Aimed oracle input, goldens, legacy copy and oracle (commit 1)

**Files:**
- Modify: `app/tests/modules/game/support/engine-oracle.ts` (`observe` option)
- Modify: `app/tests/modules/game/support/engine-oracle.test.ts` (append)
- Create: `app/tests/modules/game/support/singles-observations.ts`
- Create: `app/tests/modules/game/singles-training.golden.test.ts` (plus its `__snapshots__` file)
- Create: `app/tests/modules/game/legacy/singles-training.legacy.ts`
- Create: `app/tests/modules/game/singles-training.oracle.test.ts`

**Interfaces:**
- Consumes:
  - `runOracle`, `goldenTrace`, `randomObservation` and `normalise` from `support/engine-oracle.ts`;
  - `numbersPath` and `targetAt` from `@modules/game/board-progression.module`;
  - `activeSeatState` from `@modules/game/seat-state.module`.
- Produces:
  - `OracleOptions.observe?` and `TraceOptions.observe?`, both typed `(rand: () => number, engine: OracleEngine) => DartObservation`;
  - `aimedSinglesObservation(config: { targetOrder: readonly number[] }): (rand: () => number, engine: OracleEngine) => DartObservation`;
  - `LegacySinglesTrainingEngine` (test-only; deleted in Task 3.4).

- [ ] **Step 0: Baseline.** Run `cd app && npx fallow` on the fresh branch and record the duplication clone-group count. That is `main`'s count.

- [ ] **Step 1: Write the failing `observe` test.** Append inside `describe("runOracle", ...)` in `engine-oracle.test.ts`:

```ts
  it("feeds both sides the observation `observe` returns, given the legacy engine", () => {
    const seen: DartObservation[] = [];
    const legacy = counter();
    let legacyEngine: OracleEngine | undefined;
    const fixed: DartObservation = {
      hitTargetNumber: 7,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    };
    runOracle({
      build: (prior) => {
        const e = counter()(prior);
        const record = e.record;
        e.record = (o) => {
          seen.push(o);
          return record(o);
        };
        return e;
      },
      legacy: (prior) => (legacyEngine = legacy(prior)),
      seeds: [1],
      steps: 5,
      observe: (_rand, engine) => {
        expect(engine).toBe(legacyEngine);
        return fixed;
      },
    });
    expect(seen).toEqual([fixed, fixed, fixed, fixed, fixed]);
  });
```

  Also append inside `describe("goldenTrace", ...)`:

```ts
  it("traces the observation `observe` returns", () => {
    const trace = goldenTrace({
      build: counter(),
      seed: 1,
      steps: 2,
      undoRate: 0,
      rehydrateEvery: 100,
      observe: () => ({
        hitTargetNumber: 7,
        hitZoneKey: "TREBLE",
        locationX: null,
        locationY: null,
      }),
    }) as { steps: string[] };
    expect(trace.steps[0]).toMatch(/^record TREBLE\/7 /);
  });
```

  Run `cd app && npx vitest run tests/modules/game/support/engine-oracle.test.ts`. Expected: both new tests FAIL, the first on `seen` and the second on the regex. TypeScript-in-Vitest does not type-check, so the unknown `observe` key does not stop the run.

- [ ] **Step 2: Implement `observe`.** In `engine-oracle.ts`:

```ts
type Observe = (rand: () => number, engine: OracleEngine) => DartObservation;
```

  - Add `observe?: Observe;` to both `OracleOptions` and `TraceOptions`.
  - In `act`, replace `throwDart(pair, randomObservation(rand), where);` with:

```ts
  throwDart(pair, (opts.observe ?? randomObservation)(rand, pair.old), where);
```

  - In `traceStep`, replace `const o = randomObservation(rand);` with:

```ts
  const o = (opts.observe ?? randomObservation)(rand, engine);
```

  Re-run the test file. Expected: all PASS. Then run the existing goldens, `npx vitest run tests/modules/game/bobs27.golden.test.ts tests/modules/game/doubles-training.golden.test.ts`. Expected: PASS, with no snapshot written.

- [ ] **Step 3: Write the aimed generator** `app/tests/modules/game/support/singles-observations.ts`:

```ts
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { activeSeatState } from "@modules/game/seat-state.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import type {
  DartObservation,
  DartZoneKey,
  SinglesTrainingState,
} from "@modules/types";

const RINGS: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

/**
 * 55 % a dart on the active seat's own target, in any ring (keypad SINGLE
 * included), otherwise `randomObservation`. Enough on-target darts that
 * HARD/EXTREME seats survive visits and reach BULL.
 */
export function aimedSinglesObservation(config: {
  targetOrder: readonly number[];
}): (rand: () => number, engine: OracleEngine) => DartObservation {
  const path = numbersPath(config.targetOrder);
  return (rand, engine) => {
    if (rand() >= 0.55) return randomObservation(rand);
    const seat = activeSeatState(engine.state() as SinglesTrainingState);
    const target = targetAt(path, seat.targetIndex);
    const base = { locationX: null, locationY: null };
    if (target.kind === "BULL")
      return {
        ...base,
        hitTargetNumber: 25,
        hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
      };
    return {
      ...base,
      hitTargetNumber: target.number,
      hitZoneKey: RINGS[Math.floor(rand() * RINGS.length)]!,
    };
  };
}
```

  If `activeSeatState`'s parameter type rejects `SinglesTrainingState`, pass `engine.state() as Parameters<typeof activeSeatState>[0]` and read `targetIndex` off the result cast to `{ targetIndex: number }`.

- [ ] **Step 4: Record the goldens** in `app/tests/modules/game/singles-training.golden.test.ts`. Do this before any engine change.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { aimedSinglesObservation } from "./support/singles-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type {
  RulesetVersionKey,
  Seated,
  SinglesSnapshot,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const ASCENDING = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const POINTS = { pointsSingle: 1, pointsDouble: 2, pointsTreble: 3 };

const CONFIGS: Record<
  string,
  {
    key: RulesetVersionKey;
    config:
      | Seated<SinglesSnapshot>
      | Seated<SinglesV2Snapshot>
      | Seated<SinglesV3Snapshot>;
  }
> = {
  "v1 duo": {
    key: "SINGLES_V1",
    config: {
      orderMode: "LOW_TO_HIGH",
      targetOrder: ASCENDING,
      difficulty: "EASY",
      ...POINTS,
      seats: seats(2),
    },
  },
  "v2 hard duo": {
    key: "SINGLES_V2",
    config: {
      orderMode: "LOW_TO_HIGH",
      targetOrder: ASCENDING,
      difficulty: "HARD",
      ...POINTS,
      seats: seats(2),
    },
  },
  "v3 accuracy extreme trio": {
    key: "SINGLES_V3",
    config: {
      orderMode: "LOW_TO_HIGH",
      targetOrder: ASCENDING,
      difficulty: "EXTREME",
      scoringMode: "ACCURACY",
      ...POINTS,
      seats: seats(3),
    },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Singles Training — golden", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new SinglesTrainingEngine(config, undefined, key);
      const observe = aimedSinglesObservation(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 200 && !engine.isComplete(); i += 1) {
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

describe("Singles Training — golden trace", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SinglesTrainingEngine(config, prior, key),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          observe: aimedSinglesObservation(config),
        }),
      ).toMatchSnapshot();
    });
  }
});
```

  Run `cd app && npx vitest run tests/modules/game/singles-training.golden.test.ts`. Expected: 6 PASS, with snapshots written. Open the `.snap` file and check two things:
  - at least one trace reaches `targetIndex` ≥ 10;
  - the HARD or EXTREME runs contain a `LOST` seat.

  If neither holds, the generator is not exercising the paths. Raise the 0.55 to 0.7 and re-record.

- [ ] **Step 5: Copy the legacy module.** Run `cp app/src/modules/game/singles-training.engine.module.ts app/tests/modules/game/legacy/singles-training.legacy.ts`. In the copy:
  - Rewrite every `./x` import as `@modules/game/x`, and `./types` / `./interfaces` as `@modules/types` / `@modules/interfaces`.
  - Delete the three `export const singlesTraining*EngineFactory = ...` blocks and their three `registerEngineFactory(...)` calls, and drop the `registerEngineFactory` and `GameEngineFactory` imports.
  - Rename the class to `LegacySinglesTrainingEngine`.
  - Remove `export` from every function.
  - Delete `initialSinglesTrainingState`. Nothing else in the file calls it, so un-exported it trips ts(6133). Any other un-exported function nobody calls goes too: `activeTargetOf` stays (the reducer calls it), and so does `foldSinglesTrainingState` (the class calls it).

- [ ] **Step 6: Write the oracle test** `app/tests/modules/game/singles-training.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import { LegacySinglesTrainingEngine } from "./legacy/singles-training.legacy";
import { runOracle } from "./support/engine-oracle";
import { aimedSinglesObservation } from "./support/singles-observations";
import type {
  RulesetVersionKey,
  Seated,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const ASCENDING = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const DESCENDING = [
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 25,
];
const seated = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const v2 = (
  seats: number,
  over: Partial<SinglesV2Snapshot> = {},
): Seated<SinglesV2Snapshot> => ({
  orderMode: "LOW_TO_HIGH",
  targetOrder: ASCENDING,
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
  ...over,
  seats: seated(seats),
});
const v3 = (
  seats: number,
  over: Partial<SinglesV3Snapshot>,
): Seated<SinglesV3Snapshot> => ({
  ...v2(seats),
  scoringMode: "STANDARD",
  ...over,
});
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [
  string,
  RulesetVersionKey,
  Seated<SinglesV2Snapshot> | Seated<SinglesV3Snapshot>,
][] = [
  ["v1 solo", "SINGLES_V1", v2(1)],
  ["v1 duo", "SINGLES_V1", v2(2)],
  ["v1 trio", "SINGLES_V1", v2(3)],
  ["v2 hard duo", "SINGLES_V2", v2(2, { difficulty: "HARD" })],
  ["v2 extreme trio", "SINGLES_V2", v2(3, { difficulty: "EXTREME" })],
  [
    "v3 accuracy hard duo",
    "SINGLES_V3",
    v3(2, { difficulty: "HARD", scoringMode: "ACCURACY" }),
  ],
  [
    "v3 standard extreme solo, descending, 2/5/9",
    "SINGLES_V3",
    v3(1, {
      orderMode: "HIGH_TO_LOW",
      targetOrder: DESCENDING,
      difficulty: "EXTREME",
      pointsSingle: 2,
      pointsDouble: 5,
      pointsTreble: 9,
    }),
  ],
];

describe("Singles Training — kernel vs legacy oracle", () => {
  for (const [name, key, cfg] of CASES) {
    it(
      `${name}: indistinguishable through every public method`,
      () => {
        runOracle({
          build: (prior) => new SinglesTrainingEngine(cfg, prior, key),
          legacy: (prior) => new LegacySinglesTrainingEngine(cfg, prior, key),
          seeds: SEEDS,
          steps: 260,
          undoRate: 0.12,
          rehydrateEvery: 19,
          observe: aimedSinglesObservation(cfg),
        });
      },
      60_000,
    );
  }
});
```

  V1 configs are V2-shaped with `difficulty: "EASY"`; the engine reads V1 and V2 configs identically.

- [ ] **Step 7: Run it.** Run `cd app && npx vitest run tests/modules/game/singles-training.oracle.test.ts`. Expected: 7 PASS, since the engine and the legacy copy are the same code. Note the wall time. If any case nears 60 s, drop `steps` to 200 for all cases and say so in the PR body.

- [ ] **Step 8: Prove the oracle can fail.** In the legacy copy's `requiredHitsFor`, change `return 1;` to `return 2;` and run again. Expected: FAIL in the HARD cases. Revert, re-run, and confirm PASS. Record the result for the PR body.

- [ ] **Step 9: Gates and commit.**
  - Run `cd app && npm run check`, in the background. Expected: 0/0/0. A hint in the legacy copy means an unused declaration; delete it.
  - Run `npm test`, in the background. Expected: all PASS.
  - Commit:

```bash
git add app/tests/modules/game
git commit -m "test(singles): freeze legacy engine, aimed oracle input, goldens"
```

### Task 3.2: Shell multi-key and the engine gate

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`DartGameSpec`, `DartGameEngineClass`)
- Modify: `app/src/modules/game/dart-engine-shell.module.ts`
- Modify: `scripts/check-game-engines.sh`
- Test: `app/tests/modules/game/dart-engine-shell.module.test.ts` (append)

**Interfaces:**
- Consumes: `DartGameSpec`, `DartGameEngineClass`, `dartGameEngineClass` and `dartGameEngineFactory` as on `main`.
- Produces:
  - `DartGameSpec<TConfig, TState>.rulesetVersionKeys?: readonly RulesetVersionKey[]`;
  - `DartGameEngineClass`, whose constructor is `new (config: TConfig, prior?: EngineFacts, rulesetVersionKey?: RulesetVersionKey)`;
  - `dartGameEngineFactory(spec, Engine, rulesetVersionKey?: RulesetVersionKey): GameEngineFactory<TConfig, DartObservation, TState>`. It throws `"<KEY> is not served by this spec"` for an unserved key.

- [ ] **Step 1: Write the failing shell tests.** Append to `dart-engine-shell.module.test.ts`:

```ts
describe("multi-key specs", () => {
  const multi: DartGameSpec<{ limit: number }, Toy> = {
    ...spec,
    rulesetVersionKey: "SINGLES_V1",
    rulesetVersionKeys: ["SINGLES_V2", "SINGLES_V3"],
  };
  const Multi = dartGameEngineClass(multi);

  it("defaults an instance to the spec's own key", () => {
    expect(new Multi({ limit: 3 }).rulesetVersionKey).toBe("SINGLES_V1");
  });

  it("builds one factory per served key over the one class", () => {
    const v2 = dartGameEngineFactory(multi, Multi, "SINGLES_V2");
    expect(v2.rulesetVersionKey).toBe("SINGLES_V2");
    const engine = v2.create({ limit: 10 });
    expect(engine).toBeInstanceOf(Multi);
    expect(engine.rulesetVersionKey).toBe("SINGLES_V2");
  });

  it("keeps the key across rehydration", () => {
    const v3 = dartGameEngineFactory(multi, Multi, "SINGLES_V3");
    const first = v3.create({ limit: 10 });
    first.record(T20);
    expect(v3.create({ limit: 10 }, first.facts()).rulesetVersionKey).toBe(
      "SINGLES_V3",
    );
  });

  it("refuses a key the spec does not serve", () => {
    expect(() => dartGameEngineFactory(spec, Toy, "SINGLES_V2")).toThrow(
      "SINGLES_V2 is not served by this spec",
    );
  });
});
```

  Run `cd app && npx vitest run tests/modules/game/dart-engine-shell.module.test.ts`. Expected: the factory-key, rehydration and refusal tests FAIL. The default-key test may already pass.

- [ ] **Step 2: Implement.**

  In `interfaces.ts`, add to `DartGameSpec` after `rulesetVersionKey`:

```ts
  /** Further ruleset versions this one spec serves; `rulesetVersionKey` is the default. */
  readonly rulesetVersionKeys?: readonly RulesetVersionKey[];
```

  Change `DartGameEngineClass`'s constructor signature to:

```ts
  new (
    config: TConfig,
    prior?: EngineFacts,
    rulesetVersionKey?: RulesetVersionKey,
  ): ShellGameEngine<TConfig, TState>;
```

  In `dart-engine-shell.module.ts`:
  - Add `import type { RulesetVersionKey } from "@lib/types";`.
  - In the class, replace `readonly rulesetVersionKey = spec.rulesetVersionKey;` with `readonly rulesetVersionKey: RulesetVersionKey;`, and change the constructor to:

```ts
    constructor(
      private readonly config: TConfig,
      prior?: EngineFacts,
      rulesetVersionKey: RulesetVersionKey = spec.rulesetVersionKey,
    ) {
      this.rulesetVersionKey = rulesetVersionKey;
      this.turns = prior ? cloneTurns(prior.turns) : [];
    }
```

  - Replace `dartGameEngineFactory`. Its JSDoc becomes "The registry-facing factory for one ruleset key of a shell-built engine class (default: the spec's own key).":

```ts
export function dartGameEngineFactory<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
  Engine: DartGameEngineClass<TConfig, TState>,
  rulesetVersionKey: RulesetVersionKey = spec.rulesetVersionKey,
): GameEngineFactory<TConfig, DartObservation, TState> {
  const served = [spec.rulesetVersionKey, ...(spec.rulesetVersionKeys ?? [])];
  if (!served.includes(rulesetVersionKey))
    throw new Error(`${rulesetVersionKey} is not served by this spec`);
  return {
    rulesetVersionKey,
    stageOwnership: spec.stageOwnership,
    create: (config, prior) => new Engine(config, prior, rulesetVersionKey),
  };
}
```

  Re-run the shell test file. Expected: all PASS.

- [ ] **Step 3: Teach the gate the array.** In `scripts/check-game-engines.sh`, add this function above the first loop that reads `KEYS`:

```bash
# A module's ruleset keys: every `rulesetVersionKey: "X"` plus every key
# listed in a one-line `rulesetVersionKeys: ["X", "Y"]` (several keys, one spec).
engine_keys() {
  {
    grep -oE 'rulesetVersionKey[[:space:]]*[:=][[:space:]]*"[A-Z0-9_]+"' "$1"
    grep -oE 'rulesetVersionKeys[[:space:]]*:[[:space:]]*\[[^]]*\]' "$1"
  } | grep -oE '"[A-Z0-9_]+"' | tr -d '"' | sort -u
}
```

  Replace both `KEYS=$(grep -oE 'rulesetVersionKey…' "$file" | grep -oE … | sort -u)` assignments (around lines 65 and 101) with `KEYS=$(engine_keys "$file")`.

  Run `bash scripts/check-game-engines.sh`. Expected: OK, with an unchanged key list for every engine (Singles still lists V1–V3 from its current literals). Diff the output against `git stash; bash scripts/check-game-engines.sh; git stash pop`. The lines must be identical.

- [ ] **Step 4: No commit yet.** Task 3.2 has no caller of `rulesetVersionKeys` until Task 3.3, so it commits together with Task 3.3.

### Task 3.3: Track policies and the Singles rebind (commit 2)

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `PointsTable`)
- Modify: `app/src/modules/game/track-policies.ts` (append three policies)
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Modify: `scripts/engine-kernels.txt` (Singles row → `KERNEL_BOUND`)
- Test: `app/tests/modules/game/track-policies.test.ts`, `app/tests/modules/game/singles-training.engine.module.test.ts` (append only)

**Interfaces:**
- Consumes:
  - Task 3.2's multi-key shell;
  - #984/#985's `pathTarget`, `advanceToEnd`, `closeAfter`, `applyTrackDart` and `foldTrackSeats`.
- Produces:
  - `PointsTable` (in the `@modules/types` barrel);
  - `anyRingEitherBull(target: BoardTarget, observation: DartObservation): boolean`;
  - `pointsTable(table: PointsTable): (target: BoardTarget, observation: DartObservation) => number`;
  - `outBelowHits<TExt>(hits: number): (seat: TrackSeat<TExt>) => TrackSeat<TExt>`.
- The engine's exports are unchanged in name and call shape: `initialSinglesTrainingState`, `activeTargetOf`, `applySinglesTrainingDart(config, state, observation)`, `foldSinglesTrainingState(facts, config)`, `SinglesTrainingEngine` (constructor `(config, prior?, rulesetVersionKey?)`) and the three factories.

- [ ] **Step 1: Write the boundary tests.** These characterise the legacy behaviour at the projection's seams. Append them to `singles-training.engine.module.test.ts`, which already imports `applySinglesTrainingDart`, `SinglesTrainingEngine`, `singlesTrainingEngineFactory`, `SinglesTrainingSeatState` and `DartObservation`, and defines `config` (V1 EASY, ascending, 1/2/3) and `SEATS`. Add these to the imports if they are absent:
  - `singlesTrainingV2EngineFactory` and `singlesTrainingV3EngineFactory` from the engine module;
  - `SinglesV2Snapshot`, `SinglesV3Snapshot` and `Seated` from `@lib/types`;
  - `DartZoneKey` from `@modules/types`.

```ts
describe("Singles Training — Track kernel boundaries", () => {
  const at = (
    over: Partial<SinglesTrainingSeatState>,
  ): SinglesTrainingSeatState => ({
    participantRef: "participant-1",
    sideKey: "A",
    targetIndex: 4,
    totalPoints: 7,
    dartsThisVisit: 2,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
    ...over,
  });
  const dart = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });
  const v2 = (
    difficulty: SinglesV2Snapshot["difficulty"],
  ): Seated<SinglesV2Snapshot> => ({ ...config, difficulty });
  const v3 = (
    over: Partial<SinglesV3Snapshot>,
  ): Seated<SinglesV3Snapshot> => ({
    ...config,
    difficulty: "EASY",
    scoringMode: "STANDARD",
    ...over,
  });

  it("1: a blank BULL visit under HARD loses, not completes", () => {
    expect(
      applySinglesTrainingDart(
        v2("HARD"),
        at({ targetIndex: 20 }),
        dart(null, "MISS"),
      ),
    ).toEqual(
      at({ targetIndex: 20, dartsThisVisit: 0, status: "LOST" }),
    );
  });

  it("2: EXTREME with one hit loses but keeps that hit's points", () => {
    expect(
      applySinglesTrainingDart(v2("EXTREME"), at({}), dart(5, "TREBLE")),
    ).toEqual(
      at({ totalPoints: 10, dartsThisVisit: 0, status: "LOST" }),
    );
  });

  it("3: ACCURACY counts an inner single as a HARD hit but scores it 0", () => {
    const hard = v3({ difficulty: "HARD", scoringMode: "ACCURACY" });
    expect(applySinglesTrainingDart(hard, at({}), dart(5, "INNER_SINGLE"))).toEqual(
      at({ targetIndex: 5, dartsThisVisit: 0 }),
    );
    expect(
      applySinglesTrainingDart(hard, at({ dartsThisVisit: 0 }), dart(5, "OUTER_SINGLE")),
    ).toEqual(at({ totalPoints: 8, dartsThisVisit: 1, hitsThisVisit: 1 }));
    expect(
      applySinglesTrainingDart(hard, at({ dartsThisVisit: 0 }), dart(5, "SINGLE")),
    ).toEqual(at({ dartsThisVisit: 1, hitsThisVisit: 1 }));
  });

  it("4: a duo elimination ends the match mid-rotation with the match-ended refusal", () => {
    const engine = new SinglesTrainingEngine(
      { ...v2("HARD"), seats: SEATS_DUO },
      undefined,
      "SINGLES_V2",
    );
    expect(engine.wouldComplete(dart(null, "MISS"))).toBe(false);
    engine.record(dart(null, "MISS"));
    engine.record(dart(null, "MISS"));
    expect(engine.wouldComplete(dart(null, "MISS"))).toBe(true);
    const state = engine.record(dart(null, "MISS"));
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe(SEATS_DUO[1].sideKey);
    expect(state.seats[1].status).toBe("IN_PROGRESS");
    expect(() => engine.record(dart(1, "SINGLE"))).toThrow(
      "Cannot record a dart once the match has ended; undo first to correct it.",
    );
  });

  it("5: V2 and V3 factories rehydrate with their own key, as the one class", () => {
    for (const [factory, key] of [
      [singlesTrainingV2EngineFactory, "SINGLES_V2"],
      [singlesTrainingV3EngineFactory, "SINGLES_V3"],
    ] as const) {
      const cfg = v3({});
      const first = factory.create(cfg);
      first.record(dart(1, "SINGLE"));
      const resumed = factory.create(cfg, first.facts());
      expect(factory.rulesetVersionKey).toBe(key);
      expect(resumed.rulesetVersionKey).toBe(key);
      expect(resumed).toBeInstanceOf(SinglesTrainingEngine);
      expect(resumed.state()).toEqual(first.state());
    }
  });
});
```

  The arithmetic, with the default order where `targetIndex` 4 is target 5:
  - **Test 2:** TREBLE on 5 scores `pointsTreble` 3, so 7 + 3 = 10. One hit is below EXTREME's 2.
  - **Test 3:** INNER_SINGLE scores 0 under ACCURACY, but HARD needs only 1 hit, so the seat advances to index 5. OUTER_SINGLE scores 1 (8). Keypad SINGLE scores 0 but is a hit.
  - **Test 4:** `SEATS_DUO` is two seats. If the test file has no two-seat fixture, define it locally: `const SEATS_DUO = [SEATS[0], { ...SEATS[0], participantRef: "participant-2", displayName: "P2", sideKey: "B" }];`. Before the third dart, seat A has 2 darts and 0 hits; the third blank dart eliminates A.
  - **Test 5:** `v3({})` satisfies both V2 and V3 config shapes. If the factory's config type rejects it for V2, pass `v2("EASY")` to the V2 factory.

- [ ] **Step 2: Run them against the unchanged engine.** Run `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`. Expected: PASS. These are characterisation tests, and they must hold before and after the rebind. If one fails, the test is wrong, not the engine: fix the test's arithmetic or fixture.

- [ ] **Step 3: Write the failing policy tests.** In `track-policies.test.ts`, add `anyRingEitherBull, outBelowHits, pointsTable` to the import list, and add `DartObservation` and `DartZoneKey` to the type import from `@modules/types` if they are absent. Append inside `describe("track policies", ...)`:

```ts
  const on = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });
  const FIVE = { kind: "NUMBER", number: 5 } as const;
  const BULL = { kind: "BULL" } as const;

  it("anyRingEitherBull: any ring on the number, either bull on BULL", () => {
    for (const zone of [
      "SINGLE",
      "INNER_SINGLE",
      "OUTER_SINGLE",
      "DOUBLE",
      "TREBLE",
    ] as const)
      expect(anyRingEitherBull(FIVE, on(5, zone))).toBe(true);
    expect(anyRingEitherBull(FIVE, on(6, "TREBLE"))).toBe(false);
    expect(anyRingEitherBull(FIVE, on(null, "MISS"))).toBe(false);
    expect(anyRingEitherBull(BULL, on(25, "OUTER_BULL"))).toBe(true);
    expect(anyRingEitherBull(BULL, on(25, "INNER_BULL"))).toBe(true);
    expect(anyRingEitherBull(BULL, on(5, "SINGLE"))).toBe(false);
  });

  it("pointsTable: the target kind's row, only on the target's own section", () => {
    const points = pointsTable({
      number: { OUTER_SINGLE: 1, TREBLE: 9 },
      bull: { INNER_BULL: 4 },
    });
    expect(points(FIVE, on(5, "TREBLE"))).toBe(9);
    expect(points(FIVE, on(5, "OUTER_SINGLE"))).toBe(1);
    expect(points(FIVE, on(5, "DOUBLE"))).toBe(0);
    expect(points(FIVE, on(6, "TREBLE"))).toBe(0);
    expect(points(BULL, on(25, "INNER_BULL"))).toBe(4);
    expect(points(BULL, on(25, "OUTER_BULL"))).toBe(0);
    expect(points(BULL, on(5, "TREBLE"))).toBe(0);
  });

  it("outBelowHits: OUT when the visit hit fewer than n, untouched otherwise", () => {
    expect(outBelowHits(2)(seat({ hitsThisVisit: 1 })).status).toBe("OUT");
    expect(outBelowHits(2)(seat({ hitsThisVisit: 2 })).status).toBe(
      "IN_PROGRESS",
    );
    expect(outBelowHits(0)(seat({ hitsThisVisit: 0 })).status).toBe(
      "IN_PROGRESS",
    );
  });
```

  Run `cd app && npx vitest run tests/modules/game/track-policies.test.ts`. Expected: the three new tests FAIL on the missing exports.

- [ ] **Step 4: Implement the policies.** In `modules/game/types.ts`, next to `JudgedDart`, add:

```ts
/** Points per zone for a Track ruleset: one row for NUMBER targets, one for BULL; an absent zone scores 0. */
export type PointsTable = {
  readonly number: Partial<Record<DartZoneKey, number>>;
  readonly bull: Partial<Record<DartZoneKey, number>>;
};
```

  `DartZoneKey` is already in scope in `types.ts`. If it is not, import it the way the file's other zone-typed declarations do.

  Append to `track-policies.ts`, extending the imports to `BULL_TARGET_NUMBER, targetAt` from `./board-progression.module` and `BoardTarget, DartObservation, DartZoneKey, PointsTable, TrackSeat` from `./types`:

```ts
const ANY_RING: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
]);

const EITHER_BULL: ReadonlySet<DartZoneKey> = new Set([
  "OUTER_BULL",
  "INNER_BULL",
]);

/** The board number a target's darts must land on: its own number, or 25 for BULL. */
function sectionOf(target: BoardTarget): number {
  return target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number;
}

/** Hit policy: any ring on a NUMBER target's number, either bull on BULL. */
export function anyRingEitherBull(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  const zones = target.kind === "BULL" ? EITHER_BULL : ANY_RING;
  return (
    observation.hitTargetNumber === sectionOf(target) &&
    zones.has(observation.hitZoneKey)
  );
}

/** Points policy: the target kind's row of `table` for the dart's zone, 0 off the target's section. */
export function pointsTable(
  table: PointsTable,
): (target: BoardTarget, observation: DartObservation) => number {
  return (target, observation) => {
    if (observation.hitTargetNumber !== sectionOf(target)) return 0;
    const row = target.kind === "BULL" ? table.bull : table.number;
    return row[observation.hitZoneKey] ?? 0;
  };
}

/** Visit-close policy: a visit with fewer than `hits` hits puts the seat `OUT`. */
export function outBelowHits<TExt>(
  hits: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.hitsThisVisit < hits ? { ...seat, status: "OUT" } : seat;
}
```

  Re-run `track-policies.test.ts`. Expected: all PASS.

- [ ] **Step 5: Rebind the engine.** Rewrite `singles-training.engine.module.ts` as follows, keeping every exported name.

  **Imports.**
  - Keep `registerEngineFactory`.
  - Drop:
    - the `GameEngine` / `GameEngineFactory` types;
    - `foldSeatStates`;
    - `appendObservedDart`, `cloneTurns`, `exerciseBlockStage`, `openOrCreateTurn` and `undoLastDart`;
    - `BULL_TARGET_NUMBER`;
    - `TurnFact`, `DartZoneKey` and `RulesetVersionKey`.
  - Add:
    - `dartGameEngineClass, dartGameEngineFactory` from `./dart-engine-shell.module`;
    - `applyTrackDart, foldTrackSeats` from `./track-kernel.module`;
    - `advanceToEnd, anyRingEitherBull, closeAfter, outBelowHits, pathTarget, pointsTable` from `./track-policies`;
    - `DartGameSpec, TrackRules` from `./interfaces`;
    - `DartIntent, PointsTable, TrackSeat` from `./types`.
  - Keep `numbersPath`, `targetAt`, `activeSeat`, `activeSeatState`, `otherSeatsComplete`, `eliminationWinner` and `scoreCompareOutcome`. If `DartIntent` is not in the `./types` barrel, import it from wherever `turn-log.module.ts` imports it.

  **Keep unchanged:**
  - `SinglesEngineConfig`;
  - `initialSeatState`;
  - `initialSinglesTrainingState`;
  - `requiredHitsFor`;
  - `scoringModeOf`;
  - `activeTargetOf`;
  - `foldSinglesTrainingState`'s outcome block and its `activeParticipantRef` line (the quirk stays).

  **Delete:**
  - `STAGE`;
  - `SINGLE_ZONE_KEYS`;
  - `isHitOnTarget`;
  - `accuracyPointsFor`;
  - `standardPointsFor`;
  - `trainingPointsFor`;
  - the hand-written class;
  - the three hand-written factories.

  **Add**, after `activeTargetOf`:

```ts
const MATCH_ENDED =
  "Cannot record a dart once the match has ended; undo first to correct it.";
const SESSION_DONE =
  "Cannot record a dart once the session is complete; undo first to correct it.";

/** Accuracy scoring: 1 for the outer single on a NUMBER target or either bull, 0 for every other ring. */
const ACCURACY_POINTS: PointsTable = {
  number: { OUTER_SINGLE: 1 },
  bull: { OUTER_BULL: 1, INNER_BULL: 1 },
};

/** Standard scoring: the configured single/double/treble values; outer bull as a single, inner as a double. */
function standardPoints(config: SinglesEngineConfig): PointsTable {
  const { pointsSingle: s, pointsDouble: d, pointsTreble: t } = config;
  return {
    number: { SINGLE: s, INNER_SINGLE: s, OUTER_SINGLE: s, DOUBLE: d, TREBLE: t },
    bull: { OUTER_BULL: s, INNER_BULL: d },
  };
}

const TO_TRACK = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "DONE",
  LOST: "OUT",
} as const;
const FROM_TRACK = {
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "COMPLETE",
  OUT: "LOST",
} as const;

/**
 * Singles Training as Track policies: the configured 21-target path, any
 * ring or either bull is a hit, points from the STANDARD or ACCURACY table,
 * three-dart visits; a visit below the difficulty's mandatory hits is out,
 * before clearing BULL is checked.
 */
function singlesRules(config: SinglesEngineConfig): TrackRules<null> {
  const path = numbersPath(config.targetOrder);
  const judge = outBelowHits<null>(requiredHitsFor(config.difficulty));
  const advance = advanceToEnd<null>(path.length - 1);
  return {
    doneMessage: SESSION_DONE,
    target: pathTarget(path),
    hit: anyRingEitherBull,
    points: pointsTable(
      scoringModeOf(config) === "ACCURACY"
        ? ACCURACY_POINTS
        : standardPoints(config),
    ),
    visitOpen: closeAfter(3),
    onVisitClose: (seat) => {
      const judged = judge(seat);
      return judged.status === "OUT" ? judged : advance(judged);
    },
  };
}

/** Lifts a Singles seat into the kernel's shape: `totalPoints` is the score, no extras. */
function toTrackSeat(state: SinglesTrainingSeatState): TrackSeat<null> {
  const { totalPoints, status, ...progress } = state;
  return { ...progress, score: totalPoints, status: TO_TRACK[status], ext: null };
}

/** Projects a kernel seat back to Singles Training's seat state. */
function toSinglesSeat(seat: TrackSeat<null>): SinglesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    totalPoints: seat.score,
    dartsThisVisit: seat.dartsThisVisit,
    hitsThisVisit: seat.hitsThisVisit,
    status: FROM_TRACK[seat.status],
  };
}
```

  `path.length - 1` is 20, because the config schema pins `target_order` to length 21. That makes it equal to the legacy hard-coded `targetIndex === 20`.

  **`applySinglesTrainingDart`.**
  - Keep the signature.
  - Change the JSDoc lead to "Pure reducer, via the Track kernel:", and keep the `@throws`.
  - The body becomes:

```ts
  return toSinglesSeat(
    applyTrackDart(toTrackSeat(state), observation, singlesRules(config)),
  );
```

  **`foldSinglesTrainingState`.** The seats line becomes:

```ts
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => null,
    singlesRules(config),
  ).map(toSinglesSeat);
```

  **Spec, class and factories.** These replace the old class and factories. Move the old class JSDoc's surviving paragraphs onto `singlesSpec` and the `NO_INTENT` constant: the null-intent rationale, which carries its "Do not restore either field" warning, and the two-level guard rationale. Drop the paragraphs about `completedAt` / undo / `rulesetVersionKey`, which the shell now owns.

```ts
/**
 * Both intention columns are always null — Singles treats single, double
 * and treble on the current segment as equally valid, so no ring is "the"
 * intended one, and a target number with a null zone is rejected by
 * `chk_dart_target_consistency` (migration `0007`). The intended target is
 * recoverable from the visit index. Do not restore either field.
 */
const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * Singles Training's rules for the dart engine shell, serving V1–V3: 21
 * targets, three darts each, scored per ring. Refused at the match level
 * first — HARD/EXTREME elimination can end the match while another seat is
 * still `IN_PROGRESS` — then at the seat level.
 */
const singlesSpec: DartGameSpec<SinglesEngineConfig, SinglesTrainingState> = {
  rulesetVersionKey: "SINGLES_V1",
  rulesetVersionKeys: ["SINGLES_V2", "SINGLES_V3"],
  stageOwnership: "PER_SEAT",
  fold: foldSinglesTrainingState,
  refusal: (state) => {
    if (state.status !== "IN_PROGRESS") return MATCH_ENDED;
    return activeSeatState(state).status === "IN_PROGRESS"
      ? null
      : SESSION_DONE;
  },
  intent: () => NO_INTENT,
  isVisitOpen: (turn) => turn.darts.length < 3,
  wouldComplete: (state, observation, config) => {
    if (state.status !== "IN_PROGRESS") return false;
    const seat = activeSeatState(state);
    if (seat.status !== "IN_PROGRESS" || seat.dartsThisVisit < 2) return false;
    const after = applySinglesTrainingDart(config, seat, observation);
    if (after.status !== "COMPLETE") return after.status === "LOST";
    return otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status === "COMPLETE",
    );
  },
};

/**
 * Singles Training engine (Pattern 18), built by the dart engine shell; one
 * class for V1–V3, the key passed per factory. EASY decides by
 * score-compare; HARD/EXTREME can end the match by elimination.
 */
export class SinglesTrainingEngine extends dartGameEngineClass(singlesSpec) {}

export const singlesTrainingEngineFactory = dartGameEngineFactory(
  singlesSpec,
  SinglesTrainingEngine,
);

registerEngineFactory(singlesTrainingEngineFactory);

export const singlesTrainingV2EngineFactory = dartGameEngineFactory(
  singlesSpec,
  SinglesTrainingEngine,
  "SINGLES_V2",
);

registerEngineFactory(singlesTrainingV2EngineFactory);

export const singlesTrainingV3EngineFactory = dartGameEngineFactory(
  singlesSpec,
  SinglesTrainingEngine,
  "SINGLES_V3",
);

registerEngineFactory(singlesTrainingV3EngineFactory);
```

  - `foldSinglesTrainingState` and `applySinglesTrainingDart` are function declarations, so they are hoisted above `singlesSpec`. The `MATCH_ENDED` / `SESSION_DONE` / table constants must be declared above their first use at module-evaluation time, so keep them above `singlesSpec`.
  - The legacy `record()` also refused when the match had ended and stamped `completedAt` on the 3rd dart. The shell does both: `refusal`, then `!isVisitOpen(turn)`.
  - The factories' config types widen from each version's own snapshot to the `SinglesEngineConfig` union. Every caller passes a member of that union. If `npm run check` flags a caller, it is a type-only fix at that call site, never a cast in the engine.

- [ ] **Step 6: Flip the registry row** in `scripts/engine-kernels.txt` to:

```
app/src/modules/game/singles-training.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/rulesets/singles-training.md |
```

- [ ] **Step 7: Run everything.**
  - Run `cd app && npm test`, in the background. Expected: all PASS, with:
    - the 7 oracle cases;
    - the 6 Singles goldens, with **no snapshot written** (`git status` shows no `__snapshots__` change);
    - every pre-existing Singles, play-data, shell, DartBot-contract, derived-aims, replay and session-progress test, unedited;
    - the Bob's 27 and Doubles goldens.
  - Run `bash scripts/check-game-engines.sh`. Expected: OK. The Singles line lists `SINGLES_V1 SINGLES_V2 SINGLES_V3`, now read from `rulesetVersionKey: "SINGLES_V1"` plus the array, and `singles-training-play.data.ts` still references all three.
  - Prove the gate reads the array: temporarily change `"SINGLES_V3"` in `rulesetVersionKeys` to `"SINGLES_V9"` and run the gate. Expected: FAIL ("no entry in …"). Revert.

- [ ] **Step 8: Prove the oracle catches a rebind slip.** Temporarily swap `onVisitClose` so `advance` runs before `judge`, then run the oracle. Expected: FAIL (a HARD seat that blanks BULL ends `COMPLETE`). Revert and confirm PASS. Record this for the PR body.

- [ ] **Step 9: Gates.**
  - `cd app && npm run check`, in the background → 0/0/0.
  - `cd app && npx fallow` → complexity is clean, dead-code is clean (every new policy and the spec field has a caller), and duplication is recorded.
  - From the repo root: `bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-engines.sh`.

- [ ] **Step 10: Commit** (Task 3.2 + 3.3 together).

```bash
git add app/src/modules/game app/tests/modules/game scripts/check-game-engines.sh scripts/engine-kernels.txt
git commit -m "refactor(singles): shell + Track kernel; shell serves several ruleset keys"
```

### Task 3.4: Delete the legacy copy, docs, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/game/legacy/singles-training.legacy.ts`, `app/tests/modules/game/singles-training.oracle.test.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md` (shell paragraph ~line 818; Track row ~line 830; version 1.11.3)
- Modify: `docs/architecture/00-File-Inventory.md` (the `track-policies.ts` row; the `check-game-engines.sh` row)
- Modify: `docs/architecture/00-Context-Map-History.md` (append a row)

- [ ] **Step 1: Delete the legacy copy and the oracle.**
  - The guarantee stays with `singles-training.golden.test.ts` (goldens plus step traces). Those were recorded from the original engine in commit 1 and passed unchanged in Task 3.3 Step 7. That is the same guarantee re-pointed, as the Hard Invariant requires.
  - Commit 1 keeps the oracle's proof in history.
  - Remove `app/tests/modules/game/legacy/` if it is now empty.
  - `support/singles-observations.ts` stays, because the goldens use it.

- [ ] **Step 2: Update `04-Architecture-patterns.md`.**
  - In the shell paragraph (~line 818), after "…which owns the log, keys, `completedAt`, undo and rehydration.", insert: "One spec may serve several ruleset versions (`rulesetVersionKeys`): one class, one factory per key, as Singles Training V1–V3 does."
  - In the Track row status cell, write: `built — Doubles Training, Bob's 27, Singles Training bound (D468)`.
  - Version line: `1.11.3 (Pattern 18: Singles Training bound to the Track kernel; the game shell serves several ruleset keys per spec 2026-10-17, D468; prior 1.11.2: …`. Keep the rest of the chain.
  - Frontmatter `updated:` is already 2026-10-17.

- [ ] **Step 3: Update the File Inventory rows.**
  - `track-policies.ts`: append "; `anyRingEitherBull`, `pointsTable`, `outBelowHits` (Singles Training, 2026-10-17)".
  - `check-game-engines.sh`: append "; reads `rulesetVersionKeys: [...]` too (2026-10-17)".
  - Where the 04 row cites a version, update it to 1.11.3.

- [ ] **Step 4: Add the history row** to `00-Context-Map-History.md`:

```
| `singles-training.engine.module.ts`, `dart-engine-shell.module.ts`, `track-policies.ts`, `modules/game/{types,interfaces}.ts`, their tests, `support/{engine-oracle,singles-observations}.ts`, `singles-training.golden.test.ts`, `scripts/check-game-engines.sh`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (v1.11.3), `00-File-Inventory.md` | Singles Training moved onto the game shell and bound to the Track kernel (oracle with aimed input, then goldens recorded pre-rebind); shell gains `rulesetVersionKeys` + per-key factories; policies `anyRingEitherBull`, `pointsTable`, `outBelowHits`. Track PR 3, D468 (2026-10-17) | historical |
```

- [ ] **Step 5: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. In particular:
  - `npm test` is green, with the count equal to Task 3.3's minus the 7 oracle tests;
  - `npx fallow` duplication is ≤ the Task 3.1 Step 0 baseline;
  - `bash scripts/check-doc-links.sh`, `check-context-budget.sh` (update the token claims if they drift), `check-decision-ids.sh`, `check-engine-kernels.sh` and `check-game-engines.sh` pass;
  - `cd app && npm run format` has been run, any diff is committed, and `npm run format:check` is clean.

- [ ] **Step 6: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/game docs
git commit -m "test(singles): drop legacy copy; goldens hold the guarantee (D468)"
git push -u origin refactor/track-kernel-singles
```

  Open the PR per `finishing-a-dart-branch`, with the body following `.github/pull_request_template.md`. Include:
  - the oracle cases, seeds and steps, plus the aimed generator's hit rate;
  - both mutation-check results (Task 3.1 Step 8, Task 3.3 Step 8), plus the gate check (Task 3.3 Step 7);
  - the fallow duplication before and after;
  - the `activeSeat` quirk named as preserved;
  - the `TrackRules.outcome` deferral and its reason (refinement 3).

  End the body with the generated line plus the session link. Subscribe to the PR's activity and drive it to green. Merge `origin/main` in (never rebase) if it conflicts.
