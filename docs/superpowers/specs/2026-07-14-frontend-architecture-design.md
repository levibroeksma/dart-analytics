# Frontend Architecture Design — Handbook 0.1.0

> **Date:** 2026-07-14
> **Status:** revised (critique pass 2026-07-14; brainstorming consensus)
> **Scope:** define the first canonical frontend architecture handbook under `architecture/docs/architecture/07-Frontend/` (version **0.1.0**). Documentation and rule enforcement only — no `app/` implementation in this change set.
> **Allowed `app/` touch:** `app/CLAUDE.md` and nested `app/src/**/CLAUDE.md` files (cross-references to architecture docs only).
> **Prerequisite:** frozen API contract (`06-API/` v1.3.0) and `07-Frontend/00-Overview.md` v0.2.0 (integration layer).
> **Amends:** recovery UX in `07-Frontend/00-Overview.md` and D67 ledger wording (see Decision 4).

---

## Problem

The frontend layer has an integration overview (`07-Frontend/00-Overview.md`) covering API client patterns, state ownership, and skeleton hydration, but no handbook for:

- rendering strategy (prerender vs SSR vs server islands)
- `app/src/` folder structure and file suffix conventions
- Alpine.js entry factory, stores, forms, data components, modules
- OOP boundaries and portable UI kit rules (timer, toast, modal, chart)
- `$persist` scoping and recovery/cleanup semantics
- shared API DTO types (Zod `z.infer<>` + barrel raising)
- constructor-based module lifecycle

Without these rules, agents and developers will invent inconsistent patterns during the first frontend build pass. This spec defines handbook **0.1.0** — a first draft meant to be iterated until ironclad, not a frozen v1 contract.

A self-critique pass (2026-07-14) compared this design against `architecture/` docs and the frozen API/DB layers. All findings (I1–I24) are resolved in the decisions below.

---

## Versioning Stance

| Label | Meaning |
| ----- | ------- |
| **Handbook 0.1.0** | First draft of frontend architecture docs. Rules are mandatory for new frontend work but expected to evolve. Doc-only minor/patch bumps allowed without a "freeze" ceremony. |
| **API v1** | Unchanged — remains frozen per `06-API/00-Overview.md`. Frontend handbook does not amend API contracts. |
| **Integration overview** | `07-Frontend/00-Overview.md` stays the API-integration entry point; bumped to **0.3.0** when the handbook index is added (see Deliverables). Recovery UX text must be amended per Decision 4. |

---

## Decision 1 — Rendering: Prerender-Default on Cloudflare

**Decision (I1-B, revised wording):** Adopt **prerender-default**, not global `output: 'static'`.

| Setting | Value |
| ------- | ----- |
| Astro `output` | `'server'` (default for `@astrojs/cloudflare`) |
| App pages | `export const prerender = true` unless listed in SSR opt-in table |
| API routes | `pages/api/**` — always on-demand (never prerender) |

**Route-class table:**

| Route class | Rendering | Data loading |
| ----------- | --------- | ------------ |
| Public (`/login` only for v1; list extensible) | Prerender | Client auth SDK (Neon Auth) |
| Protected app chrome (layouts, nav) | Prerender shell + **middleware gate** | None at build time |
| Data lists (sessions, history) | Prerender shell + middleware | Client `fetch` via `@client/api/` after paint |
| Active gameplay | Prerender shell + middleware + Alpine | Local-first store (`$persist`); API at session boundaries only |
| Server islands / SSR opt-in | On-demand only | Server-only secrets/env (see Decision 1b) |

**Prerender + middleware (I20):** Prerender does **not** bypass middleware. With `output: 'server'`, middleware runs on every request before the prerendered shell is served:

```
Request → middleware (auth) → redirect /login OR serve prerendered HTML → client fetch / Alpine
```

Protected routes are prerendered **shells**, not publicly useful without passing middleware.

### Decision 1b — SSR opt-in (closed list)

