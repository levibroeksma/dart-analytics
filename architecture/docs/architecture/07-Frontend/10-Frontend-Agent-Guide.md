<!--
status: canonical
scope: frontend/agent-rules
read-when: before any frontend page, component, or module work
updated: 2026-07-14
-->

# Frontend Agent Guide

> **Version:** 0.1.0
>
> Condensed operating rules for AI agents (and developers) touching the Astro/Alpine frontend.
>
> Read this before creating pages, stores, modules, or client API wiring. For detail, use `07-Frontend/01`–`04`.

---

# Load Packs

Load exactly the pack for your task type (`00-Context-Map.md`):

| Task | Load exactly |
| ---- | ------------ |
| Page / component work | This file + `00-Overview.md` + `app/CLAUDE.md` |
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

- **No `x-init`** — forbidden
- **`x-data="factory()"`** — always invoke; never `x-data="factory"`
- **Stores:** `Alpine.store('name', storeFactory(persist))` — invoke factory

## 3. Alpine entry

- Sole entry: `lib/client/alpine/app.factory.ts` via `@astrojs/alpinejs`
- No `import Alpine from 'alpinejs'` outside factory chain

## 4. Rendering

- **Prerender-default:** `export const prerender = true` on app pages unless SSR opt-in list applies
- Classify new routes **public** (`/login` only in v1) or **protected** in `01-Rendering-Strategy.md`

## 5. Import direction

```
pages / *.data.ts / forms  →  @client/api
stores                     →  @client/api (recovery bootstrap only)
modules/*                  →  never @client/api, never Alpine
```

## 6. `$persist`

Only in `*.store.ts` and `*.form.ts`. Persisted shapes are additive-only (D89); a single `_v` per store discards on incompatible bump (D91).

## 7. Recovery

Auto-cleanup on mismatch — no manual abandon UI. Client orphans → client fixes. Server DB orphans → server (deferred). A completed session whose upload fails is held in the `outbox` store and retried with the same `Idempotency-Key` until confirmed (D90) — never dropped. See `03-Alpine-Patterns.md`.

## 8. Types

Zod `z.infer<>` only. Import via `@<area>/types` barrels — no deep paths.

---

# Forbidden

- Frontend `controllers/` folder
- `x-init`
- `x-data` without `()`
- `$persist` in components or `.data.ts`
- HTTP in `modules/`
- Server imports in browser code
- Hand-authored DTO types duplicating API contract
- Statistics API calls before post-v1 endpoints ship

---

# Pre-Completion Checklist

- [ ] File suffix matches role
- [ ] No `x-init`; all `x-data` invocations use `()`
- [ ] New route classified in `01-Rendering-Strategy.md`
- [ ] No `@client/api` import in `modules/`
- [ ] Recovery text consistent with `00-Overview.md` (auto-cleanup)
- [ ] Context Maintenance: `00-Context-Map.md` updated if docs added/moved
- [ ] `scripts/check-context-map.sh` passes

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | API integration entry |
| `01-Rendering-Strategy.md` | Prerender, middleware |
| `02-Folder-Structure.md` | Tree, aliases |
| `03-Alpine-Patterns.md` | Alpine factory |
| `04-Modules-And-OOP.md` | Modules, portable UI |
