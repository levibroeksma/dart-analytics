# Marks Kernel — Tactics + Cricket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `marks-kernel.module.ts` and rebind Tactics, then Cricket, onto it and the game shell with no behaviour change; delete `MarksEngine`.

**Architecture:** The kernel absorbs `marks-duel.module.ts` (`foldMarksDuel`, `foldMarksSeats` → `foldMarks`), adds `marksWouldComplete`, and builds a whole `DartGameSpec` from a `MarksRules` (`marksGameSpec`) so both engines share refusal, intent, visit close and `wouldComplete`. Each engine becomes `class XEngine extends dartGameEngineClass(xSpec) {}` plus two `dartGameEngineFactory` calls. Proof: frozen legacy copy + `runOracle`, goldens recorded on the legacy engines, then legacy deleted.

**Tech Stack:** TypeScript, Vitest; repo gates (`check-*.sh`, fallow, `npm run check`).

**Spec:** `docs/superpowers/specs/2026-10-28-marks-kernel-design.md`

## Global Constraints

- No behaviour change: state, facts, refusal messages ("game has ended"), `wouldComplete`, `isComplete`, rehydration identical to today (oracle).
- Seat cap 2 (D487). Solo under V2 folds as V1.
- Persistence unchanged: one `EXERCISE_BLOCK` stage, one turn per visit (≤3 darts), `NO_INTENT` darts, `totalScore` = board-score sum. No migration.
- Exported names keep names and signatures: `CRICKET_OBJECTIVES`, `TACTICS_OBJECTIVES`, `cricketMarksOf`, `tacticsMarksOf`, `isTacticsTarget`, `initialCricketState`, `initialTacticsState`, `applyCricketDart`, `applyTacticsDart`, `foldCricketState`, `foldTacticsState`, `CricketEngine`, `TacticsEngine`, `cricketEngineFactory`, `cricketV2EngineFactory`, `tacticsEngineFactory`, `tacticsV2EngineFactory`, `effectiveMarks`/`marksPerRound` re-exports. Only the classes' `TKey` parameter goes (spec M3).
- `foldMarksDuel` keeps its name and signature (moves file).
- Exported types live in `types.ts`/`interfaces.ts` (`check-type-barrels.sh`).
- No `//` comments in function bodies under `app/src/**`; JSDoc without decision history.
- TDD per `app/CLAUDE.md`. Fallow duplication count must not rise vs `main`; fallow dead-code clean.
- Never `--no-verify`. The registry row flips to `KERNEL_BOUND` in the same commit as the first kernel import (pre-commit gate).
- Branch: `feat/marks-kernel` (carries the spec commit).

## Rulings made while planning

- `MarksDuelSpec` is renamed `MarksRules` in `types.ts`; `hitOf`'s opponent becomes `TSeat | null` (null = solo). Tactics' solo `hitOf` passes `() => false` as `opponentOpen`, as `applyTacticsDart` does today.
- `foldMarks(facts, seats, rules)` replaces `foldMarksSeats(facts, seats, spec, applyDart)`: solo applies `applyMarksDart(seat, rules.hitOf(seat, null, o))` merged over the seat (`{...seat, ...applyMarksDart(...)}`), exactly what `applyCricketDart`/`applyTacticsDart` do.
- `marksGameSpec` lives in the kernel (not in each engine) so the two specs carry no duplicated hooks.
- `recordMarksDart` and `marks-close`'s private `activeSeatComplete` are deleted in Task 3 with their last caller; their tests are deleted after Task 3 Step 1 confirms each guarantee has an engine-level test.

## Review Focus

1. Game-ending dart on dart 1 or 2 of a visit → its turn stamped, next `record` throws "game has ended", `wouldComplete` false. Pinned by the oracle (Task 1) and a kernel test (Task 2, "closes the visit on the winning dart").
2. 1v1: a seat closed out but behind keeps throwing; its later dart that catches up wins. `marksWouldComplete` must say true on that dart. Kernel test (Task 2).
3. Tactics 1v1: a hit on a number the seat closed but the opponent has open scores, not feeds a category; `wouldComplete` must use the opponent-aware `hitOf`. Kernel test via Tactics rules (Task 2).
4. Undo across a visit boundary and of the winning dart → visit reopens, `IN_PROGRESS`, same thrower. Oracle (`undoRate`).
5. Rehydration mid-visit and after the end. Oracle (`rehydrateEvery`).

