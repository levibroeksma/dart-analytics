---
id: D0567
status: accepted
date: 2026-11-22
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, branch, PR, issues]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Issue fixes may share one branch, one commit per issue

## Context and Problem Statement
Root `CLAUDE.md` required a dedicated branch per task. A cloud session may push only to its one assigned branch, so a session working through the issue list (PR #1375: #1369, #1374, #1332) had to bundle unrelated fixes against the rule.

## Decision Drivers
* A cloud session cannot push a second branch.
* Each fix stays reviewable and revertable on its own.

## Considered Options
* Issue fixes may share a branch, one commit per issue
* One task per session, then stop
* Status quo: dedicated branch per task, no exception

## Decision Outcome
Chosen option: "Issue fixes may share a branch, one commit per issue", because it lets one session clear several issues while each fix stays a single commit that closes its issue and can be reverted alone. Other tasks keep a dedicated branch.

### Consequences
* Good, because one session can work through the issue list in one PR.
* Bad, because a PR mixing unrelated fixes is larger to review, and one blocked fix holds the others back.
* Neutral, because issues that one fix closes together (a bug and the gate preventing it) share that one commit.

### Confidence
High — owner's choice in the session that hit the limit.

### Revisit When
A bundled PR is held back by one of its fixes, or cloud sessions can push several branches.

### Confirmation
Review: each commit on a bundled branch names the issue it closes (`Closes #n`).

## Pros and Cons of the Options
### One task per session, then stop
* Good, because PRs stay single-purpose.
* Bad, because each issue costs a new session.

## Evidence / More Information
Decided: 2026-11-22. Retro of the session behind PR #1375.