SSR (`prerender = false`) is permitted **only** when:

1. Server-only env/secrets must appear in HTML (never gameplay state, never JWT payloads).
2. Per-request `Astro.request` headers materially affect markup (rare in v1).
3. The route is explicitly listed as an exception in `01-Rendering-Strategy.md`.

All other routes: `export const prerender = true`.

Gameplay state is never server-rendered (aligns with D67).

---

## Decision 2 — Page Auth: Middleware Protected Allowlist

**Decision (I2-B):** HTML route protection via **middleware protected-prefix allowlist**.

| v1 public routes | `/login` only |
| ---------------- | ------------- |
| v1 protected | `/games`, `/profile`, `/statistics`, `/`, and all future app routes unless explicitly added to public list |

Rules:

- New page routes must be classified **public** or **protected** in `01-Rendering-Strategy.md`.
- API auth remains Bearer JWT on `@client/api/` calls — middleware guards **navigation**, not data.
- Public list is extensible later (marketing pages).

---

## Decision 3 — Layering: Alpine-Native (No Frontend Controllers)

**Decision:** The frontend does **not** mirror `Controller → Service → Repository`. Use Alpine-native layering:

```
Astro page (shell, prerender + middleware)
    ↓
Alpine.data component (*.data.ts) — x-data="componentState()"
    ↓
Alpine.store (*.store.ts) / form (*.form.ts)
    ↓
Module (*.module.ts, *.engine.module.ts, *.payload.module.ts)
    ↓
@client/api/ — HTTP transport only (orchestrated by pages/forms, not modules)
```

Forbidden: a frontend `controllers/` folder paralleling `pages/api/`.

---

## Decision 4 — Recovery & Cleanup (Amends D67 UX)

**Decision (I4):** The client is **100% responsible** for session-progress persistence. Recovery is **automatic** — no manual abandon dialog, no sign-out in this flow.

| Event | Behavior |
| ----- | -------- |
| Session start | `POST /api/sessions` mints `sessionId`; all gameplay client-side until batch |
| Local store + server IDs align | Resume from persisted store |
| Local missing OR `sessionId` mismatch | Client **auto-`PATCH` → `ABANDONED`** silently — no user prompt |
| Server `ACTIVE`, client empty | Client auto-abandons server session |
| Client-side orphans | Client detects and cleans (clear store, auto-abandon if server row exists) |
| Server DB orphans | **Server responsibility** (future sweep) — outside client recovery UX |

**Store keying (D09):** Persisted gameplay keyed by **`gameTypeKey`** — one blob per game type.

**Documentation amendment required:** Replace `07-Frontend/00-Overview.md` wording *"offers resume or abandon"* with *"resume when local + server align; otherwise client auto-cleans"*. Add DECISIONS amendment note for D67 UX refinement.

---

## Decision 5 — Persisted Schema Evolution

**Decision (I5):** No `schemaVersion` / migration machinery in handbook **0.1.0**.

**Additive-only rule (mandatory):** Persisted store shapes and ruleset/config schemas may **only be extended** — fields and rules are never removed or renamed incompatibly. New fields are optional; old persisted blobs remain valid.

If a breaking change is ever unavoidable: new store namespace key — never in-place breaking mutation.

---

## Decision 6 — Folder Structure: Domain at `src/` Level, Browser Infra in `@client`

**Decision:** Application frontend code lives at **`app/src/` top level**. Browser infrastructure lives under **`src/lib/client/`** (alias `@client`).

### Authoritative tree (frontend areas)

