# Tactics V2 (TACTICS_V2) — 1v1 — Design

Date: 2026-10-23. Rules: `docs/game-rules/rulesets/tactics.md` (1v1 rows `V2`, amended 2026-10-23). V1 design: `docs/superpowers/specs/2026-10-06-tactics-v1-design.md`.

## 1. Intent

Tactics V1 is a solo close-out drill (D422). V2 adds two-seat play: points on owned numbers, dead numbers and a win by closing out level or ahead. Solo under V2 plays exactly as V1.

Locked with the user (2026-10-23):

- Scope is 1v1 only. Strict, the dual-purpose player choice, Minnesota Cricket and the stats section stay V2+ (reasons in `tactics.md`).
- A new ruleset version `TACTICS_V2` beside the untouched `TACTICS_V1`.
- Auto rule is points first: a double or treble on a 15–20 number you own scores on it while the opponent has it open, and marks Doubles/Triples only once the number is dead.
- Excess marks score (default, open to the user's veto): marks beyond the third on a number the opponent has not closed score marks × value.
- The seat switch uses the same animation as 501 — a design requirement, met by reusing the 501 shell (§7), not by new animation code.
- No duplicated code: shared fold in one module, shell and rows extended not copied, clone baseline checked (§9).

## 2. Classification

Execution model: game. Entry points: standalone. Kernel: MARKS (unchanged). Additive and seat-conditional (`1v1`), `V2`; V1 is shipped so the cut test is not re-run. Changes no shipped rule (V1 sessions never have two seats), but the points-first rule and the cross-seat fold are new engine semantics, so one decision block (`decisions/game-engine.md`, next id from `scripts/next-decision-id.sh`, D486 at writing) records the vehicle and the rule, as D421/D422 did.

## 3. Rules recap (authority: `tactics.md`)

- Points: spare marks × number value (bull 25 a mark) while the opponent has not closed the number. Doubles/Triples never score.
- Auto rule (1v1): number open for you → marks it, spare marks score if the opponent has it open; closed by you, open for the opponent → the dart scores on the number; dead → a D/T marks its category, a single does nothing. 1–14 D/T marks its category.
- Win: the first dart leaving the throwing seat closed out with points ≥ the opponent's ends the game, mid-visit. No tie is reachable (a closed-out seat behind keeps throwing; the opponent cannot score on numbers it closed).
- A closed-out seat keeps throwing while behind, so "seat complete" no longer ends a seat's turns in 1v1.

## 4. Capture and state (Hard Invariant: persistable shape)

- Capture/input, intended fact, stage type: unchanged from V1 (DETAILED_DARTS and VISUAL_BOARD; intent null; one `EXERCISE_BLOCK`). `score` stays the dart's board score.
- Nothing new is stored. Points, dead numbers, closed-out status and the winner are folded from both seats' dart facts read in log order, because a dart's points depend on the opponent's marks at that dart. No migration, no schema change.
- `TacticsSeatState` gains `points: number` (always `0` in solo). `TacticsState` gains `winnerParticipantRef: string | null` (null in solo and while undecided). Seat `status: "COMPLETE"` keeps meaning "closed out"; game `status` is `COMPLETE` when solo's seat is closed out, or in 1v1 when `winnerParticipantRef` is set.

## 5. Engine

One spec, one class, two keys, as Bob's 27 V2: `TacticsEngine` also serves `TACTICS_V2` via a second `dartGameEngineFactory`-style registration of the same class (`rulesetVersionKey` taken from the registered factory).

- **Fold branch by seat count:** one seat → the existing V1 path, unchanged (`foldSeatStates` + `applyTacticsDart`). Two seats → the duel fold.
- **Shared module (dedupe):** new `marks-duel.module.ts` owns the chronological two-seat walk: `foldMarksDuel(turns, seats, spec)` with `spec = { initialSeat, hitOf(seatBefore, oppBefore, observation), valueOf(objectiveIndex) }`, returning per-seat states and the first winning dart. It contains no Tactics knowledge, so Cricket multiplayer later supplies its own `hitOf`/`valueOf` and reuses the walk, the points rule and the win test.
- **Cap and bookkeeping are not copied:** the cap, `closedAtDart` and `objectiveHits` update in `applyMarksDart` is extracted to one helper (`addMarks`) that both `applyMarksDart` and the duel reducer call; it also returns the spare marks. V1 output is byte-identical (differential test).
- `hitOf` for Tactics lives in `tactics.engine.module.ts` next to `tacticsMarksOf`: `tacticsDuelHitOf` reads the seat's and the opponent's marks and applies the points-first rule; the V1 `tacticsMarksOf` is reused for its open-number and bull branches, not re-implemented.
- **Turn flow:** `recordMarksDart` refuses on "active seat complete"; for two seats it must refuse on "winner set" instead. The check becomes a parameter of the existing function (`isEnded(state)`), not a second recorder. `completedAt` is stamped by the visit's third dart or the winning dart. `wouldComplete` reads the duel reducer. Seat rota (`activeSeat(…, "PER_SEAT")`) must not skip a closed-out seat — verified at plan time with a failing test first.
- `foldTacticsState` / `initialTacticsState` / `isTacticsTarget` signatures stay; the visit preview's hit/miss for a dart keeps its empty-board meaning.

## 6. Registration (one commit with the validator, per `check-game-engines.sh`)

- `rulesets/types.ts`: key union `"TACTICS_V2"`, `TacticsV2Config` (empty `.strict()`, as V1), `RULESET_CONFIGS`, `ConfigSnapshotFor`.
- `services/rulesets/registry.ts`: validator; one builder shared with V1 (`tacticsValidatorFor`-style, no copy).
- `services/session-seats.service.ts`: `SEAT_CAPS.TACTICS_V2 = 2` (V1 stays 1).
- `capabilities.ts`: V2 rows in the capability maps (`[DETAILED_DARTS, VISUAL_BOARD]`, `["board"]`, game type `TACTICS`); `RULESET_DARTBOT.TACTICS_V2` stays false (a marks bot does not exist; the opponent chooser then offers guests only).
- `session-progress.module.ts`: V2 summarizer row (detail: `1v1 · 9 objectives`; solo keeps V1's text); `games-visibility.ts` and the resume-deck map `GAME_TYPE_BY_RULESET.TACTICS_V2` (the #1061 lesson: a test pins it).
- `lib/stats/constants.ts`: `TACTICS_V2` where V1 is enumerated.
- Seed `0051_tactics_v2_ruleset.sql`: one `ruleset_versions` row (id next free after `…20`, verified at execution), `ON CONFLICT DO NOTHING`, no template (setup reuses V1's preset as `templateRef`). V2 triples into `0007` and its verification file (count 40 to 42, from the file at execution). No migration.

## 7. Setup and play

- `tactics-setup.data.ts`: `rulesetVersionKey: (ctx) => ctx.guests.length > 0 ? "TACTICS_V2" : "TACTICS_V1"`. Solo keeps V1 so solo history stays one stats group; a guest opponent selects V2. No `configOverrides`. `TacticsSetupForm.astro`: info copy gains the 1v1 sentence; the opponent chooser already exists in `UserSection`.
- **Seat switch animation (required):** the two-seat layout is `SeatedPlayScreen` → `SplitScoreboard`, the 501 shell, so `seatMorph()` and the cross-fade ride along unchanged. `interfaces/Tactics.astro` stops hand-building `SinglePlayerDisplay` and renders `SeatedPlayScreen`.
- **Shell extension, no copy:** `SeatedPlayScreen` gains a named slot `rows` that replaces the stat-tile lists in the solo display and in each active seat card (Cricket multiplayer reuses it), plus `soloCaption`. `big` is `(c) => c.solo ? c("dartsThrown") : c("points")`; caption "DARTS USED" solo, "POINTS" per seat. The idle bar's stat is `Closed` (`c("closedCount")` of 9).
- **Marks display:** `MarkRows` takes an optional seat (`objectiveRowsFor(ref)`); the same component serves solo and each seat. In 1v1 each row shows the seat's pips bright and the opponent's muted, with a "scoring" mark where the seat owns the number and the opponent has it open and a "dead" fade where both closed. The solo rows are unchanged.
- `tactics-play.data.ts`: `objectiveRowsFor`, `dartsThrownFor`, `pointsFor`, `closedCountFor` accessors in the `x()` / `xFor(ref)` pair `SeatedPlayScreen` expects; `subtitle` reads `1V1 · 9 OBJECTIVES`; `resumeEngine` accepts both keys (the store's key); `playAgain` uses the session's own key; `resultsTitle`: solo "Closed out!", 1v1 "<name> wins!".
- Results: `TacticsSeatResult` gains `points`; `TacticsResultsSnapshot.winningSideKey` becomes `string | null` (non-null in 1v1). The results modal shows points and the winner through the existing winner/loser components used by other 1v1 results.
- Replay (`replay-presenters.ts`): the Tactics turn cells add `Points` for two seats; the session line keeps `Darts` for solo and shows points for 1v1.

## 8. Stats

No new view. Tactics MPR/darts-to-close sections stay V2+. `ruleset_version_key` already splits V1 and V2 into separate groups where stats group by it. The derived-aims fold stays a no-op for Tactics (intent-less); a test asserts the duel fold does not break it.

## 9. Testing (TDD, failing test first) and the no-duplicates gate

1. Fold: points on a closed-by-me/open-for-opponent number; excess marks on the closing dart; dead number; points-first for D/T; 1–14 D/T; the bull at 25 a mark; Doubles/Triples never score.
2. Win: closes out level → wins at that dart, mid-visit; behind → keeps throwing and the opponent cannot score on closed numbers; later seat closes out ahead → wins; no reachable tie; dart after the win refused; undo past the winning dart reopens the game.
3. Differential: every V1 solo golden folds byte-identically (only the new `points: 0` field is added to expected seat states; each edit is ledgered); two-seat goldens added.
4. Validator, registry, seat cap, capability, session-progress, resume-deck and parity tests gain V2.
5. Setup: guest selects V2, solo selects V1.
6. Play data: both keys resume; results title for each outcome; the opponent's rows and idle stat.
7. Replay-fold and derived-aims tests for two seats.
8. Seed verification: V2 triples present.
9. **Dupes:** record `npx fallow dupes --mode semantic --min-tokens 30` on `origin/main` before Task 1 and compare at each task; the accepted delta is table-row additions only, as for Bob's 27 Easy. Any new clone group in `marks-duel.module.ts`, the engine, the shell or the data file blocks the task.
10. Visual check at execution: Playwright screenshots of the 1v1 play screen (both seats active in turn, the switch animation firing, nine rows fitting the 40% band).

## 10. Out of scope

- More than two seats, DartBot opponents, Cut-throat and other cricket variants.
- Strict, the dual-purpose player choice, Minnesota Cricket and the three-in-a-bed bonus.
- A Tactics statistics section and any new view.
- Cricket multiplayer (the duel module is built to be reused, not to be wired for it).
- Any change to V1 config, V1 solo behaviour, or existing seeds and migrations.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| V2 leaks into V1 solo | Seat-count branch keeps the V1 path; V1 cap stays 1; differential goldens |
| Closed-out seat stops being rotated, or is refused a dart while the game runs | Explicit tests for a behind closed-out seat throwing, and for refusal only after a winner |
| Points depend on opponent state, so order matters | The duel fold walks turns in log order; a test shuffles interleaving and undo |
| Nine rows with two pip groups overflow the 40% band | Visual check; fall back to one pip group plus an opponent-closed marker |
| A fix to `applyMarksDart` changes V1 | Extraction behind the differential test before any duel code |
| Shell extension regresses 501 or Cricket-shaped screens | The new slot and prop are optional; existing screens render unchanged (tests) |

## 12. Review focus

- Excess-marks rule on the closing dart when the opponent has the number open.
- Win on the exact dart, mid-visit, and the turn handover not firing after it.
- Undo of a winning dart, a scoring dart and a dead-making dart.
- Resume after reload mid-game in each seat's turn; V1 solo sessions started before deploy replay unchanged.
- The seat switch animation on every hand-over, including after a 1-dart visit that scores and after an undo that reopens a visit.

## 13. Refinements made while building (2026-10-23)

- `recordMarksDart` keeps an optional `isEnded` parameter (default: the active seat is complete) instead of reading the game status; the existing recorder tests derive a state with no game status. Tactics passes `status === "COMPLETE"`.
- The seat rota needed no change: with no completion predicate `activeSeat` alternates, so a closed-out seat that is behind keeps throwing (pinned by a test).
- `wouldComplete` clones the engine and records the dart inside a try, for both seat counts.
- `SeatedPlayScreen` wraps the `rows` slot in `x-data="{ get rowsRef() {...} }"`; `MarkRows` takes `rowsExpr` (default `objectiveRows()`).
- `RULESET_CONFIGS.TACTICS_V2` is `TacticsConfig` itself; `tacticsValidator` serves both keys.
- No per-seat "POINTS" caption: `SplitScoreboard` has no caption prop; the seat's big value is its points and the idle bar shows `Closed`.
