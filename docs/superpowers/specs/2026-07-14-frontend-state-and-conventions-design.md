# Frontend State Model & Client Conventions — Design

> **Date:** 2026-07-14
> **Branch:** `docs/frontend-state-and-conventions`
> **Status:** design (pre-implementation)
> **Author:** architecture review follow-up

---

## 1. Purpose & Scope

This spec resolves the **grounded** findings from the 2026-07-14 review of `07-Frontend/00-Overview.md` (v0.2.0) and codifies the frontend client conventions the draft was missing. It is documentation-only: it defines architecture and rules, not implementation.

### In scope

- **Finding 1** — persisted-store schema drift / versioning
- **Finding 3** — completed-but-unsent session handling (outbox)
- **Finding 5** — idempotency-key lifecycle
- **Finding 6** — missing frontend rules in the operational `CLAUDE.md` layer
- **Pattern codification** — Alpine store, form, data-file, and `.astro` component-frontmatter conventions; client folder taxonomy

### Explicitly out of scope (separate architecture spec)

- **Finding 2** — client game engine ↔ server ruleset-validator rule sharing
- **Finding 4** — auth token acquisition mechanism (Neon Auth ↔ browser fetch on Cloudflare/Astro)

These two are deferred because they require designing subsystems that do not yet exist (the client engine; the Neon Auth browser integration). Making firm decisions now would invent architecture without grounding, which `01-Principles.md` forbids. Their **folder homes** (`lib/engine/`, `lib/auth/`) are declared here for consistency; their internals are designed separately.

### Authority

Subordinate to the frozen API contract (`06-API/00`–`04`) and `01-Principles.md`. This spec changes no frozen contract and adds no schema.

---

## 2. The Persisted-State Model

The four grounded findings collapse into **one coherent client-state model** built on two persisted Alpine stores with different lifecycles. Solving them together (rather than each in isolation) is what makes the result clean.

### 2.1 Two stores, split by volatility

| Store | Holds | Shape driven by | Volatility |
| ----- | ----- | --------------- | ---------- |
| `session` (draft) | current ACTIVE game: `sessionId`, `participantRef`, `idempotencyKey`, capture/input modes, in-progress stages/turns/darts | **UI** — evolves with the engine and screens | High |
| `outbox` | array of completed-but-unsent batches: `{ sessionId, idempotencyKey, payload, attempts, lastError }` | **frozen `EventsBatchRequest`** (`06-API/04`) | Low |

The split is deliberate: the `session` draft is UI-shaped and will churn for years; the `outbox` payload **is** the frozen API contract and will not. Keeping them separate means a decade of UI change never touches the durability path.

### 2.2 Idempotency-key lifecycle (Finding 5)

- Generated **once at session start** (UUID), stored on the `session` draft.
- Carried into the `outbox` entry at completion; **reused on every upload retry**.
- Never regenerated per attempt.

This makes the "server processed the batch but the client never received the ack" case self-healing: retry with the same key + same payload hash → server returns the stored result (`06-API/00` idempotency contract) → the client dequeues. At-least-once client delivery + server idempotency = exactly-once effect.

### 2.3 Completed-but-unsent outbox (Finding 3)

On session completion:

1. The assembled batch moves `session` → `outbox`.
2. Upload is attempted immediately, with a small number of backoff retries.
3. If it still fails, the entry **stays in the outbox** and a passive **"unsaved — will retry"** indicator is shown.
4. Auto-retry fires on next app load and on the browser `online` event.
5. The entry is removed **only on confirmed success** (or on the server's same-key/same-hash stored-result response, which is success).

No user action is required in the normal case. The user is never silently exposed to data loss without a signal, and recovery is not gated behind a manual control.

### 2.4 Per-store versioning (Finding 1)

Each persisted store carries a `_v` integer and a **per-store version constant** (not one global version), because the two stores warrant different discard policies:

- **`session` draft** — on `_v` mismatch, **discard** (call `reset()`). An in-progress draft that the current code cannot parse is unrecoverable anyway; abandon-and-restart is consistent with the already-accepted "device loss = data loss" tradeoff (D67).
- **`outbox`** — its payload is the frozen `EventsBatchRequest`, so it is version-stable by construction. Policy is **attempt-upload-then-discard**, never blind discard. Silently dropping a user's finished-but-unsent games is the one client-side data loss we actively prevent.

### 2.5 Relationship to the existing recovery model

This sharpens `07-Frontend/00-Overview.md`'s recovery section: `GET /api/sessions/active` reconciliation (resume/abandon) is a **precondition** for starting a new game, not merely an offered convenience — `uq_sessions_single_active` rejects a second ACTIVE session server-side. A new game cannot be created while an orphaned ACTIVE session exists; the client must resume or abandon first.

---

## 3. Boundary Rules & Performance Constraints

These are the consistency anchors that keep the model robust as new games, rulesets, player types, and eventually online play arrive. They exist so the accepted/not-accepted line is explicit rather than accidental.

### 3.1 Two hard boundary rules

1. **Client state is never a source of truth.** Persisted stores hold *intent pending confirmation* and nothing else. The instant the server confirms, the authoritative copy is the database. This is the client-side application of the `01-Principles.md` "Single Source of Truth" value and is what lets every future axis extend without creating a competing truth on the client.

2. **The outbox is the single durability seam, with an explicit acceptance contract.** Exactly one queue carries client → permanent data, and only **ruleset-valid, fully-formed, frozen-shape `EventsBatchRequest` batches** may enter it. Nothing half-formed, UI-shaped, or un-validated ever becomes durable. Every future delivery path (including online sync) reuses this same seam and idempotency contract.

### 3.2 Performance constraints (Neon + Cloudflare)

Batch-at-completion is not only a recovery decision; on this stack it is the performance- and cost-optimal one. These are forward constraints:

| Rule | Rationale on Neon + Cloudflare |
| ---- | ------------------------------- |
| **One transaction per session** (batch at boundary); never per-dart server writes | Neon serverless bills compute; CF Workers cap CPU/subrequests per request. Per-dart writes multiply latency and cost. The outbox bounds the DB to one predictable write burst per session. |
| **Reads view-backed, player-scoped, skeleton-first** | Keeps first paint off the DB critical path; a small, indexed, view-backed query set maps cleanly onto future Neon read replicas + edge caching. |
| **Bound the batch payload size** | A CF Worker has a finite CPU/transaction budget. A darts session is naturally small, so v1 is safe; a documented max-payload guard prevents a pathological session from exceeding Worker limits. |
| **HTTP driver for reads; WebSocket/transaction driver only for the batch write** | The existing `db/client.ts` factory split — the HTTP one-shot path is cheapest for view reads. |

### 3.3 Deliberately not built now

- **No multi-device / server-authoritative mid-session state.** When online/live play arrives it is an **additive capture mode** with per-*turn* (never per-dart) server sync, reusing the same idempotency contract — the same additive pattern the API doc already uses for deferred guest/DartBot participants. The offline-tolerant local-first path stays valid for solo play. Building sync now would violate YAGNI and force-unfreeze D67 / the API contract.
- **localStorage is the v1 persistence backend.** If offline queuing ever deepens to many queued sessions, the **outbox — and only the outbox** — migrates to IndexedDB via a `$persist` custom storage adapter, for capacity and robustness. Documented as a forward lever, not built.

---

## 4. Client Conventions

### 4.1 `.astro` component frontmatter

`BottomNav.astro` and `NavBtn.astro` are **not in conflict** — they are two projections of one latent convention. NavBtn has props and no data list; BottomNav has a data list and no props. Overlaid, a single canonical section order emerges. It is codified, not re-invented; no existing file needs rewriting.

**Canonical frontmatter section order:**

```
1. interface Props { … }          // omitted when the component takes no props
2. // Props     → const { … }: Props = Astro.props
3. imports, grouped & ordered:  // Layouts · // Components · // Icons · // Lib
4. // Data      → local static config arrays (the BottomNav `pages` pattern)
5. // Styles    → className composition / derived display values (NavBtn pattern)
```

Sections that do not apply are omitted (BottomNav skips §1; NavBtn skips §4). Import group headers use the fixed vocabulary above.

### 4.2 Alpine store pattern

Store files are **pure factories**: they receive only the `$persist` function they depend on (not the whole `Alpine` object) and **return** a store object. They never call `Alpine.store()` themselves. All plugin registration and store instantiation is centralized in one file, `lib/app.init.ts`.

Location: `app/src/lib/stores/*.store.ts`. One store per bounded concern.

```ts
// lib/stores/session.store.ts
// `Persist` = the type of Alpine's $persist magic fn; exact type resolved at implementation.

const SESSION_STORE_VERSION = 1;                 // bump on shape change

export function sessionStore(persist: Persist) {
  return {
    _v: persist(SESSION_STORE_VERSION).as('session._v').using(localStorage),
    sessionId: persist<string | null>(null).as('session.id').using(localStorage),
    idempotencyKey: persist<string | null>(null).as('session.idem').using(localStorage),
    // …draft fields
    init()  { if (this._v !== SESSION_STORE_VERSION) this.reset(); },   // discard on drift
    reset() { this.sessionId = null; this.idempotencyKey = null; this._v = SESSION_STORE_VERSION; },
  };
}
```

**Rules:**

- Store files are **DI factories** `xStore(persist)` returning the store object; they never reference the global `Alpine` and never register themselves.
- Every **persisted** store carries `_v` + an `init()` version guard + a `reset()`.
- `.using(...)` **always states the storage backend explicitly** (`localStorage` for v1). This call site is the exact seam for the documented outbox → IndexedDB forward path (§3.3) — only the outbox factory changes, nothing else.
- Stores hold **data + intent only** — no rules/scoring logic (that is the engine, a separate pure module in `lib/engine/`).

**Central registration** — one focused file at the `lib/` root registers the plugin and instantiates every store:

```ts
// lib/app.init.ts
import type { Alpine } from 'alpinejs';
import persist from '@alpinejs/persist';
import { sessionStore } from '@stores/session.store';
import { outboxStore }  from '@stores/outbox.store';

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);

  Alpine.store('session', sessionStore(Alpine.$persist));
  Alpine.store('outbox',  outboxStore(Alpine.$persist));
};
```

Wired as the `@astrojs/alpinejs` entrypoint:

```js
// astro.config.mjs
alpinejs({ entrypoint: '/src/lib/app.init' })
```

> **Naming:** the factory is `sessionStore` and the store key is `"session"` (matching the `session.*` persist keys). Do **not** name the factory or key `sessionStorage` — it shadows the `sessionStorage` Web Storage global and reads confusingly next to `.using(localStorage)`.
>
> **Dependency:** `@alpinejs/persist` must be added to `app/package.json` (only `alpinejs` is present today).

### 4.3 Form pattern

Location: `app/src/lib/forms/*.form.ts`. Forms are `Alpine.data` factories.

```ts
// lib/forms/session-setup.form.ts
export function sessionSetupForm() {
  return {
    fields: { /* … */ },
    errors: {} as Record<string, string>,
    submitting: false,
    async submit() {
      this.submitting = true;
      try {
        await api.sessions.create(this.fields);   // typed lib/api wrapper
        // → transition / navigate
      } catch (e) {
        if (e instanceof ApiError) this.errors = mapError(e);
      } finally {
        this.submitting = false;
      }
    },
  };
}
```

**Rules:**

- Forms delegate to a typed `lib/api` wrapper — never call `fetch` directly, never contain business logic.
- Map `ApiError.code` → user messages via one shared map (`mapError`), not per-form strings.
- Forms never assemble the batch payload; the engine owns gameplay payload construction.

### 4.4 Data-file pattern

- Trivial static lists stay **inline** in frontmatter under `// Data` (the BottomNav `pages` array).
- A list that is **reused across components** or larger than ~10 lines moves to a colocated `*.data.ts` exporting a typed `const`:

```ts
// components/layout/nav.data.ts
export const navItems = [ /* … */ ] satisfies NavItem[];
```

### 4.5 Client folder taxonomy

Extends the live scaffold and declares homes for the split-out specs (`engine/`, `auth/`):

```
app/src/
├── components/{ui, layout, game, forms}/
├── layouts/
├── lib/
│   ├── app.init.ts # Alpine entrypoint: registers plugins + instantiates all stores
│   ├── api/       # browser API client (D41): client.ts + per-domain wrappers
│   ├── auth/      # token access            → detailed in the auth spec
│   ├── stores/    # Alpine store factories  (session.store.ts, outbox.store.ts, …)
│   ├── forms/     # Alpine.data form factories
│   ├── engine/    # pure game engine        → detailed in the engine spec
│   └── shared/    # cross-cutting pure utils (nav/is-nav-active, …)
├── pages/
└── icons/
```

`lib/api/` is browser-only (D41/D78); `lib/server/` (Worker helpers) never shares a folder with it.

### 4.6 API client contract (sharpening)

The client wrapper (`lib/api/client.ts`) **throws a typed `ApiError(code, retryable, details)` on `!ok`** and returns the parsed `data` on success — so call sites do not each re-check `ok`. It attaches the Bearer token, parses the envelope, and auto-retries only `retryable` batch writes with the stored idempotency key. Per-domain wrappers (`sessions.ts`, etc.) import the `z.infer` DTOs from `06-API/04`.

---

## 5. Documentation Changes (deliverables)

This spec is realized as targeted edits (minimal-diff invariant), not regeneration:

1. **`07-Frontend/00-Overview.md`** — expand the State Model section with §2 (two-store model, idempotency lifecycle, outbox, versioning), §2.5 recovery precondition, §3 boundary rules + performance table + "not built now" note, and §4.6 API client contract. Version bump.
2. **`07-Frontend/01-Client-Patterns.md`** — **new** sibling doc holding §4 (frontmatter, store, form, data-file conventions, folder taxonomy).
3. **`app/CLAUDE.md`** — add a `Frontend` non-negotiables section:
   - Client state is never source of truth (draft/intent only).
   - Only frozen-shape, ruleset-valid batches enter the outbox; outbox is the single durability seam.
   - Batch at session boundary — never per-dart server writes.
   - Reads view-backed, player-scoped, skeleton-first.
   - Never parse/verify JWT in page or island scripts.
   - Every persisted store carries `_v` with the documented discard policy.
4. **`00-Context-Map.md`** — register `01-Client-Patterns.md` in the File Inventory; update the Frontend context pack to load `00` + `01` + `app/CLAUDE.md`; ISO dates on changed rows.
5. **`architecture/DECISIONS.md`** — one-line entries:
   - Outbox / two-store client-state model with per-store versioning and the two boundary rules.
   - Client-pattern codification (`01-Client-Patterns.md`).
6. **`app/package.json`** — add `@alpinejs/persist` (only `alpinejs` is present today); **`astro.config.mjs`** — set `alpinejs({ entrypoint: '/src/lib/app.init' })`; **`app/tsconfig.json`** — add the `@stores/*` path alias.
7. **`scripts/check-context-map.sh`** — must pass.

---

## 6. Open Decisions (deferred to a separate spec)

| # | Decision | Constraint carried forward |
| - | -------- | -------------------------- |
| Finding 2 | Client engine ↔ server ruleset-validator rule sharing | Server remains authoritative; whatever the sharing mechanism, it must not duplicate rule *truth* in two independently-maintained places. Engine lives in `lib/engine/` as a pure module. |
| Finding 4 | Auth token acquisition (Neon Auth → browser fetch on CF/Astro) | Two auth surfaces (page navigation vs `Authorization: Bearer` API calls) must be reconciled. No JWT parsing in page/island scripts. Token access lives in `lib/auth/`. |
| Future | Online / live play | Additive capture mode, per-turn (not per-dart) server sync, reusing the idempotency contract. Must not unfreeze D67 or the API contract. |
| Future | Outbox at scale | Migrate outbox (only) to IndexedDB via `$persist` custom storage adapter if queue depth grows. |