---

### Task 1: Freeze legacy, oracle and goldens

**Files:**
- Create: `app/tests/modules/game/legacy/marks.legacy.ts`
- Create: `app/tests/modules/game/support/marks-observations.ts`
- Create: `app/tests/modules/game/tactics.oracle.test.ts`, `cricket.oracle.test.ts`
- Create: `app/tests/modules/game/tactics.golden.test.ts`, `cricket.golden.test.ts` (+ `__snapshots__`)

**Interfaces:**
- Produces: `LegacyTacticsEngine`, `LegacyCricketEngine` — `(config, prior?, key)` constructors, the current `MarksEngine` + `recordMarksDart` + `foldMarksSeats`/`foldMarksDuel`/`applyDuelDart` copied verbatim into the one file. It may import only what survives the PR: `marks-close` primitives except `recordMarksDart` (`tallyMarksDart`, `applyMarksDart`, `initialMarksSeat`, `MARKS_TO_CLOSE`, `DARTS_PER_VISIT`), `turn-log`, `seat-rota`, `seat-state`, and `cricketMarksOf`/`tacticsMarksOf`/objective lists/`initial*State`.
- Produces: `marksObservation(rand: () => number): DartObservation` — 70%: a ring (`OUTER_SINGLE`/`DOUBLE`/`TREBLE`) on 15–20 or a bull ring (`OUTER_BULL`/`INNER_BULL`); else `randomObservation(rand)`. Biased so 400 steps reach completion and post-end refusals.

- [ ] **Step 1: Write the legacy file and the observation helper**

- [ ] **Step 2: Write the oracle tests**

Per engine, one `it` per case; `runOracle({ build: (p) => new XEngine(cfg, p, key), legacy: (p) => new LegacyXEngine(cfg, p, key), seeds: [1, 2, 3, 4, 5], steps: 400, undoRate: 0.1, rehydrateEvery: 25, observe: marksObservation })`.
Cases: `solo V1` (1 seat), `solo V2` (1 seat), `duel V2` (2 seats).

- [ ] **Step 3: Run; oracle passes (both sides are the same code today)**

Run: `cd app && npx vitest run tests/modules/game/tactics.oracle.test.ts tests/modules/game/cricket.oracle.test.ts`
Expected: PASS. Then temporarily change one legacy refusal message, re-run, see FAIL naming `record`, revert — proves the oracle bites.

- [ ] **Step 4: Write goldens on the current engines**

Per engine, same three cases: `goldenTrace({ build, seed: 7, steps: 300, undoRate: 0.1, rehydrateEvery: 7, observe: marksObservation })` → `toMatchSnapshot()`. Fake timers as `score-training.golden.test.ts`. Header comment: recorded on the `MarksEngine`-based engines before the rebind.

- [ ] **Step 5: Run; snapshots written; assert each case's trace reaches a `throws game has ended` line**

Run: `cd app && npx vitest run tests/modules/game/tactics.golden.test.ts tests/modules/game/cricket.golden.test.ts && grep -c 'game has ended' tests/modules/game/__snapshots__/{tactics,cricket}.golden.test.ts.snap`
Expected: PASS; counts > 0. If a case never ends, raise its steps until it does.

- [ ] **Step 6: Commit** — `test(marks): freeze legacy engines, oracle, goldens`

---

### Task 2: Marks kernel + Tactics on the game shell

**Files:**
- Modify: `app/src/modules/game/types.ts` (`MarksDuelSpec` → `MarksRules`, opponent `TSeat | null`)
- Create: `app/src/modules/game/marks-kernel.module.ts`
- Delete: `app/src/modules/game/marks-duel.module.ts`
- Move: `app/tests/modules/game/marks-duel.module.test.ts` → `marks-kernel.module.test.ts` (imports re-pointed; cases unchanged)
- Modify: `app/src/modules/game/tactics.engine.module.ts`, `cricket.engine.module.ts` (Cricket: `CRICKET_DUEL` retyped `MarksRules`, `foldCricketState` calls `foldMarks` — this commit only touches its fold import, Cricket keeps `MarksEngine`)
- Modify: `scripts/engine-kernels.txt` (both rows `KERNEL_BOUND` — Cricket now imports the kernel for its fold)
- Modify: `app/tests/modules/game/tactics.engine.module.test.ts`

