---
id: D0544
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, CI, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Completed work always ends in a PR; the commit invariant no longer waits for a request

## Context and Problem Statement
the invariant said not to commit unless asked while `finishing-a-dart-branch` said to push and open a PR every time; the owner had to ask for the PR on a finished task. Separately, a fix pushed while CI ran woke the session with failures of the head it had just replaced.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "root `CLAUDE.md` drops "do not commit unless the user asks". A completed task is committed on its branch, pushed and opened as a PR without being asked, then watched until CI is fully green on the current head and unsubscribed (D540). `finishing-a-dart-branch` § Step 4 gains one line: a `check_run` event whose `head_sha` is not the branch HEAD is superseded, so the session waits for the run on the current head. Amends D542's commit invariant and the brainstorming exception, which are folded into the one finishing rule.".

### Consequences
a session commits and pushes finished work with no typed request; the branch rules (dedicated branch, never `main`, never `--no-verify`) are unchanged. Historical plans under `docs/superpowers/plans/` still say "do not commit unless the user asks"; they are non-canonical and left as written.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Root `CLAUDE.md` states that completed work ends in a PR without being asked, and `.claude/skills/finishing-a-dart-branch/SKILL.md` carries the "Judge a failure by its head" line about `check_run` events.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-10

* Commit `a0ca7490` (PR #1297, 2026-11-10; edits root `CLAUDE.md` and `finishing-a-dart-branch`, adds the D544 row): rebuilt Confirmation; source of the Context and Consequences text.
