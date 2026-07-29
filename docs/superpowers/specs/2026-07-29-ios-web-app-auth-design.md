# iOS Home Screen Web App Auth Fix — Design Spec

> **Date:** 2026-07-29
> **Status:** approved (brainstorming consensus)
> **Scope:** Same-origin proxy for Neon Auth traffic (fixes login inside an installed iOS Home Screen web app); PWA manifest + `apple-mobile-web-app` meta tags (prevents Safari breakout, declares standalone display).
> **Prerequisite:** Login page & client auth gate (`2026-07-15-login-page-design.md`, D97/D98).
> **Out of scope:** Extra UX for the unavoidable one-time re-login on first standalone launch (accepted platform constraint — existing client auth gate already handles "no session → `/login`" cleanly); sign-up/password-reset endpoints (none exist in v1); removing `PUBLIC_NEON_AUTH_BASE_URL` from tooling scripts (`env:dev`/`env:mirror` may still need it — flagged, not resolved, here).
> **Fixes:** [levibroeksma/dart-analytics#55](https://github.com/levibroeksma/dart-analytics/issues/55)

---

## Problem

Saving the app to an iOS Home Screen ("Add to Home Screen") produces a standalone web app where authentication never establishes. Investigation of the actual `@neondatabase/auth` SDK source (not installed locally — fetched and inspected directly) confirms the root cause:

- `app/src/lib/client/auth/client.ts` calls `createAuthClient(PUBLIC_NEON_AUTH_BASE_URL)` with no adapter config, defaulting to `BetterAuthVanillaAdapter()`, which wraps `better-auth/client` with only `jwtClient()` and a few unrelated plugins (`adminClient`, `organizationClient`, `emailOTPClient`, `magicLinkClient`, `phoneNumberClient`, `anonymousTokenClient`) — **no `bearer()` plugin**.
- Session establishment (`signIn.email`, `getSession`) therefore relies on Better Auth's **default cookie-based session**, set by the Neon Auth server.
- `PUBLIC_NEON_AUTH_BASE_URL` (`app/.env.example`: `https://ep-xxx.neonauth.<region>.aws.neon.tech/<db>/auth`) is a **different origin** than wherever the app is deployed — currently a `*.workers.dev` subdomain, no custom domain configured (`app/DEPLOYMENT.md`). The session cookie is cross-site relative to the app.
- The app's own `Authorization: Bearer <JWT>` contract (`06-API/00-Overview.md`) is *derived*, not independent: `getJWTToken()` (in the SDK's `adapter-core`) calls `client.getSession()` and reads the JWT off a `set-auth-jwt` response header injected during an already-cookie-authenticated request. If the cookie never lands, no JWT is ever minted.
- WebKit blocks third-party cookies for cross-site subresource requests, and — independently — iOS gives a freshly-installed Home Screen ("standalone") web app its **own separate storage container**, split from the regular Safari browsing context. Both compound: even a session that somehow worked in a Safari tab does not carry into the fresh standalone container on first launch.
- `grep` across `app/src` found **zero** `apple-mobile-web-app-capable` meta tags or manifest reference — today's "Add to Home Screen" produces an unconfigured Safari Web Clip, not a declared standalone PWA, so any auth redirect can also break out into Safari.

Goals:

1. Make all Neon Auth traffic same-origin from the browser's perspective, so the session cookie is first-party regardless of Safari tab vs. installed Home Screen app.
2. Declare the app as an installable standalone PWA scoped to `/`, so navigation (including auth redirects) never breaks out to Safari.
3. Leave the app's own `/api/*` Bearer-JWT contract (`06-API/00-Overview.md`) and client auth gate (D97/D98) unchanged — this fixes what feeds the JWT, not the JWT contract itself.

---

## Decisions (brainstorming)