```
app/src/
├── lib/
│   └── client/
│       ├── alpine/
│       │   ├── app.factory.ts       # Alpine entry — export default (Alpine) => void
│       │   ├── register-stores.ts
│       │   ├── register-ui-data.ts
│       │   └── register-route-data.ts
│       ├── api/                     # browser fetch client (moves from lib/api/)
│       └── auth/                    # browser token access only
├── lib/
│   ├── server/                      # envelope, errors (existing — server only)
│   └── auth/                        # verify-jwt, resolve-player (server only)
├── types/
│   └── api/                         # shared Zod schemas + z.infer<> barrels
├── utils/                           # widely reused pure helpers
├── stores/                          # *.store.ts
├── forms/                           # *.form.ts
├── modules/
│   ├── ui/                          # portable OOP (*.module.ts)
│   └── game/                        # *.engine.module.ts, *.payload.module.ts
├── components/
│   ├── ui/
│   └── <domain>/
├── pages/
│   └── <route>/
│       ├── index.astro
│       └── <route>.data.ts          # Alpine.data factory (optional colocate)
├── services/                        # Worker only
└── repositories/                    # Worker only
```

**Agent rules:**

- `services/` and `repositories/` are **Worker-only** — never confused with `stores/` (document in `02-Folder-Structure.md`, I24).
- If imported from more than one route, promote out of `pages/`.
- `@lib/*` for browser code is **deprecated** in favour of `@client/*` (handbook documents target state; migration is app implementation).

---

## Decision 7 — Path Aliases

**Decision (I11):** Full `@`-prefixed alias set. Deep relative imports forbidden (mirrors `06-API/03-Shared-Conventions.md`).

| Alias | Maps to |
| ----- | ------- |
| `@client/*` | `src/lib/client/*` |
| `@stores/*` | `src/stores/*` |
| `@forms/*` | `src/forms/*` |
| `@modules/*` | `src/modules/*` |
| `@types/*` | `src/types/*` |
| `@utils/*` | `src/utils/*` |
| `@components/*` | `src/components/*` |
| `@layouts/*` | `src/layouts/*` |
| `@pages/*` | `src/pages/*` |
| `@services/*` | `src/services/*` |
| `@repositories/*` | `src/repositories/*` |
| `@routes/*` | `src/pages/api/*` |
| `@db/*` | `src/db/*` |

**Barrel rule:** Types imported via `@<area>/types` only — same raising chain as API (`03-Shared-Conventions.md`). No deep paths into defining modules.

**Astro Alpine entry:**

```javascript
alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })
```

---

## Decision 8 — File Suffix Conventions

| Suffix | Responsibility | `$persist` |
| ------ | -------------- | ---------- |
| `.store.ts` | Alpine store factory — `Alpine.store('name', storeFactory(persist))` | **Allowed** |
| `.form.ts` | Form/draft state factory — v1 substitute for `player_settings` (D77, I9) | **Allowed** (draft prefs) |
| `.data.ts` | Alpine.data factory — registered via `register-*-data.ts` | **Forbidden** |
| `.module.ts` | Portable UI OOP class (`modules/ui/`) | **Forbidden** |
| `.engine.module.ts` | Game state machines (`modules/game/`) | **Forbidden** |
| `.payload.module.ts` | API payload assembly (`modules/game/`) | **Forbidden** |
| `.astro` | Markup + wiring only | **Forbidden** |

**Examples:** `game.store.ts`, `session-setup.form.ts`, `play.data.ts`, `timer.module.ts`, `turn.engine.module.ts`, `batch.payload.module.ts`.

Rejected: `*.gen.ts` (constructors, not generators), `*.page.ts` (use `.data.ts` for Alpine data factories).

---

## Decision 9 — Alpine Entry Factory & Registration

**Decision (I6):** Alpine runtime is bootstrapped **only** via `@astrojs/alpinejs` entrypoint. No `import Alpine from 'alpinejs'` outside the factory chain. Only `import type { Alpine } from 'alpinejs'` elsewhere.

### `app.factory.ts` shape

```typescript
"use strict";

import persist from "@alpinejs/persist";
import type { Alpine } from "alpinejs";
import { registerStores } from "./register-stores";
import { registerUiData } from "./register-ui-data";
import { registerRouteData } from "./register-route-data";

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);
  registerStores(Alpine);
  registerUiData(Alpine);
  registerRouteData(Alpine);
};
```

