# Frontend State Model & Client Conventions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realize the approved spec `docs/superpowers/specs/2026-07-14-frontend-state-and-conventions-design.md` as targeted documentation edits — expanding the frontend state model, codifying client conventions, and closing the frontend CLAUDE.md gap — with the context system left consistent.

**Architecture:** Documentation-only change set. Canonical content lands in `07-Frontend/00-Overview.md` (state/integration seam) and a new sibling `07-Frontend/01-Client-Patterns.md` (client conventions). Operational rules land in `app/CLAUDE.md`. Decisions and the context map are updated per the mandatory Context Maintenance protocol.

**Tech Stack:** Markdown docs; `scripts/check-context-map.sh` (bash) as the verification gate. No application code is written or executed in this plan.

## Global Constraints

- Branch: `docs/frontend-state-and-conventions` (already created; do not merge to `main`). Copied verbatim from spec header.
- Minimal diffs; **targeted edits only, never regenerate docs** (root `CLAUDE.md` invariant / D50).
- Every new or changed docs row/entry gets an ISO date `2026-07-14` (Context Maintenance rule 4).
- New docs under `architecture/docs/architecture/` MUST carry a `status:` front-matter header **and** be registered in `00-Context-Map.md` — `scripts/check-context-map.sh` fails otherwise (script parts 3 & 4).
- This spec changes no frozen API contract (`06-API/00`–`04`) and adds no schema.
- App-config changes (`@alpinejs/persist` dependency, `astro.config.mjs` Alpine entrypoint, `@stores/*` tsconfig alias) are **documented, not executed** here — wiring an entrypoint to a not-yet-existing `lib/app.init.ts` would break `astro check`. They are recorded as the implementation-phase checklist in `01-Client-Patterns.md` (Task 2).
- Do not commit unless a step says to; the user has authorized commits for this branch's plan tasks.

---

### Task 1: Expand `07-Frontend/00-Overview.md` (state model, boundaries, performance, client contract)

**Files:**
- Modify: `architecture/docs/architecture/07-Frontend/00-Overview.md`

**Interfaces:**
- Consumes: spec §2 (state model), §3 (boundary rules + performance), §4.6 (API client contract) as the authoritative content source.
- Produces: an updated canonical frontend integration doc at version `0.3.0` that Task 2 (`01-Client-Patterns.md`) cross-references, and that Task 3 (`app/CLAUDE.md`) and Task 4 (`DECISIONS.md`) point to.

- [ ] **Step 1: Bump the doc version and date**

In the front-matter comment (line ~5), set `updated: 2026-07-14`. On line 10, change:

```
> **Version:** 0.2.0
```
to
```
> **Version:** 0.3.0
```

- [ ] **Step 2: Expand the `# State Model` section**

Immediately after the existing `## Temporary state (frontend-owned)` paragraph (the one ending "…loses the in-progress session."), insert these four subsections. Content is the authoritative prose from spec §2.1–§2.5 — reproduce it as the following markdown:

```markdown
### Two persisted stores

Temporary state is split across two Alpine stores with different lifecycles, because they change at different rates:

| Store | Holds | Shape driven by | Volatility |
| ----- | ----- | --------------- | ---------- |
| `session` (draft) | current ACTIVE game: `sessionId`, `participantRef`, `idempotencyKey`, capture/input modes, in-progress stages/turns/darts | **UI** — evolves with the engine and screens | High |
| `outbox` | array of completed-but-unsent batches: `{ sessionId, idempotencyKey, payload, attempts, lastError }` | **frozen `EventsBatchRequest`** (`../06-API/04-Endpoint-Contracts.md`) | Low |

The `session` draft is UI-shaped and churns as the engine and screens evolve; the `outbox` payload **is** the frozen API contract and does not. Keeping them separate means UI change never touches the durability path. <!-- 2026-07-14 -->

### Idempotency-key lifecycle

The batch `Idempotency-Key` is generated **once at session start**, stored on the `session` draft, carried into the `outbox` entry at completion, and **reused on every upload retry** — never regenerated per attempt. This makes the "server persisted the batch but the client never received the ack" case self-healing: retry with the same key + same payload hash returns the server's stored result (`../06-API/00-Overview.md` idempotency contract), and the client dequeues. <!-- 2026-07-14 -->

### Completed-but-unsent outbox

On session completion the assembled batch moves `session` → `outbox`; upload is attempted with a small number of backoff retries. On persistent failure the entry stays in the outbox, a passive **"unsaved — will retry"** indicator is shown, and auto-retry fires on next app load and on the browser `online` event. The entry is removed **only on confirmed success** (the server's same-key/same-hash stored-result response counts as success). No user action is required in the normal case. <!-- 2026-07-14 -->

### Per-store versioning

Each persisted store carries a `_v` integer with a **per-store version constant**, because the two stores warrant different discard policies:

- **`session` draft** — on `_v` mismatch, **discard** (`reset()`). An in-progress draft the current code cannot parse is unrecoverable anyway; abandon-and-restart is consistent with the accepted "device loss = data loss" tradeoff.
- **`outbox`** — its payload is the frozen `EventsBatchRequest`, so it is version-stable by construction. Policy is **attempt-upload-then-discard**, never blind discard. Silently dropping finished-but-unsent games is the one client-side data loss we actively prevent. <!-- 2026-07-14 -->

### Recovery is a precondition, not a convenience

`GET /api/sessions/active` reconciliation (resume/abandon) is a **precondition** for starting a new game: `uq_sessions_single_active` rejects a second ACTIVE session server-side, so a new game cannot be created while an orphaned ACTIVE session exists — the client must resume or abandon first. <!-- 2026-07-14 -->
```

