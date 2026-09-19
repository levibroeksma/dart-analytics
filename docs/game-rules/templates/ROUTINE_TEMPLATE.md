# Routine Template

Copy the shape below into each routine under
`docs/game-rules/training/routines/`. A **routine** is a reusable definition of
a complete training: an ordered composition of configured exercises
(`docs/architecture/09-Training/01-Routines.md` §3.1, §4). It composes; it does
not implement.

A routine holds no rules of its own. Every rule belongs to one of its exercise
types, documented once under `docs/game-rules/training/exercises/`. If you find
yourself writing how a step is played, you are editing the wrong file.

Authoring and amending are driven by the `authoring-game-rules` skill.

---

## Authoring rules (do not copy into routines)

- Name each step by its exercise type; never restate that exercise's rules.
- Duration is per step. The routine's duration is the sum and is never an
  independently editable number (§6).
- A routine may not exceed **60 minutes** of active training time (§7). A
  player-authored routine also has a 30-minute floor; system routines do not
  (D305).
- A routine cannot ship above its weakest step: if any exercise it names is
  not yet at V1, the routine is not at V1 either.
- Headings carry no version number.
- Version and `Applies to` vocabulary are identical to
  `GAME_RULESET_TEMPLATE.md`.
- A routine carries **no `Entry points:` field** and **no `Capture` section** —
  it is standalone by definition, and its capture is its exercises'.

---

## Routine sections (copy from here down)

# [Routine name]

Current version: none (V1 in design)

## Features

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| … | V1 | All | |

## Identity

- One short pitch: who this training is for and what it builds
- System routine or player-authored

## Objective

- What a player should be able to do better after running this regularly

## Steps

| # | Exercise type | Configuration | Duration |
| --- | --- | --- | --- |
| 1 | … | … | … |

For each step, note only what this routine overrides on the exercise type's
defaults. Everything else comes from the exercise template.

## Total duration

- The sum of the step durations, stated explicitly
- Confirm it satisfies `0 < duration <= 60 minutes`, and the 30-minute floor
  if this is a player-authored routine

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| … | … | Shown, locked / Editable |

What the player may change before starting — step durations, target choices,
or nothing at all.

## Ends when

What ends the training: the last step completing, a total time, or the player
stopping. State what happens to a training abandoned part-way.

## Result

What the player is shown at the end, and which of those numbers come from the
steps rather than the routine.

## Later versions

### Variants
- Selectable switches, with definitions. Every name has a Glossary row.

### Other
- Anything else unlocked later

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **…** | V1 | … |

Every term here appears verbatim inside a Features row name.

## Open questions

- Undecided choices. A settled question is struck in place —
  `~~question~~ **Resolved:** …` — never deleted.
