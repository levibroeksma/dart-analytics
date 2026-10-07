# Random Checkout

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Random start score drawn from a range | V1 | All | |
| Range 40–170 | V1 | All | |
| Only finishable scores drawn | V1 | All | |
| Free aim: no intended target recorded | V1 | All | |
| One visit per attempt | V1 | All | |
| Double-out: last dart a double or the bullseye | V1 | All | |
| Bust fails the attempt | V1 | All | |
| New score after every attempt | V1 | All | |
| Time-bound run | V1 | All | |
| Draw seed | V1 | All | |
| Checkouts, attempts and Checkout rate readouts | V1 | All | |
| Configurable range | V2+ | All | Wanted, unscheduled: the source suggests 2–80 for beginners; one fixed range is enough to play |
| Fixed-round bound (10, 20 or 30 rounds) | V2+ | All | Wanted, unscheduled: the source's own bound; inside a routine the step is time-bound, so a count bound matters only for standalone |
| Average darts per checkout readout | V2+ | All | Wanted, unscheduled: a derived readout, not needed to play |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Checkout practice under surprise: each visit starts from a random score
  between 40 and 170; finish it in three darts. Trains route-finding as much as
  throwing. Source: dolfdarts.com, "Random Checkout"
  (https://dolfdarts.com/games/random-checkout, read 2026-10-06).
- Standard dartboard scoring and X01 double-out.

## Exercise type

- Type constant: `RANDOM_CHECKOUT`, seeded in `0036`.
- Wraps no game.
- Behaviour no existing type provides: a start score the engine draws per
  attempt. Every seeded type uses a fixed or configured target.

## Objective

- Check out as many random scores as you can before the time runs out.
- A good run is a high **checkout rate**.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 10 minutes | Routine step configuration |
| Range | 40–170 | Shown, locked |
| Draw seed | minted per run | Not shown |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 10-minute preset is a draft value, not sourced.

## How to practise

**Single:** one player per run.

**1v1:** both players face the same drawn score each round; most checkouts wins (V2+).

### Visit

- Each **attempt** is one visit of three darts from a newly drawn score.
- **Only finishable scores drawn:** scores with no three-dart double-out
  (159, 162, 163, 165, 166, 168, 169) are never drawn.
- **Double-out:** checked out when remaining reaches exactly 0 and the last
  dart hit a double or the bullseye.
- **Bust:** remaining below 0, exactly 1, or 0 without a double-out. Later
  darts are void and the attempt fails. An attempt ending above 0 fails.

### Progress

- After every attempt, checked out or not, a new score is drawn.

### Bound

- **Time-bound run** inside a routine (`EXERCISE_TEMPLATE.md` §Bound).
- An attempt unfinished at timer expiry is not judged; its darts are still
  recorded.

## Later versions

### Variants

- **Configurable range** — e.g. 2–80 for beginners, 100–170 for high finishes.
- **Fixed-round bound** — a run of 10, 20 or 30 attempts.
- **Head-to-head** — both players get the same drawn score each round; most
  checkouts wins; ties broken by checkout rate, then average darts per
  checkout.

### Other

- **Average darts per checkout readout.**
- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode, `ANALYTICS` + `VISUAL_BOARD`
  capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw; intended target and zone null
  (`database/migrations/0007_constraints.sql:86`); `score` is the **board**
  score (`appendObservedDart`, `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`app/src/modules/game/turn-log.module.ts:118`); one `turns` row per
  attempt.
- **The drawn score cannot be folded from the darts.** The run's `drawSeed` in
  the configuration snapshot is the stored fact; each attempt's start score is
  derived from it (D424). Without it the run cannot be replayed.
- **Derived, never stored:** remaining, bust, checked out, checkouts,
  attempts, checkout rate.
- No conventional score: the result is a count of checkouts.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Draw seed** | V1 | The per-run number every start score is derived from |
| **Random start score** | V1 | The score an attempt starts from, drawn by the engine |
| **Only finishable scores** | V1 | Draws exclude scores with no three-dart double-out |
| **Free aim** | V1 | No intended target recorded for any dart |
| **One visit per attempt** | V1 | An attempt is exactly one three-dart visit |
| **Double-out** | V1 | Remaining reaches 0 with the last dart in a double or the bullseye |
| **Bust** | V1 | Remaining below 0, exactly 1, or 0 without a double-out |
| **Checkout rate** | V1 | Checkouts ÷ judged attempts |
| **Configurable range** | V2+ | A draw range other than 40–170 |
| **Fixed-round bound** | V2+ | A run of a set number of attempts |
| **Average darts per checkout** | V2+ | Darts used ÷ checkouts |
| **Head-to-head** | V2+ | Two players, same draws, most checkouts wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- ~~Where is the drawn start score stored?~~ **Resolved:** seed in config,
  start score derived (D424).
- ~~Uniform draw over the range, or weighted toward common finishes?~~
  **Resolved:** uniform over the 124 finishable scores.
