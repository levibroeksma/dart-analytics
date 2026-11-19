---
id: D0461
status: accepted
date: 2026-10-15
origin: contemporaneous
original-date:
tags: [context-system, docs, skill, format]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Exercises and games carry tags from a fixed vocabulary in `docs/game-rules/TAGS.md`

## Context and Problem Statement
weekly plans with a focus per day, and routines that cover every part of the game, need items grouped by what they train. DolfDarts' axes were the start: Category kept as Family minus Team and Training, Mechanic kept minus Training and Party plus LADDER/THRESHOLD/FIXED_COUNT, Difficulty kept, Players became Format, Time dropped (step duration already owns it); Skill, Session role and Pressure added. A fixed vocabulary keeps a later seed lossless.

## Decision Drivers
* Weekly plans with a focus per day, and routines that cover every part of the game, need items grouped by what they train.
* A fixed vocabulary keeps a later seed lossless.
* Multiplayer routines are coming, so extending the scheme must not need a reshape.

## Considered Options
* Free-form or user tags (rejected in the spec's Q1).
* A curated fixed taxonomy defined in rules files only, with no migration and no app code (chosen).

## Decision Outcome
Chosen option: "every exercise and ruleset file under `docs/game-rules/` has a required `## Tags` section after `## Identity`, drawn from `docs/game-rules/TAGS.md`: Skill (one primary, any secondary), Session role, Format, Difficulty, Mechanic, Pressure (NONE exclusive), and Family (rulesets only). A game whose `Entry points:` include `routine step` splits it into complete `### Standalone` and `### Routine step` blocks; the latter has no Family and may label Difficulty per preset. Routines and trivia carry no tags. `scripts/check-game-rules.sh` parses `TAGS.md` and enforces the section; `scripts/test-check-game-rules.sh` proves it on fixtures. `121.md` and `score-training.md` gain `routine step`, matching `09-Training/01-Routines.md` §11. Spec: `docs/superpowers/specs/2026-10-15-training-tags-design.md`.".

### Consequences
tags are informational; nothing reads them. Deferred: database lookup and link tables seeded from the rules files, template-level overrides (replacing labelled Difficulty), derived routine profiles and week balance, tag filters in the routine builder and `/training`, a focus per schedule day, tags on routines and trivia. A new value or axis is a `TAGS.md` row plus a decision; a rename or removal supersedes this one and updates every rules file in the same change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-game-rules.sh` parses `docs/game-rules/TAGS.md` and enforces the `## Tags` section. `scripts/test-check-game-rules.sh` proves the check on fixtures, and `.github/workflows/quality.yml` runs both.

## Pros and Cons of the Options
### Free-form or user tags
* Bad, because the spec decides on a curated, fixed taxonomy and rules out free-form and user tags.

### Curated taxonomy in rules files only
* Good, because it needs no migration and no app code.
* Good, because UPPER_SNAKE keys let a later seed use them unchanged.
* Bad, because tags are informational and nothing reads them.

## Evidence / More Information
Decided: 2026-10-15
Referenced by D0470's `Supersedes:` line.

* `docs/superpowers/specs/2026-10-15-training-tags-design.md` (§ 1 Q1–Q6, § 2, § 3): rebuilt Decision Drivers, Considered Options, Pros and Cons and Revisit When. It does not cite a decision id.
* `docs/superpowers/plans/2026-10-15-training-tags.md` (Task 5, the D461 text).
* Commit `599cf2b2` (adds the `TAGS.md` check to `scripts/check-game-rules.sh` and the fixture test): rebuilt Confirmation.
* Partly superseded by D0470, which replaces the "nothing reads them" consequence and the deferred database lookup and link tables. The vocabulary and `## Tags` contract stand.
