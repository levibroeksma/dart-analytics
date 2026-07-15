# Login Page & Client Auth Gate — Design Spec

> **Date:** 2026-07-15
> **Status:** approved (brainstorming consensus)
> **Scope:** In-app email/password login on `/login`, client-side auth gate for prerendered protected routes (D97), Neon Auth dev user provisioning, and first-login player provisioning via `POST /api/players/provision`.
> **Prerequisite:** Theme applied (`global.css` component classes), middleware route classification (D80), provision endpoint (D76), prerender-default model (D79/D97).
> **Out of scope:** Sign-up UI, password reset, sign-out control, SSR opt-in / `run_worker_first`, statistics API.

---

## Problem

`/login` is a prerendered stub that redirects to hosted Neon Auth. The app has no client auth infrastructure (`@client/auth/`, `@client/api/`, Alpine factory, stores). Middleware redirects unauthenticated HTML requests to `/login`, but **prerendered protected shells bypass middleware** on the current Cloudflare configuration (D97) — so a client-side gate is required for the navigation UX the user expects.

Goals:

1. Themed email/password sign-in form on `/login` (sign-in only).
2. Unauthenticated visitors to any protected route redirect to `/login` without app chrome flash.
3. Authenticated visitors to `/login` redirect to `/`.
4. After first sign-in, auto-call `POST /api/players/provision`, then land on `/`.
5. Dev branch has a seeded user: `levi@broeksma.nl` / `admin`, name `Levi`, admin flag set.

---

## Decisions (brainstorming)

| # | Decision |
| --- | --------- |
| B1 | Post-login: auto-provision via `POST /api/players/provision`, then `location.replace('/')` |
| B2 | Unauthenticated protected visit: client gate in `BaseLayout` before paint — no nav flash |
| B3 | `/login` is sign-in only; dev user created out-of-band (Neon MCP + seed script) |
| B4 | Authenticated user on `/login` → redirect `/` |
| B5 | Approach: Alpine auth store + `@neondatabase/neon-js/auth` client (not SSR / not auth module class) |
| B6 | Form controls: `components/forms/Input.astro` + `Button.astro` (themed), not portable `components/ui/` |
| B7 | HTTP orchestration in `login.data.ts`; auth store wraps SDK only — provision via `@client/api/players.ts` |
| B8 | Neon SDK owns session/token cache; auth store tracks gate status, not duplicate token persistence |

**Ledger entry (proposed):** D98 — Client auth gate in `BaseLayout` is the load-bearing navigation control for prerendered routes (D97); middleware redirect remains UX nicety for on-demand routes only.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Neon Auth (dev branch) — email/password                │
└──────────────────────┬──────────────────────────────────┘
                       │ signIn.email()
┌──────────────────────▼──────────────────────────────────┐
│  Browser                                                │
│  @client/auth/client.ts    auth.store.ts (gate status)  │
│  @client/api/client.ts     login.data.ts (orchestrate)  │
│  @client/api/players.ts    BaseLayout (gate + cloak)    │
└──────────────────────┬──────────────────────────────────┘
                       │ Bearer JWT
