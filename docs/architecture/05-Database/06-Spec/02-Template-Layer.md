<!--
status: canonical
scope: database/template-layer
read-when: adding/changing exercise/routine/configuration templates
updated: 2026-09-20
-->

# Database Specification — Chapter 2: Template Layer

> Part of the canonical Database Specification (v2.2.0). Cross-layer invariants (identifier/timestamp strategy, ownership model, runtime event and configuration snapshot models) live in `../06-Database-Specification.md`. Content moved verbatim from the v2.1.0 monolith on 2026-07-11.

---

# Template Layer

## Purpose

The Template Layer defines reusable gameplay definitions.

Templates describe what a player could do.

They never describe what a player did.

Templates are the only mutable layer that users interact with directly.

---

# Design Principles

Template entities must:

- use UUIDv7 primary keys
- distinguish system templates from user templates
- never be referenced by runtime gameplay records
- provide values that runtime copies into configuration snapshots

The runtime layer copies template values at session start.

No runtime table holds a foreign key to a template.

This guarantees that editing or deleting a template can never alter historical gameplay.

---

# exercise_templates

## Purpose

Defines reusable exercise definitions for an exercise type. A template of exercise type `GAME` also
names the game type it wraps; every other exercise type leaves `game_type_id` NULL.

Examples:

- Singles accuracy drill
- Score training block
- TUOD standard session

## Ownership

System templates are owned by the application.

User templates are a planned extension; the current schema marks origin through `is_system_template`.

## Lifecycle

Mutable.

Templates may be created, edited and retired at any time without affecting historical sessions.

## Primary Key

UUIDv7

## Key Columns

- id
- exercise_type_id
- exercise_ruleset_version_id (nullable — NULL when the exercise type is `GAME`) <!-- 2026-09-17 -->
- game_type_id (nullable — NULL unless the exercise type is `GAME`)
- game_ruleset_version_id (nullable — NULL unless the exercise type is `GAME`; migration `0040`) <!-- 2026-09-20 -->
- name
- description
- default_configuration (JSONB, nullable)
- is_system_template
- created_at
- updated_at

## Relationships

References:

- game_types (RESTRICT on delete)
- exercise_ruleset_versions, on the composite pair (exercise_type_id, exercise_ruleset_version_id) (RESTRICT on delete) <!-- 2026-09-17 -->
- ruleset_versions, on the composite pair (game_type_id, game_ruleset_version_id) (RESTRICT on delete; migration `0040`) <!-- 2026-09-20 -->

Referenced by:

- routine_steps

## Design Rationale

An exercise template binds a game type to a reusable definition that routines can compose.

Deleting a game type is restricted while templates exist, protecting template integrity.

Runtime sessions never reference this table; they receive copied values through the configuration snapshot.

`game_type_id` is nullable but keeps its RESTRICT foreign key, so deleting a game type is still
blocked while templates reference it (migration 0028).

`default_configuration` holds the defaults and constraints an exercise type provides — default,
minimum, maximum and recommended duration, and any exercise-specific defaults
(`09-Training/01-Routines.md` §5). A routine step's own `configuration` overrides it.

`exercise_ruleset_version_id` pins the exercise ruleset version `default_configuration` was written
against, so a routine step resolves one version rather than every version of its exercise type
(migration 0035, seed 0019). The foreign key is composite over
(exercise_type_id, exercise_ruleset_version_id), which makes a template pinned to another exercise
type's ruleset unrepresentable. It is nullable and stays so: a `GAME` template pins a game ruleset
version on itself instead, through `game_ruleset_version_id` below. "A non-game template must pin a
version" is asserted in `startTraining`, which refuses to open an activity whose step resolves no
validator, rather than by a CHECK that would hardcode game-backed ⇔ no-exercise-ruleset into the
schema. <!-- 2026-09-17 -->

The version belongs here rather than on `routine_steps`: `default_configuration` and the ruleset
version defining its shape are both the template's, and a per-step override would let one step's
configuration diverge from its own template's. <!-- 2026-09-17 -->

`game_ruleset_version_id` is the game-side mirror of `exercise_ruleset_version_id`: it pins the game
ruleset version a `GAME` template's `default_configuration` was written against (migration `0040`,
2026-09-20), replacing a hardcoded TUOD/`TUOD_V1` assumption in `startGameStep`. The pin is made on
the **template**, then copied onto the session's configuration snapshot at Training start like every
other template value — it is never itself resolved on the session. The foreign key is composite over
`(game_type_id, game_ruleset_version_id)`, referencing a new `uq_ruleset_versions_game_type_id`
unique pair on `ruleset_versions`, the same composite-FK shape `exercise_ruleset_version_id` uses
above — a template cannot pin another game's ruleset version. The CHECK
(`chk_exercise_templates_game_ruleset_pair`: `game_ruleset_version_id IS NULL OR game_type_id IS NOT
NULL`) runs one way only: a pin names its game, while a `GAME` template that pins nothing stays
legal. That asymmetry is deliberate — only a game with a native timed mode can be a routine step
(D340), so `seeds/0002`'s `501 Match` and `Singles Accuracy` carry a `game_type_id` and no version
permanently. `routineGameStepHook`, not this constraint, is what refuses an unpinned game when a
routine tries to start one. See `03-Migrations.md` `## 0040` and D339. <!-- 2026-09-20 -->

