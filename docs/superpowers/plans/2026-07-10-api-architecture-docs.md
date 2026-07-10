# API Architecture Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the next-stage API architecture documentation — per-domain endpoint contracts and the shared reusable conventions — from the approved spec.

**Architecture:** Two new *draft* docs under `06-API/` (`03-Shared-Conventions.md`, `04-Endpoint-Contracts.md`) plus a dated edit to the frozen `00-Overview.md` adding `POST /api/players/provision`. The transport contract is engine-agnostic; Zod is the single source of truth for types (`z.infer<>`); config input is a discriminated union; new game types register a ruleset validator and never edit the contract.

**Tech Stack:** Markdown documentation only. No `app/` TypeScript, no migrations, no seeds. Design-level Zod schema *sketches* and function *signatures* only — not runnable code.

## Global Constraints

- **Design/documentation phase only.** No `app/` code, no migrations, no seed changes. Source: spec §1 Non-goals.
- **All output stays in `architecture/`** (plus this plan/spec under `docs/superpowers/`). Source: spec §1.
- **New docs are `0.1.0 (draft)`** — not frozen. They are subordinate to the frozen `00-Overview.md`; on any conflict, `00-Overview.md` wins. Source: spec §2.
- **Every newly added or changed doc table row carries the ISO date `2026-07-10`.** Source: `architecture/` CLAUDE.md documentation rule.
- **Naming stability:** `v_*` views, `implementation_key` reference values, UUIDv7 app-generated, TIMESTAMPTZ UTC, envelope shape `{ ok, data|error, requestId }`. Do not restate or alter frozen decisions from `00-Overview.md`; reference them. Source: spec §7.
- **Engine-agnostic rule:** the transport contract and endpoint code never encode game rules; new game types register a ruleset config validator. Source: spec D1, §6.
- **Working directory:** the `api-architecture` worktree at `.worktrees/api-architecture/`. All paths below are relative to that worktree root.
- **Spec reference:** `docs/superpowers/specs/2026-07-10-api-architecture-design.md`.

---

### Task 1: Author `03-Shared-Conventions.md` (draft)

The reusable rulebook every endpoint obeys. This is authored first because Task 2 references its envelope, pagination, error-registry, and type rules.

**Files:**
- Create: `architecture/docs/architecture/06-API/03-Shared-Conventions.md`
- Reference (read-only): `architecture/docs/architecture/06-API/00-Overview.md`, `02-Middleware-And-Layering.md`
- Spec source: `docs/superpowers/specs/2026-07-10-api-architecture-design.md` §4

**Interfaces:**
- Produces (names Task 2 relies on verbatim):
  - Envelope builders `ok(data, requestId)` and `err(code, opts, requestId)`
  - List data shape `{ items: T[], nextCursor: string | null }`
  - The rule names: "Zod single source of truth (`z.infer<>`)", "`types.ts` barrels", "path aliases"
  - Error-code registry as the single source for domain code → HTTP status → `retryable`

- [ ] **Step 1: Create the document skeleton with header and version banner**

Create the file with this exact top matter:

```markdown
# API Shared Conventions

> **Version:** 0.1.0 (draft)
>
> Reusable, strictly-enforced conventions that every API endpoint obeys.
> Subordinate to the frozen contract in `00-Overview.md` — this document details it and never overrides it.
> Implementation approach is in `01-Implementation-Strategy.md`; layering in `02-Middleware-And-Layering.md`.

---

## Purpose

This document defines the shared scaffolding that makes every endpoint predictable and testable:
response envelope builders, the header contract, `requestId` propagation, pagination, the
type/validation system, and the error-code registry. These are design-level contracts — not
implementation. All examples are signatures and schema sketches.
```

- [ ] **Step 2: Add the Response Envelope section**

Append a `## Response Envelope` section that:
- Restates the success shape `{ "ok": true, "data": {}, "requestId": "uuid" }` and error shape `{ "ok": false, "requestId": "uuid", "error": { "code", "message", "retryable", "details" } }` (as fenced json), citing `00-Overview.md` as the owner.
- States the strict rule: envelopes are produced **only** via two shared builders, given as design signatures in a fenced `typescript` block:

```typescript
// design signatures — not implementation
function ok<T>(data: T, requestId: string): SuccessEnvelope<T>;
function err(code: DomainErrorCode, opts: { message?: string; retryable?: boolean; details?: unknown }, requestId: string): ErrorEnvelope;
```
- States: handlers never hand-assemble envelopes.

- [ ] **Step 3: Add the Header Contract and requestId sections**

