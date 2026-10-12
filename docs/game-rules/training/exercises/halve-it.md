# Halve-It

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Target sequence: 20, 16, Any double, 17, 18, Any treble, 19, 20, Bull | V1 | All | |
| One visit per target | V1 | All | |
| Only darts in the round's target score, board value | V1 | All | |
| Halving penalty: no dart in the target halves the total | V1 | All | |
| Halving rounds down | V1 | All | |
| Start total 0 | V1 | All | |
| Run ends after the last target | V1 | All | |
| Total readout | V1 | All | |
| Configurable target sequence | V2+ | All | Wanted, unscheduled: the source says targets are "chosen by agreement"; one fixed list is enough to play |
| Selected-score target (e.g. score 41 exactly) | V2+ | All | Wanted, unscheduled: a different target kind with its own hit rule; not in the default list |
| Start total 40 | V2+ | All | Wanted, unscheduled: a variant start the source names; 0 is enough to play |
| Cricket Count-Up (sequence 15, 16, 17, 18, 19, 20, Bull) | V2+ | All | Wanted, unscheduled: the same rule on a different list, so it needs Configurable target sequence; the one fixed list is enough to play |
| Reverse Cricket Count-Up | V2+ | All | Wanted, unscheduled: the same list in reverse (Bull down to 15), so it needs Configurable target sequence |
| Full-Board Count-Up | V2+ | All | Wanted, unscheduled: 1 to 20 plus Bull, 21 rounds, ascending or descending; a list value of Configurable target sequence |
| Multiplayer | V2+ | 2+ | Wanted, unscheduled: Halve-It is a pub game for 2–8, but exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Time-bound run | Deferred | All | Blocked on: a fixed nine-visit sequence; how a routine's duration cuts it is open (see Open questions) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |
| Double Down preset (opens 15, 16; start total 40) | V2+ | All | Wanted, unscheduled: a named rule switch of this exercise, not a distinct game — it is Configurable target sequence plus Start total 40, both V2+, so it cannot land before them |

## Identity

