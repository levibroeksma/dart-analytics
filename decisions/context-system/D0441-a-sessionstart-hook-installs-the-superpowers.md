---
id: D0441
status: accepted
date: 2026-10-10
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A `SessionStart` hook installs the superpowers plugin in cloud sessions

## Context and Problem Statement
D311 makes the plugin the sole source of the `superpowers:` skills the root `CLAUDE.md` pairs with this repo's own, and `enabledPlugins` declares it, but a fresh cloud container has no plugins installed, so those skills were absent until someone installed them by hand.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.claude/settings.json` registers a `SessionStart` hook running `.claude/hooks/session-start.sh`. In a cloud session (`CLAUDE_CODE_REMOTE=true`) it runs `claude plugin install superpowers@claude-plugins-official` unless `claude plugin list` already shows it; elsewhere it exits at once. Synchronous, idempotent, plugin install only.".

### Consequences
cloud sessions start with the plugin installed; skills it adds may load only from the next session start. Local sessions are untouched. The hook installs no app dependencies; that stays a separate choice.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-10