Append `## Header Contract` listing, in a table with the `2026-07-10` date column, the standard headers and direction:

| Header | Direction | When | Date |
| ------ | --------- | ---- | ---- |
| `Authorization: Bearer <JWT>` | request | all protected routes | 2026-07-10 |
| `Idempotency-Key` | request | batch write only | 2026-07-10 |
| `Content-Type: application/json` | request/response | bodies | 2026-07-10 |
| `X-Request-Id` (echo) | response | all responses | 2026-07-10 |

Then append `## requestId Propagation`: assigned in middleware (per `02-Middleware-And-Layering.md`), carried in `locals.requestId`, echoed in every envelope and in the `X-Request-Id` response header.

- [ ] **Step 4: Add the Pagination section**

Append `## Pagination`:
- Cursor-based, matching the frozen `?limit=&cursor=` query from `00-Overview.md`.
- Opaque cursor: base64url-encoded, server-owned; clients treat it as opaque and never construct it.
- Standard list data shape, in a fenced `typescript` block:

```typescript
// standard shape for all list endpoints
type ListResult<T> = { items: T[]; nextCursor: string | null };
```
- `nextCursor: null` means no further pages.

- [ ] **Step 5: Add the Validation & Types (strict rules) section**

Append `## Validation & Types (Strict Rules)` with three subsections:
- **Zod single source of truth:** every request/response contract is one Zod schema; TypeScript types are `z.infer<typeof Schema>`. Types are never hand-authored in parallel. Show the pattern:

```typescript
// pattern — one schema, inferred type
const CreateSessionRequest = z.object({ /* ... */ });
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;
```
- **`types.ts` barrels:** each domain exposes a `types.ts` barrel re-exporting its contract types; consumers import from the barrel path, never from scattered files.
- **Path aliases:** imports go through `tsconfig.json` path aliases; no deep relative import chains (`../../../`).

- [ ] **Step 6: Add the Error-Code Registry section**

Append `## Error-Code Registry`: a single enumerated registry is the only source of domain code → HTTP status → `retryable`, extending the frozen initial set from `00-Overview.md`. Include a table (dated) seeded from the frozen codes:

| Code | HTTP | Retryable | Date |
| ---- | ---- | --------- | ---- |
| `UNAUTHORIZED` | 401 | no | 2026-07-10 |
| `PLAYER_NOT_PROVISIONED` | 403 | no | 2026-07-10 |
| `SESSION_OWNERSHIP_MISMATCH` | 403 | no | 2026-07-10 |
| `SESSION_ALREADY_COMPLETED` | 409 | no | 2026-07-10 |
| `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` | 409 | no | 2026-07-10 |
| `BATCH_INCONSISTENT_ORDERING` | 422 | no | 2026-07-10 |
| `BATCH_REFERENCE_MISSING` | 422 | no | 2026-07-10 |
| `INTERNAL_ERROR` | 500 | no | 2026-07-10 |

State: both controllers (status mapping) and services (throwing/returning) reference this one registry.

- [ ] **Step 7: Add the Extensibility Rule and Related Documents sections**

Append `## Extensibility Rule`: the transport contract is engine-agnostic; new game types never edit endpoint contracts or shared code — they register a ruleset config validator (see `04-Endpoint-Contracts.md` §Extensibility). Then append `## Related Documents` table (dated rows) linking `00-Overview.md`, `01-Implementation-Strategy.md`, `02-Middleware-And-Layering.md`, `04-Endpoint-Contracts.md`.

- [ ] **Step 8: Verify required sections and dates are present**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
grep -c "^## " architecture/docs/architecture/06-API/03-Shared-Conventions.md
grep -E "Response Envelope|Header Contract|requestId Propagation|Pagination|Validation & Types|Error-Code Registry|Extensibility Rule|Related Documents" architecture/docs/architecture/06-API/03-Shared-Conventions.md
grep -c "2026-07-10" architecture/docs/architecture/06-API/03-Shared-Conventions.md
grep "0.1.0 (draft)" architecture/docs/architecture/06-API/03-Shared-Conventions.md
```
Expected: at least 8 `## ` headings; all eight section names matched; date count ≥ 12; the draft version line present.

- [ ] **Step 9: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
git add architecture/docs/architecture/06-API/03-Shared-Conventions.md
git commit -m "docs(api): add 03-Shared-Conventions.md (draft) — envelope, headers, types, error registry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Author `04-Endpoint-Contracts.md` (draft)

Per-domain request/response contracts for the full v1 surface, with the engine-agnostic batch payload as centerpiece.

