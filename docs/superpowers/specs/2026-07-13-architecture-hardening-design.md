# Architecture Hardening Design — Pre-Frontend Fix Pass

> **Date:** 2026-07-13
> **Status:** approved design (brainstorming consensus)
> **Scope:** resolve the 5 blockers and should-fix findings from the 2026-07-13 architecture review so the frontend layer can be designed against an unambiguous contract.
> **Branch:** `claude/architecture-review-frontend-a3ya86`

---

## Problem

An architecture review of `architecture/` found that the domain model and invariants are sound, but five contract-level defects sit at the seams between the frozen v1 API contract and the frozen schema, plus a cluster of smaller inconsistencies. All of them would leak into frontend specs if not resolved first:

1. The batch write violates `chk_turn_completed_after_created` on any real payload.
2. The mid-session recovery story contradicts the frozen write model, and `clientKey` is not persisted.
3. "Active session" has two conflicting definitions; ABANDONED can permanently block a player.
4. The error-code registry cannot cover its own frozen surface and defines zero retryable codes.
5. Game setup is unbuildable: `templateRef` resolves by a column that does not exist, and no endpoint lists presets.

Plus: `DartFact` cannot express darts the schema models, recreational sessions replay as empty, nested stages cannot be ordered in replay, `durationSeconds` fails its own DTO, provisioning has no display-name source, `player_settings` is unreachable, the frozen API docs contradict themselves on folder layout and the batch URL, and assorted doc/seed hygiene issues.

Every decision below was individually approved during the brainstorming session.

---

## Decision 1 — Write & Recovery Model: Local-First

**Decision:** Gameplay uploads remain **one batch at session completion**. In-progress state lives client-side in **Alpine stores using the `$persist` plugin** (localStorage). Refresh/crash recovery is entirely client-side and same-device. There is no server-side mid-session recovery in v1.

Consequences:

- `clientKey` / `parentClientKey` are **payload-internal only** — they resolve references within a single batch. No `client_key` column is added to any runtime table. Cross-batch reconciliation semantics do not exist in v1.
- Whole-batch retry safety remains covered by the `Idempotency-Key` mechanism (unchanged).
- `409 SESSION_ALREADY_COMPLETED` remains the only mid-session write guard.
- `v_active_sessions` is re-purposed in the docs: it exists to detect an orphaned active session so the client can **resume from local state or abandon it** — not to reconstruct gameplay state from the server.

Documentation edits:

- `07-Frontend/00-Overview.md`: recovery section rewritten around the persisted Alpine store; remove "recovered via `GET /api/sessions/active` and replay reconstruction"; remove the undefined "(or sync boundary)" phrasing — the only sync boundary is session completion.
- `05-Database/06-Spec/04-Runtime-Layer.md`: correct the `turns.completed_at NULL = how resumable games recover position` language (it is a fact about interrupted visits, not a server recovery mechanism) and the activities "remains recoverable" wording (recovery is client-local).

Accepted, documented limitations:

- Losing the device (or clearing storage) loses the in-progress session; the orphaned server session is abandoned via the lifecycle flow (Decision 3).
- `POST /api/sessions` requires connectivity at game start (server mints the session id).

---

## Decision 2 — Time Semantics + Migration `0015`

**Decision:** `created_at` means **row persistence time (server clock)** on every table, everywhere. Gameplay chronology is derived from **sequence numbers plus client-observed timestamps** (`TurnFact.completedAt` → `turns.completed_at`), never from `created_at`.

Migration **`0015_time_semantics_constraints.sql`**:

- `DROP CONSTRAINT chk_turn_completed_after_created` on `turns` — a client-observed completion time legitimately predates the row insert under batch upload.
- Replace `chk_players_display_name_not_empty` with a plain `length(trim(display_name)) > 0` check (the `display_name IS NULL OR …` arm is dead code against a `NOT NULL` column).

Kept/deferred:

- `TurnFact.completedAt` stays in the contract (client-observed fact worth storing). No `startedAt` is added (YAGNI).
- Per-dart `thrownAt` remains deferred, alongside `location_x`/`location_y`.
- `04-Architecture-patterns.md` Pattern 9: remove "timestamp" from the stored-dart-facts example.
- `06-Database-Specification.md` timestamp strategy section gains the one-line doctrine: *created_at is persistence time; gameplay chronology comes from sequence numbers and client-observed lifecycle timestamps.*

---

## Decision 3 — Session Lifecycle: Terminal ⇒ `completed_at` Set

