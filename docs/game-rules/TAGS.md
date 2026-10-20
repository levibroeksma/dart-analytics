# Training Tags

The fixed vocabulary for the `## Tags` section of every exercise
(`training/exercises/`) and game ruleset (`rulesets/`). Routines and trivia
tools carry no tags; a routine's tags will be derived from its steps.
Non-canonical like the rest of `docs/game-rules/`. Design:
`docs/superpowers/specs/2026-10-15-training-tags-design.md`.

The database tag tables are now generated from this file and the `## Tags`
sections (append-only, ids are positional); see D470 in
`decisions/context-system.md`.

`scripts/check-game-rules.sh` reads the tables below. Keep their headings and
columns exactly as they are: a `## ` heading per axis, named as in the Axes
table, holding a `| Key | Name | Meaning |` table.

## Rules

- **Default preset.** Tags describe the item at its default config. Where a
  setting changes the item's character, the default wins until template
  overrides exist.
- **Format** lists every player format the rules file describes, scheduled or
  not, except `Dropped` rows.
- **Not versioned.** If a later version changes an item's character, edit its
  tags in place.
- **Routine step.** A game whose `Entry points:` include `routine step` has
  `### Standalone` and `### Routine step` subsections, each a complete table.
  The Routine step block has no Family row and may list several Difficulty
  values, each labelled with its template or preset, e.g.
  `INTERMEDIATE (1 dart), ADVANCED (2 darts)`.
- **Per-config difficulty.** An exercise keeps one flat table and no
  subsections, and that table is a routine-step block: it may list several
  Difficulty values the same way, each labelled with the config it describes,
  e.g. `BEGINNER (Standard), INTERMEDIATE (Chain)`. Label every value or none:
  unlabelled, Difficulty still takes exactly one value. A block that labels
  several of them links no Difficulty tag at all, so each template states its
  own level through `exercise_templates.difficulty_tag_id` (D473).
- **Skill.** Exactly one value is marked `(primary)` and comes first; the
  rest are secondary.
- **Extending.** A new value or axis is a row here plus a decision in
  `decisions/context-system.md`. Renaming or removing one is a new decision
  citing `Supersedes:` and updates every rules file in the same change.

## Axes

| Axis | Rule | Exclusive | Scope |
| --- | --- | --- | --- |
| Skill | primary | — | all |
| Session role | many | — | all |
| Format | many | — | all |
| Difficulty | one | — | all |
| Mechanic | many | — | all |
| Pressure | many | NONE | all |
| Family | one | — | game-standalone |

`primary`: one value marked `(primary)`, any number of others. `one`: exactly
one value. `many`: one or more. `Exclusive`: a value that may not be combined
with any other on that axis. `game-standalone`: rulesets only, and never in a
`### Routine step` block.

## Skill

| Key | Name | Meaning |
| --- | --- | --- |
| SCORING | Scoring | Treble-scoring power |
| SWITCHING | Switching | Moving between targets |
| DOUBLES | Doubles | Hitting doubles |
| CHECKOUT | Checkout | Finishing a score |
| BULL | Bull | Hitting the bull |
| ACCURACY | Accuracy | Singles and grouping |
| CONTROL | Control | Hitting a planned total |

## Session role

| Key | Name | Meaning |
| --- | --- | --- |
| WARM_UP | Warm-up | Low-stakes start that loosens the arm |
| CORE | Core | The main drill block of a session |
| FINISHER | Finisher | Closes a session with pressure on the last darts |
| BENCHMARK | Benchmark | A fixed test that is comparable over time |
| RECREATIONAL | Recreational | Played for fun rather than to drill one thing |

## Format

| Key | Name | Meaning |
| --- | --- | --- |
| SOLO | Solo | One player |
| ONE_V_ONE | 1v1 | Two players head to head |
| MULTIPLAYER | Multiplayer | Three or more players, each for themselves |
| TEAMS | Teams | Players grouped into sides |

## Difficulty

| Key | Name | Meaning |
| --- | --- | --- |
| BEGINNER | Beginner | Playable from the first session |
| INTERMEDIATE | Intermediate | Needs a steady hit on a chosen single |
| ADVANCED | Advanced | Needs regular trebles or doubles |
| EXPERT | Expert | Built for strong league or tour-level players |

## Mechanic

| Key | Name | Meaning |
| --- | --- | --- |
| COUNTDOWN | Countdown | Score down from a start to exactly zero |
| TERRITORIAL | Territorial | Claim and close numbers |
| SEQUENTIAL | Sequential | Hit targets in a set board order |
| ACCUMULATION | Accumulation | Pile up points |
| ELIMINATION | Elimination | Lose lives; players drop out |
| CHASE | Chase | One player pursues another along a track |
| SIMULATION | Simulation | Models another sport or game |
| ADJACENCY | Adjacency | Targets defined by board neighbours |
| LADDER | Ladder | Climb a fixed sequence of targets |
| THRESHOLD | Threshold | Reach a set score per visit |
| FIXED_COUNT | Fixed count | A set number of darts at each target |

## Pressure

| Key | Name | Meaning |
| --- | --- | --- |
| NONE | None | A miss costs nothing beyond the dart (Score Threshold) |
| PENALTY | Penalty | A miss costs points (Halve-It) |
| SETBACK | Setback | A miss moves progress back one step; progress is kept (ATC Intermediate, Doubles Lock) |
| RESET | Reset | A miss sends progress back to the start (Doubles Snakes & Ladders, Bullseye 500) |

## Family

| Key | Name | Meaning |
| --- | --- | --- |
| STANDARD | Standard | Played in leagues and competition |
| PUB | Pub | A pub or social game |
| REGIONAL | Regional | Tied to a region or national tradition |
| NOVELTY | Novelty | A one-off or themed twist |
