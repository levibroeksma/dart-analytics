<!--
status: canonical
scope: frontend/modules-oop
read-when: game engine, portable UI kit, payload builders
updated: 2026-07-16
-->

# Frontend Modules And OOP

> **Version:** 0.1.2 (anti-pattern: inline export type/interface in .module.ts, 2026-07-17)
>
> OOP boundaries, portable UI kit, engine vs payload modules, validation split.
>
> Alpine wiring: `03-Alpine-Patterns.md`. Folder layout: `02-Folder-Structure.md`.

---

# Purpose

This document defines where object-oriented code belongs in the frontend, how portable UI primitives are structured, and how client game logic relates to API validation.

---

# OOP Boundary

| Layer | OOP? | Pattern |
| ----- | ---- | ------- |
| `modules/ui/*.module.ts` | **Yes** | `new Timer(opts)`, lifecycle methods |
| `modules/game/*.engine.module.ts` | **Yes** | Turn/scoring state machines when warranted |
| `modules/game/*.payload.module.ts` | Prefer functions | Assembles typed API payloads |
| `stores/`, `forms/`, `*.data.ts` | **No** | Object factories |
| `components/ui/*.astro` | **No** | Markup + Alpine wiring |

Classes are permitted **only** under `src/modules/`.

---

# Constructor & Lifecycle

1. Construction via `new ModuleClass(options)` happens in Alpine factory `init()` — never in Astro frontmatter.
2. Constructor receives plain config and callbacks — no Alpine proxies, no `fetch`, no store imports inside `modules/ui/`.
3. Modules with timers/listeners expose `start()` / `stop()` / `destroy()`.
4. Alpine teardown must call `destroy()` to prevent leaks.

### Timer example (sketch)

```typescript
// modules/ui/timer.module.ts
export class Timer {
  constructor(
    private opts: {
      durationMs: number;
      onTick?: (remainingMs: number) => void;
    },
  ) {}

  start() { /* … */ }
  stop() { /* … */ }
  destroy() { /* … */ }
}
```

Authoritative timer fields (`timerRemainingMs`, etc.) live in `game.store.ts`. The `Timer` class drives intervals against store fields — not the reverse.

---

# Portable UI Kit

Reusable primitives: **timer**, **toast**, **modal**, **chart**.

### Pairing rule

Every `components/ui/<Name>.astro` has exactly one `modules/ui/<name>.module.ts`.

### Portability contract

| Rule | `modules/ui/` + `components/ui/` |
| ---- | ---------------------------------- |
| May import | Paired module, Tailwind utilities |
| Must not import | `@stores`, `@forms`, `@pages`, `@client/api`, `@services`, `@repositories` |
| Styling | Tailwind utilities — no app-specific design tokens |
| Copy-paste | Drop both folders into another Astro+Alpine project; adjust classes |

### Chart peer dependency

The portable kit is **behaviour + markup contract**. `chart.module.ts` may wrap a declared **peer dependency** (e.g. Chart.js). Copy-paste includes noting the peer dep in `package.json` — not zero-dependency.

Alpine wiring for UI components is registered in `register-ui-data.ts`. Modules remain pure TypeScript — no Alpine import.

---

# Engine vs Payload Modules

| Suffix | Owns | Example |
| ------ | ---- | ------- |
| `*.engine.module.ts` | In-session turn flow, scoring UX, `clientKey` assignment | `turn.engine.module.ts` |
| `*.payload.module.ts` | Assembling `EventsBatchRequest` from store snapshots | `batch.payload.module.ts` |

Payload modules import types from `@client/api/types` only. They never call `@client/api`.

---

# Key Ownership

| Key | Owner | Lifecycle |
| --- | ----- | --------- |
| `clientKey` (per turn/dart) | Engine / payload assembly | Minted at fact creation |
| `Idempotency-Key` (batch header) | `game.store.ts` | Minted at session-complete; held until batch ACK |

Pages/forms pass the store-held idempotency key to `@client/api` on `POST .../events/batch`.

---

# Game Engine vs API Validation

| Layer | Owns |
| ----- | ---- |
| `modules/game/` | In-session UX: scoring display, turn flow, dart entry, payload **assembly** |
| API / service | Authoritative validation: ruleset limits, capture-mode matrix (D73), status transitions, idempotency |

The frontend may **predict** rejection for UX. The API response is always the source of truth. Never override or ignore domain error codes.

This preserves D40 (client game engine) without making the frontend the authority on persisted domain rules.

---

# Anti-Patterns

| Anti-pattern | Reason |
| ------------ | ------ |
| Classes in `stores/` or `forms/` | OOP boundary violation |
| `@client/api` in `modules/` | HTTP belongs in pages/forms/stores |
| Alpine import in `modules/` | Factory entrypoint only |
| Portable UI importing `@stores` | Breaks copy-paste contract |
| Duplicating API validation as source of truth | Drift from frozen contract |
| Persisting toast/modal state | Ephemeral UI |
| `export type`/`export interface` declared inline in a `.module.ts` | Belongs in the folder's `types.ts`/`interfaces.ts` barrel (`../06-API/03-Shared-Conventions.md`) |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `03-Alpine-Patterns.md` | Stores, forms, factory |
| `02-Folder-Structure.md` | Suffix table |
| `../06-API/04-Endpoint-Contracts.md` | `EventsBatchRequest`, `DartFact` |
| `../06-API/03-Shared-Conventions.md` | Zod `z.infer<>` type rules |
| `10-Frontend-Agent-Guide.md` | Agent quick reference |
