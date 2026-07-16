<!--
status: canonical
scope: frontend/folder-structure
read-when: new frontend files, aliases, import direction
updated: 2026-07-14
-->

# Frontend Folder Structure

> **Version:** 0.1.0
>
> Authoritative `app/src/` layout for browser code, shared types, and Worker API areas.
>
> Rendering rules: `01-Rendering-Strategy.md`. Alpine patterns: `03-Alpine-Patterns.md`.

---

# Purpose

This document defines where frontend files live, how they are named, and which import directions are enforceable.

Server API layering (`pages/api/**`, `services/`, `repositories/`) is detailed in `../06-API/02-Middleware-And-Layering.md`. This document covers the **browser and shared-type** areas plus how they sit beside Worker code.

---

# Authoritative Tree

```
app/src/
├── lib/
│   ├── client/                      # @client — browser infrastructure only
│   │   ├── alpine/
│   │   │   ├── app.factory.ts       # Alpine entry (export default (Alpine) => void)
│   │   │   ├── register-stores.ts
│   │   │   ├── register-ui-data.ts
│   │   │   └── register-route-data.ts
│   │   ├── api/                     # fetch client, domain API modules
│   │   └── auth/                    # browser token access
│   ├── server/                      # envelope, errors — Worker only
│   ├── auth/                        # @auth — authentication data factories, middleware helpers
│   │   ├── login.data.ts
│   │   └── logout.data.ts
│   └── utils/                       # @utils (note: alias maps here, not to top-level utils/)
├── types/
│   └── api/                         # shared Zod schemas + z.infer<> barrels
├── utils/                           # @utils — widely reused pure helpers
├── stores/                          # @stores — *.store.ts
├── forms/                           # @forms — *.form.ts
├── modules/
│   ├── ui/                          # portable OOP (*.module.ts)
│   └── game/                        # *.engine.module.ts, *.payload.module.ts
├── components/
│   ├── ui/                          # portable Astro + Alpine wiring
│   └── <domain>/
├── icons/                           # @icons — SVG sources (astro-icon style imports)
├── styles/                          # @styles — global.css, Tailwind layers
├── pages/
│   └── <route>/
│       ├── index.astro
│       └── <route>.data.ts          # optional colocated Alpine.data factory
├── layouts/
├── middleware.ts
├── services/                        # Worker only — orchestration
└── repositories/                    # Worker only — SQL
```

---

# Worker vs Browser Areas

| Area | Runtime | Must not import |
| ---- | ------- | --------------- |
| `services/`, `repositories/`, `db/`, `pages/api/**` | Worker | `@stores`, `@forms`, `@modules` (browser) |
| `stores/`, `forms/`, `modules/`, `components/`, `pages/*.astro` | Browser | `lib/server/`, server `lib/auth/` |
| `@client/**` | Browser | `services/`, `repositories/` |

**Naming collision guard:** `stores/` (Alpine client state) ≠ `services/` (Worker orchestration). They are unrelated layers.

---

# Path Aliases

All imports use `@`-prefixed aliases. Deep relative paths (`../../../`) are forbidden.

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
| `@icons/*` | `src/icons/*` |
| `@styles/*` | `src/styles/*` |
| `@lib/*` | `src/lib/*` (legacy — browser code migrates to `@client`, D66/D78) |

### Barrel type imports

Types are imported via `@<area>/types` only — same raising chain as `../06-API/03-Shared-Conventions.md`. Never deep-import from a defining module when a barrel exists.

```typescript
// good
import type { EventsBatchRequest } from "@types/api";

// bad
import type { EventsBatchRequest } from "@types/api/sessions/batch/types";
```

### Deprecation

Browser code migrates from `@lib/api` → `@client/api`. Handbook documents the target; `tsconfig.json` migration is an app implementation task.

---

# File Suffix Conventions

| Suffix | Responsibility | `$persist` |
| ------ | -------------- | ---------- |
| `.store.ts` | Alpine store factory | **Allowed** |
| `.form.ts` | Form/draft state factory; v1 substitute for `player_settings` (D77) | **Allowed** |
| `.data.ts` | Alpine.data factory (registered via `register-*-data.ts`) | **Forbidden** |
| `.module.ts` | Portable UI OOP class (`modules/ui/`) | **Forbidden** |
| `.engine.module.ts` | Game state machines (`modules/game/`) | **Forbidden** |
| `.payload.module.ts` | API payload assembly (`modules/game/`) | **Forbidden** |
| `.astro` | Markup + wiring only | **Forbidden** |

**Examples:** `game.store.ts`, `session-setup.form.ts`, `play.data.ts`, `timer.module.ts`, `turn.engine.module.ts`, `batch.payload.module.ts`.

---

# Colocation vs Promotion

| Scope | Location |
| ----- | -------- |
| Auth-related data factories | `lib/auth/` (e.g. `login.data.ts`, `logout.data.ts`) |
| Domain-specific data factories | `lib/<domain>/` if shared, else colocate under `pages/<route>/` |
| Stores, forms, modules (multi-page use) | `stores/`, `forms/`, `modules/`, or `components/` |

**Agent rule:** auth-related `.data.ts` files always live in `lib/auth/`. For other files, if imported from more than one page, promote it out of `pages/`.

---

# Import Direction

```
pages/*.astro / *.data.ts / forms  →  stores / @client/api
stores                             →  modules / @client/api (recovery bootstrap only)
modules/*                          →  @types/api, @utils — never @client/api, never Alpine
@client/api                        →  never imports stores, forms, modules, pages
```

Modules never perform HTTP. Pages and forms orchestrate `@client/api`; stores may call `@client/api` only for defined recovery/bootstrap workflows.

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `01-Rendering-Strategy.md` | Prerender-default, middleware |
| `03-Alpine-Patterns.md` | `app.factory`, stores, forms |
| `04-Modules-And-OOP.md` | Module boundaries |
| `../06-API/02-Middleware-And-Layering.md` | Worker folder tree |
| `../06-API/03-Shared-Conventions.md` | Alias and barrel rules |