- [ ] **Step 3: Add the boundary-rules + performance section**

Immediately before the existing `# API Client Pattern` heading (line ~118), insert this new section (content = spec §3.1–§3.3):

```markdown
# Boundary Rules & Performance

Two hard boundary rules keep the model consistent as new games, rulesets, player types, and eventually online play arrive:

1. **Client state is never a source of truth.** Persisted stores hold *intent pending confirmation* and nothing else; the instant the server confirms, the authoritative copy is the database. This is the client-side application of the Single Source of Truth value (`../01-Principles.md`).
2. **The outbox is the single durability seam, with an explicit acceptance contract.** Exactly one queue carries client → permanent data, and only ruleset-valid, fully-formed, frozen-shape `EventsBatchRequest` batches may enter it. Every future delivery path (including online sync) reuses this seam and the idempotency contract.

## Performance constraints (Neon + Cloudflare)

| Rule | Rationale |
| ---- | --------- |
| One transaction per session (batch at boundary); never per-dart server writes | Neon bills compute; CF Workers cap CPU/subrequests per request. Per-dart writes multiply latency and cost; the outbox bounds the DB to one write burst per session. |
| Reads view-backed, player-scoped, skeleton-first | Keeps first paint off the DB critical path; a small view-backed query set maps onto future Neon read replicas + edge caching. |
| Bound the batch payload size | A CF Worker has a finite CPU/transaction budget; a documented max-payload guard prevents a pathological session from exceeding it. |
| HTTP driver for reads; WebSocket/transaction driver only for the batch write | The existing `db/client.ts` factory split — the HTTP one-shot path is cheapest for view reads. |

## Deliberately not built now

- **No multi-device / server-authoritative mid-session state.** Online/live play arrives later as an **additive** capture mode with per-*turn* (never per-dart) server sync, reusing the idempotency contract; the offline-tolerant local-first path stays valid for solo play. Building sync now would force-unfreeze the recovery model and the API contract.
- **localStorage is the v1 persistence backend.** If offline queuing ever deepens, the **outbox only** migrates to IndexedDB via a `$persist` custom storage adapter. Forward lever, not built. <!-- 2026-07-14 -->
```

- [ ] **Step 4: Sharpen the API client contract**

In the `# API Client Pattern` section, under `## Response handling`, after the existing numbered list ("1. check `ok`…"), append this paragraph (content = spec §4.6):

```markdown
The client wrapper (`lib/api/client.ts`) **throws a typed `ApiError(code, retryable, details)` on `!ok`** and returns the parsed `data` on success, so call sites do not each re-check `ok`. It attaches the Bearer token, parses the envelope, and auto-retries only `retryable` batch writes with the stored idempotency key. Per-domain wrappers (`sessions.ts`, …) import the `z.infer` DTOs from `../06-API/04-Endpoint-Contracts.md`. See `01-Client-Patterns.md` for the client structure. <!-- 2026-07-14 -->
```

- [ ] **Step 5: Verify context-map consistency**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`
(`00-Overview.md` is already registered; the new `01-Client-Patterns.md` reference resolves after Task 2, but this doc does not yet reference it as a missing file — the `01-Client-Patterns.md` backtick in Step 4 resolves against the `07-Frontend/` base only once the file exists. If this step reports that reference missing, proceed to Task 2 and re-run; the two docs are a coupled change. To keep Task 1 independently green, run Task 2 before this verification if needed.)

- [ ] **Step 6: Commit**

```bash
git add architecture/docs/architecture/07-Frontend/00-Overview.md
git commit -m "docs(frontend): expand state model, boundary rules, performance, client contract

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Create `07-Frontend/01-Client-Patterns.md` and register it

