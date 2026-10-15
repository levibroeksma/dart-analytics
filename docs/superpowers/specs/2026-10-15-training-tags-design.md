# Training Tags — Design

Date: 2026-10-15
Status: approved in brainstorming, pending written-spec review
Branch: `docs/training-tags`

## 1. Goal

Give every exercise and game a fixed, curated set of tags so they can be
grouped by what they train. Long-term this lets a player build a weekly
schedule with a focus per day, or check that routines cover every part of the
game. **This spec only defines the tags and assigns them.** Tags are
informational: nothing reads them yet.

### Decided in brainstorming

| # | Decision |
| --- | --- |
| Q1 | Curated, fixed taxonomy. No free-form or user tags. |
| — | An item may carry any number of tags. Games are tagged as well as exercises. Multiplayer routines are coming, so extending the scheme must not need a reshape. |
| Q2 | The Skill axis weights its tags: one **primary**, any number **secondary**. |
| Q3 | Tags belong to the type (rules file) as defaults; template overrides come later. Routine and schedule tags are always derived, never stored. |
| Q4 | V1 = define tags + assign them. No derived logic, filters or UI. |
| Q5 | Start from DolfDarts' taxonomy; keep all seven axes in §3. |
| Q6 | Approach 1: rules files only. No migration, no app code. |

## 2. Source: DolfDarts taxonomy

DolfDarts (`https://dolfdarts.com/games`) tags each game on five axes. The
values were taken from search-result text of its pages, because this session's
network policy blocks the host:

| DolfDarts axis | Values | Our call |
| --- | --- | --- |
| Category | Standard, Pub, Team, Regional, Training, Novelty | Keep as **Family**. Drop *Team* (moves to Format) and *Training* (already known from exercise vs game). Games only. |
| Mechanic | Countdown, Territorial, Sequential, Accumulation, Elimination, Chase, Simulation, Training, Party, Adjacency | Keep. Drop *Training* and *Party* (they don't describe how a game works). Add Ladder, Threshold, Fixed count. Allow more than one value. |
| Difficulty | Beginner → Expert | Keep, 4 levels. |
| Players | count range | Keep as **Format**, a set. |
| Time | estimate | **Drop.** Duration is already set per routine step; a second number would drift from it. |

Added: **Skill**, **Session role**, **Pressure**.

Not added: a board-zone axis (trebles, doubles, bull). It overlaps Skill almost
entirely.

## 3. Vocabulary — `docs/game-rules/TAGS.md`

A new file, the single source of the vocabulary. Each tag has a key
(UPPER_SNAKE, like the repo's other `implementation_key` values, so a later
seed can use it unchanged), a display name and a one-line meaning. The file
keeps its axis and value tables in a fixed format that the gate parses
(§5); the gate hard-codes no values.

### 3.1 Axes

| Axis | Values | How many per item | Applies to |
| --- | --- | --- | --- |
| Skill | SCORING, SWITCHING, DOUBLES, CHECKOUT, BULL, ACCURACY, CONTROL | exactly 1 primary, 0–n secondary | exercises, games |
| Session role | WARM_UP, CORE, FINISHER, BENCHMARK, RECREATIONAL | 1–n | exercises, games |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER, TEAMS | 1–n | exercises, games |
| Difficulty | BEGINNER, INTERMEDIATE, ADVANCED, EXPERT | exactly 1 (§4.3 exception) | exercises, games |
| Mechanic | COUNTDOWN, TERRITORIAL, SEQUENTIAL, ACCUMULATION, ELIMINATION, CHASE, SIMULATION, ADJACENCY, LADDER, THRESHOLD, FIXED_COUNT | 1–n | exercises, games |
| Pressure | NONE, PENALTY, SETBACK, RESET | 1–n; NONE excludes the rest | exercises, games |
| Family | STANDARD, PUB, REGIONAL, NOVELTY | exactly 1 | games only (standalone block) |

### 3.2 Meanings that need defining

**Skill**

| Key | Meaning |
| --- | --- |
| SCORING | Treble-scoring power |
| SWITCHING | Moving between targets |
| DOUBLES | Hitting doubles |
| CHECKOUT | Finishing a score |
| BULL | Hitting the bull |
| ACCURACY | Singles and grouping |
| CONTROL | Hitting a planned total |

**Session role**

| Key | Meaning |
| --- | --- |
| BENCHMARK | A fixed test that is comparable over time |
| RECREATIONAL | Played for fun rather than to drill one thing |

**Pressure**

| Key | Meaning | Example |
| --- | --- | --- |
| NONE | A miss costs nothing beyond the dart | Score Threshold |
| PENALTY | A miss costs points | Halve-It |
| SETBACK | A miss moves progress back one step; progress is kept | ATC Intermediate, Doubles Lock |
| RESET | A miss sends progress back to the start | Doubles Snakes & Ladders, Bullseye 500 |

**Mechanic additions**

| Key | Meaning |
| --- | --- |
| LADDER | Climb a fixed sequence of targets |
| THRESHOLD | Reach a set score per visit |
| FIXED_COUNT | A set number of darts at each target |

`TAGS.md` defines every value, not only the ones above.

### 3.3 Rules

- **Tags describe the default preset.** Where config changes an item's
  character (Singles Training Hard/Extreme, Hit Count targets), the tags
  follow the default config. Template overrides are deferred (§7).
- **Ownership.** Exercises and games carry tags. Routines and trivia carry
  none; routine tags will be derived from their steps.
- **No versioning.** Tags are not tied to a version. If a later version
  changes the item's character, the tags are edited in place.
- **Extending.** Adding a value or an axis means adding a row to `TAGS.md`,
  plus a decision in `decisions/context-system.md`. Removing or renaming one is
  a new decision with `Supersedes:`. A rename also updates every rules file in
  the same change, and the gate enforces that.

## 4. Rules-file shape

### 4.1 Placement

A new required `## Tags` section, placed after `## Identity`, in every
exercise file (`training/exercises/`) and every ruleset file (`rulesets/`).

### 4.2 Flat table (no `routine step` entry point)

```markdown
## Tags

| Axis | Tags |
| --- | --- |
| Skill | CHECKOUT (primary), DOUBLES |
| Session role | CORE, FINISHER |
| Format | SOLO |
| Difficulty | INTERMEDIATE |
| Mechanic | COUNTDOWN |
| Pressure | NONE |
```

- The primary skill comes first, marked `(primary)`; the others are secondary.
- Ruleset files add a `Family` row. Exercise files never have one.
- Rows appear in the order of §3.1.

### 4.3 Games used as routine steps

A ruleset whose `Entry points:` includes `routine step` (it runs through the
`GAME` exercise type, `09-Training/01-Routines.md` §11–12) has two
subsections instead of the flat table:

```markdown
## Tags

### Standalone
| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, RECREATIONAL |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER |
| Difficulty | BEGINNER |
| Mechanic | SEQUENTIAL |
| Pressure | NONE |
| Family | STANDARD |

### Routine step
| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, CORE |
| Format | SOLO |
| Difficulty | INTERMEDIATE (1 dart), ADVANCED (2 darts), EXPERT (3 darts) |
| Mechanic | SEQUENTIAL |
| Pressure | SETBACK |
```

- **Routine step is a complete block, not a delta.** A reader or a future
  seed can take it as-is, without merging.
- **No Family row** in the Routine step block. Family describes the game's
  origin, not its training use.
- **Difficulty per preset.** In the Routine step block only, Difficulty may
  list several values, each labelled in parentheses with the system template or
  preset it belongs to. This covers several templates pinning one game until
  template overrides exist.
- **Multiplayer routines.** When they ship, the block's Format row widens to
  include ONE_V_ONE/TEAMS. No shape change.
- An exercise that wraps a game carries its own flat table. It never inherits
  tags from the game.

### 4.4 Templates and skill

- `EXERCISE_TEMPLATE.md` and `GAME_RULESET_TEMPLATE.md` gain the section, its
  authoring rules and a pointer to `TAGS.md`. The game template also documents
  the §4.3 split.
- `ROUTINE_TEMPLATE.md` and `TRIVIA_TEMPLATE.md` each get one line: no Tags
  section.
- The `authoring-game-rules` skill's reference for each shape gets the same
  note, and an instruction to tag an item when it is first authored.

### 4.5 Folded-in fix: `Entry points`

`121.md` and `score-training.md` say `Entry points: standalone`, but both games
are routine-eligible (`121_V2`, `SCORE_TRAINING_V1`, §11). Both become
`standalone, routine step`, so §4.3 applies to them. Any other ruleset found
during assignment that is eligible under §11 but not marked gets the same fix
in this pass. This is adjacent work the gate requires, not incidental
discovery.

## 5. Gate — `scripts/check-game-rules.sh`

- `Tags` added to the required headings for the `game` and `exercise` shapes,
  and to the forbidden list for `routine` and `trivia`.
- New check: read the axis and value tables from `TAGS.md`, then for each
  tagged file fail on:
  - a missing or unknown axis, or an axis in the wrong shape or block (Family
    in an exercise file or a Routine step block)
  - a value not in that axis's list
  - a count rule broken: no primary skill or more than one, NONE together with
    another Pressure value, more than one Difficulty outside a Routine step
    block, a labelled Difficulty missing its label inside one
  - `routine step` in `Entry points:` without both subsections, or the
    subsections present without it
- The check blocks by default, like the rest of the script. `GAME_RULES_GATE=warn`
  still prints without failing.
- Test: a malformed fixture must fail the gate. It follows whatever pattern the
  repo already uses for testing its `check-*.sh` scripts (or a small shell test
  if none exists).

## 6. Assignment and delivery

- Tag all 24 exercises and all 51 rulesets from each file's own Identity,
  How to play and How to practise sections.
- DolfDarts' category, mechanic and difficulty are only a starting point where
  a source page exists. Our own rules files win where they differ.
- The PR body carries a review matrix (item × primary skill, session role,
  difficulty, routine-step yes/no) so all 75 can be reviewed in one table.
- One branch (`docs/training-tags`) and one PR. Commits:
  1. this spec
  2. `TAGS.md` + templates + skill references
  3. gate change + test
  4. exercise tags
  5. ruleset tags + `Entry points` fix
- `decisions/context-system.md`: one new decision covering the taxonomy, its
  DolfDarts origin and the defer list in §7.
- `docs/architecture/00-Context-Map.md`: register `TAGS.md` in the "Authoring
  or amending game / exercise / routine / trivia rules" pack.
- `context-maintenance` and `run-all-gates` run before the PR.

## 7. Out of scope (deferred)

- Database storage: lookup tables for axes and tags (SMALLINT), link tables to
  `exercise_types`/`game_types`, seed from the rules files.
- Template-level tag overrides (replaces the §4.3 labelled-difficulty
  stopgap).
- Derived routine skill profile and week balance views.
- Tag filters in the routine builder or `/training`.
- A focus declared per schedule day.
- Tags on routines and trivia.
