# Dart Zones, Analytics Filtering, Idempotency, Participants Docs-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the `architecture/` documentation set so it consistently describes dart zones seed data, analytics-view filtering, deferred coordinates, idempotency persistence, runtime immutability boundaries, and deterministic participant display names without performing any non-documentation work.

**Architecture:** This is a docs-only synchronization pass. The work updates the canonical architecture handbook plus the SQL specification artifacts under `architecture/docs/database/` so the written contract is internally consistent, explicit about future schema intent, and limited to documentation changes only. No application code, test files, deployment assets, or non-`architecture/` files are in scope.

**Tech Stack:** Markdown documentation, SQL specification files under `architecture/docs/database/`, architecture handbook files under `architecture/docs/architecture/`

---

## Execution Constraints

- Only modify files under `architecture/`.
- Do not touch any file outside `architecture/`, even if it references the same concepts.
- Do not run commands.
- Do not write tests.
- Do not add or modify application code.
- Do not execute SQL.
- Do not create tables in Neon or any other database.
- Do not deploy anything.
- Treat `architecture/docs/database/migrations/*.sql` and `architecture/docs/database/seeds/*.sql` as documentation/spec artifacts only.

---

## File Structure

### Files to modify

- `architecture/docs/database/seeds/0001_reference_data.sql`
  - Document the canonical `dart_zones` seed rows in the seed spec artifact.
- `architecture/docs/database/migrations/0009_views.sql`
  - Document `v_dart_analytics` as intention-complete darts only.
- `architecture/docs/database/migrations/0012_session_write_idempotency.sql`
  - Add the new migration spec artifact that documents the idempotency persistence table contract.
- `architecture/docs/architecture/06-API/00-Overview.md`
  - Keep the API idempotency contract aligned with the new schema artifact wording.
- `architecture/docs/architecture/05-Database/06-Database-Specification.md`
  - Update the canonical database spec for deferred coordinates, participant display names, analytics view semantics, runtime immutability boundary wording, and the new idempotency persistence artifact.
- `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`
  - Clarify the enforcement boundary and add explicit docs-only guidance for this workstream if needed.
- `architecture/docs/architecture/05-Database/03-Migrations.md`
  - Extend the migration chain documentation to include `0012_session_write_idempotency.sql`.
- `architecture/docs/architecture/05-Database/05-Views.md`
  - Align view semantics for `v_dart_analytics` with the intended filtered dataset.
- `architecture/000_master_context.md`
  - Update the architecture master context only if it still states contradictory facts about deferred coordinates, analytics capture, participant display names, or migration-chain state.

### Files intentionally not in scope

- Everything outside `architecture/`
- Any runtime app code
- Any test files
- CI, deployment, or infrastructure files

---

### Task 1: Add the Docs-Only Migration Spec Artifact

**Files:**
- Create: `architecture/docs/database/migrations/0012_session_write_idempotency.sql`
- Modify: `architecture/docs/architecture/05-Database/03-Migrations.md`
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/docs/architecture/06-API/00-Overview.md`

- [ ] **Step 1: Create the `0012` SQL spec file as documentation only**

```sql
-- ============================================================
-- Migration: 0012_session_write_idempotency.sql
--
-- Purpose:
-- Document the schema artifact that backs batch-write idempotency.
--
-- Documentation-only artifact:
-- This file is part of the architecture specification set.
-- It must not be executed as part of this work.
--
-- ============================================================
BEGIN;