**Files:**
- Create: `architecture/docs/architecture/06-API/04-Endpoint-Contracts.md`
- Reference (read-only): `03-Shared-Conventions.md` (Task 1), `00-Overview.md`, `05-Database/06-Database-Specification.md`
- Spec source: `docs/superpowers/specs/2026-07-10-api-architecture-design.md` §5, §6

**Interfaces:**
- Consumes from Task 1: envelope builders `ok`/`err`, `ListResult<T>` shape `{ items, nextCursor }`, Zod-SSOT rule, error-code registry.
- Produces: named contract sketches `EventsBatchRequest`, `CreateSessionRequest` (discriminated `config`), `ProvisionPlayerResponse`, and the read response sketches.

- [ ] **Step 1: Create the document skeleton with header**

Create the file with this exact top matter:

```markdown
# API Endpoint Contracts

> **Version:** 0.1.0 (draft)
>
> Per-domain request/response contracts for the v1 API surface.
> Subordinate to the frozen contract in `00-Overview.md`. Shared conventions (envelope, headers,
> pagination, types, error registry) are defined in `03-Shared-Conventions.md` and are not repeated here.
> All schemas are design-level Zod sketches — not implementation.

---

## Purpose

Define the concrete request and response shape of every v1 endpoint. The transport is
engine-agnostic: the same runtime payload serves 501, TUOD, Singles, and Score Training.
Reference values travel as `implementation_key`s; the client sends no persistence UUIDs
(the Worker generates UUIDv7).
```

- [ ] **Step 2: Add the engine-agnostic batch write section (centerpiece)**

Append `## Write Path — `POST /api/sessions/:sessionId/events:batch`` containing:
- The generic tree explanation (stages → turns → darts), engine-agnostic across all four game types.
- A design-level Zod sketch in a fenced `typescript` block:

```typescript
// design sketch — reference values are implementation_key strings; no persistence UUIDs
const DartFact = z.object({
  sequence: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string(),               // dart_zones.implementation_key
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),                    // dart_zones.implementation_key
  score: z.number().int(),
});
const TurnFact = z.object({
  clientKey: z.string(),                     // client-side ordering/dedup key
  participantRef: z.string(),                // participant reference within the session
  sequence: z.number().int(),
  totalScore: z.number().int(),
  completedAt: z.string().datetime().nullable(),
  darts: z.array(DartFact),                  // [] in recreational mode
});
const StageFact = z.object({
  clientKey: z.string(),
  stageTypeKey: z.string(),                  // stage_types.implementation_key
  parentClientKey: z.string().nullable(),    // tree nesting
  sequence: z.number().int(),
  turns: z.array(TurnFact),
});
const EventsBatchRequest = z.object({ stages: z.array(StageFact) });
type EventsBatchRequest = z.infer<typeof EventsBatchRequest>;
```
- Rules: recreational mode `darts: []`; analytics mode full darts; ruleset decides which is required. Idempotency via `Idempotency-Key` + normalized payload hash; single transaction; `409 SESSION_ALREADY_COMPLETED` on completed session. `clientKey`/`parentClientKey` map to server-generated UUIDv7; referential failures map to `BATCH_INCONSISTENT_ORDERING` / `BATCH_REFERENCE_MISSING` (from the registry in `03`).
- Success returns the standard envelope with created-row summary (counts + server ids).

- [ ] **Step 3: Add the session creation section with discriminated config**

Append `## Session Creation — `POST /api/sessions`` with a Zod sketch of the discriminated config union:

```typescript
// discriminated config input — template-based OR ad-hoc inline; server snapshots + validates in every case
const ConfigInput = z.discriminatedUnion("source", [
  z.object({ source: z.literal("template"), templateRef: z.string(), overrides: z.record(z.unknown()).optional() }),
  z.object({ source: z.literal("inline"),   config: z.record(z.unknown()) }),
]);
const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),                   // game_types.implementation_key
  rulesetVersionKey: z.string(),             // ruleset_versions.implementation_key
  config: ConfigInput,
});
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;
```
State: server resolves the source, validates the resolved config against the ruleset validator, and **materializes the configuration snapshot in every case** (config copied, never referenced). Creates activity / exercise session / config snapshot / participants; returns server-generated `sessionId`.

- [ ] **Step 4: Add the provisioning section**

Append `## Player Provisioning — `POST /api/players/provision``:
- JWT-valid user with no `players` row → create one from `auth_user_id`.
- Idempotent: returns the existing player if already provisioned.
- Response sketch:

