<!--
status: canonical
scope: database/player-layer
read-when: adding/changing player identity or settings
updated: 2026-07-11
-->

# Database Specification — Chapter 3: Player Layer

> Part of the canonical Database Specification (v2.2.0). Cross-layer invariants (identifier/timestamp strategy, ownership model, runtime event and configuration snapshot models) live in `../06-Database-Specification.md`. Content moved verbatim from the v2.1.0 monolith on 2026-07-11.

---

# Player Layer

## Purpose

The Player Layer bridges external authentication and application-owned data.

Authentication is handled by Neon Auth.

The database never stores credentials.

It stores the application profile and preferences linked to an external identity.

---

# players

## Purpose

Represents a player inside the application.

## Ownership

Owned by the database.

The authentication identity behind it is owned by Neon Auth.

## Lifecycle

Mutable profile data.

Deleting a player cascades to settings, activities and personal templates.

## Primary Key

UUIDv7

## Key Columns

- id
- auth_user_id (unique — external identity reference)
- display_name
- created_at
- updated_at

## Relationships

Referenced by:

- player_settings
- activities
- exercise_sessions
- participants
- routine_templates

## Design Rationale

`display_name` is a configurable nickname (for example "The Power"). It is intentionally **not unique** — it represents persona, not identity.

`auth_user_id` is the only link to the authentication system. Swapping the auth provider would only affect this column.

---

# player_settings

## Purpose

Stores player preferences.

Examples:

- default capture mode
- default input mode

## Ownership

Owned by the player.

## Lifecycle

Mutable.

Settings are **defaults only** — they are read at session start and copied onto the session. They never represent history.

## Primary Key

Shared primary key:

`player_id` is both primary key and foreign key to `players`.

## Key Columns

- player_id
- default_capture_mode_id
- default_input_mode_id
- created_at
- updated_at

## Relationships

References:

- players (CASCADE on delete)
- capture_modes
- input_modes

## Design Rationale

The shared primary key enforces a strict 1:1 relationship without an extra identifier.

Changing a default never rewrites history because sessions store the actual values used.

---

