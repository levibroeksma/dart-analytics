# Design — Hardening for First Cloudflare Deploy (Score Training)

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-22.
> Scope: harden design + rule enforcement so the first game engine (Score Training)
> can be deployed to Cloudflare for live testing. Resilience and frozen-contract
> edges only — no new gameplay features.

---

## 1. Background & Motivation

An audit of `app/src` against the canonical docs (`docs/architecture/**`, `DECISIONS.md`)
found the baseline healthy — all 5 context check scripts pass, 200/200 unit tests pass,
0 type errors — but the failure/resilience surface is unimplemented. Every documented
failure and retry affordance exists on paper but has no enforcing code. That is the right
thing to harden before real devices hit the app on Cloudflare Workers + Neon (scale-to-zero,
where transient cold-start failures are expected, per D24).

### Audit findings addressed

| ID | Severity | Finding |
| -- | -------- | ------- |
| H1 | High | No API error boundary. No `try/catch` in any `pages/api/**` handler or `services/**`. A thrown error escapes uncaught → Astro returns a **non-envelope** framework 500, violating "every response uses the envelope + requestId". `SERVICE_UNAVAILABLE` (the only retryable code) is defined in `errors.ts` but **never emitted anywhere**. |
| H2 | High | Client `apiRequest` calls `response.json()` unconditionally and never checks `response.ok`. A non-envelope 500 or a Cloudflare 502/504/1015 throws a parse error instead of yielding a retryable `ApiResult` failure. |
| H3 | High | `createSession` never pre-checks for an existing ACTIVE session and doesn't catch the `uq_sessions_single_active` unique violation. A double-tap, second tab, or a failed orphan-abandon (D118 `abandon_failed`) → raw Postgres error → uncaught framework 500. No conflict code exists. |
| C1 | Medium | `findActiveSessions` / `findConfigurationPresets` do bare `select().from(view)`; both views expose `player_id`, so `GET /api/sessions/active` and `GET /api/configuration-templates` return `playerId` to the client — violating the frozen read-DTO contract ("read DTOs never expose `player_id`", `03-Shared-Conventions.md`). |
| S1 | Low (scope) | `GET /api/sessions` (list), `GET /:id`, `/replay`, `/darts` are in the frozen route surface but unimplemented. Not needed for the Score Training loop, but code and the frozen surface diverge silently. |
| M1 | Low | `validate:app`'s `astro check` reported a phantom error from a stale `.astro` cache; clearing cache → 0 errors. Validation is non-deterministic. |
| M2 | Low | `tests/services/session.service.test.ts` imports `canonicalize` but never uses it; the service's "exported for testing" `fallow-ignore` rationale is now stale. |

### Decisions taken during brainstorming

1. **Contract latitude** — this pass may amend the frozen API baseline and closed error
   registry where hardening requires it, each recorded as an explicit `DECISIONS.md` entry
   + targeted doc updates.
2. **Client resilience scope** — robust parse (never throw on a non-envelope response) +
   bounded retry for **GET only**; writes stay on the existing hard-gate/outbox paths.
3. **H3 conflict response** — `409 SESSION_ALREADY_ACTIVE` carrying the existing `sessionId`
   and `startedAt` in `error.details`, so the client can offer Continue/Abandon without a
   second round-trip.
4. **H1 boundary mechanism** — a global boundary in middleware (single guaranteed chokepoint),
   gated to `api-*` route classes.

---

## 2. Scope

**In scope:** H1, H2, H3, C1 (core); M1, M2, S1 (hygiene).

**Out of scope:** implementing the unbuilt read endpoints (`GET /sessions` list, `/:id`,
`/replay`, `/darts`) — deferred, but S1 documents the divergence explicitly rather than
leaving it silent. No new gameplay features, no statistics endpoints (post-v1 per D63),
no RLS (post-v1 per D34).

---

## 3. Workstreams

### §1 — API error boundary (H1) · new decision D131

**Change.** Wrap `next()` in `app/src/middleware.ts` in a `try/catch`, gated to the
`api-provision` and `api-protected` route classes (page routes keep Astro's default HTML
error handling — they never carry the JSON envelope). On a thrown error:

- Classify via a new pure helper `app/src/lib/server/classify-error.ts`
  (`classifyThrownError(err): "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR"`): transient
  Neon/connectivity failures (fetch failure, connection terminated/reset, pool/timeout
  errors) → `SERVICE_UNAVAILABLE`; everything else → `INTERNAL_ERROR`.
- Return the frozen envelope via `fail(code, ctx.locals.requestId)` — **registry message
  only; the raw error text is never sent to the client**. Log the real error server-side
  keyed by `requestId` (`console.error`) for diagnosis.

