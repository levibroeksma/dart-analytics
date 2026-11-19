---
id: D0098
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [frontend/alpine, auth gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Client auth gate in `BaseLayout` (`auth.store` `init()` + `x-cloak`) is the load-bearing

## Context and Problem Statement
Prerendered shells bypass middleware on this Cloudflare config — client gate prevents nav chrome flash. The login-page spec requires that unauthenticated visitors to any protected route redirect to `/login` without app chrome flash. Real authorization stays at the API JWT boundary (D97).

## Decision Drivers
* Prerendered shells bypass middleware on the current Cloudflare configuration (D97).
* Visitors must not see nav chrome before the redirect (spec goal 2, B2).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Client auth gate in `BaseLayout` (`auth.store` `init()` + `x-cloak`) is the load-bearing navigation control for prerendered routes (D97); middleware redirect remains a UX nicety for on-demand routes only", because Prerendered shells bypass middleware on this Cloudflare config — client gate prevents nav chrome flash.

### Consequences
* Neutral, because middleware redirect stays as a UX nicety for on-demand routes only.
* Neutral, because `BaseLayout` keeps `x-cloak` and gates paint on `$store.auth.ready`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-15

* `docs/superpowers/specs/2026-07-15-login-page-design.md` (Problem, B2, BaseLayout markup, Anti-Patterns; proposed D98 ledger entry): rebuilt Context, Drivers and Consequences.
* Commit `2904b646` (2026-07-15, adds the D98 row and updates `07-Frontend/01-Rendering-Strategy.md`): confirmed the decision wording.
* Applied in: `docs/superpowers/plans/2026-07-15-login-page.md`, `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md`.
