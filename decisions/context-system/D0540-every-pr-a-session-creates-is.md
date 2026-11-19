---
id: D0540
status: accepted
date: 2026-11-09
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, gate, CI, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Every PR a session creates is watched from creation

## Context and Problem Statement
`finishing-a-dart-branch` made the subscription conditional on the harness and left the session to offer it after the fact, so whether a PR was watched depended on someone asking; a red CI run or a review comment on an unwatched PR waits on a person. The harness already makes a PR the session created "yours to drive"; a subscription is what delivers the events that duty needs.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "a session subscribes to a PR it creates (`subscribe_pr_activity`) in the same step that opens it. While it is subscribed, every gate or test failure is fixed and pushed until CI is fully green on the current head; the session then unsubscribes. Root `CLAUDE.md` Hard Invariants carry the rule; `finishing-a-dart-branch` § Step 4 carries the procedure and drops its "where the harness offers" condition. A harness without the tool is named in the completion report.".

### Consequences
green CI ends the watch, so a review comment or a failure that arrives later is not heard unless the owner asks; this narrows the harness default, which keeps a PR subscribed until it merges or closes. The session no longer asks whether to watch. Events on a watched PR wake the session, so a long-running session pays for each wake. This rule's own change ships on a fresh branch off `origin/main`, not stacked on a feature branch.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Root `CLAUDE.md` Hard Invariants carry the rule, and `.claude/skills/finishing-a-dart-branch/SKILL.md` carries the procedure under its "Watch it from creation" bullet.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-09

* Commit `b6e3744f` (2026-11-09; edits `finishing-a-dart-branch` and root `CLAUDE.md`, adds the D540 row): rebuilt Confirmation; source of the Context and Consequences text.