### Registration modules (I6-A)

Each `register*(Alpine)` calls `Alpine.store(...)` or `Alpine.data(...)`. Data/store factory files export functions only — **no Alpine import**.

| Registrar | Registers |
| --------- | --------- |
| `register-stores.ts` | All `Alpine.store()` |
| `register-ui-data.ts` | Portable UI `Alpine.data()` (timer, toast, modal, chart) |
| `register-route-data.ts` | Route `Alpine.data()` (play, session-setup, …) |

### Alpine binding rules (non-negotiable)

| Rule | Detail |
| ---- | ------ |
| **No `x-init`** | Forbidden everywhere — deprecated |
| **`x-data` invocation** | Always `x-data="componentState()"` — never `x-data="componentState"` |
| **Store factories** | `Alpine.store('game', gameStore(persist))` — `()` required so `init()` runs |
| **Modules** | Never import Alpine — `modules/ui/` classes are pure TS |

---

## Decision 10 — API Orchestration & Import Direction

**Decision (I3-B):**

```
pages/*.astro / *.data.ts / forms  →  @client/api  (orchestration)
stores                             →  @client/api  (recovery bootstrap workflows only)
modules/*                          →  never @client/api
@client/api                        →  never imports stores, forms, modules, pages
lib/server/, lib/auth/ (server)    →  never imported by browser code
```

Payload builders live in `*.payload.module.ts`; HTTP calls live in pages/forms/stores.

---

## Decision 11 — Shared API Types

**Decision (I7-A):** Shared DTO types via **Zod `z.infer<>`** in `src/types/api/`, following frozen barrel rules from `06-API/03-Shared-Conventions.md`.

- Zod schemas are the single source of shape; TS types are always `z.infer<typeof Schema>` — never hand-authored duplicates.
- Server `@routes/types` and client `@types/api` (or `@client/api/types`) re-raise via barrels.
- `*.payload.module.ts` imports types only — not server Zod validators at runtime unless shared schema file is browser-safe.

---

## Decision 12 — Key Ownership

**Decision (I8-A):**

| Key | Owner | Lifecycle |
| --- | ----- | --------- |
| `clientKey` (per turn/dart) | `*.engine.module.ts` / payload assembly | Minted at fact creation |
| `Idempotency-Key` (batch header) | `game.store.ts` | Minted once at session-complete; retained until batch ACK; cleared on success |

Pages/forms pass store-held idempotency key to `@client/api` on POST.

---

## Decision 13 — OOP Boundary & Portable UI Kit

**Decision:** Classes permitted **only** in `src/modules/`. Stores, forms, `.data.ts` use object factories.

| Layer | OOP? |
| ----- | ---- |
| `modules/ui/*` | Yes — `new Timer(opts)`, lifecycle `start/stop/destroy` |
| `modules/game/*.engine.module.ts` | Yes — when state machine warrants it |
| `modules/game/*.payload.module.ts` | Prefer functions; classes only if justified |
| `stores/`, `forms/`, `.data.ts`, `components/ui/` | No |

### Portable UI kit (I15-A)

`modules/ui/` + `components/ui/` — zero app imports (`@stores`, `@forms`, `@client/api`, etc.).

**Chart peer dependency:** Portable kit = behaviour + markup contract. `chart.module.ts` may wrap a **declared peer dependency** (e.g. Chart.js). Copy-paste test includes `package.json` peer dep note.

Initial kit (documented in 0.1.0; implementation deferred): timer, toast, modal, chart.

### Game engine vs API validation (I13-A)

| Layer | Owns |
| ----- | ---- |
| `modules/game/` | In-session UX: scoring display, turn flow, dart entry, `clientKey`, payload **assembly** |
| API/service | Authoritative validation: ruleset limits, capture-mode matrix (D73), status transitions, idempotency |

Frontend may **predict** rejection; API outcome is always source of truth.

---

