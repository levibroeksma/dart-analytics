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

# Engine conformance mechanized

## Context and Problem Statement
D105/D110/D127 precedent: the same engine defect class recurred across four PRs, and a `superRefine` was silently lost during a schema consolidation while its tests were repointed and stayed green (review P4)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Engine conformance mechanized: `scripts/check-game-engines.sh` fails when an `*.engine.module.ts` exports no `*EngineFactory`, never calls `registerEngineFactory`, or names a `rulesetVersionKey` with no validator in `services/rulesets/registry.ts`; `scripts/check-refinement-coverage.sh` plus `refinement-contract.ts` bind every ruleset-schema refinement to executed boundary probes — with its blind spots (delete-both edits, undeclared boundaries, refinements outside `types.ts`, floor-side weakening masked by a redundant field-level bound) stated in both files rather than implied".

### Consequences
* Neutral, because the commit states Guard 2's fourth blind spot (floor-side weakening masked by a redundant field-level bound) in the `check-refinement-coverage.sh` header and in `refinement-contract.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-game-engines.sh` and `scripts/check-refinement-coverage.sh` run as steps in `.github/workflows/quality.yml`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-26

* Commit `8e46e453` (2026-07-26; adds D138-D144 and the Guard 2 blind-spot disclosure): rebuilt Consequences and Confirmation.
* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1): cites D141 with D113, D147, D148 and D149 as a rule written in prose and then violated. Applied in: that spec only.
