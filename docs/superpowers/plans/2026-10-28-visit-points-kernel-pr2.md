# Visit Points Kernel PR 2 — Score Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Score Training onto the Visit points kernel and the game shell (`dart-engine-shell.module.ts`), no behaviour change, deleting its hand-written class.

**Architecture:** Score Training becomes a `DartGameSpec` (`PER_SEAT`, `coordinateCapture`, `visitInput`, `complete`) whose `fold` calls `foldVisitPoints` once per seat and projects each kernel seat onto the unchanged `ScoreTrainingSeatState`. TUOD (#1120-era PR 3) already landed `visitInput`, `complete`, `coordinateCapture`, whole-turn undo, the open-turn keypad refusal (via `visitInput.refusal(state, input, config, open)`) and `wouldComplete(state, input, config, open)`; none is rebuilt. One additive shell gap remains: a live open-visit `totalScore`. Proof as PR 1: legacy copy plus differential oracle, goldens recorded before the rebind, legacy deleted.

**Tech Stack:** TypeScript, Vitest; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (PR 2 row, §4, §5, §8). Prior plan: `…-visit-points-kernel-pr1.md` (#1120, merged).

## Global Constraints

- No behaviour change: `state()`, `facts()` (open-turn `totalScore` included), thrown messages, `ScoreTrainingState`/`ScoreTrainingSeatState` shape and key order, and exports `foldScoreTrainingState`, `ScoreTrainingEngine`, `scoreTrainingEngineFactory` identical in signature and result.
- `ScoreTrainingEngine` stays an exported class registered under `SCORE_TRAINING_V1`; `score-training-play.data.ts`, `session-context`, `session-progress`, `one-twenty-one.engine`, `switching.engine`, `lib/game/types.ts` name it.
- Persistence unchanged: `EXERCISE_BLOCK` stage `block-1`; one `turns` row per visit, one `darts` row per board dart, none for a keypad total; `QUICK_SCORE` keypad total (`number`) or per-dart `DETAILED_DARTS`/`VISUAL_BOARD`; free aim; no new fact columns.
- Reuse the kernel, `activeSeat`, `completedByIndex`, `durationSeatComplete`, `otherSeatsComplete`, `scoreCompareOutcome`, `openVisit`, `endedRefusal`; never re-declare a walk.
- The shell change is additive and optional: every bound engine's goldens and oracle (Track, Checkout, exercises, TUOD) re-run unchanged, no snapshot touched.
- `modules/game/**` never imports `modules/training/**`.
- No `//` comments in function bodies in `app/src/**`; JSDoc above declarations only, no decision history.
- Exported types in `types.ts`/`interfaces.ts` (`check-type-barrels.sh`, also pre-commit — the legacy copy too).
- TDD per `app/CLAUDE.md`. Never `--no-verify`; run slow commits in the background.
- Run `npm run format` before the PR is created.
- Branch `feat/visit-points-score-training`, cut from `origin/main`. One PR carrying this plan and the implementation.
- Decision entry only for the shell gap (Task 4); registry row `KERNEL_BOUND`.

## Rulings made while planning

- **Shell gap: `liveTotal?: boolean`.** Legacy `recordDart` sets `turn.totalScore = sumDartScores(turn.darts)` after every dart (#168), so an open visit's persisted `totalScore` is live. `coordinateCapture` leaves it unwritten (TUOD's legacy kept 0), so a spec flag restores it. The seat's `totalScore` itself comes from the kernel (`points + openTotal`), independent of the flag.
- **`isVisitOpen` reads the turn only:** `turn.completedAt === null && turn.darts.length < 3`. Keypad turns carry `completedAt`; a board turn is open until its third dart. No new state field.
- **Keypad refusal order stays legacy:** decided → open board visit → range. All in `visitInput.refusal`; spec-level `refusal` is the dart guard (decided, 1v1 only).
- **Messages:** dart guard `endedRefusal("match is complete")`; keypad strings verbatim from legacy.
- **Kernel seat per participant:** `foldVisitPoints(turns of that participantRef, rules)`, `rules = { dartsPerVisit: 3, points: (t) => t }`.
- **Accepted divergence (as PR 1):** a stored turn with `completedAt` set and fewer than 3 darts reads open on the legacy fold, closed on the kernel's dart count. The live engine never writes one. Recorded in the golden test header.
- **Solo MINUTES:** `complete` is `durationSeatComplete` on solo, `status !== "IN_PROGRESS"` otherwise; `refusal` stays `null` for solo, so the finishing visit after expiry is still accepted.

## Review Focus

1. Keypad total while a board visit is open: refused with the legacy message, log untouched. Pinned by oracle mixed input and an engine test.
2. Board dart straight after a keypad total opens a new turn; undo across both shapes pops the right unit. Pinned by oracle and golden trace.
3. Live open-visit `totalScore` in `facts()` after every dart and after an undo that reopens a visit. Pinned by oracle `facts()` equality (Task 1) and a shell test (Task 4).
4. 1v1 ROUNDS: decided refusal for both input kinds with different messages, `wouldComplete` false when decided, true only on the last seat's last visit, undo out of a decided match. Pinned by oracle 2-seat cases and golden.
5. Solo MINUTES: `expireTimer()` mid-visit, rehydrate re-expired, finishing visit accepted. Pinned by oracle `expireAt` + `resumeExpired`.
6. Out-of-range keypad totals (negative, fractional, above `maxVisitScore`) and null-coordinate board darts (miss). Pinned by generator invalid-total rate and `locationX: null`.

---

### Task 1: Freeze — legacy copy, mixed-input generator, oracle, goldens

**Files:**

- Create: `app/tests/modules/game/legacy/score-training.legacy.ts` (verbatim copy of `score-training.engine.module.ts`; strip the registry call, rename exports `LegacyScoreTrainingEngine`, `legacyFoldScoreTrainingState`)
- Create: `app/tests/modules/game/support/score-training-observations.ts`
- Create: `app/tests/modules/game/score-training.oracle.test.ts`
- Create: `app/tests/modules/game/score-training.golden.test.ts` (+ snapshot)

**Interfaces:**

- Consumes: `runOracle`, `goldenTrace`, `normalise`, `randomObservation`, `OracleEngine` (`support/engine-oracle.ts`); `located` and `OUTER_BULL_POINT` from `support/checkout-observations.ts` (export them, move nothing).
- Produces: `scoreTrainingInputs(visitRate: number): (rand, engine) => ScoreTrainingInput` — with probability `visitRate` a keypad total (valid, negative, fractional and above `maxVisitScore` alike), else a located board dart (misses unlocated).

- [ ] **Step 1:** Create the legacy copy; `check-type-barrels.sh` passes on it.
- [ ] **Step 2:** Write `scoreTrainingInputs` and the oracle test. Cases: 1 seat ROUNDS 6; 1 seat MINUTES 5 with `expireAt` 40 + `resumeExpired`; 2 seats ROUNDS 8; `maxVisitScore` 180 and 60. 15 seeds, 120 steps, `rehydrateEvery` 7, `visitRate` 0.3. Compare also `facts()` (the harness already does).
- [ ] **Step 3:** Run it against the legacy as both sides: PASS (harness sanity).
- [ ] **Step 4:** Write `score-training.golden.test.ts` against the current `ScoreTrainingEngine`: fake system time `2026-11-01T10:00:00Z`; one `goldenTrace` for solo ROUNDS, solo MINUTES with expiry, duel ROUNDS; plus one 400-step mixed duel `{ facts, state }` snapshot as in `tuod.golden.test.ts`. Header comment names the accepted divergence above. Run: snapshots written.
- [ ] **Step 5:** Commit `test(score-training): freeze legacy engine, oracle with mixed input, goldens`.

### Task 2: Shell gap `liveTotal` — test first

**Files:**

- Modify: `app/src/modules/game/interfaces.ts` (`DartGameSpec`: `readonly liveTotal?: boolean`)
- Modify: `app/src/modules/game/dart-engine-shell.module.ts` (`recordDart`: after the dart is appended, `if (spec.liveTotal) turn.totalScore = sumDartScores(turn.darts)`; extend the class doc)
- Test: `app/tests/modules/game/dart-engine-shell.test.ts` (locate the existing shell test file; add there)

**Interfaces:**

- Produces: `DartGameSpec.liveTotal?: boolean` — with `coordinateCapture`, the open turn's `totalScore` is the dart-score sum after every dart. `closedVisitTotal` still overrides at close.

- [ ] **Step 1:** Failing tests: a `liveTotal` spec shows `facts().turns[0].totalScore` equal to the dart sum after dart 1 and dart 2; a spec without it keeps `0`; undo reopening a visit keeps the sum of the remaining darts' written total unchanged (pins the legacy quirk: undo does not rewrite it — assert the legacy value by reading it from `LegacyScoreTrainingEngine`).
- [ ] **Step 2:** Run: FAIL.
- [ ] **Step 3:** Implement `liveTotal` as above.
- [ ] **Step 4:** Run the shell, TUOD, Checkout, exercise and Track oracle/golden suites: PASS, no snapshot diff.
- [ ] **Step 5:** Commit `feat(game): shell liveTotal — open turn total tracks its darts`.

### Task 3: Rebind Score Training onto the kernel and the shell

**Files:**

- Modify: `app/src/modules/game/score-training.engine.module.ts` (rewrite)
- Test: `app/tests/modules/game/score-training.engine.module.test.ts` (existing; passes unchanged, plus the two below)

**Interfaces:**

- Consumes: `foldVisitPoints(turns, rules)` and `VisitPointsSeat`; `dartGameEngineClass`, `dartGameEngineFactory`; `DartGameSpec<Seated<ScoreTrainingSnapshot>, ScoreTrainingState, number>`.
- Produces: unchanged exports `foldScoreTrainingState(facts, config, timerExpired)`, `ScoreTrainingEngine`, `scoreTrainingEngineFactory`.

- [ ] **Step 1:** Add failing tests: "is built on the game shell" (`instanceof` the class from `dartGameEngineClass`, as the PR 1 test does for the exercise shell); "keypad refusal order: decided, then open board visit, then range" with the legacy messages.
- [ ] **Step 2:** Run: first FAILS, second passes on legacy (record it).
- [ ] **Step 3:** Rewrite to a `DartGameSpec`: `rulesetVersionKey: "SCORE_TRAINING_V1"`, `stageOwnership: "PER_SEAT"`, `coordinateCapture: true`, `liveTotal: true`, `intent: () => NO_INTENT`, `refusal` (decided, 1v1) with `endedRefusal("match is complete")`, `isVisitOpen` as ruled, `visitInput { isVisit: typeof input === "number", refusal, total: (_, input) => input }`, `wouldComplete(state, input, config, open)` ported from the legacy (dart: `open?.darts.length === 2`; keypad: playable and no open turn; then the duration/other-seats test), `complete` as ruled, `fold` = per-seat `foldVisitPoints` projected to `{ participantRef, sideKey, turnCount: visits, totalScore: points + openTotal }` then the unchanged `scoreCompareOutcome`/`activeSeat` tail. `ScoreTrainingEngine extends dartGameEngineClass(spec)`; factory from `dartGameEngineFactory`; `registerEngineFactory`.
- [ ] **Step 4:** Run: oracle, goldens (no snapshot diff), engine tests, `score-training-play` tests: PASS.
- [ ] **Step 5:** Commit `refactor(score-training): bind to the visit points kernel and the game shell`.

### Task 4: Delete legacy, flip registry, docs, gates

**Files:**

- Delete: `app/tests/modules/game/legacy/score-training.legacy.ts`, `score-training.oracle.test.ts`
- Modify: `scripts/engine-kernels.txt` (Score Training → `KERNEL_BOUND`)
- Modify: `decisions/game-engine.md` (append: the shell `liveTotal` gap; next free `D5xx` after checking the file)
- Modify: `docs/architecture/04-Architecture-patterns.md` (version bump; `VISIT_POINTS` callers), `app/src/modules/game/CLAUDE.md` (Visit points bullet, `liveTotal`), `docs/architecture/00-File-Inventory.md` (Score Training row; shell row), `docs/architecture/00-Context-Map-History.md`
- Modify: `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (§4 PR 2: TUOD supplied the shell gaps; record `liveTotal`)

- [ ] **Step 1:** Delete the legacy copy and oracle (goldens keep the guarantee).
- [ ] **Step 2:** Flip the registry row; docs and decision edits by targeted edits.
- [ ] **Step 3:** Gates: `npm test`, `npm run check` (0 hints), fallow (duplication must not rise), all `check-*.sh` including `check-engine-kernels.sh`, `check-test-coverage.sh`, `npm run format:check`. Run `context-maintenance`.
- [ ] **Step 4:** Commit `docs: Score Training bound to the visit points kernel`.
- [ ] **Step 5:** Final whole-branch review (fresh reviewer re-runs the oracle at the pre-delete commit), `npm run format`, push, open PR.

## Self-review

- Spec PR 2 table: dart refusal, keypad refusal, open-visit guard, `isComplete`, `wouldComplete`, undo, per-spec dart append — all covered by existing shell hooks (TUOD) or Task 2/3. Gaps listed in the spec as "to build" are already on `main`.
- Names consistent: `liveTotal`, `scoreTrainingInputs`, `LegacyScoreTrainingEngine`.
- Discovered quirk (an undo that reopens a visit leaves its written total unchanged) is pinned, not fixed; file as `discovered-work` in Task 4 if the probe confirms it.
