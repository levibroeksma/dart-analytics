# Master context Dart Analytics Architecture

# Context Summary — Prompts 1–81 (Complete) + Continuation Session

**Handoff note:** Complete architectural journey through frozen v1.0 domain model, SQL foundation (`0001`–`0009`), doc-sync of `05-Database/00`–`05`, and **`06-Data-Model` canonical specification Parts 1–3** (foundation + Reference Layer + Template Layer) now saved to `architecture/docs/architecture/05-Database/06-Data-Model.md` (v2.0.0). Formal outputs in `architecture/docs/` — validate existing files; do not regenerate.

**Continuation session (2026-07-07):** Conversation Parts 1–2 (delivered in chat only) were persisted to the repo, replacing the stale pre-pivot 06 doc. The canonical specification is now **complete** (Parts 1–5): foundation, Reference Layer, Player Layer, Template Layer (+ planned configuration_templates), Runtime Layer, Read Model Layer (5 views from 0009 documented per-view), Relationship Matrix, complete Mermaid ERD, Future Expansion, Architectural Decisions Summary. Per-table structure: Purpose/Ownership/Lifecycle/Columns/Relationships/Constraints/Design Rationale plus Reconciliation Notes per layer. Layer model expanded to five (Player Layer inserted between Reference and Template).

**Decisions made in continuation session:**

1. **configuration_templates = separate JSONB preset table** (mirrors `exercise_configurations.configuration`); planned as migration `0010_configuration_templates.sql`; unblocks `seeds/0002_default_templates.sql`. Columns: id UUIDv7, game_type_id, player_id (nullable, NULL = system), name, description, configuration JSONB, is_system_template, timestamps.
2. **JSONB-vs-typed config tension resolved**: JSONB for both preset and snapshot (written once, read for replay, never queried relationally); ruleset version defines structure; application validates.
3. **Read Model scope**: document only the 5 existing views from `0009`; future analytics views listed under Future Expansion only.
4. **Confirmed migration defect (fixed)**: `0004` defined `routine_steps.duration_type TEXT`, but `0009`'s `v_routine_execution` joins `rs.duration_type_id`. `0004` corrected in place to `duration_type_id SMALLINT` + FK (permissible — no live database yet).

**Migration chain fixes (continuation session):**

- `007_constraints.sql` renamed to `0007_constraints.sql`.
- **`0010_configuration_templates.sql` written**: JSONB preset table with FK to game_types (RESTRICT) and players (CASCADE), CHECK name not empty, CHECK jsonb object, CHECK system presets have NULL player_id; indexes on game_type_id and partial on player_id.
- **`0011_ordering_and_uniqueness.sql` written**: uq_routine_steps_sequence; partial unique indexes for stage sibling/root ordering (nullable parent); uq_turns_stage_participant_sequence; uq_darts_turn_number; **uq_sessions_single_active (player_id, game_type_id) WHERE completed_at IS NULL** — one-active-session rule now DB-enforced; drops redundant 0008 indexes (idx_routine_steps_template_sequence, idx_darts_turn_number).
  **Continuation session additions (polish + agent guides):**

- Holistic 10/10 polish pass complete across `README`, `01`–`04`, `05-Database/00`–`05`, `06-Database-Specification` v2.1.0. Layer model aligned to five layers everywhere. Pattern 5 rewritten (JSONB snapshot). Stale reconciliation notes removed from spec.
- `10-Database-Agent-Guide.md` written — condensed DB rules for agents.
- `AGENT.md` written at project root — project-level agent operating manual with doc map, authority order, task routing, forbidden actions.
  **API design decisions (continuation session):**

