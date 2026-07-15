<!--
status: canonical
scope: frontend/rendering
read-when: new routes, prerender vs SSR decisions
updated: 2026-07-15
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

Middleware runs on every **on-demand** (non-prerendered) HTML request before the response is served:

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
On-demand SSR response (opted-in routes only)
    │
    ▼
Client fetch (@client/api) + Alpine hydration
```

For **prerendered** routes — the default for app pages (see Prerender-Default Model above) — **middleware** navigation gating does not apply on this Cloudflare configuration (D97). **Client auth gate** in `BaseLayout` is load-bearing instead (D98): see below.

Protected routes are prerendered **shells**. The shell itself carries no domain data — every protected route class in the Route-Class Rendering Table below fetches its data client-side, after paint, with a Bearer JWT. An unauthenticated visitor who reaches the shell directly therefore sees an empty page, not gameplay or profile data.

## Client auth gate (D98, 2026-07-15)

Because prerendered HTML bypasses `middleware.ts` on this Cloudflare config (D97), protected-route **navigation UX** is enforced in the browser:

- `auth.store.ts` runs `init()` on Alpine boot (no `x-init`): `getSession()` then redirect authenticated users away from `PUBLIC_PAGES` (`/login` → `/`) and anonymous users away from protected paths (`/` → `/login`).
- `BaseLayout.astro` cloaks the body until `$store.auth.ready` (`x-cloak` + `:class="{ invisible: !$store.auth.ready }"`) so app chrome does not flash before the gate resolves.
- `PUBLIC_PAGES` is a single source in `@utils/auth-routes.ts` (shared with `middleware.ts` / `classifyRoute`).

This gate is **navigation UX only** — the JWT-gated API remains the sole real authorization boundary (D97).

## Decided model (D97, 2026-07-15): prerendered shells are public-by-design

**Verified fact:** a `wrangler dev` probe against `/profile` (temporarily marked `prerender = true` under `output: 'server'`, `@astrojs/cloudflare`) confirmed that on this project's Cloudflare configuration — no `run_worker_first` in `app/wrangler.jsonc` — prerendered HTML shells are served directly by Cloudflare's `ASSETS` binding and **never reach `middleware.ts`**. `GET /profile` returned `307` → `/profile/` → `200 OK` with `CF-Cache-Status: HIT` from an unauthenticated client. A control request to a non-prerendered route (`/login`, same build) did invoke the Worker and hit `middleware.ts`, confirming the bypass is specific to asset-served (prerendered) routes, not a broken or disabled middleware. Only `/profile` was probed directly, but the underlying mechanism — Cloudflare's edge serving matching static assets before the Worker runs when `run_worker_first` is unset — is general to this adapter/config and applies to every prerendered route, not just `/profile` (see Protected prefixes below).

**Decided model:** prerendered protected-route shells are **public-by-design**. The team considered setting `"run_worker_first": true` (Worker fronts every request, including static assets) but rejected it: the shell never carries server-rendered domain data regardless, so fronting every asset request through the Worker would only buy cosmetic navigation-gating (an anonymous visitor sees an empty shell either way) at the cost of putting the Worker in the hot path for every static asset. Instead:

- The **JWT-gated API is the sole real authorization boundary** for this app. Any data that must not leak to an unauthenticated visitor is enforced there, never by the HTML route.
- The `middleware.ts` redirect-to-`/login` behavior is retained for on-demand routes and is a **UX nicety** for authenticated navigation (e.g. avoiding a flash of an unauthenticated shell for routes that do go through the Worker) — it is **not** a security control for prerendered routes and must not be relied on as one.
- `app/wrangler.jsonc` is unchanged with respect to `run_worker_first` (still unset) as a direct consequence of this decision.

Full rationale: `DECISIONS.md` D97.

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
| Public (`/login`) | Prerender | In-app themed form + Neon Auth client SDK (`login.data.ts`) |
| App chrome (layouts, nav) | Prerender shell + **client auth gate** (D98) | None at build time |
| Data lists (sessions, history) | Prerender shell + **client auth gate** | Client `fetch` via `@client/api/` after paint |
| Active gameplay | Prerender shell + **client auth gate** + Alpine | Local-first store (`$persist`); API at session boundaries |
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
| Treating the middleware redirect as a security boundary for prerendered protected routes | Prerendered shells are public-by-design on this Cloudflare config (D97) — the JWT-gated API is the only real boundary |
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
| `../../DECISIONS.md` | D79, D80, D88, D97, D98 |