┌──────────────────────▼──────────────────────────────────┐
│  Worker middleware → POST /api/players/provision        │
└─────────────────────────────────────────────────────────┘
```

### Auth responsibility split (unchanged)

| Layer | Owns |
| ----- | ---- |
| Neon Auth | Login, token issuance, refresh |
| `@client/auth/` | Browser session access, `getAccessToken()` |
| Middleware | JWT verify, `locals.auth`, player resolution |
| `login.data.ts` | Sign-in + provision orchestration |
| API | Domain authorization, envelope errors |

---

## File Plan

### New files

| Path | Role |
| ---- | ---- |
| `app/src/lib/client/cn.ts` | `twMerge(clsx(...))` per `07-Frontend/05` |
| `app/src/lib/client/auth/client.ts` | `createAuthClient(PUBLIC_NEON_AUTH_BASE_URL)` singleton |
| `app/src/lib/client/api/client.ts` | Fetch wrapper: Bearer, envelope parse, retryable-only retry |
| `app/src/lib/client/api/players.ts` | `provision({ displayName? })` |
| `app/src/lib/client/alpine/app.factory.ts` | Alpine entry |
| `app/src/lib/client/alpine/register-stores.ts` | Registers `auth` store |
| `app/src/lib/client/alpine/register-route-data.ts` | Registers `loginForm` |
| `app/src/lib/client/alpine/register-ui-data.ts` | Empty stub (factory chain requirement) |
| `app/src/stores/auth.store.ts` | Gate status, `signIn`/`signOut` SDK wrappers, `init()` redirect logic |
| `app/src/pages/login/index.astro` | Login page (migrated from `pages/login.astro` for colocation) |
| `app/src/pages/login/login.data.ts` | Form state + submit orchestration |
| `app/src/components/forms/Input.astro` | Themed labeled input (forwards attrs for Alpine) |
| `app/src/components/forms/Button.astro` | Themed button variants |
| `app/src/types/api/players.ts` | Zod schemas from `06-API/04-Endpoint-Contracts` |
| `app/src/types/api/index.ts` | Barrel export |
| `app/src/utils/auth-routes.ts` | `PUBLIC_PAGES` constant shared with gate logic |
| `app/scripts/seed-dev-auth.ts` | One-time dev user creation |

### Modified files

| Path | Change |
| ---- | ------ |
| `app/src/pages/login.astro` | **Delete** — replaced by `pages/login/index.astro` |
| `app/src/pages/login/index.astro` | Themed form using `Input`/`Button`; no server `env` import |
| `app/src/layouts/BaseLayout.astro` | Auth gate: cloak until `$store.auth.ready` |
| `app/astro.config.mjs` | `alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })` |
| `app/tsconfig.json` | Add `@client/*`, `@stores/*`, `@forms/*`, `@types/*`, `@modules/*` aliases |
| `app/package.json` | `@neondatabase/neon-js`, `@alpinejs/persist` (factory chain per `03`), `clsx`, `tailwind-merge` |
| `app/src/middleware.ts` | Import `PUBLIC_PAGES` from `@utils/auth-routes.ts` (single source) |
| `app/.env.example` | `PUBLIC_NEON_AUTH_BASE_URL` |
| `docs/architecture/07-Frontend/01-Rendering-Strategy.md` | Client gate as load-bearing UX (post-D97 wording) |
| `docs/architecture/05-Database/11-Neon-Integration.md` | Dev auth seed step |
| `docs/architecture/00-Context-Map.md` | Register spec if needed |
| `DECISIONS.md` | D98 entry |

---

## Environment

| Variable | Runtime | Purpose |
| -------- | ------- | ------- |
| `NEON_AUTH_BASE_URL` | Server | Existing — JWKS sibling |
| `NEON_AUTH_JWKS_URL` | Server | Middleware JWT verify |
| `PUBLIC_NEON_AUTH_BASE_URL` | Browser | Neon auth client (`import.meta.env`) |

Browser code must **not** import `lib/env.ts` / `parseEnv`.

---

## Components

### `components/forms/Input.astro`

- **Location rationale:** `05-Astro-Components` — form controls live in `components/forms/`; `components/ui/` is portable/app-agnostic (no theme tokens per `04-Modules-And-OOP`).
- **Props:** `label`, `name`, `type?`, `id?`, `autocomplete?`, `class?`
- **Classes:** `cn("input", classNameProp)`; label `text-sm text-fg-muted`
- **Alpine:** Forwards rest attrs (`x-model`, `required`, `:disabled`) to native `<input>`

### `components/forms/Button.astro`

- **Props:** `variant?: 'primary' | 'secondary' | 'ghost'`, `type?`, `class?`
- **Classes:** `cn("btn", variantMap[variant], classNameProp)`
- **Alpine:** Forwards rest attrs (`x-model`, `required`, `:disabled`) to native `<button>` — v3 shorthand only (D100)
- **Slot:** Label content (supports loading text swap from parent)

No paired `modules/ui/` — presentational only.

---

## Login Page

- **Layout:** `BaseLayout` (no bottom nav)
- **Structure:** `app-shell` → `app-main` (centered) → `surface` card
- **Alpine:** `<form x-data="loginForm()" @submit.prevent="submit">`
- **Fields:** `Input` email + password; `Button type="submit" variant="primary" class="w-full"`
- **Error:** `text-destructive` paragraph with `role="alert"`
- **Prerender:** `export const prerender = true` (unchanged)

### Submit flow (`login.data.ts`)

1. Set `loading = true`, clear `error`
2. `await $store.auth.signIn(email, password)` — SDK `signIn.email()`
3. `await players.provision({ displayName: session.user.name })` — optional; server falls back JWT `name` → `'Player'` (D76)
4. On success: `location.replace('/')`
5. On failure: map to user-facing message, `loading = false`

Import direction: `login.data.ts` → `@stores/auth` (via Alpine store) + `@client/api/players` — never modules.

---

## Auth Gate (`auth.store.ts` + `BaseLayout`)

### Store states

| Status | Meaning |
| ------ | ------- |
| `checking` | `getSession()` in progress |
| `anonymous` | No valid session |
| `authenticated` | Valid session |

### `init()` logic (no `x-init`)

```
getSession()
  if pathname in PUBLIC_PAGES && session → replace('/')
  if pathname not in PUBLIC_PAGES && !session → replace('/login')
  set ready = true
```

### BaseLayout markup

- Body remains `x-data` (Alpine root)
- Cloak: `x-cloak` + `:class="{ invisible: !$store.auth.ready }"` — Alpine v3 shorthand (D100); no `x-bind:class`
- Real authorization remains API JWT boundary (D97)

### `PUBLIC_PAGES` (v1)

```typescript
export const PUBLIC_PAGES = new Set(["/login"]);
```

Single source: `@utils/auth-routes.ts` — imported by both `middleware.ts` (Worker) and `auth.store.ts` (browser). Pure constant; no runtime deps.

---

## API Client

### `@client/api/client.ts`

Per `07-Frontend/00-Overview`:

- Attach `Authorization: Bearer` via `getAccessToken()` from `@client/auth`
- Parse `{ ok, data, error, requestId }` envelope
- Retry only when `error.retryable === true` and idempotency key present (N/A for provision)

### `@client/api/players.ts`

```typescript
export async function provision(body?: ProvisionPlayerRequest): Promise<ProvisionPlayerResponse>
```

Uses Zod types from `@types/api`.

---

## Dev User Setup (out of band)

Not in app UI. Document in `11-Neon-Integration.md`.

| Step | Action |
| ---- | ------ |
| 1 | `configure_neon_auth`: enable email/password, disable email verification on dev |
| 2 | Add trusted domain `http://localhost:4321` |
| 3 | Run `npm run seed:dev-auth` (or `tsx scripts/seed-dev-auth.ts`) |

**Seed script creates:**

| Field | Value |
| ----- | ----- |
| Email | `levi@broeksma.nl` |
| Password | `admin` |
| Name | `Levi` |
| Admin | `true` (Better Auth admin metadata / `neon_auth` schema) |

Credentials documented in script header only — never committed to source beyond dev seed script defaults (acceptable for local dev branch per user request).

---

## Error Handling

| Failure | User message |
| ------- | ------------- |
| Invalid credentials | "Email or password is incorrect." |
| Network / SDK error | "Could not reach the server. Try again." |
| Provision 403 | "Account setup failed. Contact support." |
| Other provision error | Envelope `error.message` |

Never surface raw stack traces.

---

## Verification Plan

| # | Check | Expected |
| --- | ----- | -------- |
| 1 | `npm run validate:app` | Pass |
| 2 | Visit `/` logged out | Redirect `/login`, no nav visible |
| 3 | `/login` logged out | Themed form with Input/Button components |
| 4 | Sign in dev credentials | Land on `/` with nav |
| 5 | `/login` while authenticated | Redirect `/` |
| 6 | Second sign-in | Provision returns `created: false` |
| 7 | API without token | `401 UNAUTHORIZED` |
| 8 | `seed-dev-auth.ts` on fresh branch | User can sign in |

---

## Doc Updates Required (Context Maintenance)

| Doc | Change |
| --- | ------ |
| `01-Rendering-Strategy.md` | Route-class table: protected chrome uses **client auth gate**, not middleware gate, for prerendered routes |
| `11-Neon-Integration.md` | Add dev auth seed section |
| `DECISIONS.md` | D98 |
| `00-Context-Map.md` | Note client auth implementation if inventory row needed |

---

## Anti-Patterns (explicit)

| Do not | Reason |
| ------ | ------ |
| Import `lib/env.ts` in browser code | Server-only |
| Put provision HTTP in `auth.store` | Import direction — stores call API only for recovery bootstrap |
| Use `x-init` for gate | Forbidden — store `init()` only |
| `x-bind:*` / `x-on:*` when `:attr` / `@event` works | Alpine v3 shorthand required (D100) |
| Parse JWT in browser | Middleware owns verification |
| Put themed controls in `components/ui/` | Portable kit must not use app tokens |
| Rely on middleware for prerendered route security | D97 — API is real boundary |

---

## Next Step

After spec approval: invoke **writing-plans** skill to produce implementation plan with task breakdown and verification checkpoints.
