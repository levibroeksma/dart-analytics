---
id: D0080
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/astro, nav]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Middleware protected-prefix allowlist

## Context and Problem Statement
HTML nav gate; extensible public list
HTML pages need a navigation gate. The handbook spec sets a middleware allowlist of protected prefixes: v1 public routes are `/login` only, and new page routes must be classified public or protected in `01-Rendering-Strategy.md`. Middleware guards navigation, not data. API auth stays Bearer JWT on `@client/api/` calls.

## Decision Drivers
* New page routes must be classified public or protected.
* The public list must be extensible later, for example for marketing pages.

## Considered Options
* Middleware protected-prefix allowlist, v1 public = `/login` only (chosen; the spec labels it I2-B).
* The spec does not list the other options it weighed.

## Decision Outcome
Chosen option: "Middleware protected-prefix allowlist; v1 public = `/login` only", because HTML nav gate; extensible public list.

### Consequences
* Good, because the public list is extensible (ledger row).
* Neutral, because v1 protected routes are `/games`, `/profile`, `/statistics`, `/` and every future app route not added to the public list.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Review applies the route-class rules in `docs/architecture/07-Frontend/01-Rendering-Strategy.md`. `app/tests/utils/route-class.test.ts` and `app/tests/middleware.test.ts` cover route classification and the middleware.

## Pros and Cons of the Options
### Protected-prefix allowlist
* Good, because the public list is extensible later.
* Good, because new routes default to protected until someone adds them to the public list.

### Other options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 2, the D80 ledger row, critique item I2): rebuilt Context, Decision Drivers, Considered Options and Consequences.
* Commit `238fdbc1` (2026-07-14, adds the D80 row and handbook 0.1.0): confirmed the origin.
* `docs/superpowers/specs/2026-07-14-scaffold-contract-alignment-design.md` (Problem item 4): the code gated `/profile` only, against D80's four protected prefixes. `docs/superpowers/plans/2026-07-14-scaffold-contract-alignment.md` classifies every other page as protected per D80.
* Related: D97 (prerendered shells bypass middleware, so the redirect is a navigation nicety, not a security control).
