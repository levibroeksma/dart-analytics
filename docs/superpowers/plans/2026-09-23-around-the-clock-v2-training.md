# Around the Clock V2 Training Variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `AROUND_THE_CLOCK_V2` — direction, odds first, outer-single-only, 1/2/3-dart difficulty with step back, and a 3–30 min timed run with lap restart — standalone (PR1), then as a routine GAME step with three seeded templates (PR2).

**Architecture:** New ruleset version beside V1 (D243/D245/D247). One engine class serves both keys; a `rulesOf(config)` presence check resolves V1 snapshots to V1-equivalent rules so V1 folds byte-identically. Path is a pure function of direction + odds first (`clockPath`). Timer expiry enters through `expireTimer()` like TUOD; a timed seat completes only once its open visit closes.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Zod, PostgreSQL seeds.

**Spec:** `docs/superpowers/specs/2026-09-23-around-the-clock-v2-training-design.md`
**Rules:** `docs/game-rules/rulesets/around-the-clock.md`

## Global Constraints

- TDD per `app/CLAUDE.md` §Test-Driven Development: red test first, watch it fail, then implement.
- `cd app && npm test` runs the whole suite — run it at the end of every task, not one file only.
- JSDoc comments only; no inline `//` inside function bodies (`check-comments.sh`).
- Exported types live in type barrels (`modules/game/types.ts`, `lib/game/rulesets/types.ts`, `lib/game/types.ts`) — `check-type-barrels.sh`.
- Never edit applied migrations. This plan adds seeds only; no migration.
- `npm run format` before every commit.
- Branch: `claude/around-clock-training-routine-wr1h1p`. PR2 starts only after PR1 merges: restart the same branch from `origin/main` (merged-PR rule), never stack.
- Incidental findings → GitHub issue via `capturing-discovered-work`; never fixed in the same pass.
- Commit only when the user asks.

## File Map

| File | PR | Change |
| --- | --- | --- |
| `app/src/lib/game/rulesets/types.ts` | 1 | `AroundTheClockV2Config`, key, `RULESET_CONFIGS`, snapshot, `ConfigSnapshotFor` |
| `app/src/lib/game/around-the-clock-duration.ts` | 1 | New: bounds + clamp + notice |
| `app/src/lib/game/rulesets/refinement-contract.ts` | 1 | V2 contract |
| `app/src/modules/game/board-progression.module.ts` | 1 | `clockPath` |
| `app/src/modules/game/types.ts` | 1 | `AroundTheClockRules`; seat state `laps`, `hitsThisVisit`; state `timerExpired` |
| `app/src/modules/game/around-the-clock.engine.module.ts` | 1 | Rules, reducer, fold, engine key + timer, V2 factory |
| `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts` | 1 | `aroundTheClockV2Validator` |
| `app/src/services/rulesets/registry.ts` | 1 | Register V2 |
| `app/src/lib/game/rulesets/capabilities.ts` | 1 | V2 capabilities |
| `app/src/services/session-seats.service.ts` | 1 | `SEAT_CAPS` V2 |
| `app/src/lib/game/rulesets/games-visibility.ts` | 1 | Row → V2 |
| `app/src/lib/game/types.ts` | 1 | Setup ctx fields; play ctx widen; results type |
| `app/src/lib/game/around-the-clock-setup.data.ts` | 1 | Key by ctx, overrides, guest/bot resets |
| `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro` | 1 | Toggles + minutes |
| `app/src/lib/game/around-the-clock-play.data.ts` | 1 | Resume either key, path-aware helpers, countdown, expiry finish, results, playAgain |
| `app/src/pages/games/around-the-clock/play/index.astro` | 1 | HUD: lap, time, hits needed; timed results |
| `database/seeds/0027_around_the_clock_v2_game_engine_reference.sql` | 1 | `ruleset_versions` row |
| `database/seeds/0007_ruleset_version_capabilities.sql` | 1 | Two rows |
| `database/verification/0027_around_the_clock_v2_capability_checks.sql` | 1 | New |
| `docs/game-rules/rulesets/around-the-clock.md`, `decisions/game-engine.md` | 1 | Docs |
| `app/src/services/routines/game-step.ts` | 2 | `ROUTINE_GAME_STEPS.AROUND_THE_CLOCK_V2` |
| `app/src/modules/training/routines/routine-summary.module.ts` | 2 | `summariseAroundTheClock` |
| `app/src/lib/training/routines/adapters/game.adapter.ts`, `types.ts`, `step-adapter.registry.ts` | 2 | Summarise wrapper, panel, adapter |
| `app/src/components/layout/games/play/AroundTheClock.astro` | 2 | New: play surface extracted from the page |
| `app/src/pages/training/routines/play/index.astro` | 2 | Panel template |
| `database/seeds/0028_around_the_clock_routine_templates.sql` + verification | 2 | Three GAME templates |
| `docs/architecture/09-Training/01-Routines.md`, `07-Frontend/08-Component-Inventory.md` | 2 | Docs |