## Decision 14 — Persistence: Store + Form Split

**Decision:** `$persist` allowed **only** in `*.store.ts` and `*.form.ts`.

| Persisted | Never persisted |
| --------- | --------------- |
| Gameplay / session recovery (`stores/`, keyed by `gameTypeKey`) | Modal open/closed |
| Draft UI prefs (`forms/`) — capture/input/template per D60; **v1 substitute for `player_settings` (D77)** | Toast queue |
| Timer **state** in `game.store.ts` (`timerRemainingMs`, etc.) — I10 | Chart hover/selection |
| `idempotencyKey` until batch ACK | Ephemeral `.data.ts` fields |

`Timer` module drives display; store owns authoritative timer fields for recovery.

`lib/client/alpine/` configures persist plugin (namespace prefix) — not individual store keys.

---

## Decision 15 — Auth Module Split

**Decision (I12-A):**

| Location | Purpose |
| -------- | ------- |
| `@client/auth/` | Browser token access for API calls |
| `lib/auth/` (server) | `verify-jwt.ts`, `resolve-player.ts` — middleware/API only |

Never import server auth from browser code.

---

## Decision 16 — Doc Authority & Context Packs

### Authority (I17-A)

| Doc | Owns |
| --- | ---- |
| `00-Overview` | API integration, state ownership, data flows, "Frontend Must Not" |
| `01`–`04` | Rendering, folders, Alpine, modules/OOP |
| Conflict | Higher-specificity wins: structural → `01`–`04`; API boundary → `00` |

### Context packs (I14-A) — replaces single-row proposal

| Task type | Load exactly |
| --------- | ------------ |
| Frontend page / component work | `10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `app/CLAUDE.md` |
| Gameplay / session features | above + `03-Alpine-Patterns.md` + `04-Modules-And-OOP.md` |
| New route / rendering | above + `01-Rendering-Strategy.md` + `02-Folder-Structure.md` |
| Frontend architecture / new pattern | `07-Frontend/01`–`04`, `04-Architecture-patterns.md`, `01-Principles.md` |
| New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md` |

---

## Deliverables — Files to Create or Modify

### New canonical docs (`architecture/docs/architecture/07-Frontend/`)

| File | Version | Answers |
| ---- | ------- | ------- |
| `01-Rendering-Strategy.md` | 0.1.0 | Prerender-default, route classes, middleware+prerender interaction, public/protected lists, SSR opt-in closed list |
| `02-Folder-Structure.md` | 0.1.0 | Tree, aliases, suffix table, Worker vs browser areas, import direction |
| `03-Alpine-Patterns.md` | 0.1.0 | `app.factory`, `register*(Alpine)`, stores/forms/data, `$persist`, binding rules (no `x-init`, `foo()`) |
| `04-Modules-And-OOP.md` | 0.1.0 | Constructors, lifecycle, portable UI kit, engine vs payload modules, validation boundary |
| `10-Frontend-Agent-Guide.md` | 0.1.0 | Condensed rules + pre-completion checklist (I18) |

### Modified canonical docs

| File | Change |
| ---- | ------ |
| `07-Frontend/00-Overview.md` | Bump **0.3.0**; handbook index; **amend recovery UX** (Decision 4); move client tree to `02`; update `lib/api` → `@client/api` |
| `architecture/docs/architecture/README.md` | Hierarchy + index for `07-Frontend/01`–`04`, `10` |
| `architecture/docs/architecture/00-Context-Map.md` | Tiered context packs; inventory rows dated `2026-07-14` |
| `architecture/docs/architecture/04-Architecture-patterns.md` | **Pattern 17 — Frontend Layering** (summary) |
| `architecture/DECISIONS.md` | D79–D86+ (see below); D67 UX amendment note |
| `architecture/CLAUDE.md` | Frontend handbook task routing |
| `architecture/docs/CLAUDE.md` | `07-Frontend/01`–`04` editing targets |
| `app/CLAUDE.md` | Frontend rules section → `10-Frontend-Agent-Guide.md`; tiered pack pointer |

