<!--
status: canonical
scope: frontend/agent-rules
read-when: before any frontend page, component, or module work
updated: 2026-07-22
-->

# Frontend Agent Guide

> **Version:** 0.1.5 (2026-07-21 — comment/format conventions + x-show/x-cloak rule)
>
> Condensed operating rules for AI agents (and developers) touching the Astro/Alpine frontend.
>
> Read this before creating pages, stores, modules, or client API wiring. For detail, use `07-Frontend/01`–`05`.

---

# Load Packs

Load exactly the pack for your task type (`00-Context-Map.md`):

| Task | Load exactly |
| ---- | ------------ |
| Page / component work | This file + `00-Overview.md` + `07-Style-Guide.md` + `app/CLAUDE.md` |
| Gameplay / session features | above + `03-Alpine-Patterns.md` + `04-Modules-And-OOP.md` |
| New route / rendering | above + `01-Rendering-Strategy.md` + `02-Folder-Structure.md` |
| New portable UI primitive | `04-Modules-And-OOP.md` + `03-Alpine-Patterns.md` |
| Frontend architecture / new pattern | `01`–`04` + `04-Architecture-patterns.md` + `01-Principles.md` |

---

# Non-Negotiable Rules

## 1. File suffixes

| Suffix | Role |
| ------ | ---- |
| `.store.ts` | Alpine store factory |
| `.form.ts` | Form/draft factory (v1 `player_settings` substitute) |
| `.data.ts` | Alpine.data factory |
| `.module.ts` | Portable UI class |
| `.engine.module.ts` | Game engine |
| `.payload.module.ts` | API payload builder |

## 2. Alpine bindings

- **`x-show` + `x-cloak`:** every `x-show` element must also have `x-cloak`
- **Alpine v3 shorthand:** `:class`, `:style`, `:value`, `:disabled`, `@click`, `@submit.prevent`, etc. — **never** `x-bind:*` or `x-on:*` when shorthand applies (`03-Alpine-Patterns.md`)
- **Astro exception:** `x-on:click` (or `x-on:*`) only inside `{}` expressions when the linter rejects `@` — nowhere else
- **No `x-init`** — forbidden
- **`x-data="factory()"`** — always invoke; never `x-data="factory"`
- **Stores:** `Alpine.store('name', storeFactory(persist))` — invoke factory

## 3. Alpine entry

- Sole entry: `lib/client/alpine/app.factory.ts` via `@astrojs/alpinejs`
- No `import Alpine from 'alpinejs'` outside factory chain

## 4. Rendering

- **Prerender-default:** `export const prerender = true` on app pages unless SSR opt-in list applies
- Classify new routes **public** (`/login` only in v1) or **protected** in `01-Rendering-Strategy.md`

## 5. File organization

- **Auth-related `.data.ts` files:** always live in `lib/auth/` (e.g. `login.data.ts`, `logout.data.ts`) — imported via `@auth/` alias
- **Other `.ts` files in `lib/`:** organize by domain (e.g. `lib/game/`, `lib/players/`) — no top-level loose files

## 6. Import direction

```
pages / forms              →  @client/api
stores                     →  @client/api (recovery bootstrap only)
modules/*                  →  never @client/api, never Alpine
```

## 7. `$persist`

Only in `*.store.ts` and `*.form.ts`. Persisted shapes are additive-only (D89); a single `_v` per store discards on incompatible bump (D91). Store factories take a `PersistFactory` and call it once per field (D120) — never reuse one `persist()` across fields.

## 8. Recovery

Shared helper: `app/src/lib/game/session-recovery.ts` (D118). Auto-cleanup on **mismatch** — no manual abandon UI. Match-case Continue/Abandon modal on setup is still allowed. Client orphans → client fixes. Server DB orphans → server (deferred). Default: completed upload failures go to the `outbox` and retry with the same `Idempotency-Key` until confirmed (D90). **Score Training exception (D119):** synchronous hard-gate — gate Back / Play again until batch + `PATCH COMPLETED` succeed; results as play-page modal, not a `/results` route. See `03-Alpine-Patterns.md`.

## 9. Types

Zod `z.infer<>` only. Import via `@<area>/types` barrels — no deep paths.

- **`app/src/**/*.ts` comments:** no inline comments inside function bodies — JSDoc above the declaration (`app/CLAUDE.md`)

## 10. Components (`.astro`)

Frontmatter order: Props → imports (`// Layouts·Components·Icons·Lib`) → `// Data` → `// Styles`. Typed `interface Props`. Class composition only via `cn()`; static→`class`, build-time→frontmatter `cn()`, runtime→`:class`, recurring→`@layer components`. Full rules: `05-Astro-Components.md`.

