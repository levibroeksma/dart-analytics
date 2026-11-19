---
id: D0514
status: accepted
date: 2026-10-31
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, gate, CI, pre-commit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Rules are enforced at edit time; CLAUDE.md files keep rules, not history

## Context and Problem Statement
rules stated only in prose are checked after the fact, at commit or CI, when the cost of a fix is highest; a hook that runs the same gate on the proposed edit catches the break where it is made, and a lookup before a new file catches the copy before it exists. CLAUDE.md files load into every session or every touch of their directory, so their dated tails and history prose cost context on every turn while the decision ids already hold the why.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "(1) Two `PreToolUse` hooks declared in `.claude/settings.json` check work as it is written. `.claude/hooks/edit-gate.py` (Edit|Write) runs the matching gate scripts in their per-file mode (`CHECK_ROOT=<dir> bash scripts/check-X.sh <relpath>`) on the proposed content of an `app/src` `.astro`/`.ts` file and denies an edit that introduces a new violation; `.claude/hooks/reuse-lookup.py` (Write) shows Component Inventory rows and graph nodes matching a new file under `components/`, `lib/`, `modules/` or `types/` once per session before it is created. Both fail open. They sit beside the D513 rule of three (`scripts/check-dupes.sh` ratchet, `.claude/rules/reuse.md`). (2) Owner-approved, one time only: every `CLAUDE.md` is stripped of dated provenance parentheticals (`(YYYY-MM-DD…)`, `(… Dxxx …)` tails, issue numbers) and of prose that states history or rationale rather than a rule. Every rule and invariant stays; a bare D-id cited inside a rule stays. Root `CLAUDE.md` keeps the migration carve-out (condensed to the rule plus "`0001`–`0046` closed to edits") and the worktree rules (condensed), since path-scoped rules do not survive `/compact`. (3) `docs/CLAUDE.md` editing step 1 and `context-maintenance` step 2 say: grep `00-File-Inventory.md` for the row, Read with offset/limit, never read it whole. Spec: `docs/superpowers/specs/2026-10-29-edit-time-rules-design.md` §4.".

### Consequences
this is an exception to the root invariant "Minimal diffs; validate and fix docs with targeted edits — never regenerate them", granted for this one pass; that invariant is unchanged and binds every later edit, so a new rule enters a `CLAUDE.md` without a dated tail and its provenance lives in `decisions/**`. No gate script reads the tails (checked: `check-context-budget.sh`, `check-agent-mirrors.sh`, `check-doc-links.sh`, `check-context-map.sh`, `.claude/hooks/context-drift.sh`). Total `CLAUDE.md` size fell from 48,323 to 44,046 bytes (root 13,056 → 10,410). The edit-time hooks do not replace the pre-commit and CI gates, which stay authoritative.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-31
