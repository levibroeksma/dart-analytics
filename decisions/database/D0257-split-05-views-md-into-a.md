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

# Split `05-Views.md` into a directory; general stat views expose raw facts only

## Context and Problem Statement
A single `05-Views.md` growing indefinitely as more analytics views ship was the same problem D184's context-system split solved elsewhere — per-domain catalogs scale better than one file. The two new views' consumption layer (stat-card computation, approximation rules) is deliberately out of scope for this work and is being designed separately by the user. Win-rate was scoped out entirely — it needs session-replay-from-persisted-facts, which doesn't exist for any engine yet; see `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`. The general statistics design spec (§ on win-rate, status note dated 2026-09-06) records why win-rate was split into its own follow-up plan.

## Decision Drivers
* One `05-Views.md` growing with every analytics view repeats the problem D184 solved for the context system.
* The consumption layer is designed separately, so the views expose facts only.
* A QUICK_SCORE dart count cannot be known, so approximating it would produce a real-looking but fake number.

## Considered Options
* Split `05-Views.md` into a directory with per-domain catalogs, and expose raw facts only (chosen).
* Compute win-rate in this work. The spec splits it into a follow-up plan, because it needs session replay from persisted facts that no engine has.

## Decision Outcome
Chosen option: "`05-Views.md` became `05-Views/` (`00-Overview.md` + `01-General-Views.md`, future `02-X01-Views.md` etc.) so per-domain view catalogs don't all pile into one growing file. Migrations `0025`/`0026` add `v_player_visit_facts`/`v_player_leg_facts`, exposing row-level facts only (real dart counts, configured maxes) — no stat-card computation, no application module.".

### Consequences
`v_player_leg_facts` narrows its own population (excludes any leg where a turn lacks real dart rows) rather than approximating an unknowable QUICK_SCORE dart count, the same precedent as `v_dart_analytics`'s target/zone filter. No API endpoint, repository, or UI reads either view yet.

* Good, because per-domain catalogs scale better than one file.
* Good, because `v_player_leg_facts` narrows its own population instead of approximating a dart count, the same precedent as `v_dart_analytics`.
* Neutral, because no API endpoint, repository or UI reads either view yet.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The statistics plan creates `database/verification/0025_player_visit_facts_view_checks.sql` (Task on migration `0025`) and a matching script for `0026`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-06

* `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md` (status note, population and filtering rules, `05-Views` directory split): rebuilt Context and Decision Drivers.
* `docs/superpowers/plans/2026-09-06-general-statistics-views.md` (Task 1 and the `0025`/`0026` tasks): rebuilt Confirmation.
* Commit `9dcbc8a6` (2026-09-06; adds the D257 row in `decisions/database.md`): rebuilt Context and Consequences.
