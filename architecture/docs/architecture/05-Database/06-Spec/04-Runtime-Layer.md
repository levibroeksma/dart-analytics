<!--
status: canonical
scope: database/runtime-layer
read-when: adding/changing activities, sessions, stages, turns, darts, idempotency
updated: 2026-07-13
-->

# Database Specification — Chapter 4: Runtime Layer

> Part of the canonical Database Specification (v2.2.0). Cross-layer invariants (identifier/timestamp strategy, ownership model, runtime event and configuration snapshot models) live in `../06-Database-Specification.md`. Content moved verbatim from the v2.1.0 monolith on 2026-07-11.

---

# Runtime Layer

## Purpose

The Runtime Layer stores what actually happened.

Runtime data is the historical truth of the application.

Every statistic, replay and analysis is derived from this layer.

---

# Design Principles

Runtime entities must:

- use UUIDv7 primary keys
- record actual values, never references to mutable definitions
- remain mutable only while a session is active
- become immutable once the session is COMPLETED
- form an explicit hierarchy with no polymorphic foreign keys

The hierarchy is:

```
Activity

↓

Exercise Session

↓

Exercise Stage (hierarchical)

↓

Turn

↓

Dart
```

Participants attach to the exercise session.

---

# activities

## Purpose

Represents a user interaction lifecycle — the "why is the player playing?" container.

Example:

```
User opens app

Starts TUOD

Closes browser

Activity remains recoverable
```

## Ownership

Owned by the player.

## Lifecycle

ACTIVE → COMPLETED or ABANDONED.

Terminal transitions (COMPLETED/ABANDONED) set completed_at. In-progress recovery is client-local (persisted frontend state); the abandon flow is client-driven. <!-- 2026-07-13 -->

## Primary Key

UUIDv7

## Key Columns

- id
- player_id
- status_id
- started_at
- completed_at (nullable)
- created_at

## Relationships

References:

- players (CASCADE on delete)
- game_statuses (RESTRICT on delete)

Referenced by:

- exercise_sessions

## Constraints

- completed_at must be after started_at when present

## Design Rationale

Activities separate application usage from gameplay execution.

One activity can contain multiple exercise sessions (for example a routine run executing several exercises).

---

# exercise_sessions

## Purpose

Represents an actual played game or exercise — the "which engine is active?" record.

## Ownership

Owned by the player, grouped under an activity.

## Lifecycle

Mutable during play.

Immutable after COMPLETED.

## Primary Key

UUIDv7

## Key Columns

- id
- activity_id
- player_id
- game_type_id
- capture_mode_id
- input_mode_id
- status_id
- ruleset_version_id
- started_at
- completed_at (nullable)
- created_at

## Relationships

References:

- activities (CASCADE)
- players (CASCADE)
- game_types (RESTRICT)
- capture_modes (RESTRICT)
- input_modes (RESTRICT)
- game_statuses (RESTRICT)
- ruleset_versions (RESTRICT)

Referenced by:

- exercise_configurations
- participants
- exercise_stages

## Constraints

- completed_at must be after started_at when present

## Rules

A player can have only one active exercise session per game type.

Terminal statuses (COMPLETED, ABANDONED) always set completed_at ("when the session ended"); ACTIVE ⇔ completed_at IS NULL is a service-enforced invariant that uq_sessions_single_active keys on. <!-- 2026-07-13 -->

## Design Rationale

The session stores the actual capture mode, input mode and ruleset version used — copied from settings and templates at start.

This makes every session self-describing: replay needs nothing outside the runtime layer.

The direct `player_id` reference (alongside `activity_id`) is a deliberate, controlled denormalisation for query efficiency on the most common access path.

---

# exercise_configurations

## Purpose

Stores the immutable configuration snapshot used during execution.

## Ownership

Owned by the exercise session.

## Lifecycle

Written once at session start.

Never updated.

## Primary Key

UUIDv7

## Key Columns

- id
- exercise_session_id (unique)
- configuration (JSONB)
- created_at

## Relationships

References:

- exercise_sessions (CASCADE, 1:1 via unique constraint)

## Constraints

- configuration must be a JSON object

## Design Rationale

Templates may change; historical execution must not.

The snapshot is a JSONB copy of the effective configuration (preset values plus any per-session overrides).

The structure of the JSONB is defined per game type by the ruleset version. The application validates it; the database only guarantees it is a JSON object.

JSONB was chosen over typed per-game child tables because the configuration is written once, read for replay, and never queried relationally. This resolves the earlier typed-vs-JSONB tension in favour of JSONB for snapshots.

---

# participants

## Purpose

Represents who or what took part in a session.

Examples:

- the player
- a guest opponent
- DartBot

## Ownership

Owned by the exercise session.

## Lifecycle

Created at session start.

Immutable after session completion.

## Primary Key

UUIDv7

## Key Columns

- id
- exercise_session_id
- participant_type_id
- player_id (nullable)
- display_name
- created_at

## Relationships

References:

- exercise_sessions (CASCADE)
- participant_types (RESTRICT)
- players (RESTRICT, optional)

Referenced by:

- turns

## Constraints

- display_name is always populated at write time to make replay labels deterministic
- participant_type_id = PLAYER => display_name = players.display_name
- participant_type_id = GUEST => display_name = guest-chosen name
- participant_type_id = DARTBOT => display_name = 'DartBot'
- The PLAYER player_id-presence and DartBot display-name rules are DB CHECK constraints keyed on seeded ids 1/3 (migration 0005); the GUEST naming rule is application-enforced. <!-- 2026-07-13 -->

