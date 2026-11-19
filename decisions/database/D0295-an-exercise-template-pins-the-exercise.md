---
id: D0295
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [database, schema, migration, column, constraint, seed, replay]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# An exercise template pins the exercise ruleset version it was written against

## Context and Problem Statement
issue #338. The join resolved a step's ruleset version by exercise type with no version predicate, which is unambiguous only because exactly one version exists per type today (`WARM_UP_V1`, `SWITCHING_V1`, `DOUBLE_PATTERN_V1`). The first second version of any type would fan the `leftJoin` out: every step row of that type duplicates and the session pins to whichever version row order happens to surface — a replay-integrity break that surfaces as duplicated steps in a routine, not as an error. The column went on `exercise_templates` rather than `routine_steps` because `default_configuration` and the ruleset version defining its shape are both the template's; a per-step override would let one step's configuration diverge from its own template's. The foreign key is composite rather than simple so that a Switching template pinned to `WARM_UP_V1` is unrepresentable — a simple key would accept it, the join would return a row, and the step would validate against the wrong ruleset with nothing reporting it. The adding commit adds migration `0035`, seed `0019`, `database/verification/0035_exercise_template_ruleset_version_checks.sql` and a `startTraining` validation step (D296).

## Decision Drivers
* The join resolved a step's ruleset version by exercise type alone, which is unambiguous only while one version exists per type.
* A second version of any type would duplicate step rows and pin sessions to whichever row surfaced, a replay-integrity break.
* A Switching template pinned to `WARM_UP_V1` must be unrepresentable.

## Considered Options
* Pin the version on `exercise_templates` with a composite foreign key (chosen).
* Put the pin on `routine_steps`. Rejected: `default_configuration` and its defining ruleset version both belong to the template, and a per-step override could diverge.
* Use a simple foreign key. Rejected: it would accept a Switching template pinned to `WARM_UP_V1`.
* Add a CHECK pairing `game_type_id` with the new column. Rejected: it hardcodes game-backed iff no exercise ruleset and adds another "migrate stops until the seed runs" trap.

## Decision Outcome
Chosen option: "migration `0035` adds `exercise_templates.exercise_ruleset_version_id` (nullable) and a *composite* foreign key on `(exercise_type_id, exercise_ruleset_version_id)` referencing `exercise_ruleset_versions (exercise_type_id, id)`, backed by a new `uq_exercise_ruleset_versions_type_id`. Seed `0019` backfills the three non-game system templates to their own v1 ruleset; the GAME template stays NULL. `findRoutineTemplateSteps` joins the version on that column instead of on `exercise_type_id`. `database/verification/0035_exercise_template_ruleset_version_checks.sql` proves it against a live database.".

### Consequences
adding a second version of an exercise type is now a deliberate act — an existing template keeps pointing at the version it was written for until someone repoints it. The column is nullable and stays nullable: a GAME template pins a game ruleset version on its session instead, and MATCH SIMPLE skips FK validation when either column of the pair is NULL. "A non-game template must pin a version" is therefore not a schema constraint; it is asserted in `startTraining` (D296), which refuses to open an activity whose step resolves no validator. A CHECK pairing `game_type_id` against the new column was rejected because it would hardcode game-backed ⇔ no-exercise-ruleset into the schema and would add a third "migrate stops until the seed runs" trap of the `0020`/`0007` kind. Neither the migration nor the seed was executed here — no `DATABASE_URL` in this environment (D193) — so `schema.ts` was hand-edited to match, as migration `0034` was.

* Good, because adding a second version of an exercise type becomes a deliberate act: templates keep pointing at the version they were written for.
* Neutral, because the column stays nullable and "a non-game template must pin a version" is asserted in `startTraining` (D296), not in the schema.
* Neutral, because neither the migration nor the seed was executed in the authoring environment (no `DATABASE_URL`), so `schema.ts` was hand-edited.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0035_exercise_template_ruleset_version_checks.sql` proves the key against a live database, per the record. The commit adds service and repository tests for `startTraining` validation.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-17

* Commit `9ffca098` (PR #393, issues #338 and #337, 2026-09-17; adds the D295 row, migration `0035`, seed `0019` and the verification script): rebuilt Context, Decision Drivers, Considered Options, Consequences and Confirmation.
