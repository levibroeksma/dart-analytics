<!--
status: canonical
scope: database/reference-layer
read-when: adding/changing lookup tables or seeded reference data
updated: 2026-07-13
-->

# Database Specification — Chapter 1: Reference Layer

> Part of the canonical Database Specification (v2.2.0). Cross-layer invariants (identifier/timestamp strategy, ownership model, runtime event and configuration snapshot models) live in `../06-Database-Specification.md`. Content moved verbatim from the v2.1.0 monolith on 2026-07-11.

---

# Reference Layer

## Purpose

The Reference Layer defines the controlled concepts used throughout the application.

Reference data changes infrequently.

It provides stable definitions reused by templates, runtime entities and views.

Reference entities are owned by the application.

Users cannot modify reference data.

---

# Design Principles

Lookup tables must:

- use SMALLINT primary keys
- expose stable implementation keys
- expose human-readable names
- contain only controlled values
- never store user-specific information

Reference entities are seeded through deterministic seed scripts.

Every seed supplies explicit fixed identifiers.

---

# game_types

## Purpose

Defines every supported playable game or exercise.

## Primary Key

UUIDv7

Game types are domain entities, not lookup values. They participate in the domain identifier strategy.

## Key Columns

- id
- implementation_key
- name
- description
- is_published
- created_at
- updated_at

## Relationships

Referenced by:

- ruleset_versions
- exercise_templates
- exercise_sessions

Linked to features through:

- game_type_features

## Design Rationale

Separating game definitions from implementation allows games to be introduced, hidden or published without affecting runtime data.

Seeded game types:

- 501
- TUOD (Ten Up One Down)
- SINGLES_TRAINING
- SCORE_TRAINING

---

# game_features

## Purpose

Defines reusable capabilities supported by game types.

Seeded examples:

- TIMED_MODE
- ROUNDS_MODE
- OPPONENT_SUPPORT
- DARTBOT_SUPPORT
- DOUBLE_OUT

## Primary Key

SMALLINT

## Relationships

Many-to-many with:

- game_types

---

# game_type_features

## Purpose

Associates game types with supported features.

## Primary Key

Composite primary key:

(game_type_id, game_feature_id)

## Relationships

References:

- game_types
- game_features

## Design Rationale

Normalizes feature assignment and allows future expansion without altering game definitions.

---

# game_statuses

## Purpose

Defines the lifecycle states of an activity or exercise session.

## Primary Key

SMALLINT

## Key Columns

- id
- implementation_key
- name
- description
- created_at

## Relationships

Referenced by:

- activities
- exercise_sessions

## Design Rationale

Using a lookup table instead of booleans enables future expansion without schema changes.

Seeded values:

- ACTIVE
- COMPLETED
- ABANDONED

Additional states (for example PAUSED or CANCELLED) can be introduced through new seed rows without schema change.

---

# capture_modes

## Purpose

Defines how much gameplay detail is captured during a session.

Seeded values:

- RECREATIONAL — stores gameplay with minimal required detail
- ANALYTICS — stores detailed dart-level information

## Primary Key

SMALLINT

## Relationships

Referenced by:

- exercise_sessions

## Design Rationale

Capture depth is a per-session fact. Recreational sessions may store turn totals without individual dart rows. Analytics sessions require full intention and result capture for every dart.

Capture mode × input mode matrix: RECREATIONAL + QUICK_SCORE stores turn totals with no dart rows; RECREATIONAL + DETAILED_DARTS stores hit-only dart rows (no intention); ANALYTICS requires full intention + result on every dart regardless of input mode. <!-- 2026-07-13 -->

---

# input_modes

## Purpose

Defines the user interaction style used to enter gameplay.

Seeded values:

- QUICK_SCORE — fast score entry without individual dart capture
- DETAILED_DARTS — individual dart entry for analytics

## Primary Key

SMALLINT

## Relationships

Referenced by:

- exercise_sessions

## Design Rationale

Input mode is stored on the session so historical data always records how it was captured. Input mode describes interaction; capture mode describes stored detail.

---

# ruleset_versions

## Purpose

Stores immutable rule definitions for each game type.

## Primary Key

UUIDv7

## Key Columns

- id
- game_type_id
- implementation_key
- version_number
- description
- created_at

## Relationships

References:

- game_types

Referenced by:

- exercise_sessions

## Constraints

- (game_type_id, implementation_key) unique
- (game_type_id, version_number) unique

## Design Rationale

Rules evolve through versioning rather than modification.

Historical gameplay references immutable rule versions.

Rulesets own game limits such as maximum darts per turn and score caps. These limits are enforced by the application, not by database CHECK constraints.

---

# dart_zones

## Purpose

Defines every valid dartboard scoring zone.

Seeded values:

- SINGLE
- DOUBLE
- TREBLE
- OUTER_BULL
- INNER_BULL
- MISS

## Primary Key

SMALLINT

## Relationships

Referenced by:

- darts (intended_zone_id and hit_zone_id)

## Design Rationale

Zones make multipliers derivable instead of stored. A dart references the zone it targeted and the zone it hit; scoring meaning is derived from zone plus target number.

---

# participant_types

## Purpose

Defines participant roles within an exercise session.

Seeded values:

- PLAYER
- GUEST
- DARTBOT

## Primary Key

SMALLINT

## Relationships

Referenced by:

- participants

---

# stage_types

## Purpose

Defines the type of stage within an exercise session.

Seeded values:

- MATCH
- SET
- LEG
- ROUND
- EXERCISE_BLOCK

## Primary Key

SMALLINT

## Relationships

Referenced by:

- exercise_stages

## Design Rationale

A controlled lookup keeps the stage hierarchy generic. Game engines decide which stage types they use; the database does not hard-code per-game structures.

---

# duration_types

## Purpose

Defines how an exercise or routine step is measured.

Seeded values:

- ROUNDS
- MINUTES

## Primary Key

SMALLINT

## Relationships

Intended to be referenced by:

- routine_steps

## Design Rationale

Supporting duration through a reference entity allows additional measurement strategies to be introduced without modifying templates.

---

# Reference Layer Summary

The Reference Layer provides stable application definitions.

These entities are:

- immutable after publication where applicable
- centrally managed
- reused throughout the data model
- independent of user data
- optimized using SMALLINT identifiers for lookups and UUIDv7 for domain-level reference entities

The remaining layers build upon these controlled definitions.

---

