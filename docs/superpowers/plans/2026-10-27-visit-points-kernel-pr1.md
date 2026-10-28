# Visit Points Kernel PR 1 — Score Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Visit points kernel and move Score Threshold onto it and the exercise shell, with no change in behaviour, deleting its hand-written class.

**Architecture:** `visit-points-kernel.module.ts` folds one seat over turns: a turn's total is its dart sum (or stored `totalScore` when dartless), a closed turn adds `rules.points(total)`. Score Threshold becomes a `DartExerciseSpec` whose `fold` projects the kernel seat onto `ScoreThresholdState`, bound through `dartExerciseEngineClass` + `registerDartExercise`. Proof as Checkout PR 2: legacy copy + differential oracle, goldens recorded before the rebind, then legacy deleted.

**Tech Stack:** TypeScript, Vitest, Zod; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (§3, §4 PR 1, §5, §6).

## Global Constraints

- No behaviour change: `state()`, `facts()`, thrown messages, `ScoreThresholdState` keys and values, `foldScoreThresholdState(facts, config, complete)` signature identical.
- `ScoreThresholdEngine` stays an exported class (`score-threshold.adapter.ts` `engineClass`, `routine-play.data.ts`, `routines/types.ts`); `scoreThresholdEngineFactory` stays exported.
- Persistence unchanged: one `EXERCISE_BLOCK` stage, one `turns` row per three-dart visit, one `darts` row per dart; free aim (`NO_INTENT`); no new fact columns.
- Kernel carries only `dartsPerVisit` and `points` (spec V2): no goal, bust, void, compare, seat identity, duration or outcome.
- No shell change in this PR (spec §4).
- `modules/game/**` never imports `modules/training/**`.
- No `//` comments inside function bodies in `app/src/**`; JSDoc above declarations only (no decision history in it).
- Exported types live in `types.ts`/`interfaces.ts`, imported through `@modules/types` / `@modules/interfaces` (`check-type-barrels.sh`, pre-commit — the legacy copy too).
- TDD per `app/CLAUDE.md`: failing test first, watched fail, then code.
- Never `--no-verify`. Pre-commit runs 14 gates; run slow commits in the background and poll.
- Branch: `claude/adoring-bell-0p3iks` (carries the spec commit). One PR to `main` with spec, plan and implementation.
- New decision entry **D501** (spec §6): kernel contract, order V3, `visitInput` rule V4.

## Review Focus

1. A visit open at expiry stays unjudged but its darts count in `dartsThrown`; `undo` first un-expires. Pinned by oracle `expireAt` + `resumeExpired: true` and existing engine tests.
2. Undo of a visit's third dart reopens it: `visits`/`beats`/`lastVisitTotal` roll back, `currentVisitTotal`/`dartsInVisit` return, the next dart reuses the same turn. Pinned by oracle (undo rate 0.15) and a kernel test (Task 2 Step 1, "open turn after close is reopened").
3. A visit totalling exactly 65 beats; 64 does not. Pinned by a projection test in Task 3 Step 1.
4. Rehydration mid-visit (1–2 darts in the last turn) resumes the same turn. Pinned by oracle `rehydrateEvery: 7` (not a multiple of 3, so it lands mid-visit).
5. `lastVisitTotal` is `null` until the first closed visit, then the latest closed total, never the open one. Pinned by a kernel test (Task 2 Step 1).

---

### Task 1: Plan commit, legacy copy, oracle, goldens

**Files:**
- Create: `docs/superpowers/plans/2026-10-27-visit-points-kernel-pr1.md` (this file)
- Create: `app/tests/modules/training/exercises/legacy/score-threshold.legacy.ts`
- Create: `app/tests/modules/training/exercises/score-threshold.oracle.test.ts`
- Create: `app/tests/modules/training/exercises/score-threshold.golden.test.ts` (+ `__snapshots__`)

**Interfaces:**
- Consumes: `runOracle`, `goldenTrace`, `normalise`, `randomObservation` (`tests/modules/game/support/engine-oracle.ts`).
- Produces: `LegacyScoreThresholdEngine` (legacy file).

- [ ] **Step 1: Commit the plan**

```bash
cd /home/user/dart-analytics
git checkout claude/adoring-bell-0p3iks
git add docs/superpowers/plans/2026-10-27-visit-points-kernel-pr1.md docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md
git commit -m "docs(plan): visit points kernel PR 1 — Score Threshold"
```

- [ ] **Step 2: Copy the engine as legacy**

