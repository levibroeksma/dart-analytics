# Single Opponent Seat — Remaining 7 Engines — Architecture Design

> **Date:** 2026-08-22
> **Status:** approved (brainstorming consensus)
> **Scope:** Wire a real, playable single opponent seat (1v1, 2 seats max) into the seven engines still solo-only: Bob's 27, 121, Around the Clock, Ten Up One Down (TUOD), Shanghai, Score Training, Singles Training, Doubles Training. All seven already declare `stageOwnership` and read `config.seats[0]` — that scaffolding shipped with the X01 guest-player work (`2026-08-20-guest-player-x01-design.md`) but every engine still hardcodes seat 0 and has no match-level winner logic. This design wires the actual per-seat play and win condition.
> **Out of scope:** 2v2 for any of these seven (X01 alone keeps 1–4 seat prep), DartBot, bull-up, reusable guest rosters, per-participant capture depth, TIMED-duration multiplayer for TUOD/Score Training.

---

## Context

The generic seat layer already exists and is proven by 501:

- `MultiSeatState<TSeat extends SeatState>`, `Seated<TConfig>`, `SeatFact`, `TurnFact.participantRef` (`app/src/modules/game/types.ts`, `app/src/lib/game/rulesets/types.ts`)
- `stageOwnership: "SHARED" | "PER_SEAT"` declared by every engine (`app/src/modules/game/interfaces.ts`)
- `app/src/modules/game/seat-rota.module.ts` — `startingSeatFor`, `seatOf`, `activeSeat` — pure functions over the fact log, nothing stored
- Server: `CreateSessionRequest.participants[]`, `session.service.ts` minting N participants in one transaction, `session-seats.service.ts` (`rejectSeatRequest`, `composeSeatFacts`)
- Frontend: `AddGuestButton.astro`, `GuestNameModal.astro`, `GuestSection.astro` (setup), `SplitScoreboard.astro` / `SplitScoreboardHalf.astro` (play) — all driven by Alpine expression strings the caller supplies, not X01-specific

What's missing, per engine: a per-seat state shape, seat-aware turn attribution, and a match-level win condition. What's missing generically: a completion-aware `activeSeat`, a shared win-condition helper, and the seat cap raised past 501 for these seven rulesets.

---

## Win-condition model

Three shapes, decided by how each game's session naturally ends:

### Elimination — Bob's 27

First seat to hit the fail state (score ≤ 0) loses; the match ends there, the other seat wins. No "wrong player" error is possible: the UI never offers a seat choice, `record()` always targets the derived active seat.

### Race-to-finish — 121 only

121 has a real finish line (`Cap / end target: 170`, per `docs/game-rules/rulesets/121.md`). First seat to reach it and check out wins; the match ends immediately — the trailing seat never gets another turn.

Around the Clock and TUOD do **not** get this treatment (see Score-compare) — neither has an early-cutoff finish line in this version.

### Score-compare — TUOD, Around the Clock, Shanghai, Score Training, Singles Training, Doubles Training

Both seats always play out their full session; nobody's turn is cut short. The match ends once **both** seats are complete, then a metric decides the winner (highest wins unless noted). Ties produce `status: "TIE"`, `winningSideKey: null` — no tiebreak, deferred.

| Game | Metric | Notes |
| --- | --- | --- |
| TUOD | Highest `currentTarget` reached | 1v1 setup offers **ROUNDS only**, not TIMED — see below. |
| Around the Clock | **Fewest** darts/visits to complete | Inverted: lower wins. A miss costs an extra visit, so seats can finish in different visit counts — this is why it is score-compare, not race-to-finish. |
| Shanghai | Highest `totalScore` | Existing instant-win-on-Shanghai still short-circuits the match immediately for whichever seat hits it — score-compare's own race-shaped exception. |
| Score Training | Highest `totalScore` | 1v1 setup offers **ROUNDS only**, not TIMED. |
| Singles Training | Highest `totalPoints` | |
| Doubles Training | Highest count of doubles hit | New derived metric — today's ruleset doc only tracks hit/miss ratios, not a score. Doc update required (see Touch List). Future alternative win conditions (e.g. a hard-mode elimination once a fail state exists) are noted for later work, not built now. |

**TIMED mode:** TUOD and Score Training support ROUNDS and TIMED solo. In 1v1 pass-and-play (one device, seats alternate visits), a single wall-clock timer running through both seats' turns changes what "M minutes" means per seat — a separate capture problem. 1v1 setup for these two games offers the ROUNDS preset only; TIMED remains solo-only until a fair shared-clock model is designed.

---

## Engine layer

### Per-seat state

