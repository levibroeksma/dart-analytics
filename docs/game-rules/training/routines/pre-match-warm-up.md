# Pre-Match Warm-Up

Current version: none (V1 in design)

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Steps run in order: twenties, cricket numbers, double down | V1 | All | |
| Step 1: Score Training (timed), 10 minutes | V1 | All | |
| Step 2: Cricket numbers, 5 minutes | Deferred | All | Blocked on: no exercise type walks 20 → 15 then the bull; Around the Clock walks all of 1–20 (`../../rulesets/around-the-clock.md` §Config & presets), and Switching Target Scoring restarts on a miss (`../exercises/switching-target-scoring.md` §Identity) |
| Step 3: Double down, remaining minutes | Deferred | All | Blocked on: no exercise type repeats one outshot until it is checked out in one visit, and the source gives this step no duration — see Open questions |
| Training ends when step 3 ends | V1 | All | |

The routine as a whole cannot ship above its weakest step: while steps 2 and 3
are `Deferred`, so is the routine.

## Identity

- A short warm-up before league play, a tournament or a longer session:
  loosen the arm on the twenties, pick off the cricket numbers, then a few
  common outshots. Source: Shot Darts, "Darts warm up routine", by Scotty
  Burnett (https://www.shotdarts.com/blog/darts-warm-up-routine, read
  2026-10-06).
- System routine.

## Objective

**Single:** one player runs every step; the steps are solo.

- Arrive at a match loose and dialled in, having already hit a double.

## Steps

| # | Exercise type | Configuration | Duration |
| --- | --- | --- | --- |
| 1 | `GAME` — template "Score Training (timed)" (`database/seeds/0022_routine_game_templates.sql`) | none | 10 minutes |
| 2 | Cricket numbers (no exercise type; see Features) | 20, 19, 18, 17, 16, 15, bull | 5 minutes |
| 3 | Double down (no exercise type; see Features) | Outshots 41–80, finishing on D16, D8, D4, D20 or D10 | Open |

Step 1's rules live in `../../rulesets/score-training.md`; it overrides
nothing (the template's default is 10 minutes, seed `0022`). The source asks
the player to mind extension and follow-through here rather than where the
dart lands.

## Total duration

- 10 + 5 + step 3. The source calls the whole warm-up about 15 minutes, which
  leaves step 3 near 0 — see Open questions. The total is not stated until
  step 3 has a duration.
- Any value up to 45 minutes for step 3 keeps `0 < duration <= 60 minutes`
  (§7). As a system routine it has no 30-minute floor (D305).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Steps and order | As Steps | Shown, locked |
| Step durations | 10, 5, open minutes | Shown, locked |

## Ends when

- The last step ends. Abandoning part-way follows the routine player's shared
  behaviour; this routine adds nothing to it.

## Result

- The training summary, one line per step. Score Training's points come from
  step 1; steps 2 and 3 report what their exercise types report once written.
  The routine adds no number of its own.

## Later versions

### Variants

- None named by the source.

### Other

- Steps 2 and 3 land once their exercise types are written under
  `training/exercises/` and reach V1.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Cricket numbers** | Deferred | 20, 19, 18, 17, 16, 15 and the bull, in that order |
| **Double down** | Deferred | One common outshot at a time, kept until checked out in one visit |

## Open questions

- Step 3's duration: the source says "remaining time" inside a ~15-minute
  warm-up. Fixed minutes (5?) or the whole step dropped?
- Step 2: what advances the aim — any hit, or a mark count? The source
  mentions "a minimum of 7 marks" without saying where it applies.
- Step 1: should the twenties be a recorded Score Training step at all, given
  the source says to ignore where the dart lands? A Warm-Up template with one
  section of `20` (`../exercises/warm-up.md` §Config & presets) records
  nothing.