Same method as Checkout PR 2 Task 1 Step 2: rewrite the header so every type import goes through the barrels, copy the body verbatim from `const EXERCISE_RULESET_VERSION_KEY` up to (not including) `export const scoreThresholdEngineFactory`, rename the class `LegacyScoreThresholdEngine`, drop `export` from `foldScoreThresholdState` (rename it `legacyFold`), run Prettier. Header:

```ts
import type { ScoreThresholdConfigData } from "@lib/types";
import { ScoreThresholdV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartObservation,
  EngineFacts,
  ScoreThresholdState,
  TurnFact,
} from "@modules/types";
import type { DartExerciseEngine } from "@modules/interfaces";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  refuseWhenEnded,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { SOLO_PARTICIPANT_REF } from "@modules/training/exercises/solo-participant.module";
```

Check: `grep -c "register\|Factory" <legacy file>` → `0`.

- [ ] **Step 3: Write the oracle test**

`score-threshold.oracle.test.ts`, shaped as `random-checkout.oracle.test.ts` (fake timers at `2026-11-01T10:00:00Z`, `SEEDS` 1–15, 60 s timeout), config `{ threshold: 65 }`, default `randomObservation`. Cases:

| Name | `steps` | `expireAt` | `undoRate` | `rehydrateEvery` | `resumeExpired` |
| --- | --- | --- | --- | --- | --- |
| `"expired mid-run"` | 240 | 180 | 0.15 | 7 | true |
| `"never expired"` | 240 | — | 0.15 | 7 | — |

Test name: `` `${name}: indistinguishable through every public method` ``.

- [ ] **Step 4: Run it against the current engine**

Run: `cd app && npx vitest run tests/modules/training/exercises/score-threshold.oracle.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Write the golden tests**

`score-threshold.golden.test.ts`, shaped as `random-checkout.golden.test.ts`:
- `"seed 42, 300 steps then expiry is unchanged"`: `seededUniform(42, 0)`, undo when `rand() < 0.08`, else `record(randomObservation(rand))`; then `expireTimer()`; snapshot `normalise({ facts, state })`.
- `"seed 7 step trace with rehydration is unchanged"`: `goldenTrace({ seed: 7, steps: 240, undoRate: 0.1, rehydrateEvery: 7, expireAt: 180, resumeExpired: true })`.

- [ ] **Step 6: Record the goldens**

Run: `cd app && npx vitest run -u tests/modules/training/exercises/score-threshold.golden.test.ts`
Expected: 2 passed, 2 snapshots written; `grep -cE '"beats": [1-9]' tests/modules/training/exercises/__snapshots__/score-threshold.golden.test.ts.snap` ≥ 1 (a beat was recorded).

- [ ] **Step 7: Commit**

```bash
cd /home/user/dart-analytics
git add app/tests/modules/training/exercises/legacy/score-threshold.legacy.ts \
  app/tests/modules/training/exercises/score-threshold.oracle.test.ts \
  app/tests/modules/training/exercises/score-threshold.golden.test.ts \
  app/tests/modules/training/exercises/__snapshots__/score-threshold.golden.test.ts.snap
