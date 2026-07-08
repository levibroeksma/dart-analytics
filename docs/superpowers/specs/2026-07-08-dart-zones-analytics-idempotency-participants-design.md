# Dart zones, analytics filtering, idempotency, participants — Design

## Goal
Align the database seeds, read-model behavior, and runtime invariants with the capture semantics for **Recreational vs Analytics** sessions:
- Dart zone reference data exists in seeds.
- Analytics datasets include only darts where intention is present.
- API idempotency claims have DB-backed persistence.
- Replay labels are deterministic by enforcing `participants.display_name`.

## Non-goals
- Changing replay ordering logic in `v_game_replay`.
- Adding dart coordinate capture (`location_x` / `location_y`) to the current schema.

---
## Execution Constraints (documentation-only)
When implementing this spec, follow these hard rules:
- Scope: only modify files under `architecture/` (aka `@architecture/`).
- No execution: do not run commands (no tests, builds, lint, migrations, seeds, or scripts).
- No database side effects: do not create/alter tables in Neon or any other environment.
- No operational actions: no deploys and no runtime/CI interactions.
- Documentation only: update/author documentation artifacts (markdown and the SQL *spec* files under `architecture/docs/...` as referenced by the decisions). Do not add application/source code outside documentation.

---
## Decisions (approved)

### 1) Add `dart_zones` seed rows
**Decision:** Seed the canonical six zones in `architecture/docs/database/seeds/0001_reference_data.sql`.

**Zones:** `SINGLE`, `DOUBLE`, `TREBLE`, `OUTER_BULL`, `INNER_BULL`, `MISS`.

**IDs:** `1..6` and `created_at = now()` (seed-time deterministic reference data).

---

### 2) Make `v_dart_analytics` include only intention-complete darts
**Decision:** Update `architecture/docs/database/migrations/0009_views.sql` so `v_dart_analytics` filters out darts where intention is incomplete:

- require `darts.intended_target_number IS NOT NULL`
- require `darts.intended_zone_id IS NOT NULL`

**Capture semantics preserved:**
- Recreational/casual games may record earlier darts with `intended_* = NULL`.
- When the “finish window” is reached, the frontend starts providing `intended_*` for those darts.
- `v_dart_analytics` therefore includes only darts that can support accuracy/miss-intent insights.

---

### 3) `location_x` / `location_y` are deferred (docs only)
**Decision:** Remove “reserved columns” wording from the **core** `darts` spec and explicitly classify coordinates as **Deferred** under documentation (future capture/UI capability).

---

### 4) Add DB-backed idempotency persistence
**Decision:** Introduce a runtime-support table to match the frozen API idempotency contract in `architecture/docs/architecture/06-API/00-Overview.md`.

**Migration to add:** `architecture/docs/database/migrations/0012_session_write_idempotency.sql`

**Table responsibility:** store the outcome of `POST /api/sessions/:sessionId/events:batch` requests keyed by idempotency.

**Stored fields (per API contract):**
- `session_id`
- `idempotency_key`
- normalized payload hash
- result (success or error envelope shape) as JSONB

**Uniqueness:** enforce “same session + same idempotency key”.

---

### 5) Runtime immutability is application-enforced (docs clarification)
**Decision:** Keep runtime immutability as an application invariant, but make the enforcement boundary explicit in:
- `architecture/docs/architecture/05-Database/06-Database-Specification.md`
- `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md` (so agents don’t assume DB triggers)

---

### 6) Participant labels are deterministic by `display_name`
**Decision:** Enforce that `participants.display_name` is always populated at write time:
- `participant_type = PLAYER` => `display_name = players.display_name`
- `participant_type = GUEST` => `display_name = guest-chosen name`
- `participant_type = DARTBOT` => `display_name = 'DartBot'`

**Schema/doc implications:** update DB constraints and the `participants` entity spec so replay labels are stable.

---
## Stage 4 self-check (what must be consistent after implementation)
- Seeds must match existing migrations/view joins (`dart_zones` exists and is populated).
- View semantics must match analytics definition (intention-complete darts only).
- Docs must not claim current schema columns for deferred features (`location_x/y`).
- API idempotency contract must be backed by a schema artifact.
- Replay must not depend on `participants.display_name` being NULL.

