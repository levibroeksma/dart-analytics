<!--
status: canonical
scope: repository-wide decision ledger
read-when: answering "why was X decided?" before touching any history
updated: 2026-07-15
-->

# Architectural Decision Ledger

> One line per decision. This ledger is the distillation of the full design history (prompts 1–85 + dated sessions, previously stored as raw conversation logs, removed 2026-07-11). The raw design journey (master context) was retired 2026-07-14; deeper lineage lives in git history only. Canonical docs always win over this ledger.
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
| D21 | P48–53 | Migrations are schema-only, seeds hold controlled data; applied migrations are never modified; chain `0001`–`0016` | Auditable, reproducible schema history |
| D22 | P51–53 | Index philosophy: real query paths only, partial index for active sessions, no blind FK indexing | Write cost control |
| D23 | 2026-07-09 | dbmate owns migrations (SQL-first); `drizzle-kit introspect` provides typed query layer only — Drizzle never generates schema | Keeps SQL chain canonical while getting types |
| D24 | 2026-07-09 | Neon project in `aws-eu-central-1`, branches `main`/`preview`/`dev`; scale-to-zero on all branches for v1; shared `dev` branch for local work (no Docker Postgres) | Cost + low ops for solo operator |
| D25 | 2026-07-09 | `npx fallow` added to the standard `app/` validation sequence | Catch stale types before completion |
| D26 | 2026-07-08 | Session write idempotency table (migration `0012`) backing the batch endpoint's idempotency key | Safe client retries of batch uploads |
| D27 | 2026-07-12 | Read-model views normalized (migration `0013`): implementation keys as `*_key`, labels as `*_name`, no internal lookup ids exposed; `ruleset_version_key` added to `v_active_sessions` | Consistent, key-based read contract; fixes inconsistency the freeze missed |
| D28 | 2026-07-12 | `session_id` added to `v_dart_analytics` (migration `0014`) so `GET /sessions/:id/darts` filters by session through the view | Endpoint is per-session but the view was player-global |
| D74 | 2026-07-13 | Migration `0016` rebuilds `v_game_replay` (LEFT JOIN darts, `turn_total_score`, `stage_id`/`parent_stage_id`) and floors `v_session_overview.duration_seconds` | Recreational + nested-stage replay; integer DTO contract |
| D95 | 2026-07-15 | Reversed connection-string contract per user-verified `neonctl link` output: `DATABASE_URL` = pooled (tooling: dbmate, drizzle-kit), `DATABASE_URL_UNPOOLED` = direct (Worker runtime `getDb()`); `DATABASE_URL_POOLED` eliminated entirely, no manually-maintained alias | Matches Neon's real 5-variable output exactly; supersedes commit `a2be0eb`'s unverified reverse assumption |

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
| D66 | 2026-07-13 | `06-API/` frozen v1: `01`/`02` frozen at 1.0.0, `03`→1.1.0; adopted `@`-prefixed aliases + `@<area>/types` type-raising barrels; removed the statistics route folder from the layering tree (statistics stay post-v1) (`03` later 1.2.0/1.3.0 under the freeze-semantics rule, 2026-07-13) | Close the API design layer with one coherent, self-consistent frozen contract before frontend work |
| D67 | 2026-07-13 | Local-first recovery: in-progress state in persisted Alpine stores (`$persist`); one batch at session completion; `clientKey` payload-internal only; no server mid-session recovery or cross-batch reconciliation. **UX (2026-07-14, D88):** auto-abandon on mismatch — no manual abandon prompt | Resolves recovery-vs-batch contradiction with zero schema cost |
| D68 | 2026-07-13 | `created_at` = row persistence time everywhere; chronology from sequence numbers + client timestamps; migration `0015` drops `chk_turn_completed_after_created` | Batch upload makes client `completedAt` predate insert |
| D69 | 2026-07-13 | Terminal statuses (COMPLETED, ABANDONED) always set `completed_at` (server default `now()`); `ACTIVE` ⇔ `completed_at IS NULL` invariant | Aligns `uq_sessions_single_active` with `v_active_sessions`; unblocks abandon flow |
| D70 | 2026-07-13 | Error registry completed with `NOT_FOUND`/`VALIDATION_FAILED`/`INVALID_STATUS_TRANSITION`/`SERVICE_UNAVAILABLE` (only retryable code); registry closed for v1 | Registry must cover its own frozen surface |
| D71 | 2026-07-13 | `GET /api/configuration-templates` backed by `v_configuration_presets` (migration `0016`); `templateRef` = preset UUID; "no persistence UUIDs" scoped to runtime-write payloads | Game setup needs preset discovery; presets have no implementation_key by design |
| D72 | 2026-07-13 | Batch route amended to `POST /api/sessions/:sessionId/events/batch` | Astro file routing serves it natively; `:batch` spelling was unservable |
| D73 | 2026-07-13 | `DartFact` intention is a nullable pair; ANALYTICS capture ⇒ intention required (service-validated); RECREATIONAL + DETAILED_DARTS = hit-only dart rows | Contract must express what the schema models |
| D75 | 2026-07-13 | Sessions list pagination orders by `session_id DESC` (UUIDv7 creation-ordered); cursor encodes last-seen `session_id` | PK doubles as pagination key; no new index |
| D76 | 2026-07-13 | Provision accepts optional `displayName`; fallback JWT `name` claim → `'Player'`; rename endpoint deferred | `players.display_name` NOT NULL needs a source at provisioning |
| D78 | 2026-07-13 | Authoritative `app/src` tree: top-level `services`/`repositories`/`db` areas; `lib/api/` = browser client (D41); `lib/server/` = envelope/error helpers | Frozen docs contradicted each other on layout |

