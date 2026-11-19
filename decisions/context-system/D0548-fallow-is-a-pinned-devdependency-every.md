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
<!-- backfill: pending -->

# fallow is a pinned devDependency; every gate runs the installed binary

## Context and Problem Statement
`npx fallow` took the newest release on each run, so the gate's rules changed without a commit; `check-dupes.sh` pinned 3.38.0, which reported 0 clone groups where 3.42.0 reported 3, so the ratchet passed while clones existed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`fallow` is an exact-version devDependency of `app/` (3.42.0). `scripts/fallow-gate.sh` and `scripts/check-dupes.sh` call `npx --no-install fallow`. A fallow upgrade is its own PR: bump the pin, rerun `bash scripts/check-dupes.sh` and the fallow gate, and re-read `validate-app/references/fallow-scoring.md` if `health_score.formula_version` changed.".

### Consequences
the three clone groups are folded and `scripts/dupes-baseline.txt` stays empty; without `app/node_modules` both scripts fail instead of downloading. `app/.fallowrc.jsonc` loses its stale `thresholdOverrides` and four `ignoreDependencies` rows and names `neon` in `ignoreBinaries`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