**Layering note.** The boundary lives in middleware because `02-Middleware-And-Layering.md`
already names middleware "the single entry point for cross-cutting API concerns"; it is the
one place guaranteed to run and cannot be forgotten by a future route. Domain-specific
failures (e.g. H3) are still produced by the service and returned as `ServiceResult`; the
middleware boundary is the catch-all *underneath* them.

**Type note.** `classifyThrownError`'s helper interface, if any, follows the
`interfaces.ts` barrel rule; the function itself lives in `lib/server/` and is exported
for unit testing.

**Docs / rules.** `02-Middleware-And-Layering.md`: add an "Error boundary (uncaught →
enveloped 5xx)" row to the middleware-owned-concerns table and a Rules entry.
`DECISIONS.md`: D131.

**Tests (TDD, D99).**
- Handler throws a simulated transient error → 503 `SERVICE_UNAVAILABLE` envelope,
  `retryable:true`, `requestId` present.
- Handler throws a generic error → 500 `INTERNAL_ERROR` envelope.
- `classifyThrownError` unit tests for representative transient vs generic errors.
- A page-route throw is **not** enveloped (middleware only catches `api-*`).

---

### §2 — Single-active-session conflict (H3) · new decision D132 · new code `SESSION_ALREADY_ACTIVE`

**New error code.** `SESSION_ALREADY_ACTIVE` → **409, not retryable**. Added to
`app/src/lib/server/errors.ts` (`ERROR_HTTP`); the `ErrorCode` type derives from it
automatically. Registered in `00-Overview.md` (initial code list) and
`03-Shared-Conventions.md` (registry table).

**Service change (`createSession`).** Two layers:

1. **Pre-check (common path).** New repository fn
   `findActiveSessionForGameType(db, playerId, gameTypeId): { sessionId, startedAt } | undefined`.
   If an active session exists → return
   `{ ok:false, code:"SESSION_ALREADY_ACTIVE", details:{ sessionId, startedAt } }`.
2. **Race-safe backstop.** Wrap `insertSessionRecords` so a `uq_sessions_single_active`
   unique-violation is caught, re-query the active session, and return the same
   `SESSION_ALREADY_ACTIVE` + details. If the re-query misses (should not happen) →
   `INTERNAL_ERROR`. This closes the TOCTOU gap the pre-check alone leaves.

**Controller.** No special-casing: `fail(result.code, requestId, result.details)` already
forwards the code + details generically.

**Client (minimal).** `app/src/lib/game/score-training-setup.data.ts`: on a
`SESSION_ALREADY_ACTIVE` from create, follow the D118 "match" path — surface Continue/Abandon
using `details` by reusing the existing `ContinueSessionModal` (no new modal, no new store).

**Docs / rules.** `04-Endpoint-Contracts.md` (POST /api/sessions outcomes: add the conflict
case), `00-Overview.md` + `03-Shared-Conventions.md` (registry), `06-Spec/04-Runtime-Layer.md`
(note the ACTIVE-uniqueness invariant is now **server-guarded**, not DB-only). `DECISIONS.md`: D132.

**Tests.**
- Create with an existing active session → `SESSION_ALREADY_ACTIVE` + `details` (pre-check path).
- Simulated `uq_sessions_single_active` violation on insert → same code + details (race path).
- Client setup: a `SESSION_ALREADY_ACTIVE` create response drives the Continue/Abandon modal.

---

### §3 — Read-DTO `player_id` leak (C1) · conformance fix, no new decision

**Change.** Replace the bare `select().from(view)` in `findActiveSessions` and
`findConfigurationPresets` (`app/src/repositories/session.repository.ts`) with explicit
`.select({ … })` projections that **omit `player_id`** and match the DTO field sets exactly:

- `findActiveSessions` → `sessionId, gameTypeKey, gameTypeName, captureModeKey,
  inputModeKey, rulesetVersionKey, startedAt` (matches `SessionActive`).
- `findConfigurationPresets` → `configurationTemplateId, gameTypeKey, name, description,
  configuration, isSystemTemplate` (matches `ConfigurationPreset`).

The player-scope `WHERE` predicate still references `player_id`; it simply never appears in
the projection, so it cannot leave the repository. This brings code into conformance with the
already-frozen `03`/`04`; no doc change required.

**Optional / stretch (rule enforcement).** A check-script rule banning bare `select()` from a
`v_*` view (mechanizing the DTO-projection rule, in the D105/D110/D127 spirit). Marked
optional — include only if it is not disproportionate for a single repo. If included, it is a
rule sharpening and requires the self-learning-gate approval (root `CLAUDE.md` step 8).

**Tests.**
- `findActiveSessions` output contains no `playerId` key and matches `SessionActive` shape.
- `findConfigurationPresets` output contains no `playerId` key and matches `ConfigurationPreset` shape.
- Update any existing tests asserting the old raw-row shape.