Spec deltas found while planning (fold into the spec's status note in Task 10): routine eligibility also needs a summary, a `StepPanel` and a reusable play component (spec §10/§12 said none); timed expiry with no open visit needs an explicit finish trigger (spec §8).

---

# PR1 — Standalone V2

### Task 1: Config schema, snapshot, duration bounds

**Files:**
- Create: `app/src/lib/game/around-the-clock-duration.ts`
- Modify: `app/src/lib/game/rulesets/types.ts`, `app/src/lib/game/rulesets/refinement-contract.ts`
- Test: `app/tests/lib/game/rulesets/types.test.ts`, `app/tests/lib/game/around-the-clock-duration.test.ts` (new)

- [ ] **Step 1: Failing tests.** In `types.test.ts` add a `describe("AroundTheClockV2Config")`:

```ts
const v2Base = {
  path_direction: "LOW_TO_HIGH",
  odds_first: false,
  segment_rule: "ANY",
  difficulty: "EASY",
  duration_type: "UNTIMED",
  duration_value: null,
} as const;

it("accepts the untimed default", () => {
  expect(AroundTheClockV2Config.safeParse(v2Base).success).toBe(true);
});
it("accepts MINUTES 3 and 30", () => {
  for (const v of [3, 30])
    expect(AroundTheClockV2Config.safeParse({ ...v2Base, duration_type: "MINUTES", duration_value: v }).success).toBe(true);
});
it("rejects MINUTES 2, 31 and null", () => {
  for (const v of [2, 31, null])
    expect(AroundTheClockV2Config.safeParse({ ...v2Base, duration_type: "MINUTES", duration_value: v }).success).toBe(false);
});
it("rejects UNTIMED carrying a value", () => {
  expect(AroundTheClockV2Config.safeParse({ ...v2Base, duration_value: 10 }).success).toBe(false);
});
it("rejects unknown keys and bad enums", () => {
  expect(AroundTheClockV2Config.safeParse({ ...v2Base, extra: 1 }).success).toBe(false);
  expect(AroundTheClockV2Config.safeParse({ ...v2Base, difficulty: "EXTREME" }).success).toBe(false);
});
it("toSnapshot camel-cases every key", () => {
  expect(toSnapshot("AROUND_THE_CLOCK_V2", v2Base)).toEqual({
    pathDirection: "LOW_TO_HIGH", oddsFirst: false, segmentRule: "ANY",
    difficulty: "EASY", durationType: "UNTIMED", durationValue: null,
  });
});
```

`around-the-clock-duration.test.ts`: `aroundTheClockDurationBounds()` → `{ min: 3, max: 30 }`; `clampAroundTheClockDuration(2)` → `{ value: 3, clamped: true }`, `(31)` → `{ 30, true }`, `(12.7)` → `{ 12, true }`, `("x")` → `{ 3, true }`, `(10)` → `{ 10, false }`; `aroundTheClockDurationClampNotice()` → `"Allowed range: 3–30 minutes"`.

- [ ] **Step 2: Run, watch fail.** `cd app && npx vitest run tests/lib/game/rulesets/types.test.ts tests/lib/game/around-the-clock-duration.test.ts`

- [ ] **Step 3: Implement.** `around-the-clock-duration.ts` mirrors `one-twenty-one-duration.ts` with MINUTES only:

```ts
/** Timed-run bounds, shared by the V2 schema, setup form and routine hook. */
export function aroundTheClockDurationBounds(): { min: number; max: number } {
  return { min: 3, max: 30 };
}
```

plus `clampAroundTheClockDuration(value: unknown)` (same body as `clampOneTwentyOneDuration`) and `aroundTheClockDurationClampNotice()`.

In `rulesets/types.ts`, after `AroundTheClockConfig` (leave it untouched):

```ts
/**
 * Around the Clock V2: the training variants. A new version rather than a
 * widening of `AroundTheClockConfig` — V1's empty schema is live against
 * real session data (D243/D245/D247). `duration_value` is bounded by
 * `duration_type`, so the bound lives in a whole-object `superRefine`.
 */
export const AroundTheClockV2Config = z
  .object({
    path_direction: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW"]),
    odds_first: z.boolean(),
    segment_rule: z.enum(["ANY", "OUTER_SINGLE"]),
    difficulty: z.enum(["EASY", "INTERMEDIATE", "HARD", "PRO"]),
    duration_type: z.enum(["UNTIMED", "MINUTES"]),
    duration_value: z.number().int().nullable(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.duration_type === "UNTIMED") {
      if (val.duration_value !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["duration_value"], message: "duration_value must be null for UNTIMED" });
      }
      return;
    }
    const { min, max } = aroundTheClockDurationBounds();
    if (val.duration_value === null || val.duration_value < min || val.duration_value > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["duration_value"], message: `duration_value must be between ${min} and ${max} for MINUTES` });
    }
  });
```

Import `aroundTheClockDurationBounds` from `../around-the-clock-duration` (check for an import cycle: the duration file must import nothing from `rulesets/types.ts`). Add `"AROUND_THE_CLOCK_V2"` to `RulesetVersionKey`, `AROUND_THE_CLOCK_V2: AroundTheClockV2Config` to `RULESET_CONFIGS`, `export type AroundTheClockV2ConfigData = z.infer<typeof AroundTheClockV2Config>`, the `AroundTheClockV2Snapshot` type (spec §3, fields typed off `AroundTheClockV2ConfigData`), and change the tail of `ConfigSnapshotFor` to `: K extends "AROUND_THE_CLOCK_V1" ? AroundTheClockSnapshot : AroundTheClockV2Snapshot`.

In `refinement-contract.ts` add `aroundTheClockV2Contract` (field `duration_value`: accept UNTIMED/null, MINUTES 3, MINUTES 30; reject UNTIMED/10, MINUTES 2, MINUTES 31, MINUTES null) and append it to `REFINEMENT_CONTRACTS`.

- [ ] **Step 4: Run** the two files, then `npm test` and `npx astro check` (the key union widening may surface exhaustive `Record<RulesetVersionKey, …>` maps — `RULESET_CAPABILITIES`, `SEAT_CAPS`, validator registry, `RULESET_DARTBOT` if total). Add only the entries Tasks 5–6 own; if a map outside this plan's file list demands one, stop and report.

### Task 2: `clockPath`

**Files:** Modify `app/src/modules/game/board-progression.module.ts`; test `app/tests/modules/game/board-progression.module.test.ts`.

- [ ] **Step 1: Failing test.**

```ts
describe("clockPath", () => {
  it("LOW_TO_HIGH", () => expect(clockPath("LOW_TO_HIGH", false)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25]));
  it("HIGH_TO_LOW", () => expect(clockPath("HIGH_TO_LOW", false)).toEqual([20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,25]));
  it("odds first, low → high", () => expect(clockPath("LOW_TO_HIGH", true)).toEqual([1,3,5,7,9,11,13,15,17,19,2,4,6,8,10,12,14,16,18,20,25]));
  it("odds first, high → low", () => expect(clockPath("HIGH_TO_LOW", true)).toEqual([19,17,15,13,11,9,7,5,3,1,20,18,16,14,12,10,8,6,4,2,25]));
});
```

- [ ] **Step 2: Watch fail. Step 3: Implement.**

```ts
/**
 * Around the Clock V2's order array for `numbersPath`: 1..20 or 20..1,
 * optionally odds before evens in that direction, BULL always last.
 */
export function clockPath(
  direction: "LOW_TO_HIGH" | "HIGH_TO_LOW",
  oddsFirst: boolean,
): readonly number[] {
  const ascending = Array.from({ length: 20 }, (_, i) => i + 1);
  const numbers = direction === "LOW_TO_HIGH" ? ascending : ascending.reverse();
  const ordered = oddsFirst
    ? [...numbers.filter((n) => n % 2 === 1), ...numbers.filter((n) => n % 2 === 0)]
    : numbers;
  return [...ordered, BULL_TARGET_NUMBER];
}
```

- [ ] **Step 4: Run** the file, then `npm test`.

### Task 3: Rules and reducer

**Files:** Modify `app/src/modules/game/types.ts`, `app/src/modules/game/around-the-clock.engine.module.ts`; test `app/tests/modules/game/around-the-clock.engine.module.test.ts` (reuse its `numberHit`/`miss`/`bullHit` helpers; add `outer(n)`/`inner(n)` returning `OUTER_SINGLE`/`INNER_SINGLE` observations).

- [ ] **Step 1: Types.** In `modules/game/types.ts`:

```ts
/** Around the Clock's resolved per-session rules — V1 resolves to the fixed 1..20 path, any segment, Easy, untimed. `hitsRequired` 0 = Easy (mid-visit advance). */
export type AroundTheClockRules = {
  path: readonly BoardTarget[];
  segmentRule: "ANY" | "OUTER_SINGLE";
  hitsRequired: 0 | 1 | 2 | 3;
  timed: boolean;
};
```

`AroundTheClockSeatState` gains `laps: number; hitsThisVisit: number;` (update its JSDoc: V1 always reads 0 for both). `AroundTheClockState` gains `timerExpired: boolean`.

- [ ] **Step 2: Failing tests.**

```ts
const v2 = (over: Partial<AroundTheClockV2Snapshot> = {}): Seated<AroundTheClockV2Snapshot> => ({
  seats: SEATS,
  pathDirection: "LOW_TO_HIGH", oddsFirst: false, segmentRule: "ANY",
  difficulty: "EASY", durationType: "UNTIMED", durationValue: null, ...over,
});
const seat0 = (config) => initialAroundTheClockState(config).seats[0];
const run = (config, darts: DartObservation[]) =>
  darts.reduce((s, d) => applyAroundTheClockDart(s, d, rulesOf(config)), seat0(config));
```

Cases:
1. `rulesOf(config)` (V1) → path `numbersPath()`, `ANY`, `0`, `false`.
2. Outer single: `rulesOf(v2({ segmentRule: "OUTER_SINGLE" }))`; `outer(1)` hits 1; `inner(1)`, `numberHit(1,"DOUBLE")`, `numberHit(1,"TREBLE")`, `outer(2)` miss; on BULL both `bullHit` rings hit. Test through `isClockHit(rules, target, obs)`.
3. Easy on `HIGH_TO_LOW` → `numberHit(20,"SINGLE")` advances to index 1 mid-visit.
4. INTERMEDIATE: `[miss(), numberHit(1,"SINGLE"), miss()]` → index 1, `dartsThisVisit 0`, `hitsThisVisit 0`; first two darts alone → index 0, `hitsThisVisit 1`.
5. HARD: two hits + miss → index 1; one hit + two misses from index 3 → index 2.
6. PRO: three hits → +1; two hits → −1.
7. Floor: failed INTERMEDIATE visit at index 0 → stays 0.
8. BULL step back: at index 20 a failed HARD visit → index 19.
9. Untimed path end: PRO, three bull hits at index 20 → `COMPLETE`; Easy one bull hit → `COMPLETE`, `dartsThisVisit 0`.
10. Timed path end: `v2({ durationType: "MINUTES", durationValue: 10 })`, Easy, bull hit at index 20 on the visit's 1st dart → `laps 1`, index 0, `dartsThisVisit 0`, `IN_PROGRESS`.
11. Floor after restart: timed INTERMEDIATE, lap 1 index 0, failed visit → index 0, `laps 1`.
12. V1 regression: existing V1 tests stay unchanged and green (they call the 2-arg form).

- [ ] **Step 3: Watch fail. Step 4: Implement** in the engine module:

```ts
const HITS_REQUIRED = { EASY: 0, INTERMEDIATE: 1, HARD: 2, PRO: 3 } as const;

const V1_RULES: AroundTheClockRules = { path: numbersPath(), segmentRule: "ANY", hitsRequired: 0, timed: false };

/** Presence check: a snapshot without `pathDirection` is V1 (mirrors Singles' `scoringModeOf`). */
export function rulesOf(config: AroundTheClockEngineConfig): AroundTheClockRules {
  if (!("pathDirection" in config)) return V1_RULES;
  return {
    path: numbersPath(clockPath(config.pathDirection, config.oddsFirst)),
    segmentRule: config.segmentRule,
    hitsRequired: HITS_REQUIRED[config.difficulty],
    timed: config.durationType === "MINUTES",
  };
}

/** Outer single only: the number's outer single, or either bull ring on BULL. */
export function isClockHit(rules: AroundTheClockRules, target: BoardTarget, observation: DartObservation): boolean {
  if (rules.segmentRule === "ANY" || target.kind === "BULL") return isAroundTheClockHit(target, observation);
  return observation.hitTargetNumber === target.number && observation.hitZoneKey === "OUTER_SINGLE";
}
```

`AroundTheClockEngineConfig = Seated<AroundTheClockSnapshot> | Seated<AroundTheClockV2Snapshot>` goes in `lib/game/rulesets/types.ts` (barrel rule).

Reducer — `applyAroundTheClockDart(state, observation, rules = V1_RULES)`; `dartsThisVisit === 0` after a dart **means the visit closed**, which `record()` relies on:

```ts
const lastIndex = rules.path.length - 1;
const hit = isClockHit(rules, targetAt(rules.path, state.targetIndex), observation);
const closes = state.dartsThisVisit + 1 === 3;
const pathEnd = (): AroundTheClockSeatState => rules.timed
  ? { ...state, laps: state.laps + 1, targetIndex: 0, dartsThisVisit: 0, hitsThisVisit: 0, status: "IN_PROGRESS" }
  : { ...state, targetIndex: lastIndex, dartsThisVisit: 0, hitsThisVisit: 0, status: "COMPLETE" };

if (rules.hitsRequired === 0) {
  if (hit && state.targetIndex === lastIndex) return pathEnd();
  return { ...state, targetIndex: hit ? state.targetIndex + 1 : state.targetIndex, dartsThisVisit: closes ? 0 : state.dartsThisVisit + 1 };
}
const hits = state.hitsThisVisit + (hit ? 1 : 0);
if (!closes) return { ...state, dartsThisVisit: state.dartsThisVisit + 1, hitsThisVisit: hits };
if (hits >= rules.hitsRequired) {
  if (state.targetIndex === lastIndex) return pathEnd();
  return { ...state, targetIndex: state.targetIndex + 1, dartsThisVisit: 0, hitsThisVisit: 0 };
}
return { ...state, targetIndex: Math.max(0, state.targetIndex - 1), dartsThisVisit: 0, hitsThisVisit: 0 };
```

Keep the status guard at the top. `initialSeatState` adds `laps: 0, hitsThisVisit: 0`. Update the reducer JSDoc.

- [ ] **Step 5: Run** the engine test file, then `npm test`.

### Task 4: Fold, timer, engine key, V2 factory

**Files:** same engine module + test; `app/src/modules/game/turn-log.module.ts` untouched.

- [ ] **Step 1: Failing tests.**
1. `getEngineFactory("AROUND_THE_CLOCK_V2")` resolves; `create(v2()).rulesetVersionKey === "AROUND_THE_CLOCK_V2"`; V1 factory still reports V1.
2. Timed lap closes the visit: Easy timed engine at index 20 (feed 20 Easy hits then `bullHit`) → the bull's turn has `completedAt` set with fewer than 3 darts; the next `record` opens a new turn.
3. Expiry mid-visit: timed engine, one closed visit, record 1 dart, `expireTimer()` → `isComplete()` false; record 2 more → true, `state().status === "COMPLETE"`.
4. Expiry between visits: 3 darts recorded, `expireTimer()` → `isComplete()` true.
5. Expiry before any dart → `isComplete()` false; after one full visit → true.
6. `wouldComplete`: after expiry with 2 darts in the open visit → true for any 3rd dart; with 1 dart → false.
7. Undo across a lap boundary: undo the lap-closing bull → `laps 0`, index 20, turn reopened (`completedAt null`) or removed if it held only that dart.
8. Untimed V2 PRO 1v1: fold ends `COMPLETE`/`TIE` on darts, as V1.
9. V1 byte-identity: a V1 fold's seat state equals the old shape plus `laps: 0, hitsThisVisit: 0`, and `timerExpired: false`.

- [ ] **Step 2: Watch fail. Step 3: Implement.**
- `foldAroundTheClockState(facts, config, timerExpired = false)`: `const rules = rulesOf(config)`; fold with `(s, o) => applyAroundTheClockDart(s, o, rules)`; when `rules.timed && timerExpired`, mark a seat `COMPLETE` if it has ≥1 turn with `completedAt !== null` and no turn with `completedAt === null`. Return `timerExpired` on the state.
- `AroundTheClockEngine`: constructor `(rulesetVersionKey: "AROUND_THE_CLOCK_V1" | "AROUND_THE_CLOCK_V2", config: AroundTheClockEngineConfig, prior?)`; `private timerExpired = false`; `expireTimer()` as TUOD's (JSDoc the same caveat); `deriveState` passes it.
- `openOrCreateTurn` reuse predicate adds `&& last.completedAt === null` (a lap-closed short visit must never be reused by the same seat).
- `record()` stamps `completedAt` when `after.dartsThisVisit === 0` (covers 3rd dart, V1 completion and the lap close).
- `wouldComplete()`: untimed as today; timed → `this.timerExpired && after.dartsThisVisit === 0 && otherSeatsComplete(...)`.
- Factories: V1 `create` → `new AroundTheClockEngine("AROUND_THE_CLOCK_V1", config, prior)`; add `aroundTheClockV2EngineFactory` and register it.
- Update the class JSDoc.

- [ ] **Step 4: Run** the file, `npm test`, `npx astro check`.

### Task 5: Validator + registry

**Files:** Modify `around-the-clock.validator.ts`, `services/rulesets/registry.ts`; tests `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts` (or the existing ATC validator test file — `grep -rl aroundTheClockValidator app/tests`), `app/tests/services/rulesets/registry.test.ts`.

- [ ] **Step 1: Failing tests.** `aroundTheClockV2Validator.validateConfig`: valid V2 config under `RECREATIONAL`+`DETAILED_DARTS` → valid; `segment_rule: "OUTER_SINGLE"` under `RECREATIONAL`+`DETAILED_DARTS` → invalid with the message below; same under `ANALYTICS`+`VISUAL_BOARD` → valid; V1 `{}` → invalid. Registry: `AROUND_THE_CLOCK_V2` maps to `aroundTheClockV2Validator`.
- [ ] **Step 2: Watch fail. Step 3: Implement** exactly as `singlesTrainingV3Validator`, `configSchema: AroundTheClockV2Config`, same `dartlessIssue` as V1 (hoist it to a module const), message `"Around the Clock outer single only requires ANALYTICS + VISUAL_BOARD capture"`, condition `result.config.segment_rule === "OUTER_SINGLE"`. Register in `registry.ts`.
- [ ] **Step 4: Run**, `npm test`.

### Task 6: Capabilities, seats, listing

**Files:** `capabilities.ts`, `session-seats.service.ts`, `games-visibility.ts`; tests `capabilities.test.ts`, `session-seats.service.test.ts`, the games-visibility test (`grep -rl games-visibility app/tests`).

- [ ] **Step 1: Failing tests.** `RULESET_CAPABILITIES.AROUND_THE_CLOCK_V2` = `[DETAILED_DARTS, VISUAL_BOARD]`; `supportsDartbot("AROUND_THE_CLOCK_V2") === false`; `SEAT_CAPS.AROUND_THE_CLOCK_V2 === 2`; the ATC listing row's `rulesetVersionKey === "AROUND_THE_CLOCK_V2"`. The capabilities-vs-`seeds/0007` parity test will also go red until Task 9 — expected.
- [ ] **Step 2: Watch fail. Step 3: Implement** the three entries. Leave `RULESET_DARTBOT` without V2.
- [ ] **Step 4: Run** targeted tests; defer the full-suite green until Task 9 lands the seed rows (note it in the task report).

### Task 7: Setup

**Files:** `app/src/lib/game/types.ts`, `around-the-clock-setup.data.ts`, `AroundTheClockSetupForm.astro`, `app/src/pages/games/around-the-clock/setup/index.astro` (only if it passes props); test `app/tests/lib/game/around-the-clock-setup.data.test.ts`.

- [ ] **Step 1: Types.** `AroundTheClockSetupContext = PresetSetupContext & { pathDirection; oddsFirst: boolean; segmentRule; difficulty; durationType: "UNTIMED" | "MINUTES"; durationValue: number | string | null; clampNotice: string }` (enum types off `AroundTheClockV2Snapshot`).
- [ ] **Step 2: Failing tests** (drive `start()` with the existing test's API mocks):
  1. Solo defaults → `createSession` called with `rulesetVersionKey: "AROUND_THE_CLOCK_V2"` and `overrides` = all six snake_case keys (`duration_value: null`).
  2. Solo timed 12 → `duration_type: "MINUTES", duration_value: 12`; timed 45 → clamped to 30, `clampNotice` set.
  3. Bot seated → `"AROUND_THE_CLOCK_V1"`, no `overrides` key.
  4. `addGuest()` with `durationType: "MINUTES"` → `durationType` becomes `"UNTIMED"`, `durationValue` null; start sends V2 untimed.
  5. `addBot()` → all six toggles back to defaults.
- [ ] **Step 3: Watch fail. Step 4: Implement.**

```ts
export function aroundTheClockSetup() {
  const controller = createPresetSetupController<AroundTheClockSetupContext>({
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: (ctx) => (ctx.bot ? "AROUND_THE_CLOCK_V1" : "AROUND_THE_CLOCK_V2"),
    playHref: "/games/around-the-clock/play",
    label: "Around the Clock",
    configOverrides: (ctx) => (ctx.bot ? undefined : v2Overrides(ctx)),
  });
  return {
    ...V2_DEFAULTS,
    clampNotice: "",
    ...controller,
    addGuest(this: AroundTheClockSetupContext) {
      controller.addGuest.call(this);
      this.durationType = "UNTIMED";
      this.durationValue = null;
    },
    addBot(this: AroundTheClockSetupContext) {
      controller.addBot.call(this);
      Object.assign(this, V2_DEFAULTS);
    },
  };
}
```

`V2_DEFAULTS`: `LOW_TO_HIGH`, `false`, `ANY`, `EASY`, `UNTIMED`, `null`. `v2Overrides` clamps via `clampAroundTheClockDuration` for MINUTES, sets `clampNotice`, returns the six keys. Check `configOverrides`'s option type accepts `undefined`; if not, widen `PresetSetupControllerOptions.configOverrides` return to `Record<string, unknown> | undefined` (the controller already guards on falsy). A timed toggle is hidden while a guest is seated, so only the reset above is needed.

Form (`AroundTheClockSetupForm.astro`): `supportsDartbot("AROUND_THE_CLOCK_V1")` stays (bot seats resolve to V1). Add `Toggle` rows as in `SinglesTrainingSetupForm.astro`: Direction, Odds first, Segment (wrapped `x-show="$store.settings.captureModeKey === 'ANALYTICS'"`), Difficulty (`Easy` / `1 dart` / `2 darts` / `3 darts`), Duration (`Untimed` / `Timed`, row `x-show="guests.length === 0 && !bot"`) with a minutes `input type="number"` (`x-model.number="durationValue"`, min 3, max 30, as `TuodSetupForm.astro`) shown under `MINUTES`, plus the `clampNotice` line. Hide every V2 row with `x-show="!bot"`. Update the info copy to name the variants. When capture flips to keypad while `segmentRule === "OUTER_SINGLE"`, reset it to `ANY` via a `$watch` in `init` — or, if the controller's `init` cannot be wrapped cleanly, leave it and let the server's validator reject (spec §5); prefer the watch.

- [ ] **Step 5: Run** test, `npm test`, `npx astro check`.

### Task 8: Play

**Files:** `app/src/lib/game/types.ts`, `around-the-clock-play.data.ts`, `app/src/pages/games/around-the-clock/play/index.astro`; test `app/tests/lib/game/around-the-clock-play.data.test.ts`.

- [ ] **Step 1: Types.** `AroundTheClockPlayContext`'s config param → `AroundTheClockEngineConfig`; add `timer: SegmentTimer | null`, `laps()`, `remainingLabel()`, `hitsNeededLabel()`, `isTimed()`, `finishIfExpired()`, `togglePause()`, `destroy()`. `AroundTheClockSeatResult` gains `laps: number | null` and `targetAtEnd: string | null` (null untimed).
- [ ] **Step 2: Failing tests.**
  1. `resumeEngine` accepts a V2 store (key `AROUND_THE_CLOCK_V2`) and a V1 store; rejects `TUOD_V1`.
  2. `currentTargetLabel()` on `HIGH_TO_LOW` fresh → `"20"`; odds first → `"1"`.
  3. Preview under `OUTER_SINGLE`: an `INNER_SINGLE` on the target renders `"miss"`.
  4. `accuracy()` counts only V2-rule hits.
  5. Timed: `init` on a MINUTES store starts the countdown (mock `SegmentTimer` as `tuod-play.data.test.ts` does); expiry with no open visit and ≥1 closed visit → `uploadAndCompleteSession` called; expiry mid-visit → not called until the visit's last dart.
  6. Results timed → `laps` and `targetAtEnd`; untimed → both null.
  7. `playAgain` on V2 → `runPlayAgain` called with `"AROUND_THE_CLOCK_V2"` and wire `{ duration_value }` carried; on V1 → V1 key, no overrides.
- [ ] **Step 3: Watch fail. Step 4: Implement.**
  - Replace `RULESET_VERSION_KEY` with `const RESUMABLE = new Set<RulesetVersionKey>(["AROUND_THE_CLOCK_V1", "AROUND_THE_CLOCK_V2"])`; `resumeEngine` resolves the factory from the stored key.
  - One `pathOf(config) = rulesOf(config).path` feeds every `targetAt(numbersPath(), …)` call (target label, `isBullVisit`, `recordTap`, bot `throwBotDart`). `replayHits` passes `rulesOf(config)` to `isClockHit` and `applyAroundTheClockDart`.
  - `state()` passes `this.$store.game.timerExpired ?? false`.
  - `init`: after `playInit`, if the snapshot is MINUTES → `this.timer = maybeResumeCountdown(...)`, then `this.$watch("$store.game.timerExpired", () => this.finishIfExpired())` and one immediate `finishIfExpired()`. `finishIfExpired`: if `!finished && engine?.isComplete()` → `finished = true`, `completionStatus = "pending"`, `await uploadAndCompleteSession()`. Mid-visit expiry is caught by `playCommitDart`'s existing post-record `isComplete()` check.
  - Pause toggle + `destroy()` as `tuod-play.data.ts`.
  - Results: `statsFor` adds `laps` / `targetAtEnd` when timed. `resultsTitle` for timed: `"Time — ${laps} laps, on ${target}"`.
  - `playAgain`: key = stored key; for V2 pass `buildOverrides` = `{ snapshot: config, wire: toWireConfig("AROUND_THE_CLOCK_V2", config) }` minus `seats`; reset/restart timer callbacks as TUOD.
  - Page: HUD shows `Lap N` and `remainingLabel()` when `isTimed()`, `hitsNeededLabel()` (e.g. `"1 / 2 hits"`) when difficulty ≠ Easy; results show laps and target at end when timed; pause button as TUOD's page.
- [ ] **Step 5: Run** test, `npm test`, `npx astro check`. Manually run the play page per `run` skill if a browser is available; otherwise say so.

### Task 9: Seeds + verification

**Files:** Create `database/seeds/0027_around_the_clock_v2_game_engine_reference.sql`, `database/verification/0027_around_the_clock_v2_capability_checks.sql`; modify `database/seeds/0007_ruleset_version_capabilities.sql`.

- [ ] **Step 1:** Seed `0027`, modelled on `0018_singles_training_v3_game_engine_reference.sql`: header comment (purpose, UUID `0198f100-0000-7000-8000-000000000014`, capability rows live in `0007`), one `INSERT INTO ruleset_versions … ON CONFLICT (id) DO NOTHING` under game type `0198f000-0000-7000-8000-000000000009`, `implementation_key 'AROUND_THE_CLOCK_V2'`. No preset (setup reuses the V1 preset `{}` + overrides, as Singles V3). Confirm `…014` is unused: `grep -rn "0198f100-0000-7000-8000-000000000014" database`.
- [ ] **Step 2:** Append to `0007`'s `VALUES` after the V1 pair: `('AROUND_THE_CLOCK_V2', 'RECREATIONAL', 'DETAILED_DARTS'), ('AROUND_THE_CLOCK_V2', 'ANALYTICS', 'VISUAL_BOARD')` (fix the trailing comma).
- [ ] **Step 3:** Verification script mirrors `0031_singles_training_v3_capability_checks.sql`, ends in `ROLLBACK`.
- [ ] **Step 4:** `npm test` (the capabilities parity test goes green). `scripts/check-*.sh` for seeds per `run-all-gates`. SQL cannot run without `DATABASE_URL` — say so in the report and flag `npm run db:seed` + the verification script for the reviewer.

### Task 10: PR1 docs, context, gates

- [ ] Rules file: Clock restart bullet adds "the lap-closing dart ends that visit"; Capture V2 bullet unchanged. `scripts/check-game-rules.sh`.
- [ ] Spec: status → `approved 2026-09-23`; append a dated note with the two planning deltas (File Map above). Targeted edit only.
- [ ] `decisions/game-engine.md`: append one decision (next free D-number; check `DECISIONS.md` routing) per spec §12.
- [ ] `context-maintenance` skill, then `run-all-gates` skill; report each script's result.
- [ ] Commit when asked; then `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push, open PR1).

---

# PR2 — Routine step (after PR1 merges)

Restart the branch: `git fetch origin main && git checkout -B claude/around-clock-training-routine-wr1h1p origin/main`.

### Task 11: Routine hook + summary + adapter

**Files:** `game-step.ts`, `routine-summary.module.ts`, `adapters/game.adapter.ts`, `adapters/types.ts`, `adapters/step-adapter.registry.ts`; tests `game-step.test.ts`, `routine-summary.module.test.ts`, `game.adapter.test.ts`, `step-adapter.registry.test.ts`.

- [ ] **Step 1: Failing tests.** `routineGameStepHook("AROUND_THE_CLOCK_V2")` exists, bounds `{3,30}`, `applyStepDuration` writes MINUTES/value over an UNTIMED template config and the result parses under `AroundTheClockV2Config`. `summariseAroundTheClock(seat)` → `{ stepKey: "GAME:AROUND_THE_CLOCK_V2", label: "Around the Clock", rows: [Laps, Reached, Accuracy] }`. Registry has `"GAME:AROUND_THE_CLOCK_V2"`; the existing agreement test covers the table pairing.
- [ ] **Step 2: Watch fail. Step 3: Implement** mirroring the `121_V2` entries: `minuteBounds: aroundTheClockDurationBounds()`; `StepPanel` gains `"around-the-clock"`; `summariseAroundTheClockStep` wrapper; adapter `headerLabel: "around the clock"`, `playFactory: aroundTheClockPlay`.
- [ ] **Step 4: Run**, `npm test`.

### Task 12: Routine panel

**Files:** Create `app/src/components/layout/games/play/AroundTheClock.astro` (extract the in-page play surface from `pages/games/around-the-clock/play/index.astro`, no behaviour change); modify both pages.

- [ ] **Step 1:** Extract; standalone page renders `<AroundTheClock x-show="!finished" x-cloak />`. `npx astro check`; visually confirm the standalone page is unchanged (run skill, or state not verified).
- [ ] **Step 2:** Routine page: add the `adapter?.panel === 'around-the-clock'` template, same wiring as the `one-twenty-one` block (no confirm gates — ATC has none).
- [ ] **Step 3:** `npm test`, `npx astro check`.

### Task 13: Templates seed

**Files:** Create `database/seeds/0028_around_the_clock_routine_templates.sql`, `database/verification/0028_around_the_clock_routine_template_checks.sql` (confirm free numbers first).

- [ ] Model on `0022_routine_game_templates.sql`: three GAME `exercise_templates` rows `0199b000-0000-7000-8000-00000000000b/c/d`, pinned to `AROUND_THE_CLOCK_V2`, configs per spec §9 (`"duration_type":"MINUTES","duration_value":10`). Grep the ids first. Verification asserts three rows, their ruleset pin and that each `default_configuration` carries all six keys. Flag SQL for reviewer (no `DATABASE_URL`).

### Task 14: PR2 docs, context, gates

- [ ] `01-Routines.md` §11 eligible list + §Game Exercise implemented note; `08-Component-Inventory.md` row for `AroundTheClock.astro`; rules file `Current version: V2 (shipped <date>)`.
- [ ] `context-maintenance`, `run-all-gates`; commit when asked; finish branch → PR2.