| # | Decision |
| --- | --------- |
| B1 | Same-origin reverse proxy at `pages/api/auth/[...path].ts`, forwarding **all** paths under the prefix to `NEON_AUTH_BASE_URL` verbatim (full generic proxy, not an endpoint allowlist) — Neon Auth is a trusted managed backend, not user data; an allowlist would need updating every time a new Better Auth call is added client-side |
| B2 | Proxy rewrites `Set-Cookie`: strip `Domain=` (binds to whatever host serves the request — works on `*.workers.dev` today and any future custom domain with no code change), force `SameSite=Lax`, keep `Secure` |
| B3 | New route class `api-auth-proxy` in `classifyRoute()` — fully public, no JWT check, no player resolution, no `ok/data/requestId` envelope wrapping (Better Auth's own response shape passes through untouched) |
| B4 | Browser `authClient` base URL becomes the same-origin path `/api/auth`; `PUBLIC_NEON_AUTH_BASE_URL` is no longer read by browser code (kept in `.env.example` pending the tooling-script question noted in Out of Scope) |
| B5 | The unavoidable one-time re-login on first standalone launch is accepted as-is — no new UX; existing D98 client auth gate already redirects `/login` cleanly when `getSession()` finds nothing |
| B6 | PWA manifest + meta tags ship in the same change (small, and both are required for a working installed-PWA login) — `scope`/`start_url` pinned to `/`, `display: "standalone"` |

**Ledger entries (proposed):**
- D172 — Neon Auth traffic proxied same-origin through `/api/auth/[...path]` to make the Better Auth session cookie first-party; the app's Bearer-JWT API contract is unchanged, only what feeds `getJWTToken()` changes
- D173 — `apple-mobile-web-app-capable` + `manifest.json` (`scope`/`start_url: "/"`, `display: "standalone"`) declare the app as an installable PWA, closing the "unconfigured Web Clip" gap

---

## Architecture

```
Browser
  authClient (baseUrl: "/api/auth")
        │ fetch (same-origin)
        ▼
Worker middleware.ts
  classifyRoute("/api/auth/...") → api-auth-proxy → next() (no JWT check, no envelope)
        │
        ▼
pages/api/auth/[...path].ts
  forward method/headers/body → NEON_AUTH_BASE_URL/<path>, redirect: "manual"
  rewrite every Set-Cookie: strip Domain=, force SameSite=Lax, keep Secure
        │
        ▼
Neon Auth (managed Better Auth instance)
```

### Auth responsibility split (amended)

| Layer | Owns |
| ----- | ---- |
| Neon Auth | Login, token issuance, refresh (unchanged) |
| `pages/api/auth/[...path].ts` | **New.** Same-origin transport for Neon Auth traffic; cookie rewrite only, no business logic |
| `@client/auth/client.ts` | Browser session access, `getAccessToken()` — now points at `/api/auth` (unchanged shape otherwise) |
| Middleware | JWT verify + player resolution for `api-protected`/`api-provision`; **skips** `api-auth-proxy` entirely |
| API (`/api/*` domain routes) | Domain authorization, envelope errors — unchanged |

---

## File Plan

### New files

| Path | Role |
| ---- | ---- |
| `app/src/pages/api/auth/[...path].ts` | Reverse-proxy controller: forwards to `NEON_AUTH_BASE_URL`, rewrites `Set-Cookie` |
| `app/public/manifest.json` | `scope`/`start_url: "/"`, `display: "standalone"`, name/icons |
| `app/tests/pages/api/auth/[...path].test.ts` | Forwarding + cookie-rewrite behavior (mocked `fetch`) |
| `app/tests/lib/utils/route-class.test.ts` (extend if exists, else create) | `api-auth-proxy` classification cases |

### Modified files

| Path | Change |
| ---- | ------ |
| `app/src/lib/utils/route-class.ts` | Add `api-auth-proxy` class: `/api/auth/` prefix checked before the generic `/api/` fallthrough |
| `app/src/lib/utils/types.ts` (`RouteClass` type, wherever declared) | Add `"api-auth-proxy"` to the union |
| `app/src/middleware.ts` | Route `api-auth-proxy` through the same early `return next()` path as `public-page`/`asset` |
| `app/src/lib/client/auth/client.ts` | `baseUrl` becomes `"/api/auth"` (same-origin); keep the existing "missing config" guard, now checking `NEON_AUTH_BASE_URL` reachability indirectly via the proxy rather than reading `PUBLIC_NEON_AUTH_BASE_URL` directly in browser code |
| `app/src/layouts/BaseLayout.astro` | Add `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`, `<link rel="manifest" href="/manifest.json">` to `<head>` |
| `docs/architecture/06-API/00-Overview.md` | Register `/api/auth/*` as a transport-only proxy surface, explicitly outside the `ok/data/requestId` envelope contract |
| `docs/architecture/06-API/02-Middleware-And-Layering.md` | Add `api-auth-proxy` to the Route classes table |
| `docs/architecture/07-Frontend/01-Rendering-Strategy.md` | Note the auth client now calls same-origin `/api/auth`, not the cross-origin Neon Auth URL directly |
| `DECISIONS.md` | D172, D173 |
| `docs/architecture/00-Context-Map.md` | Register this spec + any new file inventory rows |

---

## Environment

| Variable | Runtime | Purpose | Change |
| -------- | ------- | ------- | ------ |
| `NEON_AUTH_BASE_URL` | Server (Worker) | Existing — JWKS sibling | **New consumer**: the proxy route reads this to build forward targets |
| `NEON_AUTH_JWKS_URL` | Server | Middleware JWT verify | Unchanged |
| `PUBLIC_NEON_AUTH_BASE_URL` | Browser | Previously the auth client's `baseUrl` | No longer read by browser code after this change; left in `.env.example` — removal is an open follow-up (see Out of Scope) |

Browser code still must not import `lib/env.ts` / `parseEnv`.

---

## Error Handling

| Failure | Behavior |
| ------- | -------- |
| Neon Auth returns non-2xx | Proxy passes status + body through unchanged — `authClient` parses Better Auth's own error shape; never remapped to the app's domain error registry |
| Neon Auth unreachable / network error | Proxy returns `502`, plain text, logged server-side with `requestId` if available |
| `NEON_AUTH_BASE_URL` missing at request time | `500`, plain text, logged server-side |
| Set-Cookie rewrite finds no cookies | No-op — pass response through as-is |

The proxy never wraps responses in the app's `ok/data/requestId` envelope — it is transport, not a domain endpoint.

---

## Testing

Per `app/CLAUDE.md` TDD rules — tests under `app/tests/`, mirroring `app/src/`, Vitest mocks, no real network:

| # | Test | Expected |
| --- | ---- | -------- |
| 1 | Proxy forwards method/path/body to `NEON_AUTH_BASE_URL/<path>` | Mocked `fetch` receives correct target URL, method, body |
| 2 | Proxy strips `Domain=` from `Set-Cookie` | Rewritten header has no `Domain` attribute |
| 3 | Proxy forces `SameSite=Lax` | Rewritten header always has `SameSite=Lax` regardless of upstream value |
| 4 | Proxy preserves `Secure` | Rewritten header keeps `Secure` when upstream sets it |
| 5 | Proxy passes non-2xx bodies through untouched | Status + body match Neon Auth's response exactly |
| 6 | `classifyRoute("/api/auth/sign-in/email")` | Returns `"api-auth-proxy"` |
| 7 | `classifyRoute("/api/players/provision")` still returns `"api-provision"` | No regression |
| 8 | `classifyRoute("/api/sessions")` still returns `"api-protected"` | No regression |
| 9 | Middleware skips `verifyBearerToken` for `api-auth-proxy` | No JWT check invoked |

**Not covered by the automated suite** (no iOS device available): actual behavior inside an installed iOS Home Screen web app — first-party cookie acceptance, storage-container isolation on first launch. This must be manually verified on a real iOS device before closing issue #55, and the verification step is called out explicitly rather than assumed from the test suite passing.

---

## Verification Plan

| # | Check | Expected |
| --- | ----- | -------- |
| 1 | `npm run validate:app` | Pass |
| 2 | Desktop browser: sign in | Unchanged behavior — session cookie now set on app's own origin (inspect DevTools) |
| 3 | Desktop browser: `GET /api/auth/get-session` in Network tab | Same-origin request, `200`, cookie sent as first-party |
| 4 | iOS Safari tab: sign in, confirm working | Session persists across page reloads in-tab |
| 5 | iOS: "Add to Home Screen", launch installed app | Shows `/login` (expected — separate storage container, per B5) |
| 6 | iOS: sign in inside the installed app | Session establishes; subsequent relaunches of the installed app stay authenticated |
| 7 | iOS: installed app icon/splash reflects `manifest.json` name | Manual visual check |

---

## Doc Updates Required (Context Maintenance)

| Doc | Change |
| --- | ------ |
| `06-API/00-Overview.md` | Register `/api/auth/*` as transport-only, outside the envelope contract |
| `06-API/02-Middleware-And-Layering.md` | Add `api-auth-proxy` row to Route classes table |
| `07-Frontend/01-Rendering-Strategy.md` | Auth client now same-origin (`/api/auth`), not cross-origin Neon Auth URL |
| `DECISIONS.md` | D172, D173 |
| `00-Context-Map.md` | Register this spec; add new file inventory rows if the proxy route or manifest warrant one |

---

## Anti-Patterns (explicit)

| Do not | Reason |
| ------ | ------ |
| Wrap the proxy's responses in the app's `ok/data/requestId` envelope | It's transport for a foreign contract (Better Auth), not a domain endpoint |
| Allowlist specific Better Auth paths | Approach B considered and rejected — high maintenance, no meaningful safety gain over a trusted managed backend |
| Hardcode a cookie `Domain=` value | No custom domain exists yet; stripping `Domain` keeps this correct across `*.workers.dev` and any future custom domain |
| Add UX/messaging for the first-launch re-login | Accepted platform constraint (B5) — existing D98 gate already handles it |
| Route `api-auth-proxy` through `verifyBearerToken` | This route IS how a JWT gets obtained — a check here is circular |

---

## Next Step

After spec approval: invoke **writing-plans** skill to produce implementation plan with task breakdown and verification checkpoints.