**Files:**
- Create: `architecture/docs/architecture/07-Frontend/01-Client-Patterns.md`
- Modify: `architecture/docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: spec §4 (all conventions) and §5.6 (deferred app-config checklist) as content source; cross-references `00-Overview.md` from Task 1.
- Produces: a registered canonical doc `01-Client-Patterns.md` and an updated Frontend context pack. Task 3 and Task 4 reference this file by name.

- [ ] **Step 1: Create the new doc with front-matter**

Create `architecture/docs/architecture/07-Frontend/01-Client-Patterns.md` with this exact header, then the body from Steps 2–3:

```markdown
<!--
status: canonical
scope: frontend/client-conventions
read-when: building Astro pages, components, Alpine stores, or forms
updated: 2026-07-14
-->

# Frontend Client Patterns

> **Version:** 1.0.0 (2026-07-14)
>
> Client-side structure and conventions for the Astro + Alpine frontend in `app/`.
> The API integration seam and state ownership are in `00-Overview.md`.
```

- [ ] **Step 2: Add the convention sections**

Append the conventions from spec §4.1–§4.5. Reproduce spec §4.1 (canonical `.astro` frontmatter order), §4.2 (Alpine store DI-factory pattern including the `sessionStore(persist)` example, the `lib/app.init.ts` central-registration example, the `astro.config.mjs` entrypoint snippet, the naming warning, and the `@alpinejs/persist` dependency note), §4.3 (form `Alpine.data` factory pattern), §4.4 (data-file pattern), and §4.5 (folder taxonomy) **verbatim as written in the spec**. These sections are the authoritative source; copy them into this doc so it stands alone.

- [ ] **Step 3: Add the implementation-phase checklist**

Append this section so implementers know the app-config steps this docs plan intentionally deferred (content = spec §5.6 + Global Constraints):

```markdown
## Implementation-phase checklist (deferred from the docs plan)

These app-config changes are executed with the **first store implementation**, not by the documentation change set (wiring an entrypoint to a not-yet-existing `lib/app.init.ts` would break `astro check`):

- Add `@alpinejs/persist` to `app/package.json` (only `alpinejs` is present today).
- Set `alpinejs({ entrypoint: '/src/lib/app.init' })` in `astro.config.mjs`.
- Add the `@stores/*` → `./src/lib/stores/*` path alias to `app/tsconfig.json` (alongside the existing `@lib/*`, `@components/*`, …).
```

- [ ] **Step 4: Register the doc in the File Inventory**

In `architecture/docs/architecture/00-Context-Map.md`, in the "## API (`06-API/`) and Frontend (`07-Frontend/`)" table, add a row directly below the `07-Frontend/00-Overview.md` row:

```markdown
| `07-Frontend/01-Client-Patterns.md` | Client conventions: stores, forms, components, folder taxonomy | canonical | ~1.7k |
```

- [ ] **Step 5: Update the Frontend context pack**

In the "# Context Packs" table, change the "Frontend / page work" row's "Load exactly" cell from:

```
`07-Frontend/00-Overview.md`, `app/CLAUDE.md`
```
to
```
`07-Frontend/00-Overview.md`, `07-Frontend/01-Client-Patterns.md`, `app/CLAUDE.md`
```
and bump its `~Budget` from `~3k` to `~5k`.

- [ ] **Step 6: Update Current Implementation State and map version**

In the "# Current Implementation State" table, update the `Frontend docs` row to:

```markdown
| Frontend docs | `00-Overview.md` 0.3.0 (two-store state model, boundary/perf rules); `01-Client-Patterns.md` 1.0.0 (conventions) (2026-07-14) |
```

Bump the context-map version line near the top from `1.1.0 (2026-07-13)` to `1.2.0 (2026-07-14)` and update its front-matter `updated: 2026-07-14`.

- [ ] **Step 7: Verify context-map consistency**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`
(This confirms the new doc has front-matter, is registered, and all `.md` references resolve.)

- [ ] **Step 8: Commit**

```bash
git add architecture/docs/architecture/07-Frontend/01-Client-Patterns.md architecture/docs/architecture/00-Context-Map.md
git commit -m "docs(frontend): add 01-Client-Patterns and register in context map

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Add the Frontend non-negotiables to `app/CLAUDE.md`

**Files:**
- Modify: `app/CLAUDE.md`

**Interfaces:**
- Consumes: spec §5.3; references `07-Frontend/00-Overview.md` and `07-Frontend/01-Client-Patterns.md` created in Tasks 1–2.
- Produces: operational frontend rules loaded by the Frontend context pack.

- [ ] **Step 1: Add the Frontend section**

In `app/CLAUDE.md`, after the `## Non-Negotiable Rules` section and before `## Validation Standard Procedure (sole definition)`, insert:

