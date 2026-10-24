# Cricket V2 (CRICKET_V2) — 1v1 — Design

Date: 2026-10-24. Rules: `docs/game-rules/rulesets/cricket.md` (1v1 rows `V2`, amended 2026-10-24). Precedent, read first: `docs/superpowers/specs/2026-10-23-tactics-v2-design.md` — this spec is its delta. V1 design: `docs/superpowers/specs/2026-10-06-cricket-v1-design.md`.

## 1. Intent

Cricket V1 is a solo close-out drill (D421). V2 adds two-seat play: points on owned numbers, dead numbers and a win by closing out level or ahead. Solo stays on `CRICKET_V1`.

Locked with the user (2026-10-24):

- Scope is Classic 1v1 only. Cut-throat, No-Score, Single-Only and every other variant stay V2+ (reasons in `cricket.md`).
- Opponent is a guest. DartBot is deferred: no DartBot strategy can aim at an objective (`app/src/modules/dartbot/strategy/` holds dictated, scoring and x01 only), so a marks strategy, its level calibration and tests come first. This overrides the user's earlier "Guest and DartBot" answer, which was given before that was known; it is stated in the completion report for the user to veto.
- A new ruleset version `CRICKET_V2` beside the untouched `CRICKET_V1`.
- Excess marks score (marks × value) while the opponent has the number open, as Tactics V2.
- The seat switch uses the 501 animation by reusing the 501 shell, as Tactics V2.
- No duplicated code: `foldMarksDuel` is reused and nothing is copied from Tactics. Where Cricket would repeat Tactics code (engine class body, fold branches, factories, row/accessor/title helpers, play screen, replay presenter), the code moves once into shared kernel or `lib/game` modules and Tactics is refactored onto it (plan Tasks 2-4).

## 2. Classification

Execution model: game. Entry points: standalone. Kernel: MARKS. Additive and seat-conditional (`1v1`), `V2`; V1 is shipped so the cut test is not re-run. No shipped rule changes (V1 sessions never have two seats). One decision block in `decisions/game-engine.md` (next id from `scripts/next-decision-id.sh`) records the vehicle and that the duel fold is now shared by two engines.

## 3. Rules recap (authority: `cricket.md`)

- Marks: single 1, double 2, treble 3 on 20–15; outer bull 1, inner bull 2; three close. Unchanged.
- Points: spare marks × the number's value (bull 25 a mark) while the opponent has not closed it. Dead numbers score nothing. Nothing else scores.
- Win: the first dart that leaves the throwing seat closed out with points ≥ the opponent's ends the game, mid-visit. A closed-out seat that is behind keeps throwing.

## 4. Capture and state

