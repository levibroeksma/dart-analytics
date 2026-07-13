<!--
status: canonical
scope: repository-wide decision ledger
read-when: answering "why was X decided?" before touching any history
updated: 2026-07-12
-->

# Architectural Decision Ledger

> One line per decision. This ledger is the distillation of the full design history (prompts 1–85 + dated sessions, previously stored as raw conversation logs, removed 2026-07-11). For deeper lineage consult `architecture/000_master_context.md` (historical, non-authoritative). Canonical docs always win over this ledger.
>
> **Source key:** P*n* = original design conversation prompt range · dates = later work sessions.

## Domain model

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D01 | P1–10 | Store what happened, derive what it means: dart-level facts are the source of all statistics | Analytics flexibility for years of progression tracking |
| D02 | P16–20 | `Activity` (why playing, resumable container) separated from `Exercise Session` (which engine, gameplay record) | Resume/interrupt semantics without polluting gameplay records |
| D03 | P16–20 | Platform framed as Exercise Execution Platform: games extensible, rulesets immutable | New games must never redesign existing ones |
| D04 | P36–40 | Runtime chain frozen: `Session → Stage → Turn → Dart`; Turn = physical oche action, Dart = atomic observation | Single event model for all game types |
| D05 | P36–40 | Generic `exercise_stages` with `stage_type_id` lookup (MATCH/SET/LEG/ROUND/EXERCISE_BLOCK), not per-game typed tables | Open/Closed extensibility without table sprawl |
| D06 | P67–71 | Dart records intention + result (`intended_*` + `hit_*` target/zone); no multiplier column; `dart_zones` lookup (6 zones) | Multiplier derivable; intention enables accuracy analytics |
| D07 | P67–71 | Recreational capture may store turn totals with no dart rows; analytics mode requires full rows | Low-friction casual play without corrupting analytics data |
| D08 | P26–30 | Participants (PLAYER/GUEST/DARTBOT) attach to exercise session, not activity | Guests/bots are per-game, not per-intent |
| D09 | Cont. session | One active session per game type per player, DB-enforced via partial unique index (migration `0011`) | Prevents orphaned active sessions |
| D10 | P36–40 | No `current_stage` pointer stored; derive from latest stage → turn → dart | No derivable state persisted |
| D11 | P21–25 | Completed gameplay immutable (application-enforced); corrections create new records; active sessions mutable during play | Historical truth; replayability |
| D12 | P59–63 | Hybrid IDs: UUIDv7 app/Worker-generated for domain entities, SMALLINT seeded for lookups; DB never generates ids | Sortable ids, deterministic seeds, no DB id coupling |
| D13 | P21–25 | Configuration chain `game_type → ruleset_version → snapshot`; runtime copies config, never FK-references templates | Template edits must not rewrite history |
| D14 | Cont. session | `configuration_templates` = JSONB preset table (migration `0010`); JSONB for preset + snapshot, application-validated, structure defined by ruleset version | Written once, read for replay, never queried relationally |
| D15 | P67–71 | Ruleset owns game limits (max darts per turn, score caps) — not DB CHECK constraints | Rules vary per ruleset version |
| D16 | P46–47 | Controlled denormalisation allowed when query-critical: `turns.total_score` + `darts.score` (app controls writes) | Measured pragmatism over purity |
| D17 | P59–63 | `display_name` lives on `players`; no separate `player_profiles` table | YAGNI for solo-operator v1 |

## Database platform & process

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D20 | P21–30 | CQRS-lite: writes to runtime tables in transactions, reads via `v_*` views only; API never exposes raw tables | Stable read contracts, schema freedom underneath |
| D21 | P48–53 | Migrations are schema-only, seeds hold controlled data; applied migrations are never modified; chain `0001`–`0014` | Auditable, reproducible schema history |
| D22 | P51–53 | Index philosophy: real query paths only, partial index for active sessions, no blind FK indexing | Write cost control |
| D23 | 2026-07-09 | dbmate owns migrations (SQL-first); `drizzle-kit introspect` provides typed query layer only — Drizzle never generates schema | Keeps SQL chain canonical while getting types |
| D24 | 2026-07-09 | Neon project in `aws-eu-central-1`, branches `main`/`preview`/`dev`; scale-to-zero on all branches for v1; shared `dev` branch for local work (no Docker Postgres) | Cost + low ops for solo operator |
| D25 | 2026-07-09 | `npx fallow` added to the standard `app/` validation sequence | Catch stale types before completion |
| D26 | 2026-07-08 | Session write idempotency table (migration `0012`) backing the batch endpoint's idempotency key | Safe client retries of batch uploads |
| D27 | 2026-07-12 | Read-model views normalized (migration `0013`): implementation keys as `*_key`, labels as `*_name`, no internal lookup ids exposed; `ruleset_version_key` added to `v_active_sessions` | Consistent, key-based read contract; fixes inconsistency the freeze missed |
| D28 | 2026-07-12 | `session_id` added to `v_dart_analytics` (migration `0014`) so `GET /sessions/:id/darts` filters by session through the view | Endpoint is per-session but the view was player-global |

