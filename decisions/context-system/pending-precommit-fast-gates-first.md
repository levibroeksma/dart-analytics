---
id: pending
status: accepted
date: 2026-11-23
origin: contemporaneous
original-date:
tags: [hooks, gates, developer-experience]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Pre-commit runs test-coverage, type-barrels and dupes first; the type gate ends on its verdict

## Context and Problem Statement
The pre-commit runner stops at the first failing gate, yet the gates agents trip most ran last or not at all: `check-test-coverage.sh` sat near the end, and `check-dupes.sh` and `check-context-budget.sh` were CI-only, so a clone or a budget drift surfaced after a full hook cycle or at the end of a task (#1367). Separately, `npm run check` prints its error count several lines from the end, so a trimmed read reported a failing type gate as clean (#1323).

## Decision Drivers
* A failure should surface at the commit that causes it, in the fewest seconds.
* A gate's verdict must be its last line.

## Considered Options
* Reorder the table, add `check-dupes.sh` (about 1 s, scoped to `app/src/`) and `check-context-budget.sh` (about 1.5 s, scoped to the files it measures), and wrap the type gate in `scripts/check-types.sh`
* Keep both CI-only and add warnings to the skills
* Status quo

## Decision Outcome
Chosen option: "Reorder, add both gates scoped, wrap the type gate", because both gates run in seconds and the wrapper removes the misread instead of warning about it.

### Consequences
* Good, because clone and budget failures stop the commit that causes them.
* Good, because `check-types.sh`'s last line is `check: N errors, N warnings, N hints`.
* Bad, because a docs commit now pays about 1.5 s for the budget gate, and an `app/src/` commit about 1 s for dupes.
* Neutral, because the type gate stays out of pre-commit (about 45 s); `validate:app` and CI run it.

### Confidence
High — both gates were timed on 2026-11-23 and the scope fixture test covers the order.

### Revisit When
`check-dupes.sh` or `check-context-budget.sh` takes more than a few seconds.

### Confirmation
`scripts/test-precommit-scope.sh` (order and scoping), `scripts/test-check-types.sh`, `scripts/check-gate-wiring.sh`.

## Pros and Cons of the Options
### Reorder, add, wrap
* Good, because failures surface per commit.
* Bad, because every scoped commit pays a few seconds more.

## Evidence / More Information
Decided: 2026-11-23. Issues #1367 and #1323. Extends D551's path-scoped table.