- Capture/input, intended fact, stage type: unchanged from V1 (intent null; one `EXERCISE_BLOCK`; `score` the dart's board score).
- Nothing new is stored; no migration. Points, dead numbers, closed-out status and the winner are folded from both seats' dart facts in log order.
- `CricketSeatState` becomes `MarksSeatState & { points: number }` (always 0 solo). `CricketState` gains `winnerParticipantRef: string | null`. Seat `COMPLETE` keeps meaning closed out; game status is `COMPLETE` when solo's seat is closed out, or in 1v1 when the winner is set.

## 5. Engine

`CricketEngine` takes a `rulesetVersionKey` constructor parameter (`"CRICKET_V1" | "CRICKET_V2"`) and a second `cricketV2EngineFactory`, the `TacticsEngine` pattern. The class body is a `MarksEngine` base shared with Tactics (`marks-engine.module.ts`); the fold is `foldMarksSeats`.

- `foldCricketState` branches on seat count: one seat → existing path unchanged; two seats → `foldMarksDuel(turns, [a, b], CRICKET_DUEL)`.
- `CRICKET_DUEL = { initialSeat, hitOf: (_seat, _opponent, observation) => cricketMarksOf(observation), valueOf: (index) => CRICKET_OBJECTIVES[index] }`. Cricket's marks do not depend on either seat, which is the simple case the shared module was built for.
- `record` passes `(state) => state.status === "COMPLETE"` as `isEnded`; `wouldComplete` forks the engine in a try, both seat counts. Both live in the `MarksEngine` base; the existing `activeSeatState`-based `wouldComplete` is replaced, not kept beside it.
- The seat rota needs no change (proved for Tactics; a Cricket test pins it).
- Dead-number and win logic live in `marks-duel.module.ts` already; this task adds no code there.

## 6. Registration

One commit with the validator (`check-game-engines.sh`): `rulesets/types.ts` (key union, `RULESET_CONFIGS.CRICKET_V2 = CricketConfig`, `ConfigSnapshotFor`), `services/rulesets/registry.ts` (shared builder), `session-seats.service.ts` (`CRICKET_V2: 2`), `capabilities.ts` (capabilities, `["board"]`, game type `CRICKET`; **no** `RULESET_DARTBOT` entry), `session-progress.module.ts` (detail `1v1 · 7 objectives`; solo keeps V1's text), `games-visibility.ts`, resume-deck map `GAME_TYPE_BY_RULESET.CRICKET_V2` (pinned by a test), `lib/stats/constants.ts`, `scripts/engine-kernels.txt` unchanged (same engine file). Seed `0052_cricket_v2_ruleset.sql` (id next free, verified at execution, `ON CONFLICT DO NOTHING`, no template), triple into `0007` and its verification file, `database/README.md` seed row (the `seed.test.ts` lesson from Tactics V2).

## 7. Setup and play

- `cricket-setup.data.ts`: `rulesetVersionKey: (ctx) => ctx.guests.length > 0 ? "CRICKET_V2" : "CRICKET_V1"`. Cricket uses `createPresetSetupController`; the plan must confirm it takes a function key and `allowGuests` like Tactics' controller, and extend the controller if not. Setup form gains `<UserSection allowGuests />` (the Tactics V2 review's critical lesson: 1v1 unreachable without it) and the 1v1 copy. No DartBot control.
- `interfaces/Cricket.astro` becomes `SeatedPlayScreen` with `MarkRows slot="rows" rowsExpr="objectiveRowsFor(rowsRef)"`, big value `dartsThrown` solo / `points` per seat, idle tile `Closed`; this is the Tactics wiring with `CricketRecreationalInput`.
- `cricket-play.data.ts`: `objectiveRowsFor`, `dartsThrownFor`, `pointsFor`, `closedCountFor` accessors, with `duelFlags` reuse for the scoring/dead row flags (extract to a shared helper if the Tactics one is not importable — checked by fallow dupes, not copied); `subtitle` `1V1 · 7 OBJECTIVES`; `resumeEngine` accepts both keys; `playAgain` uses the session's key; `resultsTitle` solo "Closed out!", 1v1 "<name> wins!"; `computeStats` sets `winningSideKey`.
- Results: `CricketSeatResult` gains `points`; `winningSideKey: string | null`; `CricketResults.astro` renders `ComparisonSummary` for two seats and keeps the solo summary.
- Replay (`replay-presenters.ts`): Cricket turn cells add `Points` and the session line shows points for two seats.

## 8. Stats

No new view. The Cricket statistics section stays V2+. Derived-aims stays a no-op for intent-less darts; a test asserts the duel fold does not break it.

## 9. Testing (TDD, failing test first) and no-duplicates gate

1. Fold: scoring on an owned, opponent-open number; excess marks on the closing dart; dead number; bull at 25 a mark; non-objective darts do nothing.
2. Win: level close-out wins mid-visit; behind keeps throwing; later close-out ahead wins; dart after the win refused; undo past the winning dart reopens.
3. Differential: every V1 solo golden folds byte-identically save the added `points: 0`.
4. Validator, registry, seat cap, capability, session-progress, resume-deck, parity tests gain V2; `RULESET_DARTBOT` has no `CRICKET_V2` (test).
5. Setup: guest → V2, solo → V1.
6. Play data: both keys resume; results title per outcome; opponent rows and idle stat.
7. Replay-fold and derived-aims for two seats; seed verification (count 42 → 43 from the file at execution).
8. **Dupes:** record `npx fallow dupes --mode semantic --min-tokens 30` before Task 1 and compare per task; any new clone group in the engine, the data file, the shell or `marks-duel.module.ts` blocks the task. Fallow health (CRAP ≤ 30, cyclomatic ≤ 20) runs on every task.
9. Visual check (Playwright, mocked API, 390×844): both seats in turn, the switch animation, seven rows in the 40% band.

## 10. Out of scope

DartBot (blocked, §1); more than two seats; every variant in `cricket.md` §Variants; a Cricket statistics section; any change to V1 config, V1 solo behaviour, existing seeds or migrations.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| V2 leaks into V1 solo | Seat-count branch keeps the V1 path; V1 cap stays 1; differential goldens |
| Preset setup controller cannot pick a key per guest count | Plan task 1 reads it; extend it generically, not Cricket-only |
| 1v1 unreachable from setup | Setup test plus the visual check drives the real setup form |
| `duelFlags` copy-pasted from Tactics | Dupes gate; extract shared helper if needed |
| Stored V1 log with trailing darts after a winner throws in the duel fold | Same open item as Tactics (`foldMarksDuel` throws `game has ended`); the engine cannot produce such a log; unchanged here |

## 12. Review focus

- Excess marks on the closing dart when the opponent has the number open.
- Win on the exact dart, mid-visit, and no hand-over after it (the Tactics review's important finding).
- Undo of a winning, scoring and dead-making dart.
- Resume mid-game in each seat's turn; V1 solo sessions started before deploy replay unchanged.
- Guest opponent selectable from setup; DartBot not offered.
