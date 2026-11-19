---
id: D0169
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, gate, Prettier, format, husky, pre-commit, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `.husky/pre-commit` gains `set -e`

## Context and Problem Statement
Prettier failures no longer blocked commits, silently regressing D136's "catch format issues at commit" guarantee (final whole-branch review)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`.husky/pre-commit` gains `set -e`; previously its two top-level statements were not `&&`-joined, so a failing `npx lint-staged` did not stop the hook and the hook's exit code was only the final structural-gate chain's", because Prettier failures no longer blocked commits, silently regressing D136's "catch format issues at commit" guarantee (final whole-branch review).

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.husky/pre-commit` line 2 holds `set -e` today.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-28

* Commit `1351996f` (PR #56, 2026-07-28; adds `set -e` to `.husky/pre-commit`): rebuilt Confirmation.