- Accuracy under a penalty: each round names a target; hit it and add the
  score, miss with all three darts and lose half your total. Sources:
  dolfdarts.com, "Halve It" (https://dolfdarts.com/games/halve-it) and
  Wikipedia, "Halve it" (https://en.wikipedia.org/wiki/Halve_it), both read
  2026-10-06. They disagree on rounding — see Open questions.
- Standard dartboard scoring: S = n, D = 2n, T = 3n, outer bull 25, bullseye
  50.

## Exercise type

- Type constant: `HALVE_IT` (proposed; not among the seeded types — checked
  against `database/seeds/0014`, `0016`, `0023`–`0025`, `0029`, `0030`).
- Wraps no game.
- Behaviour no existing type provides: a penalty that scales with the running
  total, and targets that are a zone class (any double, any treble) rather
  than one number.

## Objective

- Finish the sequence with the highest **total**.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Target sequence | 20, 16, Any double, 17, 18, Any treble, 19, 20, Bull | Shown, locked |
| Start total | 0 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**2+:** players take one visit each per round in turn order; highest total
after the last target wins (V2+).

### Visit

- Three darts at the round's target.
- **Number target:** any dart in that number (any ring) scores its board
  value.
- **Any double:** every double hit scores its board value; the bullseye
  counts only if it is treated as a double — see Open questions.
- **Any treble:** every treble hit scores its board value.
- **Bull:** outer bull 25, bullseye 50.

### Progress

- At least one dart in the target: add the darts that hit it to the total.
- No dart in the target: **halving penalty** — total becomes half, rounded
  down (95 → 47).
- Then the next target.

### Bound

- **Run ends after the last target** (Bull).
- How a routine's duration applies is deferred — see Features.

## Later versions

### Variants

- **Configurable target sequence** — any list of number, double, treble,
  bull and selected-score targets.
- **Selected-score target** — the visit's total must equal a named number;
  hit adds it, miss halves.
- **Start total 40** — the run starts at 40 so an early miss still costs.
- **Cricket Count-Up** — Halve-It on the seven Cricket targets in order: 15,
  16, 17, 18, 19, 20, Bull; one visit each, start total 0, a blank visit halves
  the total rounded down, outer bull 25, bullseye 50. Source: dolfdarts.com,
  "Cricket Count-Up" (https://dolfdarts.com/games/cricket-count-up), which
  also plays it solo. Its multiplayer tiebreak (a bull throw-off for tied
  players) is not recorded here; multiplayer is its own row.
- **Reverse Cricket Count-Up** — Cricket Count-Up in reverse: Bull, 20, 19,
  18, 17, 16, 15. The source notes the first round cannot cost anything, as
  the total is still 0.
- **Full-Board Count-Up** — the sequence is 1 to 20 then Bull, 21 rounds, in
  ascending or descending order; otherwise the same rules.
- **Multiplayer** — 2–8 players take turns per round; highest total wins.
- **Double Down preset** — the same exercise with one fixed list and a
  start total of 40: 15, 16, Any double, 17, 18, Any treble, 19, 20, Bull.
  Rounds, hit rule, halving (rounded down) and the end bound are Halve-It's
  own. The only differences are the opening target (15, where the V1 list
  opens 20) and the start total (40, where V1 starts 0). Source:
  dolfdarts.com, "Double Down" (https://dolfdarts.com/games/double-down). It
  calls the game closely related to Halve-It. Its "Zero Start" variation is
  this exercise's V1 start total.

### Other

- **Time-bound run** — see Features.
- **Standalone entry** — see Features.

## Capture

- **Capture / input mode:** analytics mode, `ANALYTICS` + `VISUAL_BOARD`
  capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Number target: intended
  number set, zone null. Any double: number null, zone `DOUBLE`. Any treble:
  number null, zone `TREBLE`. Bull: `25`, zone null. All allowed by
  `chk_dart_target_consistency`
  (`database/migrations/0007_constraints.sql:86`) — a zone without a number is
  permitted. `score` is the **board** score.
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`app/src/modules/game/turn-log.module.ts:118`); one `turns` row per round.
- **Derived, never stored:** round score, halved or not, total.
- The result is the final total.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target sequence** | V1 | The ordered list of round targets |
| **Any double** | V1 | A round where any double scores |
| **Any treble** | V1 | A round where any treble scores |
| **Halving penalty** | V1 | Total halved when no dart hits the round's target |
| **Halving rounds down** | V1 | An odd total halves to the lower whole number |
| **Total** | V1 | Running score of the run |
| **Configurable target sequence** | V2+ | A target list set per routine step |
| **Selected-score target** | V2+ | A round won by a visit total equal to a named number |
| **Start total 40** | V2+ | A run starting at 40 instead of 0 |
| **Cricket Count-Up** | V2+ | Halve-It on 15, 16, 17, 18, 19, 20, Bull |
| **Reverse Cricket Count-Up** | V2+ | Cricket Count-Up from Bull down to 15 |
| **Full-Board Count-Up** | V2+ | Halve-It on 1 to 20 then Bull, 21 rounds |
| **Multiplayer** | V2+ | 2–8 players, highest total wins |
| **Time-bound run** | Deferred | A routine duration cutting the run |
| **Standalone entry** | V2+ | Playing a run outside a routine |
| **Double Down** | V2+ | Preset: 15, 16, Any double, 17, 18, Any treble, 19, 20, Bull, start total 40 |

## Open questions

- Rounding: dolfdarts.com rounds down (95 → 47); Wikipedia says odd numbers
  round up. Draft uses down. Confirm.
- Does the bullseye count in the "Any double" round?
- Time bound: let the nine visits finish past the routine's duration, or end
  at expiry?
- Execution model: exercise (this draft) or a game, as it is a multiplayer pub
  game at heart?
- Double Down opens its list with 15; this draft's V1 list opens with 20, and
  the dolfdarts Halve It page agrees with the V1 list. Is the 15 the real
  difference between the two games, or a slip in one source? Recorded
  as found; neither list is changed here.