- **Template comments:** `{/* ... */}` only — never `<!-- -->`
- **Frontmatter `// Title`:** blank line before each section header (`05-Astro-Components.md`)
- **Formatting:** Prettier (`singleAttributePerLine`); `npm run format` / `format:check`

- Forward leftover attributes as `{...props}` — never `{...rest}` (`05-Astro-Components.md`)

## 11. Test-driven development

Mandatory for all frontend behavior (`app/CLAUDE.md` is the sole command definition):

| Step | Action |
| ---- | ------ |
| Red | Add `*.test.ts` beside the module; run `npm test` — new test fails |
| Green | Minimal implementation until `npm test` passes |
| Refactor | Clean up with tests still green |

- Vitest only; place `*.test.ts` under `app/tests/`, mirroring `app/src/`'s directory structure — never colocated with the source file.
- Mock `@client/auth` and `fetch` in client/API tests — no live Neon calls.
- Stores, `@client/api/*`, `@utils/*`, Zod schemas: always unit-tested.
- `.astro` components with variant/branching logic: keep it inline in the component's own frontmatter (D101). This logic is untested — no Astro-component test runner exists in this project — accept that rather than extracting a helper solely for testability.
- Shared-mock promotion threshold and full-suite-always-runs policy: `06-Test-Strategy.md`.

## 12. Styling

Semantic tokens only (`surface` / `foreground` / `muted*` / `border*` / `accent*` / `error*` / `success*` / `glass*`) — never raw palette utilities and never legacy `bg-bg*` / `text-fg*`. Primitive classes (`.btn` + variants, `.input`, `.control`, `.tab`, `.alert`, `.nav-pill`, `.gradient-card`, `.link-card`, `.card-wrapper`, `glass`) live in `global.css` — reuse, never reinvent. Build-time classes via `cn()` only (`scripts/check-astro-class-composition.sh`). Never `font-medium` — prefer `font-normal` / `font-semibold` / `font-bold`. Full rules: `07-Style-Guide.md`.

---

# Forbidden

- Frontend `controllers/` folder
- `.ts` files directly under `components/` or `pages/` (except `pages/api/**`) — no exceptions, mechanically enforced by `scripts/check-file-locations.sh`
- `x-init`
- `x-bind:*` and `x-on:*` when Alpine v3 shorthand (`:attr`, `@event`) applies
- `x-data` without `()`
- `$persist` in components or `.data.ts`
- HTTP in `modules/`
- Server imports in browser code
- Hand-authored DTO types duplicating API contract
- Inline `export type`/`export interface` in `.store.ts`/`.module.ts`/`.data.ts`/`.form.ts` — belongs in that folder's `types.ts`/`interfaces.ts`
- Statistics API calls before post-v1 endpoints ship
- Production behavior without a preceding failing test
- Skipping `npm test` in validation

---

# Pre-Completion Checklist

- [ ] Alpine v3 shorthand on binds/listeners (`:class`, `@click` — not `x-bind` / `x-on`)
- [ ] TDD cycle complete: failing test → pass → `npm test` green (test lives under `app/tests/`, not colocated)
- [ ] File suffix matches role
- [ ] Component frontmatter follows the `05` order; classes composed via `cn()`
- [ ] Forward leftover attributes as `{...props}` — never `{...rest}`
- [ ] Styling uses semantic tokens/primitives only (`surface` / `foreground` / …); build-time classes via `cn()` only; no `font-medium`, no raw palette or legacy `bg-bg*` / `text-fg*`
- [ ] No `x-init`; all `x-data` invocations use `()`
- [ ] Every `x-show` element also has `x-cloak`
- [ ] `bash scripts/check-astro-conventions.sh` passes when touching `.astro` markup
- [ ] New route classified in `01-Rendering-Strategy.md`
- [ ] No `@client/api` import in `modules/`
- [ ] Recovery text consistent with `00-Overview.md` (auto-cleanup)
- [ ] Context Maintenance: `00-Context-Map.md` updated if docs added/moved
- [ ] `scripts/check-context-map.sh` passes
- [ ] Template comments are `{/* */}` only (no `<!-- -->`)
- [ ] `npm run format:check` clean when touching `app/` markup/TS

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | API integration entry |
| `01-Rendering-Strategy.md` | Prerender, middleware |
| `02-Folder-Structure.md` | Tree, aliases |
| `03-Alpine-Patterns.md` | Alpine factory |
| `04-Modules-And-OOP.md` | Modules, portable UI |
| `06-Test-Strategy.md` | Shared mocks, full-suite policy |
| `07-Style-Guide.md` | Tokens, primitives, typography, motion, a11y |
