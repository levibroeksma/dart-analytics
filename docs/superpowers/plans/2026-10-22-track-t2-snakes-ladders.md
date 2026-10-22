# Track T2.2 — Doubles Snakes & Ladders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Doubles Snakes & Ladders V1 as a playable routine-step exercise on the Track kernel, end to end, adding no new duplication.

**Architecture:**
- **Reuse prep (Tasks 1–2), behaviour unchanged:** three pieces Halve-It left inline and S&L would copy become shared: the hits/darts totals of a projection, the routine page's rate and route getters, and the hand-chained target-label fallback.
- **Kernel (Tasks 3–4):**
  - the shell gains an `ends` hook so a run can finish on its own dart (the first exercise that can);
  - two policies, `moveTable` and `finishOnHits`, each with this exercise as first caller (D468).
- **The exercise (Tasks 5–10):** a `trackExerciseSpec` exercise over `doublesPath(1..20)` + BULL, hit `isHitOn`, no points. It reuses the `hitCount` preview family, the generic panel shell, `doubleTargetIntent`, `EmptyV1Config` and the Track seed-verification table.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (T2.2). Rules: `docs/game-rules/training/exercises/doubles-snakes-and-ladders.md`. Model plan: `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md` (shipped, PR #1055). T2.3 Nine Lives (and #1051) follows.

## Global Constraints

- **Branch:** `feat/track-t2-snakes-ladders`, cut from `origin/main` at `c97fde9`. The PR targets `main`. Never merge to `main`; never use `--no-verify`.
- **TDD** per `app/CLAUDE.md` §TDD: failing test first, watch it fail, then code. Run from `app/` with `npm test -- <path>`. A pure refactor (Task 1) runs green before and after, and its appended test pins the guarantee.
- **Comments:** none inside function bodies; JSDoc above declarations only, no decision history.
- **Quality gates:** fallow complexity ≤ 15, CRAP ≤ 30, no unused exports; `npm run validate:app` exits 0 with the type gate at 0/0/0. It needs a temporary `app/.env` with `DATABASE_URL=postgres://postgres@localhost:5433/integration?sslmode=disable`; delete it afterwards.
- **Type-check:** `npm run check` at the end of every code task.
- **Coverage gate:** `scripts/check-test-coverage.sh` runs per commit; each task's Files list names the covering test.
- **Tests:** existing tests are append-only. An assertion that lists every kind may gain the new kind by ledgered ruling, only when the guarantee stays the same.
- **Migrations:** never modify `0001`–`0048`. No schema change.
- **Seed:** number `0048` (highest seed on `main`: `0047`). Ids, none in use:
  - type `0199a000-0000-7000-8000-000000000010`
  - ruleset `0199a100-0000-7000-8000-000000000010`
  - template `0199b000-0000-7000-8000-000000000017`
- **Decision:** `D479` (Task 11). `bash scripts/next-decision-id.sh` printed `D479` on 2026-10-22; re-run before the PR and renumber with `scripts/renumber-decision.sh` if it moved.
- **Discovered work:** anything else goes to a `discovered-work` issue; never fix it here.
- **Commits** end with:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
  The commit hook is slow: 400000 ms timeout, output redirected to a log in the workspace.
- **Before the PR:** `cd app && npm run format && npm run format:check`.
- **Naming:**
  - code: `SnakesLadders` / `snakesLadders` / `DOUBLES_SNAKES_LADDERS`; files `snakes-ladders.*`;
  - display label and title: `Doubles Snakes & Ladders`;
  - panel key `"doubles-snakes-ladders"`; slot `snakesLaddersEngine`; recorder `recordSnakesLaddersDart`; preview family: the existing `"hitCount"`.
- **Duplication:** Task 1 Step 0 records `npx fallow dupes --mode semantic --min-tokens 30 <path>` for four paths; Task 12 re-runs it. No path's duplicated-line count may rise.

## Spec refinements (write back into the spec on approval)

1. **Finish needs a shell hook (§2.2).** The shell's `isComplete()` is `expired` only, so no exercise can end on its own dart (Catch 40 is hand-written). `DartExerciseSpec` gains optional `ends?(state): boolean`; the shell's `isComplete()` and `record()` honour it; `TrackExerciseDefinition` gains the same optional member and `trackExerciseSpec` forwards it. Decision D479.
2. **`moveTable` / `finishOnHits` signatures (§2.2).**
   - `moveTable<TExt extends LadderTrackExt>(table: MoveTable, lastIndex: number)`: no-op unless `status === "IN_PROGRESS"`; `targetIndex` moves by `table[hitsThisVisit] ?? 0`, clamped to `[0, lastIndex]`; `ext.highestIndex = max(highestIndex, targetIndex)`.
   - `finishOnHits<TExt>(hits: number, index: number)`: at `targetIndex === index` and `hitsThisVisit >= hits`, status `DONE`.
   - The engine composes `move(finish(seat))`.
   - `LadderTrackExt = { highestIndex: number }`; `MoveTable = Readonly<Record<number, number>>`.
   - `stepBackBelowHits` (Around the Clock, live data) is a two-row move table; it stays untouched.
3. **State (§4).** `SnakesLaddersState` carries `currentLevel`, `levelIndex`, `highestLevel`, `highestLevelNumber` (1–21, the numeric the stats read), `rounds`, `finishes` (0 or 1, in place of `finished`, because `STATE_FIELDS` reads numbers), `hits`, `dartsThrown`, `status`. `rounds` counts closed visits; a visit cut by time is not a round. No per-level hit rows: the rules file asks only for level, highest, rounds, finished.
4. **Preview (§4).** The `hitCount` family judges (`judgeIntendedBed`: number and zone both match the intent, so a bullseye at the bull level is a hit and an outer bull is a miss) and captions (`hitCountCaptions` from `currentTargetLabel`). No new family.
5. **Label fallback.** The `currentTargetLabel: a() || b() || undefined` chain in `routine-play.data.ts` becomes a table walk; S&L adds one entry instead of a third `||`.
6. **Rate and route getters.** Halve-It's and Hit Count's rate getters share `hitRateOf(state)`; Halve-It's and S&L's route getters share `routeChipsOf(path, index)`. Both module-local to `routine-play.data.ts`.
7. **Totals.** Halve-It's inline `hits` and `dartsThrown` derivation moves to `tallyTotals(hitsPerTarget, facts)` in `track-exercise-spec.module.ts`; S&L calls it.
8. **Completion on dart.** `snakesLaddersEngine` joins `COMPLETES_ON_DART` beside Catch 40.
9. **Stats.**
   - `STEP_METRIC_SPECS.DOUBLES_SNAKES_LADDERS = { metrics: { highestLevel: "max", rounds: "sum", finishes: "sum", darts: "sum", hits: "sum" }, headline: "highestLevel", direction: "higher", rates: [["hits", "darts"]] }`.
   - `STATE_FIELDS`: `highestLevel`→`highestLevelNumber`, `rounds`→`rounds`, `finishes`→`finishes`, `darts`→`dartsThrown`, `hits`→`hits`.
   - Integration fixture: S&L is step 16 (the itest length 15 → 16 by ruling).
10. **Rules file.** `Current version:` → `V1 (shipped 2026-10-22)`; the proposed type constant `HIT_COUNT_LADDER` becomes `DOUBLES_SNAKES_LADDERS` (seed `0048`), ruleset `DOUBLES_SNAKES_LADDERS_V1`. Tags regenerated: no new tag key (LADDER, SETBACK, EXPERT exist), so ids do not shift.

## Review Focus

1. **The floor.** 0 hits at D1 stays on D1; 0 hits at D2 goes to D1, not below. Pinned in Task 3 (`moveTable floors at the first index`) and Task 5 (`never drops below D1`).
2. **Level boundaries.** 3 hits at D20 moves to the bull level; 0 hits at the bull level lands on D19; 3 hits at D20 does not finish. Pinned in Task 3 (`caps at the last index`) and Task 5 (`D20 with three hits climbs to the bull`, `the bull with no hit drops two to D19`).
3. **The bull level takes the bullseye only.** `OUTER_BULL` is a miss; three bullseyes finish. Pinned in Task 5 (`the outer bull does not count`, `three bullseyes finish the run`) and Task 10 (`judges a bullseye at the bull level as a hit`).
4. **A finished run stops and undoes.** After the finish, `record` refuses and `isComplete()` is true; undo of the last dart reopens the run at the bull level. Pinned in Task 2 (`ends`) and Task 5 (`undo reopens a finished run`).
5. **A run cut by time reports its peak, not its end.** After climbing to D5 and sliding to D3, expiry reports highest D5 with rounds counting closed visits only. Pinned in Task 5 (`a run cut by time keeps the highest level`) and Task 8 (the `max` merge).
6. **Early completion uploads once.** The finishing dart completes the step; the deadline firing afterwards does not upload twice. Pinned in Task 9 (`completes the step on the finishing dart`).

---

### Task 1: Reuse prep — totals, rate/route getters, label table

**Files:**
- Modify: `app/src/modules/training/exercises/track-exercise-spec.module.ts`, `app/src/modules/training/exercises/halve-it.engine.module.ts`, `app/src/lib/training/routines/routine-play.data.ts`
- Test:
  - Append: `app/tests/modules/training/exercises/track-exercise-spec.module.test.ts`
  - Existing, run unchanged: `halve-it.engine.module.test.ts`, `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function tallyTotals(
    hitsPerTarget: readonly number[],
    facts: EngineFacts,
  ): { hits: number; dartsThrown: number };
  ```
  and, module-local in `routine-play.data.ts`: `hitRateOf(state: { hits: number; dartsThrown: number } | undefined): string`, `routeChipsOf(path: readonly TrackTarget[], index: number): string`, `TARGET_LABEL_GETTERS`.

- [ ] **Step 0: Duplication baseline.** For each of `src/lib/training/routines`, `src/modules/training/exercises`, `src/modules/game`, `src/modules/stats` run `cd app && npx fallow dupes --mode semantic --min-tokens 30 <path>`. Ledger the duplicated-line counts.
- [ ] **Step 1: Run green first.** `npm test -- tests/modules/training/exercises tests/lib/training/routines`. Expected: PASS.
- [ ] **Step 2: Write the failing test.** Append to the spec test (importing `tallyTotals`):
  ```ts
  describe("tallyTotals", () => {
    it("sums hits per target and counts every dart in the log", () => {
      const facts = {
        stages: [],
        turns: [{ darts: [{}, {}, {}] }, { darts: [{}] }],
      } as unknown as EngineFacts;
      expect(tallyTotals([2, 0, 1], facts)).toEqual({ hits: 3, dartsThrown: 4 });
    });

    it("is zero over an empty log", () => {
      expect(tallyTotals([], { stages: [], turns: [] })).toEqual({ hits: 0, dartsThrown: 0 });
    });
  });
  ```
- [ ] **Step 3: Run** `npm test -- tests/modules/training/exercises/track-exercise-spec.module.test.ts`. Expected: FAIL; `tallyTotals` is not exported.
- [ ] **Step 4: Implement.**
  - `track-exercise-spec.module.ts`, above `trackExerciseSpec`:
    ```ts
    /** A Track exercise's projected totals: hits summed from the fold's per-target tally, darts counted from the log. */
    export function tallyTotals(
      hitsPerTarget: readonly number[],
      facts: EngineFacts,
    ): { hits: number; dartsThrown: number } {
      return {
        hits: hitsPerTarget.reduce((sum, hits) => sum + hits, 0),
        dartsThrown: facts.turns.reduce((count, turn) => count + turn.darts.length, 0),
      };
    }
    ```
  - `halve-it.engine.module.ts`: in `projectHalveIt`, spread `...tallyTotals(seat.ext.hitsPerTarget, facts)` in place of the inline `hits` and `dartsThrown`, and drop the now-unused `facts` reads.
  - `routine-play.data.ts`:
    - add `hitRateOf` and `routeChipsOf` beside `chipLabel`; `hitRateOf` returns `checkoutPercentageDisplay(state?.hits ?? 0, state?.dartsThrown ?? 0)` and `routeChipsOf` returns `windowPage(path.map(chipLabel), index).join(" ")`;
    - `hitCountRate` and `halveItRate` return `hitRateOf(this.…Engine?.state())`; `halveItRoute` returns `routeChipsOf(HALVE_IT_PATH, this.halveItEngine?.state().targetIndex ?? 0)`;
    - add `const TARGET_LABEL_GETTERS = ["hitCountTargetLabel", "doublesLockTargetLabel"] as const;` and replace the `a() || b() || undefined` expression with `TARGET_LABEL_GETTERS.map((getter) => this[getter]()).find(Boolean)`.
- [ ] **Step 5: Run** the Step 1 command, then `npm run check`. Expected: PASS, 0/0/0. A snapshot or `routine-play.data.test.ts` change means behaviour moved: stop and fix.
- [ ] **Step 6: Commit**
  ```bash
  git add app/src/modules/training/exercises app/src/lib/training/routines/routine-play.data.ts app/tests/modules/training/exercises
  git commit -m "refactor(track): share projected totals, rate and route getters, label table"
  ```

---

### Task 2: Exercise shell `ends` hook

**Files:**
- Modify: `app/src/modules/training/exercises/interfaces.ts`, `dart-exercise-shell.module.ts`, `track-exercise-spec.module.ts`
- Test: append to `app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts` and `track-exercise-spec.module.test.ts`

**Interfaces:**
- Produces:
  - `DartExerciseSpec.ends?(state: TState): boolean`;
  - `TrackExerciseDefinition.ends?(state: TState): boolean`, forwarded by `trackExerciseSpec`;
  - a shell engine whose `isComplete()` is `expired || (spec.ends?.(state) ?? false)`.

- [ ] **Step 1: Write the failing tests.**
  - Shell test: a spec whose `fold` returns `{ n: facts.turns.reduce(...dart count) }` and `ends: (state) => state.n >= 2`. Assert:
    - `isComplete()` is false after one dart and true after two;
    - a third `record` throws `"exercise is complete"`;
    - `undo()` after the second dart makes `isComplete()` false again;
    - a spec without `ends` is complete only after `expireTimer()` (existing behaviour, assert it explicitly).
  - Spec test: `trackExerciseSpec({ …, ends: (state) => state.done })` returns a spec whose `ends` is that function; without `ends` the returned spec's `ends` is `undefined`.
- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/dart-exercise-shell.module.test.ts tests/modules/training/exercises/track-exercise-spec.module.test.ts`. Expected: FAIL (type error on `ends`, or `isComplete()` false).
- [ ] **Step 3: Implement.**
  - `interfaces.ts`: add `ends?(state: TState): boolean;` to both interfaces with a one-line JSDoc ("A state that ends the run on its own, before the timer").
  - `dart-exercise-shell.module.ts`: `isComplete()` returns `this.expired || (spec.ends?.(this.deriveState()) ?? false)`; `record` starts `refuseWhenEnded(this.isComplete(), "exercise is complete")`.
  - `trackExerciseSpec`: add `ends: definition.ends` to the returned object.
- [ ] **Step 4: Run** the Step 2 command (PASS), the full `tests/modules/training` directory (PASS: shipped engines define no `ends`), then `npm run check`.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/modules/training/exercises app/tests/modules/training/exercises
  git commit -m "feat(track): exercise shell ends hook"
  ```

---

### Task 3: Policies `moveTable` and `finishOnHits`

**Files:**
- Modify: `app/src/modules/game/types.ts`, `app/src/modules/game/track-policies.ts`
- Test: append to `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Produces: `LadderTrackExt`, `MoveTable` (types), `moveTable`, `finishOnHits` (see refinement 2). Both are visit-close policies and, like every policy, land with this first caller (Task 5).

- [ ] **Step 1: Write the failing tests.** A helper `seatAt(index, hits, ext = { highestIndex: index }, status = "IN_PROGRESS")` builds a `TrackSeat`. With `TABLE = { 0: -2, 1: -1, 2: 0, 3: 1 }` and `LAST = 20`:
  ```ts
  describe("moveTable", () => {
    const move = moveTable<LadderTrackExt>(TABLE, LAST);
    it.each([
      [5, 0, 3], [5, 1, 4], [5, 2, 5], [5, 3, 6],
    ])("from %i with %i hits lands on %i", (from, hits, to) => {
      expect(move(seatAt(from, hits)).targetIndex).toBe(to);
    });
    it("floors at the first index", () => {
      expect(move(seatAt(0, 0)).targetIndex).toBe(0);
      expect(move(seatAt(1, 0)).targetIndex).toBe(0);
    });
    it("caps at the last index", () => {
      expect(move(seatAt(20, 3)).targetIndex).toBe(20);
      expect(move(seatAt(19, 3)).targetIndex).toBe(20);
    });
    it("keeps the highest index reached after a slide", () => {
      const slid = move(seatAt(6, 0, { highestIndex: 9 }));
      expect(slid.targetIndex).toBe(4);
      expect(slid.ext.highestIndex).toBe(9);
    });
    it("raises the highest index on a climb", () => {
      expect(move(seatAt(9, 3, { highestIndex: 9 })).ext.highestIndex).toBe(10);
    });
    it("does nothing once the seat is no longer in progress", () => {
      const done = seatAt(20, 0, { highestIndex: 20 }, "DONE");
      expect(move(done)).toBe(done);
    });
    it("treats a hit count absent from the table as no move", () => {
      expect(moveTable<LadderTrackExt>({ 3: 1 }, LAST)(seatAt(5, 2)).targetIndex).toBe(5);
    });
  });

  describe("finishOnHits", () => {
    const finish = finishOnHits<LadderTrackExt>(3, 20);
    it("finishes at the index with enough hits", () => {
      expect(finish(seatAt(20, 3)).status).toBe("DONE");
    });
    it("does not finish short of the hits or off the index", () => {
      expect(finish(seatAt(20, 2)).status).toBe("IN_PROGRESS");
      expect(finish(seatAt(19, 3)).status).toBe("IN_PROGRESS");
    });
    it("composes before moveTable without moving a finished seat", () => {
      const move = moveTable<LadderTrackExt>(TABLE, LAST);
      expect(move(finish(seatAt(20, 3))).targetIndex).toBe(20);
    });
  });
  ```
- [ ] **Step 2: Run** `npm test -- tests/modules/game/track-policies.test.ts`. Expected: FAIL; the exports are missing.
- [ ] **Step 3: Implement.**
  - `types.ts`, beside `PassTrackExt`:
    ```ts
    /** A ladder's furthest index reached, kept as the seat moves up and down. */
    export type LadderTrackExt = { highestIndex: number };

    /** Index change by visit hit count; a count the table lacks does not move the seat. */
    export type MoveTable = Readonly<Record<number, number>>;
    ```
  - `track-policies.ts`, after `lockCheckpoint`:
    ```ts
    /**
     * Visit-close policy: move by the hit count's row of `table`, clamped to
     * the path, and keep the highest index reached in `ext.highestIndex`.
     * A seat no longer in progress does not move.
     */
    export function moveTable<TExt extends LadderTrackExt>(
      table: MoveTable,
      lastIndex: number,
    ): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
      return (seat) => {
        if (seat.status !== "IN_PROGRESS") return seat;
        const targetIndex = Math.min(
          lastIndex,
          Math.max(0, seat.targetIndex + (table[seat.hitsThisVisit] ?? 0)),
        );
        return {
          ...seat,
          targetIndex,
          ext: { ...seat.ext, highestIndex: Math.max(seat.ext.highestIndex, targetIndex) },
        };
      };
    }

    /** Visit-close policy: at `index`, `hits` hits in the visit finish (`DONE`) the seat. */
    export function finishOnHits<TExt>(
      hits: number,
      index: number,
    ): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
      return (seat) =>
        seat.targetIndex === index && seat.hitsThisVisit >= hits
          ? { ...seat, status: "DONE" }
          : seat;
    }
    ```
- [ ] **Step 4: Mutation checks.**
  - Change `Math.max(0, …)` to `Math.max(1, …)`: the floor tests fail. Revert.
  - Change `seat.targetIndex === index` to `>=`: `off the index` fails. Revert.
- [ ] **Step 5: Run** the Step 2 command (PASS), then `npm run check`.
- [ ] **Step 6: Commit**
  ```bash
  git add app/src/modules/game app/tests/modules/game/track-policies.test.ts
  git commit -m "feat(track): moveTable and finishOnHits policies"
  ```

---

### Task 4: `DOUBLES_SNAKES_LADDERS_V1` key and config

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`, `app/src/services/exercise-rulesets/registry.ts` (only if `REGISTRY` is typed by key, as in T2.1)
- Test: append to `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces: key `"DOUBLES_SNAKES_LADDERS_V1"`; `export const SnakesLaddersV1Config = EmptyV1Config;`; `SnakesLaddersConfigData`; `EXERCISE_RULESET_CONFIGS.DOUBLES_SNAKES_LADDERS_V1`.

- [ ] **Step 1: Write the failing test.**
  ```ts
  describe("SnakesLaddersV1Config", () => {
    it("is the empty config — levels, moves and finish are fixed", () => {
      expect(SnakesLaddersV1Config).toBe(EmptyV1Config);
      expect(SnakesLaddersV1Config.safeParse({ finish: 2 }).success).toBe(false);
    });
    it("is registered under DOUBLES_SNAKES_LADDERS_V1", () => {
      expect(EXERCISE_RULESET_CONFIGS.DOUBLES_SNAKES_LADDERS_V1).toBe(SnakesLaddersV1Config);
    });
  });
  ```
- [ ] **Step 2: Run** `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add the key to the union, then after `HalveItConfigData`:
  ```ts
  /**
   * Doubles Snakes & Ladders v1: D1 to D20 then the bullseye, moved by the
   * visit's hits, finished by three bullseyes in one visit
   * (`docs/game-rules/training/exercises/doubles-snakes-and-ladders.md`).
   * Levels, moves and finish are locked; duration is the routine step's.
   */
  export const SnakesLaddersV1Config = EmptyV1Config;

  export type SnakesLaddersConfigData = z.infer<typeof SnakesLaddersV1Config>;
  ```
  and the `EXERCISE_RULESET_CONFIGS` row. If `npm run check` flags `REGISTRY`, add Task 6's registry line now and ledger a ruling.