```typescript
const ProvisionPlayerResponse = z.object({
  playerId: z.string(),                      // UUIDv7
  authUserId: z.string(),
  created: z.boolean(),                      // false when already provisioned
});
type ProvisionPlayerResponse = z.infer<typeof ProvisionPlayerResponse>;
```
- Note: this endpoint closes the `PLAYER_NOT_PROVISIONED` gap and requires the `00-Overview.md` route-surface edit in Task 3.

- [ ] **Step 5: Add the read contracts section**

Append `## Read Contracts` with a dated table mapping each read endpoint to its view and response shape (thin, view-backed; list endpoints use `ListResult<T>` from `03`):

| Endpoint | View | Shape | Date |
| -------- | ---- | ----- | ---- |
| `GET /api/sessions/active` | `v_active_sessions` | object or null | 2026-07-10 |
| `GET /api/sessions?limit=&cursor=` | `v_session_overview` | `ListResult<SessionOverview>` | 2026-07-10 |
| `GET /api/sessions/:sessionId/replay` | `v_game_replay` | object (1:1 view) | 2026-07-10 |
| `GET /api/sessions/:sessionId/darts` | `v_dart_analytics` | array (1:1 view) | 2026-07-10 |
| `GET /api/routines` | `v_routine_execution` | `ListResult<RoutineSummary>` | 2026-07-10 |
| `GET /api/routines/:routineId/execution` | `v_routine_execution` | object (1:1 view) | 2026-07-10 |
| `GET /api/statistics/overview` | overview aggregation | object | 2026-07-10 |

State: replay/analytics/darts stay close to 1:1 view contracts; list/overview endpoints wrap view output in the standard `ListResult` shape.

- [ ] **Step 6: Add the Extensibility section and Related Documents**

Append `## Extensibility — Ruleset Validator Registry`: config JSONB is validated per `ruleset_version` by a registered schema resolved at runtime; adding a game type/ruleset = register a validator (+ engine), and the API surface, transport contract, and shared code stay frozen. Then append `## Related Documents` (dated rows) linking `00-Overview.md`, `03-Shared-Conventions.md`, `05-Database/06-Database-Specification.md`.

- [ ] **Step 7: Verify sections, schema sketches, and dates**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
grep -E "Write Path|Session Creation|Player Provisioning|Read Contracts|Extensibility" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
grep -E "EventsBatchRequest|CreateSessionRequest|ProvisionPlayerResponse|discriminatedUnion" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
grep -c "2026-07-10" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
grep "0.1.0 (draft)" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
```
Expected: all five section names matched; all four contract identifiers matched; date count ≥ 10; draft version line present.

- [ ] **Step 8: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
git add architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
git commit -m "docs(api): add 04-Endpoint-Contracts.md (draft) — engine-agnostic contracts + provision

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Reconcile `00-Overview.md` — add provisioning route (dated edit)

**Files:**
- Modify: `architecture/docs/architecture/06-API/00-Overview.md`
- Spec source: `docs/superpowers/specs/2026-07-10-api-architecture-design.md` §2, §5.3

**Interfaces:**
- Consumes: `ProvisionPlayerResponse` contract from Task 2 (referenced, not redefined here).

- [ ] **Step 1: Read the current route surface and related-documents sections**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
grep -n "Statistics (v1)\|## Related Documents\|Route Surface" architecture/docs/architecture/06-API/00-Overview.md
```
Expected: line numbers for the route-surface subsections and the related-documents table.

- [ ] **Step 2: Add a Players section to the route surface**

Under `## Route Surface (v1 Baseline)`, after the `### Statistics (v1)` block, insert:

```markdown
### Players

- `POST /api/players/provision` <!-- 2026-07-10 -->
```
State inline (one sentence) that provisioning creates the `players` row for a JWT-valid user and is idempotent; full contract in `04-Endpoint-Contracts.md`.

- [ ] **Step 3: Add related-documents rows for 03 and 04**

In the `## Related Documents` table at the end of `00-Overview.md`, add two dated rows:

```markdown
| `03-Shared-Conventions.md`      | Envelope builders, header contract, pagination, type system, error registry (2026-07-10) |
| `04-Endpoint-Contracts.md`      | Per-domain request/response contracts for the v1 surface (2026-07-10)                     |
```

- [ ] **Step 4: Verify the edits landed and nothing else changed**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
grep -n "players/provision\|03-Shared-Conventions\|04-Endpoint-Contracts" architecture/docs/architecture/06-API/00-Overview.md
git diff --stat architecture/docs/architecture/06-API/00-Overview.md
```
Expected: `POST /api/players/provision` present; both new doc references present; diff touches only `00-Overview.md`.

- [ ] **Step 5: Confirm the frozen contract body is otherwise unchanged**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
git diff architecture/docs/architecture/06-API/00-Overview.md
```
Expected: only additive lines (Players subsection + two related-docs rows). No frozen decisions altered. If any existing line changed, revert it.

