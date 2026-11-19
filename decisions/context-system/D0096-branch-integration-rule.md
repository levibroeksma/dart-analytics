---
id: D0096
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [context-system, gate, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Branch-integration rule

## Context and Problem Statement
2026-07-14 review found `main` ~50 commits stale with zero open PRs

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Branch-integration rule: task branches land on `main` via PR at task completion; divergence is a defect; completion gate item 7 verifies it", because 2026-07-14 review found `main` ~50 commits stale with zero open PRs.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Item 7 of the `context-maintenance` skill states the check today (step 7, "Branch/PR"). Commit `20e6a111` added it as completion-gate item 7 in root `CLAUDE.md`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* Commit `20e6a111` (2026-07-15; adds the D96 row, the Hard Invariants line and gate item 7): rebuilt Confirmation.
* Applied in: `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 4 P1), `docs/superpowers/plans/2026-07-22-hardening-first-deploy.md`.
