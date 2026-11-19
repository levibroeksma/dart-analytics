---
id: D0137
status: accepted
date: 2026-07-24
origin: contemporaneous
original-date:
tags: [database, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Local Neon env

## Context and Problem Statement
Neon CLI omits Astro `PUBLIC_` keys; deploy must not leave local `astro dev` on production

## Decision Drivers
* The Neon CLI omits the Astro `PUBLIC_` keys (the ledger row's rationale).
* A deploy must not leave local `astro dev` pointed at production (the ledger row's rationale).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Local Neon env: `npm run env:dev` / `env:prod` pull branch vars into `.env` / `.env.production` and mirror `PUBLIC_NEON_AUTH_BASE_URL`; `npm run dev` runs `env:dev` first; never pull `main` into `.env`", because Neon CLI omits Astro `PUBLIC_` keys; deploy must not leave local `astro dev` on production.

### Consequences
* Good, because the local environment file always comes from the `dev` branch and carries the mirrored `PUBLIC_NEON_AUTH_BASE_URL`.
* Neutral, because `npm run dev` runs `env:dev` first, and the `main` branch is pulled only into the production file by `env:prod`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/package.json` defines `env:dev`, `env:prod` and a `dev` script that runs `env:dev` before `astro dev`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-24

* Commit `67ac28e7` (2026-07-24, "update DECISIONS.md with new architectural decision D134"): adds the row under id D134; rebuilt Decision Drivers and Consequences from the row text.
* Commit `50ab6e0e` (2026-07-24, "renumber Neon env decision to D137 (resolve duplicate D134)"): renumbers the row to D137; no text change.
* Applied in: `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md` (Out of scope: `env:dev` and `env:mirror` may still need `PUBLIC_NEON_AUTH_BASE_URL`).
