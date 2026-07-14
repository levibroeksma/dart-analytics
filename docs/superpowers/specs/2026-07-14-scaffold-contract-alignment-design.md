# Scaffold ↔ Frozen-Contract Alignment Design

> **Date:** 2026-07-14
> **Status:** proposed design (autonomous architecture review — awaiting user approval)
> **Scope:** bring the early `app/` scaffold in line with the frozen v1 API contract and the frontend rendering strategy, and verify one technical claim the rendering doc depends on. Docs win over code (authority order), so these are code fixes unless verification proves a doc wrong.
> **Branch:** `claude/darts-analytics-arch-review-nvyboi`

---

## Problem

The `app/` scaffold predates parts of the frozen contract and deviates from it in ways that will calcify if endpoints are built on top of it:

1. **Middleware never returns `401 UNAUTHORIZED`.** An API request with a missing/malformed token falls through to the handler with `locals.auth` unset. The contract (`06-API/00` + `02`) makes middleware the owner of the 401 and of route classification (public / protected / authenticated-unprovisioned); today `provision.ts` hand-rolls its own 401 — the exact duplication the layering doc forbids.
2. **Invalid/expired JWTs crash to 500.** `jose.jwtVerify` throws on bad signature/expiry; `verifyBearerToken` doesn't catch, so the contract's 401 surfaces as an unhandled Worker error.
3. **Player lookup runs on every request** — including static pages and `/login` — instead of only on protected API routes; the middleware has no route-classification structure at all.
4. **HTML gate mismatch.** D80 / `07-Frontend/01`: v1 public = `/login` only; protected prefixes `/`, `/games`, `/profile`, `/statistics`. Code gates `/profile` only.
5. **Rendering config drift.** `astro.config.mjs` sets no `output: 'server'`, no `alpinejs` entrypoint, and no page exports `prerender = true` — three explicit requirements of `01-Rendering-Strategy.md` (the entrypoint is acknowledged as pending; the output mode is not).
6. **Provision contract gap (D76).** `04-Endpoint-Contracts.md` requires optional `displayName` (Zod-validated) with JWT `name`-claim fallback; the code ignores the request body and hard-codes `'Player'`, and `verifyBearerToken` never surfaces the `name` claim.

**Plus one design-correctness risk in the docs themselves:** `01-Rendering-Strategy.md` asserts "prerender does **not** bypass middleware — middleware runs on every HTML request before the prerendered shell is served." On Cloudflare Workers with static assets, the platform serves matching assets **before** invoking the Worker unless `run_worker_first` is configured; `wrangler.jsonc` does not set it. If the assertion is wrong for this deployment, every "protected prerendered shell" is publicly reachable and the route-classification model silently loses its navigation gate. Astro/adapter versions differ on this; it must be verified, not assumed.

---

## Decision 1 — Verify the prerender/middleware claim first

Build and deploy (or `wrangler dev`) a protected prerendered page and request it without auth.

- If middleware runs → record the verification in `01-Rendering-Strategy.md` (one dated line) and proceed.
- If assets are served first → amend `01-Rendering-Strategy.md` and `wrangler.jsonc` (`run_worker_first: true` for protected prefixes, or reclassify shells as public-by-design since data is JWT-gated anyway — decision recorded in `DECISIONS.md`).

This is the only item where a frozen doc may need amending; everything else is code-to-doc.

---

## Decision 2 — Middleware rewritten to the documented route-class model

Structure (mirrors `06-API/02` flow diagram):

1. assign `requestId`
2. classify: public HTML (`/login`), protected HTML (documented prefixes), API authenticated-unprovisioned (`POST /api/players/provision`), API protected (all other `/api/*`)
3. public → `next()` with no DB work
4. extract + verify Bearer token; `try/catch` around `jwtVerify` → API routes get `401 UNAUTHORIZED` envelope, HTML routes get `/login` redirect
5. authenticated-unprovisioned → set `locals.auth = { authUserId }`, skip player resolution, `next()`
6. protected API → resolve player once; missing → `403 PLAYER_NOT_PROVISIONED`; set full `locals.auth`
7. protected HTML → redirect to `/login` when unauthenticated (Decision 1 outcome governs whether this is load-bearing or defence-in-depth)

`provision.ts` drops its hand-rolled 401 (middleware owns it). Envelope construction moves to `lib/server/envelope.ts` per `06-API/02` — the scaffold's inline JSON literals are the seed of divergent error shapes.

## Decision 3 — Rendering config aligned

- `astro.config.mjs`: `output: 'server'`; `alpinejs({ entrypoint: '/src/lib/client/alpine/app.factory' })` lands together with the first `app.factory.ts` (not before, or the build breaks).
- Existing pages get `export const prerender = true` per the prerender-default rule.
- API routes stay on-demand (no prerender export needed under `output: 'server'`).

## Decision 4 — Provision endpoint completes D76

- Parse optional JSON body with the `ProvisionPlayerRequest` Zod schema; `VALIDATION_FAILED` on malformed input.
- `verifyBearerToken` returns `{ authUserId, name? }` (claim passthrough stays minimal per `00-Overview`).
- `provisionPlayer(authUserId, displayName?)` resolves: request → `name` claim → `'Player'`.

---

## Sequencing note

Decisions 2–4 are implementation-phase work and can ride the first real endpoint task; Decision 1 is cheap and should happen **before** any frontend page work relies on the middleware gate. Nothing here changes the frozen route surface or DTOs.

---

## Success criteria

1. Unauthenticated `GET /api/<protected>` returns the standard `401 UNAUTHORIZED` envelope from middleware; expired token does not 500.
2. `/login` triggers no JWKS fetch or DB query; protected pages redirect per D80.
3. `POST /api/players/provision` honours `displayName`/`name`-claim per `04-Endpoint-Contracts.md`.
4. `01-Rendering-Strategy.md` carries a dated verification note (or amendment) for the middleware/prerender interaction.