git commit -m "test(score-threshold): freeze legacy engine, oracle, goldens"
```

---

### Task 2: Kernel

**Files:**
- Create: `app/src/modules/game/visit-points-kernel.module.ts`
- Modify: `app/src/modules/game/types.ts` (add `VisitPointsSeat`, next to `CheckoutSeat`)
- Modify: `app/src/modules/game/interfaces.ts` (add `VisitPointsRules`, next to `CheckoutRules`)
- Test: `app/tests/modules/game/visit-points-kernel.module.test.ts`

**Interfaces:**
- Produces:
  - `type VisitPointsSeat = { visits: number; points: number; lastVisitTotal: number | null; openTotal: number; dartsInVisit: number; dartsThrown: number }`
  - `interface VisitPointsRules { readonly dartsPerVisit: number; points(visitTotal: number): number }`
  - `INITIAL_VISIT_POINTS_SEAT: VisitPointsSeat` — all zero, `lastVisitTotal: null` (frozen with `Object.freeze`; callers spread, never mutate)
  - `applyVisitPointsTurn(seat: VisitPointsSeat, turn: TurnFact, rules: VisitPointsRules): VisitPointsSeat`
  - `foldVisitPoints(turns: readonly TurnFact[], rules: VisitPointsRules): VisitPointsSeat`

Rules the reducer applies (spec §3):
- total = sum of `turn.darts[].score`, or `turn.totalScore` when `turn.darts.length === 0`.
- closed = `turn.darts.length === 0 || turn.darts.length >= rules.dartsPerVisit`.
- closed: `visits + 1`, `points + rules.points(total)`, `lastVisitTotal = total`, `openTotal = 0`, `dartsInVisit = 0`.
- open: `openTotal = total`, `dartsInVisit = turn.darts.length`; counters unchanged.
- always: `dartsThrown + turn.darts.length`.

- [ ] **Step 1: Write the failing tests**

Helpers: `dartsTurn(scores: number[]): TurnFact`, `keypadTurn(total: number): TurnFact`; `RULES = { dartsPerVisit: 3, points: (t) => t }`, `BEATS = { dartsPerVisit: 3, points: (t) => (t >= 65 ? 1 : 0) }`.

| Test | Assertion |
| --- | --- |
| `"empty log is the initial seat"` | `foldVisitPoints([], RULES)` equals `{ visits: 0, points: 0, lastVisitTotal: null, openTotal: 0, dartsInVisit: 0, dartsThrown: 0 }` |
| `"a three-dart turn closes and scores its dart sum"` | `[dartsTurn([60, 20, 5])]` → `visits 1, points 85, lastVisitTotal 85, openTotal 0, dartsInVisit 0, dartsThrown 3` |
| `"a short turn stays open and scores nothing yet"` | `[dartsTurn([60, 20, 5]), dartsTurn([57, 3])]` → `visits 1, points 85, lastVisitTotal 85, openTotal 60, dartsInVisit 2, dartsThrown 5` |
| `"a dartless turn closes on its stored totalScore"` | `[keypadTurn(100)]` → `visits 1, points 100, lastVisitTotal 100, dartsThrown 0` |
| `"points come from the rules"` | `BEATS` over `[dartsTurn([20, 20, 25]), dartsTurn([20, 20, 24])]` → `visits 2, points 1, lastVisitTotal 64` |
| `"open turn after close is reopened"` | `applyVisitPointsTurn` of `dartsTurn([60, 1])` on a seat folded from one closed 85 → `visits 1, openTotal 61, dartsInVisit 2` (models undo of the third dart: refolding the shorter turn) |

- [ ] **Step 2: Run to watch them fail**

Run: `cd app && npx vitest run tests/modules/game/visit-points-kernel.module.test.ts`
Expected: FAIL — module `@modules/game/visit-points-kernel.module` not found.

- [ ] **Step 3: Add the types and implement the kernel**

JSDoc on `applyVisitPointsTurn`: "The Visit points kernel's one reducer (Pattern 18 §Rule-kernel families)". The kernel has no caller yet; fallow's dead-code gate is satisfied in Task 3 before the PR, not per commit.

- [ ] **Step 4: Run to watch them pass**

Run: `cd app && npx vitest run tests/modules/game/visit-points-kernel.module.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game/visit-points-kernel.module.ts app/src/modules/game/types.ts \
  app/src/modules/game/interfaces.ts app/tests/modules/game/visit-points-kernel.module.test.ts
git commit -m "feat(engine): visit points kernel"
```

---

### Task 3: Rebind Score Threshold onto the kernel and the exercise shell

**Files:**
- Modify: `app/src/modules/training/exercises/score-threshold.engine.module.ts` (whole file)
- Modify: `scripts/engine-kernels.txt` (Score Threshold row → `KERNEL_BOUND`, reason column empty)
- Test: `app/tests/modules/training/exercises/score-threshold.engine.module.test.ts` (add one test)

**Interfaces:**
- Consumes: `foldVisitPoints`, `VisitPointsRules` (Task 2); `dartExerciseEngineClass`, `registerDartExercise` (`dart-exercise-shell.module.ts`); `NO_INTENT` (`turn-log.module.ts`).
- Produces (unchanged names): `foldScoreThresholdState`, `ScoreThresholdEngine` (class extending `dartExerciseEngineClass(scoreThresholdSpec)`), `scoreThresholdEngineFactory`.

Spec (`DartExerciseSpec<ScoreThresholdConfigData, ScoreThresholdState>`):
- `exerciseRulesetVersionKey: "SCORE_THRESHOLD_V1"`; `parse: ScoreThresholdV1Config.parse`.
- `fold(facts, config, expired)`: `foldVisitPoints(facts.turns, { dartsPerVisit: 3, points: (t) => (t >= config.threshold ? 1 : 0) })`, projected per spec §3: `threshold`, `beats = points`, `visits`, `lastVisitTotal`, `currentVisitTotal = openTotal`, `dartsInVisit`, `dartsThrown`, `status: expired ? "COMPLETE" : "IN_PROGRESS"`. Key order as today's state (`threshold, beats, visits, lastVisitTotal, currentVisitTotal, dartsInVisit, dartsThrown, status`).
- `intent: () => NO_INTENT`; `isVisitOpen: (_turn, state) => state.dartsInVisit > 0`; no `ends`.
- Module ends `export const scoreThresholdEngineFactory = registerDartExercise(scoreThresholdSpec, ScoreThresholdEngine).factory;` and `export const foldScoreThresholdState = scoreThresholdSpec.fold;`.

- [ ] **Step 1: Write the failing test**

In `score-threshold.engine.module.test.ts`:

```ts
it("is built on the exercise shell", () => {
  const engine = new ScoreThresholdEngine(CONFIG);
  expect(engine.spec.exerciseRulesetVersionKey).toBe("SCORE_THRESHOLD_V1");
});