---

# routine_templates

## Purpose

Defines composed training routines.

Examples:

- Warmup routine
- Doubles routine
- Full practice program

## Ownership

Two categories exist:

- **System routines** — `player_id` is NULL, `is_system_template` is TRUE. Created by the application. Cannot be modified by users.
- **User routines** — `player_id` references the owning player. Created and modified by that player.

## Lifecycle

Mutable.

Deleting a player cascades to their personal routines.

System routines are never deleted by user action.

## Primary Key

UUIDv7

## Key Columns

- id
- player_id (nullable)
- name
- description
- is_system_template
- created_at
- updated_at

## Relationships

References:

- players (CASCADE on delete)

Referenced by:

- routine_steps

## Design Rationale

A nullable `player_id` cleanly separates system content from user content without a second table.

Routines are compositions; the actual exercises live in `routine_steps`.

---

# routine_steps

## Purpose

Defines the ordered exercises inside a routine.

Example:

```
Routine

↓

15 min warmup

↓

15 min singles

↓

20 min scoring

↓

15 min doubles
```

## Ownership

Owned by the parent routine template.

## Lifecycle

Mutable.

Steps live and die with their routine (CASCADE).

Referenced exercise templates are protected (RESTRICT) while steps use them.

## Primary Key

UUIDv7

## Key Columns

- id
- routine_template_id
- exercise_template_id
- sequence_number
- duration_type_id
- duration_value
- configuration (JSONB, nullable)
- created_at

## Relationships

References:

- routine_templates (CASCADE on delete)
- exercise_templates (RESTRICT on delete)

## Design Rationale

Steps are the composition mechanism: a routine is an ordered list of exercise references, each with its own duration.

`sequence_number` defines execution order explicitly rather than relying on insertion order.

`configuration` is the **Routine Exercise Configuration** of `09-Training/01-Routines.md` §3.5: targets,
target sequences, patterns, game selection and exercise-specific parameters, contextual to this
routine. Duration stays in its own two columns because it is structural and queried
(routine duration is the sum of its steps, §6); everything else contextual lives in the JSONB.

Resolution merges `exercise_templates.default_configuration` with this column to produce the
**Resolved Training Configuration** (§18) copied into `activity_configurations` at Training start.
This is the seam §21 adaptive resolution occupies later, with no further schema change.

**Built (migration `0038`, 2026-09-19):** a deferred constraint trigger
(`trg_routine_steps_duration_bounds` on `routine_steps`,
`trg_routine_templates_duration_bounds` on `routine_templates` for the
zero-step case) enforces a 30-60 minute total-duration bound on a routine's
`MINUTES` steps when its parent `routine_templates.is_system_template =
FALSE` (D305). System routines stay governed by the existing ≤60 minute
ceiling only (`09-Training/01-Routines.md` §7). The same migration adds
`chk_routine_templates_player_ownership`, the ownership `CHECK`
`routine_templates` lacked (a user routine always carries a `player_id`, a
system routine never does — `configuration_templates` already had its own
equivalent), and recreates `v_routine_execution` with `player_id`,
`routine_description` and `exercise_description` so owner-scoped routine
reads stay view-backed (D321, D336). See
`docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md` §3.

---

# configuration_templates (migration 0010)

## Purpose

Stores reusable, named configuration presets for a game type.

Examples:

- "501 — Best of 5, Double Out"
- "TUOD — 10 minutes, standard difficulty"
- "Singles — Hard, random order"

## Ownership

System presets are owned by the application.

User presets are owned by the creating player.

## Lifecycle

Mutable, like all templates.

Runtime never references this table; values are copied into the configuration snapshot at session start.

## Primary Key

UUIDv7

## Key Columns

- id
- game_type_id
- player_id (nullable — NULL for system presets)
- name
- description
- configuration (JSONB)
- is_system_template
- created_at
- updated_at

## Relationships

References:

- game_types (RESTRICT on delete)
- players (CASCADE on delete)

## Design Rationale

The configuration chain is Template → Snapshot → Session. This table stores named presets that are copied into `exercise_configurations` at session start.

The JSONB `configuration` column mirrors `exercise_configurations.configuration`: the snapshot is created by copying (and possibly overriding) the preset JSONB.

Seeded by `0002_default_templates.sql`.

