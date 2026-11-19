---
id: D0163
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New `checks.yml` job `test-repointing-heuristic` posts a non-blocking PR comment when a

## Context and Problem Statement
Nudges human review toward D148's exact failure shape (a dropped constraint hidden behind a quietly repointed test) without hard-failing legitimate test updates

The 2026-07-28 spec decides the gate is a flag-only CI step and "not left prose-only" (§ 2).

## Decision Drivers
* D148's failure shape: a dropped constraint hid behind a test quietly re-pointed at a different input.
* Legitimate test updates also change assertion literals, so a hard gate would fail honest work (spec § 3, § 6.2).

## Considered Options
* Leave D148 as a prose rule. The spec decides against this (§ 2).
* A blocking version of the gate. The spec puts this out of scope (§ 3).
* A flag-only CI job that posts a non-blocking PR comment (chosen).

## Decision Outcome
Chosen option: "New `checks.yml` job `test-repointing-heuristic` posts a non-blocking PR comment when a changed `app/tests/**` assertion literal has no changed `describe`/`it` title in the same diff", because Nudges human review toward D148's exact failure shape (a dropped constraint hidden behind a quietly repointed test) without hard-failing legitimate test updates.

### Consequences
* Neutral, because the job is a directed nudge for human review, not a gate. Legitimate test updates trip it too (spec § 3, § 6.2).
* Neutral, because the job compares assertion literals (`.toBe(`, `.toEqual(`, `expect(...)` arguments, fixtures passed to `parse(`) with `describe` and `it` titles in the same file (spec § 6.2).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The `test-repointing-heuristic` job in `.github/workflows/pr-gates.yml` runs `scripts/check-test-repointing.sh` and posts or updates one PR comment. Its comment step sets `continue-on-error: true`. The spec says the job should fire correctly on a real PR before the design counts as done (§ 10).

## Pros and Cons of the Options
### Leave D148 as a prose rule
Rationale unknown — no source found.

### Blocking gate
* Bad, because legitimate test updates also trip the heuristic (spec § 3).

### Flag-only CI job with a PR comment
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 2, § 3, § 6.2, § 10): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 8): confirmed the job shape named in Consequences.
* Commit `1351996f` (PR #56, 2026-07-28; adds the job): source of the first version.
* Moved from `checks.yml` to `pr-gates.yml` by D168.