Each engine's flat single-seat state becomes `MultiSeatState<TSeat>`, following the `FiveOhOneState` precedent: per-seat progression fields (whatever the solo state already tracked — `targetIndex`, `dartsThisVisit`, `totalScore`, etc.) folded independently per seat by filtering `this.turns` to that seat's `participantRef` and replaying the existing pure reducer (`applyBobs27Dart`, `applyOneTwentyOneVisit`, etc.) against just that subset. A solo session is `seats.length === 1` — no branch anywhere in the engine, exactly as 501 established.

Match-level fields sit alongside the seat array: `status: "IN_PROGRESS" | "COMPLETE" | "TIE"`, `winningSideKey: string | null`. Non-X01 games write exactly one seat per side, so `winningSideKey` and the winning seat's `participantRef` currently coincide 1:1 — kept as `sideKey` for consistency with the existing model and so the same generic scoreboard/results components read every game the same way.

### Turn attribution

`record()`/`openOrCreateTurn()` in all seven engines currently hardcode `this.config.seats[0].participantRef`. Each swaps that for `activeSeat(this.facts(), this.config.seats, this.stageOwnership)` from `seat-rota.module.ts` — the same call 501 already makes.

### `seat-rota.module.ts` gains completion awareness

`activeSeat()`'s `PER_SEAT` branch is `seats[facts.turns.length % seats.length]` — pure alternation by total turn count. That assumes every seat needs the same number of turns, which holds for Bob's 27 (elimination ends the match before it matters), 121 (race ends the match before it matters), and the fixed-order training games (both seats always take the same number of visits regardless of hit/miss). It does **not** hold for Around the Clock, where a miss costs an extra visit and one seat can finish before the other.

Fix: `activeSeat()` takes each seat's own `isComplete` (an engine-supplied predicate or precomputed set) and skips any seat already finished, handing every subsequent turn to the other. This is a shared fix in the generic module, not per-engine logic, and is covered once in `seat-rota.module.test.ts`.

### Shared win-condition helper

New `app/src/modules/game/match-outcome.module.ts`, same spirit as `seat-rota.module.ts` — small, pure, generic, tested once:

- `eliminationWinner(seats: readonly { sideKey: string; failed: boolean }[])` — the surviving side, or `null` while nobody has failed yet.
- `raceWinner(seats: readonly { sideKey: string; finished: boolean }[])` — the side that finished, or `null`.
- `scoreCompareWinner(seats: readonly { sideKey: string; completed: boolean; metric: number }[], direction: "HIGHEST" | "LOWEST")` — `null` while any seat is incomplete; once all are complete, the winning `sideKey`, or `null` for a tie.

Shanghai composes two of these: a per-visit check via `raceWinner` (has anyone hit a Shanghai?) before falling back to `scoreCompareWinner` once both are complete. Every other score-compare engine calls `scoreCompareWinner` alone; Bob's 27 calls `eliminationWinner` alone; 121 calls `raceWinner` alone.

`undo()` needs no new logic in any of the seven: it already pops the last fact in log order per the existing contract, which naturally reopens the match if it had just ended — the match-level `status`/`winningSideKey` are derived from `facts()`, never stored, so rewinding the fact that produced a win automatically un-produces it.

---

## Server / setup

`session-seats.service.ts`'s `MULTI_SEAT_RULESET = "501_V1"` single-value gate becomes a small per-ruleset cap:

```ts
const SEAT_CAPS: Record<string, number> = {
  "501_V1": 4,
  BOBS27_V1: 2,
  ONE_TWENTY_ONE_V1: 2,
  AROUND_THE_CLOCK_V1: 2,
  TUOD_V1: 2,
  SHANGHAI_V1: 2,
  SCORE_TRAINING_V1: 2,
  SINGLES_TRAINING_V1: 2,
  DOUBLES_TRAINING_V1: 2,
};
```

`rejectSeatRequest` looks up the ruleset's cap (default: reject, same as today, for any ruleset key not listed) instead of comparing against one hardcoded key. The "2+ seats sharing a `sideKey`" and "one PLAYER seat" guards are unchanged — they already generalize. No change to `CreateSessionRequest`, the create transaction, `composeSeatFacts`, or the batch upload path; all of it is already ruleset-agnostic.

Each ruleset's Zod config schema picks up the shared `seats` block exactly as the X01 design specified — this lands per engine alongside its state change, not as a separate pass.

---

## Frontend

No new components. Each of the seven setup forms gains a `GuestSection` (same usage as `FiveOhOneSetupForm.astro`). Each play interface renders `SplitScoreboard` in place of its single-seat scoreboard markup when `state().seats.length === 2`, passing per-seat Alpine expressions (`nameExpr`, `activeExpr`, `scoreExpr`) — `legsExpr`/`checkoutExpr` stay unused (X01-only). Each results modal reads `winningSideKey` to show who won, falling back to today's solo summary when there is one seat.

