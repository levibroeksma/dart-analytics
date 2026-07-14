<!--
status: canonical
scope: frontend/rendering
read-when: new routes, prerender vs SSR decisions
updated: 2026-07-14
-->

# Frontend Rendering Strategy

> **Version:** 0.1.0
>
> Prerender-default rendering on Cloudflare Workers.
>
> API integration and state ownership remain in `00-Overview.md`.

---

# Purpose

This document defines how Astro pages in `app/` are rendered and how HTML route protection interacts with prerendering.

It answers:

- prerender vs on-demand SSR vs server islands
- which routes are public vs protected
- how middleware and prerender cooperate

---

# Prerender-Default Model

The project uses **`output: 'server'`** with the `@astrojs/cloudflare` adapter. **Prerender-default** means most app pages opt in to static HTML at build time while the Worker remains the runtime host.

| Setting | Value |
| ------- | ----- |
| Astro `output` | `'server'` (`@astrojs/cloudflare`) |
| Default per app page | `export const prerender = true` |
| API routes (`pages/api/**`) | On-demand only — never prerender |

Do not set global `output: 'static'`. The handbook term is **prerender-default**, not static-default.

**Target Astro config (documented; app migration is separate):**

```javascript
alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })
```

---

# Middleware + Prerender

Prerender does **not** bypass middleware. With `output: 'server'`, middleware runs on every HTML request before the prerendered shell is served.

```
Request
    │
    ▼
middleware.ts
    ├─ public route? → next()
    ├─ protected route + no auth? → redirect /login
    └─ authorized → next()
    │
    ▼
Prerendered HTML shell (or on-demand SSR if opted in)
    │
    ▼
Client fetch (@client/api) + Alpine hydration
```

Protected routes are prerendered **shells**. They are not useful without passing the middleware gate. Data remains client-fetched with Bearer JWT — middleware guards navigation, not API payloads.

---

# Route Classification (v1)

## Public routes

| Path | Notes |
| ---- | ----- |
| `/login` | Only public HTML route in v1 |

The public list is **extensible** (marketing pages later). When adding a public route, register it here and ensure middleware allows unauthenticated access.

## Protected prefixes

| Prefix | Notes |
| ------ | ----- |
| `/` | Home |
| `/games` | Gameplay and session flows |
| `/profile` | Player profile |
| `/statistics` | Post-v1 placeholder shell — no stats API calls until view-backed endpoints ship (D63) |

**Rule:** every new HTML route must be classified **public** or **protected** in this document and reflected in `middleware.ts`.

---

# Route-Class Rendering Table

| Route class | Rendering | Data loading |
| ----------- | --------- | ------------ |
| Public (`/login`) | Prerender | Neon Auth client SDK |
| App chrome (layouts, nav) | Prerender shell + middleware | None at build time |
| Data lists (sessions, history) | Prerender shell + middleware | Client `fetch` via `@client/api/` after paint |
| Active gameplay | Prerender shell + middleware + Alpine | Local-first store (`$persist`); API at session boundaries |
| Server islands / SSR opt-in | On-demand | Server-only secrets/env (see below) |

Skeleton-first hydration for data-heavy pages remains the read-path standard (`00-Overview.md`).

---

# SSR Opt-In (Closed List)

Set `export const prerender = false` **only** when:

1. Server-only env/secrets must appear in HTML (never gameplay state, never JWT payloads).
2. Per-request `Astro.request` headers materially affect markup (rare in v1).
3. The route is explicitly listed as an exception in this document.

All other app pages: `export const prerender = true`.

Gameplay state is never server-rendered (D67 local-first model).

---

# Server Islands

Server islands are **exceptional**, not the default integration pattern.

Use only when the browser must never see a value and prerender cannot supply it. Do not use server islands for:

- JWT-protected domain data (use client `fetch`)
- gameplay or session state
- statistics (deferred post-v1)

---

# Anti-Patterns

| Anti-pattern | Reason |
| ------------ | ------ |
| Server-rendering gameplay state | Violates D67 local-first recovery |
| SSR to inject JWT-protected API data | No server session; client owns token |
| Assuming prerender = publicly accessible app | Middleware still runs on HTML requests |
| Adding protected routes without middleware update | HTML shell reachable without nav gate |
| `output: 'static'` globally on Cloudflare | Misaligns with adapter + API on same Worker |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | API integration, state ownership, skeleton hydration |
| `02-Folder-Structure.md` | `app/src/` tree and aliases |
| `03-Alpine-Patterns.md` | Alpine factory and hydration |
| `../06-API/01-Implementation-Strategy.md` | Cloudflare Workers + Neon constraints |
| `../../DECISIONS.md` | D79, D80, D88 |
