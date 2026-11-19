---
id: D0257
status: accepted
date: 2026-09-06
origin: contemporaneous
original-date:
tags: [database, view, replay]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Split `05-Views.md` into a directory; general stat views expose raw facts only

## Context and Problem Statement
A single `05-Views.md` growing indefinitely as more analytics views ship was the same problem D184's context-system split solved elsewhere — per-domain catalogs scale better than one file. The two new views' consumption layer (stat-card computation, approximation rules) is deliberately out of scope for this work and is being designed separately by the user. Win-rate was scoped out entirely — it needs session-replay-from-persisted-facts, which doesn't exist for any engine yet; see `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`05-Views.md` became `05-Views/` (`00-Overview.md` + `01-General-Views.md`, future `02-X01-Views.md` etc.) so per-domain view catalogs don't all pile into one growing file. Migrations `0025`/`0026` add `v_player_visit_facts`/`v_player_leg_facts`, exposing row-level facts only (real dart counts, configured maxes) — no stat-card computation, no application module.".

### Consequences
`v_player_leg_facts` narrows its own population (excludes any leg where a turn lacks real dart rows) rather than approximating an unknowable QUICK_SCORE dart count, the same precedent as `v_dart_analytics`'s target/zone filter. No API endpoint, repository, or UI reads either view yet.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-06
