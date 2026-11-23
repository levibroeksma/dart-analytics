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

# Rules are enforced at edit time; CLAUDE.md files keep rules, not history

## Context and Problem Statement
rules stated only in prose are checked after the fact, at commit or CI, when the cost of a fix is highest; a hook that runs the same gate on the proposed edit catches the break where it is made, and a lookup before a new file catches the copy before it exists. CLAUDE.md files load into every session or every touch of their directory, so their dated tails and history prose cost context on every turn while the decision ids already hold the why.

## Decision Drivers
* Agents drift from repo rules: they skip the reuse check and use forbidden forms such as `x-bind:`. The rules reach the agent at the wrong moment, and gate scripts run at the end, after the agent builds on the violation.
* Per-task loads, not the session baseline, are the lever for token cost. `00-File-Inventory.md` is 200 KB (about 50k tokens), and `docs/CLAUDE.md` step 1 and `context-maintenance` step 2 send agents to it.
* The spec's anti-goals: hooks slower than 1 s per edit, blocks with no way out, a second definition of a rule, and long hook output.

## Considered Options
* Keep enforcing rules only at gate time (`run-all-gates`, CI), as described in Context.
* Run the gate scripts as blocking `PreToolUse` hooks on `Edit|Write`, add a reuse lookup before new files, and strip history from `CLAUDE.md` files (chosen).
* Mass-migrate nested `CLAUDE.md` files into `.claude/rules/` (the spec rejects this: directory-scoped files already load lazily).

## Decision Outcome
Chosen option: "(1) Two `PreToolUse` hooks declared in `.claude/settings.json` check work as it is written. `.claude/hooks/edit-gate.py` (Edit|Write) runs the matching gate scripts in their per-file mode (`CHECK_ROOT=<dir> bash scripts/check-X.sh <relpath>`) on the proposed content of an `app/src` `.astro`/`.ts` file and denies an edit that introduces a new violation; `.claude/hooks/reuse-lookup.py` (Write) shows Component Inventory rows and graph nodes matching a new file under `components/`, `lib/`, `modules/` or `types/` once per session before it is created. Both fail open. They sit beside the D513 rule of three (`scripts/check-dupes.sh` ratchet, `.claude/rules/reuse.md`). (2) Owner-approved, one time only: every `CLAUDE.md` is stripped of dated provenance parentheticals (`(YYYY-MM-DD…)`, `(… Dxxx …)` tails, issue numbers) and of prose that states history or rationale rather than a rule. Every rule and invariant stays; a bare D-id cited inside a rule stays. Root `CLAUDE.md` keeps the migration carve-out (condensed to the rule plus "`0001`–`0046` closed to edits") and the worktree rules (condensed), since path-scoped rules do not survive `/compact`. (3) `docs/CLAUDE.md` editing step 1 and `context-maintenance` step 2 say: grep `00-File-Inventory.md` for the row, Read with offset/limit, never read it whole. Spec: `docs/superpowers/specs/2026-10-29-edit-time-rules-design.md` §4.".

### Consequences
this is an exception to the root invariant "Minimal diffs; validate and fix docs with targeted edits — never regenerate them", granted for this one pass; that invariant is unchanged and binds every later edit, so a new rule enters a `CLAUDE.md` without a dated tail and its provenance lives in `decisions/**`. No gate script reads the tails (checked: `check-context-budget.sh`, `check-agent-mirrors.sh`, `check-doc-links.sh`, `check-context-map.sh`, `.claude/hooks/context-drift.sh`). Total `CLAUDE.md` size fell from 48,323 to 44,046 bytes (root 13,056 → 10,410). The edit-time hooks do not replace the pre-commit and CI gates, which stay authoritative.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's success criteria: writing `x-bind:` in an `.astro` file is refused before it lands, creating a new component, helper or type shows existing matches first, and root `CLAUDE.md` is measurably smaller with invariants intact. `.claude/hooks/edit-gate.py`, `.claude/hooks/reuse-lookup.py` and `.claude/rules/reuse.md` exist today.

## Pros and Cons of the Options
### Keep enforcing rules only at gate time
* Bad, because the checks run at commit or CI, after the agent has built on the violation, when a fix costs the most.

### Edit-time hooks plus slimmer `CLAUDE.md` files
* Good, because the hook denies an edit that introduces a new violation at the point of the edit, and the agent fixes and retries in the same step.
* Good, because the reuse lookup shows existing matches before a new file exists.
* Bad, because edits made through Bash (a heredoc, `sed -i`) bypass the hooks. The spec accepts this gap and keeps gate-time checks as the backstop.

### Mass-migrate nested `CLAUDE.md` files into `.claude/rules/`
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-31

* `docs/superpowers/specs/2026-10-29-edit-time-rules-design.md` (Intent, Goals, Anti-goals, § 1, § 2, § 4, Success; owner answers folded in 2026-10-30): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Commit `ad3c3615` (PR #1163, 2026-10-31; adds the D514 row and the hooks): source of the Context and Consequences text.