```markdown
## Frontend

Full detail: `architecture/docs/architecture/07-Frontend/00-Overview.md` (state/integration) and `07-Frontend/01-Client-Patterns.md` (conventions).

- Client state is never a source of truth — persisted stores hold draft/intent pending server confirmation only.
- The outbox is the single durability seam; only frozen-shape, ruleset-valid `EventsBatchRequest` batches may enter it.
- Batch at the session boundary — never per-dart server writes.
- Reads are view-backed, player-scoped, and skeleton-first.
- Never parse or verify a JWT in page or island scripts (middleware owns identity).
- Every persisted Alpine store carries a `_v` version field with the documented discard policy; store files are DI factories `xStore(persist)` registered centrally in `src/lib/app.init.ts`.
```

- [ ] **Step 2: Verify context-map consistency**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`
(Confirms the two `07-Frontend/*.md` references in the new section resolve.)

- [ ] **Step 3: Commit**

```bash
git add app/CLAUDE.md
git commit -m "docs(app): add Frontend non-negotiables to app/CLAUDE.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Record decisions in `architecture/DECISIONS.md`

**Files:**
- Modify: `architecture/DECISIONS.md`

**Interfaces:**
- Consumes: the resolved model (Tasks 1–3). Highest existing decision id is `D78`; new ids are `D79`, `D80`.
- Produces: ledger entries closing the review's grounded findings.

- [ ] **Step 1: Append the two entries to the Frontend table**

In `architecture/DECISIONS.md`, in the `## Frontend` table, add directly below the `D77` row:

```markdown
| D79 | 2026-07-14 | Two-store client state (`session` draft + `outbox`) with per-store `_v` versioning; outbox is the single durability seam (only frozen-shape, ruleset-valid batches); idempotency key minted once at session start and reused on retry; client state is never a source of truth | Robust local-first recovery with explicit consistency/performance boundaries |
| D80 | 2026-07-14 | Frontend client conventions codified in `07-Frontend/01-Client-Patterns.md`: DI Alpine store factories `xStore(persist)` registered centrally in `lib/app.init.ts`; canonical `.astro` frontmatter order; form and data-file patterns; client folder taxonomy | Consistency and clear boundaries for multi-year frontend growth |
```

- [ ] **Step 2: Verify context-map consistency**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`
(`DECISIONS.md` is scanned for migration-range drift only; the new rows quote no ranges.)

- [ ] **Step 3: Commit**

```bash
git add architecture/DECISIONS.md
git commit -m "docs(ledger): record D79-D80 frontend state model and conventions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Final consistency gate

**Files:** none modified (verification only).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a green context system and a clean branch ready for review/PR.

- [ ] **Step 1: Run the full context-map check**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 2: Confirm branch state and diff scope**

Run: `git status --short && git log --oneline main..HEAD`
Expected: clean working tree; commits from Tasks 1–4 plus the earlier spec commits, all on `docs/frontend-state-and-conventions`. No files touched outside `architecture/docs/`, `app/CLAUDE.md`, `architecture/DECISIONS.md`, and `docs/superpowers/`.

- [ ] **Step 3: Confirm no unintended app-code changes**

Run: `git diff --name-only main..HEAD -- app/ | grep -v '^app/CLAUDE.md$' || echo "no app-code changes (expected)"`
Expected: `no app-code changes (expected)` — the docs plan touches no application source or config.

---

## Self-Review

**Spec coverage:**
- §1 scope / §6 open decisions → captured in `01-Client-Patterns.md` implementation note + unchanged spec (Task 2); the two deferred findings remain out of scope by design. ✓
- §2 state model (two stores, idempotency, outbox, versioning, recovery precondition) → Task 1 Step 2. ✓
- §3 boundary rules + performance + not-built-now → Task 1 Step 3. ✓
- §4.1–§4.5 conventions → Task 2 Steps 2. ✓
- §4.6 API client contract → Task 1 Step 4. ✓
- §5.1 expand 00-Overview → Task 1. §5.2 new 01 doc → Task 2. §5.3 app/CLAUDE.md → Task 3. §5.4 context map → Task 2 Steps 4–6. §5.5 DECISIONS → Task 4. §5.6 app-config → documented in Task 2 Step 3 (deferred by design). §5.7 check script → every task + Task 5. ✓

**Placeholder scan:** No TBD/TODO; every doc edit shows verbatim insert content or names the exact spec section to copy (the spec is committed and available). ✓

**Type/name consistency:** `sessionStore(persist)` factory, store key `"session"`, `lib/app.init.ts`, `@stores/*` alias, `_v` field, `ApiError(code, retryable, details)` — used identically across Tasks 1–4 and matching the spec. Decision ids D79/D80 follow the confirmed max D78. ✓
