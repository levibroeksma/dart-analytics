# Shape: Routine

Template: `docs/game-rules/templates/ROUTINE_TEMPLATE.md`
Folder: `docs/game-rules/training/routines/`
Architecture: `docs/architecture/09-Training/01-Routines.md` §3.1, §4–§7
Translation target: the `ROUTINE_RUN` write path (D64)

## What a routine is

A reusable definition of a complete training: an ordered composition of
configured exercises. **A routine composes; it does not implement.**

```
Routine  = what should happen
Training = what actually happened
```

A routine holds no rules of its own. Every rule belongs to one of its exercise
types, documented once under `training/exercises/`. If you find yourself
writing how a step is played, you are in the wrong file.

## Required headings

`Features` · `Identity` · `Objective` · `Steps` · `Total duration` ·
`Config & presets` · `Ends when` · `Result` · `Later versions` · `Glossary` ·
`Open questions`

**No `Capture` section** — a routine persists nothing of its own; its capture
is its exercises'. A `Capture` section here would be a second, drifting copy.

**No `Entry points:` field** — a routine is the top-level unit of a training
and is standalone by definition. `Ends when` and `Result` are still required.

## Header fields

```
Current version: none (V1 in design)
```

## The V1 cut test here

> It starts, steps through in order, and completes — and **every** exercise it
> names is itself at V1.

**A routine cannot ship above its weakest step.** A routine naming a `V2+`
exercise type is itself `V2+`, however complete its own composition is. Check
each named exercise's `Current version:` — do not assume.

## Duration rules

- Duration is per step (§5). The routine's total is the **sum** (§6) and is
  never an independently editable number that can disagree with its steps.
- `0 < duration <= 60 minutes` (§7). Longer training is modelled as multiple
  blocks separated by a break, not a longer routine.
- A player-authored routine also has a **30-minute floor** (D305). System
  routines do not — the seeded Warm-Up routine is 5 minutes by design
  (`database/seeds/0015_warm_up_routine.sql`).

## Steps

| # | Exercise type | Configuration | Duration |

Record only what this routine **overrides** on the exercise type's defaults.
Everything else comes from the exercise template — the seeded Warm-Up routine
leaves `routine_steps.configuration` `NULL` precisely because it overrides
nothing.

## Common traps

- **Restating an exercise's rules.** Name the type; link the file.
- **A total that disagrees with the steps.** Recompute it; never write it by
  hand and hope.
- **Inventing an exercise type inline.** A step naming a type that has no file
  under `training/exercises/` is an unwritten exercise, not a routine detail.
  Write that file first.