**Decision:** Every terminal status transition (**COMPLETED and ABANDONED**) sets `exercise_sessions.completed_at`, defaulting to `now()` server-side when the PATCH omits it. `completed_at` is documented as "**when the session ended**" (column name retained).

Consequences:

- Invariant (service-layer enforced, documented): `status = ACTIVE ⇔ completed_at IS NULL`. The partial unique index `uq_sessions_single_active` (`completed_at IS NULL`) and `v_active_sessions` (`status = 'ACTIVE'`) now agree by construction. **No schema change.**
- `04-Endpoint-Contracts.md` PATCH section explicitly lists the ABANDONED transition and the terminal-timestamp rule.
- The same rule applies to `activities` when their terminal transitions are server-managed.
- Frontend conflict flow: when session creation hits the single-active constraint (or local state is missing for an active server session), the UI offers **resume (from local state) or abandon** (PATCH → ABANDONED).
- Stale-session sweeps (server-side abandonment) remain out of scope for v1; abandonment is client-driven.
- `05-Views.md` "Filtering Rules" example is aligned with the invariant so the two definitions of "active" never diverge in the docs again.

---

## Decision 4 — Error Registry: Minimal 4-Code Completion

**Decision:** Add exactly four codes to the registry in `03-Shared-Conventions.md`; the registry is then closed for v1.

| Code | HTTP | Retryable | Use |
| ---- | ---- | --------- | --- |
| `NOT_FOUND` | 404 | no | unknown resource id on any read/write path |
| `VALIDATION_FAILED` | 422 | no | all input-schema, config, template-resolution, and ruleset validation failures; specifics in `error.details` |
| `INVALID_STATUS_TRANSITION` | 409 | no | PATCH lifecycle violations |
| `SERVICE_UNAVAILABLE` | 503 | **yes** | transient failures (DB unavailable, timeout); the single code that activates the client retry rule |

- Ruleset-specific validation detail continues to travel in `error.details`, never as new codes (matches the extensibility rule).
- `04-Endpoint-Contracts.md`'s dangling "use an appropriate code from the registry" references now resolve to `VALIDATION_FAILED` / `INVALID_STATUS_TRANSITION` / `NOT_FOUND`.
- `00-Overview.md` initial-codes list and retry-semantics section are updated to match.

---

## Decision 5 — Preset Discovery: List Endpoint + UUID Ref

**Decision:** Add one read endpoint and one view; presets are referenced by UUID.

- **Endpoint:** `GET /api/configuration-templates?gameType=<implementation_key>` — view-backed, player-scoped (system presets + own presets), returns `ConfigurationPreset[]`.
- **View (in migration `0016`):** `v_configuration_presets` exposing `configuration_template_id`, `game_type_key`, `name`, `description`, `configuration` (JSONB), `is_system_template`, `player_id` (for scoping). This is exactly the query path the `0010` indexes were built for.
- **`templateRef` semantics corrected:** it is the preset **UUID** obtained from this endpoint (the "(implementation_key)" annotation in `04-Endpoint-Contracts.md` was wrong — `configuration_templates` has no such column, deliberately).
- **Rule re-scoped:** "the client sends no persistence UUIDs" applies to **runtime-write payloads** (the Worker mints runtime-entity ids). Referencing an entity the client obtained from a read endpoint is normal REST addressing.
- Game-type / ruleset / capture-mode / input-mode keys remain compile-time knowledge of the client game engines. No reference-data endpoint in v1.
- Preset CRUD (user presets) stays deferred post-v1; v1 presets are the read-only system seeds.

New DTO (design sketch, camelCase, `z.infer<>` rule applies):

```typescript
const ConfigurationPreset = z.object({
  configurationTemplateId: z.string(),   // UUID — becomes templateRef
  gameTypeKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  configuration: z.record(z.unknown()),  // JSONB preset, ruleset-defined shape
  isSystemTemplate: z.boolean(),
});
```

---

## Decision 6 — Batch Contract Amendments

**6a. Public URL.** The batch route is amended to **`POST /api/sessions/:sessionId/events/batch`**. Astro file routing serves it natively (`events/batch.ts`); the `events:batch` custom-method spelling is removed from all docs. A ledger entry records the amendment of the frozen route.

**6b. Nullable intention pair.** `DartFact.intendedTargetNumber` and `DartFact.intendedZoneKey` become a **nullable pair** — both null or both set (mirrors `chk_dart_target_consistency`, which already permits this). Hit fields stay required on every dart row (`hitZoneKey` non-null; the `MISS` zone covers misses — `hitTargetNumber` stays nullable for non-target zones).

