---
id: D0147
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, branch, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a stacked-branch cap

## Context and Problem Statement
A four-deep stack (`main ← #41 ← #42 ← #43 ← #48`) caused merges to land child-into-parent instead of onto `main`, silently leaving `main` with only one of four engines (review P1)

## Decision Drivers
* A four-deep stack means any change to the first branch forces three rebases (review § 4, P1).
* Root `CLAUDE.md` and D96 say task branches land on `main` via PR at completion, and that long-lived divergence from `main` is a defect (review § 4, P1).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain a stacked-branch cap: at most one open task branch may target another task branch; a third stacked branch means the first must land or the work merges into one branch", because A four-deep stack (`main ← #41 ← #42 ← #43 ← #48`) caused merges to land child-into-parent instead of onto `main`, silently leaving `main` with only one of four engines (review P1).

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Root `CLAUDE.md` states the rule and names the `branch-stack-cap` job in `.github/workflows/pr-gates.yml` as its enforcement. The job fails a PR whose base branch is itself the head of an open PR that targets a non-default branch.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 4, P1): rebuilt Decision Drivers. The spec dates 2026-07-25 and says "four-deep stack, zero merges". It predates the merges the Context describes.
* Commit `cd464a3f` (2026-07-26; `DECISIONS.md` row D147 and the root `CLAUDE.md` diff): rebuilt Consequences.
* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 6.1) and `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 7): rebuilt Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28; adds `pr-gates.yml` and the root `CLAUDE.md` pointer): confirmed the enforcement named in Confirmation.
* Mechanized by D162 and moved by D168.