**Interfaces:**
- Consumes: `applyMarksDart`, `tallyMarksDart`, `MARKS_TO_CLOSE`, `DARTS_PER_VISIT` (`marks-close`); `activeSeat`, `seatOf`, `foldSeatStates`, `toObservation`, `refuseWhenEnded`, `NO_INTENT`; `DartGameSpec`.
- Produces (kernel):
  - `foldMarksDuel<TSeat>(turns, seats: readonly [SeatFact, SeatFact], rules: MarksRules<TSeat>): MarksDuelFold<TSeat>` — moved unchanged.
  - `foldMarks<TSeat>(facts: EngineFacts, seats: readonly SeatFact[], rules: MarksRules<TSeat>): MarksGameState<TSeat>`.
  - `marksWouldComplete<TSeat>(state: MarksGameState<TSeat>, observation: DartObservation, rules: MarksRules<TSeat>): boolean` — false unless `IN_PROGRESS`; solo: the active seat's trial `applyMarksDart` is `COMPLETE`; 1v1: the trial duel dart (`applyDuelDart`) leaves the thrower `COMPLETE` with `points >= opponent.points`.
  - `marksGameSpec<TConfig extends { seats: readonly SeatFact[] }, TSeat>(opts: { rulesetVersionKey; rulesetVersionKeys; rules: MarksRules<TSeat> }): DartGameSpec<TConfig, MarksGameState<TSeat>>` — `stageOwnership: "PER_SEAT"`; `fold = foldMarks(facts, config.seats, rules)`; `refusal = status === "COMPLETE" ? "game has ended" : null`; `intent = NO_INTENT`; `isVisitOpen = turn.completedAt === null && turn.darts.length < DARTS_PER_VISIT && state.status !== "COMPLETE"`; `wouldComplete = marksWouldComplete(state, input, rules)`.
- Produces (Tactics): `const tacticsSpec = marksGameSpec({ rulesetVersionKey: "TACTICS_V1", rulesetVersionKeys: ["TACTICS_V2"], rules: TACTICS_RULES })`; `export class TacticsEngine extends dartGameEngineClass(tacticsSpec) {}`; `tacticsEngineFactory = dartGameEngineFactory(tacticsSpec, TacticsEngine)`; `tacticsV2EngineFactory = dartGameEngineFactory(tacticsSpec, TacticsEngine, "TACTICS_V2")`.

- [ ] **Step 1: Failing kernel tests** in `marks-kernel.module.test.ts` (added to the moved duel cases), using Cricket's and Tactics' rules objects (export each as `CRICKET_RULES`/`TACTICS_RULES`):

```ts
describe("marksWouldComplete", () => {
  it("solo: true on the dart that closes the last objective", ...);
  it("solo: false on a dart that leaves an objective open", ...);
  it("1v1: true when the closing-out dart leaves points level or ahead", ...);
  it("1v1: false when the closing-out dart leaves the thrower behind", ...);
  it("1v1: true on the scoring dart of a closed-out seat that catches up", ...); // Review Focus 2
  it("Tactics 1v1: a hit on a number the opponent has open scores, not a category", ...); // Review Focus 3
  it("false once the game is COMPLETE", ...);
});
describe("marksGameSpec", () => {
  it("refuses with 'game has ended' once COMPLETE, else null", ...);
  it("keeps a visit open below three darts while IN_PROGRESS", ...);
  it("closes the visit on the winning dart", ...); // Review Focus 1
  it("closes a stamped turn", ...);
  it("serves both keys; dartGameEngineFactory throws for a key it does not serve", () => {
    expect(() => dartGameEngineFactory(spec, Engine, "CRICKET_V1")).toThrow("CRICKET_V1 is not served by this spec");
  });
});
```

- [ ] **Step 2: Run; fail** — `cd app && npx vitest run tests/modules/game/marks-kernel.module.test.ts` → module not found.

- [ ] **Step 3: Implement** the kernel, the `MarksRules` rename, Tactics as a spec, Cricket's fold import, both registry rows. Delete `marks-duel.module.ts`. In `tactics.engine.module.test.ts` delete "types the engine by its key" (its guard is gone, spec M3); keep the others.

