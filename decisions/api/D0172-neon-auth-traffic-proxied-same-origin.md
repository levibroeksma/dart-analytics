---
id: D0172
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [api, contract, envelope, auth, session, JWT]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Neon Auth traffic proxied same-origin through `/api/auth/[...path]` (new `api-auth-proxy`

## Context and Problem Statement
iOS gives an installed Home Screen web app its own storage container split from Safari, and WebKit blocks the cross-site session cookie Better Auth's default client relies on, so login never established inside the installed PWA (issue #55)

## Decision Drivers
* WebKit blocks third-party cookies for cross-site subresource requests (spec Problem).
* iOS gives an installed Home Screen web app a storage container separate from Safari (spec Problem).
* The Bearer JWT is derived from a cookie-authenticated `getSession()`, so if the cookie never lands no JWT is minted (spec Problem).

## Considered Options
* Keep the browser client calling `NEON_AUTH_BASE_URL` directly, with a cross-site session cookie.
* Proxy only an allowlist of specific Better Auth paths (approach B in the spec).
* Proxy all paths under `/api/auth/` to `NEON_AUTH_BASE_URL`, as a same-origin generic proxy (chosen).

## Decision Outcome
Chosen option: "Neon Auth traffic proxied same-origin through `/api/auth/[...path]` (new `api-auth-proxy` route class, bypasses JWT/player checks and the `ok/data/requestId` envelope) so the Better Auth session cookie binds first-party instead of cross-site to `NEON_AUTH_BASE_URL`'s own domain; the app's `Authorization: Bearer` API contract is unchanged, only what feeds `getJWTToken()` changes".

### Consequences
* Good, because the session cookie is first-party regardless of Safari tab or installed Home Screen app.
* Neutral, because the proxy rewrites `Set-Cookie` by stripping `Domain=`, forcing `SameSite=Lax` and keeping `Secure`, so it works on `*.workers.dev` and any future custom domain.
* Neutral, because the one-time re-login on first standalone launch is an accepted platform constraint with no new UX.
* Neutral, because the proxy returns Better Auth's own response shape, never the `ok/data/requestId` envelope.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/pages/api/auth/[...path].test.ts` covers forwarding and the cookie rewrite. `app/tests/utils/route-class.test.ts` covers the `api-auth-proxy` classification. The spec says behavior inside an installed iOS web app is not covered by the automated suite and needs manual verification on a real device.

## Pros and Cons of the Options
### Direct calls to `NEON_AUTH_BASE_URL`
* Bad, because the session cookie is cross-site, and login never established inside the installed PWA.

### Allowlist of Better Auth paths
* Bad, because the allowlist needs updating whenever the client adds a Better Auth call.
* Bad, because it gives no meaningful safety gain over a trusted managed backend.

### Generic same-origin proxy
* Good, because every Better Auth call works without proxy changes.
* Good, because the cookie binds first-party to whichever host serves the request.

## Evidence / More Information
Decided: 2026-07-29

* `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md` (Problem; Decisions B1-B5; Error Handling; Testing; Anti-Patterns): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-29-ios-web-app-auth.md` (route class and proxy tasks): confirmed the proxy behavior.
* Commit `420c566b` (PR #59, 2026-07-30): added the spec and plan that introduce D172.
