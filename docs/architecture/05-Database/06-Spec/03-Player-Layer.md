<!--
status: canonical
scope: database/player-layer
read-when: adding/changing player identity or settings
updated: 2026-08-15
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
- display_name (NOT NULL; set at provisioning: request displayName → JWT name claim → 'Player')
- darts_description (nullable — free-text darts the player uses, e.g. "Winmau Pro-Series 23g")
- darts_weight_grams (nullable SMALLINT, 1-100)
- created_at
- updated_at

## Relationships

Referenced by:

- player_settings
- activities
- exercise_sessions
- participants
- routine_templates

Read through:

- `v_player_profile` (migration `0022`) — display name and darts equipment

## Design Rationale

`display_name` is a configurable nickname (for example "The Power"). It is intentionally **not unique** — it represents persona, not identity.

Initial value comes from POST /api/players/provision. `GET`/`PATCH /api/players/me` (shipped 2026-08-15) is the rename/darts-config endpoint deferred by the note above. <!-- 2026-07-13; rename endpoint shipped 2026-08-15 -->

`darts_description`/`darts_weight_grams` are nullable — a player may never configure equipment — and are edited through the same endpoint as `display_name`, replacing all three fields together (no partial update), matching `PATCH /api/players/me/settings`'s convention. <!-- 2026-08-15 -->

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

**Status:** shipped (2026-08-08). `GET`/`PATCH /api/players/me/settings` read through `v_player_settings` (migration `0021`) and write the table. A player with no settings row reads as `RECREATIONAL` + `QUICK_SCORE`; the row is created lazily on first write, and no backfill runs. Settings remain **defaults only** — they are read at session start and copied onto the session, so changing one never rewrites history. This supersedes D60's deferral clause; the client no longer persists last-used modes locally. A pair no ruleset version declares in `ruleset_version_capabilities` is refused with `VALIDATION_FAILED`, so a player cannot be left in an app mode where no game can be started. <!-- 2026-08-08 -->

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
- capture_modes (`fk_player_settings_capture_mode`)
- input_modes (`fk_player_settings_input_mode`)

Read through:

- `v_player_settings` (migration `0021`) — the two mode ids exposed as `*_key`s

The two mode foreign keys this section has always claimed were never created by migration `0003`; migration `0017` added them. <!-- 2026-08-08 -->

## Design Rationale

The shared primary key enforces a strict 1:1 relationship without an extra identifier.

Changing a default never rewrites history because sessions store the actual values used.

---