- **Runtime:** Cloudflare Workers via `@astrojs/cloudflare` adapter. Application lives in `app/`.
- **Rationale:** European Cloudflare hosting to minimize latency to Neon PostgreSQL on AWS Frankfurt.
- **Implication:** API = Astro server endpoints on Workers (not separate Node service). Database access requires Neon serverless driver (`@neondatabase/serverless`) — no traditional TCP connection pool on Workers.
- **Auth transport decision:** **A selected** — Bearer JWT in `Authorization` header (stateless) as the scalable baseline for multi-client/commercial growth. Implement auth extraction once in Astro middleware and pass identity via `locals` to route handlers.
- **Route style decision:** Resource-first REST by domain (`/api/sessions`, `/api/routines`, `/api/statistics`) with one explicit batch write action endpoint: `POST /api/sessions/:sessionId/events:batch`.
- **UUID ownership decision:** Cloudflare Worker/API generates UUIDv7 for runtime persistence entities; frontend sends gameplay-derived payloads only (no persistence UUIDs).
- **Read contract decision:** Reads are view-backed (`v_active_sessions`, `v_session_overview`, `v_game_replay`, `v_dart_analytics`, `v_routine_execution`) and player-scoped.
- **Error contract decision:** Standard API envelope (`ok/data/requestId` for success, `ok/error/requestId` for failure) with explicit domain error codes and retryable semantics for transient failures.

**API freeze update (2026-07-08):**

- `architecture/docs/architecture/06-API/00-Overview.md` moved from `0.1.0 (draft baseline)` to **`1.0.0 (frozen v1 API baseline)`**.
- Worker-to-DB security model frozen for v1: **trusted Worker service-role only**; PostgreSQL RLS explicitly deferred as post-v1 defense-in-depth.
- JWT middleware verification contract frozen to required claims: **`sub` + `exp`**.
- Identity mapping clarified: JWT `sub` maps to `players.auth_user_id`, and middleware provides `locals.auth` (`authUserId`, `playerId`, minimal claim subset).
- Auth failure mapping frozen: `401 UNAUTHORIZED` for missing/invalid/expired/missing-required-claims tokens; `403` for domain authorization failures (`PLAYER_NOT_PROVISIONED`, `SESSION_OWNERSHIP_MISMATCH`).
- Statistics API v1 scope narrowed and frozen to **`GET /api/statistics/overview`**; `trends` and `checkouts` explicitly deferred post-v1.

**Purpose:** Validate `architecture/docs/` remains aligned with original conversational intent. Use the Validation Checklist at the end.

---

## Project & Platform

Personal darts scoring app. **Long-term player progression tracking** — rich statistics over months/years, not just game results.

**Game engines (4):**

| Engine           | Key config                                                   |
| ---------------- | ------------------------------------------------------------ |
| 501              | Legs/sets, double out; solo/guest/DartBot                    |
| TUOD             | Target 41; +10 on 3-dart finish, −1 on miss; rounds or timed |
| Score training   | Rounds or timed                                              |
| Singles training | Order modes; normal/hard/extreme difficulty                  |

**Also:** Pre-configured + user-defined training routines.

**Tech:** Astro.js, TypeScript, Alpine.js. Cloudflare Workers-hosted proxy API ↔ Neon (Frankfurt). Game engine in TypeScript frontend; backend = persistence/query.

**Operator:** Solo developer. Low ops complexity, PostgreSQL best practices, extensibility.

**Platform:** Exercise Execution Platform. **Games extensible. Rulesets immutable.**

**Design principle:** Store what happened. Derive what it means.

---

## Frozen Domain Model (v1.0)

```
Neon Auth → Player → Activity → Exercise Session
    → exercise_configurations → exercise_stage → Turn → Dart
```

### Three universal concepts

1. **Activity** — why is the player playing? (resumable container)
2. **Exercise Session** — which engine is active? (gameplay record)
3. **Dart** — what physically happened? (atomic analytical fact)

### Entity layers

| Layer      | Entities                                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference  | game_types (UUID), game_features, game_type_features, game_statuses, capture_modes, input_modes, duration_types, participant_types, stage_types, ruleset_versions (UUID), **dart_zones** (SINGLE, DOUBLE, TREBLE, OUTER_BULL, INNER_BULL, MISS) |
| Player     | players, player_settings (shared PK)                                                                                                                                                                                                            |
| Template   | exercise_templates, routine_templates, routine_steps, configuration_templates                                                                                                                                                                   |
| Runtime    | activities, exercise_sessions, exercise_configurations, participants, exercise_stages, turns, darts                                                                                                                                             |
| Read Model | Views (`v_*`) — API-facing                                                                                                                                                                                                                      |
| Analytics  | Derived views / materialized views (future)                                                                                                                                                                                                     |

### Configuration chain

```
Game Type → Ruleset Version → Configuration Snapshot → Exercise Session
```

