# Catch 40

Current version: none (V1 in design)
Entry points: routine step

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Outshot sequence 61 → 100, one at a time | V1 | All | |
| Free aim: no intended target recorded | V1 | All | |
| Six-dart limit per outshot | V1 | All | |
| Double-out: last dart a double or the bullseye | V1 | All | |
| Bust voids the rest of the visit | V1 | All | |
| Attempt points: 2 darts 3, 3 darts 2, 4–6 darts 1, fail 0 | V1 | All | |
| 99 in three darts scores 3 | V1 | All | |
| Advance after a checkout or a failed attempt | V1 | All | |
| Run ends at the end of the sequence | V1 | All | |
| Time-bound run | V1 | All | |
| Points, checkouts and attempts readouts | V1 | All | |
| Catch 20 variant | V2+ | All | Wanted, unscheduled: a shorter sequence (61–80) is a configuration widening, not needed to play the 40-outshot run |
| Catch 70 variant | V2+ | All | Wanted, unscheduled: a longer sequence (61–130) is a configuration widening, not needed to play the 40-outshot run |
| Head-to-head | V2+ | 1v1 | Wanted, unscheduled: exercise engines run a single solo seat (`app/src/modules/training/exercises/solo-participant.module.ts`) |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `index.astro`, `quick-subtract/`, `routines/` and `schedules/` |

## Identity

- Checkout practice over the 40 most common outshots: start at 61, finish it
  in six darts or fewer, move to 62, and so on to 100. Fewer darts earn more
  points. Source: dolfdarts.com, "Catch 40"
  (https://dolfdarts.com/games/catch-40, read 2026-10-06).
- Standard dartboard scoring and X01 double-out. Attempt points are
  **exercise points**, not board scores.

## Exercise type

- Type constant: `CHECKOUT_SEQUENCE` (proposed; not among the seeded types —
  `WARM_UP`, `GAME`, `EXERCISE_SECTION` (`database/seeds/0014_exercise_types.sql`),
  `SWITCHING`, `DOUBLE_PATTERN` (`0016`), `TARGET_SCORING` (`0023`),
  `SWITCHING_TARGET_SCORING` (`0024`), `SCORE_THRESHOLD` (`0025`),
  `BULLSEYE_CHECKOUT` (`0029`), `BULL_UP` (`0030`)). Named for the rule, so
  Catch 20 and Catch 70 are configurations of it.
- Wraps no game.
- Behaviour no existing type provides: a remaining score carried across up to
  two visits, with X01 bust and double-out. `BULLSEYE_CHECKOUT` judges a
  single visit from a fixed 81 and finishes on the bullseye only.

## Objective

- Check out each outshot in as few darts as possible.
- A good run is a high **points** total; the source names 40 as competent and
  120 as the maximum.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | 30 minutes | Routine step configuration |
| First outshot | 61 | Shown, locked |
| Last outshot | 100 | Shown, locked |
| Dart limit | 6 | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. The 30-minute preset is not sourced; it was chosen over the
15-minute draft (see Open questions).

## How to practise

**Single:** one player per run.

**1v1:** each player plays the full sequence; higher points wins (V2+).

### Visit

- Three darts per visit, free aim. Each dart's board score comes off the
  current **remaining**.
- **Double-out:** the outshot is checked out when remaining reaches exactly 0
  and the last dart hit a double or the bullseye.
- **Bust:** remaining below 0, exactly 1, or 0 without a double-out. The bust
  dart is void and ends the visit — its later darts are not thrown, as in 121
  (`app/src/modules/game/one-twenty-one.engine.module.ts:504`); remaining
  returns to its value at the start of the visit.

### Progress

- Each outshot is one **attempt** of at most six darts (two visits).
- Checked out in 2 darts: 3 points. In 3: 2 points. In 4–6: 1 point.
  Not checked out in six: 0 points. A busted visit uses all three of its
  darts toward the six, thrown or not.
- **99 in three darts scores 3**, since 99 cannot be finished in two.
- After a checkout or a failed attempt, the next outshot (+1) starts at full
  value.

### Bound

- **Time-bound run** inside a routine; the routine's allocated duration
  overrides the default (`EXERCISE_TEMPLATE.md` §Bound).
- **Run ends at the end of the sequence** if 100 is attempted before the time
  runs out.
- Every run starts at the first outshot (61); a run cut by time does not
  resume in a later run.

## Later versions

### Variants

- **Catch 20 variant** — outshots 61–80; maximum 60 points.
- **Catch 70 variant** — outshots 61–130; maximum 210 points.
- **Head-to-head** — two players each play the full sequence; higher points
  wins.

### Other

- **Standalone entry** — see Features row.

## Capture

- **Capture / input mode:** analytics mode under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair, as the shipped exercises
  (`docs/architecture/09-Training/01-Routines.md` §Bullseye Checkouts).
- **One dart's fact:** one `darts` row per throw, the bust dart included; the
  unthrown darts after a bust have no row. No
  intended target or zone — both null, which `chk_dart_target_consistency`
  allows (`database/migrations/0007_constraints.sql:86`). `score` is the
  dart's **board** score (`appendObservedDart`,
  `app/src/modules/game/turn-log.module.ts:134`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run (`exerciseBlockStage()`,
  `app/src/modules/game/turn-log.module.ts:118`); one `turns` row per visit.
- **Derived, never stored:** remaining, bust, void, checked out, darts used,
  attempt points, points, checkouts, attempts, current outshot.
- The result is an exercise-points total, not a conventional game score.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Outshot sequence** | V1 | The ordered outshots 61, 62, … 100 |
| **Free aim** | V1 | No intended target recorded for any dart |
| **Six-dart limit** | V1 | Most darts one attempt may use |
| **Double-out** | V1 | Remaining reaches 0 with the last dart in a double or the bullseye |
| **Bust** | V1 | Remaining below 0, exactly 1, or 0 without a double-out |
| **Attempt points** | V1 | Points one outshot earns, by darts used |
| **Points** | V1 | Sum of attempt points in the run |
| **Catch 20 variant** | V2+ | Sequence 61–80 |
| **Catch 70 variant** | V2+ | Sequence 61–130 |
| **Head-to-head** | V2+ | Two players, higher points wins |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- ~~Default duration: 15 minutes is a draft guess. 40 outshots × up to two
  visits will often not finish in 15 minutes — is the run meant to finish the
  sequence (longer default) or be cut by time?~~ **Resolved (2026-10-06):**
  30-minute preset, cut by time; the run still ends early at the end of the
  sequence.
- ~~Does a run cut by time resume at the next outshot in a later run, or always
  start at 61?~~ **Resolved (2026-10-06):** always 61; resuming is not V1.
- ~~Bust inside the first visit: does the attempt continue into visit two from
  the restored remaining? Source implies yes; confirm.~~ **Resolved
  (2026-10-06):** yes — the bust ends visit one only.
- ~~Merge with Finishing Pyramid (`finishing-pyramid.md`) into one checkout type
  with configurable step and retry rule, or keep two types?~~ **Resolved
  (2026-10-06):** two types; both reuse the shared X01 rule in
  `app/src/modules/game/checkout-bust.module.ts`.