- [ ] **Step 4: Run** the test (PASS) and `npm run check`.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/lib/training/exercises/rulesets/types.ts app/tests/lib/training/exercises/rulesets/types.test.ts
  git commit -m "feat(snakes-ladders): DOUBLES_SNAKES_LADDERS_V1 ruleset key and empty config"
  ```

---

### Task 5: Engine, kernel row, golden

**Files:**
- Create: `app/src/modules/training/exercises/snakes-ladders.engine.module.ts`
- Modify: `app/src/modules/game/types.ts` (the ext type), `app/src/modules/training/exercises/types.ts` (the state type), `scripts/engine-kernels.txt`
- Test:
  - Create: `app/tests/modules/training/exercises/snakes-ladders.engine.module.test.ts`, `snakes-ladders.aimed.golden.test.ts`

**Interfaces:**
- Consumes: Task 1 `tallyTotals`; Task 2 `ends`; Task 3 `moveTable`, `finishOnHits`, `LadderTrackExt`; Task 4 `SnakesLaddersV1Config`, `SnakesLaddersConfigData`.
- Produces:
  ```ts
  export const SNAKES_LADDERS_PATH: readonly BoardTarget[];   // D1..D20, BULL
  export const SNAKES_LADDERS_MOVES: MoveTable;               // { 0: -2, 1: -1, 2: 0, 3: 1 }
  export const SNAKES_LADDERS_FINISH = 3;
  export class SnakesLaddersEngine …; export const snakesLaddersEngineFactory; export const foldSnakesLaddersState;
  export type SnakesLaddersTrackExt = TargetTallyExt & LadderTrackExt & { rounds: number };
  export type SnakesLaddersState = {
    currentLevel: BoardTarget; levelIndex: number;
    highestLevel: BoardTarget; highestLevelNumber: number;
    rounds: number; finishes: number; hits: number; dartsThrown: number;
    status: "IN_PROGRESS" | "COMPLETE";
  };
  ```

- [ ] **Step 1: Write the failing engine tests.** Helpers as the Halve-It test: `dart`, `MISS`, `D(n)` = `dart(n, "DOUBLE")`, `BULLSEYE = dart(25, "INNER_BULL")`, `OUTER = dart(25, "OUTER_BULL")`, `visitOf(k, hit)` = `k` copies of `hit` then misses to three darts, `play(engine, darts)`. Cases (names as listed; assertions per the rules file's worked examples):
  - `starts on D1, round 0, highest D1`: state matches `{ currentLevel: D1, levelIndex: 0, highestLevelNumber: 1, rounds: 0, finishes: 0, hits: 0, dartsThrown: 0, status: "IN_PROGRESS" }`.
  - `three hits climb one level`: `visitOf(3, D(1))` → `levelIndex` 1, `rounds` 1, `hits` 3.
  - `two hits stay; one hit slides back one; none slides back two`: from D5 (reach it by four climbing visits), `visitOf(2, …)` stays on D5, `visitOf(1, …)` goes to D4, `visitOf(0, …)` goes to D3.
  - `never drops below D1`: a blank visit at D1 stays on D1; a blank visit at D2 lands on D1.
  - `only the level's own double counts`: `D(7)` at D1 misses; `S(1)` at D1 misses; `D(1)` hits.
  - `D20 with three hits climbs to the bull`: 19 climbing visits then one more → `levelIndex` 20, `currentLevel` `{ kind: "BULL" }`, `highestLevelNumber` 21, `status` `"IN_PROGRESS"`.
  - `the bull with no hit drops two to D19`: from the bull, a blank visit → `levelIndex` 18, `highestLevelNumber` stays 21.
  - `the outer bull does not count`: at the bull level `[OUTER, OUTER, OUTER]` → `hits` unchanged, and the seat slides two.
  - `three bullseyes finish the run`: at the bull level `[BULLSEYE ×3]` → `finishes` 1, `status` `"COMPLETE"`, and `engine.isComplete()` true.
  - `a finished run refuses further darts`: `expect(() => engine.record(MISS)).toThrow()`.
  - `two bullseyes at the bull level stay`: stay on the bull, `finishes` 0.
  - `three hits at D20 climb but do not finish`: `finishes` 0.
  - `undo reopens a finished run`: after the finish, `engine.undo()` → `status` `"IN_PROGRESS"`, `levelIndex` 20, `isComplete()` false.
  - `a run cut by time keeps the highest level`: climb to D5, then a blank visit and a one-hit visit (D3, then D2), `expireTimer()` → `highestLevelNumber` 5, `currentLevel` D2, `status` `"COMPLETE"`.
  - `rounds count closed visits only`: two closed visits and one dart of a third → `rounds` 2, `dartsThrown` 7.
  - `intent is the level's double`: the 4th dart of a run on D2 records `intendedTargetNumber` 2 and `intendedZoneKey` `"DOUBLE"`; at the bull level, 25 and `"INNER_BULL"` (read from `engine.facts()`).
  - `registers its factory`: `getDartExerciseEngineFactory("DOUBLES_SNAKES_LADDERS_V1")` is `snakesLaddersEngineFactory`, and `snakesLaddersEngineFactory.create({})` is a `SnakesLaddersEngine`.
  - `fold equals the engine's state`: `foldSnakesLaddersState(engine.facts(), {}, false)` equals `engine.state()`.
  - `rejects a non-empty config`: `new SnakesLaddersEngine({ finish: 2 } as never)` throws.
  - `undo is the exact inverse of record`: record the 40-dart mixed sequence, undo all, state equals the initial state.
  - Golden: copy `halve-it.aimed.golden.test.ts` with `SnakesLaddersEngine` and `aimedOnCurrentBoardTarget(0.6, "currentLevel")`; seed 17, 260 steps.
- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/snakes-ladders`. Expected: FAIL; the module is missing.
- [ ] **Step 3: Implement.**
  - `game/types.ts`, after `HalveItTrackExt`:
    ```ts
    /** Doubles Snakes & Ladders' Track extras: the per-level tally, the furthest level, and closed visits. */
    export type SnakesLaddersTrackExt = TargetTallyExt &
      LadderTrackExt & {
        rounds: number;
      };
    ```
  - `training/exercises/types.ts`: add `SnakesLaddersState` (JSDoc: derived by replaying `facts()` with `foldSnakesLaddersState`; `levelIndex` locates the next dart; `highestLevelNumber` is 1–21; `finishes` is 1 once three bullseyes land in one visit).
  - The engine module:
    ```ts
    const DARTS_PER_VISIT = 3;
    const DONE_MESSAGE = "A finished Snakes & Ladders run takes no more darts.";

    /** The ladder: D1 up to D20, then the bullseye. */
    export const SNAKES_LADDERS_PATH: readonly BoardTarget[] = [
      ...doublesPath(Array.from({ length: 20 }, (_, i) => i + 1)),
      { kind: "BULL" },
    ];

    /** Hits in a visit to level change: none back two, one back one, two stay, three up one. */
    export const SNAKES_LADDERS_MOVES: MoveTable = { 0: -2, 1: -1, 2: 0, 3: 1 };

    /** Bullseyes in one visit, on the last level, that finish the run. */
    export const SNAKES_LADDERS_FINISH = 3;

    const LAST_INDEX = SNAKES_LADDERS_PATH.length - 1;

    function countRound(seat: TrackSeat<SnakesLaddersTrackExt>): TrackSeat<SnakesLaddersTrackExt> {
      return { ...seat, ext: { ...seat.ext, rounds: seat.ext.rounds + 1 } };
    }

    /**
     * Snakes & Ladders' Track rules: only the level's double (the bullseye on
     * the last level) hits (`isHitOn`) and nothing scores. At a visit's close
     * the round is counted, three bullseyes on the last level finish the run
     * (`finishOnHits`), and any other visit moves by its hits (`moveTable`).
     */
    function snakesLaddersRules(): TrackRules<SnakesLaddersTrackExt> {
      const finish = finishOnHits<SnakesLaddersTrackExt>(SNAKES_LADDERS_FINISH, LAST_INDEX);
      const move = moveTable<SnakesLaddersTrackExt>(SNAKES_LADDERS_MOVES, LAST_INDEX);
      return {
        doneMessage: DONE_MESSAGE,
        target: pathTarget(SNAKES_LADDERS_PATH),
        hit: isHitOn,
        points: noPoints,
        onDart: tallyOnTarget,
        visitOpen: closeAfter(DARTS_PER_VISIT),
        onVisitClose: (seat) => move(finish(countRound(seat))),
      };
    }
    ```
    `projectSnakesLadders(seat, _config, expired, facts)` returns:
    ```ts
    {
      currentLevel: SNAKES_LADDERS_PATH[seat.targetIndex],
      levelIndex: seat.targetIndex,
      highestLevel: SNAKES_LADDERS_PATH[seat.ext.highestIndex],
      highestLevelNumber: seat.ext.highestIndex + 1,
      rounds: seat.ext.rounds,
      finishes: seat.status === "DONE" ? 1 : 0,
      ...tallyTotals(seat.ext.hitsPerTarget, facts),
      status: expired || seat.status === "DONE" ? "COMPLETE" : "IN_PROGRESS",
    }
    ```
    The spec: `trackExerciseSpec<SnakesLaddersConfigData, SnakesLaddersTrackExt, SnakesLaddersState>({ exerciseRulesetVersionKey: "DOUBLES_SNAKES_LADDERS_V1", parse: (config) => SnakesLaddersV1Config.parse(config), rules: snakesLaddersRules, initialExt: () => ({ dartsOnTarget: 0, hitsPerTarget: SNAKES_LADDERS_PATH.map(() => 0), highestIndex: 0, rounds: 0 }), project: projectSnakesLadders, intent: (state) => doubleTargetIntent(state.currentLevel), ends: (state) => state.finishes === 1 })`. Then the standard tail: `foldSnakesLaddersState = spec.fold`, `class SnakesLaddersEngine extends dartExerciseEngineClass(spec) {}`, `snakesLaddersEngineFactory = registerDartExercise(spec, SnakesLaddersEngine).factory`.
  - `scripts/engine-kernels.txt`: append `app/src/modules/training/exercises/snakes-ladders.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/doubles-snakes-and-ladders.md |` after the Halve-It row.
- [ ] **Step 4: Mutation checks.** Each makes a named test fail; revert after:
  - change `SNAKES_LADDERS_MOVES` `0: -2` to `0: -1` (`none slides back two`);
  - change `finishOnHits(…, LAST_INDEX)` to `LAST_INDEX - 1` (`three bullseyes finish the run`);
  - swap `finish(countRound(seat))` order to `move` first (`three bullseyes finish the run` or `a finished run refuses…`).
- [ ] **Step 5: Run** the Step 2 command (PASS) and `bash scripts/check-engine-kernels.sh`; `npm run check`.
- [ ] **Step 6: Commit**
  ```bash
  git add app/src/modules app/tests/modules/training/exercises scripts/engine-kernels.txt
  git commit -m "feat(snakes-ladders): Doubles Snakes & Ladders engine on the Track kernel"
  ```

---

### Task 6: Server wiring

**Files:**
- Modify: `app/src/services/exercise-rulesets/registry.ts`, `app/src/services/types.ts`, `app/src/services/training-session.service.ts`, `app/src/pages/api/training-sessions/types.ts`
- Test: `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/services/training-session.service.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`

**Interfaces:**
- Produces: `REGISTRY.DOUBLES_SNAKES_LADDERS_V1 = makeConfigValidator(SnakesLaddersV1Config)`; `"DOUBLES_SNAKES_LADDERS_V1"` in `DART_WRITING_RULESET_VERSION_KEYS`; `"DOUBLES_SNAKES_LADDERS"` in the service `exerciseTypeKey` union, `DART_EXERCISE_TYPE_KEYS` and `ExerciseTypeKey`.

- [ ] **Step 1: Write the failing tests** (copies of the Halve-It cases, same file placement):
  - registry: the validator takes `{}` and rejects `{ finish: 2 }`; `exerciseRulesetWritesDarts("DOUBLES_SNAKES_LADDERS_V1")` is true.
  - API types: `accepts a DOUBLES_SNAKES_LADDERS step` with `configuration: {}`.
  - service: the capture-pair case with keys `"DOUBLES_SNAKES_LADDERS"` / `"DOUBLES_SNAKES_LADDERS_V1"`, ids `"et-sl"` / `"erv-sl"`.
- [ ] **Step 2: Run** `npm test -- tests/services tests/pages/api/training-sessions/types.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four edits under Interfaces (inline `makeConfigValidator` in the registry, no validator file; one list in each of the other three files).
- [ ] **Step 4: Run** the Step 2 command (PASS) and `npm run check`.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/services app/src/pages/api/training-sessions/types.ts app/tests/services app/tests/pages/api/training-sessions/types.test.ts
  git commit -m "feat(snakes-ladders): server validator, keys and capture pair"
  ```

---

### Task 7: Seed `0048`, verification row, tags

**Files:**
- Create: `database/seeds/0048_snakes_ladders_exercise_type.sql`
- Modify: `database/verification/0047_exercise_type_seed_checks.sql`, `docs/game-rules/training/exercises/doubles-snakes-and-ladders.md` (`Current version:` and the type constant), `database/seeds/0042_catalog_tags.sql` (regenerated), `database/README.md`

**Interfaces:**
- Produces: the type `DOUBLES_SNAKES_LADDERS` (published), ruleset `DOUBLES_SNAKES_LADDERS_V1` (version 1), a system template with `default_configuration = '{}'`, ten-ish catalog tag links, and one `expected` row.

- [ ] **Step 1: Write the seed.** Copy `0048` from `0047_halve_it_exercise_type.sql` with:
  - ids from Global Constraints;
  - key `DOUBLES_SNAKES_LADDERS`, name `Doubles Snakes & Ladders`;
  - type description: `Climb the doubles from D1 to D20, then the bullseye. Three hits in a visit go up a level, two stay, one goes back a level, none go back two. Three bullseyes in one visit finish the run.`;
  - ruleset description: `Initial Doubles Snakes & Ladders ruleset: D1 to D20 then the bullseye; 0 hits back two, 1 back one, 2 stay, 3 up one, floor D1; three bullseyes in one visit finish.`;
  - template name `Doubles Snakes & Ladders`, description `Climb the doubles ladder; three bullseyes finish.`;
  - header comment naming the rules file.
- [ ] **Step 2: Flip the rules file** (`Current version: V1 (shipped 2026-10-22)`; Exercise type section: constant `DOUBLES_SNAKES_LADDERS`, seed `0048`). Run `cd app && npm run tags:generate`. Expected: `0042_catalog_tags.sql` gains the new type's links only; no existing tag id changes (`git diff --stat` shows one file with additions only). If ids shift, stop and ledger it.
- [ ] **Step 3: Add the verification row.** In `0047_exercise_type_seed_checks.sql`, add `('DOUBLES_SNAKES_LADDERS', 'DOUBLES_SNAKES_LADDERS_V1', '{}')` to `expected` and the seed to the header list. Nothing else changes.
- [ ] **Step 4: Prove on a fresh database.** Start Postgres if it is down, then:
  ```bash
  psql "postgres://postgres@localhost:5433/postgres" -c "DROP DATABASE IF EXISTS snakes_fresh" -c "CREATE DATABASE snakes_fresh"
  cd app && DATABASE_URL='postgres://postgres@localhost:5433/snakes_fresh?sslmode=disable' npm run db:migrate && DATABASE_URL='postgres://postgres@localhost:5433/snakes_fresh?sslmode=disable' npm run db:seed:ci
  psql 'postgres://postgres@localhost:5433/snakes_fresh' -f ../database/verification/0047_exercise_type_seed_checks.sql
  ```
  Expected: seeding succeeds; every verification row reads PASS (25 rows). Drop `snakes_fresh` afterwards. Also run the verification against the `integration` database after `db:seed`.
- [ ] **Step 5: Gate.** `bash scripts/check-tag-seeds.sh && bash scripts/check-game-rules.sh && bash scripts/test-check-game-rules.sh`. Expected: OK.
- [ ] **Step 6: Commit**
  ```bash
  git add database docs/game-rules/training/exercises/doubles-snakes-and-ladders.md
  git commit -m "feat(snakes-ladders): seed 0048, verification row, tag links, rules V1"
  ```

---

### Task 8: Stats

**Files:**
- Modify: `app/src/modules/stats/types.ts`, `app/src/modules/stats/step-metrics.module.ts`, `app/src/modules/stats/sections/step-result.module.ts`, `app/src/lib/stats/replay-fold.ts`, `app/src/lib/stats/replay-presenters.ts`, `app/src/stores/routine-stats.store.ts`
- Test: `app/tests/modules/stats/step-metrics.module.test.ts`, `app/tests/modules/stats/sections/step-result.module.test.ts`, `app/tests/lib/stats/replay-step-games.ts`, `replay-fold-steps.test.ts`, `replay-presenters-steps.test.ts`, `app/tests/integration/fixtures/stats-routine.ts`, `app/tests/integration/statistics-sql.itest.ts`, the routine-stats store test

**Interfaces:**
- Produces: the `STEP_METRIC_SPECS` and `STATE_FIELDS` rows from refinement 9; `"DOUBLES_SNAKES_LADDERS"` in `DartExerciseKind`; store labels `highestLevel: "Highest level"`, `rounds: "Rounds"`, `finishes: "Finishes"` (each only if the label map lacks it).

- [ ] **Step 1: Write the failing tests.** Model each on the Halve-It case.
  - `step-metrics`: a run `visitOf(3, D(1))`, `visitOf(3, D(2))`, then a blank visit → expect `{ highestLevel: 3, rounds: 3, finishes: 0, darts: 9, hits: 6 }`.
  - `replay-step-games`: `DOUBLES_SNAKES_LADDERS` fixture, factory `snakesLaddersEngineFactory`, config `{}`, those nine darts.
  - `replay-fold-steps`: `replays a Snakes & Ladders run visit by visit to the engine's final state`: `turns` length 3, `finalState` matches `{ highestLevelNumber: 3, rounds: 3 }`.
  - `step-result`: session `"sl"`, `exerciseRulesetVersionKey: "DOUBLES_SNAKES_LADDERS_V1"`, the same nine darts with intents (`intendedTargetNumber` n, `intendedZoneKey: "DOUBLE"`); expect the same metrics. A second case merges two such sessions and expects `highestLevel` to be the larger, `rounds` the sum (the `max` rule, Review Focus 5).
  - `replay-presenters-steps`: `covers Snakes & Ladders`.
  - `stats-routine.ts`: append `exerciseStep(16, "DOUBLES_SNAKES_LADDERS", {})`, JSDoc "…then Halve-It, then Doubles Snakes & Ladders"; `statistics-sql.itest.ts` `toHaveLength(15)` → `16`, ledger `Ruling: stepKinds 15 → 16 — "one step per kind", same guarantee`.
  - store test: the three labels render for an S&L result.
