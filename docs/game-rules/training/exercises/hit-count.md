# Hit Count

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Fixed target list, one pass | V1 | All | |
| Fixed darts per target | V1 | All | |
| Per-target bed: treble, double or bullseye | V1 | All | |
| Only the named bed counts: one point per hit | V1 | All | |
| Run ends after the last target's darts | V1 | All | |
| Time-bound run | V1 | All | |
| Hits, hit rate and per-target hits readouts | V1 | All | |
| Big Trebles template | V1 | All | |
| Clutch Trebles template | V2+ | All | Wanted, unscheduled: a second target list is a configuration, not needed to use the type |
| Priestley Trebles template | V2+ | All | Wanted, unscheduled: a configuration of the same rule |
| Red Doubles template | V2+ | All | Wanted, unscheduled: a configuration of the same rule |
| Green Doubles template | V2+ | All | Wanted, unscheduled: a configuration of the same rule |
| 30 at the Bullseye template | V2+ | All | Wanted, unscheduled: a configuration of the same rule; whether the outer bull counts is open |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- The plainest accuracy drill: a set number of darts at each target in a
  list, counting only darts in the named bed. Many named drills are this one
  rule with a different list. Sources (read 2026-10-06):
  - Dart Corner, "How to get better at darts"
    (https://www.dartscorner.co.uk/blogs/how-to/darts-practice-routines-to-help-improve-your-game):
    The Big Trebles, Clutch Trebles, Red/Green Doubles, 30 at the Bullseye.
  - dolfdarts.com, "Priestley Trebles"
    (https://dolfdarts.com/games/priestley-trebles).
- Standard dartboard layout. One point per hit is a **hit count**, not a
  board score.

## Exercise type

- Type constant: `HIT_COUNT` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)). Each named drill is a
  template of it.
- Wraps no game.
- Behaviour no existing type provides: a fixed **number of darts per
  target** in one finite pass, with the bed chosen per target. `SWITCHING`
  advances every visit, stamps every dart `TREBLE` and rejects the bull
  (`docs/architecture/09-Training/01-Routines.md` §17 Switching, D297);
  `DOUBLE_PATTERN` cycles fixed double patterns one dart each (§17 Double
  Patterns).

## Objective

- Hit the named bed with as many darts as possible.
- A good run is a high **hits** total. Source benchmarks: Priestley Trebles
  8–15 club level, 20+ advanced (of 33); 30 at the Bullseye 1 beginner, 2 pub
  player, 3 Super League, 5 county, 8 professional.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Template | Big Trebles | Routine step configuration |
| Targets | T20, T19, T18, T17 | Set by template |
| Darts per target | 9 | Set by template |
| Duration | 15 minutes | Routine step configuration |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. Dart Corner gives Big Trebles 15–20 minutes.

Templates:

| Template | Targets | Darts per target | Max hits |
| --- | --- | --- | --- |
| Big Trebles | T20, T19, T18, T17 | 9 | 36 |
| Clutch Trebles | T16, T15, T14, T13, T12, T11, T10 | 9 | 63 |
| Priestley Trebles | T10, T11, … T20 | 3 | 33 |
| Red Doubles | D2, D3, D7, D8, D10, D12, D13, D14, D18, D20 | 3 | 30 |
| Green Doubles | D1, D4, D5, D6, D9, D11, D15, D16, D17, D19 | 3 | 30 |
| 30 at the Bullseye | Bullseye | 30 | 30 |

## How to practise

**Single:** one player per run.

**1v1:** each player throws the same list; more hits wins (V2+).

### Visit

- Three darts per visit at the current target.
- A dart in the target's named bed is a **hit**; anything else, the same
  number's other beds included, scores nothing.

### Progress

- After the target's darts are thrown, the aim moves to the next target in
  the list. Each target is visited once.

### Bound

- **Run ends after the last target's darts.**
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Clutch Trebles template** — T16 down to T10, nine darts each.
- **Priestley Trebles template** — T10 up to T20, three darts each.
- **Red Doubles template** — the ten red doubles, three darts each.
- **Green Doubles template** — the ten green doubles, three darts each.
- **30 at the Bullseye template** — thirty darts at the bullseye.
- **Head-to-head** — two players throw the same list; more hits wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target = the
  current target's number (`1`–`20`, or `25`); intended zone = `TREBLE`,
  `DOUBLE` or `INNER_BULL` per target — all keys in `DartZoneKey`
  (`app/src/modules/game/types.ts:349`); a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** hit or miss per dart, hits, hit rate, hits per
  target, current target, darts left on it.
- The exercise produces a hit count, not a conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Fixed target list** | V1 | The targets of the template, in order |
| **Fixed darts per target** | V1 | How many darts each target gets before the aim moves |
| **Per-target bed** | V1 | The one bed of a target that counts: treble, double or bullseye |
| **Big Trebles template** | V1 | T20, T19, T18, T17, nine darts each |
| **Clutch Trebles template** | V2+ | T16 down to T10, nine darts each |
| **Priestley Trebles template** | V2+ | T10 up to T20, three darts each |
| **Red Doubles template** | V2+ | The ten red doubles, three darts each |
| **Green Doubles template** | V2+ | The ten green doubles, three darts each |
| **30 at the Bullseye template** | V2+ | Thirty darts at the bullseye |
| **Head-to-head** | V2+ | Two players, more hits wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- 30 at the Bullseye: does the outer bull count as a hit? The source says
  "bullseye" without saying.
- Nine darts at one target is three visits. Should the aim change only on a
  visit boundary (always true for 3 and 9), and is a darts-per-target that is
  not a multiple of three allowed?
- Inside a routine, does the run stop after one pass or start the list again
  until time runs out?
- Is this a `SWITCHING` configuration once Switching gains a per-target bed
  and a finite pass, or its own type?
