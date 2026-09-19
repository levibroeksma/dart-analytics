# Exercise Type Template

Copy the shape below into each exercise type under
`docs/game-rules/training/exercises/`. An **exercise type** is the reusable
unit a routine step configures — `WARM_UP`, `SWITCHING`, `DOUBLE_PATTERN`,
`GAME` (`docs/architecture/09-Training/01-Routines.md` §3.4). It binds to an
`ExerciseEngine` and is reused across routines with different configuration,
so its rules live here once rather than inside each routine.

An exercise is **not** a game. It runs on an `ExerciseEngine`, its
`exercise_templates.game_type_id` may be `NULL`, and being playable on its own
does not change that — see the skill's "execution model vs entry points".

Authoring and amending are driven by the `authoring-game-rules` skill.

---

## Authoring rules (do not copy into exercises)

- Describe **how it is practised**, not how software implements it.
- An exercise may wrap a game. If it does, say which game and what it
  overrides; do not restate the game's rules.
- Never write a rule that requires the wrapped game's engine to know it is
  inside a routine. A `GameEngine` must stay independent of the exercise
  system (`09-Training/01-Routines.md` §2, §10).
- Headings carry no version number.
- Version vocabulary and `Applies to` vocabulary are identical to
  `GAME_RULESET_TEMPLATE.md` — read that file's two tables.

---

## Exercise sections (copy from here down)

# [Exercise name]

Current version: none (V1 in design)
Entry points: routine step

## Features

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| … | V1 | All | |

## Identity

- One short pitch: what this trains and why
- Whether standard dartboard scoring applies

## Exercise type

- The exercise type constant (`WARM_UP`, `SWITCHING`, …)
- Whether it wraps a game — and if so, which, and what it overrides
- Which `ExerciseEngine` behaviour it needs that no existing type provides

## Objective

- What the player is trying to do within one run
- What counts as a good run (without inventing statistics — see Capture)

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration | … | … |
| Targets | … | … |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults.

## How to practise

### Visit
- How many darts, at what target, and when the target advances

### Progress
- How the exercise moves through its targets or phases

### Bound
- What limits one run: a time, a count of visits, a number of phases, or a
  target sequence completed. Every exercise used in a routine is time-bound in
  that routine (§5); this is the type's own default bound.

### Ends when
**Required when `Entry points:` includes `standalone`.** What ends a run when
no routine allocates it a duration. A routine step inherits its bound from the
routine; a standalone run has nothing to inherit.

### Result
**Required when `Entry points:` includes `standalone`.** What the player is
shown when it ends. Inside a routine the training summary covers this; a
standalone run has no training.

## Later versions

### Variants
- Selectable rule switches, with definitions. Every name has a Glossary row.

### Other
- Anything else unlocked later

## Capture

**Required — do not skip.**

- **Capture / input mode:** which mode the exercise records in
- **One dart's fact:** what the intended target and ring are, what the hit
  records, and what `score` holds — always the dart's **board** score, never an
  exercise-specific point value
- **Stage type:** which stage this exercise opens, and when
- **Derived, never stored:** the numbers shown to the player that are folded
  from the facts

An exercise engine need not produce a conventional score
(`09-Training/01-Routines.md` §13) — say so explicitly if it does not.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **…** | V1 | … |

Every term here appears verbatim inside a Features row name.

## Open questions

- Undecided rules or product choices. A settled question is struck in place —
  `~~question~~ **Resolved:** …` — never deleted.