A CHECK constraint guarantees system presets never belong to a player (`is_system_template` implies `player_id IS NULL`).

> **Status:** implemented in migration `0010_configuration_templates.sql`.

---

# Template ↔ Runtime Boundary

The most important rule of the Template Layer:

```
Templates are read at session start.

Values are copied into the configuration snapshot.

Runtime never references templates.
```

Consequences:

- editing a template never changes history
- deleting a user routine never orphans gameplay records
- replay depends only on runtime data

---

# training_schedules

## Purpose

A player's named, swappable weekly schedule: which routine (or rest) runs on
each ISO weekday. Several schedules may exist per player; at most one is
active. Migration `0041`.

## Ownership

Owned by the player (`player_id`, `ON DELETE CASCADE`). No system schedules —
unlike `routine_templates`, there is no `is_system_template` split here.

## Lifecycle

Mutable. Template-layer: never referenced by runtime tables. Editing or
deleting a schedule can never alter historical gameplay, because nothing in
`activities`/`exercise_sessions` points back at one.

## Primary Key

UUIDv7

## Key Columns

- id
- player_id
- name
- is_active (`BOOLEAN NOT NULL DEFAULT FALSE`)
- created_at
- updated_at

## Relationships

References:

- players (CASCADE on delete)

Referenced by:

- training_schedule_days (CASCADE on delete)

## Design Rationale

`uq_training_schedules_player_active`, a partial unique index on `player_id`
`WHERE is_active`, is what enforces "at most one active schedule per player" —
no pointer column on `players`. Activating a schedule is therefore two
statements in one transaction: clear every one of the caller's schedules,
then set the target, ordered so the partial index never trips mid-write.

# training_schedule_days

## Purpose

One row per (schedule, ISO weekday) naming the routine trained that day. A
weekday with no row is a rest day — there is exactly one representation of
rest, not two (a `NULL` routine and a missing row would both have meant it).

## Ownership

Owned by the parent schedule (`training_schedule_id`, `ON DELETE CASCADE`).

## Lifecycle

Mutable; a schedule's days are replaced as a set (delete-then-insert) on
every write, never patched row by row.

## Primary Key

UUIDv7

## Key Columns

- id
- training_schedule_id
- day_of_week (`SMALLINT NOT NULL`, `CHECK (day_of_week BETWEEN 1 AND 7)`, ISO: 1 = Monday … 7 = Sunday)
- routine_template_id
- created_at

## Relationships

References:

- training_schedules (CASCADE on delete)
- routine_templates (**RESTRICT** on delete)

## Design Rationale

`day_of_week` is a `SMALLINT` with a `CHECK`, not a lookup table — a
deliberate exception to Pattern 12 (lookup tables for domain-controlled sets
that grow or need names). The ISO weekday is a universal constant with
nothing to name or grow, so a `weekdays` table would add a join with no
benefit over the CHECK. See D342.

`uq_training_schedule_days_training_schedule_day_of_week` (`training_schedule_id`,
`day_of_week`) stops a schedule naming two routines for the same weekday.

The `routine_template_id` foreign key is `ON DELETE RESTRICT`, not `SET
NULL`: deleting a routine still assigned to some weekday fails loudly rather
than silently turning that day into rest. `app/src/services/routine.service.ts`'s
`deleteRoutine` catches the `23503` on `fk_training_schedule_days_routine_template`
and maps it to `VALIDATION_FAILED { reason: "routine in use", scheduleIds }`,
naming every one of the caller's own schedules still assigning it
(`findScheduleIdsUsingRoutine`, read through `v_training_schedule_days`). See
D342.

Ownership of the routine is *not* re-checked by this table — a foreign
routine id would still FK-resolve. `app/src/services/schedule.service.ts`
asserts every `routine_template_id` is system or caller-owned (via
`getRoutine`) before writing; the read views below are filtered by
`player_id` so a foreign routine never reads back through a schedule that
isn't its owner's.

## Views

`v_training_schedules` (schedule_id, player_id, name, is_active, updated_at,
day_count — `count(*)::int`, cast so the count arrives as a number, D344) and
`v_training_schedule_days` (schedule_id, player_id,
schedule_name, is_active, day_of_week, routine_template_id, routine_name,
routine_minutes — the routine's `MINUTES` step total) are the read models —
see `05-Views/00-Overview.md`. A schedule with no days still lists, because
`v_training_schedules` is a plain projection over `training_schedules`, not a
join that would drop it.

---


# Template Layer Summary

The Template Layer provides mutable, reusable gameplay definitions.

These entities are:

- user-facing and editable
- composed (routines contain ordered steps referencing exercises)
- copied into runtime snapshots, never referenced by runtime
- split into system content and user content through `is_system_template` and nullable ownership

The Runtime Layer records what actually happened when these definitions are executed.

---