## Design Rationale

Participants belong to the exercise session, not the activity, because opposition is a property of a specific game.

Guest identity is minimal by design: only outcome relevance is required, not account creation.

Replay labels use persisted `display_name`, so replay output does not depend on nullable labels or later player-profile edits.

---

# session_write_idempotency

## Purpose

Stores persisted outcomes for `POST /api/sessions/:sessionId/events:batch` so the API can honor idempotent retries.

## Ownership

Owned by the exercise-session write path (Runtime Layer).

## Lifecycle

Written when a batch-write request is accepted for persistence.

Historical records are immutable once stored.

## Primary Key

UUIDv7

## Key Columns

- id
- session_id
- idempotency_key
- normalized_payload_hash
- result
- created_at

## Relationships

References:

- exercise_sessions (CASCADE)

## Constraints

- (session_id, idempotency_key) must be unique
- result must be a JSON object

## Design Rationale

The API contract defines idempotency behavior for batch writes. Persisting the stored result keyed by `(session_id, idempotency_key)` allows the server to return the prior outcome for matching payload hashes and reject conflicting payload reuse.

---

# exercise_stages

## Purpose

Represents hierarchical subdivisions of gameplay.

Examples:

501:

```
Match

  Set

    Leg
```

Routine:

```
Exercise block
```

## Ownership

Owned by the exercise session.

## Lifecycle

Created as gameplay progresses.

Immutable after session completion.

## Primary Key

UUIDv7

## Key Columns

- id
- exercise_session_id
- parent_stage_id (nullable, self-reference)
- stage_type_id
- sequence_number
- created_at

## Relationships

References:

- exercise_sessions (CASCADE)
- exercise_stages (self, CASCADE)
- stage_types (RESTRICT)

Referenced by:

- turns

## Constraints

- sequence_number must be positive
- a stage cannot be its own parent

## Rules

The current stage is never stored — it is derived from the latest stage, turn and dart.

## Design Rationale

A single generic hierarchy with typed stages supports every game structure (sets/legs, rounds, exercise blocks) without per-game stage tables.

Game engines decide which stage types they create; the database stays game-agnostic.

---

# turns

## Purpose

Represents one visit to the oche.

## Ownership

Owned by an exercise stage, thrown by a participant.

## Lifecycle

Created when the visit starts.

`completed_at` is the client-observed end of the visit (from `TurnFact.completedAt`); NULL means the visit never completed. It may legitimately precede `created_at` (persistence time) under batch upload — migration `0015` removed the old ordering check. <!-- 2026-07-13 -->

Immutable after session completion.

## Primary Key

UUIDv7

## Key Columns

- id
- exercise_stage_id
- participant_id
- sequence_number
- total_score
- completed_at (nullable)
- created_at

## Relationships

References:

- exercise_stages (CASCADE)
- participants (RESTRICT)

Referenced by:

- darts

## Constraints

- sequence_number must be positive

## Rules

The maximum number of darts per turn is owned by the ruleset, not by a database constraint.

## Design Rationale

`total_score` is a controlled denormalisation: it duplicates the sum of dart scores so recreational sessions can store turn totals **without any dart rows**, and so common queries avoid aggregating darts.

The application is the only writer and keeps `total_score` consistent with dart rows when they exist.

---

# darts

## Purpose

Stores individual dart events — the atomic analytical fact.

One row = one thrown dart.

## Ownership

Owned by the turn.

## Lifecycle

Written as thrown.

Immutable after session completion.

## Primary Key

UUIDv7

## Key Columns

- id
- turn_id
- dart_number
- intended_target_number (nullable)
- intended_zone_id (nullable)
- hit_target_number (nullable)
- hit_zone_id (nullable)
- score
- created_at

## Relationships

References:

- turns (CASCADE)
- dart_zones (intended and hit, RESTRICT)

## Constraints

- dart_number must be positive
- score must be zero or positive
- target numbers must be between 1 and 25 when present
- intention consistency: a target number requires a zone
- hit consistency: a target number requires a zone

## Rules

Capture depth follows the session's capture mode:

- RECREATIONAL + QUICK_SCORE — dart rows omitted entirely (turn totals only)
- RECREATIONAL + DETAILED_DARTS — hit-only dart rows (intention pair NULL) <!-- 2026-07-13 -->
- ANALYTICS — every dart stores full intention and result

## Design Rationale

The intention + result pair is the analytical core of the entire platform:

- intended vs hit zone → accuracy
- intended vs hit target → miss direction tendencies
- zone joins → double/treble performance

There is **no multiplier column** — the multiplier is derived from the zone. Storing it would duplicate truth.

`location_x` / `location_y` board coordinates are deferred: the current schema does not define these columns, and they may be added in a future schema revision when the UI can capture them.

---

# Runtime Immutability Boundary

After a session reaches COMPLETED, the following must never change:

- darts
- turns
- stages
- participants
- configuration snapshot
- ruleset reference

Corrections are new records, never updates.
This immutability is application-enforced in the current architecture; the documentation does not assume database-side triggers or workflow enforcement.

Active sessions remain mutable — interrupted turns are completed, stages are appended, scores accumulate.

---


# Runtime Layer Summary

The Runtime Layer is the factual heart of the database.

Its entities:

- form an explicit, non-polymorphic hierarchy
- store actual values, never template references
- support partial capture (recreational) and full capture (analytics)
- become immutable historical truth at completion
- contain everything required for deterministic replay

The Read Model Layer exposes this truth through stable query interfaces.

---

