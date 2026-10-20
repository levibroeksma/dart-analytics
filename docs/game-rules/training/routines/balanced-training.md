# Balanced Training

Current version: V1 (shipped 2026-09-11)

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Steps run in order: warm up, switch, doubles, finish | V1 | All | |
| Step 1: Warm-Up, 10 minutes | V1 | All | |
| Step 2: Switching, 5 minutes | V1 | All | |
| Step 3: Double Pattern, 5 minutes | V1 | All | |
| Step 4: Finishing — a `GAME` step wrapping Ten Up One Down, 10 minutes | V1 | All | |
| Training ends when step 4 ends | V1 | All | |
| System routine | V1 | All | |
| Editable step durations | V2+ | All | Wanted, unscheduled: the four steps are seeded rows (`database/seeds/0017_balanced_training_routine.sql`) and a system routine is not player-owned, so there is nothing to edit them from. A player wanting other minutes builds their own routine |

## Identity

- Half an hour that touches every part of a session once: loosen up, move the
  aim between targets, work the doubles, then finish under a clock. The
  default training for a player who has no plan for the evening.
- System routine (`routine_templates.player_id` is `NULL`,
  `is_system_template` is `TRUE`).

## Objective

**Single:** one player runs every step; all four steps are solo.

- Leave a session having practised scoring movement, doubles and finishing,
  rather than whichever of the three the player already enjoys.

## Steps

| # | Exercise type | Configuration | Duration |
| --- | --- | --- | --- |
| 1 | `WARM_UP` — template "Warm-Up" (`database/seeds/0015_warm_up_routine.sql`) | none | 10 minutes |
| 2 | `SWITCHING` — template "Switching" | none | 5 minutes |
| 3 | `DOUBLE_PATTERN` — template "Double Pattern" | none | 5 minutes |
| 4 | `GAME` — template "Finishing", pinned to `TUOD_V1` (`database/seeds/0021_exercise_template_game_rulesets.sql`) | start 41, finish bonus 10, miss penalty 1, 3 darts per visit | 10 minutes |

Every step's rules live in its own exercise type: `../exercises/warm-up.md`,
`../exercises/switching.md`, `../exercises/double-pattern.md` and
`../exercises/game.md`, which in turn wraps `../../rulesets/ten-up-one-down.md`.
This routine overrides none of their rules — only the durations above, and
step 4's configuration, which repeats Ten Up One Down's own seeded defaults
(`database/seeds/0017_balanced_training_routine.sql`).

Step 1 uses the same Warm-Up template as the standalone Warm-Up routine, at
10 minutes rather than 5; the template splits its time by section weight, so
the longer step simply gives each section longer
(`../exercises/warm-up.md` §Config & presets).

Step 2 runs Switching's **Standard** config, not Chain: its template pins
`SWITCHING_V1` (`database/seeds/0019_exercise_template_ruleset_versions.sql`).
Step 4's template pins no exercise ruleset version at all — a `GAME` template
pins a game ruleset version instead (`../exercises/game.md` §Exercise type).

## Total duration

- 10 + 5 + 5 + 10 = **30 minutes**.
- Satisfies `0 < duration <= 60 minutes` (§7). As a system routine it is
  exempt from the 30-minute floor that applies to player-authored routines
  (D305, `decisions/database.md`); it meets it exactly in any case.
- The total is the sum of the steps and is never edited on its own (§6).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Steps and order | As Steps | Shown, locked |
| Step durations | 10, 5, 5, 10 minutes | Shown, locked |
| Step configurations | Each template's defaults | Shown, locked |

Nothing here is editable: a system routine is not owned by a player. A player
who wants a different balance builds their own routine from the same exercise
templates.

## Ends when

- The last step ends — step 4's game reaching its own timed end, which is the
  step's end (`../exercises/game.md` §Progress).
- Abandoning part-way follows the routine player's shared behaviour; this
  routine adds nothing to it.

## Result

- The training summary, one line per step. Every number is the step's:
  Warm-Up reports no number at all, Switching its points, darts and hit rate,
  Double Pattern its doubles hit, darts and hit rate, and the Finishing step
  Ten Up One Down's own result. The routine adds no number of its own.

## Later versions

### Variants

- None scheduled.

### Other

- **Editable step durations**, if system routines ever become copyable into a
  player's own; see the Features row.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **System routine** | V1 | A seeded routine owned by no player and not editable |
| **Finishing** | V1 | This routine's name for its `GAME` step; the template pinned to Ten Up One Down |

## Open questions

- Step 1 is 10 minutes of a warm-up that records nothing, a third of the
  training. Is that the intended balance, or an artefact of reusing the
  5-minute Warm-Up template at double length?
- Steps 2 and 3 are 5 minutes each, below the 10-minute duration both
  exercise types name as their own preset. Which is the intended length for
  these two drills?