- [ ] **Step 2: Run** `npm test -- tests/modules/stats tests/lib/stats tests/stores`. Expected: FAIL.
- [ ] **Step 3: Implement** the rows under Interfaces; the two side-effect imports of the engine module in `step-result.module.ts` and `replay-fold.ts` (sorted); `DARTS_METRIC_KEY.DOUBLES_SNAKES_LADDERS = "darts"`; the `DartExerciseKind` JSDoc count "thirteen" → "fourteen".
- [ ] **Step 4: Run** the Step 2 command (PASS), `npm run check`, then `DATABASE_URL="postgres://postgres@localhost:5433/integration" npm run test:integration`. Expected: all PASS. The fixture writes S&L darts with an INNER_BULL-free path, so also add one bullseye dart at intent `(25, INNER_BULL)` in the integration fixture to prove `chk_dart_target_consistency` admits the bull level's intent.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/modules/stats app/src/lib/stats app/src/stores app/tests
  git commit -m "feat(snakes-ladders): step metrics, step result and replay"
  ```

---

### Task 9: Routine summary, step adapter, recorder, completion on dart

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`, `app/src/lib/training/routines/adapters/types.ts`, `adapters/step-adapter.registry.ts`, `app/src/lib/training/routines/types.ts`, `routine-play.data.ts`
- Create: `app/src/lib/training/routines/adapters/snakes-ladders.adapter.ts`
- Test: `app/tests/modules/training/routines/routine-summary-engines.module.test.ts`, `app/tests/lib/training/routines/adapters/dart-exercise.adapter.test.ts`, `step-adapter.registry.test.ts`, `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Produces: `summariseSnakesLadders(state): RoutineStepSummary`; `snakesLaddersAdapter` (key `"DOUBLES_SNAKES_LADDERS"`, headerLabel and title `"Doubles Snakes & Ladders"`, panel `"doubles-snakes-ladders"`, rulesetKey `"DOUBLES_SNAKES_LADDERS_V1"`, slot `"snakesLaddersEngine"`); `RoutinePlayContext.snakesLaddersEngine`; generated `recordSnakesLaddersDart`; `"snakesLaddersEngine"` in `COMPLETES_ON_DART`.

- [ ] **Step 1: Write the failing tests.**
  - Summary: after the nine darts of Task 8 (rounds 3, highest D3), `summariseSnakesLadders(engine.state())` has `stepKey` `"DOUBLES_SNAKES_LADDERS"`, label `"Doubles Snakes & Ladders"` and rows `Highest level: "D3"`, `Rounds: "3"`, `Finished: "No"`, `Darts: "9"`, then `hitRateRow(6, 9)` (`"66.67%"`). A finished run shows `Finished: "Yes"` and `Highest level: "Bull"`.
  - Adapter table: add `[snakesLaddersAdapter, "DOUBLES_SNAKES_LADDERS", "snakesLaddersEngine"]`; registry test: key list plus `resolveStepAdapter("DOUBLES_SNAKES_LADDERS")?.title`. Ledger both as table-row rulings.
  - `routine-play.data.test.ts`: `starts with no Snakes & Ladders engine`; and **`completes the step on the finishing dart`**: open an S&L step, climb to the bull with 20 climbing visits, then three bullseyes through `boardCommit.onCommit!`; expect `appendBatch` called once and `isComplete()` true; then `advanceTimersByTimeAsync(900_000)` and expect `appendBatch` still called once (Review Focus 6).
- [ ] **Step 2: Run** `npm test -- tests/modules/training/routines tests/lib/training/routines`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Summary (reads totals through `stepMetrics("DOUBLES_SNAKES_LADDERS", state, NO_FACTS)`, like `summariseHalveIt`; level text via `boardTargetLabel(state.highestLevel)` with the bull shown as `"Bull"` — use the label the module already uses for BULL targets).
  - Adapter file as `halve-it.adapter.ts`, one `dartExerciseAdapter` call.
  - `adapters/types.ts`: `| "DOUBLES_SNAKES_LADDERS"` and `| "doubles-snakes-ladders"`; registry entry.
  - `routines/types.ts`: import `SnakesLaddersEngine`; slot `snakesLaddersEngine: SnakesLaddersEngine | null`; `ExerciseEngineSlots` and `activeDartEngine` unions; `recordSnakesLaddersDart` signature.
  - `routine-play.data.ts`: `snakesLaddersEngine: null`; `DART_ENGINE_RECORDERS` row `["snakesLaddersEngine", "recordSnakesLaddersDart"]`; `COMPLETES_ON_DART` gains `"snakesLaddersEngine"`; `activeDartEngine` union.
- [ ] **Step 4: Run** the Step 2 command (PASS) and `npm run check`.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/modules/training/routines app/src/lib/training/routines app/tests/modules/training/routines app/tests/lib/training/routines
  git commit -m "feat(snakes-ladders): routine summary, step adapter and early completion"
  ```