- [ ] **Step 4: Run** — `cd app && npx vitest run tests/modules/game` → PASS, oracles and goldens included.

- [ ] **Step 5: Gates** — `cd app && npm run check` (0 hints), `npx fallow` (dupes ≤ main, no dead code), `bash ../scripts/check-engine-kernels.sh`.

- [ ] **Step 6: Commit** — `refactor(tactics): bind to the marks kernel and the game shell`

---

### Task 3: Cricket on the game shell; delete `MarksEngine`

**Files:**
- Modify: `app/src/modules/game/cricket.engine.module.ts`
- Delete: `app/src/modules/game/marks-engine.module.ts`, `app/tests/modules/game/marks-engine.module.test.ts`
- Modify: `app/src/modules/game/marks-close.module.ts` (delete `recordMarksDart`, `activeSeatComplete`, unused imports)
- Modify: `app/tests/modules/game/marks-close.module.test.ts` (delete the `recordMarksDart` describe)
- Modify: `app/tests/modules/game/cricket.engine.module.test.ts`, `marks-kernel.module.test.ts`

**Interfaces:**
- Consumes: `marksGameSpec`, `CRICKET_RULES` (Task 2).
- Produces: `CricketEngine`, `cricketEngineFactory`, `cricketV2EngineFactory` as Tactics' in Task 2.

- [ ] **Step 1: Re-point guarantees before deleting their tests.** For each `it` in `marks-engine.module.test.ts` and in `marks-close`'s `recordMarksDart` describe, name the engine/kernel test that holds it (records into open visit, hands over after 3, refuses once COMPLETE, stamps ending visit, undo reopens, copies from `facts`/`state`, `wouldComplete` leaves the log alone, `PER_SEAT` + key, factory forwards `prior`). Add any missing one to `cricket.engine.module.test.ts` first, watch it pass on the current engine. The wrong-key guard is held by Task 2's served-key test.

- [ ] **Step 2: Rebind Cricket**, delete `marks-engine.module.ts` and its test, delete `recordMarksDart` + its tests.

- [ ] **Step 3: Run** — `cd app && npm test` → PASS.

- [ ] **Step 4: Gates** — as Task 2 Step 5, plus `grep -rn 'marks-engine\|marks-duel\|recordMarksDart\|MarksDuelSpec\|foldMarksSeats' app/src app/tests docs/architecture app/src/modules/game/CLAUDE.md` → only hits are the doc rows Task 5 rewrites.

- [ ] **Step 5: Commit** — `refactor(cricket): bind to the marks kernel; drop MarksEngine`

---

### Task 4: Drop the legacy copy

- [ ] **Step 1:** Delete `legacy/marks.legacy.ts`, `tactics.oracle.test.ts`, `cricket.oracle.test.ts`. Keep `marks-observations.ts` (goldens use it).
- [ ] **Step 2:** `cd app && npm test` → PASS; goldens unchanged (no `-u`).
- [ ] **Step 3: Commit** — `test(marks): drop legacy copy; goldens hold the guarantee`

---

### Task 5: Docs and context

- `decisions/game-engine.md`: **D506** — Marks kernel: `marks-kernel.module.ts` (`MarksRules`, `foldMarks`, `foldMarksDuel`, `marksWouldComplete`, `marksGameSpec`); Cricket and Tactics are specs on the game shell; `MarksEngine`, `marksEngineFactory`, `recordMarksDart` deleted; the key guard is the shell's runtime served-key check. `Supersedes: D488`.
- `docs/architecture/04-Architecture-patterns.md`: version 1.11.23 line; Pattern 18 `MARKS` row → bound through `foldMarks` on the game shell (D506).
- `app/src/modules/game/CLAUDE.md`: replace the `MarksEngine` bullet (line 20) with the kernel shape.
- `docs/architecture/00-File-Inventory.md`: drop `marks-duel`/`marks-engine` rows, add `marks-kernel`; amend the `marks-close` row (no `recordMarksDart`).
- Context-Map-History row; spec §4 status note; `context-maintenance` skill; `run-all-gates` skill; `cd app && npm run format`.
- [ ] **Commit** — `docs(marks): kernel bound, D506`

Then `finishing-a-dart-branch` (push + PR).