- Templates define reusable defaults; runtime **copies** values — no template FK on sessions.
- Three aspects: Rule, Capture, Completion configuration.
- Game config defaults belong in template layer, not reference seeds.

### Runtime event model

```
Exercise Session → Exercise Stage → Turn → Dart
```

- **Turn** = physical oche action (ruleset defines max darts — not hard-coded to 3). Architecture: `total_score`, `completed_at` (NULL = unfinished turn after interrupt). `remaining_before`/`remaining_after`/`is_bust` remain design intent for docs.
- **Dart** = observation. Frozen: `intended_target_number` + `intended_zone_id`, `hit_target_number` + `hit_zone_id`, `score`. No `multiplier` (derived from zone). Recreational 501 may store turn score only with **no dart rows**. Analytics mode requires full intention+result rows. Coordinates deferred: current schema does not define `location_x`/`location_y` (may be added later when UI capture exists).
- **Stage types:** MATCH, SET, LEG, ROUND, EXERCISE_BLOCK (controlled lookup).
- **Participants:** PLAYER, GUEST, DARTBOT on exercise session (not activity).
- One active exercise per game type per player (partial unique index).
- No `current_stage` stored — derive from latest stage → turn → dart.
- Active sessions mutable during play; immutable only after COMPLETED.

### Major architectural pivots (chronological)

| Phase   | Change                                                                                |
| ------- | ------------------------------------------------------------------------------------- |
| 001–002 | Dart-first facts; Visit→Turn; game_progress explored                                  |
| 003     | Activity Session; Game→Exercise Session; abandon generic progress                     |
| 004     | Ruleset entity; three-layer config; first ERD                                         |
| 005–006 | exercise_stage; config/structure symmetry; identity/reference/template                |
| 007     | Runtime complete; all layers frozen; CQRS-lite                                        |
| 008–009 | Doc hierarchy frozen; 15 architecture patterns                                        |
| 010–011 | DB handbook (naming, rules, migrations, indexes, views)                               |
| 012     | Data model + design-gate review (APPROVED WITH REVISIONS)                             |
| 013     | Physical mapping + pre-impl APPROVED                                                  |
| 014     | Hybrid IDs; seeds split; migrations 0003–0006                                         |
| 015     | Views migration; doc sync begins                                                      |
| 016     | Runtime event review; dart_zones + intended/hit darts; 0007 constraints; 0008 indexes |
| 017     | Doc sync: full-file rewrites of 00-Overview, 01-Naming, 02-Design-Rules               |
| 018     | Doc sync: full rewrites of 03-Migrations, 04-Indexes, 05-Views                        |
| 019     | `06` pivots to canonical DB spec; Parts 1–2 delivered (Reference Layer partial)       |

---

## ID Strategy (frozen)

| Table type       | PK                                     |
| ---------------- | -------------------------------------- |
| Domain entities  | UUIDv7 (app-generated)                 |
| Reference/lookup | SMALLINT (explicit fixed IDs in seeds) |

**Rules:** Every INSERT supplies `id`. DB never generates IDs. Finite controlled sets → reference table, not TEXT. Expose both UUID + `implementation_key` in API.

---

## System Architecture

### Four system layers

Presentation → Application → Persistence → Storage. Frontend never touches DB.

### Data flows

- **Write:** Frontend state → single API transaction → runtime tables (batch upload, not per-dart)
- **Read:** Views → Repository → API → Frontend

### CQRS-lite + ownership

| Layer      | Owns                                                             |
| ---------- | ---------------------------------------------------------------- |
| PostgreSQL | Integrity, constraints, truth, replay, aggregation, views        |
| API        | Auth, validation, orchestration, snapshot creation, transactions |
| Frontend   | UX, game engine, temp state                                      |

API never exposes raw tables. Repository pattern (Controller → Service → Repository → DB).

**Database = reality; API = application behaviour and business workflows; frontend = interaction.**

---

## Frozen Principles

**Core values (priority):** Correctness → Simplicity → Consistency → Maintainability → Extensibility → Performance.

**Key rules:**

