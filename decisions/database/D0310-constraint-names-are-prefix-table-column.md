---
id: D0310
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, column, constraint, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Constraint names are `<prefix>_<table>_<column>`, with the column named in full

## Context and Problem Statement
`exercise_configurations` (`0005`) used a singular table noun and a shortened column (`uq_exercise_configuration_session`), so two tables that mirror each other column-for-column carried two conventions with no functional difference to explain it (issue #295). A reader comparing them had to know which era each came from. Deriving the name mechanically removes the judgement call: `exercise_session_id` yields `exercise_session`, even though the shorter `_session` reads better, because the shorter form repeats `0005`'s habit of naming something other than the column.

## Decision Drivers
* Two tables that mirror each other column-for-column carried two naming conventions with no functional reason (issue #295).
* A mechanical derivation removes the judgement call about how to shorten a column name.

## Considered Options
* Derive every name mechanically from the table's plural name and the full column (chosen).
* Keep the shorter, better-reading `_session` form, such as `uq_exercise_configuration_session` (rejected in Context because it repeats `0005`'s habit of naming something other than the column).

## Decision Outcome
Chosen option: "every constraint is named `uq_`/`fk_`/`chk_` + the table's own (plural) name + the local column with `_id` stripped. Migration `0037` repoints `exercise_configurations`' two constraints onto it; `activity_configurations` (`0030`), `exercise_types` and `exercise_ruleset_versions` (`0027`) already follow it. Applied migrations are not edited — the rename is a new migration.".

### Consequences
constraint names are longer. Nothing queries them by name today, but `app/src/services/session.service.ts` does branch on `uq_sessions_single_active` when mapping a unique violation to a domain error — so any future rename of a constraint in an error-mapping path must change both in the same commit. `0037` was committed unapplied: no `DATABASE_URL` reaches this environment (D193), so `db:migrate`, the up → down → up reversal check and `db:introspect` never ran, and `app/src/db/schema.ts` was hand-edited to match, as `0034`–`0036` were. `database/verification/0037_exercise_configuration_constraint_naming_checks.sql` is what proves the rename landed, once the deploy pipeline's Neon-branch rehearsal (D288) applies it.

* Bad, because constraint names are longer.
* Neutral, because `session.service.ts` branches on `uq_sessions_single_active`, so a future rename in an error-mapping path must change both in the same commit.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0037_exercise_configuration_constraint_naming_checks.sql` proves the rename landed, once the deploy pipeline's Neon-branch rehearsal (D288) applies it. The commit records that `db:migrate`, the up/down/up check and `db:introspect` did not run in the authoring environment.

## Pros and Cons of the Options
### Mechanical derivation from table and full column
* Good, because the two mirrored tables follow one convention and a reader need not know which era each came from.
* Bad, because the names are longer.

### Shorter column form
* Good, because it reads better (Context).
* Bad, because it repeats `0005`'s habit of naming something other than the column.

## Evidence / More Information
Decided: 2026-09-18

* Commit `7553f025` (PR #431, 2026-09-18; adds the D310 row and migration `0037`): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md` (§ 3.1), `docs/superpowers/plans/2026-10-18-catalog-cards-and-tags.md`, `docs/superpowers/plans/2026-10-19-switching-merge.md`.