## Frontend

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D40 | 2026-07-09 | Game engine runs client-side; frontend owns temporary state, uploads completed gameplay batches; never touches DB | Offline-tolerant play, DB owns truth |
| D41 | 2026-07-09 | Single API client (`lib/api/client.ts`), skeleton-first hydration | One integration seam |
| D77 | 2026-07-13 | `player_settings` deferred post-v1: no endpoints; `forms/` persist last-used modes and send them per D60 | Table was unreachable; local persistence covers the need |
| D79 | 2026-07-14 | Frontend handbook 0.1.0: prerender-default on Cloudflare (`output: 'server'` + per-route prerender) | Honest adapter model; fast shells |
| D80 | 2026-07-14 | Middleware protected-prefix allowlist; v1 public = `/login` only | HTML nav gate; extensible public list |
| D81 | 2026-07-14 | Alpine `app.factory` entry + `register*(Alpine)`; no `x-init`; `x-data="foo()"`; store factories invoked with `()` | Single Alpine bootstrap; init runs |
| D82 | 2026-07-14 | Alpine-native layering; pages/forms/stores orchestrate `@client/api`; modules never fetch | Testable modules; clear HTTP ownership |
| D83 | 2026-07-14 | Frontend domain at `src/` level; browser infra under `@client/`; `@utils/` for shared helpers | Agent-enforceable boundaries |
| D84 | 2026-07-14 | Suffix conventions: `.store.ts`, `.form.ts`, `.data.ts`, `.module.ts`, `.engine.module.ts`, `.payload.module.ts` | Filename encodes role |
| D85 | 2026-07-14 | OOP in `modules/` only; portable UI kit with peer-dep disclosure for Chart | Reusable primitives |
| D86 | 2026-07-14 | `$persist` in stores/forms only; timer state in game store; forms = v1 `player_settings` substitute | Predictable persistence |
| D87 | 2026-07-14 | Shared API types via Zod `z.infer<>` in `src/types/api/` with barrel raising | No DTO drift from frozen contract |
| D88 | 2026-07-14 | Client recovery: auto-abandon on mismatch/missing local; no manual abandon UI; server owns DB orphan sweeps | Amends D67 UX wording |
| D89 | 2026-07-14 | Persisted schemas additive-only in 0.1.0; no runtime schema versioning | Extend never break |
| D90 | 2026-07-14 | Completed-but-unsent batches held in a persisted `outbox` store; retried on load/`online` with the session-complete `Idempotency-Key`; removed only on confirmed success | Finished gameplay never lost between completion and server ACK |
| D91 | 2026-07-14 | Augments D89: single `_v` integer per persisted store discards on incompatible bump; additive changes never bump it | Safety valve for the rare unavoidable breaking shape change |
| D92 | 2026-07-14 | `.astro` component conventions (`05-Astro-Components.md`): fixed frontmatter order; class placement decided by change-trigger (static→`class`, build-time→frontmatter, runtime→`:class`, recurring→`@layer components`); `cn()` = `twMerge(clsx())` is the sole class-composition helper | One canonical component shape; minimal variation |
| D93 | 2026-07-14 | Adopt graphify for a committed AST-only codebase knowledge graph (`graphify-out/graph.json`); consumed via `graphify` CLI documented in `CLAUDE.md`; auto-rebuilt by local git hooks (`graphify extract . --code-only`); no LLM backend (no API cost); semantic/docs extraction and MCP deferred | Early, low-cost shared code map before the codebase grows |
| D97 | 2026-07-15 | Prerendered protected route shells are public-by-design (Cloudflare serves static assets before the Worker/middleware runs, verified via `wrangler dev` probe); the JWT-gated API remains the sole real authorization boundary, not the navigation gate | `run_worker_first` would front every static asset through the Worker for a purely cosmetic benefit (an anonymous visitor sees an empty shell either way, since data is never server-rendered) |
| D98 | 2026-07-15 | Client auth gate in `BaseLayout` (`auth.store` `init()` + `x-cloak`) is the load-bearing navigation control for prerendered routes (D97); middleware redirect remains a UX nicety for on-demand routes only | Prerendered shells bypass middleware on this Cloudflare config — client gate prevents nav chrome flash |
| D99 | 2026-07-15 | Mandatory TDD for all `app/` behavior: Vitest, colocated `*.test.ts`, red→green→ refactor; `npm test` in `validate:app` | Prevents untested client auth and API wiring; sole procedure in `app/CLAUDE.md` |
| D100 | 2026-07-15 | Alpine v3 shorthand mandatory: `:attr` and `@event` instead of `x-bind:*` / `x-on:*`; `x-on:*` only inside Astro `{}` when linter rejects `@` | Consistent templates; matches Alpine 3 defaults |
| D101 | 2026-07-15 | Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction guidance: tests move to a mirrored `app/tests/` tree (never colocated); `.astro` variant/branching logic stays inline in frontmatter instead of an extracted testable `.ts` helper (e.g. former `button-variants.ts`), accepting the resulting loss of Vitest coverage for that logic | Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection |
| D103 | 2026-07-16 | Type-raising extended universally (Worker + browser, Zod + hand-authored); contract types relocated from top-level `types/` into owning domain folders (`pages/api/<domain>/types.ts`, new `@routes` alias); `types.ts` standardized as the sole barrel filename, replacing the 2 existing `index.ts` files; TS `interface` declarations raised through a parallel, separate `interfaces.ts` barrel chain (same mechanics, kept out of `types.ts`), excluding `.astro` frontmatter (D92) and `env.d.ts` ambient declarations | Codebase self-audit found these conventions already documented but violated (deep-relative imports, a re-declared Zod schema, an unraised interface) |
| D104 | 2026-07-16 | Frontend test strategy formalized: new `06-Test-Strategy.md`, shared-mock convention (`tests/mocks/` + `setupFiles`), full-suite-always-runs completion policy | `authClient` was mocked twice with inconsistent shapes; codified the promotion threshold before it recurs |
| D105 | 2026-07-16 | Zero-exception rule: no `.ts` under `components/`/`pages/` except `pages/api/**`; `lib/<domain>/` always, named after `modules/`/`stores/` domain vocabulary; mechanically enforced via `scripts/check-file-locations.sh` (local + CI) | Prior colocation escape hatch relied on discipline alone, not enforcement |
| D106 | 2026-07-16 | Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the shared `ErrorCode` type; replaces ad hoc per-page mapping functions | `login.data.ts`'s local `mapSignInError`/`mapProvisionError` conflated two distinct error surfaces and weren't reusable |

