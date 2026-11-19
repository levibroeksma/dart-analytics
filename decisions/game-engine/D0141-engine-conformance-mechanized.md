---
id: D0141
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Engine conformance mechanized

## Context and Problem Statement
D105/D110/D127 precedent: the same engine defect class recurred across four PRs, and a `superRefine` was silently lost during a schema consolidation while its tests were repointed and stayed green (review P4)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Engine conformance mechanized: `scripts/check-game-engines.sh` fails when an `*.engine.module.ts` exports no `*EngineFactory`, never calls `registerEngineFactory`, or names a `rulesetVersionKey` with no validator in `services/rulesets/registry.ts`; `scripts/check-refinement-coverage.sh` plus `refinement-contract.ts` bind every ruleset-schema refinement to executed boundary probes — with its blind spots (delete-both edits, undeclared boundaries, refinements outside `types.ts`, floor-side weakening masked by a redundant field-level bound) stated in both files rather than implied".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26
