---
id: D0162
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New `checks.yml` job `branch-stack-cap` fails a PR whose base branch is itself the head

## Context and Problem Statement
Mechanizes D147 (at most one open branch may target another) against live PR state, which a local script cannot see reliably

The spec lists the stacked-branch cap (D147) as a rule stated as binding with no gate behind it. Its incident was a 4-deep stack, `main` ← #41 ← #42 ← #43 ← #48.

## Decision Drivers
* The D147 cap had no mechanism, and the incident was caught only in PR review.
* The check needs remote PR state, which a local script cannot see reliably.

## Considered Options
* A local `scripts/*.sh` check (not chosen: it cannot see remote PR state reliably).
* A CI job that reads open PRs through GitHub (chosen).

## Decision Outcome
Chosen option: "New `checks.yml` job `branch-stack-cap` fails a PR whose base branch is itself the head of another open PR targeting a non-default branch", because Mechanizes D147 (at most one open branch may target another) against live PR state, which a local script cannot see reliably.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The job `branch-stack-cap` exists in `.github/workflows/pr-gates.yml` today. The plan's Task 7 put it in `checks.yml` and read open PRs through `actions/github-script@v7`. The spec's success criteria require the job to fire correctly on a real PR before the design counts as done.

## Pros and Cons of the Options
### A local script
* Bad, because it cannot see live remote PR state reliably.

### A CI job reading open PRs
* Good, because it reads live PR state.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 2, § 6.1, § 10): rebuilt Context, Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 7, the D162 row): confirmed the job and row text.
* Commit `1351996f` (PR #56, 2026-07-28): added the job.
