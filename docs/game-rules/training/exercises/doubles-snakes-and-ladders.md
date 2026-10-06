# Doubles Snakes and Ladders

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Levels D1 up to D20, then bullseye | V1 | All | |
| Move by hits: 0 back two, 1 back one, 2 stay, 3 up one | V1 | All | |
| Floor at D1 | V1 | All | |
| Finish: three bullseyes in one visit | V1 | All | |
| Run ends at the finish | V1 | All | |
| Time-bound run | V1 | All | |
| Rounds and current level readouts | V1 | All | |
| Singles version | V2+ | All | Wanted, unscheduled: a gentler bed is a configuration |
| Trebles version | V2+ | All | Wanted, unscheduled: a harder bed is a configuration |
| Adjusted par | V2+ | All | Wanted, unscheduled: a different move table is a configuration |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Hard doubles ladder: only a perfect visit climbs, two hits hold, anything
  less slides back. Forces work on every double, not just the comfortable
  ones. Source: dolfdarts.com, "Doubles Snakes and Ladders"
  (https://dolfdarts.com/games/doubles-snakes-and-ladders, read 2026-10-06).
- Standard dartboard layout. Only the double counts; on the last level only
  the bullseye (the outer bull does not count). No points.

## Exercise type

- Type constant: `HIT_COUNT_LADDER` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)). Named for the rule, so
  the singles and trebles versions are configurations.
- Wraps no game. Doubles Training's Challenge mode steps back one on a blank
  visit and ends the game on a D1 miss
  (`docs/game-rules/rulesets/doubles-training.md` §Features); this ladder
  moves by the visit's hit count and never ends on a miss.
- Behaviour no existing type provides: a move table keyed by hits per visit.

## Objective

- Reach the bullseye level and hit three bullseyes in one visit, in as few
  rounds as possible.
- A good run is a low **rounds** count; the source tracks it falling over
  weeks rather than naming a number.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 15 minutes | Routine step configuration |
| Levels | D1 → D20 → bullseye | Shown, locked |
| Moves | 0 hits −2, 1 hit −1, 2 hits 0, 3 hits +1 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 15-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** each player climbs their own ladder; fewer rounds wins (V2+).

### Visit

- One **round** is three darts at the current level's double (or the
  bullseye).

### Progress

- 0 hits: back two levels. 1 hit: back one. 2 hits: stay. 3 hits: up one.
- Never below D1.
- On the bullseye level, three bullseyes in one visit finish the run.

### Bound

- **Run ends at the finish.**
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Singles version** — the single bed of each number.
- **Trebles version** — the treble bed of each number.
- **Adjusted par** — a gentler or harsher move table.
- **Head-to-head** — two players, fewer rounds wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target and zone
  as `doubleTargetIntent` records for a doubles path: the number and
  `DOUBLE`, or 25 and `INNER_BULL` on the bull level
  (`app/src/modules/game/turn-log.module.ts:103`). Hit number and hit zone
  record where it landed. `score` is the dart's **board** score
  (`appendObservedDart`, same file:134).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per round.
- **Derived, never stored:** hits per round, current level, highest level,
  rounds, finished or not.
- The exercise produces a rounds count, not a conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Levels** | V1 | D1 to D20, then the bullseye: 21 in all |
| **Move by hits** | V1 | The level change a round's hit count earns |
| **Floor at D1** | V1 | The ladder never drops below D1 |
| **Finish** | V1 | Three bullseyes in one visit on the last level |
| **Singles version** | V2+ | Single beds instead of doubles |
| **Trebles version** | V2+ | Treble beds instead of doubles |
| **Adjusted par** | V2+ | A different move table |
| **Head-to-head** | V2+ | Two players, fewer rounds wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- On the bullseye level, do 0–2 bullseyes move the player back by the same
  table, or stay?
- Merge with Doubles Lock (`doubles-lock.md`) into one ladder type with a
  configurable move table, or keep two types?
- A run cut by time: is the highest level reached the result?