### Explicitly not in scope (this change set)

- Creating `app/src/` folders on disk
- Implementing UI kit, stores, forms, modules
- `astro.config.mjs` changes (document target: `entrypoint`, prerender directives)
- `tsconfig.json` alias migration (`@lib` → `@client`)
- Statistics API implementation — `/statistics` documented as **post-v1 placeholder shell** (I19)

---

## Per-File Content Outline (implementation guide)

### `01-Rendering-Strategy.md`

1. Purpose + version 0.1.0
2. Prerender-default model (`output: 'server'` + per-route `prerender = true`)
3. Middleware + prerender interaction diagram
4. Public route list (v1: `/login`) + protected prefix list
5. Route-class table
6. SSR opt-in closed list (Decision 1b)
7. Server islands criteria
8. Statistics placeholder note (I19)
9. Anti-patterns
10. Related documents

### `02-Folder-Structure.md`

1. Full tree (Decision 6)
2. Alias table (Decision 7)
3. Suffix table (Decision 8) including `*.engine.module.ts` / `*.payload.module.ts`
4. Worker-only vs browser areas (`services/` ≠ `stores/`)
5. Import direction (Decision 10)
6. `@client` vs deprecated `@lib` browser paths
7. Related documents

### `03-Alpine-Patterns.md`

1. `app.factory.ts` + `register*(Alpine)` pattern
2. Store factory pattern with `persist` + `()`
3. Form factory pattern (D77 substitute)
4. `.data.ts` + `Alpine.data()` registration
5. Binding rules: no `x-init`; `x-data="foo()"`
6. `$persist` scope (Decision 14)
7. Recovery/auto-cleanup flow (Decision 4)
8. Skeleton hydration cross-ref
9. Anti-patterns
10. Related documents

### `04-Modules-And-OOP.md`

1. OOP boundary table
2. Constructor + lifecycle (Timer example sketch)
3. Portable UI kit + Chart peer dep
4. `*.engine.module.ts` vs `*.payload.module.ts`
5. `clientKey` / validation boundary (Decisions 12, 13)
6. Anti-patterns
7. Related documents

### `10-Frontend-Agent-Guide.md`

1. Tiered load packs
2. Non-negotiables (suffixes, aliases, bindings, no `x-init`)
3. Import direction diagram
4. `$persist` allowed/forbidden
5. Recovery auto-cleanup summary
6. Prerender + middleware rule
7. Pre-completion checklist (docs consistency, `check-context-map.sh`)
8. Related documents

### `00-Overview.md` modifications

- Version → 0.3.0
- Handbook index
- Recovery section → auto-cleanup model (Decision 4)
- Client structure → summary + link to `02`
- `@client/api` terminology

---

## Context Maintenance (mandatory)

### `DECISIONS.md` — proposed new entries

| # | Decision | Rationale |
| - | -------- | --------- |
| D79 | Frontend handbook 0.1.0: prerender-default on Cloudflare (`output: 'server'` + per-route prerender) | Honest adapter model; fast shells |
| D80 | Middleware protected-prefix allowlist; v1 public = `/login` only | HTML nav gate + extensible public list |
| D81 | Alpine `app.factory` entry + `register*(Alpine)`; no `x-init`; `x-data="foo()"`; store factories invoked with `()` | Single Alpine bootstrap; init runs |
| D82 | Alpine-native layering; pages/forms/stores orchestrate `@client/api`; modules never fetch | Testable modules; clear HTTP ownership |
| D83 | Frontend domain at `src/` level; browser infra under `@client/`; `@utils/` for shared helpers | Agent-enforceable boundaries |
| D84 | Suffix conventions: `.store.ts`, `.form.ts`, `.data.ts`, `.module.ts`, `.engine.module.ts`, `.payload.module.ts` | Filename encodes role |
| D85 | OOP in `modules/` only; portable UI kit with peer-dep disclosure for Chart | Reusable primitives |
| D86 | `$persist` in stores/forms only; timer state in game store; forms = v1 `player_settings` substitute (D77) | Predictable persistence |
| D87 | Shared API types via Zod `z.infer<>` in `src/types/api/` with barrel raising | No DTO drift from frozen contract |
| D88 | Client recovery: auto-abandon on mismatch/missing local; no manual abandon UI; server owns DB orphan sweeps | Amends D67 UX wording |
| D89 | Persisted schemas additive-only in 0.1.0; no runtime schema versioning | Extend never break |