---

### Task 10: Play surface

**Files:**
- Modify: `app/src/lib/training/routines/exercise-preview.ts`, `routine-play.data.ts`, `types.ts`, `app/src/pages/training/routines/play/index.astro`
- Create: `app/src/components/layout/training/exercises/SnakesLaddersPanel.astro`
- Test: `app/tests/lib/training/routines/exercise-preview.test.ts`, `routine-play.data.test.ts`

**Interfaces:**
- Consumes: Task 1 `hitRateOf`, `routeChipsOf`, `TARGET_LABEL_GETTERS`.
- Produces on `RoutinePlayContext`: `snakesLaddersLevel(): number` (1–21, the LEVEL score), `snakesLaddersTargetLabel(): string`, `snakesLaddersRoute(): string`, `snakesLaddersChipIndex(): number`, `snakesLaddersHighest(): string`, `snakesLaddersRounds(): number`, `snakesLaddersRate(): string`.

- [ ] **Step 1: Write the failing tests.**
  - Preview: add `snakesLaddersEngine: null` to `none` (ruling: same "no engine open" guarantee). Append: `maps the open Snakes & Ladders engine to the hitCount family`; `judges a bullseye at the bull level as a hit` (`dart` hit 25/INNER_BULL, intent 25/INNER_BULL → `"hit"`; hit 25/OUTER_BULL → `"miss"`); `judges only the intended double` (hit 7/DOUBLE against intent 7/DOUBLE → hit, against intent 8 → miss); `captions with the current level` via `visitLabelsFor("hitCount", { …, currentTargetLabel: "D4" })` → three `"D4"`.
  - Play data, after starting an S&L step (copy the Halve-It block's setup with `SL_STEP` keys): at start `snakesLaddersEngine` is not null, level 1, label `"D1"`, highest `"D1"`, rounds 0, rate `"—"`, route `"D1 D2 D3 D4 D5 D6"`, chip index 0; after `D(1) ×3` the level is 2, label `"D2"`, rounds 1, rate `"100.00%"`; after a blank visit from there: label `"D1"`, highest `"D2"`; `currentTargetLabel` for the preview comes from `snakesLaddersTargetLabel()` (assert `visitLabels()` shows `D1` captions); `board dispatch` `it.each` gains `["DOUBLES_SNAKES_LADDERS", "snakesLaddersEngine"]`.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `exercise-preview.ts`: `ENGINE_FAMILIES` gains `["snakesLaddersEngine", "hitCount"]`. No other change: the family exists.
  - `routine-play.data.ts`: the seven getters (each one line over `hitRateOf`, `routeChipsOf(SNAKES_LADDERS_PATH, …)`, `windowIndex`, `targetLabelOf`, `boardTargetLabel`); `TARGET_LABEL_GETTERS` gains `"snakesLaddersTargetLabel"`.
  - `types.ts`: the seven signatures.
  - `SnakesLaddersPanel.astro`:
    ```astro
    ---
    // Components
    import ExercisePanelShell from "./ExercisePanelShell.astro";
    ---

    <ExercisePanelShell
      score="snakesLaddersLevel()"
      caption="LEVEL"
      chip={{
        routeExpr: "snakesLaddersRoute()",
        currentIndexExpr: "snakesLaddersChipIndex()",
      }}
      tiles={[
        { label: "Highest", value: "snakesLaddersHighest()" },
        { label: "Rounds", value: "snakesLaddersRounds()" },
        { label: "Rate", value: "snakesLaddersRate()" },
      ]}
    />
    ```
  - `play/index.astro`: import the panel and mount `<template x-if="adapter?.panel === 'doubles-snakes-ladders' && snakesLaddersEngine">`.
- [ ] **Step 4: Run** the Step 2 command, the full `npm test`, and `npm run check`. Expected: all PASS, 0/0/0.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/lib/training/routines app/src/components/layout/training/exercises/SnakesLaddersPanel.astro app/src/pages/training/routines/play/index.astro app/tests/lib/training/routines
  git commit -m "feat(snakes-ladders): routine play surface and panel"
  ```

---

### Task 11: Docs and decision D479

**Files:**
- Modify: `decisions/game-engine.md`, `docs/architecture/04-Architecture-patterns.md`, `docs/architecture/09-Training/01-Routines.md`, `docs/architecture/10-Statistics/01-Section-Catalog.md`, `docs/architecture/07-Frontend/08-Component-Inventory.md`, `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`, `app/src/modules/training/CLAUDE.md`, `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`

- [ ] **Step 1: The decision.** Re-run `bash scripts/next-decision-id.sh` (expected `D479`). Append to `decisions/game-engine.md`:
  ```markdown
  ### D479 — A dart exercise can end on its own state
  Status: Accepted · Date: 2026-10-22
  Decision: `DartExerciseSpec` and `TrackExerciseDefinition` take an optional `ends(state)`. The exercise shell's `isComplete()` is true once the timer expires or `ends` says so, and `record()` refuses while complete. Doubles Snakes & Ladders is the first caller (three bullseyes in one visit). `moveTable` and `finishOnHits` are Track policies, each with that exercise as first caller (D468).
  Reason: the shell completed on the timer alone, so a finish needed a hand-written engine as Catch 40 has.
  Consequences: an exercise that omits `ends` behaves as before. The routine page completes the step on the finishing dart through `COMPLETES_ON_DART`. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md`.
  Supersedes: none.
  ```
  Run `bash scripts/check-decision-ids.sh` (OK).
- [ ] **Step 2: Canonical docs**, minimal diffs, date `2026-10-22`:
  - **Pattern 18:** next version entry (`1.11.13`) keeping the chain; the TRACK row's tail adds Doubles Snakes & Ladders; one sentence: "A dart exercise may declare `ends(state)` to finish on its own state; the shell then completes it (D479)."
  - **Routines §17**, after Halve-It: `## Doubles Snakes & Ladders` with the configuration block (`duration: 15m`, levels, moves, finish locked), the rule in two sentences, and an **Implemented** line (`DOUBLES_SNAKES_LADDERS_V1`, `snakes-ladders.engine.module.ts`, seed `0048`, `moveTable`, `finishOnHits`, `ends`, `COMPLETES_ON_DART`, intent via `doubleTargetIntent`, routine step only in V1).
  - **Section catalog:** a `DOUBLES_SNAKES_LADDERS` row (`highestLevel` max; `rounds`, `finishes`, `darts`, `hits` sum; headline `highestLevel` ↑; `hits/darts`).
  - **Component inventory:** a `SnakesLaddersPanel.astro` row after `HalveItPanel`.
  - **File Inventory:** rows for the seed, engine, adapter and panel, wording as the Halve-It rows; the verification row's description gains "+ DOUBLES_SNAKES_LADDERS"; the `track-policies.ts` row gains the two policies; the shell row gains `ends`.
  - **Context-Map History:** one row.
  - **`modules/training/CLAUDE.md`:** add `snakes-ladders` to the engine list and to the `trackExerciseSpec` users; one bullet: "A spec may declare `ends(state)`; the shell completes the exercise on it (2026-10-22, D479)."
  - **Spec:** fold in this plan's refinements (§2.2, §4, §6, §7, §10-style note).
- [ ] **Step 3: Run** `bash scripts/check-context-map.sh` (slow; background), then `bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-game-rules.sh && bash scripts/check-doc-sync.sh && bash scripts/check-decision-ids.sh && bash scripts/check-tag-seeds.sh`. Expected: all OK.
- [ ] **Step 4: Commit**
  ```bash
  git add decisions docs app/src/modules/training/CLAUDE.md
  git commit -m "docs(snakes-ladders): D479 ends hook, routines, stats catalog, inventories"
  ```

---

### Task 12: Gates and duplication

- [ ] **Step 1: Format.** `cd app && npm run format && npm run format:check`; commit any diff as `style: format`.
- [ ] **Step 2: Validate.** `cd app && npm run validate:app` with the temporary `app/.env`; delete it. Expected: exit 0, 0/0/0, fallow clean. A fallow flag on `routine-play.data.ts` is fixed at the cause here; ledger the ruling.
- [ ] **Step 3: Gate scripts.** Every script in the `run-all-gates` skill's "Always run" and "app/ changed" lists, plus `check-engine-kernels.sh`, `test-check-engine-kernels.sh`, `check-tag-seeds.sh`, `test-check-tag-seeds.sh`. Record each result for the PR body.
- [ ] **Step 4: Duplication.** Re-run Task 1 Step 0's four paths. Expected: no count above its baseline. A rise is fixed here or ledgered with why it stands.
- [ ] **Step 5: Decision id.** `bash scripts/next-decision-id.sh` prints `D480`; if another D479 landed on `main`, `bash scripts/renumber-decision.sh D479 <new>`.
- [ ] **Step 6: Issues.** None are closed by this PR. File any discovered work (e.g. #1053's engine-tail duplication now has a third instance count) per `capturing-discovered-work`; do not fix it here.