CREATE TABLE session_write_idempotency (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_session_write_idempotency_session
        FOREIGN KEY (session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_session_write_idempotency_session_key
        UNIQUE (session_id, idempotency_key),
    CONSTRAINT chk_session_write_idempotency_result_object
        CHECK (jsonb_typeof(result) = 'object')
);

COMMENT ON TABLE session_write_idempotency IS
    'Stores batch-write idempotency results for POST /api/sessions/:sessionId/events:batch.';

COMMIT;
```

- [ ] **Step 2: Add `0012_session_write_idempotency.sql` to the migration handbook**

```md
## 0012_session_write_idempotency.sql

Purpose:

Document the schema artifact for batch-write idempotency persistence.

Contains:

- session_write_idempotency

Stores:

- session_id
- idempotency_key
- normalized payload hash
- result envelope as JSONB

Constraint highlights:

- unique per `(session_id, idempotency_key)`

This file is an architecture documentation artifact in the current workstream and is not to be executed here.
```

- [ ] **Step 3: Add a new entity section to the canonical database specification**

```md
# session_write_idempotency

## Purpose

Stores persisted outcomes for `POST /api/sessions/:sessionId/events:batch` so the API can honor idempotent retries.

## Ownership

Owned by the exercise session write path.

## Lifecycle

Written when a batch-write request is accepted for persistence.

Historical records are immutable once stored.

## Primary Key

UUIDv7

## Key Columns

- id
- session_id
- idempotency_key
- payload_hash
- result
- created_at

## Relationships

References:

- exercise_sessions (CASCADE)

## Constraints

- `(session_id, idempotency_key)` must be unique
- `result` must be a JSON object

## Design Rationale

The API contract already requires idempotent batch writes. This artifact documents the persistence layer that stores prior outcomes so retries with the same request can return the stored result while mismatched payload reuse is rejected.
```

- [ ] **Step 4: Tighten the API overview wording to point at the schema artifact**

```md
### Idempotency

- Require `Idempotency-Key` on batch write requests.
- Server stores (`session_id`, `idempotency_key`, normalized payload hash, result).
- Same key + same hash -> return stored result.
- Same key + different hash -> `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- The architecture documentation set defines the backing schema artifact in `architecture/docs/database/migrations/0012_session_write_idempotency.sql`.
```

- [ ] **Step 5: Verify the wording stays documentation-only**

```md
Checklist:
- the new `0012` file is described as a specification artifact
- no step instructs anyone to execute SQL
- no text claims Neon has already been changed
- all references remain under `architecture/`
```

---

### Task 2: Document the Canonical Dart Zones Seed Rows

**Files:**
- Modify: `architecture/docs/database/seeds/0001_reference_data.sql`
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/000_master_context.md`

- [ ] **Step 1: Insert the canonical `dart_zones` seed rows into the seed spec artifact**

```sql
-- ============================================================
-- Dart zones
-- ============================================================
INSERT INTO dart_zones (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'SINGLE',
        'Single',
        'Single scoring segment.',
        now()
    ),
    (
        2,
        'DOUBLE',
        'Double',
        'Double scoring ring.',
        now()
    ),
    (
        3,
        'TREBLE',
        'Treble',
        'Treble scoring ring.',
        now()
    ),
    (
        4,
        'OUTER_BULL',
        'Outer Bull',
        'Outer bull scoring area.',
        now()
    ),
    (
        5,
        'INNER_BULL',
        'Inner Bull',
        'Inner bull scoring area.',
        now()
    ),
    (
        6,
        'MISS',
        'Miss',
        'Thrown dart that misses a scoring segment.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Confirm the database specification’s `dart_zones` section matches the same six values**

```md
Seeded values:

- SINGLE
- DOUBLE
- TREBLE
- OUTER_BULL
- INNER_BULL
- MISS
```

- [ ] **Step 3: Update the master context if it still implies dart zones are pending rather than documented**

```md
- `dart_zones` is part of the canonical reference set with six documented values:
  `SINGLE`, `DOUBLE`, `TREBLE`, `OUTER_BULL`, `INNER_BULL`, `MISS`.
```

- [ ] **Step 4: Verify terminology consistency**

```md
Checklist:
- IDs are `1..6`
- keys are uppercase snake case
- `MISS` is included everywhere the canonical list appears
```

---

### Task 3: Narrow `v_dart_analytics` to Intention-Complete Darts

**Files:**
- Modify: `architecture/docs/database/migrations/0009_views.sql`
- Modify: `architecture/docs/architecture/05-Database/05-Views.md`
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/000_master_context.md`

- [ ] **Step 1: Add the filter to the SQL spec artifact for `v_dart_analytics`**

```sql
CREATE VIEW v_dart_analytics AS
SELECT es.player_id,
    gt.implementation_key AS game_type,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL;
```

- [ ] **Step 2: Update the View Strategy text to describe the filtered dataset**

```md
| `v_dart_analytics` | Analytics | Flat dart dataset limited to intention-complete darts |
```

- [ ] **Step 3: Update the database specification’s `v_dart_analytics` section**

```md
## Purpose

Flat, analytics-ready dart dataset limited to darts that contain intention data.

## Sources

- darts → turns → exercise_stages → exercise_sessions → game_types
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Player, game type, intended target/zone, hit target/zone, score, and a computed `exact_hit` flag.

## Design Rationale

Analytics depends on intended-vs-hit comparisons. Recreational or partially captured darts without intention data remain valid runtime facts, but they are excluded from this analytics view because they cannot support accuracy or miss-intent analysis.
```

- [ ] **Step 4: Align the master context summary**

```md
- `v_dart_analytics` is intentionally narrower than raw dart history: it includes only darts with both `intended_target_number` and `intended_zone_id`.
```

- [ ] **Step 5: Verify no document still describes `v_dart_analytics` as “all darts”**

```md
Checklist:
- analytics wording says “intention-complete” or equivalent
- replay wording remains unchanged
- no document claims recreational darts are invalid data
```

---

### Task 4: Mark Coordinates as Deferred Documentation, Not Current Schema

**Files:**
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/000_master_context.md`

- [ ] **Step 1: Replace the “reserved current columns” wording in the `darts` section**

```md
`location_x` / `location_y` board coordinates are deferred documentation-only future expansion items. They are not part of the current schema contract.
```

- [ ] **Step 2: Move any coordinate discussion into future-expansion wording**

```md
- miss tendency analysis may later use `location_x` / `location_y` if capture support is introduced in a future schema revision
```

- [ ] **Step 3: Update the master context if it still claims coordinates are already reserved**

```md
- Coordinates are deferred. The current architecture does not define `location_x` / `location_y` as present schema columns.
```

- [ ] **Step 4: Verify the deferred status is explicit**

```md
Checklist:
- “deferred” appears near every coordinate reference
- no sentence implies the columns exist today
- no migration file outside the new documentation text is instructed to add them
```

---

### Task 5: Clarify Runtime Immutability as Application-Enforced

**Files:**
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`
- Modify: `architecture/000_master_context.md`

- [ ] **Step 1: Tighten the canonical immutability boundary wording in the database specification**

```md
After a session reaches COMPLETED, runtime history is immutable by architectural rule.

This immutability is application-enforced in the current design.

The documentation does not define database triggers or other database-side workflow enforcement for this rule.
```

- [ ] **Step 2: Add the same enforcement-boundary clarification to the agent guide**

```md
## Runtime immutability boundary

Completed runtime history is immutable by architectural contract.

In the current design, this rule is enforced by the application layer and supporting write-path behavior, not by database triggers documented in the schema artifacts.
```

- [ ] **Step 3: Align the master context summary if needed**

```md
- Runtime immutability remains a frozen rule, but its enforcement boundary is application-side in the current architecture.
```

- [ ] **Step 4: Verify no document claims DB triggers enforce immutability**

```md
Checklist:
- “application-enforced” wording is present
- no trigger-based enforcement claim remains
- completed-session immutability is still described as mandatory
```

---

### Task 6: Make Participant Display Names Deterministic

**Files:**
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/docs/database/migrations/0005_runtime_core.sql`
- Modify: `architecture/docs/database/migrations/0009_views.sql`
- Modify: `architecture/000_master_context.md`

- [ ] **Step 1: Update the `participants` entity contract in the database specification**

```md
## Key Columns

- id
- exercise_session_id
- participant_type_id
- player_id (nullable)
- display_name
- created_at

## Constraints

- `display_name` must always be populated
- `PLAYER` participants use `players.display_name`
- `GUEST` participants use the guest-provided name
- `DARTBOT` participants use `DartBot`

## Design Rationale

Replay consumers need a deterministic label at read time. Persisting a non-null session-scoped `display_name` prevents replay output from depending on nullable participant labels or future player-profile edits.
```

- [ ] **Step 2: Update the runtime-core SQL spec artifact so the documented column is non-null**

```sql
CREATE TABLE participants (
    id UUID PRIMARY KEY,
    exercise_session_id UUID NOT NULL,
    participant_type_id SMALLINT NOT NULL,
    player_id UUID,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
```

- [ ] **Step 3: Preserve replay semantics while making the label assumption explicit**

```sql
COMMENT ON VIEW v_game_replay IS
    'Reconstructs chronological gameplay events using persisted participant display names.';
```

- [ ] **Step 4: Update the master context summary**

```md
- Participants persist a non-null session-scoped `display_name` so replay labels are deterministic for PLAYER, GUEST, and DARTBOT participants.
```

- [ ] **Step 5: Verify no document still permits nullable replay labels**

```md
Checklist:
- `participants.display_name` is documented as required
- replay wording assumes persisted labels
- no sentence says labels may be NULL for normal runtime rows
```

---

### Task 7: Final Docs-Only Consistency Pass

**Files:**
- Modify: `architecture/docs/architecture/05-Database/03-Migrations.md`
- Modify: `architecture/docs/architecture/05-Database/05-Views.md`
- Modify: `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- Modify: `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`
- Modify: `architecture/docs/architecture/06-API/00-Overview.md`
- Modify: `architecture/000_master_context.md`

- [ ] **Step 1: Re-read the spec decisions and map each one to an updated architecture file**

```md
Coverage map:
- dart_zones seeds -> `architecture/docs/database/seeds/0001_reference_data.sql`
- analytics filter -> `architecture/docs/database/migrations/0009_views.sql`, `05-Views.md`, `06-Database-Specification.md`
- deferred coordinates -> `06-Database-Specification.md`, `architecture/000_master_context.md`
- idempotency persistence -> `0012_session_write_idempotency.sql`, `03-Migrations.md`, `06-Database-Specification.md`, `06-API/00-Overview.md`
- runtime immutability boundary -> `06-Database-Specification.md`, `10-Database-Agent-Guide.md`
- deterministic participant labels -> `0006_runtime_events.sql`, `0009_views.sql`, `06-Database-Specification.md`
```

- [ ] **Step 2: Remove contradictory wording**

```md
Remove or rewrite any sentence that still says:
- coordinates are already current columns
- analytics includes every dart row
- idempotency lacks a schema artifact
- participant display names may be absent in replay
- database triggers currently enforce runtime immutability
```

- [ ] **Step 3: Reconfirm scope compliance**

```md
Scope check:
- every changed file lives under `architecture/`
- no step added tests
- no step added runtime/app code
- no step instructed command execution
- no step required Neon access
```

- [ ] **Step 4: Leave the documentation set in a handoff-ready state**

```md
Handoff note:
This plan produces architecture documentation updates only. It does not authorize SQL execution, schema rollout, database mutation, or application implementation.
```