---

### §4 — Client resilience (H2) · conformance/robustness, no new decision

**Change (`app/src/lib/client/api/client.ts`).**

- Guard `response.json()`. If `!response.ok` **or** the body is not a valid envelope,
  synthesize a retryable `SERVICE_UNAVAILABLE` `ApiFailure` (real HTTP status in `details`)
  instead of throwing. `apiRequest` therefore always resolves to an `ApiResult`, never rejects
  on a transport/parse failure.
- **Bounded retry for GET only** (idempotent reads): up to 2 retries with backoff on
  retryable failures / network errors. Non-GET calls never auto-retry — writes rely on the
  existing Score-Training hard-gate + outbox (D90/D119) with their idempotency key.

**Tests.**
- A 500 with an HTML body → `apiRequest` resolves to a `SERVICE_UNAVAILABLE` failure (no throw).
- A GET retries N times on retryable failure, then fails.
- A POST does not auto-retry.

---

### §5 — Hygiene

- **M1.** Make `astro check` deterministic: clear the `.astro` type cache (and
  `node_modules/.vite`) before the check step in the npm-script pipeline so `validate:app`
  cannot chase phantom stale-cache errors.
- **M2.** Add a real `canonicalize` unit test — it is load-bearing for idempotency-hash
  stability — which justifies the `fallow-ignore` export and clears the ts6133 unused-import
  warning. (Alternative if declined: drop the export and the `fallow-ignore` comment.)
- **S1.** Add an explicit "deferred until after the first engine" marker in `00-Overview.md`
  / `02-Middleware-And-Layering.md` for the unbuilt read endpoints, so the code↔contract
  divergence is intentional and documented.

---

## 4. New Decision Ledger Entries

- **D131** — API error boundary in middleware: uncaught exceptions on `api-*` routes are
  classified to `SERVICE_UNAVAILABLE` (transient) or `INTERNAL_ERROR` and returned in the
  frozen envelope with `requestId`; raw error text is never sent to the client. Formalizes
  the previously "optional" envelope-on-error rule and activates the `SERVICE_UNAVAILABLE`
  retry contract.
- **D132** — Server-guarded single-active-session invariant: `POST /api/sessions` pre-checks
  for an existing ACTIVE session and catches the `uq_sessions_single_active` violation as a
  race-safe backstop, returning the new `409 SESSION_ALREADY_ACTIVE` code with the existing
  `sessionId`/`startedAt` in `details`. Reopens the v1 error registry (previously "closed",
  D70) by explicit decision for this hardening pass.

---

## 5. Doc & Context-Maintenance Impact (root CLAUDE.md gate)

| Artifact | Change |
| -------- | ------ |
| `DECISIONS.md` | Add D131, D132 |
| `06-API/00-Overview.md` | Add `SESSION_ALREADY_ACTIVE` to code list; S1 deferred-endpoints marker; version/date bump |
| `06-API/02-Middleware-And-Layering.md` | Error-boundary responsibility row + Rules entry; S1 marker |
| `06-API/03-Shared-Conventions.md` | Add `SESSION_ALREADY_ACTIVE` to registry table |
| `06-API/04-Endpoint-Contracts.md` | POST /api/sessions conflict outcome |
| `05-Database/06-Spec/04-Runtime-Layer.md` | Note server-guarded ACTIVE-uniqueness invariant |
| `00-Context-Map.md` | Version bump + ISO dates for changed rows |
| `AGENT.md` mirrors | Kept byte-identical to any changed `CLAUDE.md` (none expected, but verify) |
| Check scripts | `check-context-map.sh`, `check-file-locations.sh`, `check-agent-mirrors.sh`, `check-astro-class-composition.sh`, `check-astro-conventions.sh` all pass |
| Knowledge graph | `bash scripts/refresh-graph.sh`; stage `graphify-out/graph.json` |

---

## 6. Testing Strategy

- TDD per D99: red → green → refactor for every behavioral change; tests live under
  `app/tests/` mirroring `app/src/` (never colocated).
- Full suite must stay green (currently 200 tests) and grow with the new coverage above.
- `npm run validate:app` (db status/migrate/introspect → fallow → test → astro check →
  graph refresh) is the completion gate.

---

## 7. Open / Optional Items

- §3 optional check-script guard — decision deferred to implementation; self-learning-gate
  approval required if adopted.
- Client conflict-UX kept intentionally minimal (§2); richer resume UX is a post-first-test
  follow-up.

---

## 8. Non-Goals / Explicitly Deferred

- Unbuilt read endpoints (`GET /sessions` list, `/:id`, `/replay`, `/darts`) — after first engine.
- Generic client retry for writes — writes stay on hard-gate/outbox.
- Statistics endpoints, RLS, guest/DartBot participants, multi-session activities — all post-v1.
