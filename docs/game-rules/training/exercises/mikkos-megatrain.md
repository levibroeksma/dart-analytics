# Mikko's Megatrain

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Fixed target sequence of 20: T20 every odd step | V1 | All | |
| Close a target with 2 hits in one visit | V1 | All | |
| Stay on an Open target until it closes | V1 | All | |
| Burn-dart rule | V1 | All | |
| Run ends at the end of the sequence | V1 | All | |
| Time-bound run | V1 | All | |
| Darts used and targets closed readouts | V1 | All | |
| Short train variant | V2+ | All | Wanted, unscheduled: the first 10 targets only — a configuration narrowing, not needed to play the full sequence |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Scoring and doubles in one sequence: T20 between every other target, so
  the player keeps returning to the scoring bed between doubles and other
  trebles. Each target needs two hits in a visit to close. Source:
  dolfdarts.com, "Mikko's Megatrain"
  (https://dolfdarts.com/games/mikkos-megatrain, read 2026-10-06), credited
  to Mikko Laiho, DartsGym.
- Standard dartboard layout. No points: the result is darts used.

## Exercise type

- Type constant: `CLOSE_SEQUENCE` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)). Named for the rule, so
  the short train is a configuration of it.
- Wraps no game. Around the Clock V2 has a "2 hits to advance" difficulty, but
  walks numbers 1–20 by one segment rule and steps back on a failed visit
  (`docs/game-rules/rulesets/around-the-clock.md` §Config & presets); this
  sequence mixes trebles, doubles and the bullseye and never steps back.
- Behaviour no existing type provides: a hit count per visit to close a
  target, with a hit carried from one visit into the next (burn-dart rule).

## Objective

- Close all 20 targets in as few darts as possible.
- The source puts a perfect run at 60 darts, a strong club player at 90–150,
  and beginners at 200+.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 30 minutes | Routine step configuration |
| Targets | T20, D20, T20, D18, T20, T19, T20, D16, T20, T18, T20, D12, T20, D10, T20, T17, T20, D8, T20, bullseye | Shown, locked |
| Hits to close | 2 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 30-minute preset is a draft value — the source gives both ~40
minutes and "one hour or more" for the full sequence, and 20–30 minutes for
the short train.

## How to practise

**Single:** one player per run.

**1v1:** each player rides the same sequence; fewer darts wins (V2+).

### Visit

- Three darts at the current target.
- Two or three hits in the visit **close** the target.
- Zero or one hit leaves it open; the next visit stays on it.

### Progress

- **Burn-dart rule:** if only dart 3 of a visit hit, and dart 1 of the next
  visit also hits, the target closes. If that dart misses, the carried hit
  expires.
- A closed target moves the aim to the next target in the sequence.

### Bound

- **Run ends at the end of the sequence** once the bullseye closes.
- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).

## Later versions

### Variants

- **Short train variant** — the first 10 targets (T20 through T18).
- **Head-to-head** — two players ride the same sequence; fewer darts wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw. Intended target = the
  current target's number (`20`, `18`, … or `25`); intended zone = `TREBLE`,
  `DOUBLE` or `INNER_BULL` — all keys in `DartZoneKey`
  (`app/src/modules/game/types.ts:386`); a set target needs a set zone
  (`chk_dart_target_consistency`, `database/migrations/0007_constraints.sql:86`).
  Hit number and hit zone record where it landed. `score` is the dart's
  **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
  Each dart carries its own intended target, so a target change mid-visit is
  expressed per dart.
- **Derived, never stored:** hit or miss per dart, carried burn-dart hit,
  current target, targets closed, darts used, darts per target.
- The exercise produces no conventional score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Fixed target sequence** | V1 | The 20 targets in the order of Config & presets |
| **Close** | V1 | Two hits on the current target inside one visit |
| **Open target** | V1 | The current target, not yet closed |
| **Burn-dart rule** | V1 | A lone dart-3 hit closes the target if the next visit's dart 1 also hits |
| **Short train variant** | V2+ | The first 10 targets only |
| **Head-to-head** | V2+ | Two players, fewer darts wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- A target closed by darts 1 and 2: does dart 3 go at the next target, or is
  it spent? The source does not say.
- A run cut by time: is the result darts used plus targets closed, or does a
  cut run carry no result?
- Default duration: 30 minutes is a draft guess; see Config & presets.
