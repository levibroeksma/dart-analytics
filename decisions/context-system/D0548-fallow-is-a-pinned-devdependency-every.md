---
id: D0548
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system, gate, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# fallow is a pinned devDependency; every gate runs the installed binary

## Context and Problem Statement
`npx fallow` took the newest release on each run, so the gate's rules changed without a commit; `check-dupes.sh` pinned 3.38.0, which reported 0 clone groups where 3.42.0 reported 3, so the ratchet passed while clones existed.

## Decision Drivers
* The plan's goal: every fallow run uses one pinned version, the clone ratchet sees the clones that exist, and the config holds no stale row.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`fallow` is an exact-version devDependency of `app/` (3.42.0). `scripts/fallow-gate.sh` and `scripts/check-dupes.sh` call `npx --no-install fallow`. A fallow upgrade is its own PR: bump the pin, rerun `bash scripts/check-dupes.sh` and the fallow gate, and re-read `validate-app/references/fallow-scoring.md` if `health_score.formula_version` changed.".

### Consequences
the three clone groups are folded and `scripts/dupes-baseline.txt` stays empty; without `app/node_modules` both scripts fail instead of downloading. `app/.fallowrc.jsonc` loses its stale `thresholdOverrides` and four `ignoreDependencies` rows and names `neon` in `ignoreBinaries`.

### Confidence
Rationale unknown — no source found.

### Revisit When
The decision text says a fallow upgrade is its own PR: bump the pin, rerun `bash scripts/check-dupes.sh` and the fallow gate, and re-read `validate-app/references/fallow-scoring.md` if `health_score.formula_version` changed.

### Confirmation
`app/package.json` pins `fallow` at `3.42.0`, and `scripts/fallow-gate.sh` and `scripts/check-dupes.sh` call `npx --no-install fallow`. The plan's review focus says `npx --no-install` with `node_modules` absent must fail loudly rather than download.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-10

* `docs/superpowers/plans/2026-11-10-quality-1-fallow-pin-and-hygiene.md` (Goal, Architecture, Review Focus, Task 1): rebuilt Decision Drivers.
* Commit `3f1413d7` (2026-11-10; edits `fallow-scoring.md` and adds the D548 row): rebuilt Revisit When and Confirmation; source of the Context and Consequences text.