it("beats on exactly 65, not on 64", () => {
  const engine = new ScoreThresholdEngine(CONFIG);
  play(engine, [dart(20, "TREBLE"), dart(5, "OUTER_SINGLE"), dart(null, "MISS")]);
  play(engine, [dart(20, "TREBLE"), dart(4, "OUTER_SINGLE"), dart(null, "MISS")]);
  expect(engine.state()).toMatchObject({ visits: 2, beats: 1, lastVisitTotal: 64 });
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `cd app && npx vitest run tests/modules/training/exercises/score-threshold.engine.module.test.ts`
Expected: FAIL on `"is built on the exercise shell"` (`engine.spec` undefined); `"beats on exactly 65"` passes already (behaviour pin).

- [ ] **Step 3: Rewrite the module as the spec above**

Delete the class body, `Progress`, `INITIAL_PROGRESS`, `applyVisit`. Class JSDoc keeps today's rules-file pointer and "clockless: completion arrives only through `expireTimer()` (D264)", adds "on the Visit points kernel and the exercise shell".

- [ ] **Step 4: Run engine tests, oracle, goldens**

Run: `cd app && npx vitest run tests/modules/training/exercises/score-threshold tests/modules/game/visit-points-kernel.module.test.ts tests/lib/training/routines`
Expected: all pass; no snapshot written or changed.

- [ ] **Step 5: Flip the registry row**

`scripts/engine-kernels.txt`:

```
app/src/modules/training/exercises/score-threshold.engine.module.ts | VISIT_POINTS | KERNEL_BOUND | docs/game-rules/training/exercises/score-threshold.md |
```

Run: `bash scripts/check-engine-kernels.sh` → OK (it requires the kernel import, which the module now has).

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/training/exercises/score-threshold.engine.module.ts \
  app/tests/modules/training/exercises/score-threshold.engine.module.test.ts scripts/engine-kernels.txt
git commit -m "feat(score-threshold): bind to visit points kernel and exercise shell"
```

---

### Task 4: Drop the legacy copy

Guarantee re-pointed at the Task 1 goldens, never dropped (Hard Invariants).

- [ ] **Step 1:** `git rm` the legacy file and `score-threshold.oracle.test.ts`; `rmdir app/tests/modules/training/exercises/legacy 2>/dev/null || true`.
- [ ] **Step 2:** `cd app && npx vitest run tests/modules/training/exercises/score-threshold.golden.test.ts` → 2 passed, no snapshot change.
- [ ] **Step 3:** `git commit -m "test(score-threshold): drop legacy copy; goldens hold the guarantee"`

---

### Task 5: Docs, decision, context

**Files:**
- Modify: `decisions/game-engine.md` (append D501 after D500)
- Modify: `docs/architecture/04-Architecture-patterns.md` (version line 10; `VISIT_POINTS` row)
- Modify: `app/src/modules/game/CLAUDE.md` (append a Visit points bullet after the Checkout bullet)
- Modify: `app/src/modules/training/CLAUDE.md` (line 12 bullet)
- Modify: `docs/architecture/00-File-Inventory.md` (new kernel row after `checkout-kernel.module.ts`; Score Threshold row)
- Modify: `docs/architecture/00-Context-Map-History.md` (append row)

- [ ] **Step 1: Apply the edits**

D501 (format as D500):

```
### D501 — The Visit points kernel folds visit totals into points; it grows only with its callers
Status: Accepted · Date: 2026-10-27
Decision: `visit-points-kernel.module.ts` folds one seat over turns: a turn's total is its dart sum, or its stored `totalScore` when dartless; a turn closes at `dartsPerVisit` darts or when dartless, and adds `points(total)`. `VisitPointsRules` carries only `dartsPerVisit` and `points`; goal, bust, void and compare settings land with the first game that needs each. Seat identity, duration and outcome stay in each engine. The shipped engines migrate Score Threshold → Score Training: Score Threshold fits the exercise shell unchanged; Score Training needs keypad-total input (`visitInput`) on the game shell, built to the Checkout spec §6 shape by whichever of Score Training and Ten Up One Down migrates first, and reused by the other.
Reason: the two shipped engines share only the visit walk; speccing settings no caller uses would fix a shape before any game tests it (D468 method).
Consequences: Score Threshold's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind. Score Training stays `PENDING` until PR 2. Spec: `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md`.
Supersedes: none.
```

Pattern 18 version line: prepend `1.11.18 (Pattern 18: Visit points kernel built; Score Threshold bound through `foldVisitPoints` on the exercise shell 2026-10-27, D501; prior 1.11.17: ` and turn the old `1.11.17 (` opener into `1.11.17: `.

Pattern 18 `VISIT_POINTS` row:

```
| `VISIT_POINTS` | points from a visit's darts; goal, bust, void, compare as callers need them | `modules/game/visit-points-kernel.module.ts` | built — Score Threshold bound through `foldVisitPoints` on the exercise shell (D501, 2026-10-27); Score Training pending |
```

`app/src/modules/game/CLAUDE.md`, new bullet after the Checkout one:

```
- A Visit points engine folds through `visit-points-kernel.module.ts` (`foldVisitPoints`) with a `VisitPointsRules` record (`dartsPerVisit`, `points(total)`) and projects the seat onto its own state; a goal, bust, void or compare setting lands with its first caller. (2026-10-27, D501)
```

`app/src/modules/training/CLAUDE.md` line 12: append at the end of that bullet: " Score Threshold folds through the Visit points kernel's `foldVisitPoints` (2026-10-27, D501)." The file list below it is unchanged (the kernel lives in `modules/game`).

`00-File-Inventory.md`:

```
| `app/src/modules/game/visit-points-kernel.module.ts` | Visit points rule kernel: `INITIAL_VISIT_POINTS_SEAT`, `applyVisitPointsTurn`, `foldVisitPoints` over visit totals (D501, 2026-10-27) | canonical |
```

Score Threshold row: replace "`ScoreThresholdEngine`/factory" with "`ScoreThresholdEngine`/factory, a `DartExerciseSpec` on the Visit points kernel and exercise shell (D501, 2026-10-27),".

`00-Context-Map-History.md` row:

```
| `visit-points-kernel.module.ts` (new), `score-threshold.engine.module.ts`, `modules/game/{types,interfaces}.ts`, their tests, `score-threshold.golden.test.ts`, `scripts/engine-kernels.txt`, `04-Architecture-patterns.md` (1.11.18), `modules/{game,training}/CLAUDE.md`, `00-File-Inventory.md`, `decisions/game-engine.md` (D501) | Visit points kernel built; Score Threshold bound to it and moved onto the exercise shell (goldens recorded pre-rebind, oracle). Visit points PR 1 (2026-10-27) | historical |
```

- [ ] **Step 2: Gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-decision-ids.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-doc-sync.sh
```

Expected: all OK.

- [ ] **Step 3: Commit**

```bash
git add decisions/game-engine.md docs/architecture/04-Architecture-patterns.md app/src/modules/game/CLAUDE.md \
  app/src/modules/training/CLAUDE.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md
git commit -m "docs: visit points kernel; Score Threshold bound (D501)"
```

---

### Task 6: Full verification and PR

- [ ] **Step 1:** `cd app && npm run format && npm run format:check`; commit any diff.
- [ ] **Step 2:** `run-all-gates` skill (Always + app sets). Without `DATABASE_URL`, run fallow, `npm test` and `npm run check` (0 errors, 0 warnings, 0 hints) directly and say the DB steps were skipped. Fallow: dead code clean (kernel has its caller); duplication not above `origin/main`'s.
- [ ] **Step 3:** `context-maintenance` skill.
- [ ] **Step 4:** Final whole-branch review per the chosen execution skill.
- [ ] **Step 5:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`: push, open the PR against `main`, subscribe to PR activity.
