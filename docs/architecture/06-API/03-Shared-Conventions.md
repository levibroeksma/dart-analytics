<!--
status: canonical
scope: api/shared-conventions
read-when: envelopes, headers, pagination, error codes
updated: 2026-07-16
-->

# API Shared Conventions

> **Version:** 1.4.0 (two-barrel + interfaces.ts raising chain, 2026-07-16)
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

---

## Response Envelope

Response envelopes are produced by the frozen success and error shapes defined in `00-Overview.md`.

### Success shape

```json
{
  "ok": true,
  "data": {},
  "requestId": "uuid"
}
```

### Error shape

```json
{
  "ok": false,
  "requestId": "uuid",
  "error": {
    "code": "DOMAIN_ERROR_CODE",
    "message": "human-readable summary",
    "retryable": false,
    "details": {}
  }
}
```

### Envelope builders

All envelopes are produced **only** via two shared builder functions. Handlers never hand-assemble envelopes.

```typescript
// design signatures — not implementation
function ok<T>(data: T, requestId: string): SuccessEnvelope<T>;
function err(code: DomainErrorCode, opts: { message?: string; retryable?: boolean; details?: unknown }, requestId: string): ErrorEnvelope;
```

---

## Header Contract

Standard headers carried on every request and response:

| Header | Direction | When | Date |
| ------ | --------- | ---- | ---- |
| `Authorization: Bearer <JWT>` | request | all protected routes | 2026-07-10 |
| `Idempotency-Key` | request | batch write only | 2026-07-10 |
| `Content-Type: application/json` | request/response | bodies | 2026-07-10 |
| `X-Request-Id` (echo) | response | all responses | 2026-07-10 |

---

## requestId Propagation

`requestId` is assigned by middleware (per `02-Middleware-And-Layering.md`), carried in `locals.requestId`, and echoed in every envelope and in the `X-Request-Id` response header. This enables distributed tracing and request correlation across logs.

---

## Pagination

List endpoints support cursor-based pagination, matching the frozen `?limit=&cursor=` query parameters from `00-Overview.md`.

### Cursor semantics

- **Opaque:** cursors are base64url-encoded and server-owned; clients treat them as opaque and never construct them.
- **Next cursor:** `nextCursor: null` signals no further pages.
- **Ordering key:** the sessions list orders by `session_id DESC` (UUIDv7 is creation-time ordered, so the primary key doubles as the pagination key); the opaque cursor encodes the last-seen `session_id`. <!-- 2026-07-13 -->

### Standard list data shape

All list endpoints return the following contract:

```typescript
// standard shape for all list endpoints
type ListResult<T> = { items: T[]; nextCursor: string | null };
```

---

## Validation & Types (Strict Rules)

Three invariants ensure type safety and maintainability across all contracts.

### Zod single source of truth (z.infer<>)

Every request and response contract is defined as one Zod schema. TypeScript types are never hand-authored in parallel; they are derived via `z.infer<>`.

```typescript
// pattern — one schema, inferred type
const CreateSessionRequest = z.object({ /* ... */ });
type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;
```

This pattern is the only valid way to define contracts. No separate `.d.ts` files for request types.

### `types.ts` barrels (type-raising)

TypeScript types live as close as possible to their source. Types are then
*raised* through a chain of `types.ts` barrels until they reach the
**top-level area barrel** (`services/types.ts`, `repositories/types.ts`,
`routes/types.ts`, `lib/types.ts`), so every consumer imports one shallow,
stable path — `@<area>/types` — regardless of how deep the type is defined.

**The raising rule (applies at every level):**

- Every folder that defines contract types has its own `types.ts` that
  re-exports the types defined directly in that folder.
- Every **parent** folder's `types.ts` re-raises each child folder's barrel
  (`export * from './<child>/types'`), so types bubble up one level at a time.
- The chain terminates at the area root (`<area>/types.ts`), which therefore
  transitively exposes every type defined anywhere beneath it.
- A folder's `types.ts` only ever re-exports its own types plus its direct
  children's barrels — never a grandchild's path directly. Each level raises
  the level immediately below it.

```
src/services/
├── types.ts                    # export * from './sessions/types'; export * from './routines/types'
├── sessions/
│   ├── types.ts                # export * from './create/types'; own types
│   └── create/
│       ├── types.ts            # defines CreateSessionInput, re-raised by parent
│       └── create.service.ts
└── routines/
    └── types.ts                # own types
```

```typescript
// good: import from the area barrel — always one level deep,
// even though CreateSessionInput is defined three levels down
import type { CreateSessionInput } from '@services/types';

// bad: deep path into the defining module (skips the raising chain)
import type { CreateSessionInput } from '@services/sessions/create/types';
```

A type never travels through a deeper import path than `@<area>/types`, and no
barrel reaches past its direct children.

