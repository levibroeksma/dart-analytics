# Thirty-Minute Session

Current version: none (V1 in design)

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Steps run in order: warm-up, scoring, finishing, match play | V1 | All | |
| Step 1: Around the Clock — 1 dart, 5 minutes | V1 | All | |
| Step 2: Score Training (timed), 10 minutes | V1 | All | |
| Step 3: Bob's 27, 10 minutes | Deferred | All | Blocked on: Bob's 27 is not routine-eligible — the eligible ruleset versions are `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`, `AROUND_THE_CLOCK_V2` (`docs/architecture/09-Training/01-Routines.md` §11), and Bob's 27 has no timed mode (`../../rulesets/bobs-27.md` §Config & presets) |
| Step 4: 501, one leg, 5 minutes | Deferred | All | Blocked on: 501 is not routine-eligible (§11), and a leg is not time-bound — see Open questions |
| Doubles option for step 3 | V2+ | All | Wanted, unscheduled: 30 darts at a favourite double and 30 at each neighbour has no exercise type under `training/exercises/` |
| Training ends when step 4 ends | V1 | All | |

The routine as a whole cannot ship above its weakest step: while steps 3 and 4
are `Deferred`, so is the routine.

## Identity

- A balanced half hour for a player practising at home: loosen up, score,
  finish, then one leg of match play. Source: Harrows Darts, "Darts practice
  routines to try at home", §Suggested 30-Minute Session Structure
  (https://www.harrowsdarts.com/blogs/guides/darts-practice-routines-to-try-at-home,
  read 2026-10-06).
- System routine.

## Objective

**Single:** one player runs every step; the steps are solo.

- Cover every part of the game in one short session, with a number to beat
  in each part.

## Steps

| # | Exercise type | Configuration | Duration |
| --- | --- | --- | --- |
| 1 | `GAME` — template "Around the Clock — 1 dart" (`database/seeds/0028_around_the_clock_routine_templates.sql`) | none | 5 minutes |
| 2 | `GAME` — template "Score Training (timed)" (`database/seeds/0022_routine_game_templates.sql`) | none | 10 minutes |
| 3 | `GAME` — Bob's 27 (no template; see Features) | none | 10 minutes |
| 4 | `GAME` — 501, one leg (no template; see Features) | none | 5 minutes |

Step rules live in the wrapped games: `../../rulesets/around-the-clock.md`,
`../../rulesets/score-training.md`, `../../rulesets/bobs-27.md`,
`../../rulesets/501.md`. Step 1 overrides only the template's 10-minute
default (seed `0028`); 5 minutes is inside Around the Clock's timed range of
3–30 (`around-the-clock.md` §Config & presets).

## Total duration

- 5 + 10 + 10 + 5 = **30 minutes**.
- Satisfies `0 < duration <= 60 minutes` (§7). As a system routine it has no
  30-minute floor (D305); it would meet one anyway.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Steps and order | As Steps | Shown, locked |
| Step durations | 5, 10, 10, 5 minutes | Shown, locked |

## Ends when

- The last step ends. Abandoning part-way follows the routine player's shared
  behaviour; this routine adds nothing to it.

## Result

- The training summary, one line per step. Every number comes from the
  steps: Around the Clock's laps, target reached and accuracy (§17 Game
  Exercise); Score Training's points; Bob's 27's final score; the 501 leg's
  darts and average. The routine adds no number of its own.

## Later versions

### Variants

- **Doubles option** — step 3 as 30 darts at the player's favourite double,
  then 30 at each of its two neighbours, counting hits (source §Doubles
  Practice).

### Other

- Steps 3 and 4 land as soon as their games become routine-eligible; the
  composition does not change.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Doubles option** | V2+ | 30 darts each at a favourite double and its two neighbours, in place of Bob's 27 |

## Open questions

- Step 4: a 501 leg ends on a checkout, not a clock. Does the step end on the
  leg's checkout, on 5 minutes, or on whichever comes first?
- Step 2: the source counts T20 hits over 60 darts; Score Training counts
  points over time. Is the template close enough, or does the step want a
  T20-hit count readout?
- Step 1: the source's Around the Clock accepts any hit; the routine template
  is outer single only at the 1-dart difficulty (seed `0028`). Acceptable, or
  should an "any segment" template exist?