## API (v1 baseline frozen 2026-07-08)

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D30 | Cont. session | API runtime = Astro server endpoints on Cloudflare Workers in `app/` (EU) with Neon serverless driver | Latency to Neon Frankfurt; no separate Node service |
| D31 | Cont. session | Auth: Bearer JWT in `Authorization` header; middleware verifies (claims `sub`+`exp`), passes `locals.auth`; 401 for identity failures, 403 for domain authorization | Stateless, multi-client ready |
| D32 | Cont. session | Resource-first REST by domain + single batch write action `POST /api/sessions/:sessionId/events:batch`; no per-dart API calls | Gameplay uploads are batches |
| D33 | P82–85 | Worker/API generates UUIDv7 for runtime persistence entities; frontend sends gameplay payloads only | Trust boundary: ids minted server-side |
| D34 | 2026-07-08 | Trusted Worker service-role DB access; PostgreSQL RLS explicitly deferred post-v1 | Single trusted writer in v1 |
| D35 | Cont. session | Standard envelope `ok/data/requestId` · `ok/error/requestId` with domain error-code registry and retryable semantics | Uniform client handling |
| D36 | 2026-07-08 | Statistics v1 scope = `GET /api/statistics/overview` only; trends/checkouts deferred (superseded by D63, 2026-07-12: overview also deferred) | Scope control |
| D37 | 2026-07-09 | Neon Auth in phase 1 with explicit `POST /api/players/provision`; DB stores `auth_user_id` reference only | Decouple identity provider from domain |
| D60 | 2026-07-12 | `POST /api/sessions` requires `captureModeKey` + `inputModeKey`; every session self-describes its capture/input mode | `exercise_sessions` NOT-NULL mode columns need an input path |
| D61 | 2026-07-12 | v1 session is single-participant (server-derived `PLAYER`); guest/DartBot deferred as additive `participants[]` | Close participant gap without multiplayer scope |
| D62 | 2026-07-12 | Provision-exempt route class: `POST /api/players/provision` is JWT-verified but skips player resolution | Endpoint must be reachable by an unprovisioned user |
| D63 | 2026-07-12 | Statistics endpoints (overview/trends/checkouts) fully deferred post-v1; each must be view-backed when built | No viewless read at freeze; acquire the data first |
| D64 | 2026-07-12 | v1 = one activity per session, server-managed; multi-session activities + routine-run writes deferred | Defer, not contradict, the activities-group-sessions model |
| D65 | 2026-07-12 | v1 API response contracts defined as camelCase Zod DTOs over the normalized views; `03`/`04` frozen at 1.0.0; read shapes corrected (`active`/`replay`/`darts` return arrays); provision endpoint returns `{ playerId, authUserId, created }` | Frozen, typed response surface for the frontend |

## Frontend

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D40 | 2026-07-09 | Game engine runs client-side; frontend owns temporary state, uploads completed gameplay batches; never touches DB | Offline-tolerant play, DB owns truth |
| D41 | 2026-07-09 | Single API client (`lib/api/client.ts`), skeleton-first hydration | One integration seam |

## Context & documentation system

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D50 | P31–35 | Architecture-first: docs are source of truth; implementation conflicting with docs is incorrect; targeted fixes only, never regeneration | Longevity without debt |
| D51 | Cont. session | Design-gate docs `05-Database/07`–`09` are immutable historical records with superseded-decision tables | Immutable history applies to docs too |
| D52 | 2026-07-11 | Context routing system: root `CLAUDE.md` router + `00-Context-Map.md` packs; spec split into `06-Spec/` chapters; raw conversation logs removed after distillation into this ledger; mandatory Context Maintenance protocol for every agent | Token efficiency + guaranteed context completeness |

## Deferred (open, not rejected)

ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12) · multi-session activities (2026-07-12) · guest/DartBot participants (2026-07-12) · `board_segments` lookup (P37) · dart coordinates `location_x/y` (P67, until UI capture) · event sourcing (P37) · zero-downtime migrations (P50) · PostgreSQL RLS (post-v1) · statistics endpoints overview/trends/checkouts + `v_statistics_overview` view (post-v1, 2026-07-12) · JSONB config key vocabulary review against game engines.
