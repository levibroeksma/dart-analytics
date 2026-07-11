<!--
status: canonical
scope: database/template-layer
read-when: adding/changing exercise/routine/configuration templates
updated: 2026-07-11
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

Defines reusable exercise definitions for a specific game type.

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
- game_type_id
- name
- description
- is_system_template
- created_at
- updated_at

## Relationships

References:

- game_types (RESTRICT on delete)

Referenced by:

- routine_steps

## Design Rationale

An exercise template binds a game type to a reusable definition that routines can compose.

Deleting a game type is restricted while templates exist, protecting template integrity.

Runtime sessions never reference this table; they receive copied values through the configuration snapshot.

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
- duration_type
- duration_value
- created_at

## Relationships

References:

- routine_templates (CASCADE on delete)
- exercise_templates (RESTRICT on delete)

## Design Rationale

Steps are the composition mechanism: a routine is an ordered list of exercise references, each with its own duration.

`sequence_number` defines execution order explicitly rather than relying on insertion order.

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


# Template Layer Summary

The Template Layer provides mutable, reusable gameplay definitions.

These entities are:

- user-facing and editable
- composed (routines contain ordered steps referencing exercises)
- copied into runtime snapshots, never referenced by runtime
- split into system content and user content through `is_system_template` and nullable ownership

The Runtime Layer records what actually happened when these definitions are executed.

---

