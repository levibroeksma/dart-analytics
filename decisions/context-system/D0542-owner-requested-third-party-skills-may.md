---
id: D0542
status: accepted
date: 2026-11-09
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Owner-requested third-party skills may be vendored; a Stop hook's commit request counts as asking

## Context and Problem Statement
`/retro` was installed at project level, which contradicted "holds only this repo's own skills". A Stop hook asked for a commit and push while the invariant said not to commit unless asked; the session had to guess which one governed.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "root `CLAUDE.md` still bars vendoring plugin skills into `.claude/skills/`, but allows third-party skills the owner asked to install, each with a File Inventory row naming its source commit. A Stop hook that asks the session to commit and push counts as the user asking: the session commits on the task branch and pushes to it. Amends the Superpowers Skills paragraph and the commit invariant; D311 stands for plugin skills.".

### Consequences
vendored copies carry no drift check, so upstream changes land unobserved, the failure D311 recorded for plugin skills; the source commit in the inventory row is the only provenance. A Stop hook can now trigger a commit without a typed request, so a hook that asks for one must come from the owner's own settings.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Root `CLAUDE.md` today allows third-party skills the owner asked to install, each registered in the File Inventory with its source commit.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-09

* Commit `b9bdd6c0` (2026-11-09; edits root `CLAUDE.md`): rebuilt Confirmation.