- [ ] **Step 6: Commit**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
git add architecture/docs/architecture/06-API/00-Overview.md
git commit -m "docs(api): add players/provision route + link 03/04 in 00-Overview (2026-07-10)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Cross-document consistency verification

Confirms the three docs agree and no forbidden patterns were introduced. This is a reviewer gate; it produces no new file but may fix small inconsistencies.

**Files:**
- Reference (read-only): all of `06-API/00`–`04`, `07-Frontend/00-Overview.md`
- Reference (read-only): `architecture/docs/architecture/README.md` (doc map)

- [ ] **Step 1: Verify terminology and reference-value consistency**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
grep -rn "implementation_key" architecture/docs/architecture/06-API/03-Shared-Conventions.md architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
grep -rn "vw_" architecture/docs/architecture/06-API/03-Shared-Conventions.md architecture/docs/architecture/06-API/04-Endpoint-Contracts.md || echo "OK: no vw_ prefix"
grep -rn "z.infer\|discriminatedUnion" architecture/docs/architecture/06-API/04-Endpoint-Contracts.md
```
Expected: reference values described as `implementation_key`; no `vw_` prefix (must be `v_`); `z.infer` and `discriminatedUnion` present.

- [ ] **Step 2: Verify no app/ code, migrations, or seeds were touched**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
git diff --stat main..api-architecture -- app/ architecture/docs/database/ 2>/dev/null || echo "no such paths changed"
git diff --stat main..api-architecture --stat | grep -vE "docs/superpowers|06-API/" && echo "UNEXPECTED FILES CHANGED" || echo "OK: only spec/plan + 06-API docs changed"
```
Expected: only `docs/superpowers/*` and `06-API/*` files changed; no `app/`, no `database/` changes.

- [ ] **Step 3: Verify envelope/error-registry alignment between 03 and 00**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
for code in UNAUTHORIZED PLAYER_NOT_PROVISIONED SESSION_ALREADY_COMPLETED SESSION_OWNERSHIP_MISMATCH IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD BATCH_INCONSISTENT_ORDERING BATCH_REFERENCE_MISSING INTERNAL_ERROR; do
  grep -q "$code" architecture/docs/architecture/06-API/03-Shared-Conventions.md && echo "03 has $code" || echo "MISSING in 03: $code";
done
```
Expected: every frozen code from `00-Overview.md` appears in the `03` registry. Fix `03` if any is missing.

- [ ] **Step 4: Update the architecture README doc map if it enumerates 06-API files**

Run:
```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
grep -n "06-API" architecture/docs/architecture/README.md
```
If the README lists individual `06-API/*` files, add dated entries for `03-Shared-Conventions.md` and `04-Endpoint-Contracts.md` matching the existing format. If it only references the folder, make no change. (Do not restructure the README.)

- [ ] **Step 5: Commit any consistency fixes (skip if clean)**

```bash
cd /Users/levi/Development/dart-analytics/.worktrees/api-architecture
git add -A architecture/docs/architecture/
git diff --cached --quiet && echo "nothing to commit" || git commit -m "docs(api): consistency fixes across 06-API docs and README map (2026-07-10)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Spec §2 deliverables (03, 04, 00 edit) → Tasks 1, 2, 3. ✓
- Spec §4 shared-conventions outline (envelope, headers, requestId, pagination, types, error registry, extensibility) → Task 1 Steps 2–7. ✓
- Spec §5 endpoint contracts (batch, create+discriminated config, provision, reads) → Task 2 Steps 2–5. ✓
- Spec §6 ruleset validator registry + testability → Task 2 Step 6. ✓
- Spec D2 provisioning reconciliation → Task 2 Step 4 + Task 3. ✓
- Spec §8 DoD items 1–5 → Tasks 1–4 + Task 4 Step 2 (no app/migrations). ✓
- Dated-row rule → dated tables in every task. ✓

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". Every doc section specifies exact headings and the concrete content/tables/sketches to write. ✓

**3. Type/name consistency:** `ok`/`err`, `ListResult<T>`/`{ items, nextCursor }`, `EventsBatchRequest`, `CreateSessionRequest`, `ConfigInput` (discriminated), `ProvisionPlayerResponse` are used identically in the tasks that define and reference them. Reference values consistently called `implementation_key`. ✓
