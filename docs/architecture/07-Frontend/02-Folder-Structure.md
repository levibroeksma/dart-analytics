<!--
status: canonical
scope: frontend/folder-structure
read-when: new frontend files, aliases, import direction
updated: 2026-09-17
-->

# Frontend Folder Structure

> **Version:** 0.3.0 (tree and alias table reconciled with `app/src/` — nine missing `lib/`/`modules/` trees, three missing aliases; alias table now gate-enforced, D302, issue #347, 2026-09-17; prior 0.2.4 single-route class carve-out for Trivia, 2026-09-09; prior 0.2.3 DartBot module suffix registration — `.module.ts` widened, `.strategy.module.ts` added, `modules/dartbot/` in the tree, 2026-09-01; 0.2.2 cross-runtime `lib/game/rulesets/`, 2026-07-26)
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
│   ├── game/                        # @lib/game — game data factories, session recovery
│   │   └── rulesets/                # cross-runtime: ruleset config schemas + codec
│   ├── exercise/                    # exercise ruleset schemas + solo-participant upload
│   ├── training/                    # routine start/step-advance data factories
│   ├── stats/                       # statistics overview formatting
│   ├── trivia/                      # trivia play data factories
│   ├── ui/                          # shared layout/toggle data factories
│   └── utils/                       # @utils (note: alias maps here, not to top-level utils/)
├── utils/                           # @utils — widely reused pure helpers
├── stores/                          # @stores — *.store.ts
├── modules/
│   ├── ui/                          # portable OOP (*.module.ts)
│   ├── game/                        # *.engine.module.ts, *.payload.module.ts
│   ├── exercise/                    # *.engine.module.ts + engine registries (training exercises)
│   ├── training/                    # routine orchestration (*.module.ts)
│   ├── stats/                       # pure statistics aggregation (*.module.ts, D258)
│   ├── trivia/                      # non-GameEngine client tools (*.module.ts)
│   └── dartbot/                     # simulated opponent (*.module.ts, *.strategy.module.ts)
├── components/
│   ├── ui/                          # portable Astro + Alpine wiring
│   └── <domain>/
├── icons/                           # @icons — SVG sources (astro-icon style imports)
├── styles/                          # @styles — global.css, Tailwind layers
├── pages/
│   └── <route>/
│       └── index.astro
├── layouts/
├── middleware.ts
├── services/                        # Worker only — orchestration
└── repositories/                    # Worker only — SQL
```

---

# Worker vs Browser Areas

| Area | Runtime | Must not import |
| ---- | ------- | --------------- |
| `services/`, `repositories/`, `db/`, `pages/api/**` | Worker | `@stores`, `@modules` (browser) |
| `stores/`, `modules/`, `components/`, `pages/*.astro` | Browser | `lib/server/`, server `lib/auth/` |
| `@client/**` | Browser | `services/`, `repositories/` |
| `lib/game/rulesets/` | **Both** | everything — see below |

**Naming collision guard:** `stores/` (Alpine client state) ≠ `services/` (Worker orchestration). They are unrelated layers.

### Cross-runtime area — `lib/game/rulesets/`

One definition per ruleset version lives here: the Zod configuration schema (`types.ts`), the snake_case↔camelCase codec (`config-codec.ts`), and the refinement contract the boundary tests execute (`refinement-contract.ts`). `lib/` is the only tree both runtimes may import, so the Worker validator (`services/rulesets/*`) and the browser engine (`modules/game/*`) share exactly one schema instead of keeping drifting copies.

**Import direction:** the Worker and the browser may both import it; **it may import neither**. No `services/`, `repositories/`, `lib/server/`, `stores/`, `modules/` or Alpine import is permitted from inside it — a single runtime-specific import there splits the shared definition back in two.

---

# Path Aliases

All imports use `@`-prefixed aliases. Deep relative paths (`../../../`) are forbidden.

| Alias | Maps to |
| ----- | ------- |
| `@client/*` | `src/lib/client/*` |
| `@auth/*` | `src/lib/auth/*` |
| `@server/*` | `src/lib/server/*` |
| `@stores/*` | `src/stores/*` |
| `@modules/*` | `src/modules/*` |
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
| `@assets/*` | `src/assets/*` |
| `@lib/*` | `src/lib/*` (legacy — browser code migrates to `@client`, D66/D78) |

This table is the third source `scripts/check-alias-sync.sh` compares (D302): it
must match `app/tsconfig.json`'s `compilerOptions.paths` exactly, alias for
alias, and the gate fails the build when it does not. Adding an alias means
adding it here in the same change. <!-- 2026-09-17 -->

### Barrel type imports

Types are imported via `@<area>/types` only — same raising chain as `../06-API/03-Shared-Conventions.md`. Browser code imports API contract types via `@client/api/types` (re-raised from the Worker's `@routes/types` — see `../06-API/03-Shared-Conventions.md` §Two barrels), never `@routes/types` directly. Never deep-import from a defining module when a barrel exists.

```typescript
// good
import type { EventsBatchRequest } from "@client/api/types";

// bad
import type { EventsBatchRequest } from "@routes/sessions/batch/types";
```

### Deprecation

Browser code migrates from `@lib/api` → `@client/api`. Handbook documents the target; `tsconfig.json` migration is an app implementation task.

---

# File Suffix Conventions

| Suffix | Responsibility | `$persist` |
| ------ | -------------- | ---------- |
| `.store.ts` | Alpine store factory | **Allowed** |
| `.data.ts` | Alpine.data factory (registered via `register-*-data.ts`) | **Forbidden** |
| `.module.ts` | Portable UI OOP class (`modules/ui/`) or DartBot module (`modules/dartbot/`) | **Forbidden** |
| `.engine.module.ts` | Game state machines (`modules/game/`) | **Forbidden** |
| `.payload.module.ts` | API payload assembly (`modules/game/`) | **Forbidden** |
| `.strategy.module.ts` | DartBot target selection per ruleset (`modules/dartbot/strategy/`) | **Forbidden** |
| `.astro` | Markup + wiring only | **Forbidden** |

**Examples:** `game.store.ts`, `play.data.ts`, `timer.module.ts`, `turn.engine.module.ts`, `batch.payload.module.ts`.

---

# Colocation vs Promotion

| Scope | Location |
| ----- | -------- |
| Any `.ts` logic used by a page/component | `lib/<domain>/` — always, even single-route (e.g. `lib/auth/login.data.ts`) |
| Used by 2+ routes, warrants store/module semantics | `stores/`, `modules/` |
| A single-route class (stateful OOP, not a store) | `modules/<domain>/` — the OOP boundary (`04-Modules-And-OOP.md`) applies regardless of route count; the "2+ routes" warrant above governs plain-function code only |

**Agent rule:** no `.ts` file ever lives directly under `components/` or `pages/` — except `pages/api/**` — regardless of single- or multi-consumer use. `<domain>` uses the same vocabulary as `modules/<domain>/` and `stores/<domain>.store.ts` (e.g. `auth`, future `game`, `players`) — never a route or component-folder name.

---

# Import Direction

```
pages/*.astro                      →  stores / @client/api
stores                             →  modules / @client/api (recovery bootstrap only)
modules/*                          →  @client/api/types, @utils — never @client/api, never Alpine
@client/api                        →  never imports stores, modules, pages
```

Modules never perform HTTP. Pages orchestrate `@client/api`; stores may call `@client/api` only for defined recovery/bootstrap workflows.

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `01-Rendering-Strategy.md` | Prerender-default, middleware |
| `03-Alpine-Patterns.md` | `app.factory`, stores |
| `04-Modules-And-OOP.md` | Module boundaries |
| `../06-API/02-Middleware-And-Layering.md` | Worker folder tree |
| `../06-API/03-Shared-Conventions.md` | Alias and barrel rules |