1. Facts immutable after COMPLETED
2. Darts = source of truth for all statistics
3. Game engines own config/stage tables (Open/Closed)
4. Published rulesets never change — new behavior = new ruleset/version
5. Sessions snapshot everything for replay
6. Settings = defaults only — never history
7. No JSONB/EAV/polymorphic FKs for core gameplay (JSONB OK for metadata/import only)
8. UUIDv7 app-generated; TIMESTAMPTZ UTC
9. Frontend executes; DB owns truth
10. Views as API read contracts
11. Config copied not referenced
12. One responsibility per migration/table/endpoint
13. Optimize after measuring
14. Controlled denormalisation OK when query-critical (`turn.total_score` + `dart.score`; app controls writes)
15. Ruleset owns game limits (max darts per turn, score caps) — not DB CHECK constraints

**15 architecture patterns** documented in `04-Architecture-Patterns.md` including: Immutable Runtime, Config Snapshot, Typed Config, Derived Analytics, Migration Isolation, Feature Expansion, Review Matrix.

**Anti-patterns:** Generic EAV, logic duplication, direct table exposure, premature abstraction, mutable history, storing derivable statistics.

---

## Documentation System

### Frozen hierarchy

```
architecture/
  00-README, 01-Principles, 02-System-Architecture, 03-Engineering-Workflow
  04-Architecture-Patterns, 05-Database/ (00–10), 06-API/, 07-Frontend/, 08-AI/, 09-ADR/
database/
  migrations/ (0001–0009), seeds/
```

**Discipline:** Hierarchy immutable (ADR for changes). Sequential: foundation → DB docs → SQL → doc sync. Draft all → holistic refine → freeze.

**Doc review workflow (frozen):** One file at a time; **complete replacement document** per review (no nested incremental markdown). Compare doc → implementation → fix only deviations.

### Database handbook status

| Doc                                                    | Status                                                                                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00-Overview                                            | Rewritten and intended frozen (validate repo)                                                                                                                                                                 |
| 01-Naming-Conventions                                  | Rewritten (validate repo)                                                                                                                                                                                     |
| 02-Design-Rules                                        | Rewritten (validate repo)                                                                                                                                                                                     |
| 03-Migrations                                          | Rewritten v1.1.0 (continuation session) — documents `0001`–`0011` + seeds 0001–0002; conversational wrapper text removed; in-place correction policy for unapplied migrations documented                      |
| 04-Indexes                                             | Rewritten v1.1.0 (continuation session) — adds 0011 ordering/lifecycle uniqueness sections, redundancy rule, 0010 preset indexes; stale column examples fixed                                                 |
| 05-Views                                               | Rewritten — three view categories + replay rules (validate repo)                                                                                                                                              |
| 06-Database-Specification (renamed from 06-Data-Model) | **Complete (v2.0.0)** — all five layers + Read Model + Relationship Matrix + Mermaid ERD + Future Expansion + Architectural Decisions                                                                         |
| 07–09                                                  | **Synced (continuation session)** — marked HISTORICAL RECORD with superseded-decisions tables pointing to 06 spec; original review content preserved unmodified (immutable history principle applied to docs) |
| 10-Database-Agent-Guide                                | Proposed                                                                                                                                                                                                      |

### Engineering workflow (10 phases)

Request → Discovery → Analysis → Architecture → Design → Review → Implementation → Validation → Documentation → Release.

---

## SQL Implementation

### Migrations vs seeds

Migrations = schema only. Seeds = controlled reference data (`0001_reference_data.sql`, `0002_default_templates.sql` — delivered in continuation session).

**seeds/0002 contents:** 4 system exercise templates (one per game), 8 configuration presets (2 per game; UUID range `0198f300-*`), 1 system routine "Standard Practice" (Singles 15 min → Score 20 min → TUOD 10 rounds). UUID allocation: `0198f200-*` exercise templates, `0198f300-*` config templates, `0198f400-*` routines, `0198f500-*` steps. JSONB config keys (first draft, application-validated): 501 `starting_score/legs_to_win/sets_to_win/check_in/check_out/max_darts_per_turn`; TUOD `starting_target/finish_bonus/miss_penalty/duration_type/duration_value`; Singles `order_mode/difficulty`; Score Training `duration_type/duration_value`.

### Migration chain (foundation complete)

