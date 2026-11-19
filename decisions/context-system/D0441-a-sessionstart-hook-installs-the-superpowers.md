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

# A `SessionStart` hook installs the superpowers plugin in cloud sessions

## Context and Problem Statement
D311 makes the plugin the sole source of the `superpowers:` skills the root `CLAUDE.md` pairs with this repo's own, and `enabledPlugins` declares it, but a fresh cloud container has no plugins installed, so those skills were absent until someone installed them by hand.

## Decision Drivers
* Local sessions already have the plugin, so the hook skips them (script comment in commit `2f616ad4`).
* Re-running the install on an installed plugin must be a no-op (the same script comment).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`.claude/settings.json` registers a `SessionStart` hook running `.claude/hooks/session-start.sh`. In a cloud session (`CLAUDE_CODE_REMOTE=true`) it runs `claude plugin install superpowers@claude-plugins-official` unless `claude plugin list` already shows it; elsewhere it exits at once. Synchronous, idempotent, plugin install only.".

### Consequences
cloud sessions start with the plugin installed; skills it adds may load only from the next session start. Local sessions are untouched. The hook installs no app dependencies; that stays a separate choice.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.claude/hooks/session-start.sh` exits at once unless `CLAUDE_CODE_REMOTE` is `true`, and it skips the install when `claude plugin list` already shows `superpowers@claude-plugins-official`.

## Pros and Cons of the Options
* Good, because local sessions skip the hook and the install is idempotent.

## Evidence / More Information
Decided: 2026-10-10

* Commit `2f616ad4` (2026-10-10; adds `.claude/hooks/session-start.sh` and the D441 row): rebuilt Decision Drivers, Confirmation and Pros and Cons from the script comments; source of the Context and Consequences text.
