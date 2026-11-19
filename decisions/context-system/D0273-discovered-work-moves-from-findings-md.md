---
id: D0273
status: accepted
date: 2026-09-13
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, gate, husky, pre-commit, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0214
superseded-by:
---
<!-- backfill: pending -->

# Discovered work moves from `FINDINGS.md` to GitHub issues

## Context and Problem Statement
`FINDINGS.md`'s append-then-delete high-water-mark log had no duplicate detection, no cross-referencing, no assignment, and no state beyond Open/Raised — every one of which GitHub issues already provide for free. The file's own gate (`check-findings-log.sh`) could only prove shape (front matter, field completeness, id uniqueness, live evidence paths); it could never prove an agent logged instead of fixed, the same limitation D214 already named as unfixable by any script. A companion gate (`check-plan-findings-closure.sh`/its `PostToolUse` hook) existed solely to keep a plan's "Closes FINDINGS.md F\<id\>" claim honest — a problem that disappears entirely once closure is "the GitHub issue is closed," a state GitHub already tracks natively.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`FINDINGS.md` and its three support scripts (`scripts/check-findings-log.sh`, `scripts/check-plan-findings-closure.sh`, `scripts/check-plan-findings-closure-hook.sh`) are deleted, along with their wiring in `.husky/pre-commit`, `.claude/settings.json`, and `.github/workflows/quality.yml`. Anything an agent notices that its task was not asked to change is now filed as a GitHub issue (`discovered-work` label plus one `type:*` and one `severity:*` label) per the new `.claude/skills/capturing-discovered-work/SKILL.md`, mirrored for human use by `.github/ISSUE_TEMPLATE/discovered-work.yml`. D214's underlying rule is unchanged: never fixed in the same pass, always surfaced, acting on one needs explicit user permission and its own task/branch. The 31 findings open at the time of this decision (F15–F94) were migrated verbatim to GitHub issues #280–#310, preserving their Claim/Evidence/Impact/Proposed content under the new skill's Problem/Why It Matters/Proposed Fix headings.".

### Consequences
the per-session context floor drops by `FINDINGS.md`'s own ~12.1k tokens (never loaded by a task, so the floor effect is on `00-File-Inventory.md`'s row list, not the always-loaded root `CLAUDE.md`, whose one-line invariant is now slightly longer instead). The record moves outside the repository: reading "what's currently open" now means querying GitHub (`label:discovered-work`) rather than opening one file, a real cost traded for issue search, labels, and cross-linking the flat file had no way to offer. Historical citations of `FINDINGS.md`/specific `F<id>`s already written into accepted `decisions/**` blocks, `08-DartBot.md`'s append-only version-history log, and existing code comments are left exactly as they were — they are provenance for decisions already made, not pointers into a mechanism that still needs to resolve. `app/CLAUDE.md`'s pre-commit gate count drops from 14 to 13.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-13
Supersedes: D214
