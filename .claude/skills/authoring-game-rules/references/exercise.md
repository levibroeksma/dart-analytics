# Shape: Exercise Type

Template: `docs/game-rules/templates/EXERCISE_TEMPLATE.md`
Folder: `docs/game-rules/training/exercises/`
Architecture: `docs/architecture/09-Training/01-Routines.md` §3.3–3.5

## What an exercise is

A focused, bounded subsection of a training with a specific objective, run by
an `ExerciseEngine`. An exercise **is not a game** — it may wrap one, but it
runs on its own engine and its `exercise_templates.game_type_id` may be `NULL`.

The type is reusable; the configuration is contextual. `SWITCHING` at 10
minutes on T20/T19/T18 in one routine and 15 minutes on T19/T18/T17 in another
is one exercise type, two configurations (§3.5). Write the type's rules here
once; the routine records only its overrides.

## Required headings

`Features` · `Identity` · `Exercise type` · `Objective` · `Config & presets` ·
`How to practise` (with `### Bound`, and `### Ends when` + `### Result` when
standalone) · `Later versions` · `Capture` · `Glossary` · `Open questions`

## Header fields

```
Current version: none (V1 in design)
Entry points: routine step
```

Gaining `standalone` later is an amendment, not a migration — see
`amending.md` §New entry points.

## The V1 cut test here

> One player starts it, resolves every visit against its current target, and it
> ends on its own bound.

## The independence rule

**Never write a rule that requires a wrapped game's engine to know it is inside
a routine.** `09-Training/01-Routines.md` §2 requires a `GameEngine` to remain
independent of the exercise system; §10 states the game engine does not know it
is being used by an exercise.

An exercise that wraps a game owns its own overrides. It does not reach into
the game's rules, and it does not restate them — name the game and say what is
different.

## Bound vs Ends when

Two different things, and conflating them is the usual error:

- **`Bound`** — what limits one run of this exercise type by default: a time, a
  visit count, a number of phases, a target sequence completed. Inside a
  routine, the routine's allocated duration overrides it (§5).
- **`Ends when`** — what ends a *standalone* run, where no routine allocates
  anything. Required only when `Entry points:` includes `standalone`.

## Capture

All four questions, as for a game. One difference worth stating explicitly: an
exercise engine **need not produce a conventional score** (§13). If it does
not, say so — silence reads as an omission, not a decision.

`score` remains the dart's **board** score. Hit/miss ratios, per-target
accuracy and streaks are derived.

## Common traps

- **Writing a routine instead.** If you are specifying durations and an order
  of activities, you are writing a routine. An exercise type has one activity.
- **Baking a routine's configuration into the type.** Targets and durations
  that belong to one routine go in that routine's step, not here. The type
  carries defaults, plus min/max/recommended where they exist (§5).
- **Assuming a game wrapper.** An exercise does not require a game engine
  (§12). Warm-Up has none.
