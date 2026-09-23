# Warm-Up

Current version: V1 (shipped 2026-09-10)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Timed sections in order | V1 | All | |
| Section time split by weight | V1 | All | |
| Target highlight per section | V1 | All | |
| No dart input | V1 | All | |
| Standard sections: Upper, Lower, Right, Left, Bull | V1 | All | |
| Warm-Up Advanced: one number per section — 20, 3, 6, 11, then bull | V1 | All | Added 2026-09-23 by the author as a second template on the same rules; only the section targets differ, so it needs no new ruleset |
| Performance metrics | Dropped | All | Decided against: the warm-up "should not invent artificial performance metrics" (`docs/architecture/09-Training/01-Routines.md` §16) |

## Identity

- Loosen the wrist and arm before training: a short run of timed sections,
  each aimed at one area of the board.
- No scoring. Darts are thrown but not recorded.

## Exercise type

- Type constant: `WARM_UP` (`database/seeds/0014_exercise_types.sql`), ruleset
  `WARM_UP_V1`.
- Wraps no game: its templates carry `game_type_id NULL`
  (`database/seeds/0015_warm_up_routine.sql`).
- The only type with no dart input; the engine tracks sections, not darts
  (`app/src/modules/training/exercises/warm-up.engine.module.ts`).

## Objective

- Throw at each section's targets until its time runs out.
- There is no good or bad run; completing every section is the whole result.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 5 minutes (Warm-Up routine), 10 minutes (Balanced Training step) | Routine step configuration |
| Sections | Template: Warm-Up or Warm-Up Advanced (below) | Chosen by template, not edited |

Section lists, each section weight 1
(`database/seeds/0017_balanced_training_routine.sql`, and the Warm-Up Advanced
seed):

| Section | Warm-Up | Warm-Up Advanced |
| --- | --- | --- |
| Upper | 5, 20, 1 | 20 |
| Lower | 19, 3, 17 | 3 |
| Right | 13, 6, 10 | 6 |
| Left | 8, 11, 14 | 11 |
| Bull | bull | bull |

A section holds 1–6 targets (`1`–`20`, or `25` for the bull); a template holds
1–12 sections (`WarmUpPhaseConfig`/`WarmUpV1Config`,
`app/src/lib/training/exercises/rulesets/types.ts`).

## How to practise

**Single:** one player per run.

### Visit

- Throw freely at the current section's targets. Nothing is entered.
- The board shows an outline (accent colour, `DartBoard.astro`) around the section's targets: the slice
  from the bull ring to the rim for numbers, the outer bull ring for the bull
  (`dartboardHighlightPath`, `app/src/lib/game/board/board-highlight.module.ts`).
  In Warm-Up Advanced that slice is a single number.

### Progress

- The run starts after the player confirms "Are you ready?"
  (`app/src/components/layout/training/exercises/WarmUpPanel.astro`).
- Sections run in template order. When a section's time ends the next begins;
  after the last, the run is complete.
- **Section time split by weight:** each section gets the step's duration
  times its weight over the sum of weights, rounded per section
  (`resolveWarmUpPhaseDurations`).

### Bound

- **Timed sections in order:** the run lasts the routine step's duration.

## Later versions

### Variants

- None scheduled.

### Other

- None.

## Capture

- **Capture / input mode:** none. The step session carries no capture pair
  (D277) and records no dart (`01-Routines.md` §16).
- **One dart's fact:** none — **No dart input**.
- **Stage type:** one `EXERCISE_SECTION` stage per section entered, flat under
  the exercise session (`warm-up.engine.module.ts`).
- **Derived, never stored:** section durations, current section.
- No score is produced (§13).

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Timed sections** | V1 | The ordered sections of a run, each with its own time |
| **Target highlight** | V1 | The outline around the current section's targets |
| **Section time split by weight** | V1 | A section's share of the step duration, by weight |
| **Warm-Up Advanced** | V1 | The template whose sections each aim at one number, then the bull |

## Open questions

- None.
