# Baseball and Nine Lives 1v1 — Design

Date: 2026-10-26. Rules: `docs/game-rules/rulesets/baseball-darts.md`, `nine-lives.md`, `around-the-clock.md` (rows `Multiplayer (1v1)`, `Nine Lives in 1v1`; amended 2026-10-26). Precedent, read first: `docs/superpowers/specs/2026-10-25-shanghai-v3-design.md` (per-seat TRACK, seat-carried state, 1v1 tie) and `2026-08-22-single-opponent-seat-remaining-engines-design.md` (seat caps, results snapshot).

## 1. Intent

Two shipped solo games gain a second seat. No capture mode, config or schema change.

Locked with the user (2026-10-26):

- Batch: Baseball 1v1 and Nine Lives 1v1. Steeplechase is a later batch.
- Baseball: compare runs; equal runs after inning 9 is a tie. Extra innings and Bullseye Tiebreaker stay `V2+`.
- Versioning: lift the seat cap in place — `BASEBALL_V1: 2`, `AROUND_THE_CLOCK_V3: 2`. No new ruleset versions, seeds or capability rows.
- Nine Lives 1v1: first bull wins at once; else the survivor wins the moment the other seat is out.
- Out of scope: DartBot for either game, more than two seats, teams.

## 2. Classification

Execution model: game. Entry points: standalone. Kernel: TRACK for both. Additive, `1v1`. Solo behaviour is byte-identical, so no shipped rule changes. One decision block in `decisions/game-engine.md`.

## 3. Rules recap (authority: the three rules files)

- Baseball: seats alternate visits within an inning; both close inning 9; most runs wins, equal runs `TIE`.
- Nine Lives: seats alternate visits. A seat hits the bull and wins at once; the other seat's remaining visit is never thrown. A seat's last life lost puts it out and the other seat wins at once. Seats cannot go out together, so there is always one winner.
- Nine Lives replaces ATC's fewest-darts finish for lives snapshots only. ATC V1/V2 1v1 is unchanged.

## 4. Capture and state (Hard Invariant)

- Capture mode, intended fact (nothing stored), stage type (one `EXERCISE_BLOCK` per seat, `PER_SEAT`), board `score`: unchanged for both games.
- Nothing new is stored. The match winner is derived from the fact log. `winningSideKey` is written to the results snapshot only, as every 1v1 game does.
- Derived, never stored: runs, inning, lives, out, winner, tie.

## 5. Config

No change. `BaseballConfig` and `AroundTheClockV3Config` keep their shape. Seats come from the session, not the config.

## 6. Engine

**Baseball** (`baseball.engine.module.ts`): `foldBaseballState` sets `winningSideKey` and `status` through `scoreCompareOutcome(..., "HIGHEST", soloStatus)` over `{ sideKey, completed, metric: runs }`. Solo keeps `winningSideKey: null`. A tie is `status: "TIE"`. `refusal` and `wouldComplete` already read per-seat state; `closesLastInning` stays correct for the second seat because the rota alternates visits, so the match closes on the last seat's inning-9 third dart.

**Nine Lives** (`around-the-clock.engine.module.ts`): when the config has `lives`, the outcome comes from a new pure `livesOutcome(seats)` in `match-outcome.module.ts`, composed from the existing `raceWinner` (a seat COMPLETE) and `eliminationWinner` (a seat OUT):

- a COMPLETE seat → `{ status: "COMPLETE", winningSideKey: that side }`;
- else an OUT seat with one survivor → `{ status: "COMPLETE", winningSideKey: survivor }`;
- else `IN_PROGRESS`, no winner.

The completion predicate passed to `activeSeat` also treats a finished match as done. `refusal` refuses any dart once `state.status !== "IN_PROGRESS"`, and `wouldComplete` returns true on the dart that finishes the match (the bull, or the third dart of a no-hit visit on the last life). Non-lives snapshots keep `scoreCompareOutcome` unchanged.

## 7. Registration

- `session-seats.service.ts`: `BASEBALL_V1: 2`, `AROUND_THE_CLOCK_V3: 2`.
- `capabilities.ts`: nothing — capability, tag and game-type rows are per ruleset version and do not change.
- `session-progress.module.ts`: Baseball detail already reads the active seat (`Inning n of 9`); Nine Lives reads the active seat. Tests cover the second seat.
- Seeds: `0042_catalog_tags.sql` already carries the `ONE_V_ONE` Nine Lives tag (rules commit `6c5a8da`). No other seed or migration.

## 8. Setup and play

- Baseball setup: `BaseballSetupForm.astro` replaces its "solo practice, locked rules" copy and `UserSection` props to seat one guest opponent, as `ShanghaiSetupForm.astro` does (no DartBot: `supportsDartbot` stays false). `createPresetSetupController` already provides `addGuest`/`start`.
- Baseball play: `winningSideKey` flows from `finalState` into the snapshot (`baseball-play.data.ts`, which hard-codes `null` today); `resultsTitle` and `BaseballResults.astro` show winner, tie, and both seats' runs with a per-seat runs-per-inning grid; solo keeps `SinglePlayerSummary`.
- Nine Lives setup: `AroundTheClockSetupForm.astro` removes "solo only" copy; `addGuest` with lives on keeps lives (it already forces untimed, and lives is untimed). Seating a DartBot still resets to V1 classic rules.
- Nine Lives play/results: the 1v1 results show winner plus per-seat furthest target, lives left, darts. `soloTitle` stays solo-only.
- Play again carries lives and seats as today.

## 9. Testing (TDD, failing test first)

1. Seat caps: `BASEBALL_V1` and `AROUND_THE_CLOCK_V3` accept two seats, reject three.
2. Baseball engine: 1v1 higher runs wins; equal runs `TIE`; alternation across all nine innings; undo across the closing dart; solo golden unchanged.
3. `livesOutcome`: bull wins; out leaves survivor winner; both in progress; unit-tested pure.
4. Nine Lives engine: A bull on visit 4 ends the match, B's turn refused; A out on its last no-hit visit ends the match with B winner; a seat that advanced on dart 1 and missed darts 2–3 keeps its life (rule unchanged); undo of the winning dart restores play; ATC V1/V2 1v1 still fewest-darts.
5. Session progress, replay presenters (`playBaseballRange`-style helpers for two seats), setup data and play data (winner, tie, snapshot) for both games.
6. Golden snapshots: solo Baseball and Nine Lives folds byte-identical before and after.
7. Visual check (Playwright, mocked API, 390×844): Baseball setup with a guest; Nine Lives 1v1 play header and result.

## 10. Out of scope

DartBot for either game, more than two seats, teams, Extra innings, Bullseye Tiebreaker, any stats section change (Baseball's `higher` registry keeps reading the owner's seat), existing seeds and migrations.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| A finished lives match still hands the loser a turn | `refusal`, `wouldComplete` and the `activeSeat` predicate all read match status; test 4 |
| ATC V1/V2 1v1 changes by accident | Lives branch keyed on the snapshot's `lives` field only; the last case of test 4 and golden 6 |
| Baseball `closesLastInning` fires on the wrong seat | The rota alternates, so the last dart is the last seat's; test 2 plays all nine innings with two seats |
| Baseball stats count a 1v1 session against the owner only | Same as Shanghai V1/V2 1v1; no new behaviour. Check the section reads the owner's seat and add a test if it assumes one seat |
| Solo result modal regresses | Solo path keeps `SinglePlayerSummary`; play-data test for solo |