```
0001_extensions (pg_stat_statements only, no pgcrypto)
0002_reference_tables (+ dart_zones)
0003_players
0004_templates
0005_runtime_core
0006_runtime_events (intended/hit darts, turns.completed_at)
0007_constraints (CHECK/uniqueness; no indexes; ruleset-owned limits omitted)
0008_indexes (access-pattern driven; partial idx_sessions_active)
0009_views
0010_configuration_templates (JSONB presets; continuation session)
0011_ordering_and_uniqueness (sequence uniqueness + single-active-session enforcement; continuation session)
```

### Index philosophy (frozen)

Index real query paths — not every FK. Partial indexes for active sessions. No redundant PK indexes. No premature materialized views or aggregation tables.

### Initial views (5)

| View                | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| v_active_sessions   | Resume interrupted games                                      |
| v_session_overview  | History list                                                  |
| v_game_replay       | Chronological reconstruction                                  |
| v_dart_analytics    | Analytics dataset (intention-complete intended vs hit, zones) |
| v_routine_execution | Routine step definitions                                      |

Views join `implementation_key` values, not IDs alone. Prefix: `v_*` (not `vw_*`).

---

## Statistics Requirements (original wishlist)

Traditional: 3-dart average, first-9, checkout %, double hit %, 180s/140+/tons, highest checkout, win rate vs DartBot, rolling averages, monthly improvement.

Advanced: worst doubles/singles, recovery after bad dart, switch accuracy, miss tendencies (radial/angular), checkout dart position, heatmaps, preferred checkout routes, clutch performance.

All derivable from dart-level facts. Views only — no persisted stat tables.

---

## UI Gap

**Current:** Calculator-style visit score entry. **Target:** Dart as primary input; quick entry via translator to canonical dart records.

---

## Implementation Gaps (architecture vs migrations — reconcile in docs)

| Topic                   | Architecture intent                    | Implementation may differ                          |
| ----------------------- | -------------------------------------- | -------------------------------------------------- |
| Config snapshot         | Typed per-game children                | JSONB on exercise_configurations (0005)            |
| Player identity         | player_profiles separate               | display_name on players (0003)                     |
| Turn fields             | remaining_before/after                 | total_score + completed_at (0006); bust fields TBD |
| Dart model              | intended/hit + dart_zones              | Frozen in 0006 — validate repo files               |
| View naming             | vw\_\* in early design                 | v\_\* in SQL                                       |
| exercise_stage children | Per-game typed tables (x01_legs, etc.) | Generic stage_type_id lookup                       |
| 0007_constraints        | Separate integrity migration           | Validate exists and matches spec                   |

Doc sync plan (Prompt 65) addresses these across `05-Database/00`–`09`.

---

## Unresolved / Deferred

| Item                                                                         | Since                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROUTINE_RUN entity                                                           | Prompt 25                                                                                                                                             |
| board_segments lookup                                                        | Prompt 37                                                                                                                                             |
| dart board coordinates (location_x/y)                                        | Prompt 67 — deferred until UI captures                                                                                                                |
| Event sourcing                                                               | Prompt 37                                                                                                                                             |
| Migration tooling selection                                                  | Prompt 50                                                                                                                                             |
| Zero-downtime migrations                                                     | Prompt 50                                                                                                                                             |
| API endpoint strategy                                                        | Prompt 24 — **defined baseline:** resource REST by domain + batch write endpoint; middleware JWT identity; Worker-generated UUIDv7; view-backed reads |
| 06-API/ documentation                                                        | **Resolved (2026-07-08):** `06-API/00-Overview.md` frozen at `1.0.0` with security/auth/statistics scope decisions                                    |
| JSONB configuration key vocabulary per ruleset (review against game engines) | Continuation session — first draft in seeds/0002                                                                                                      |
| Final requirements traceability review                                       | Prompt 64                                                                                                                                             |

---

## Validation Checklist (use against `architecture/docs/`)

Verify each area reflects original intent:

### Domain model

- [ ] Activity vs Exercise Session separation with 1:N cardinality
- [ ] exercise_stage as turn parent (no polymorphic FKs)
- [ ] Turn = physical oche action; Dart = atomic observation
- [ ] Configuration: game_type → ruleset_version → snapshot (copy, no template FK)
- [ ] Participants on exercise, not activity
- [ ] One active exercise per game type per player
- [ ] Recreational incomplete dart capture supported
- [ ] Immutable after COMPLETED; active sessions mutable during play