## Context & documentation system

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D50 | P31–35 | Architecture-first: docs are source of truth; implementation conflicting with docs is incorrect; targeted fixes only, never regeneration | Longevity without debt |
| D51 | Cont. session | Design-gate docs `05-Database/07`–`09` are immutable historical records with superseded-decision tables | Immutable history applies to docs too |
| D52 | 2026-07-11 | Context routing system: root `CLAUDE.md` router + `00-Context-Map.md` packs; spec split into `06-Spec/` chapters; raw conversation logs removed after distillation into this ledger; mandatory Context Maintenance protocol for every agent | Token efficiency + guaranteed context completeness |
| D94 | 2026-07-14 | Repository restructure: single `docs/` tree (`docs/architecture/`, `docs/superpowers/`), executable SQL promoted to top-level `database/`, ledger at repo root, master context retired (git history only), root `README.md` added | Kill the `architecture/docs/architecture` stutter and the duplicate doc roots |
| D96 | 2026-07-14 | Branch-integration rule: task branches land on `main` via PR at task completion; divergence is a defect; completion gate item 7 verifies it | 2026-07-14 review found `main` ~50 commits stale with zero open PRs |
| D102 | 2026-07-15 | No git worktrees: task branches are checked out directly in the main working copy (`git checkout -b <branch>`), never under `.worktrees/`; `.worktrees/` removed from `.gitignore` | Worktree-per-task left multiple stale worktrees with uncommitted, unrecoverable work sitting undiscovered outside normal branch review |
| D107 | 2026-07-16 | Self-learning gate added to the Context Maintenance protocol (step 8): rule sharpenings discovered mid-task require explicit user approval before being written, never applied unilaterally | Formalizes the propose-then-confirm pattern this design itself was built through |

## Deferred (open, not rejected)

ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12) · multi-session activities (2026-07-12) · guest/DartBot participants (2026-07-12) · `board_segments` lookup (P37) · dart coordinates `location_x/y` (P67, until UI capture) · event sourcing (P37) · zero-downtime migrations (P50) · PostgreSQL RLS (post-v1) · statistics endpoints overview/trends/checkouts + `v_statistics_overview` view (post-v1, 2026-07-12) · JSONB config key vocabulary review against game engines. · player_settings endpoints (2026-07-13) · configuration-preset CRUD (2026-07-13) · PATCH /api/players/me rename (2026-07-13) · per-dart thrown_at timestamp (2026-07-13)
