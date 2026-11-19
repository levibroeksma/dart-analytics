---
id: D0148
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [testing, test, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a test-repointing rule

## Context and Problem Statement
A `superRefine` bounding `duration_value` was lost during a schema consolidation and its two tests were quietly re-pointed at a different invalid input so the suite stayed green, letting the dropped constraint reach review undetected until fixed the same day (commit `511f24b`). The commit that adds D148 records 3 rules from a game-engine PR review as root `CLAUDE.md` Hard Invariants: an engine state-shape proof, a stacked-branch cap, and this test-repointing rule.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a test-repointing rule: when a test's subject is removed or migrated, delete it or re-point it at the same guarantee, never at a different input just to keep it green; a green suite after a constraint is removed is a failure to detect, not evidence of safety".

### Consequences
* Neutral, because the rule enters the root `CLAUDE.md` and `AGENT.md` Hard Invariants, dated 2026-07-26.
* Neutral, because the 2026-07-28 spec keeps the heuristic non-blocking: legitimate test updates also trip it, so it is a nudge for human review.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Review applies the Hard Invariant. The non-blocking `test-repointing-heuristic` job in `.github/workflows/pr-gates.yml` flags changed test files where an assertion literal changed and no `describe`/`it` title did. It posts a PR comment and never fails the build.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-26

* Commit `cd464a3f` (2026-07-26; `DECISIONS.md` row D148 and the root `CLAUDE.md` diff): rebuilt Context and Consequences.
* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 2, § 3, § 6.2): rebuilt Consequences.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 8): rebuilt Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28; adds `.github/workflows/pr-gates.yml`): rebuilt Confirmation.
