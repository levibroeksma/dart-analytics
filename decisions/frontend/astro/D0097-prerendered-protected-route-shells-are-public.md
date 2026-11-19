---
id: D0097
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Prerendered protected route shells are public-by-design (Cloudflare serves static assets

## Context and Problem Statement
`run_worker_first` would front every static asset through the Worker for a purely cosmetic benefit (an anonymous visitor sees an empty shell either way, since data is never server-rendered)
The scaffold-contract spec flagged that Cloudflare Workers serves matching static assets before the Worker runs unless `run_worker_first` is set. If so, every prerendered protected shell is publicly reachable and the navigation gate silently disappears. The spec said a probe should happen before frontend pages rely on the gate. The probe confirmed the bypass, and the owner chose to accept it.

## Decision Drivers
* A `wrangler dev` probe of `/profile` showed prerendered shells are served by the `ASSETS` binding and never reach `middleware.ts`.
* The shell carries no domain data. Every protected route class fetches its data client-side, after paint, with a Bearer JWT.
* An anonymous visitor sees an empty page either way.

## Considered Options
* Set `"run_worker_first": true` so the Worker fronts every request, including static assets (rejected).
* Treat prerendered protected shells as public-by-design and keep `run_worker_first` unset (chosen).

## Decision Outcome
Chosen option: "Prerendered protected route shells are public-by-design (Cloudflare serves static assets before the Worker/middleware runs, verified via `wrangler dev` probe); the JWT-gated API remains the sole real authorization boundary, not the navigation gate", because `run_worker_first` would front every static asset through the Worker for a purely cosmetic benefit (an anonymous visitor sees an empty shell either way, since data is never server-rendered).

### Consequences
* Good, because the Worker stays out of the hot path for static assets.
* Bad, because an anonymous visitor can load a protected shell directly. The probe returned 200 without authentication; the shell shows an empty page.
* Neutral, because the `middleware.ts` redirect to `/login` stays for on-demand routes as a navigation nicety, not a security control for prerendered routes.
* Neutral, because `app/wrangler.jsonc` keeps `run_worker_first` unset.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Review applies the decided model in `docs/architecture/07-Frontend/01-Rendering-Strategy.md`, which warns against treating the middleware redirect as a security boundary. The original check was the 2026-07-15 `wrangler dev` probe of `/profile` and a control request to `/login`.

## Pros and Cons of the Options
### Run the Worker first (`run_worker_first: true`)
* Good, because it would gate prerendered shells for anonymous visitors, a cosmetic benefit only.
* Bad, because the Worker would front every static asset request.

### Public-by-design shells
* Good, because the Worker stays out of the hot path for static assets.
* Good, because the JWT-gated API stays the single authorization boundary.
* Bad, because anonymous visitors can load protected shells.

## Evidence / More Information
Decided: 2026-07-15

* `docs/superpowers/specs/2026-07-14-scaffold-contract-alignment-design.md` (Problem, "design-correctness risk"; Decision 1): rebuilt Context and Considered Options.
* Commit `ed6158ae` (2026-07-15; `DECISIONS.md` row D97, `docs/architecture/07-Frontend/01-Rendering-Strategy.md` "Decided model"): rebuilt Decision Drivers, Consequences, Confirmation and Pros and Cons. The same commit adds `nodejs_compat` to `app/wrangler.jsonc`, an unrelated fix.
* Applied in: `docs/superpowers/specs/2026-07-15-login-page-design.md` (client auth gate, D98), `docs/superpowers/plans/2026-07-15-login-page.md`, `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md`.