```typescript
const DartFact = z.object({
  sequence: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string().nullable(),      // nullable pair with intendedTargetNumber
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),                      // required on any dart row (MISS covers misses)
  score: z.number().int(),
});
```

**6c. Capture-mode service rule.** `ANALYTICS` capture ⇒ intention required on every dart (service-layer validation). `RECREATIONAL` + `DETAILED_DARTS` produces hit-only dart rows; `RECREATIONAL` + `QUICK_SCORE` produces `darts: []`. This makes the `v_dart_analytics` intention filter meaningful rather than dead code, and the capture-mode × input-mode matrix is documented in `06-Spec/01-Reference-Layer.md`.

---

## Decision 7 — Read-Model Rebuild: Migration `0016`

Migration **`0016_read_model_replay_and_presets.sql`** (DROP + CREATE, never editing `0009`/`0013`/`0014`):

**`v_game_replay`** — rebuilt to:

- `LEFT JOIN darts` (was INNER) so turn-total-only turns appear; dart columns are NULL for them.
- Expose `turns.total_score` as `turn_total_score` — recreational sessions replay at turn resolution ("every completed exercise is replayable" holds without exceptions).
- Expose `stage_id` and `parent_stage_id` (entity UUIDs) so consumers can reconstruct and order the stage tree — stage `sequence_number` is only unique per `(session, parent)`, so flat ordering was ambiguous for nested structures.

**`v_session_overview`** — rebuilt to floor `duration_seconds` to an integer (`FLOOR(EXTRACT(EPOCH FROM …))::integer`), so the `SessionOverview.durationSeconds: z.number().int()` contract holds without repository fix-ups.

**`v_configuration_presets`** — created (Decision 5).

DTO updates in `04-Endpoint-Contracts.md`:

```typescript
const ReplayEntry = z.object({
  stageId: z.string(),                           // structural identity
  parentStageId: z.string().nullable(),
  stageSequence: z.number().int(), stageTypeKey: z.string(),
  turnSequence: z.number().int(), participantName: z.string(),
  turnTotalScore: z.number().int(),
  dartNumber: z.number().int().nullable(),       // NULL for turn-total-only rows
  intendedTargetNumber: z.number().int().nullable(), intendedZoneKey: z.string().nullable(),
  hitTargetNumber: z.number().int().nullable(), hitZoneKey: z.string().nullable(),
  score: z.number().int().nullable(),            // NULL when no dart row
});
```

Naming-rule amendment (`01-Naming-Conventions.md` §View Column Key And Label Naming): exposed entity UUIDs serve two purposes — (a) ids a client addresses in a later request, (b) **structural identity required to reconstruct hierarchies** (`stage_id`, `parent_stage_id`).

---

## Decision 8 — Pagination Contract

`GET /api/sessions?limit=&cursor=` orders by **`session_id DESC`**. UUIDv7 is creation-time ordered, so the primary key doubles as the pagination key; the opaque cursor encodes the last-seen `session_id`. No new index required (PK suffices). Documented in `03-Shared-Conventions.md` (cursor semantics) and `04-Endpoint-Contracts.md` (sessions list).

---

## Decision 9 — Player Identity

**9a. Provision display name.** `POST /api/players/provision` gains an optional `displayName`. Server fallback chain: request value → JWT `name` claim (when Neon Auth provides one) → literal `'Player'`. `players.display_name` stays `NOT NULL`. A rename endpoint (`PATCH /api/players/me`) is deferred post-v1 — acceptable because participants copy the name at session start by design.

```typescript
const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});
```

- `06-Spec/03-Player-Layer.md` corrected: `display_name` is NOT NULL (the "nullable" implication is removed).

**9b. `player_settings` deferred.** v1 ships no settings endpoints. The client persists last-used capture/input modes in its Alpine store and sends them on every `POST /api/sessions` per D60. The table stays in the schema for post-v1. Added to the deferred ledger; `06-Spec/03-Player-Layer.md` gets a one-line v1-status note so "read at session start and copied" stops implying a live server path.

---

## Decision 10 — Code Layout (Frozen-Doc Reconciliation)

Authoritative `app/src/` tree: **top-level areas**, matching the documented alias set:

```
app/src/
├── middleware.ts
├── pages/api/**          # controllers          (@routes)
├── services/             # orchestration        (@services)
├── repositories/         # SQL                  (@repositories)
├── db/                   # neon client factory  (@db)
└── lib/                  # shared               (@lib)
    ├── api/              # BROWSER-facing API client only (D41): client.ts, sessions.ts, routines.ts
    ├── server/           # server-side envelope.ts + errors.ts (moved out of lib/api/)
    └── auth/             # verify-jwt.ts, resolve-player.ts
```

