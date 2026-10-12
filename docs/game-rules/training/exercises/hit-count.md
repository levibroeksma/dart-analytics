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
| 100 Darts at a Target template | V2+ | All | Wanted, unscheduled: a configuration of the same rule (one target, 100 darts); counts the treble only (the source's Treble-Only Count), not its default any-bed hit |
| T20 Drill template | V2+ | All | Wanted, unscheduled: a configuration of the same rule (T20, 50 darts, the source's Treble 20 Challenge) |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |
| Chosen single target (T20, T19 or bullseye) | V2+ | All | Wanted, unscheduled: the source lets the player pick the target (its Treble 19 and Bullseye variations); V1 templates fix their list; bullseye inherits the outer-bull question |
| Split-target session | V2+ | All | Wanted, unscheduled: a two-target list (the source's 50 darts at T20, then 50 at T19), a configuration of the same rule |
| T20/T19 Combo Drill | V2+ | All | Wanted, unscheduled: T20 and T19 alternate by round, a repeating list; the source gives no round count (open) |
| Power Scoring Drill template | V2+ | All | Wanted, unscheduled: a configuration of the same rule (T20, T19, bullseye, three darts each, ten rounds); the source counts hits on the intended target, bed unstated (open) |
| Progressive Treble Drill | Deferred | All | Blocked on: Darts-to-N-hits run applied per target; the source counts darts needed per treble T10 to T20 for a hit count it does not give |
| Time-only run | V2+ | All | Wanted, unscheduled: a session bound by time alone (the source's fixed-time session and 5-minute Warm-Up Version); V1's run bound is a fixed dart count and its time bound only cuts a fixed-dart pass |
| Any-bed hit | V2+ | All | Wanted, unscheduled: the source's simple count scores the target number's single, double and treble; V1 counts one named bed |
| Weighted 3/2/1 scoring | Deferred | All | Blocked on: Any-bed hit (V2+ row above), since it scores the number's singles and doubles while V1 counts one named bed; not bent into the V1 rule |
| Darts-to-N-hits run | Deferred | All | Blocked on: whether a routine's time bound or a dart cap ends a run that never reaches N hits (Open questions); V1's run bound is a fixed dart count (§Bound), so an end by hits reached is a second bound kind |
| Board-score total readout | V2+ | All | Wanted, unscheduled: sums every dart's board score, not hits (the source's Scored Round, 30 darts at T20); V1 reads hits only |

## Identity

- The plainest accuracy drill: a set number of darts at each target in a
  list, counting only darts in the named bed. Many named drills are this one
  rule with a different list. Sources (read 2026-10-06):
  - Dart Corner, "How to get better at darts"
    (https://www.dartscorner.co.uk/blogs/how-to/darts-practice-routines-to-help-improve-your-game):
    The Big Trebles, Clutch Trebles, Red/Green Doubles, 30 at the Bullseye.
  - dolfdarts.com, "Priestley Trebles"
    (https://dolfdarts.com/games/priestley-trebles).
  - dolfdarts.com, "100 Darts at a Target"
    (https://dolfdarts.com/games/100-darts-at-a-target) and "T20 Drill"
    (https://dolfdarts.com/games/t20-drill).
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
| 100 Darts at a Target | T20 (T19 or Bullseye by choice, V2+) | 100 | 100 |
| T20 Drill | T20 | 50 | 50 |

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
- **100 Darts at a Target template** — one hundred darts at one target, T20
  by default; only its treble counts (the source's Treble-Only Count). The
  source also allows T19 or the bullseye, and 200 or 250 darts: a
  darts-per-target value.
- **T20 Drill template** — fifty darts at T20; hit rate is hits over darts.
  The source also names 30 and 100 darts: a darts-per-target value.
- **Chosen single target** — the player picks T20, T19 or the bullseye for a
  one-target template.
- **Any-bed hit** — a hit is any dart in the target number's single, double
  or treble (the source's simple count). For the bullseye, outer and inner
  bull both count.
- **Weighted 3/2/1 scoring** — 3 points for the target number's treble, 2 for
  its double, 1 for its single, 0 otherwise; 300 over 100 darts. Needs any-bed
  hit. At the bullseye the source scores inner bull 3, outer bull 1.
- **Split-target session** — the darts split over two targets, e.g. 50 at T20
  then 50 at T19.
- **T20/T19 Combo Drill** — the target alternates between T20 and T19 each
  round.
- **Power Scoring Drill template** — each round of three darts at a different
  target: T20, T19, then bullseye; ten rounds; count hits on the intended
  target.
- **Progressive Treble Drill** — start at T10 and work up to T20, counting
  the darts needed to hit each treble a set number of times.
- **Time-only run** — a session bound by time alone: the source's 10 to 15
  minute fixed-time session, or a 5-minute T20 warm-up with no stat tracking.
- **Darts-to-N-hits run** — throw until N hits (the source's Marathon: 10
  Treble 20 hits); the result is darts thrown, fewer is better.
- **Board-score total readout** — the sum of every dart's board score over the
  run (the source's Scored Round: 30 darts at T20, maximum 1,800).
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
  (`app/src/modules/game/types.ts:395`); a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** hit or miss per dart, hits, hit rate, hits per
  target, current target, darts left on it.
- The V2+ rows need no new fact: any-bed hit and weighted points derive from
  each dart's hit number and hit zone; the darts-to-N-hits count and the
  board-score total derive from the dart rows and their board `score`.
  Intended zone stays the aimed bed (`TREBLE` for T20).
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
| **100 Darts at a Target template** | V2+ | One hundred darts at one target, only its treble counts |
| **T20 Drill template** | V2+ | Fifty darts at T20 |
| **Head-to-head** | V2+ | Two players, more hits wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |
| **Split-target session** | V2+ | The darts split over two targets, e.g. 50 at T20 then 50 at T19 |
| **T20/T19 Combo Drill** | V2+ | T20 and T19 alternate by round |
| **Power Scoring Drill template** | V2+ | T20, T19, bullseye in turn, three darts each, ten rounds |
| **Progressive Treble Drill** | Deferred | T10 up to T20, darts needed per treble |
| **Time-only run** | V2+ | A session bound by time alone, no dart count |
| **Chosen single target** | V2+ | Player picks T20, T19 or the bullseye for a one-target template |
| **Any-bed hit** | V2+ | Any dart in the target number's single, double or treble is a hit |
| **Weighted 3/2/1 scoring** | Deferred | Treble 3, double 2, single 1 points per dart at the target number |
| **Darts-to-N-hits run** | Deferred | A run that ends on the Nth hit; the result is darts thrown |
| **Board-score total readout** | V2+ | Sum of every dart's board score over the run |

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
- 100 and 50 darts are not multiples of three: the last visit of a 100-dart
  run is one dart (the source: 33 visits of three, then one). Does the type
  allow a short final visit, or must darts-per-target be a multiple of three?
- T20/T19 Combo Drill: how many rounds? Power Scoring Drill: does "hits on
  the intended target" mean the treble only, and does the outer bull count?
- Darts-to-N-hits run: should a routine's time bound or a dart cap end a run
  that never reaches N hits?
