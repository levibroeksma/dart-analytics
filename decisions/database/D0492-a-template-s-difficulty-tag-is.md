---
id: D0492
status: accepted
date: 2026-10-24
origin: contemporaneous
original-date:
tags: [database, schema, migration, column]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A template's difficulty tag is pinned to the DIFFICULTY axis by a composite foreign key

## Context and Problem Statement
the `0047` foreign key accepted any tag, and a wrong value silently fell back to the type's difficulty in `v_exercise_template_catalog`; only seeded system templates were guarded, so a future user template was not. A composite key enforces it in the schema, where a verification script would only report it.

## Decision Drivers
* The `0047` foreign key accepted a tag of any axis, and a wrong value silently fell back to the type's difficulty in `v_exercise_template_catalog`.
* Only seeded system templates were guarded, by an integration test, so a future user template was not.

## Considered Options
* Keep the `0047` foreign key and a verification script that only reports a wrong axis.
* Add a composite foreign key that enforces the axis in the schema (chosen).

## Decision Outcome
Chosen option: "migration `0050_template_difficulty_axis.sql` adds `uq_tags_id_axis` (`id`, `tag_axis_id`) on `tags` and a stored generated column `exercise_templates.difficulty_tag_axis_id` (4, the seeded DIFFICULTY axis id, while `difficulty_tag_id` is set), and replaces `fk_exercise_templates_difficulty_tag` with the composite `(difficulty_tag_id, difficulty_tag_axis_id)` → `tags (id, tag_axis_id)`. A tag of another axis is now rejected by the database.".

### Consequences
the axis id 4 is hard-coded in the generated column, safe because lookup ids are seeded and never reassigned; the integration test asserts it equals the `DIFFICULTY` row. No data change and no API change. Proof: `app/tests/integration/template-difficulty-axis.itest.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/integration/template-difficulty-axis.itest.ts` asserts the axis id equals the `DIFFICULTY` row.

## Pros and Cons of the Options
### Keep the `0047` foreign key with a reporting script
* Bad, because a verification script only reports a wrong axis; it does not stop it.

### A composite foreign key
* Good, because the database rejects a tag of another axis.
* Bad, because the axis id 4 is hard-coded in the generated column; the decision calls this safe because lookup ids are seeded and never reassigned.

## Evidence / More Information
Decided: 2026-10-24

* Commit `ced2524b` (2026-10-24, issue #1024; `0050_template_difficulty_axis.sql`, `template-difficulty-axis.itest.ts`): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