---

## Testing

TDD per `app/CLAUDE.md`, full suite every run.

**`app/tests/modules/game/match-outcome.module.test.ts`** (new): `eliminationWinner`, `raceWinner`, `scoreCompareWinner` (both directions, the tie case) — each as pure unit tests, once.

**`app/tests/modules/game/seat-rota.module.test.ts`** (extended): completion-aware `activeSeat` — a finished seat is skipped, every remaining turn goes to the other; two seats finishing on the same turn (fixed-order games) still alternates as before.

**Per engine, extended** (`app/tests/modules/game/*.engine.module.test.ts`): a 2-seat match resolves to the right winner for that game's category; a solo (`seats.length === 1`) session reproduces today's exact behavior — the no-regression anchor; `undo()` across a match-ending fact un-ends the match; every emitted turn carries a `participantRef` present in `seats[]`.

**`app/tests/services/session-seats.service.test.ts`** (extended): each of the seven rulesets now accepts exactly 2 seats and still rejects a 3rd; every other ruleset not in `SEAT_CAPS` still rejects any multi-seat request, unchanged.

---

## Deferred

- **2v2 for these seven** — `sideKey` and per-side folding already generalize; no setup UI or guard removal is planned here (X01-only, per its own design).
- **TIMED-mode multiplayer** (TUOD, Score Training) — needs a shared-clock capture model; a separate spec.
- **Alternative win conditions per config** — e.g. a hard-mode elimination variant for Singles/Doubles Training once a fail state exists for them. Named so a later task doesn't have to rediscover it; not built now.
- **DartBot, bull-up, reusable guest rosters, per-participant capture depth** — unchanged from the X01 design's deferred list.

---

## Touch List

| Area | File | Change |
| --- | --- | --- |
| Engine (shared) | `app/src/modules/game/match-outcome.module.ts` | new |
| Engine (shared) | `app/src/modules/game/seat-rota.module.ts` | completion-aware `activeSeat` |
| Engine | `app/src/modules/game/bobs27.engine.module.ts` | per-seat state, `eliminationWinner` |
| Engine | `app/src/modules/game/one-twenty-one.engine.module.ts` | per-seat state, `raceWinner` |
| Engine | `app/src/modules/game/around-the-clock.engine.module.ts` | per-seat state, `scoreCompareWinner` (lowest darts) |
| Engine | `app/src/modules/game/tuod.engine.module.ts` | per-seat state, ROUNDS-only multiplayer, `scoreCompareWinner` (highest target) |
| Engine | `app/src/modules/game/shanghai.engine.module.ts` | per-seat state, `raceWinner` + `scoreCompareWinner` |
| Engine | `app/src/modules/game/score-training.engine.module.ts` | per-seat state, ROUNDS-only multiplayer, `scoreCompareWinner` (highest total) |
| Engine | `app/src/modules/game/singles-training.engine.module.ts` | per-seat state, `scoreCompareWinner` (highest points) |
| Engine | `app/src/modules/game/doubles-training.engine.module.ts` | per-seat state, new hit-count metric, `scoreCompareWinner` |
| Server | `app/src/services/session-seats.service.ts` | `SEAT_CAPS` map replaces the single `MULTI_SEAT_RULESET` |
| Validators | `app/src/services/rulesets/{bobs27,one-twenty-one,around-the-clock,tuod,shanghai,score-training,singles-training,doubles-training}/*.validator.ts` | shared `seats` config block |
| Frontend (setup) | `app/src/components/layout/games/setup/{Bobs27,OneTwentyOne,AroundTheClock,Tuod,Shanghai,ScoreTraining,SinglesTraining,DoublesTraining}SetupForm.astro` | add `GuestSection` |
| Frontend (play) | `app/src/components/layout/games/interfaces/{Bobs27,OneTwentyOne,AroundTheClock,TenUpOneDown,Shanghai,ScoreTraining,SinglesTraining,DoublesTraining}.astro` | `SplitScoreboard` when 2 seats |
| Frontend (results) | `app/src/components/layout/games/result-modals/*Results.astro` (all 7) | show `winningSideKey` |
| Docs | `docs/game-rules/rulesets/{bobs-27,121,around-the-clock,ten-up-one-down,shanghai,score-training,doubles-training}.md` | multiplayer feature rows; Doubles Training's new hit-count metric |
| Docs | `docs/architecture/04-Architecture-patterns.md` | Pattern 18: win-condition categories, `match-outcome.module.ts` |
| Docs | `docs/architecture/06-API/04-Endpoint-Contracts.md` | seat caps per ruleset |
| Decisions | `decisions/game-engine.md` | win-condition model; seat cap generalization |