D67 row: add footnote that UX is auto-cleanup per D88 (no manual abandon prompt).

### Other maintenance

- `00-Context-Map.md`: tiered packs; inventory rows with ISO date `2026-07-14`; register this spec under historical docs
- `scripts/check-context-map.sh` must pass
- No git commit unless user requests

---

## Critique Resolution Log

| ID | Severity | Resolution |
| -- | -------- | ---------- |
| I1 | Critical | Prerender-default (Decision 1) |
| I2 | Critical | Middleware allowlist (Decision 2) |
| I3 | Critical | API orchestration in pages/forms (Decision 10) |
| I4 | Critical | Auto-cleanup recovery (Decision 4) |
| I5 | Critical | Additive-only, no versioning 0.1.0 (Decision 5) |
| I6 | Critical | `app.factory` + register pattern (Decision 9) |
| I7 | High | Shared types Zod infer (Decision 11) |
| I8 | High | Key ownership (Decision 12) |
| I9 | High | forms = D77 substitute (Decision 14) |
| I10 | High | Timer in store (Decision 14) |
| I11 | High | Full alias set (Decision 7) |
| I12 | High | Auth split (Decision 15) |
| I13 | High | Validation boundary (Decision 13) |
| I14 | High | Tiered context packs (Decision 16) |
| I15 | Medium | Chart peer dep (Decision 13) |
| I16 | Medium | `@utils` (Decision 7) |
| I17 | Medium | Split authority (Decision 16) |
| I18 | Medium | Agent checklist (Deliverable 10) |
| I19 | Medium | Statistics placeholder (Decision 1 deliverable) |
| I20 | Medium | SSR closed list + middleware compat (Decision 1b) |
| I21 | Low | Engine/payload suffixes (Decision 8) |
| I22 | Low | Pattern 17 — proceed |
| I23 | Low | Spec status revised |
| I24 | Low | Worker vs stores note (Decision 6) |

---

## Out of Scope (handbook 0.1.0)

- Scaffolding CLI
- `*.gen.ts` data factories
- Visual design system / tokens
- Frontend automated testing strategy
- i18n
- React/Vue islands
- API v1 contract changes
- `app/src/` implementation
- Server-side stale-session sweep implementation

---

## Validation (documentation change set)

1. All deliverable files exist with version headers and `updated: 2026-07-14`.
2. No contradiction with `06-API/`, amended `00-Overview`, D67/D77/D78/D09.
3. `scripts/check-context-map.sh` passes.
4. Cross-links resolve.
5. Recovery text in `00-Overview` matches Decision 4 before task is claimed done.

---

## Implementation Order (for plan phase)

1. `01-Rendering-Strategy.md` + `02-Folder-Structure.md`
2. `03-Alpine-Patterns.md` + `04-Modules-And-OOP.md`
3. `10-Frontend-Agent-Guide.md`
4. `00-Overview.md` v0.3.0 (including recovery amendment)
5. `04-Architecture-patterns.md` Pattern 17
6. `README.md`, `00-Context-Map.md`, `DECISIONS.md`, CLAUDE.md files
7. `scripts/check-context-map.sh`

---

## Next Step

Spec revised. On approval, invoke **writing-plans** → `docs/superpowers/plans/2026-07-14-frontend-architecture-handbook.md`. **Do not implement** handbook files until plan is approved.
