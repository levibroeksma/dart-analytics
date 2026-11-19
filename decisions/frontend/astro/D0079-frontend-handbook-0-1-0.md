---
id: D0079
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/astro, prerender]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Frontend handbook 0.1.0

## Context and Problem Statement
Honest adapter model; fast shells
The frontend had no handbook for rendering strategy (prerender versus SSR versus server islands). Without one, agents and developers would invent inconsistent patterns during the first frontend build pass. The design spec adopts prerender-default, not global `output: 'static'`, as handbook 0.1.0's first rule.

## Decision Drivers
* Without rendering rules, the first frontend build pass would produce inconsistent patterns.

## Considered Options
* Prerender-default: `output: 'server'` with per-route `export const prerender = true` (chosen).
* Global `output: 'static'`. The spec rejects it and does not give the reason.

## Decision Outcome
Chosen option: "Frontend handbook 0.1.0: prerender-default on Cloudflare (`output: 'server'` + per-route prerender)", because Honest adapter model; fast shells.

### Consequences
* Good, because the ledger row credits the model with fast shells.
* Neutral, because app pages carry `export const prerender = true` unless the SSR opt-in table lists them, and `pages/api/**` stays on-demand.
* Neutral, because SSR (`prerender = false`) is allowed only for server-only env or secrets in HTML, per-request headers that change markup, or a route listed as an exception in `01-Rendering-Strategy.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Review applies `docs/architecture/07-Frontend/01-Rendering-Strategy.md`, which holds the route classes and the closed SSR opt-in list. `app/astro.config.mjs` sets `output: "server"`.

## Pros and Cons of the Options
### Prerender-default (`output: 'server'` + per-route prerender)
* Good, because prerendered shells load fast (ledger row).

### Global `output: 'static'`
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Problem, Decision 1, Decision 1b, the D79 ledger row): rebuilt Context, Decision Drivers, Considered Options, Consequences and Confirmation.
* Commit `238fdbc1` (2026-07-14, adds the D79 row and handbook 0.1.0): confirmed the origin.
* `docs/superpowers/specs/2026-07-14-scaffold-contract-alignment-design.md` (Problem item 5, Decision 1) and `docs/superpowers/plans/2026-07-14-scaffold-contract-alignment.md`: record that `app/astro.config.mjs` lacked `output: 'server'` and that the plan adds it per D79. Rebuilt Confirmation.
* Related: D97 (public-by-design shells) corrects the spec's claim that middleware runs before a prerendered shell is served.