### Two barrels at the Worker/browser boundary

A type defined in a Worker-owned folder (`pages/api/`, `services/`, `repositories/`) that a
browser consumer also needs is **not** imported directly from its Worker barrel by browser
code. Instead, exactly one client-owned file re-raises it:

```
src/pages/api/players/types.ts   # Worker: defines ProvisionPlayerRequest, etc.
src/pages/api/types.ts           # Worker: routes-area barrel (@routes/types)
src/lib/client/api/types.ts      # Browser: re-exports what it needs (@client/api/types)
```

`lib/client/api/types.ts` is the **only** browser file with a legitimate `@routes/types`
import. Every other browser consumer (`modules/`, `forms/`, future `.data.ts` files) imports
from `@client/api/types` instead — the successor to the retired `@types/api` alias.

### `interfaces.ts` barrels — a parallel, separate chain

TS `interface` declarations are raised through their **own** `interfaces.ts` barrel file,
following the identical mechanics as `types.ts` above (same folder-by-folder chain, same
"raised only once consumed outside its defining file" scope), but never mixed into `types.ts`
— a folder with both gets two barrels side by side. Reference example: `repositories/interfaces.ts`.

Two standing exceptions, unaffected by this rule:
- `.astro` component interfaces (e.g. `interface Props`) stay inline in the component's own
  frontmatter (`../07-Frontend/05-Astro-Components.md`, D92).
- `env.d.ts` is a TypeScript ambient global-augmentation file at an Astro/TS-required
  well-known path, not a regular module — excluded entirely.

### Path aliases

All imports go through `tsconfig.json` path aliases, `@`-prefixed by area
(e.g. `@services/*`, `@repositories/*`, `@routes/*`, `@lib/*`, `@db/*`). Deep
relative import chains (`../../../`) are forbidden. (Barrel type imports use
the `@<area>/types` form above.) <!-- alias set realized in app/tsconfig.json, 2026-07-16 -->

---

## Response DTOs & Mapping

Response bodies are typed DTOs, defined per endpoint in `04-Endpoint-Contracts.md`. Rules:

- **Naming:** DTO fields are camelCase. PostgreSQL view columns are snake_case; the **repository** maps snake_case rows → camelCase DTOs (Drizzle already surfaces columns as camelCase). snake_case never leaks past the repository.
- **Single source of truth:** one Zod schema per response; the TypeScript type is `z.infer<>`, never hand-authored — the same rule as request contracts.
- **Omit internal fields:** read DTOs never expose internal lookup ids or `player_id` (reads are player-scoped to the caller). They expose `*_key` implementation keys and only the entity UUIDs a client addresses later.
- **Timestamps:** ISO 8601 strings (`z.string().datetime()`).
- **Lists:** wrapped in `ListResult<T>`; other reads are the DTO object or an array of DTOs, close to 1:1 with the backing view.

DTO types live in the domain `types.ts` barrels and are imported via path aliases (same rules as request contracts). <!-- 2026-07-12 -->

---

## Error-Code Registry

A single enumerated registry is the only source of domain code → HTTP status → `retryable`, extending the frozen initial set from `00-Overview.md`. Both controllers (status mapping) and services (throwing/returning) reference this one registry.

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
| `NOT_FOUND` | 404 | no | 2026-07-13 |
| `VALIDATION_FAILED` | 422 | no | 2026-07-13 |
| `INVALID_STATUS_TRANSITION` | 409 | no | 2026-07-13 |
| `SERVICE_UNAVAILABLE` | 503 | **yes** | 2026-07-13 |

`VALIDATION_FAILED` covers all input-schema, config, template-resolution, and ruleset validation failures; specifics travel in `error.details`, never as new codes. `SERVICE_UNAVAILABLE` is the only retryable code — it is what activates the client retry rule. The registry is closed for v1. <!-- 2026-07-13 -->

---

## Extensibility Rule

The transport contract (envelope, headers, pagination) is engine-agnostic. New game types never edit endpoint contracts or shared code. Instead, they register a ruleset config validator. See `04-Endpoint-Contracts.md` §Extensibility for the pattern.

---

## Related Documents

| Document | Purpose | Date |
| -------- | ------- | ---- |
| `00-Overview.md` | Frozen API baseline contract (routes, auth, error shapes) | 2026-07-10 |
| `01-Implementation-Strategy.md` | REST vs Astro Actions, proxy terminology, Cloudflare + Neon constraints | 2026-07-13 |
| `02-Middleware-And-Layering.md` | Middleware responsibilities, layer ownership, `app/` folder structure | 2026-07-13 |
| `04-Endpoint-Contracts.md` | Per-domain endpoint contracts and ruleset extensibility patterns | 2026-07-10 |
