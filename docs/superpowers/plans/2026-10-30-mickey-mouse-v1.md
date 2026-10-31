# Mickey Mouse V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `MICKEY_MOUSE_V1`: a solo closing race over twelve categories (20–12, Doubles, Triples, Bull) on the Marks kernel, with double-dip.

**Architecture:** The Marks kernel gains one optional rule, `dipOf`, a second mark a dart earns on another objective. Mickey Mouse is a `MarksRules` record plus a `marksGameSpec` on the game shell, a one-seat engine like Tactics V1. Two PRs, as Killer: PR 1 is engine, validator, registries, seed; PR 2 is the screens.

**Tech Stack:** TypeScript, Zod, Astro, Alpine.js, Vitest, PostgreSQL seeds.

**Spec:** `docs/game-rules/rulesets/mickey-mouse.md` (the rules input; no design doc — the calls below stand in for one and are the owner's to veto). Kernel precedent: `docs/superpowers/specs/2026-10-28-marks-kernel-design.md` (M4: a kernel feature lands with its first caller).

Branches `feat/mickey-mouse-engine` (Tasks 1–6), then `feat/mickey-mouse-screens` (Tasks 7–9). Run app commands from `app/`; tests by path (`npx vitest run <path>`). Match the surrounding code: JSDoc on exports, no `//` comments in function bodies, exported types in `types.ts` files, TDD per `app/CLAUDE.md`.

## Calls made (not in the rules doc)

| # | Call | Why |
| --- | --- | --- |
| C1 | A double or treble on a number already closed still marks Doubles or Triples | The rules doc's open question; the source says a dart "can count toward more than one category simultaneously" and Doubles is "any double ring on 1–20". Closing a number never switches a ring category off. |
| C2 | A double or treble on 1–11 marks only Doubles or Triples | No number objective to dip into. |
| C3 | Category order on the board: `20…12, Doubles, Triples, Bull` | The rules doc's own list order. |
| C4 | A closing dart's overflow marks on a category are dropped, as on numbers | "Marks past three are lost." |
| C5 | The kernel's `dipOf` applies in the duel path too; points and `spare` come from the primary hit only | One tally serves both paths. Scored Mickey Mouse (V2+) revisits it when the rules for a scoring dip are written. |
| C6 | Keep Mickey Mouse its own ruleset, not a Tactics variant | The rules doc's second open question; the objective set, double-dip and no points differ. |

## Global Constraints

- Ruleset key `MICKEY_MOUSE_V1`; game type key `MICKEY_MOUSE`; route slug `mickey-mouse`; code slug `mickey-mouse`; label `Mickey Mouse`; Alpine data names `mickeyMouseSetup`, `mickeyMousePlay`.
- Objectives, display order: `20, 19, 18, 17, 16, 15, 14, 13, 12, "DOUBLES", "TRIPLES", BULL` (twelve). Engine constant, never config.
- Marks: number 12–20 single 1 / double 2 / treble 3; outer bull 1, inner bull 2. A double or treble on 1–20 also marks Doubles or Triples by 1 (the dip). The bull never marks Doubles. A single and a miss mark nothing else. Cap 3; overflow lost. No points anywhere (`valueOf` is `null` for every objective).
- Mode pairs: `RECREATIONAL`+`DETAILED_DARTS`, `ANALYTICS`+`VISUAL_BOARD`. Stats tags `["board"]`.
- Persistence (engine-only rule): capture `DETAILED_DARTS` / `VISUAL_BOARD`; one `EXERCISE_BLOCK` stage per seat for the whole game (`PER_SEAT`); one `turns` row per visit of up to three `darts` rows; `intendedTargetNumber` and `intendedZoneKey` both `null`; `score` = the dart's board score. Marks, closures, darts-to-close are derived on read, never stored.
- One seat only: no `SEAT_CAPS` entry, no `RULESET_DARTBOT` entry.
- Seeds only; applied migrations `0001`–`0046` untouched.
- `MickeyMouseConfig` is `z.object({}).strict()`; preset configuration `{}`.
- Cricket's and Tactics' behaviour, public exports and tests do not change; their goldens stay byte-identical.

## Review Focus

1. A treble 20 on an open 20 gives 20 three marks and Triples one, in one dart; undo reverses both. (Task 3.)
2. A double 20 with 20 already closed marks Doubles +1 and loses the number's marks (C1, C4). (Task 3.)
3. A double on 7 marks Doubles only; a single 7 marks nothing; outer and inner bull mark the bull alone, never Doubles. (Task 3.)
4. The dart that closes the last open objective ends the run on dart 1, 2 or 3 of a visit; undoing it reopens the visit. (Task 3.)
5. A dip that closes two objectives on one dart records both in `closedAtDart`, and replay from `prior` equals live recording. (Tasks 2–3.)
6. A `MarksRules` with no `dipOf` behaves exactly as before: Cricket and Tactics goldens unchanged. (Task 2.)
7. A recreational D7 tap stores `hitTargetNumber: 7, hitZoneKey: "DOUBLE"` — a true fact, not a miss. (Task 7.)

---

## PR 1 — engine, validator, registries, seed

### Task 1: Rules doc and decision

**Files:** `docs/game-rules/rulesets/mickey-mouse.md`, `decisions/game-engine.md`.

**Interfaces:** Produces the decision id used in later commits and docs: next free after D506 (`grep -n '^### D5' decisions/game-engine.md | tail -3`); this plan calls it `D-MM`.

- [ ] **Step 1:** In `mickey-mouse.md`, resolve both Open questions with C1 and C6, move them out of `## Open questions` into the Marks and Identity prose, and keep every V2+ row as it is. Leave `Current version:` unchanged until Task 6.
- [ ] **Step 2:** Append `D-MM` to `decisions/game-engine.md`: C1–C6, and that the kernel gains `dipOf`. Do not edit any existing block.
- [ ] **Step 3:** `bash ../scripts/check-game-rules.sh` and `bash ../scripts/check-decision-ids.sh` → pass.
- [ ] **Step 4: Commit** — `docs(mickey-mouse): settle open questions, decision for dip`.

### Task 2: Kernel — `dipOf`

**Files:** Modify `app/src/modules/game/types.ts` (`MarksRules`), `marks-close.module.ts` (`tallyMarksDart`, `applyMarksDart`), `marks-kernel.module.ts` (`soloDart`, `applyDuelDart`); test `app/tests/modules/game/marks-kernel.module.test.ts`, `marks-close.module.test.ts`.

**Interfaces:**
- Produces: `MarksRules.dipOf?: (seat: TSeat, observation: DartObservation) => MarksHit`; `tallyMarksDart(state, hit, dip?: MarksHit): MarksTally` and `applyMarksDart(state, hit, dip?: MarksHit): MarksSeatState`, `dip` defaulting to `null`. `spare` and the `trebleHits` tally come from `hit` only.

- [ ] **Step 1: Failing tests** in `marks-close.module.test.ts`:
  - `tallyMarksDart` with `hit {0,3}` and `dip {1,1}` → `marks[0]===3`, `marks[1]===1`, `objectiveHits` +1 on both, `trebleHits` +1, `dartsThrown` +1 once, `spare` 0.
  - A `hit` and a `dip` that both close an objective → `closedAtDart` set for both at the same dart.
  - `dip` omitted → result equals today's for the same `hit` (parametrised over a few hits).
  - `applyMarksDart` ends the seat COMPLETE when the dip closes the last open objective.
- [ ] **Step 2: Failing kernel test** in `marks-kernel.module.test.ts`: rules with a `dipOf`; a solo `foldMarks` applies hit and dip; a 1v1 `foldMarksDuel` applies them with `valueOf` `null` and scores nothing; rules without `dipOf` fold as before. Run both files → FAIL.
- [ ] **Step 3: Implement** — thread `dip` through `tallyMarksDart` (second objective update after the first, same cap rule), `applyMarksDart`, `soloDart` (`rules.dipOf?.(seat, observation) ?? null`) and `applyDuelDart`. Add the optional field to `MarksRules` with a one-line JSDoc. `marksWouldComplete` needs no change (it calls the same helpers); add one test that it sees a dip-completing dart.
- [ ] **Step 4: Run** — `npx vitest run tests/modules/game` → PASS, `cricket.golden` and `tactics.golden` unedited and green; `npm run check` → 0/0/0.
- [ ] **Step 5: Commit** — `feat(marks): optional dipOf — a dart's second mark`.

### Task 3: Mickey Mouse engine

**Files:** Create `app/src/modules/game/mickey-mouse.engine.module.ts`; modify `modules/game/types.ts`, `scripts/engine-kernels.txt`; test `app/tests/modules/game/mickey-mouse.engine.module.test.ts`.

**Interfaces:**
- Consumes: Task 2's `dipOf`; `marksGameSpec`, `foldMarks`, `dartGameEngineClass`, `dartGameEngineFactory`, `registerEngineFactory`, `BULL_TARGET_NUMBER`, `NUMBER_RING_MARKS`, `BULL_RING_MARKS`.
- Produces (all exported, JSDoc'd): `MICKEY_MOUSE_OBJECTIVES: readonly MickeyMouseObjective[]`; `type MickeyMouseObjective = number | "DOUBLES" | "TRIPLES"` and `MickeyMouseSeatState`, `MickeyMouseState`, `MickeyMouseSnapshot` in `types.ts` (state types alias `MarksDuelSeat` / `MarksGameState` as Tactics does); `mickeyMouseMarksOf(observation): MarksHit`; `mickeyMouseDipOf(observation): MarksHit`; `isMickeyMouseTarget(observation): boolean`; `MICKEY_MOUSE_RULES`; `initialMickeyMouseState(config)`; `foldMickeyMouseState(facts, config)`; class `MickeyMouseEngine`; `mickeyMouseEngineFactory`.

- [ ] **Step 1: Failing engine tests** (`Seated<MickeyMouseSnapshot>` with one seat; build visits with the shared test helpers Tactics' test uses):
  - `mickeyMouseMarksOf`/`DipOf` table: T20 → hit `{0,3}`, dip `{10,1}` (Triples); D20 → `{0,2}`, dip `{9,1}` (Doubles); S20 → `{0,1}`, no dip; D7 → hit `{9,1}`, no dip; T7 → hit `{10,1}`, no dip; (indexes: 20…12 are 0–8, Doubles 9, Triples 10, Bull 11); S7 and miss → both `null`; outer bull → bull 1; inner bull → bull 2, never Doubles, with any `hitTargetNumber`.
  - Review Focus 1–5 as engine-level tests: T20 on open 20; D20 on closed 20; close-out on dart 1, 2 and 3 of a visit with undo reopening it; dip-closing two objectives on one dart.
  - Rehydration: folding from `prior` equals live recording across a seeded `randomObservation` run (`support/engine-oracle.ts`, `marksObservation`).
  - Refusal: a dart after COMPLETE throws "game has ended"; a factory for `TACTICS_V1` throws "is not served by this spec".
  - `isMickeyMouseTarget`: true for T7, false for S7.
- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement** the module. `hitOf(seat, opponent, observation)` ignores `seat` and `opponent` and returns `mickeyMouseMarksOf(observation)`; `dipOf` returns `mickeyMouseDipOf`; `valueOf` returns `null`. Primary hit: bull ring → bull; number 12–20 → that number with its ring marks; otherwise a double/treble on 1–20 → its category by 1. Dip: a double/treble on 12–20 → its category by 1. Spec: `marksGameSpec({ rulesetVersionKey: "MICKEY_MOUSE_V1", rulesetVersionKeys: [], rules })`. Register the factory.
- [ ] **Step 4: Registry row** — add `app/src/modules/game/mickey-mouse.engine.module.ts | MARKS | KERNEL_BOUND | docs/game-rules/rulesets/mickey-mouse.md |` to `scripts/engine-kernels.txt`.
- [ ] **Step 5: Run** — `npx vitest run tests/modules/game` → PASS; `bash ../scripts/check-engine-kernels.sh` → pass. (`check-game-engines.sh` waits for Task 4.)
- [ ] **Step 6: Commit (Tasks 3 + 4)** — held for Task 4: the registry gate rejects an engine without its validator.

### Task 4: Validator, config, capabilities and registries

**Files:** mirror Killer's `b4b4215` list for a one-seat game, with Tactics' values: `services/rulesets/mickey-mouse/mickey-mouse.validator.ts`, `services/rulesets/registry.ts`, `lib/game/rulesets/types.ts` (`MickeyMouseConfig`, key union, config map, the conditional on ~line 780), `lib/game/rulesets/capabilities.ts` (mode pairs, stats tags, game type), `modules/game/session-progress.module.ts` (`SUMMARIZERS`), `lib/stats/constants.ts`, `lib/stats/section-registry.ts` (`MICKEY_MOUSE: null`), `lib/stats/replay-fold.ts` (engine import), `lib/stats/replay-presenters.ts`; tests beside each.

- [ ] **Step 1: Failing tests** — copy `tests/services/rulesets/tactics/tactics.validator.test.ts` with renames (`tactics`→`mickey-mouse`, `TACTICS_V1`→`MICKEY_MOUSE_V1`); add: a D7 dart (`hit_target_number` 7, `DOUBLE`, score 14) is accepted; a T20 dart is accepted. Extend `capabilities.test.ts`, `capability-validator-parity.test.ts`, `types.test.ts` (strict empty config rejects extra keys), `section-registry.test.ts`, `replay-presenters.test.ts` (a visit closing 20 shows `Marks` and `Closed 1/12`; a T20 shows Triples +1), `session-progress` summarizer test. Run → FAIL.
- [ ] **Step 2: Implement** — `createThreeDartValidator({ label: "Mickey Mouse", configSchema: MickeyMouseConfig, dartlessIssue })`, copying Tactics' wording. One line per registry beside Tactics': `MICKEY_MOUSE_V1: mickeyMouseValidator`; `[DETAILED_DARTS, VISUAL_BOARD]`; `["board"]`; `"MICKEY_MOUSE"`; `"MICKEY_MOUSE_V1"` in `constants.ts`; the replay presenter copied from `tactics`' with `MICKEY_MOUSE_OBJECTIVES`; a summarizer copied from `tactics`.
- [ ] **Step 3: Run** — `npx vitest run tests/services/rulesets tests/lib tests/modules/game` → PASS; `npm run check` → 0; `bash ../scripts/check-game-engines.sh && bash ../scripts/check-game-wiring.sh` → pass (an engine-only ruleset has no card and no pages).
- [ ] **Step 4: Commit (Tasks 3 + 4)** — `feat(mickey-mouse): MICKEY_MOUSE_V1 engine, validator and registries`.

### Task 5: Seeds

**Files:** `database/seeds/0055_mickey_mouse_game_engine_reference.sql`, `database/verification/0055_mickey_mouse_capability_checks.sql`, `seeds/0007_ruleset_version_capabilities.sql`, `verification/0007_capability_seed_checks.sql`, `database/README.md`.

- [ ] **Step 1: Seed `0055`** — copy `0054` (Killer) with `KILLER`→`MICKEY_MOUSE`, drop its lives config, template configuration `{}`. New ids: the next unused in each range (`grep -rhoE '0198f[013]00-0000-7000-8000-[0-9a-f]{12}' database/seeds | sort -u`); expected game type `0198f000-…-00e`, ruleset `0198f100-…-025`, template `0198f300-…-01c`. Confirm each appears exactly once.
- [ ] **Step 2: `0007` ledger** — append the `MICKEY_MOUSE_V1` capability rows after Killer's; update the counts and `format(...)` messages in `0007_capability_seed_checks.sql` as Killer's commit did.
- [ ] **Step 3: `0055` verification** — copy `0054_killer_capability_checks.sql`, `KILLER`→`MICKEY_MOUSE`.
- [ ] **Step 4: README** — add the seed under `## Seed Order`.
- [ ] **Step 5: Check** — `npm test -- capability`; `bash ../scripts/check-context-map.sh`. With `DATABASE_URL`: `npm run db:seed && npm run db:verify 0055 && npm run db:verify 0007` → PASS. Without it, say so in the report; CI `rehearse` runs them.
- [ ] **Step 6: Commit** — `feat(mickey-mouse): seed MICKEY_MOUSE game type, ruleset and capabilities`.

### Task 6: Docs, tags, gates, PR 1

- [ ] **Step 1:** `mickey-mouse.md` — `Current version: V1 (engine only)` in the form Killer's PR 1 used (`git show b4b4215 -- docs/game-rules/rulesets/killer.md`); add `Card ruleset: MICKEY_MOUSE_V1`.
- [ ] **Step 2:** `npm run tags:generate`; commit the regenerated `0042_catalog_tags.sql` only if it changes; `bash ../scripts/check-tag-seeds.sh` → pass.
- [ ] **Step 3:** `context-maintenance` skill: `modules/game/CLAUDE.md` Marks line gains `dipOf` and Mickey Mouse; Pattern 18 version bump; File Inventory rows (engine, validator, seed, verification, plan); `06-API/04-Endpoint-Contracts.md` if it lists ruleset keys; Context-Map-History entry and Task Records row; the 04 version line per its own rule (replace, move the outgoing version into the history section).
- [ ] **Step 4:** `run-all-gates`, `validate-app`; `cd app && npm run format`.
- [ ] **Step 5:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push + PR).

---

## PR 2 — screens (branch after PR 1 lands)

### Task 7: Play controller and recreational input

**Files:** `lib/game/types.ts`, `lib/game/mickey-mouse-play.data.ts`, `components/layout/games/MickeyMouseRecreationalInput.astro`; test `tests/lib/game/mickey-mouse-play.data.test.ts`.

**Interfaces — produces:** `mickeyMousePlay()`, `MickeyMousePlayContext`, `MickeyMouseResultsSnapshot`, `MickeyMouseObjectiveRow`, `mickeyMouseTapObservation(target, ring)`.

- [ ] **Step 1: Types** — copy Tactics' play types with renames; `MickeyMouseObjectiveRow = MarksObjectiveRow<MickeyMouseObjective>`.
- [ ] **Step 2: Failing test** — copy `tactics-play.data.test.ts`, rename, then add:
  - `tapTargets()` with ring `SINGLE` → 20…12, Bull (10 entries); with `DOUBLE`/`TREBLE` → those plus 11…1 (21);
  - `mickeyMouseTapObservation(7, "DOUBLE")` → `{ hitTargetNumber: 7, hitZoneKey: "DOUBLE", … }`; Bull + `TREBLE` throws;
  - `objectiveRows()` labels `20 … 12, Doubles, Triples, Bull`;
  - preview: D7 "hit", S7 "miss";
  - results: darts thrown and darts to close for all twelve.
  Run → FAIL.
- [ ] **Step 3: Implement** `mickey-mouse-play.data.ts` by copying `tactics-play.data.ts`; objectives from `MICKEY_MOUSE_OBJECTIVES`; preview uses `isMickeyMouseTarget`; `RESUMABLE` is `MICKEY_MOUSE_V1` only.
- [ ] **Step 4: `MickeyMouseRecreationalInput.astro`** — copy `TacticsRecreationalInput.astro`; grid iterates `tapTargets()`.
- [ ] **Step 5: Run** — PASS. No commit (wiring lands in Task 8).

### Task 8: Setup, pages, interface, results, card

**Files:** `lib/game/mickey-mouse-setup.data.ts`, `components/layout/games/{setup/MickeyMouseSetupForm,interfaces/MickeyMouse,result-modals/MickeyMouseResults}.astro`, `pages/games/mickey-mouse/{setup,play}/index.astro`, `lib/client/alpine/register-route-data.ts`, `lib/game/rulesets/games-visibility.ts`, `07-Frontend/08-Component-Inventory.md`; tests `mickey-mouse-setup.data.test.ts`, `register-route-data.test.ts`, `games-visibility.test.ts`.

- [ ] **Step 1: Failing tests** — copy `tactics-setup.data.test.ts` with renames (always `MICKEY_MOUSE_V1`; no guest branch); `games-visibility.test.ts` adds `"MICKEY_MOUSE_V1"` after `"TACTICS_V1"`; `register-route-data.test.ts` mirrors Tactics' lines. Run → FAIL.
- [ ] **Step 2: Setup controller + form** — `createPresetSetupController({ gameTypeKey: "MICKEY_MOUSE", rulesetVersionKey: "MICKEY_MOUSE_V1", playHref: "/games/mickey-mouse/play", label: "Mickey Mouse" })`; form rows Players = 1, Categories = 20–12, Doubles, Triples, Bull, Scoring = No points — all locked.
- [ ] **Step 3: Interface, results, pages, wiring** — copy Tactics', swap input; `Alpine.data("mickeyMouseSetup", …)` and `("mickeyMousePlay", …)`; card after Tactics: `title: "Mickey Mouse"`, `caption: "Close 20 to 12, doubles, trebles and the bull."`, `href: "/games/mickey-mouse/setup"`. Results show darts thrown and darts to close per category.
- [ ] **Step 4: Run** — `npx vitest run tests/lib` → PASS; `npm run check` → 0; `bash ../scripts/check-game-wiring.sh && bash ../scripts/check-game-engines.sh` → pass.
- [ ] **Step 5: Manual check** — `run` skill: `/games` → Mickey Mouse, both app modes; T20 (20 closed, Triples 1), D20 (Doubles 1), D7, bull; close out, undo, close again; results list darts per category. Screenshot play and results.
- [ ] **Step 6: Commit (Tasks 7 + 8)** — `feat(mickey-mouse): setup, play and results screens`.

### Task 9: Close out

- [ ] **Step 1:** `mickey-mouse.md` `Current version: V1`; re-run `npm run tags:generate` and `check-tag-seeds.sh`.
- [ ] **Step 2:** `context-maintenance` (Component Inventory row, File Inventory, history, version lines), `run-all-gates`, `validate-app`, `npm run format`.
- [ ] **Step 3:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push + PR).

## Not in this plan

Multiplayer and Scored Mickey Mouse (V2+, need a `SEAT_CAPS` entry and the kernel's scoring-dip rules), Extended Range, DartBot, teams. Each stays a Deferred or V2+ row in the rules doc.