- The diagrams in `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md` that say `src/lib/services/**` / `src/lib/repositories/**` are corrected to `src/services/**` / `src/repositories/**`; the `lib/db/client.ts` heading in `02` is corrected to `db/client.ts`.
- Browser and Worker code never share a folder: `lib/api/` is client-side per frozen D41; `lib/server/` hosts the response helpers.
- `07-Frontend/00-Overview.md` client-structure section aligned.

---

## Decision 11 — Doc & Seed Hygiene

No design decisions — approved fixes:

1. **Seed `0001`:** move the misplaced `COMMIT;` (currently before participant_types / stage_types / dart_zones) to the end of the file so the whole seed is one transaction. Seeds are idempotent (`ON CONFLICT DO NOTHING`) and editable, unlike applied migrations.
2. **`10-Database-Agent-Guide.md`:** correct rule 6 and the migration checklist — dbmate wraps migration sections in transactions, explicit `BEGIN`/`COMMIT` is forbidden in migrations (matches `03-Migrations.md`); seeds keep explicit `BEGIN`/`COMMIT`. Fix stale "create `0013_*` (or next)" → "the next unused number".
3. **"Frozen" defined** (in `06-API/00-Overview.md`): route surface and behavioral semantics are frozen; documents may take doc-only patch/minor version bumps without violating the freeze. Stale version claims corrected (`00-Overview` on `03`'s version; D66's `03→1.1.0` annotated with the subsequent `1.2.0`).
4. **Runtime spec chapter:** one-line note that `0005` enforces the PLAYER/DARTBOT participant rules via seeded ids 1/3 in CHECK constraints (GUEST naming is application-enforced).
5. **`01-Naming-Conventions.md`:** fix `chk_darts_score_positive` → `chk_dart_score_positive` example; note that `implementation_key` uniqueness may be composite (`ruleset_versions` is unique per game type).
6. **Related-Documents date drift** in `06-API/*` and `07-Frontend` tables corrected in passing where touched.

---

## Context Maintenance (mandatory)

In the same change set:

- New `DECISIONS.md` entries (D67+) covering: local-first recovery model, created_at time doctrine + `0015`, terminal-status `completed_at` invariant, error-registry completion, preset endpoint + UUID `templateRef`, `/events/batch` URL amendment, nullable intention pair + capture-mode matrix, `0016` read-model rebuild, pagination key, provision `displayName`, `player_settings` deferral, authoritative folder tree.
- Deferred list additions: `player_settings` endpoints, preset CRUD, `PATCH /api/players/me`, per-dart `thrownAt`.
- `00-Context-Map.md`: migration ranges updated to `0001`–`0016` everywhere they appear (packs, inventory, implementation state); this spec registered under historical docs; dated rows added.
- Root `CLAUDE.md` invariant "migrations (`0001`–`0014`)" updated to `0016`.
- `scripts/check-context-map.sh` must pass before the task is claimed done.

---

## Out of Scope (unchanged deferrals)

Statistics endpoints and views, PostgreSQL RLS, guest/DartBot participants, multi-session activities, routine-run writes, dart coordinates and timestamps, event sourcing, zero-downtime migrations, preset CRUD, player rename endpoint, `player_settings` endpoints, server-side stale-session sweeps, `board_segments` lookup, JSONB config-vocabulary review.

---

## Testing / Validation

- `0015`/`0016` validated by the standard sequence: `npm run db:status` → `db:migrate` → `db:seed` → `drizzle-kit introspect` → `npx fallow` → `astro check` (per `app/CLAUDE.md`).
- Rebuild-from-empty check: migrations `0001`–`0016` + seeds apply cleanly in order.
- `scripts/check-context-map.sh` passes.
- Contract self-consistency spot-checks: every error reference in `04` resolves to a registry code; every route string is `/events/batch`; `ReplayEntry`/`SessionOverview`/`DartFact`/`ConfigurationPreset` DTOs match the `0016` view projections column-for-column.

## Implementation Order

1. Migration `0015` (constraints) and `0016` (views) + seed `0001` COMMIT fix.
2. API contract docs (`00`, `03`, `04`) — registry, routes, DTOs, pagination, provision request.
3. Middleware/implementation docs (`01`, `02`) + frontend doc (`07`) — layout, recovery model.
4. Database handbook + spec chapters — time doctrine, lifecycle invariant, capture matrix, hygiene items.
5. `DECISIONS.md`, `00-Context-Map.md`, root `CLAUDE.md` — ledger + routing updates; run the check script.
