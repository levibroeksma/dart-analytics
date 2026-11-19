---
id: D0157
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CI, Prettier, husky, pre-commit, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `.husky/pre-commit` runs the 7 existing structural `check-*.sh` gates (file-locations

## Context and Problem Statement
These gates only ran in CI, after push; violations were caught in PR review instead of at commit time, same latency pattern D136 already fixed for Prettier

## Decision Drivers
* All 7 code-correctness gates ran only in CI, after push, while `.husky/pre-commit` ran only Prettier.
* Rule violations surfaced in PR review or post-merge audits, never before.

## Considered Options
* Keep the structural gates CI-only (the state before this record).
* Chain the 7 structural gates into `.husky/pre-commit` after lint-staged (chosen).

## Decision Outcome
Chosen option: "`.husky/pre-commit` runs the 7 existing structural `check-*.sh` gates (file-locations, agent-mirrors, astro-class-composition, astro-conventions, game-engines, refinement-coverage, type-barrels) in addition to Prettier lint-staged", because These gates only ran in CI, after push; violations were caught in PR review instead of at commit time, same latency pattern D136 already fixed for Prettier.

### Consequences
* Good, because the first failing gate stops the commit and prints its own `FAIL:` output.
* Neutral, because `check-context-map.sh`, `check-doc-links.sh` and `check-context-budget.sh` stay in CI and the `context-maintenance` skill. The spec treats them as doc-consistency checks.
* Neutral, because `git commit --no-verify` stays the escape hatch, caught by the unchanged CI backstop in `quality.yml`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec reports all 7 gates clean against the tree at design time. Today `.husky/pre-commit` runs `scripts/run-precommit-gates.sh`, which reads `scripts/precommit-gates.tsv`. That table lists all 7 gates, and `scripts/check-type-barrels.sh` runs only when a staged path matches its regex. `quality.yml` runs the gates in CI.

## Pros and Cons of the Options
### Keep the gates CI-only
* Bad, because violations surface after push, in PR review.

### Chain the gates into pre-commit
* Good, because a violation fails at commit time instead of in PR review.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 4, § 9): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 1, the D157 row): confirmed the wiring and row text.
* Commit `1351996f` (PR #56, 2026-07-28): wired the gates into pre-commit.
