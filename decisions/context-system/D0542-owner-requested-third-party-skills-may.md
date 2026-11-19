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
<!-- backfill: pending -->

# Owner-requested third-party skills may be vendored; a Stop hook's commit request counts as asking

## Context and Problem Statement
`/retro` was installed at project level, which contradicted "holds only this repo's own skills". A Stop hook asked for a commit and push while the invariant said not to commit unless asked; the session had to guess which one governed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "root `CLAUDE.md` still bars vendoring plugin skills into `.claude/skills/`, but allows third-party skills the owner asked to install, each with a File Inventory row naming its source commit. A Stop hook that asks the session to commit and push counts as the user asking: the session commits on the task branch and pushes to it. Amends the Superpowers Skills paragraph and the commit invariant; D311 stands for plugin skills.".

### Consequences
vendored copies carry no drift check, so upstream changes land unobserved, the failure D311 recorded for plugin skills; the source commit in the inventory row is the only provenance. A Stop hook can now trigger a commit without a typed request, so a hook that asks for one must come from the owner's own settings.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-09