### Data philosophy

- [ ] Store facts, compute statistics in views only
- [ ] Replayability from stored data alone
- [ ] No derivable statistics stored in tables
- [ ] Settings = defaults only; session stores actual values

### Technical standards

- [ ] Hybrid ID: UUID domain + SMALLINT lookups
- [ ] App-generated UUIDv7; no DB ID generation
- [ ] TIMESTAMPTZ UTC everywhere
- [ ] implementation_key immutable; expose UUID + key in API
- [ ] Controlled sets as reference tables, not TEXT

### Architecture patterns

- [ ] CQRS-lite: writes to runtime, reads from views
- [ ] Repository pattern; API never exposes raw tables
- [ ] Migrations schema-only; seeds separate
- [ ] One concern per migration; never modify applied migrations
- [ ] Batch session upload (not per-dart API calls)

### Game extensibility

- [ ] New game = game_type + features + ruleset + config model + stage tables + views + engine
- [ ] No redesign of existing games
- [ ] Rulesets immutable once published

### Documentation integrity

- [ ] 05-Database docs synced with 0001–0009 implementation
- [ ] 00–05 Database handbook docs match frozen schema (validate, do not regenerate)
- [ ] 03-Migrations documents seeds split, immutable migration history, AI rules
- [ ] 04-Indexes: query-pattern first; partial active-session index; no blind FK indexing
- [ ] 05-Views: three categories; replay uses stored ruleset/config; no business logic in views
- [ ] 06-Data-Model/spec: maps 1:1 to migrations; per-table Purpose + Design Rationale
- [ ] 06 spec includes capture_modes, input_modes; game_types PK matches SQL (UUID)
- [ ] Table Matrix and Mermaid ERD (proposed, not yet delivered)
- [ ] Doc reviews use full-file replacement (not nested incremental edits)
- [ ] Read Model layer documented between Runtime and Analytics
- [ ] Runtime event model (Session → Stage → Turn → Dart) documented
- [ ] Dart intention+result model (intended/hit targets, zones) documented
- [ ] Controlled denormalisation documented in 02-Design-Rules
- [ ] Naming: v*\* views, idx*\* indexes, fk*/uq*/chk\_ constraints, no PG enums

### Known tensions to verify resolved

- [ ] exercise_configurations: JSONB vs typed per-game children
- [ ] player_profiles vs display_name on players
- [ ] Turn: remaining_before/after vs total_score + completed_at
- [ ] Dart: intended/hit zones; no multiplier column; recreational may omit dart rows
- [ ] dart_zones reference table seeded (6 zones)
- [ ] No DB-enforced max darts per turn or score cap (ruleset-owned)
- [ ] Controlled denormalisation documented (turn.total_score + dart.score)
- [ ] View prefix: v*\* vs vw*\*
- [ ] 0007_constraints and 0008_indexes match access-pattern strategy

---

## Evolution Timeline

| Prompts | Milestone                                                                 |
| ------- | ------------------------------------------------------------------------- |
| 1–10    | Requirements, domain pivots, ruleset, ERD                                 |
| 11–20   | exercise_stage, freeze v1.0, identity/reference/template                  |
| 21–30   | Runtime DDL, CQRS-lite, migration conventions                             |
| 31–40   | Doc hierarchy, foundation docs 00–04                                      |
| 41–47   | 04-Patterns, DB handbook 00–05                                            |
| 48–53   | Naming, rules, migrations, indexes, views docs; folder split              |
| 54–55   | Data model + review (APPROVED WITH REVISIONS)                             |
| 56–58   | Physical mapping, pre-impl APPROVED, 0001–0002                            |
| 59–63   | Hybrid IDs, seeds, 0003–0006                                              |
| 64–67   | 0009 views, foundation complete, doc sync begins                          |
| 68–71   | Runtime event review (9.8/10); dart_zones; 0007 constraints; 0008 indexes |
| 72–74   | Doc sync: full rewrites of 00-Overview, 01-Naming, 02-Design-Rules        |
| 76–78   | Doc sync: full rewrites of 03-Migrations, 04-Indexes, 05-Views            |
| 79–81   | `06` canonical spec pivot; Parts 1–2 (Reference Layer partial)            |
