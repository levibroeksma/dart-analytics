# Track T2.1 — Halve-It Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Halve-It V1 as a playable routine-step exercise on the Track kernel, end to end, after first removing the T1 copy-paste it would extend. That includes discovered-work issues #1048, #1049 and #1050.

**Architecture:**
- **Reuse prep (Tasks 1–3), behaviour unchanged:**
  - one exercise-adapter factory, one recorder/timer loop and shared label/rate helpers on the routine client;
  - one engine-tail helper (#1050), one empty-config schema and one exercise-type enum;
  - a data-driven step-metrics field map (#1048).
- **Zone targets (Task 4):** zone targets get their own `ZoneTarget` type. A defaulted `TTarget` type parameter on `TrackRules` lets a Track ruleset aim at them. `BoardTarget` itself is unchanged.
- **The exercise (Tasks 5–11):**
  - Halve-It is a `trackExerciseSpec` exercise: path `HALVE_IT_PATH`, hit `anyRingEitherBull`, points `boardScorePoints`.
  - Visit close runs `halveOnBlank` → `advanceAfterDarts(3)` → `passOnWrap(8)`.
  - Seed `0047` makes the type real, and one parameterised verification script covers every Track exercise seed (#1049).

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (T2.1). Rules: `docs/game-rules/training/exercises/halve-it.md`. Model plan: `docs/superpowers/plans/2026-10-18-track-t1-doubles-lock.md`. Discovered-work issue #1051 (card-level tags) belongs to T2.3 Nine Lives, not here.

## Global Constraints

- **Branch:** `feat/track-t2-halve-it`, cut from `docs/track-t2-rules` at `8db0aec`.
  - The PR targets `main` and carries the rules and spec commits with it (one branch, no stack).
  - Never merge to `main`; never use `--no-verify`.
- **TDD** per `app/CLAUDE.md` §TDD:
  - write the failing test first, watch it fail, then write the code;
  - run commands from `app/` with `npm test -- <path>`;
  - a pure refactor (Tasks 1–3) runs green before and after, and its appended test pins the guarantee.
- **Comments:** no `//` or `/* */` comments inside function bodies. JSDoc goes above declarations only, with no decision history.
- **Quality gates:**
  - fallow complexity ≤ 15 and CRAP ≤ 30;
  - no unused exports;
  - `npm run validate:app` exits 0 with the type gate at 0/0/0. It needs a temporary `app/.env` holding `DATABASE_URL=postgres://postgres@localhost:5433/integration?sslmode=disable`; delete the file afterwards.
- **Type-check:** run `npm run check` at the end of every code task.
- **Coverage gate:** `scripts/check-test-coverage.sh` runs per commit. Every changed `app/src` runtime file needs a test that imports it, touched in the same commit. Each task's Files list names that test.
- **Tests:**
  - Existing tests are append-only.
  - An assertion that lists every kind may gain the new kind. That needs a ledgered ruling, and only when the guarantee stays the same.
  - Where a subject migrates (Task 8's SQL shape), the assertion is re-pointed at the same guarantee by a ledgered ruling (root `CLAUDE.md` test invariant).
- **Migrations:** never modify `0001`–`0048`. This PR has no schema change.
- **Seed:** number `0047`; the highest on `main` is `0046`. Seed ids, none in use:
  - type `0199a000-0000-7000-8000-00000000000f`
  - ruleset `0199a100-0000-7000-8000-00000000000f`
  - template `0199b000-0000-7000-8000-000000000016`
- **Decision:** `D478` (Task 12). `bash scripts/next-decision-id.sh` printed `D478` on 2026-10-21; re-run it before the PR and renumber with `scripts/renumber-decision.sh` if it moved.
- **Discovered work:** anything else goes to a GitHub issue labelled `discovered-work`; never fix it here.
- **Commits:**
  - Every commit ends with this trailer:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
    ```
  - The commit hook is slow: use a 400000 ms timeout and redirect its output to a log in the workspace.
- **Before the PR:** `cd app && npm run format && npm run format:check`.
- **Naming:**
  - code: `HalveIt` / `halveIt` / `HALVE_IT`; files `halve-it.*`;
  - display label: `Halve-It`;
  - panel: `"halve-it"`; preview family: `"halveIt"`; slot: `halveItEngine`.
- **Duplication:**
  - Task 1 Step 0 records `npx fallow dupes --mode semantic --min-tokens 30 <path>` for five paths.
  - Task 13 re-runs it.
  - No path's duplicated-line count may rise.

## Spec refinements (write back into the spec on approval)

1. **Zone targets keep `BoardTarget` closed (§1, §2.1).** Approach A as written (widening `BoardTarget`) fails the type gate:
   - a probe gave 33 errors in 20 files, 12 of them in existing tests that are append-only;
   - every game reads `target.number` after ruling out BULL.

   Instead:
   - `ZoneTarget = { kind: "ANY_DOUBLE" } | { kind: "ANY_TREBLE" }` and `TrackTarget = BoardTarget | ZoneTarget`.
   - `TrackRules`, `JudgedDart`, `applyTrackDart`/`foldTrackSeats`/`foldTrackDarts`, `TrackExerciseDefinition` and `trackExerciseSpec` gain `TTarget extends TrackTarget = BoardTarget`.
   - The default leaves every existing engine and test untouched (probe: 0 errors).
   - `isHitOn`, `boardTargetLabel`, `targetAt`, `pathTarget`, `anyRingEitherBull`, `tallyOnTarget` and `boardScorePoints` accept `TrackTarget`.
   - `sectionOf` and `pointsTable` stay `BoardTarget`; no zone path reaches them.
   - Decision D478.
2. **Halve-It's hit policy is `anyRingEitherBull` alone (§3).** On a zone target it defers to `isHitOn`, so no engine-local hit composition is needed.
3. **`rateOf` is the existing `checkoutPercentageDisplay` (§2.0)** in `lib/game/play-visit-stats.ts`, which already returns "—" over no attempts. The routine-play rate getters and `hitRateRow` call it, so no new helper is added. `targetLabelOf` stays module-local in `routine-play.data.ts`.
4. **Adapter factory (§2.0):**
   - `dartExerciseAdapter` lives in the new `adapters/dart-exercise.adapter.ts`.
   - The twelve per-kind adapter files stay as one factory call each, because their tests import them.
   - One table-driven test covers all twelve.
   - `DartEngineSlot = keyof ExerciseEngineSlots | "bullUpEngine"` is added to `routines/types.ts`.
5. **Recorders (§2.0):**
   - The `record…Dart` methods stay, because existing tests call them by name. `dartRecorders()` generates them from `DART_ENGINE_RECORDERS`.
   - `COMPLETES_ON_DART` (Catch 40 today; Doubles S&L in T2.2) replaces the hand-written completion branch.
   - The step deadline expires every slot in one loop.
6. **Validator:** `HALVE_IT_V1` registers `makeConfigValidator(HalveItV1Config)` inline in `services/exercise-rulesets/registry.ts`. There is no per-type validator file.
7. **Discovered work folded into T2.1 (§9):**
   - **#1048:** `stepMetrics` reads a `STATE_FIELDS` map; only Switching Standard keeps its own branch.
   - **#1049:** `database/verification/0047_exercise_type_seed_checks.sql` checks every Track exercise seed from one `expected` table. It replaces `0038_hit_count_seed_checks.sql`, `0039_switchblade_seed_checks.sql` and `0040_doubles_lock_seed_checks.sql`, and T2.2 adds one row.
   - **#1050:** `registerDartExercise(spec)` in `dart-exercise-shell.module.ts` returns `{ Engine, factory, fold }` and registers the factory. It is used by Hit Count, SwitchBlade, Doubles Lock, Target Scoring, Switching Chain and Halve-It.
   - **#1051** stays with T2.3.
8. **Tag links survive a type seeded after `0042` (§6).** `0042_catalog_tags.sql` runs before `0047`, so its `VALUES` row for `HALVE_IT` would insert a NULL `exercise_type_id`. That aborts `db:seed`'s first pass on any database.
   - `generate-tag-seed.ts` now writes exercise links as `INSERT … SELECT * FROM (VALUES …) AS v (…) WHERE v.exercise_type_id IS NOT NULL`.
   - The first pass skips the not-yet-seeded type; the second pass (D248) links it.
   - One generator test's header assertion is re-pointed: the subject migrated, the guarantee is the same.
9. **State (§4):**
   - `HalveItState` adds `targetIndex`, for the chip index, and `hitsPerTarget`, for the summary rows.
   - `halvings` counts every blank visit, including one at a total of 0.
   - Halving rounds half up, so a total of 1 stays 1.
10. **Preview (§4):**
    - `visitPreview` passes the visit index to `judge` as a third argument.
    - `judgeDart(family, dart, visitIndex)` gains the parameter; existing judges ignore it.
    - The `halveIt` family judges and captions each visit against `HALVE_IT_PATH[visitIndex % 9]`.
11. **Route chip.** `RouteChips` splits on spaces, so chip parts use a no-break space ("Any double").
12. **Integration fixture.** Halve-It is step 15; `statistics-sql.itest.ts`'s `toHaveLength(14)` becomes 15 by ruling.

## Review Focus

1. **Outer bull on Any double is a blank visit.** `[OUTER_BULL, MISS, MISS]` halves the total. `[INNER_BULL, …]` scores 50. Pinned in Task 4 (`isHitOn ANY_DOUBLE`) and Task 6 (`the bullseye counts in Any double; the outer bull does not`).
2. **A ring on the wrong kind is no hit.** D19 during Any treble, T19 during Any double, and a dart in 5 during the 20 round all halve. Pinned in Task 6 (`a double does not count in Any treble`, `only the round's number scores`).
3. **Undo across a halving** restores the pre-halving total, 48 → 95. Pinned in Task 6 (`undo restores the total a halving took`).
4. **After the list wraps,** visit 10's preview judges against 20, not Bull, and pass 2 carries the total. Pinned in Task 6 (`a pass restarts at 20 and carries the total`) and Task 11 (`judges a wrapped visit against 20`).
5. **A fresh database seeds cleanly.** With `0042` running before `0047`, `db:seed` must not abort, and the second pass links `HALVE_IT`'s tags. Pinned in Task 8 (fresh-database run and the generator test `skips a type the seeds have not inserted yet`).

---

### Task 1: Reuse prep — routine client (adapter factory, recorders, label/rate helpers)

**Files:**
- Create: `app/src/lib/training/routines/adapters/dart-exercise.adapter.ts`
- Modify: the twelve exercise adapters in `app/src/lib/training/routines/adapters/`:
  - `switching`, `switching-chain`, `double-pattern`, `target-scoring`;
  - `score-threshold`, `bullseye-checkout`, `bull-up`, `checkout-sequence`;
  - `random-checkout`, `hit-count`, `switchblade`, `doubles-lock`.
- Modify: `app/src/lib/training/routines/types.ts`, `app/src/lib/training/routines/routine-play.data.ts`, `app/src/modules/training/routines/routine-summary.module.ts`
- Test:
  - Create: `app/tests/lib/training/routines/adapters/dart-exercise.adapter.test.ts`. It imports all twelve adapters, so it covers them for the coverage gate.
  - Append: `app/tests/lib/training/routines/routine-play.data.test.ts`, `app/tests/modules/training/routines/routine-summary.module.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DartEngineSlot = keyof ExerciseEngineSlots | "bullUpEngine";   // routines/types.ts
  export function dartExerciseAdapter<TSlot extends DartEngineSlot>(input: {
    key: StepAdapterKey; headerLabel: string; title: string; panel: StepPanel;
    rulesetKey: ExerciseRulesetVersionKey; slot: TSlot;
    engineClass: abstract new (...args: never[]) => NonNullable<RoutinePlayContext[TSlot]>;
    summarise: (engine: NonNullable<RoutinePlayContext[TSlot]>) => RoutineStepSummary;
  }): StepAdapter;
  ```
- In `routine-play.data.ts`, module-local: `dartRecorders()`, `COMPLETES_ON_DART: ReadonlySet<DartEngineSlot>`, `targetLabelOf(target: BoardTarget | undefined): string`.

- [ ] **Step 0: Duplication baseline.** From `app/`, run this and record each path's "N lines … duplicated" line in the ledger as `Pre-flight: dupes baseline`:
  ```bash
  for p in src/lib/training/routines src/modules/training/exercises src/modules/stats/step-metrics.module.ts src/lib/training/exercises/rulesets/types.ts src/pages/api/training-sessions/types.ts; do echo "== $p"; npx fallow dupes --mode semantic --min-tokens 30 $p 2>&1 | tail -1; done
  ```
  Expected, from 2026-10-21: 2,416 / 2,154 / 157 / 323 / 361 lines.

- [ ] **Step 1: Write the failing test** `dart-exercise.adapter.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { playExerciseKind } from "../../../stats/replay-step-games";
import { dartExerciseAdapter } from "@lib/training/routines/adapters/dart-exercise.adapter";
import { switchingAdapter } from "@lib/training/routines/adapters/switching.adapter";
import { switchingChainAdapter } from "@lib/training/routines/adapters/switching-chain.adapter";
import { doublePatternAdapter } from "@lib/training/routines/adapters/double-pattern.adapter";
import { targetScoringAdapter } from "@lib/training/routines/adapters/target-scoring.adapter";
import { scoreThresholdAdapter } from "@lib/training/routines/adapters/score-threshold.adapter";
import { bullseyeCheckoutAdapter } from "@lib/training/routines/adapters/bullseye-checkout.adapter";
import { bullUpAdapter } from "@lib/training/routines/adapters/bull-up.adapter";
import { checkoutSequenceAdapter } from "@lib/training/routines/adapters/checkout-sequence.adapter";
import { randomCheckoutAdapter } from "@lib/training/routines/adapters/random-checkout.adapter";
import { hitCountAdapter } from "@lib/training/routines/adapters/hit-count.adapter";
import { switchbladeAdapter } from "@lib/training/routines/adapters/switchblade.adapter";
import { doublesLockAdapter } from "@lib/training/routines/adapters/doubles-lock.adapter";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import type { StepAdapter } from "@lib/interfaces";
import type { DartEngineSlot, RoutinePlayContext } from "@lib/types";
import type { DartExerciseKind } from "@modules/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

const CASES: [StepAdapter, DartExerciseKind, DartEngineSlot][] = [
  [switchingAdapter, "SWITCHING:STANDARD", "switchingEngine"],
  [switchingChainAdapter, "SWITCHING:CHAIN", "switchingChainEngine"],
  [doublePatternAdapter, "DOUBLE_PATTERN", "doublePatternEngine"],
  [targetScoringAdapter, "TARGET_SCORING", "targetScoringEngine"],
  [scoreThresholdAdapter, "SCORE_THRESHOLD", "scoreThresholdEngine"],
  [bullseyeCheckoutAdapter, "BULLSEYE_CHECKOUT", "bullseyeCheckoutEngine"],
  [bullUpAdapter, "BULL_UP", "bullUpEngine"],
  [checkoutSequenceAdapter, "CHECKOUT_SEQUENCE", "checkoutSequenceEngine"],
  [randomCheckoutAdapter, "RANDOM_CHECKOUT", "randomCheckoutEngine"],
  [hitCountAdapter, "HIT_COUNT", "hitCountEngine"],
  [switchbladeAdapter, "SWITCHBLADE", "switchbladeEngine"],
  [doublesLockAdapter, "DOUBLES_LOCK", "doublesLockEngine"],
];

function makeContext(): RoutinePlayContext {
  return {
    ...Object.fromEntries(CASES.map(([, , slot]) => [slot, null])),
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultFor(kind: DartExerciseKind): StartTrainingStepResponseData {
  const { header } = playExerciseKind(kind);
  return {
    sessionId: "s1",
    exerciseTypeKey: header.exerciseTypeKey,
    configuration: header.configuration,
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("dart exercise adapters", () => {
  it.each(CASES)(
    "%#: open() fills only its own slot with its ruleset's engine and starts the step timer",
    (adapter, kind, slot) => {
      const ctx = makeContext();
      adapter.open(ctx, resultFor(kind), 600);
      const engine = ctx[slot];
      expect(engine?.exerciseRulesetVersionKey).toBe(
        playExerciseKind(kind).header.exerciseRulesetVersionKey,
      );
      for (const [, , other] of CASES)
        if (other !== slot) expect(ctx[other]).toBeNull();
      expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
      expect(adapter.completesOwnSession).toBe(false);
    },
  );

  it.each(CASES)(
    "%#: facts() and summarise() are null before open() and read the engine after",
    (adapter, kind, slot) => {
      const ctx = makeContext();
      expect(adapter.facts(ctx)).toBeNull();
      expect(adapter.summarise(ctx)).toBeNull();
      adapter.open(ctx, resultFor(kind), 600);
      expect(adapter.facts(ctx)).toEqual(ctx[slot]!.facts());
      expect(adapter.summarise(ctx)?.stepKey).toBe(kind);
    },
  );

  it.each(CASES)("%#: close() empties its slot", (adapter, kind, slot) => {
    const ctx = makeContext();
    adapter.open(ctx, resultFor(kind), 600);
    adapter.close(ctx);
    expect(ctx[slot]).toBeNull();
  });

  it("leaves the slot empty when the registry builds an engine of another class", () => {
    const adapter = dartExerciseAdapter({
      key: "DOUBLES_LOCK",
      headerLabel: "x",
      title: "x",
      panel: "doubles-lock",
      rulesetKey: "SWITCHBLADE_V1",
      slot: "doublesLockEngine",
      engineClass: DoublesLockEngine,
      summarise: () => ({ stepKey: "DOUBLES_LOCK", label: "x", rows: [] }),
    });
    const ctx = makeContext();
    adapter.open(ctx, resultFor("SWITCHBLADE"), 600);
    expect(ctx.doublesLockEngine).toBeNull();
  });
});
```
If `DartEngineSlot` is not reachable through `@lib/types`, import it from `@lib/training/routines/types`. `routines/types.ts` is re-exported by the `@lib/types` barrel.

- [ ] **Step 2: Run** `npm test -- tests/lib/training/routines/adapters/dart-exercise.adapter.test.ts`
Expected: FAIL, because the `dart-exercise.adapter` module and `DartEngineSlot` are not found.

- [ ] **Step 3: Implement the factory.**

In `routines/types.ts`, add this just above `/** What \`visitLabelsFor()\` reads`:
```ts
/** Every dart exercise's engine slot on the routine play context. */
export type DartEngineSlot = keyof ExerciseEngineSlots | "bullUpEngine";
```

`adapters/dart-exercise.adapter.ts`:
```ts
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { RoutineStepSummary } from "@modules/types";
import type { DartEngineSlot, RoutinePlayContext } from "../types";
import type { StepAdapter } from "./interfaces";
import type { StepAdapterKey, StepPanel } from "./types";

type SlotEngine<TSlot extends DartEngineSlot> = NonNullable<
  RoutinePlayContext[TSlot]
>;

/**
 * Builds the `StepAdapter` for one dart exercise: `open` builds its engine
 * from the registry into `slot` and starts the step timer, `facts` and
 * `summarise` read that engine, `close` empties the slot.
 */
export function dartExerciseAdapter<TSlot extends DartEngineSlot>(input: {
  key: StepAdapterKey;
  headerLabel: string;
  title: string;
  panel: StepPanel;
  rulesetKey: ExerciseRulesetVersionKey;
  slot: TSlot;
  engineClass: abstract new (...args: never[]) => SlotEngine<TSlot>;
  summarise: (engine: SlotEngine<TSlot>) => RoutineStepSummary;
}): StepAdapter {
  const engineOf = (ctx: RoutinePlayContext): SlotEngine<TSlot> | null =>
    ctx[input.slot] as SlotEngine<TSlot> | null;
  return {
    key: input.key,
    headerLabel: input.headerLabel,
    title: input.title,
    panel: input.panel,
    open(ctx, result, durationSeconds) {
      const created = getDartExerciseEngineFactory(input.rulesetKey)?.create(
        result.configuration,
      );
      Object.assign(ctx, {
        [input.slot]: created instanceof input.engineClass ? created : null,
      });
      ctx.startStepTimer(durationSeconds);
    },
    facts(ctx) {
      return engineOf(ctx)?.facts() ?? null;
    },
    completesOwnSession: false,
    summarise(ctx) {
      const engine = engineOf(ctx);
      return engine ? input.summarise(engine) : null;
    },
    close(ctx) {
      Object.assign(ctx, { [input.slot]: null });
    },
  };
}
```

- [ ] **Step 4: Rewrite the twelve adapters** as one call each. Use this shape, shown here for `hit-count.adapter.ts`:
```ts
import { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import { summariseHitCount } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const hitCountAdapter = dartExerciseAdapter({
  key: "HIT_COUNT",
  headerLabel: "Hit Count",
  title: "Hit Count",
  panel: "hit-count",
  rulesetKey: "HIT_COUNT_V1",
  slot: "hitCountEngine",
  engineClass: HitCountEngine,
  summarise: (engine) => summariseHitCount(engine.state()),
});
```
The values are copied from today's files and must not change:

| File | export | key | headerLabel | title | panel | rulesetKey | slot | engineClass | summarise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `switching` | `switchingAdapter` | `SWITCHING` | `switching` | `Switching` | `switching` | `SWITCHING_V1` | `switchingEngine` | `SwitchingEngine` | `summariseSwitching(engine.state(), engine.facts())` |
| `switching-chain` | `switchingChainAdapter` | `SWITCHING_CHAIN` | `switching chain` | `Switching Chain` | `switching-chain` | `SWITCHING_CHAIN_V1` | `switchingChainEngine` | `SwitchingChainEngine` | `summariseSwitchingChain(engine.state())` |
| `double-pattern` | `doublePatternAdapter` | `DOUBLE_PATTERN` | `doubles` | `Double Pattern` | `double-pattern` | `DOUBLE_PATTERN_V1` | `doublePatternEngine` | `DoublePatternEngine` | `summariseDoublePattern(engine.state())` |
| `target-scoring` | `targetScoringAdapter` | `TARGET_SCORING` | `target scoring` | `Target Scoring` | `target-scoring` | `TARGET_SCORING_V1` | `targetScoringEngine` | `TargetScoringEngine` | `summariseTargetScoring(engine.state())` |
| `score-threshold` | `scoreThresholdAdapter` | `SCORE_THRESHOLD` | `65 or more` | `65 or More` | `score-threshold` | `SCORE_THRESHOLD_V1` | `scoreThresholdEngine` | `ScoreThresholdEngine` | `summariseScoreThreshold(engine.state())` |
| `bullseye-checkout` | `bullseyeCheckoutAdapter` | `BULLSEYE_CHECKOUT` | `Bullseye checkouts` | `Bullseye Checkouts` | `bullseye-checkout` | `BULLSEYE_CHECKOUT_V1` | `bullseyeCheckoutEngine` | `BullseyeCheckoutEngine` | `summariseBullseyeCheckout(engine.state())` |
| `bull-up` | `bullUpAdapter` | `BULL_UP` | `Bull up practice` | `Bull Up Practice` | `bull-up` | `BULL_UP_V1` | `bullUpEngine` | `BullUpEngine` | `summariseBullUp(engine.state())` |
| `checkout-sequence` | `checkoutSequenceAdapter` | `CHECKOUT_SEQUENCE` | `Catch 40` | `Catch 40` | `checkout-sequence` | `CHECKOUT_SEQUENCE_V1` | `checkoutSequenceEngine` | `CheckoutSequenceEngine` | `summariseCheckoutSequence(engine.state())` |
| `random-checkout` | `randomCheckoutAdapter` | `RANDOM_CHECKOUT` | `Random Checkout` | `Random Checkout` | `random-checkout` | `RANDOM_CHECKOUT_V1` | `randomCheckoutEngine` | `RandomCheckoutEngine` | `summariseRandomCheckout(engine.state())` |
| `hit-count` | `hitCountAdapter` | `HIT_COUNT` | `Hit Count` | `Hit Count` | `hit-count` | `HIT_COUNT_V1` | `hitCountEngine` | `HitCountEngine` | `summariseHitCount(engine.state())` |
| `switchblade` | `switchbladeAdapter` | `SWITCHBLADE` | `SwitchBlade` | `SwitchBlade` | `switchblade` | `SWITCHBLADE_V1` | `switchbladeEngine` | `SwitchbladeEngine` | `summariseSwitchblade(engine.state())` |
| `doubles-lock` | `doublesLockAdapter` | `DOUBLES_LOCK` | `Doubles Lock` | `Doubles Lock` | `doubles-lock` | `DOUBLES_LOCK_V1` | `doublesLockEngine` | `DoublesLockEngine` | `summariseDoublesLock(engine.state())` |

Before rewriting each file, open it and confirm its body matches that row. Any difference becomes a ledgered ruling, keeping the file's own behaviour.

- [ ] **Step 5: Run** `npm test -- tests/lib/training/routines/adapters`
Expected: PASS. The twelve existing per-adapter tests and `step-adapter.registry.test.ts` must pass unchanged.

- [ ] **Step 6: Write the routine-play tests**, appended to `routine-play.data.test.ts`:
```ts
describe("routinePlay — dart recorders", () => {
  const MISS = {
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: null,
    locationY: null,
  };

  it("a recorder whose slot is empty records nothing", () => {
    const store = makeStore();
    store.recordHitCountDart(MISS);
    store.recordCheckoutSequenceDart(MISS);
    expect(store.activeDartEngine()).toBeNull();
  });

  it("every dart engine slot has a recorder", () => {
    const store = makeStore() as unknown as Record<string, unknown>;
    for (const name of [
      "recordSwitchingDart",
      "recordDoublePatternDart",
      "recordTargetScoringDart",
      "recordSwitchingChainDart",
      "recordScoreThresholdDart",
      "recordBullseyeCheckoutDart",
      "recordBullUpDart",
      "recordCheckoutSequenceDart",
      "recordRandomCheckoutDart",
      "recordHitCountDart",
      "recordSwitchbladeDart",
      "recordDoublesLockDart",
    ])
      expect(typeof store[name]).toBe("function");
  });
});
```
Run `npm test -- tests/lib/training/routines/routine-play.data.test.ts`. Expected: PASS before the refactor. Refactor under green: watch it stay green after Step 7.

- [ ] **Step 7: Refactor `routine-play.data.ts`.**
  - **Recorders.** Replace the twelve hand-written `record…Dart` methods, Switching through Doubles Lock including Catch 40's, with one spread. Put `...dartRecorders(),` just before `...boardInputData(`, and these module-level declarations just after `DART_ENGINE_RECORDERS`:
    ```ts
    /** A dart exercise's engine slot, and its board-dart recorder's name. */
    type DartRecorderName = (typeof DART_ENGINE_RECORDERS)[number][1];

    /** Slots whose engine ends on its own dart, so the step completes before its deadline (Catch 40's last outshot). */
    const COMPLETES_ON_DART: ReadonlySet<DartEngineSlot> = new Set([
      "checkoutSequenceEngine",
    ]);

    function recordInto(
      ctx: RoutinePlayContext,
      slot: DartEngineSlot,
      observation: DartObservation,
    ): void {
      const engine = ctx[slot];
      if (!engine) return;
      engine.record(observation);
      if (COMPLETES_ON_DART.has(slot) && engine.isComplete())
        void ctx.completeCurrentStep();
    }

    /** One `record…Dart(observation)` method per `DART_ENGINE_RECORDERS` row; a no-op while its slot is empty. */
    function dartRecorders(): Record<
      DartRecorderName,
      (this: RoutinePlayContext, observation: DartObservation) => void
    > {
      return Object.fromEntries(
        DART_ENGINE_RECORDERS.map(([slot, name]) => [
          name,
          function (this: RoutinePlayContext, observation: DartObservation) {
            recordInto(this, slot, observation);
          },
        ]),
      ) as Record<
        DartRecorderName,
        (this: RoutinePlayContext, observation: DartObservation) => void
      >;
    }
    ```
  - **Recorder table type.** Change the `satisfies` clause of `DART_ENGINE_RECORDERS` to `readonly (readonly [DartEngineSlot, keyof RoutinePlayContext])[]`, and import `type DartEngineSlot` from `./types`.
  - **Deadline loop.** In `startStepTimer`'s `onComplete`, replace the twelve `this.<slot>?.expireTimer();` lines with:
    ```ts
              for (const [slot] of DART_ENGINE_RECORDERS) this[slot]?.expireTimer();
    ```
  - **Label helper.** Add this module-level helper and use it in `hitCountTargetLabel`, `switchbladeSlotLabel` and `doublesLockTargetLabel`:
    ```ts
    /** A path target's label, or "" while no engine is open. */
    function targetLabelOf(target: BoardTarget | undefined): string {
      return target === undefined ? "" : boardTargetLabel(target);
    }
    ```
    For example, `hitCountTargetLabel` becomes `return targetLabelOf(this.hitCountEngine?.state().currentTarget);`.
  - **Rate getters.** Replace `accuracyDisplay` with `checkoutPercentageDisplay` (from `@lib/game/play-visit-stats`) in the six rate getters. Each becomes one line:
    - `scoreThresholdBeatRate`: `checkoutPercentageDisplay(state?.beats ?? 0, state?.visits ?? 0)`
    - `bullseyeCheckoutRate`: `(checkouts, visits)`
    - `bullUpBullseyeRate`: `(bullseyes, throws)`
    - `bullUpBullRate`: `(bulls, throws)`
    - `randomCheckoutRate`: `(checkouts, attempts)`
    - `hitCountRate`: `(hits, dartsThrown)`

    Each keeps `const state = this.<slot>?.state();` above it.
  - Remove the `accuracyDisplay` import if nothing else in the file uses it.

- [ ] **Step 8: `hitRateRow`.** In `routine-summary.module.ts`, change its value to `checkoutPercentageDisplay(hits, darts)`, imported beside `accuracyDisplay`. Remove `accuracyDisplay` and `NO_VALUE` only if nothing else in the file uses them.

  Append to `routine-summary.module.test.ts`, inside its top-level describe or as a new one:
```ts
  it("a hit rate over no darts reads as a dash", () => {
    const summary = summariseHitCount(
      hitCountEngineFactory.create({
        targets: [{ kind: "TREBLE", number: 20 }],
        dartsPerTarget: 3,
      }).state(),
    );
    expect(summary.rows.at(-1)).toEqual({ label: "Hit rate", value: "—" });
  });
```
Add the imports this needs if they are missing: `summariseHitCount` and `hitCountEngineFactory`.

- [ ] **Step 9: Run** `npm test -- tests/lib/training/routines tests/modules/training/routines`, then `npm run check`.
Expected: all PASS, and 0/0/0.

- [ ] **Step 10: Commit**
```bash
git add app/src/lib/training/routines app/src/modules/training/routines/routine-summary.module.ts app/tests/lib/training/routines app/tests/modules/training/routines/routine-summary.module.test.ts
git commit -m "refactor(routines): one dart-exercise adapter factory, generated recorders, shared label and rate helpers"
```

---

### Task 2: Reuse prep — engine tail (#1050), empty config, one exercise-type enum

**Files:**
- Modify:
  - `app/src/modules/training/exercises/dart-exercise-shell.module.ts`
  - the `hit-count`, `switchblade`, `doubles-lock`, `target-scoring` and `switching-chain` `.engine.module.ts` files
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`, `app/src/pages/api/training-sessions/types.ts`
- Test:
  - Append: `app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts`
  - Create: `app/tests/modules/training/exercises/registered-exercises.test.ts`, which imports all five engine modules.
  - Append: `app/tests/lib/training/exercises/rulesets/types.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function registerDartExercise<TConfig, TState>(spec: DartExerciseSpec<TConfig, TState>): {
    Engine: DartExerciseEngineClass<TConfig, TState>;
    factory: DartExerciseEngineFactory<TConfig, TState>;
    fold: DartExerciseSpec<TConfig, TState>["fold"];
  };
  export const EmptyV1Config: z.ZodObject<{}, "strict">;   // BullUp/Switchblade/DoublesLock V1 configs alias it
  ```
- Each of the five engine modules keeps its exports by name, `<X>Engine`, `<x>EngineFactory` and `fold<X>State`:
  - `<X>Engine` becomes `export const <X>Engine = …Engine; export type <X>Engine = InstanceType<typeof <X>Engine>;`
  - `new`, `instanceof` and type positions all keep working.

- [ ] **Step 1: Write the failing tests.**

Append to `dart-exercise-shell.module.test.ts`, adding the imports:
```ts
describe("registerDartExercise", () => {
  beforeEach(() => resetDartExerciseEngineRegistry());

  it("returns the class, a factory that builds it, and the spec's fold, and registers the factory", () => {
    const toy = registerDartExercise(spec);
    expect(toy.factory.create({ n: 1 })).toBeInstanceOf(toy.Engine);
    expect(getDartExerciseEngineFactory("TARGET_SCORING_V1")).toBe(toy.factory);
    expect(toy.fold).toBe(spec.fold);
  });
});
```

`registered-exercises.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { playExerciseKind } from "../../../lib/stats/replay-step-games";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import {
  HitCountEngine,
  foldHitCountState,
  hitCountEngineFactory,
} from "@modules/training/exercises/hit-count.engine.module";
import {
  SwitchbladeEngine,
  foldSwitchbladeState,
  switchbladeEngineFactory,
} from "@modules/training/exercises/switchblade.engine.module";
import {
  DoublesLockEngine,
  doublesLockEngineFactory,
  foldDoublesLockState,
} from "@modules/training/exercises/doubles-lock.engine.module";
import {
  TargetScoringEngine,
  foldTargetScoringState,
  targetScoringEngineFactory,
} from "@modules/training/exercises/target-scoring.engine.module";
import {
  SwitchingChainEngine,
  foldSwitchingChainState,
  switchingChainEngineFactory,
} from "@modules/training/exercises/switching-chain.engine.module";
import type { DartExerciseKind } from "@modules/types";

const CASES = [
  ["HIT_COUNT", HitCountEngine, hitCountEngineFactory, foldHitCountState],
  ["SWITCHBLADE", SwitchbladeEngine, switchbladeEngineFactory, foldSwitchbladeState],
  ["DOUBLES_LOCK", DoublesLockEngine, doublesLockEngineFactory, foldDoublesLockState],
  ["TARGET_SCORING", TargetScoringEngine, targetScoringEngineFactory, foldTargetScoringState],
  ["SWITCHING:CHAIN", SwitchingChainEngine, switchingChainEngineFactory, foldSwitchingChainState],
] as const;

describe("shell-registered exercises", () => {
  it.each(CASES)(
    "%s: the registered factory builds the exported class and the fold matches state()",
    (kind, Engine, factory, fold) => {
      const { header } = playExerciseKind(kind as DartExerciseKind);
      const engine = factory.create(header.configuration as never);
      expect(engine).toBeInstanceOf(Engine);
      expect(getDartExerciseEngineFactory(factory.exerciseRulesetVersionKey)).toBe(factory);
      expect(fold(engine.facts(), header.configuration as never, false)).toEqual(engine.state());
    },
  );
});
```

Append to `rulesets/types.test.ts`:
```ts
describe("EmptyV1Config", () => {
  it("is the one schema behind every empty-config ruleset", () => {
    expect(BullUpV1Config).toBe(EmptyV1Config);
    expect(SwitchbladeV1Config).toBe(EmptyV1Config);
    expect(DoublesLockV1Config).toBe(EmptyV1Config);
  });

  it("accepts {} and rejects any key", () => {
    expect(EmptyV1Config.safeParse({}).success).toBe(true);
    expect(EmptyV1Config.safeParse({ x: 1 }).success).toBe(false);
  });
});
```

Append to `pages/api/training-sessions/types.test.ts`:
```ts
describe("exercise type keys", () => {
  it("the step list and the start-step response accept the same keys", () => {
    expect(StartTrainingStepResponse.shape.exerciseTypeKey.options).toEqual(
      StartTrainingResponse.shape.steps.element.shape.exerciseTypeKey.options,
    );
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/dart-exercise-shell.module.test.ts tests/modules/training/exercises/registered-exercises.test.ts tests/lib/training/exercises/rulesets/types.test.ts tests/pages/api/training-sessions/types.test.ts`
Expected:
- FAIL on `registerDartExercise` and `EmptyV1Config`, which are not exported.
- The five-engine table and the enum test PASS already. They pin the refactor.

- [ ] **Step 3: Implement.**

`dart-exercise-shell.module.ts`: import `registerDartExerciseEngineFactory` from `./dart-engine.registry`, then append:
```ts
/**
 * One shell-built exercise end to end: its engine class, its factory
 * (registered under the spec's ruleset key) and its fold.
 */
export function registerDartExercise<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
): {
  Engine: DartExerciseEngineClass<TConfig, TState>;
  factory: DartExerciseEngineFactory<TConfig, TState>;
  fold: DartExerciseSpec<TConfig, TState>["fold"];
} {
  const Engine = dartExerciseEngineClass(spec);
  const factory = dartExerciseEngineFactory(spec, Engine);
  registerDartExerciseEngineFactory(factory);
  return { Engine, factory, fold: spec.fold };
}
```

In each of the five engine modules, replace the tail from the `fold…State` function through `registerDartExerciseEngineFactory(…);` with the shape below, shown for Hit Count. Keep each module's own JSDoc lines.
```ts
const hitCount = registerDartExercise(hitCountSpec);

/** Hit Count's state from a fact log alone, through the same fold the engine uses. */
export const foldHitCountState = hitCount.fold;

/** Hit Count exercise engine, built by the exercise shell. */
export const HitCountEngine = hitCount.Engine;
export type HitCountEngine = InstanceType<typeof HitCountEngine>;

export const hitCountEngineFactory = hitCount.factory;
```
- Replace the imports of `registerDartExerciseEngineFactory`, `dartExerciseEngineClass` and `dartExerciseEngineFactory` with `import { registerDartExercise } from "./dart-exercise-shell.module";`.
- Drop any type import only the old fold wrapper used.
- Local names: `switchblade`, `doublesLock`, `targetScoring`, `switchingChain`.
- **Check the result type, then ledger it.** For each module, confirm the old `fold…State` signature was exactly `(facts, config, complete) => <State>`; the new one is `spec.fold`'s `(facts, config, expired)`, the same type. Ledger: `Task 2: Ruling: engine class exports become const + type alias — instanceof, new and type use unchanged; proven by registered-exercises.test.ts and the unchanged suites — cost if wrong: a type error at a consumer`.

`rulesets/types.ts`:
- Before `BullUpV1Config`, add:
  ```ts
  /** The config of every ruleset that has nothing to configure: the empty strict object. */
  export const EmptyV1Config = z.object({}).strict();
  ```
- Then change `BullUpV1Config`, `SwitchbladeV1Config` and `DoublesLockV1Config` to `= EmptyV1Config;`. Each keeps its JSDoc and its `…ConfigData` type line.

`pages/api/training-sessions/types.ts`: above `TrainingStepResolved`, add
```ts
const ExerciseTypeKey = z.enum([
  "WARM_UP",
  "SWITCHING",
  "DOUBLE_PATTERN",
  "TARGET_SCORING",
  "SCORE_THRESHOLD",
  "BULLSEYE_CHECKOUT",
  "BULL_UP",
  "CHECKOUT_SEQUENCE",
  "RANDOM_CHECKOUT",
  "HIT_COUNT",
  "SWITCHBLADE",
  "DOUBLES_LOCK",
  "GAME",
]);
```
and use `exerciseTypeKey: ExerciseTypeKey,` in both objects.

- [ ] **Step 4: Run** the Step 2 command, then `npm test -- tests/modules/training tests/lib/training tests/pages/api tests/services`, then `npm run check`.
Expected: all PASS, and 0/0/0.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/training/exercises app/src/lib/training/exercises/rulesets/types.ts app/src/pages/api/training-sessions/types.ts app/tests/modules/training/exercises app/tests/lib/training/exercises/rulesets/types.test.ts app/tests/pages/api/training-sessions/types.test.ts
git commit -m "refactor(exercises): registerDartExercise engine tail, EmptyV1Config, one exercise-type enum (#1050)"
```

---

### Task 3: Reuse prep — `stepMetrics` field map (#1048)

**Files:**
- Modify: `app/src/modules/stats/step-metrics.module.ts`
- Test: `app/tests/modules/stats/step-metrics.module.test.ts`

**Interfaces:**
- `stepMetrics(kind, state, facts)` keeps its signature and output. It gains a module-local map, `STATE_FIELDS: Readonly<Record<Exclude<DartExerciseKind, "SWITCHING:STANDARD">, Readonly<Record<string, string>>>>`, giving each metric's state field.
- Adding a `DartExerciseKind` without a `STATE_FIELDS` row is a type error.

- [ ] **Step 1: Write the test.** Append it inside `describe("stepMetrics")`:
```ts
  it("names the state field a kind's metric reads when it is missing", () => {
    expect(() =>
      stepMetrics("SWITCHBLADE", { dartsThrown: 1, hits: 1 }, NO_FACTS),
    ).toThrow('state is missing numeric field "total"');
    expect(() =>
      stepMetrics("DOUBLE_PATTERN", { dartsThrown: 1 }, NO_FACTS),
    ).toThrow('state is missing numeric field "totalPoints"');
  });
```
Use the file's own empty-facts constant if one exists; otherwise declare `const NO_FACTS = { stages: [], turns: [] };`.

- [ ] **Step 2: Run** `npm test -- tests/modules/stats/step-metrics.module.test.ts`. Expected: PASS before the refactor. It pins the renamed fields.

- [ ] **Step 3: Refactor.** Replace `stepMetrics`'s switch with:
```ts
/**
 * Each kind's metric → engine-state field. Switching Standard is absent: its
 * hits replay the darts' own intended/hit pair (`switchingHits`).
 */
const STATE_FIELDS: Readonly<
  Record<
    Exclude<DartExerciseKind, "SWITCHING:STANDARD">,
    Readonly<Record<string, string>>
  >
> = {
  "SWITCHING:CHAIN": {
    bestChain: "bestChain",
    sequences: "completedSequences",
    darts: "dartsThrown",
    hits: "hits",
  },
  DOUBLE_PATTERN: { hits: "totalPoints", darts: "dartsThrown" },
  TARGET_SCORING: { bestChain: "bestChain", darts: "dartsThrown", hits: "hits" },
  SCORE_THRESHOLD: { beats: "beats", visits: "visits", darts: "dartsThrown" },
  BULLSEYE_CHECKOUT: {
    checkouts: "checkouts",
    visits: "visits",
    darts: "dartsThrown",
  },
  BULL_UP: { throws: "throws", bullseyes: "bullseyes", bulls: "bulls" },
  CHECKOUT_SEQUENCE: {
    points: "points",
    checkouts: "checkouts",
    attempts: "attempts",
    darts: "dartsThrown",
  },
  RANDOM_CHECKOUT: {
    checkouts: "checkouts",
    attempts: "attempts",
    darts: "dartsThrown",
  },
  HIT_COUNT: { hits: "hits", darts: "dartsThrown" },
  SWITCHBLADE: { points: "total", darts: "dartsThrown", hits: "hits" },
  DOUBLES_LOCK: {
    bonus: "bonus",
    locks: "locks",
    darts: "dartsThrown",
    hits: "hits",
  },
};

/**
 * One definition of each dart exercise kind's step metrics (D372 decision
 * 7), read from its engine state exactly as `routine-summary.module.ts`
 * reads it. Returns exactly the keys `STEP_METRIC_SPECS[kind].metrics`
 * declares.
 */
export function stepMetrics(
  kind: DartExerciseKind,
  state: unknown,
  facts: EngineFacts,
): Record<string, number> {
  if (kind === "SWITCHING:STANDARD")
    return {
      points: numberField(state, "totalPoints", kind),
      darts: numberField(state, "dartsThrown", kind),
      hits: switchingHits(facts),
    };
  return Object.fromEntries(
    Object.entries(STATE_FIELDS[kind]).map(([metric, field]) => [
      metric,
      numberField(state, field, kind),
    ]),
  );
}
```

- [ ] **Step 4: Run** `npm test -- tests/modules/stats tests/lib/stats tests/modules/training/routines`, then `npm run check`. Expected: PASS, and 0/0/0.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/stats/step-metrics.module.ts app/tests/modules/stats/step-metrics.module.test.ts
git commit -m "refactor(stats): stepMetrics reads a field map per kind (#1048)"
```

---

### Task 4: Zone targets on the Track kernel

**Files:**
- Modify:
  - `app/src/modules/game/types.ts`
  - `app/src/modules/game/interfaces.ts`
  - `app/src/modules/game/track-kernel.module.ts`
  - `app/src/modules/game/board-progression.module.ts`
  - `app/src/modules/game/track-policies.ts`
  - `app/src/modules/training/exercises/interfaces.ts`
  - `app/src/modules/training/exercises/track-exercise-spec.module.ts`
- Modify: `app/tests/modules/game/support/aimed-observations.ts`
- Test: `app/tests/modules/game/board-progression.module.test.ts`, `app/tests/modules/game/track-policies.test.ts`, `app/tests/modules/game/track-kernel.module.test.ts`, `app/tests/modules/training/exercises/track-exercise-spec.module.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ZoneTarget = { kind: "ANY_DOUBLE" } | { kind: "ANY_TREBLE" };
  export type TrackTarget = BoardTarget | ZoneTarget;
  export type JudgedDart<TTarget extends TrackTarget = BoardTarget> = { observation; target: TTarget; hit; points };
  export interface TrackRules<TExt, TTarget extends TrackTarget = BoardTarget> { target(seat): TTarget; hit(target: TTarget, o): boolean; points(target: TTarget, o, hit): number; onDart?(seat, dart: JudgedDart<TTarget>): TrackSeat<TExt>; … }
  applyTrackDart / foldTrackSeats / foldTrackDarts<TExt, TTarget extends TrackTarget = BoardTarget>
  TrackExerciseDefinition<TConfig, TExt, TState, TTarget extends TrackTarget = BoardTarget>
  trackExerciseSpec<TConfig, TExt, TState, TTarget extends TrackTarget = BoardTarget>
  isHitOn(target: TrackTarget, o): boolean      // ANY_DOUBLE: DOUBLE or INNER_BULL; ANY_TREBLE: TREBLE
  boardTargetLabel(target: TrackTarget): string // "Any double", "Any treble"
  targetAt<TTarget extends TrackTarget = BoardTarget>(path: readonly TTarget[], index): TTarget
  pathTarget<TExt, TTarget extends TrackTarget = BoardTarget>(path: readonly TTarget[]): (seat) => TTarget
  anyRingEitherBull(target: TrackTarget, o)     // zone → isHitOn
  tallyOnTarget(seat, dart: JudgedDart<TrackTarget>); boardScorePoints(_target: TrackTarget, o, hit)
  ```

- [ ] **Step 1: Write the failing tests.**

Append to `board-progression.module.test.ts`:
```ts
describe("zone targets", () => {
  const on = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });

  it("ANY_DOUBLE hits any double and the bullseye, nothing else", () => {
    const anyDouble = { kind: "ANY_DOUBLE" } as const;
    expect(isHitOn(anyDouble, on(5, "DOUBLE"))).toBe(true);
    expect(isHitOn(anyDouble, on(25, "INNER_BULL"))).toBe(true);
    expect(isHitOn(anyDouble, on(25, "OUTER_BULL"))).toBe(false);
    expect(isHitOn(anyDouble, on(5, "TREBLE"))).toBe(false);
    expect(isHitOn(anyDouble, on(null, "MISS"))).toBe(false);
  });

  it("ANY_TREBLE hits any treble, nothing else", () => {
    const anyTreble = { kind: "ANY_TREBLE" } as const;
    expect(isHitOn(anyTreble, on(19, "TREBLE"))).toBe(true);
    expect(isHitOn(anyTreble, on(19, "DOUBLE"))).toBe(false);
    expect(isHitOn(anyTreble, on(25, "INNER_BULL"))).toBe(false);
  });

  it("labels zones in words", () => {
    expect(boardTargetLabel({ kind: "ANY_DOUBLE" })).toBe("Any double");
    expect(boardTargetLabel({ kind: "ANY_TREBLE" })).toBe("Any treble");
  });

  it("targetAt reads a path that mixes beds and zones", () => {
    expect(targetAt([{ kind: "NUMBER", number: 20 }, { kind: "ANY_TREBLE" }], 1)).toEqual({ kind: "ANY_TREBLE" });
  });
});
```

Append to `track-policies.test.ts`, adding imports as needed:
```ts
describe("track policies on zone targets", () => {
  const on = (n: number | null, zone: DartZoneKey): DartObservation => ({
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  });

  it("anyRingEitherBull defers a zone target to isHitOn", () => {
    expect(anyRingEitherBull({ kind: "ANY_DOUBLE" }, on(25, "INNER_BULL"))).toBe(true);
    expect(anyRingEitherBull({ kind: "ANY_DOUBLE" }, on(25, "OUTER_BULL"))).toBe(false);
    expect(anyRingEitherBull({ kind: "ANY_TREBLE" }, on(7, "TREBLE"))).toBe(true);
  });

  it("pathTarget walks a zone path", () => {
    const path: TrackTarget[] = [{ kind: "ANY_DOUBLE" }, { kind: "BULL" }];
    expect(pathTarget(path)(seat({ targetIndex: 0 }))).toEqual({ kind: "ANY_DOUBLE" });
  });

  it("boardScorePoints scores a zone hit at board value", () => {
    expect(boardScorePoints({ kind: "ANY_TREBLE" }, on(19, "TREBLE"), true)).toBe(57);
  });
});
```

Append to `track-kernel.module.test.ts`, adding imports as needed:
```ts
describe("applyTrackDart on a zone path", () => {
  it("judges the dart with the ruleset's hit and passes the zone target to onDart", () => {
    const seen: TrackTarget[] = [];
    const rules: TrackRules<null, TrackTarget> = {
      doneMessage: "done",
      target: () => ({ kind: "ANY_DOUBLE" }),
      hit: isHitOn,
      points: boardScorePoints,
      onDart: (seat, dart) => {
        seen.push(dart.target);
        return seat;
      },
      visitOpen: () => true,
    };
    const seat = applyTrackDart(
      initialTrackSeat({ participantRef: "p", sideKey: "A" }, null),
      { hitTargetNumber: 25, hitZoneKey: "INNER_BULL", locationX: null, locationY: null },
      rules,
    );
    expect(seat.score).toBe(50);
    expect(seat.hitsThisVisit).toBe(1);
    expect(seen).toEqual([{ kind: "ANY_DOUBLE" }]);
  });
});
```
If `initialTrackSeat`'s seat argument needs more fields, copy the file's existing seat fixture.

- [ ] **Step 2: Run** `npm test -- tests/modules/game/board-progression.module.test.ts tests/modules/game/track-policies.test.ts tests/modules/game/track-kernel.module.test.ts`. Then run `npm run check`.
Expected: the tests FAIL; `isHitOn` falls through to `target.number`, and the labels are wrong. `npm run check` reports type errors on `TrackTarget`.

- [ ] **Step 3: Implement.**
  - **`game/types.ts`.**
    - After `BoardTarget`, add:
      ```ts
      /** A number-less Track target: any double (the bullseye included) or any treble. */
      export type ZoneTarget = { kind: "ANY_DOUBLE" } | { kind: "ANY_TREBLE" };

      /** A Track path entry: one bed of the board, or a whole zone. */
      export type TrackTarget = BoardTarget | ZoneTarget;
      ```
    - `JudgedDart` becomes `export type JudgedDart<TTarget extends TrackTarget = BoardTarget> = { observation: DartObservation; target: TTarget; hit: boolean; points: number; };`.
  - **`game/interfaces.ts`.**
    - Import `TrackTarget`.
    - `export interface TrackRules<TExt, TTarget extends TrackTarget = BoardTarget>`.
    - `target(seat): TTarget`; `hit(target: TTarget, …)`; `points(target: TTarget, …)`; `onDart?(seat, dart: JudgedDart<TTarget>)`.
  - **`track-kernel.module.ts`.**
    - Import `BoardTarget` and `TrackTarget`.
    - `applyTrackDart`, `foldTrackSeats` and `foldTrackDarts` each take `<TExt, TTarget extends TrackTarget = BoardTarget>` and `rules: TrackRules<TExt, TTarget>`.
    - `const dart: JudgedDart<TTarget> = {`.
  - **`exercises/interfaces.ts`.**
    - `TrackExerciseDefinition<TConfig, TExt, TState, TTarget extends TrackTarget = BoardTarget>`, with `rules(config): TrackRules<TExt, TTarget>`.
    - Import `BoardTarget` and `TrackTarget`.
  - **`track-exercise-spec.module.ts`.** `trackExerciseSpec<TConfig, TExt, TState, TTarget extends TrackTarget = BoardTarget>(definition: TrackExerciseDefinition<TConfig, TExt, TState, TTarget>)`. Import the two types.
  - **`board-progression.module.ts`.**
    - Import `TrackTarget`.
    - `targetAt<TTarget extends TrackTarget = BoardTarget>(path: readonly TTarget[], index: number): TTarget`.
    - The label function:
      ```ts
      const ZONE_LABEL: Record<ZoneTarget["kind"], string> = {
        ANY_DOUBLE: "Any double",
        ANY_TREBLE: "Any treble",
      };

      /** A path target's display label: `BULL`, `D16`, `T20`, `Any double`/`Any treble` for a zone, the bare number otherwise. */
      export function boardTargetLabel(target: TrackTarget): string {
        if (target.kind === "ANY_DOUBLE" || target.kind === "ANY_TREBLE")
          return ZONE_LABEL[target.kind];
        if (target.kind === "BULL") return "BULL";
        if (target.kind === "NUMBER") return String(target.number);
        return `${RING_PREFIX[target.kind]}${target.number}`;
      }
      ```
    - `isHitOn` gains a JSDoc, a `TrackTarget` parameter, and two leading branches:
      ```ts
      /**
       * Whether a dart hits `target`: the bullseye for BULL; any ring for a
       * NUMBER; the named ring for DOUBLE/TREBLE; any double or the bullseye
       * for ANY_DOUBLE; any treble for ANY_TREBLE.
       */
      export function isHitOn(
        target: TrackTarget,
        observation: DartObservation,
      ): boolean {
        if (target.kind === "ANY_DOUBLE")
          return (
            observation.hitZoneKey === "DOUBLE" ||
            observation.hitZoneKey === "INNER_BULL"
          );
        if (target.kind === "ANY_TREBLE") return observation.hitZoneKey === "TREBLE";
        …existing body unchanged…
      }
      ```
  - **`track-policies.ts`.**
    - Import `isHitOn` and `TrackTarget`.
    - `pathTarget<TExt, TTarget extends TrackTarget = BoardTarget>(path: readonly TTarget[]): (seat: TrackSeat<TExt>) => TTarget`.
    - `anyRingEitherBull(target: TrackTarget, …)` starts with `if (target.kind === "ANY_DOUBLE" || target.kind === "ANY_TREBLE") return isHitOn(target, observation);`. Its JSDoc gains "; a zone target defers to `isHitOn`".
    - `tallyOnTarget`'s `dart: JudgedDart<TrackTarget>`.
    - `boardScorePoints`'s `_target: TrackTarget`.
  - **`aimed-observations.ts`.**
    - `observationOn(target: TrackTarget, …)`. Before the BULL branch, add:
      ```ts
        if (target.kind === "ANY_DOUBLE" || target.kind === "ANY_TREBLE")
          return {
            ...base,
            hitTargetNumber: 1 + Math.floor(rand() * 20),
            hitZoneKey: target.kind === "ANY_DOUBLE" ? "DOUBLE" : "TREBLE",
          };
      ```
    - In `aimedOnCurrentBoardTarget`, read `Record<string, TrackTarget>`.
    - Update the JSDoc: "a zone target gets a random number in its ring".

- [ ] **Step 4: Run** the Step 2 tests: PASS. Then run `npm test -- tests/modules/game tests/modules/training` and confirm every golden snapshot passes with no write. Then `npm run check`: 0/0/0.

- [ ] **Step 5: Mutation checks.** Ledger each result, and revert after each.
  - (a) Drop `|| observation.hitZoneKey === "INNER_BULL"`. Expected: `ANY_DOUBLE hits …` fails.
  - (b) Return `isHitOn` → `anyRingEitherBull`'s own zone set for zones (delete the defer line). Expected: a type error, or `defers a zone target` fails.

- [ ] **Step 6: Commit**
```bash
git add app/src/modules/game app/src/modules/training/exercises/interfaces.ts app/src/modules/training/exercises/track-exercise-spec.module.ts app/tests/modules/game
git commit -m "feat(track): zone targets (ANY_DOUBLE, ANY_TREBLE) through a defaulted TrackRules target type"
```
`track-exercise-spec.module.ts` changed. If the coverage gate asks for its test, append this to `track-exercise-spec.module.test.ts` and add the file to the commit:
```ts
  it("folds a ruleset whose path mixes beds and zones", () => {
    const spec = trackExerciseSpec<Record<string, never>, null, number, TrackTarget>({
      exerciseRulesetVersionKey: "HIT_COUNT_V1",
      parse: (c) => c,
      rules: () => ({
        doneMessage: "done",
        target: () => ({ kind: "ANY_TREBLE" }),
        hit: isHitOn,
        points: boardScorePoints,
        visitOpen: () => true,
      }),
      initialExt: () => null,
      project: (seat) => seat.score,
      intent: () => ({ intendedTargetNumber: null, intendedZoneKey: "TREBLE" }),
    });
    const facts = { stages: [], turns: [{ darts: [{ hitTargetNumber: 19, hitZoneKey: "TREBLE", locationX: null, locationY: null }] }] } as never;
    expect(spec.fold(facts, {}, false)).toBe(57);
  });
```
Match the file's existing fact-fixture shape if it builds turns differently.

---

### Task 5: `HALVE_IT_V1` key and config

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces:
  - `ExerciseRulesetVersionKey` gains `"HALVE_IT_V1"`;
  - `export const HalveItV1Config = EmptyV1Config;`;
  - `HalveItConfigData`;
  - `EXERCISE_RULESET_CONFIGS.HALVE_IT_V1`.

- [ ] **Step 1: Write the failing test.** Append it, importing `HalveItV1Config`:
```ts
describe("HalveItV1Config", () => {
  it("is the empty config — list and start total are fixed", () => {
    expect(HalveItV1Config).toBe(EmptyV1Config);
    expect(HalveItV1Config.safeParse({ startTotal: 40 }).success).toBe(false);
  });

  it("is registered under HALVE_IT_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.HALVE_IT_V1).toBe(HalveItV1Config);
  });
});
```
- [ ] **Step 2: Run** `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`. Expected: FAIL; the export is missing.
- [ ] **Step 3: Implement.**
  - Add `| "HALVE_IT_V1"` to the key union.
  - After `DoublesLockConfigData`, add:
    ```ts
    /**
     * Halve-It v1: 20, 16, any double, 17, 18, any treble, 19, 20, bull; a
     * blank visit halves the total, rounding up
     * (`docs/game-rules/training/exercises/halve-it.md`). List and start total
     * are locked and duration is the routine step's.
     */
    export const HalveItV1Config = EmptyV1Config;

    export type HalveItConfigData = z.infer<typeof HalveItV1Config>;
    ```
  - Add `HALVE_IT_V1: HalveItV1Config,` to `EXERCISE_RULESET_CONFIGS`.
- [ ] **Step 4: Run** the test: PASS. Run `npm run check`.
  - Expected: one error, in `services/exercise-rulesets/registry.ts`'s `REGISTRY` if it is typed by key.
  - In that case, add Task 7's `HALVE_IT_V1` registry line now and ledger a ruling.
- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/exercises/rulesets/types.ts app/tests/lib/training/exercises/rulesets/types.test.ts
git commit -m "feat(halve-it): HALVE_IT_V1 ruleset key and empty config"
```

---

### Task 6: Halve-It engine, kernel row, golden

**Files:**
- Modify:
  - `app/src/modules/game/types.ts` (`HalveItTrackExt`, after `HitCountTrackExt`);
  - `app/src/modules/training/exercises/types.ts` (`HalveItState`).
- Create: `app/src/modules/training/exercises/halve-it.engine.module.ts`
- Modify: `scripts/engine-kernels.txt`
- Test: `app/tests/modules/training/exercises/halve-it.engine.module.test.ts`, `app/tests/modules/training/exercises/halve-it.aimed.golden.test.ts`

**Interfaces:**
- Consumes:
  - Task 4's `TrackTarget`, the generic `trackExerciseSpec`, `pathTarget` and `anyRingEitherBull`;
  - Task 2's `registerDartExercise`;
  - Task 5's config.
- Produces:
  ```ts
  export type HalveItTrackExt = TargetTallyExt & PassTrackExt & { halvings: number };
  export type HalveItState = {
    currentTarget: TrackTarget; targetIndex: number; round: number; total: number;
    passes: number; halvings: number; hits: number; dartsThrown: number;
    hitsPerTarget: { target: TrackTarget; hits: number }[];
    status: "IN_PROGRESS" | "COMPLETE";
  };
  export const HALVE_IT_PATH: readonly TrackTarget[];   // 9 targets
  export function halveItIntent(target: TrackTarget): DartIntent;
  export const foldHalveItState; export const HalveItEngine; export type HalveItEngine; export const halveItEngineFactory;
  ```

- [ ] **Step 1: Write the failing engine tests** `halve-it.engine.module.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  HALVE_IT_PATH,
  HalveItEngine,
  foldHalveItState,
  halveItEngineFactory,
} from "@modules/training/exercises/halve-it.engine.module";
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
const BLANK = [MISS, MISS, MISS];
const S = (n: number) => dart(n, "SINGLE");
const D = (n: number) => dart(n, "DOUBLE");
const T = (n: number) => dart(n, "TREBLE");
const BULLSEYE = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");
const visit = (first: DartObservation) => [first, MISS, MISS];
const TO_95 = [...visit(S(20)), ...visit(D(16)), ...visit(D(13)), ...visit(S(17))];

function play(engine: HalveItEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("Halve-It engine", () => {
  it("starts on 20, round 1, total 0", () => {
    const state = new HalveItEngine({}).state();
    expect(state).toMatchObject({
      currentTarget: { kind: "NUMBER", number: 20 },
      targetIndex: 0,
      round: 1,
      total: 0,
      passes: 0,
      halvings: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
    expect(state.hitsPerTarget).toHaveLength(9);
  });

  it("walks 20, 16, any double, 17, 18, any treble, 19, 20, bull", () => {
    expect(HALVE_IT_PATH).toEqual([
      { kind: "NUMBER", number: 20 },
      { kind: "NUMBER", number: 16 },
      { kind: "ANY_DOUBLE" },
      { kind: "NUMBER", number: 17 },
      { kind: "NUMBER", number: 18 },
      { kind: "ANY_TREBLE" },
      { kind: "NUMBER", number: 19 },
      { kind: "NUMBER", number: 20 },
      { kind: "BULL" },
    ]);
  });

  it("any ring of the round's number scores its board value", () => {
    expect(play(new HalveItEngine({}), [T(20), S(20), D(20)]).total).toBe(120);
  });

  it("only the round's number scores", () => {
    const state = play(new HalveItEngine({}), [S(20), MISS, MISS, S(5), T(20), MISS]);
    expect(state.total).toBe(10);
    expect(state.halvings).toBe(1);
  });

  it("a blank visit halves an odd total rounding up: 95 → 48", () => {
    const engine = new HalveItEngine({});
    expect(play(engine, TO_95).total).toBe(95);
    expect(play(engine, BLANK)).toMatchObject({ total: 48, halvings: 1 });
  });

  it("halving at 0 leaves 0 and still counts", () => {
    expect(play(new HalveItEngine({}), BLANK)).toMatchObject({ total: 0, halvings: 1 });
  });

  it("the bullseye counts in Any double; the outer bull does not", () => {
    const engine = new HalveItEngine({});
    play(engine, [...visit(S(20)), ...visit(S(16))]);
    expect(play(engine, [BULLSEYE, OUTER, MISS]).total).toBe(86);
    const blank = new HalveItEngine({});
    play(blank, [...visit(S(20)), ...visit(S(16))]);
    expect(play(blank, [OUTER, MISS, MISS])).toMatchObject({ total: 18, halvings: 1 });
  });

  it("any treble scores in Any treble; a double does not count there", () => {
    const engine = new HalveItEngine({});
    play(engine, [...visit(S(20)), ...visit(S(16)), ...visit(D(1)), ...visit(S(17)), ...visit(S(18))]);
    expect(play(engine, [T(19), D(19), MISS]).total).toBe(130);
  });

  it("the bull round scores 25 and 50", () => {
    const engine = new HalveItEngine({});
    play(engine, [20, 16].flatMap((n) => visit(S(n))));
    play(engine, visit(D(1)));
    play(engine, [17, 18].flatMap((n) => visit(S(n))));
    play(engine, visit(T(1)));
    play(engine, [19, 20].flatMap((n) => visit(S(n))));
    expect(engine.state().currentTarget).toEqual({ kind: "BULL" });
    expect(play(engine, [OUTER, BULLSEYE, MISS]).total).toBe(20 + 16 + 2 + 17 + 18 + 3 + 19 + 20 + 75);
  });

  it("a pass restarts at 20 and carries the total", () => {
    const engine = new HalveItEngine({});
    play(engine, visit(T(20)));
    for (let i = 0; i < 8; i++) play(engine, BLANK);
    expect(engine.state()).toMatchObject({
      passes: 1,
      round: 1,
      currentTarget: { kind: "NUMBER", number: 20 },
      total: 1,
      halvings: 8,
    });
    expect(play(engine, visit(S(20))).total).toBe(21);
  });

  it("sums hits per path index over every pass", () => {
    const engine = new HalveItEngine({});
    play(engine, [S(20), S(20), MISS]);
    for (let i = 0; i < 8; i++) play(engine, BLANK);
    const state = play(engine, [S(20), MISS, MISS]);
    expect(state.hitsPerTarget[0].hits).toBe(3);
    expect(state.hitsPerTarget[7].hits).toBe(0);
    expect(state.hits).toBe(3);
  });

  it("aims a number or the bull at no bed, a zone at its ring", () => {
    const engine = new HalveItEngine({});
    play(engine, [...BLANK, ...BLANK, ...BLANK, ...BLANK, ...BLANK, ...BLANK, ...BLANK, ...BLANK, MISS]);
    const intents = engine
      .facts()
      .turns.map((turn) => [turn.darts[0].intendedTargetNumber, turn.darts[0].intendedZoneKey]);
    expect(intents).toEqual([
      [null, null],
      [null, null],
      [null, "DOUBLE"],
      [null, null],
      [null, null],
      [null, "TREBLE"],
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("writes one turn per three-dart visit", () => {
    const engine = new HalveItEngine({});
    play(engine, [MISS, MISS, MISS, MISS, MISS, MISS, MISS]);
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([3, 3, 1]);
  });

  it("undo restores the total a halving took", () => {
    const engine = new HalveItEngine({});
    play(engine, [...TO_95, ...BLANK]);
    expect(engine.state().total).toBe(48);
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toMatchObject({ total: 95, halvings: 0 });
  });

  it("rehydrates mid-visit", () => {
    const engine = new HalveItEngine({});
    const state = play(engine, [S(20), MISS, MISS, D(16)]);
    const rebuilt = new HalveItEngine({}, engine.facts());
    expect(rebuilt.state()).toEqual(state);
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new HalveItEngine({});
    play(engine, Array.from({ length: 27 }, () => MISS));
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a non-empty config", () => {
    expect(() => new HalveItEngine({ startTotal: 40 } as never)).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new HalveItEngine({});
    const state = play(engine, [...TO_95, MISS]);
    expect(foldHalveItState(engine.facts(), {}, false)).toEqual(state);
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("HALVE_IT_V1")).toBe(halveItEngineFactory);
  });

  it("produces an events batch the API accepts, zone intents included", () => {
    const engine = new HalveItEngine({});
    play(engine, [...BLANK, ...BLANK, D(5), MISS]);
    expect(EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success).toBe(true);
  });
});
```
The bull-round total works out as follows:
- rounds 1–8: S20, S16, D1 (2), S17, S18, T1 (3), S19 and S20 are one hit each;
- bull round: outer bull 25 plus bullseye 50.

Check it against the engine's output when Step 4 runs. If the arithmetic in the test is wrong, fix the test's literal and ledger it. Never change the engine to match.

- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/halve-it.engine.module.test.ts`. Expected: FAIL; the module is not found.

- [ ] **Step 3: Implement.**

In `game/types.ts`, after `HitCountTrackExt`:
```ts
/** Halve-It's Track extras: the per-target tally, passes, and blank visits. */
export type HalveItTrackExt = TargetTallyExt &
  PassTrackExt & {
    halvings: number;
  };
```

In `exercises/types.ts`, change the import to `import type { BoardTarget, TrackTarget } from "@modules/types";` and append:
```ts
/**
 * Halve-It state, derived by replaying `facts()` (`foldHalveItState`).
 * `currentTarget`/`targetIndex`/`round` locate the next visit; `total` is the
 * score after every halving; `hitsPerTarget` follows the path and sums every
 * pass.
 */
export type HalveItState = {
  currentTarget: TrackTarget;
  targetIndex: number;
  round: number;
  total: number;
  passes: number;
  halvings: number;
  hits: number;
  dartsThrown: number;
  hitsPerTarget: { target: TrackTarget; hits: number }[];
  status: "IN_PROGRESS" | "COMPLETE";
};
```

`halve-it.engine.module.ts` (prototyped and type-checked 2026-10-21):
```ts
import type { HalveItConfigData } from "@lib/types";
import { HalveItV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartIntent,
  EngineFacts,
  HalveItTrackExt,
  TrackSeat,
  TrackTarget,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  advanceAfterDarts,
  anyRingEitherBull,
  boardScorePoints,
  closeAfter,
  halveOnBlank,
  passOnWrap,
  pathTarget,
  tallyOnTarget,
} from "@modules/game/track-policies";
import { registerDartExercise } from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { HalveItState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Halve-It seat never finishes; only the timer ends the exercise.";

/** The V1 list: 20, 16, any double, 17, 18, any treble, 19, 20, bull. */
export const HALVE_IT_PATH: readonly TrackTarget[] = [
  { kind: "NUMBER", number: 20 },
  { kind: "NUMBER", number: 16 },
  { kind: "ANY_DOUBLE" },
  { kind: "NUMBER", number: 17 },
  { kind: "NUMBER", number: 18 },
  { kind: "ANY_TREBLE" },
  { kind: "NUMBER", number: 19 },
  { kind: "NUMBER", number: 20 },
  { kind: "BULL" },
];

const LAST_INDEX = HALVE_IT_PATH.length - 1;

/** The bed a dart is aimed at: none on a number or the bull (any ring scores), the ring alone on a zone. */
export function halveItIntent(target: TrackTarget): DartIntent {
  if (target.kind === "ANY_DOUBLE")
    return { intendedTargetNumber: null, intendedZoneKey: "DOUBLE" };
  if (target.kind === "ANY_TREBLE")
    return { intendedTargetNumber: null, intendedZoneKey: "TREBLE" };
  return { intendedTargetNumber: null, intendedZoneKey: null };
}

function countHalving(
  seat: TrackSeat<HalveItTrackExt>,
): TrackSeat<HalveItTrackExt> {
  return seat.hitsThisVisit === 0
    ? { ...seat, ext: { ...seat.ext, halvings: seat.ext.halvings + 1 } }
    : seat;
}

/**
 * Halve-It's Track rules: the fixed list in order; a dart hits on any ring
 * of the number, either bull on the bull, or the named zone
 * (`anyRingEitherBull`) and scores its board value; at a visit's close a
 * blank visit is counted and halves the total (`halveOnBlank`), the list
 * moves on, and past the bull `passOnWrap` starts it again.
 */
function halveItRules(): TrackRules<HalveItTrackExt, TrackTarget> {
  const advance = advanceAfterDarts<HalveItTrackExt>(DARTS_PER_VISIT);
  const wrap = passOnWrap<HalveItTrackExt>(LAST_INDEX);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(HALVE_IT_PATH),
    hit: anyRingEitherBull,
    points: boardScorePoints,
    onDart: tallyOnTarget,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) => wrap(advance(halveOnBlank(countHalving(seat)))),
  };
}

function projectHalveIt(
  seat: TrackSeat<HalveItTrackExt>,
  _config: HalveItConfigData,
  complete: boolean,
  facts: EngineFacts,
): HalveItState {
  const hitsPerTarget = HALVE_IT_PATH.map((target, index) => ({
    target,
    hits: seat.ext.hitsPerTarget[index] ?? 0,
  }));
  return {
    currentTarget: HALVE_IT_PATH[seat.targetIndex],
    targetIndex: seat.targetIndex,
    round: seat.targetIndex + 1,
    total: seat.score,
    passes: seat.ext.passes,
    halvings: seat.ext.halvings,
    hits: hitsPerTarget.reduce((sum, entry) => sum + entry.hits, 0),
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
    hitsPerTarget,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const halveItSpec = trackExerciseSpec<
  HalveItConfigData,
  HalveItTrackExt,
  HalveItState,
  TrackTarget
>({
  exerciseRulesetVersionKey: "HALVE_IT_V1",
  parse: (config) => HalveItV1Config.parse(config),
  rules: halveItRules,
  initialExt: () => ({
    dartsOnTarget: 0,
    hitsPerTarget: HALVE_IT_PATH.map(() => 0),
    passes: 0,
    halvings: 0,
  }),
  project: projectHalveIt,
  intent: (state) => halveItIntent(state.currentTarget),
});

const halveIt = registerDartExercise(halveItSpec);

/** Halve-It's state from a fact log alone, through the same fold the engine uses. */
export const foldHalveItState = halveIt.fold;

/** Halve-It exercise engine, built by the exercise shell. */
export const HalveItEngine = halveIt.Engine;
export type HalveItEngine = InstanceType<typeof HalveItEngine>;

export const halveItEngineFactory = halveIt.factory;
```
`HalveItState` must reach `@modules/types` the way `DoublesLockState` does (`export *`). `HalveItConfigData` must reach `@lib/types` the same way.

- [ ] **Step 4: Run** the engine test, expecting PASS. Then `npm run check`, expecting 0 errors.

- [ ] **Step 5: Kernel row.** Add this to `scripts/engine-kernels.txt` in file order (after `double-pattern`, before `hit-count`):
```
app/src/modules/training/exercises/halve-it.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/halve-it.md |
```
Run `bash scripts/check-engine-kernels.sh`. Expected: OK.

- [ ] **Step 6: Aimed golden** `halve-it.aimed.golden.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HalveItEngine } from "@modules/training/exercises/halve-it.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Halve-It — aimed golden trace", () => {
  for (const resumeExpired of [false, true]) {
    it(`resumeExpired ${resumeExpired}: seed 17 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new HalveItEngine({}, prior),
          seed: 17,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.6, "currentTarget"),
        }),
      ).toMatchSnapshot();
    });
  }
});
```
- Run it twice. The first run writes the snapshot; the second must PASS with no write.
- Open the snapshot and confirm `halvings` > 0 and `passes` > 0. If not, raise `steps` to 400 and ledger the change.
- Run `npm test -- tests/modules/training/exercises` and confirm every other snapshot passes unwritten.

- [ ] **Step 7: Mutation spot-check.** Ledger each result, and revert after each.
  - `halveOnBlank(countHalving(seat))` → `countHalving(seat)`. Expected: `95 → 48` fails.
  - `HALVE_IT_PATH.length - 1` → `HALVE_IT_PATH.length`. Expected: `a pass restarts…` fails.
  - `hit: anyRingEitherBull` → `hit: isHitOn`. Expected: `the bull round…` fails, because the outer bull no longer counts.

- [ ] **Step 8: Commit**
```bash
git add app/src/modules/game/types.ts app/src/modules/training/exercises/types.ts app/src/modules/training/exercises/halve-it.engine.module.ts app/tests/modules/training/exercises/halve-it.engine.module.test.ts app/tests/modules/training/exercises/halve-it.aimed.golden.test.ts app/tests/modules/training/exercises/__snapshots__/halve-it.aimed.golden.test.ts.snap scripts/engine-kernels.txt
git commit -m "feat(halve-it): Halve-It engine bound to the Track kernel"
```

---

### Task 7: Server wiring

**Files:**
- Modify:
  - `app/src/services/exercise-rulesets/registry.ts`
  - `app/src/services/types.ts`
  - `app/src/services/training-session.service.ts`
  - `app/src/pages/api/training-sessions/types.ts`
- Test: `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/services/training-session.service.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`

**Interfaces:**
- Produces:
  - `REGISTRY.HALVE_IT_V1 = makeConfigValidator(HalveItV1Config)`;
  - `"HALVE_IT_V1"` in `DART_WRITING_RULESET_VERSION_KEYS`;
  - `"HALVE_IT"` in the service `exerciseTypeKey` union, in `DART_EXERCISE_TYPE_KEYS` and in `ExerciseTypeKey`.

- [ ] **Step 1: Write the failing tests.**
  - **`registry.test.ts`.** Append:
    ```ts
      it("resolves HALVE_IT_V1 to a validator that takes only the empty config", () => {
        const validator = getExerciseRulesetValidator("HALVE_IT_V1");
        expect(validator?.validateConfig({ config: {} })).toEqual({ ok: true, config: {} });
        expect(validator?.validateConfig({ config: { startTotal: 40 } }).ok).toBe(false);
      });

      it("is true for Halve-It", () => {
        expect(exerciseRulesetWritesDarts("HALVE_IT_V1")).toBe(true);
      });
    ```
    Put each case in the describe block that matches its neighbours.
  - **`pages/api/training-sessions/types.test.ts`.** Append a copy of `accepts a DOUBLES_LOCK step`, named `accepts a HALVE_IT step`, with:
    - `exerciseTypeKey: "HALVE_IT"`;
    - `exerciseRulesetVersionKey: "HALVE_IT_V1"`;
    - `configuration: {}`.
  - **`training-session.service.test.ts`.** Append a copy of the DOUBLES_LOCK capture-pair case, named for HALVE_IT, with:
    - keys `"HALVE_IT"` / `"HALVE_IT_V1"`;
    - ids `"et-hi"` / `"erv-hi"`;
    - configuration `{}`;
    - the same assertions.
- [ ] **Step 2: Run** `npm test -- tests/services tests/pages/api/training-sessions/types.test.ts`. Expected: FAIL. The validator is undefined and the enum rejects `HALVE_IT`.
- [ ] **Step 3: Implement.**
  - **`registry.ts`:**
    - import `HalveItV1Config` from `@lib/training/exercises/rulesets/types`;
    - import `makeConfigValidator` from `./config-validator`;
    - add `HALVE_IT_V1: makeConfigValidator(HalveItV1Config),` to `REGISTRY`;
    - add `"HALVE_IT_V1",` to `DART_WRITING_RULESET_VERSION_KEYS`.
  - **`services/types.ts`:** add `| "HALVE_IT"` after `| "DOUBLES_LOCK"`.
  - **`training-session.service.ts`:** add `"HALVE_IT",` to `DART_EXERCISE_TYPE_KEYS`, and Halve-It to its JSDoc list.
  - **API types:** add `"HALVE_IT",` after `"DOUBLES_LOCK",` in `ExerciseTypeKey`, which is now the only list there.
- [ ] **Step 4: Run** the Step 2 command (PASS), then `npm run check` (0/0/0).
- [ ] **Step 5: Commit**
```bash
git add app/src/services app/src/pages/api/training-sessions/types.ts app/tests/services app/tests/pages/api/training-sessions/types.test.ts
git commit -m "feat(halve-it): server validator, keys and capture pair"
```

---

### Task 8: Seed `0047`, tag-link safety, one seed-verification script (#1049)

**Files:**
- Create:
  - `database/seeds/0047_halve_it_exercise_type.sql`
  - `database/verification/0047_exercise_type_seed_checks.sql`
- Delete: `database/verification/0038_hit_count_seed_checks.sql`, `0039_switchblade_seed_checks.sql`, `0040_doubles_lock_seed_checks.sql`
- Modify:
  - `app/scripts/generate-tag-seed.ts`
  - `database/seeds/0042_catalog_tags.sql` (regenerated)
  - `database/README.md`
- Test: `app/tests/scripts/generate-tag-seed.test.ts`

**Interfaces:**
- The generator writes each exercise type's links as:
  ```sql
  INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
  SELECT * FROM (VALUES
    ((SELECT id FROM exercise_types WHERE implementation_key = 'X'), 1, TRUE, now()),
    …
  ) AS v (exercise_type_id, tag_id, is_primary, created_at)
  WHERE v.exercise_type_id IS NOT NULL;
  ```
- Game links are unchanged.

- [ ] **Step 1: Start Postgres and prove the blocker.**
  - Start the server: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgci/data -o '-p 5433 -k /var/tmp/pgci' -l /var/tmp/pgci/log start"`. It may already be running.
  - Write the seed (Step 4) and regenerate tags with `cd app && npm run tags:generate`, but not the generator change.
  - Then build a scratch DB:
    ```bash
    psql "postgres://postgres@localhost:5433/postgres" -c "DROP DATABASE IF EXISTS halveit_fresh" -c "CREATE DATABASE halveit_fresh"
    cd app && DATABASE_URL='postgres://postgres@localhost:5433/halveit_fresh?sslmode=disable' npm run db:migrate && DATABASE_URL='postgres://postgres@localhost:5433/halveit_fresh?sslmode=disable' npm run db:seed:ci
    ```
  - Expected: `db:seed:ci` FAILS at `0042_catalog_tags.sql`, with a null value in `exercise_type_id`.
  - Record the error line in the ledger. If it does not fail, ledger that as a finding, keep the generator change (it is still required for production re-seeds), and continue.

- [ ] **Step 2: Write the failing generator tests.**
  - Append to `generate-tag-seed.test.ts`:
    ```ts
      it("skips a type the seeds have not inserted yet instead of inserting a null id", () => {
        const single: TagBlock = {
          context: "ROUTINE_STEP",
          tags: tags(["BEGINNER"]),
          difficultyLabels: [{ key: "BEGINNER", label: null }],
        };
        const { sql } = build({ exercises: new Map([["BULL_UP", [single]]]) });
        const link = sql.slice(sql.indexOf("INSERT INTO exercise_type_tags")).split(";")[0];
        expect(link).toContain("SELECT * FROM (VALUES");
        expect(link).toContain(") AS v (exercise_type_id, tag_id, is_primary, created_at)");
        expect(link).toContain("WHERE v.exercise_type_id IS NOT NULL");
      });
    ```
  - In `writes created_at on exercise link rows`, change only the header assertion from `"(exercise_type_id, tag_id, is_primary, created_at) VALUES"` to `"(exercise_type_id, tag_id, is_primary, created_at)\nSELECT * FROM (VALUES"`. The per-row regex stays.
  - Ledger: `Task 8: Ruling: generator test header assertion re-pointed — the INSERT shape migrated to INSERT … SELECT; the guarantee (every exercise link row writes created_at) is unchanged — cost if wrong: none`.
  - Run `npm test -- tests/scripts/generate-tag-seed.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the exercise branch of `linkInserts` in `generate-tag-seed.ts`:
```ts
        out.push(
          `INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)\n` +
            `SELECT * FROM (VALUES\n` +
            rows
              .map(
                (r) =>
                  `  (${typeSel}, ${r.id}, ${r.primary ? "TRUE" : "FALSE"}, now())`,
              )
              .join(",\n") +
            `\n) AS v (exercise_type_id, tag_id, is_primary, created_at)\n` +
            `WHERE v.exercise_type_id IS NOT NULL;`,
        );
```
Then:
- Add one line to `buildSeedSql`'s or the file's JSDoc: "Exercise links skip a type not yet inserted; `db:seed`'s second pass links it (D248)."
- Run the test: PASS.
- Then run `npm run tags:generate`, `bash ../scripts/check-tag-seeds.sh` and `bash ../scripts/test-check-tag-seeds.sh`. Expected: OK.

- [ ] **Step 4: The seed** `0047_halve_it_exercise_type.sql`. Copy `0040_doubles_lock_exercise_type.sql` and change these values:
  - **header:**
    - the file name;
    - purpose "Insert the HALVE_IT exercise type, its v1 ruleset and the Halve-It system template … Rules: docs/game-rules/training/exercises/halve-it.md. No routine is seeded: V1 is a routine step only.";
    - config paragraph "The default configuration is empty: the target list and start total are fixed in V1. Duration is the routine step's."
  - **`exercise_types`:**
    - id `'0199a000-0000-7000-8000-00000000000f'`;
    - key `'HALVE_IT'`;
    - name `'Halve-It'`;
    - description `'Nine rounds, one visit each: 20, 16, any double, 17, 18, any treble, 19, 20, bull. Darts in the target add their score; a visit that misses it halves your total. The list repeats until the time runs out.'`
  - **`exercise_ruleset_versions`:**
    - id `'0199a100-0000-7000-8000-00000000000f'`;
    - type id `…00f`;
    - key `'HALVE_IT_V1'`;
    - description `'Initial Halve-It ruleset: 20, 16, any double (bullseye included), 17, 18, any treble, 19, 20, bull; board value per hit; a blank visit halves the total, rounding up; passes repeat until time, the total carried.'`
  - **`exercise_templates`:**
    - id `'0199b000-0000-7000-8000-000000000016'`;
    - type id `…00f`;
    - ruleset subselect on `'HALVE_IT_V1'`;
    - name `'Halve-It'`;
    - description `'Hit each round''s target or lose half your total.'`;
    - configuration `'{}'::jsonb`.

- [ ] **Step 5: One verification script for every Track exercise seed** `0047_exercise_type_seed_checks.sql`:
```sql
-- ============================================================
-- Verification: 0047_exercise_type_seed_checks.sql
--
-- Proves against a live database what each Track exercise seed
-- (0038 HIT_COUNT, 0039 SWITCHBLADE, 0040 DOUBLES_LOCK,
-- 0047 HALVE_IT) can only claim locally: the type is published,
-- its v1 ruleset belongs to it, the system template pins that
-- ruleset with its default configuration, and the template
-- reaches the routine builder through v_exercise_template_catalog.
-- A new exercise seed adds one row to `expected`.
--
-- Reads seeded rows only and ends in ROLLBACK.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0047_exercise_type_seed_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE expected (
    type_key TEXT NOT NULL,
    ruleset_key TEXT NOT NULL,
    configuration JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO expected VALUES
    ('HIT_COUNT', 'HIT_COUNT_V1', '{"targets":[{"kind":"TREBLE","number":20},{"kind":"TREBLE","number":19},{"kind":"TREBLE","number":18},{"kind":"TREBLE","number":17}],"dartsPerTarget":9}'),
    ('SWITCHBLADE', 'SWITCHBLADE_V1', '{}'),
    ('DOUBLES_LOCK', 'DOUBLES_LOCK_V1', '{}'),
    ('HALVE_IT', 'HALVE_IT_V1', '{}');

INSERT INTO verification_results
SELECT '1',
    format('%s exercise type exists and is published', e.type_key),
    CASE WHEN count(et.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s published row(s)', count(et.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = e.type_key AND et.is_published
GROUP BY e.type_key;

INSERT INTO verification_results
SELECT '2',
    format('%s is version 1 of %s', e.ruleset_key, e.type_key),
    CASE WHEN count(erv.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching row(s)', count(erv.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = e.type_key
    LEFT JOIN exercise_ruleset_versions erv ON erv.exercise_type_id = et.id
        AND erv.implementation_key = e.ruleset_key
        AND erv.version_number = 1
GROUP BY e.type_key, e.ruleset_key;

INSERT INTO verification_results
SELECT '3',
    format('the system template pins %s with its default configuration', e.ruleset_key),
    CASE WHEN count(t.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(t.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = e.type_key
    LEFT JOIN exercise_ruleset_versions erv ON erv.implementation_key = e.ruleset_key
    LEFT JOIN exercise_templates t ON t.exercise_type_id = et.id
        AND t.exercise_ruleset_version_id = erv.id
        AND t.is_system_template
        AND t.game_type_id IS NULL
        AND t.default_configuration = e.configuration
GROUP BY e.ruleset_key;

INSERT INTO verification_results
SELECT '4',
    format('v_exercise_template_catalog offers %s', e.type_key),
    CASE WHEN count(c.exercise_type_key) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s)', count(c.exercise_type_key))
FROM expected e
    LEFT JOIN v_exercise_template_catalog c ON c.exercise_type_key = e.type_key
        AND c.has_default_configuration
GROUP BY e.type_key;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```
- Check each predicate against the three scripts it replaces before deleting them. Any predicate one of them has that this one lacks must be added here; ledger it.
- Run it against the `integration` DB before seeding `0047`:
  ```bash
  psql "postgres://postgres@localhost:5433/integration" -f ../database/verification/0047_exercise_type_seed_checks.sql
  ```
  Expected: 12 PASS, and 4 FAIL (`HALVE_IT` checks 1–4).
- Then `git rm` the three old scripts.

- [ ] **Step 6: Prove a fresh database and the integration DB.**
  - Re-run Step 1's scratch-DB commands. Expected: `db:seed:ci` succeeds.
  - Then run:
    ```bash
    psql "postgres://postgres@localhost:5433/halveit_fresh" -tc "SELECT count(*) FROM exercise_type_tags ett JOIN exercise_types et ON et.id = ett.exercise_type_id WHERE et.implementation_key = 'HALVE_IT'"
    ```
    Expected: a count equal to the tags in `halve-it.md`'s Tags table (1 + 2 + 3 + 1 + 2 + 1 = 10).
  - Then seed and verify the integration DB:
    ```bash
    DATABASE_URL='postgres://postgres@localhost:5433/integration?sslmode=disable' npm run db:seed:ci
    DATABASE_URL='postgres://postgres@localhost:5433/integration?sslmode=disable' npm run db:verify:ci -- 0047_exercise_type
    ```
    Expected: `ALL 16 CHECKS PASSED`.
  - Run `npm run db:seed:ci` again. Expected: no error (idempotent).
  - Drop the scratch DB: `psql "postgres://postgres@localhost:5433/postgres" -c "DROP DATABASE halveit_fresh"`.

- [ ] **Step 7: README.**
  - Add `47. \`seeds/0047_halve_it_exercise_type.sql\` (\`HALVE_IT\`; a type seeded after \`0042\`, so its tag links land on \`db:seed\`'s second pass)` after item 46.
  - In the verification table, replace the `0038_hit_count`, `0039_switchblade` and `0040_doubles_lock` rows with:
```
| `verification/0047_exercise_type_seed_checks.sql` | seeds `0038`/`0039`/`0040`/`0047`: per Track exercise type (`HIT_COUNT`, `SWITCHBLADE`, `DOUBLES_LOCK`, `HALVE_IT`) the type is published, its v1 ruleset is version 1, the system template pins it with its default configuration, and `v_exercise_template_catalog` offers it — one row per type in its `expected` table (16 checks) (2026-10-21) |
```

- [ ] **Step 8: Commit** with the regenerated `0042`:
```bash
git add database app/scripts/generate-tag-seed.ts app/tests/scripts/generate-tag-seed.test.ts
git commit -m "feat(halve-it): seed 0047, null-safe exercise tag links, one Track seed verification (#1049)"
```

---

### Task 9: Stats

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
  - `STEP_METRIC_SPECS.HALVE_IT = { metrics: { points: "sum", halvings: "sum", darts: "sum", hits: "sum" }, headline: "points", direction: "higher", rates: [["hits", "darts"]] }`.
  - `STATE_FIELDS.HALVE_IT = { points: "total", halvings: "halvings", darts: "dartsThrown", hits: "hits" }`.

- [ ] **Step 1: Write the failing tests.**
  - **`step-metrics.module.test.ts`:**
    - Add `const halveIt = halveItEngineFactory.create({});`, played with `dart(20, "TREBLE"), dart(20, "SINGLE"), dart(null, "MISS"), dart(null, "MISS"), dart(null, "MISS"), dart(null, "MISS")`. That is round 1 at 80, then a blank round 2 at 40.
    - Add the fixture `{ kind: "HALVE_IT", …, expected: { points: 40, halvings: 1, darts: 6, hits: 2 } }`.
  - **`replay-step-games.ts`:** add to `EXERCISE_FIXTURES`:
    ```ts
      HALVE_IT: {
        typeKey: "HALVE_IT",
        rulesetKey: "HALVE_IT_V1",
        factory: halveItEngineFactory,
        config: {},
        darts: [
          dart(20, "TREBLE"),
          dart(20, "SINGLE"),
          dart(null, "MISS"),
          dart(null, "MISS"),
          dart(null, "MISS"),
          dart(null, "MISS"),
        ],
      },
    ```
  - **`replay-fold-steps.test.ts`:** append `replays a Halve-It run visit by visit to the engine's final state`, modelled on the Doubles Lock case. Expect `turns` length 2 and `finalState` to match `{ total: 40, halvings: 1 }`.
  - **`step-result.module.test.ts`:** append `replays a Halve-It session's points, halvings, darts and hits`, modelled on the Doubles Lock case, with:
    - session `"hi"`, `exerciseRulesetVersionKey: "HALVE_IT_V1"`, `configuration: {}`;
    - `intendedTargetNumber: null`, `intendedZoneKey: null`;
    - turn 1 darts `(1, 20, "TREBLE", 60)`, `(2, 20, "SINGLE", 20)` and `(3, null, "MISS", 0)`;
    - expected `{ points: 80, halvings: 0, darts: 3, hits: 2 }`.

    If the local row helper fixes the intended fields, give it parameters.
  - **`replay-presenters-steps.test.ts`:** append `it("covers Halve-It", () => expect(KINDS).toContain("HALVE_IT"));`.
  - **`stats-routine.ts`:**
    - append `exerciseStep(15, "HALVE_IT", {})`;
    - the `ROUTINE_STEPS` JSDoc ends "…then Doubles Lock, then Halve-It".
  - **`statistics-sql.itest.ts`:**
    - `toHaveLength(14)` → `toHaveLength(15)`;
    - ledger `Ruling: stepKinds 14 → 15 — "one step per kind", same guarantee — cost if wrong: none`.
- [ ] **Step 2: Run** `npm test -- tests/modules/stats tests/lib/stats`. Expected: FAIL; `"HALVE_IT"` is not a `DartExerciseKind`.
- [ ] **Step 3: Implement.**
  - **`stats/types.ts`:** add `| "HALVE_IT"` to `DartExerciseKind`, and change the JSDoc's "twelve" to "thirteen".
  - **`step-metrics.module.ts`:** add the spec, and the `STATE_FIELDS` row given under Interfaces.
  - **`step-result.module.ts` and `replay-fold.ts`:** add `import "@modules/training/exercises/halve-it.engine.module";` in sorted position.
  - **`replay-presenters.ts`:** add `HALVE_IT: "darts",` to `DARTS_METRIC_KEY`.
- [ ] **Step 4: Run** `npm test -- tests/modules/stats tests/lib/stats` (PASS), then `npm run check` (0/0/0).
  - Then run the integration suite against the integration DB, seeded through `0047`: `DATABASE_URL="postgres://postgres@localhost:5433/integration" npm run test:integration`.
  - Expected: all pass. The fixture writes Halve-It darts with `intendedTargetNumber` null and zone null, so this also proves `chk_dart_target_consistency` admits Halve-It's facts.
- [ ] **Step 5: Commit**
```bash
git add app/src/modules/stats app/src/lib/stats app/tests/modules/stats app/tests/lib/stats app/tests/integration
git commit -m "feat(halve-it): step metrics, step result and replay"
```

---

### Task 10: Routine summary, step adapter

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`
- Create: `app/src/lib/training/routines/adapters/halve-it.adapter.ts`
- Modify:
  - `adapters/types.ts`
  - `adapters/step-adapter.registry.ts`
  - `app/src/lib/training/routines/types.ts` (the slot, and `ExerciseEngineSlots`)
  - `routine-play.data.ts` (`halveItEngine: null`, and the `DART_ENGINE_RECORDERS` row)
- Test:
  - `app/tests/modules/training/routines/routine-summary-engines.module.test.ts`
  - `app/tests/lib/training/routines/adapters/dart-exercise.adapter.test.ts`
  - `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`
  - `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Produces:
  - `summariseHalveIt(state: HalveItState): RoutineStepSummary`;
  - `halveItAdapter`: key `"HALVE_IT"`, headerLabel and title `"Halve-It"`, panel `"halve-it"`;
  - `RoutinePlayContext.halveItEngine: HalveItEngine | null`;
  - `recordHalveItDart`, generated from the new `DART_ENGINE_RECORDERS` row.

- [ ] **Step 1: Write the failing tests.**

Append to the summary test:
```ts
  it("summariseHalveIt reads total, halvings, each round's hits, passes, darts and rate", () => {
    const engine = halveItEngineFactory.create({});
    [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(null, "MISS"),
    ].forEach((d) => engine.record(d));

    const summary = summariseHalveIt(engine.state());
    expect(summary.stepKey).toBe("HALVE_IT");
    expect(summary.label).toBe("Halve-It");
    expect(summary.rows.slice(0, 4)).toEqual([
      { label: "Total", value: "40" },
      { label: "Halvings", value: "1" },
      { label: "Round 1 (20)", value: "2" },
      { label: "Round 2 (16)", value: "0" },
    ]);
    expect(summary.rows[4]).toEqual({ label: "Round 3 (Any double)", value: "0" });
    expect(summary.rows.slice(-3)).toEqual([
      { label: "Passes", value: "0" },
      { label: "Darts", value: "6" },
      { label: "Hit rate", value: "33.33%" },
    ]);
  });
```
- In `dart-exercise.adapter.test.ts`, add the row `[halveItAdapter, "HALVE_IT", "halveItEngine"]` to `CASES`, with its import. Ledger `Ruling: adapter table gains HALVE_IT — same per-adapter guarantee`.
- In `step-adapter.registry.test.ts`, add `"HALVE_IT"` to the exhaustive key list, and append an `it` asserting that `resolveStepAdapter("HALVE_IT")?.title` is `"Halve-It"`. Ledger it the same way.
- Append to `routine-play.data.test.ts`:
```ts
describe("routinePlay — Halve-It", () => {
  it("starts with no Halve-It engine", () => {
    expect(makeStore().halveItEngine).toBeNull();
  });
});
```
- [ ] **Step 2: Run** `npm test -- tests/modules/training/routines tests/lib/training/routines/adapters tests/lib/training/routines/routine-play.data.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**

`routine-summary.module.ts`:
```ts
/**
 * Halve-It's result is its total and halvings, then each round's hits
 * summed over every pass, then passes, darts and hit rate.
 */
export function summariseHalveIt(state: HalveItState): RoutineStepSummary {
  const { points, halvings, darts, hits } = stepMetrics(
    "HALVE_IT",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "HALVE_IT",
    label: "Halve-It",
    rows: [
      { label: "Total", value: String(points) },
      { label: "Halvings", value: String(halvings) },
      ...state.hitsPerTarget.map((entry, index) => ({
        label: `Round ${index + 1} (${boardTargetLabel(entry.target)})`,
        value: String(entry.hits),
      })),
      { label: "Passes", value: String(state.passes) },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}
```

`adapters/halve-it.adapter.ts`:
```ts
import { HalveItEngine } from "@modules/training/exercises/halve-it.engine.module";
import { summariseHalveIt } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const halveItAdapter = dartExerciseAdapter({
  key: "HALVE_IT",
  headerLabel: "Halve-It",
  title: "Halve-It",
  panel: "halve-it",
  rulesetKey: "HALVE_IT_V1",
  slot: "halveItEngine",
  engineClass: HalveItEngine,
  summarise: (engine) => summariseHalveIt(engine.state()),
});
```
Then:
- **`adapters/types.ts`:** add `| "HALVE_IT"` and `| "halve-it"`.
- **Registry:** import the adapter and add `HALVE_IT: halveItAdapter,`.
- **`routines/types.ts`:**
  - import `type HalveItEngine`;
  - add `halveItEngine: HalveItEngine | null;` after `doublesLockEngine`;
  - add `| "halveItEngine"` to `ExerciseEngineSlots`;
  - add `| HalveItEngine` to `activeDartEngine`'s return type;
  - add `recordHalveItDart(this: RoutinePlayContext, observation: DartObservation): void;`.
- **`routine-play.data.ts`:**
  - add `halveItEngine: null,` after `doublesLockEngine: null,`;
  - add `["halveItEngine", "recordHalveItDart"],` after the Doubles Lock row;
  - add `| HalveItEngine` to `activeDartEngine`'s return type, with its type import.
- [ ] **Step 4: Run** the Step 2 command (PASS), then `npm run check` (0/0/0).
- [ ] **Step 5: Commit**
```bash
git add app/src/modules/training/routines/routine-summary.module.ts app/src/lib/training/routines app/tests/modules/training/routines app/tests/lib/training/routines
git commit -m "feat(halve-it): routine summary and step adapter"
```

---

### Task 11: Play surface

**Files:**
- Modify:
  - `app/src/lib/training/routines/exercise-preview.ts`
  - `app/src/lib/training/routines/routine-play.data.ts`
  - `app/src/lib/training/routines/types.ts`
- Create: `app/src/components/layout/training/exercises/HalveItPanel.astro`
- Modify: `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/exercise-preview.test.ts`, `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Produces:
  - `visitPreview`'s `judge(dart, index, visitIndex)`;
  - `judgeDart(family, dart, visitIndex = 0)`;
  - the preview family `"halveIt"`;
  - on `RoutinePlayContext`: `judgeExerciseDart(dart, visitIndex?)`, `halveItTotal(): number`, `halveItRoute(): string`, `halveItChipIndex(): number`, `halveItRound(): number`, `halveItPasses(): number`, `halveItRate(): string`.

- [ ] **Step 1: Write the failing tests.**

`exercise-preview.test.ts`:
- Add `halveItEngine: null` to `none`. Ledger `Ruling: preview none fixture gains the new slot — same "no engine open" guarantee`.
- Append inside `describe("exerciseFamily")`:
  ```ts
    it("maps the open Halve-It engine to its family", () => {
      expect(exerciseFamily({ ...none, halveItEngine: {} as never })).toBe("halveIt");
    });
  ```
- Append:
  ```ts
  describe("Halve-It preview", () => {
    const thrown = (hitTargetNumber: number | null, hitZoneKey: DartZoneKey) =>
      ({ hitTargetNumber, hitZoneKey, intendedTargetNumber: null, intendedZoneKey: null }) as DartFact;

    it("judges each visit against its own round's target", () => {
      expect(judgeDart("halveIt", thrown(20, "TREBLE"), 0)).toBe("hit");
      expect(judgeDart("halveIt", thrown(5, "SINGLE"), 0)).toBe("miss");
      expect(judgeDart("halveIt", thrown(25, "INNER_BULL"), 2)).toBe("hit");
      expect(judgeDart("halveIt", thrown(25, "OUTER_BULL"), 2)).toBe("miss");
      expect(judgeDart("halveIt", thrown(25, "OUTER_BULL"), 8)).toBe("hit");
    });

    it("judges a wrapped visit against 20", () => {
      expect(judgeDart("halveIt", thrown(20, "SINGLE"), 9)).toBe("hit");
      expect(judgeDart("halveIt", thrown(25, "INNER_BULL"), 9)).toBe("miss");
    });

    it("captions the visit with its round's target", () => {
      const input = {
        config: {},
        currentTargetNumber: undefined,
        targetIndex: 0,
        dartsInOpenVisit: 0,
      };
      expect(visitLabelsFor("halveIt", { ...input, visitIndex: 2 })).toEqual([
        "Any double",
        "Any double",
        "Any double",
      ]);
      expect(visitLabelsFor("halveIt", { ...input, visitIndex: 17 })).toEqual(["BULL", "BULL", "BULL"]);
    });
  });
  ```

`routine-play.data.test.ts`:
- Append `HALVE_IT_STEP`, copied from `DOUBLES_LOCK_STEP` with keys `HALVE_IT`/`HALVE_IT_V1`.
- Then add `describe("routinePlay — Halve-It play", …)`. Copy the Doubles Lock play block's setup, with `S = (n) => ({ hitTargetNumber: n, hitZoneKey: "SINGLE" as const, locationX: 0, locationY: -100 })`. The cases:
  - **start:**
    - `halveItEngine` is not null;
    - `halveItTotal()` 0; `halveItRound()` 1; `halveItPasses()` 0; `halveItRate()` "—";
    - `halveItRoute()` is `"20 16 Any double 17 18 Any treble"`, the first page of 6;
    - `halveItChipIndex()` 0.
  - **readouts:** after `S(20), S(20), MISS, S(16)`:
    - total 56; round 2; rate `"75.00%"`; chip index 1.
  - **halving:** after `S(20), MISS, MISS, MISS, MISS, MISS`:
    - total 10; round 3.
  - **route paging:** after six blank visits, `halveItRoute()` is `"19 20 BULL"` and `halveItChipIndex()` is 0.
  - **preview:** after `S(20), MISS, MISS, S(16)`, `previewSegments()` equals `[{ status: "hit", label: "16" }, { status: "empty", label: "16" }, { status: "empty", label: "16" }]`.
  - **routes a committed board dart:** `boardCommit.onCommit!(S(20))` → `halveItEngine!.state().dartsThrown` 1.
  - **never completes on a dart:** after 27 MISS darts, `appendBatch` is not called and `isComplete()` is false.
  - **deadline expires and uploads:** `advanceTimersByTimeAsync(600_000)` → `appendBatch` called and `stepSummaries[0]` matches `{ stepKey: "HALVE_IT" }`.
- In the `board dispatch` `it.each`, add `["HALVE_IT", "halveItEngine"],`. Ledger the same way as the other exhaustive tables.

- [ ] **Step 2: Run** `npm test -- tests/lib/training/routines/exercise-preview.test.ts tests/lib/training/routines/routine-play.data.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**

`routines/types.ts`:
- `| "halveIt"` in `ExercisePreviewFamily`;
- `judgeExerciseDart(this: RoutinePlayContext, dart: DartFact, visitIndex?: number): DartJudgement;`;
- signatures for the six readouts.

`exercise-preview.ts`:
- Import `HALVE_IT_PATH` from the engine module and `anyRingEitherBull` from `@modules/game/track-policies`.
- Change `JUDGES` to `Record<ExercisePreviewFamily, (dart: DartFact, visitIndex: number) => DartJudgement>` and add `halveIt: judgeHalveIt`.
- Add `["halveItEngine", "halveIt"]` to `ENGINE_FAMILIES`.
- Add `halveIt: halveItCaptions` to `CAPTIONS`.
- New functions:
  ```ts
  function halveItRoundTarget(visitIndex: number): TrackTarget {
    return HALVE_IT_PATH[visitIndex % HALVE_IT_PATH.length];
  }

  function judgeHalveIt(dart: DartFact, visitIndex: number): DartJudgement {
    return anyRingEitherBull(halveItRoundTarget(visitIndex), dart) ? "hit" : "miss";
  }

  function halveItCaptions(input: VisitLabelInput): Captions {
    const label = boardTargetLabel(halveItRoundTarget(input.visitIndex));
    return [label, label, label];
  }
  ```
  If `DartFact` is not assignable to `DartObservation`, pass `{ ...dart, locationX: null, locationY: null }` and ledger the ruling.
- `judgeDart(family, dart, visitIndex = 0)` returns `JUDGES[family](dart, visitIndex)`. Extend its JSDoc: "Halve-It judges against the round's own target (any ring, either bull, or the zone)."
- In `visitPreview`, change `judge`'s type to `(dart: DartFact, index: number, visitIndex: number) => DartJudgement` and call `input.judge(dart, index, visitIndex)`.

`routine-play.data.ts`:
- `previewSegments` passes `judge: (dart, _index, visitIndex) => this.judgeExerciseDart(dart, visitIndex)`.
- `judgeExerciseDart(this, dart, visitIndex = 0)` returns `judgeDart(exerciseFamily(this) ?? "switching", dart, visitIndex)`.
- Add the readouts after the Doubles Lock block, importing `HALVE_IT_PATH` and `type TrackTarget`:
  ```ts
      halveItTotal(this: RoutinePlayContext): number {
        return this.halveItEngine?.state().total ?? 0;
      },

      /** Halve-It's list as chips, paged around the current round (`windowPage`); a zone keeps its words with a no-break space. */
      halveItRoute(this: RoutinePlayContext): string {
        const index = this.halveItEngine?.state().targetIndex ?? 0;
        return windowPage(HALVE_IT_PATH.map(chipLabel), index).join(" ");
      },

      /** The current round's chip within `halveItRoute()`'s page. */
      halveItChipIndex(this: RoutinePlayContext): number {
        return windowIndex(this.halveItEngine?.state().targetIndex ?? 0);
      },

      halveItRound(this: RoutinePlayContext): number {
        return this.halveItEngine?.state().round ?? 1;
      },

      halveItPasses(this: RoutinePlayContext): number {
        return this.halveItEngine?.state().passes ?? 0;
      },

      halveItRate(this: RoutinePlayContext): string {
        const state = this.halveItEngine?.state();
        return checkoutPercentageDisplay(state?.hits ?? 0, state?.dartsThrown ?? 0);
      },
  ```
- Add the module-level helper:
  ```ts
  /** A path target's chip text: `RouteChips` splits on spaces, so a zone's words join with a no-break space. */
  function chipLabel(target: TrackTarget): string {
    return boardTargetLabel(target).replace(" ", " ");
  }
  ```

`HalveItPanel.astro`:
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="halveItTotal()"
  caption="TOTAL"
  chip={{
    routeExpr: "halveItRoute()",
    currentIndexExpr: "halveItChipIndex()",
  }}
  tiles={[
    { label: "Round", value: "halveItRound()" },
    { label: "Pass", value: "halveItPasses() + 1" },
    { label: "Rate", value: "halveItRate()" },
  ]}
/>
```
In `play/index.astro`, import `HalveItPanel` beside `DoublesLockPanel` and mount it after the Doubles Lock block:
```astro
        <template x-if="adapter?.panel === 'halve-it' && halveItEngine">
          <HalveItPanel />
        </template>
```

- [ ] **Step 4: Run** the Step 2 command, then the full suite (`npm test`) and `npm run check`. Expected: all PASS, 0/0/0.
- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/routines app/src/components/layout/training/exercises/HalveItPanel.astro app/src/pages/training/routines/play/index.astro app/tests/lib/training/routines
git commit -m "feat(halve-it): routine play surface, preview family and panel"
```

---

### Task 12: Docs and decision D478

**Files:**
- Modify:
  - `decisions/game-engine.md`
  - `docs/architecture/04-Architecture-patterns.md`
  - `docs/architecture/09-Training/01-Routines.md`
  - `docs/architecture/10-Statistics/01-Section-Catalog.md`
  - `docs/architecture/07-Frontend/08-Component-Inventory.md`
  - `docs/architecture/00-File-Inventory.md`
  - `docs/architecture/00-Context-Map-History.md`
  - `app/src/modules/training/CLAUDE.md`
  - `docs/game-rules/training/exercises/halve-it.md`
  - `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (refinements, if not folded in at approval)

- [ ] **Step 1: The decision.** Re-run `bash scripts/next-decision-id.sh`. If it no longer prints `D478`, use its id everywhere below. Append to `decisions/game-engine.md`:
```markdown
### D478 — Zone targets are their own type; TrackRules takes a defaulted target parameter
Status: Accepted · Date: 2026-10-21
Decision: a number-less Track target (`ANY_DOUBLE`, `ANY_TREBLE`) is a `ZoneTarget`, and `TrackTarget = BoardTarget | ZoneTarget`. `TrackRules`, `JudgedDart`, the kernel's three folds, `TrackExerciseDefinition` and `trackExerciseSpec` take `TTarget extends TrackTarget = BoardTarget`; `isHitOn`, `boardTargetLabel`, `targetAt`, `pathTarget`, `anyRingEitherBull`, `tallyOnTarget` and `boardScorePoints` accept a `TrackTarget`. `BoardTarget` is unchanged. Halve-It is the first caller.
Reason: widening `BoardTarget` itself breaks every game that reads `target.number` once BULL is ruled out — 33 type errors in 20 files, 12 in append-only tests. The defaulted parameter changes no existing engine or test.
Consequences: a game or exercise that never aims at a zone keeps `BoardTarget` and its narrowings. A zone target's dart carries `intendedTargetNumber` null and the zone as `intendedZoneKey`. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md`.
Supersedes: none.
```
Then run `bash scripts/check-decision-ids.sh`. Expected: OK.

- [ ] **Step 2: Canonical docs.** Use minimal diffs and ISO date `2026-10-21`.
  - **Pattern 18:**
    - Prepend `1.11.12 (Pattern 18: Halve-It bound through \`trackExerciseSpec\`; zone targets via a defaulted \`TrackRules\` target type 2026-10-21, D478; prior 1.11.11: …)`, keeping the chain.
    - The TRACK row's tail becomes "… Hit Count, SwitchBlade, Doubles Lock, Halve-It bound through `trackExerciseSpec` (D469, D478, #993) …".
    - Where Pattern 18 describes `TrackRules`, add one sentence: "`TrackRules` takes an optional target type, defaulting to `BoardTarget`; a ruleset aiming at a zone (`ANY_DOUBLE`, `ANY_TREBLE`) passes `TrackTarget` (D478)."
  - **Routines §17,** after Doubles Lock:
    ````markdown
    ## Halve-It

    Configuration:

    ```text
    duration: 10m

    list (fixed): 20 16 any-double 17 18 any-treble 19 20 bull
    start total (fixed): 0
    ```

    One visit of three darts per round. Darts in the round's target add their board value: any ring on a number, any double (the bullseye included) on Any double, any treble on Any treble, outer bull 25 and bullseye 50 on Bull. A visit with no dart in the target halves the total, rounding up (95 → 48). After Bull the list starts again with the total carried, until the time runs out. Rules: `docs/game-rules/training/exercises/halve-it.md`.

    **Implemented** (`HALVE_IT_V1`, `app/src/modules/training/exercises/halve-it.engine.module.ts`, seed `0047`): empty configuration, bound to the Track kernel through `trackExerciseSpec` (D469) on a `TrackTarget` path (D478) with `anyRingEitherBull`, `boardScorePoints`, `tallyOnTarget`, `halveOnBlank`, `advanceAfterDarts(3)` and `passOnWrap(8)`. A dart at a number or the bull carries no intended bed; a dart at a zone carries the zone. One turn per visit. State carries the total, halvings, rounds, passes and hits per round. Time-bound only. Routine step only in V1 (2026-10-21).
    ````
  - **Section catalog:** add `| HALVE_IT | points, halvings, darts, hits (sum) | points ↑ | hits/darts |` after DOUBLES_LOCK.
  - **Component inventory:** add `| \`HalveItPanel.astro\` | Halve-It play surface (2026-10-21): \`halveItTotal()\` TOTAL, a route chip of the nine rounds, Round / Pass / Rate tiles — a call to \`ExercisePanelShell\` | none (reads the routine play page scope) |` after DoublesLockPanel.
  - **File Inventory:**
    - Add rows for seed `0047`, the engine, `dart-exercise.adapter.ts` and `0047_exercise_type_seed_checks.sql`, mirroring the Doubles Lock rows' wording and place.
    - Delete the three replaced verification rows.
    - In the adapters row, add `halve-it.adapter.ts` and `dart-exercise.adapter.ts` ("every exercise adapter is one `dartExerciseAdapter` call").
    - In the `track-policies.ts` row, note zone targets (D478).
    - In the `dart-exercise-shell.module.ts` row, add `registerDartExercise`.
    - In the `generate-tag-seed.ts` row, add "exercise links skip a type not yet seeded".
  - **Context-Map History:** add one row listing the changed files and "Halve-It V1 shipped on the Track kernel; zone targets (D478); reuse prep — `dartExerciseAdapter`, generated recorders, `registerDartExercise` (#1050), `stepMetrics` field map (#1048), one Track seed verification (#1049); null-safe exercise tag links; seed `0047`. Track T2.1 (2026-10-21)".
  - **`modules/training/CLAUDE.md`:**
    - add `halve-it` to the engine file list;
    - add Halve-It to the `trackExerciseSpec` users;
    - add one bullet: "A shell-built exercise module ends in `registerDartExercise(spec)` and exports its `Engine`, `factory` and `fold` from the result (2026-10-21, #1050)."
  - **Rules file:**
    - set `Current version: V1 (shipped 2026-10-21)`, using the actual merge-ready date;
    - replace the Exercise type's first bullet with "Type constant: `HALVE_IT` (seed `0047`)."
  - **Spec:** fold in this plan's Spec refinements (§1, §2.0, §2.1, §3, §4, §6, §7, §9) if not done at approval.
- [ ] **Step 3: Run** `bash scripts/check-context-map.sh` (minutes; run it in the background), then:
  ```bash
  bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-game-rules.sh && bash scripts/check-doc-sync.sh && bash scripts/check-decision-ids.sh && bash scripts/check-tag-seeds.sh
  ```
  Expected: all OK. The rules-file version flip does not change the tag seed; if `check-tag-seeds.sh` says stale, run `npm run tags:generate` and include `0042`.
- [ ] **Step 4: Commit**
```bash
git add decisions docs app/src/modules/training/CLAUDE.md database/seeds/0042_catalog_tags.sql
git commit -m "docs(halve-it): D478 zone targets, routines, stats catalog, inventories, rules V1"
```

---

### Task 13: Gates and duplication

- [ ] **Step 1: Format.** `cd app && npm run format && npm run format:check`. Commit any diff as `style: format`.
- [ ] **Step 2: Validate.** `cd app && npm run validate:app`, with the temporary `app/.env`; delete it afterwards. Expected: exit 0, 0/0/0, fallow clean. If fallow flags `routine-play.data.ts` or `exercise-preview.ts` (CRAP or complexity), fix it at the cause here and ledger the ruling.
- [ ] **Step 3: Gate scripts.** Run every script in the `run-all-gates` skill's "Always run" and "app/ changed" lists, plus:
  - `bash scripts/check-engine-kernels.sh` and `bash scripts/test-check-engine-kernels.sh`;
  - `bash scripts/check-tag-seeds.sh` and `bash scripts/test-check-tag-seeds.sh`.

  Expected: all OK. Record each result for the PR body.
- [ ] **Step 4: Duplication.** Re-run Task 1 Step 0's loop.
  - Expected: no path's count is above its baseline.
  - `src/lib/training/routines` and `src/modules/training/exercises` should fall.
  - Ledger before → after. A rise is a finding for this task: fix it here, or ledger why it stands.
- [ ] **Step 5: Decision id.** `bash scripts/next-decision-id.sh`. Expected: `D479`, since this PR adds D478. If another D478 landed on `main`, renumber with `bash scripts/renumber-decision.sh D478 <new>`.
- [ ] **Step 6: Issues.** The PR body says `Closes #1048, closes #1049, closes #1050`. #1051 stays open for T2.3.
