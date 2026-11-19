---
id: D0213
status: accepted
date: 2026-08-19
origin: contemporaneous
original-date:
tags: [context-system, docs, context map, CLAUDE.md, gate, husky, pre-commit, PR, workflow, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The context map routes; it does not carry the record

## Context and Problem Statement
the map was 37.6k tokens and the root `CLAUDE.md` protocol opened it at the start of every task, while the packs it routes to budget 2–18k — the router cost 2–10x the payload. 28.5k of it (76%) was provenance: a single 75k-character version-history line, 57 rows describing point-in-time specs and plans, and drift-prone status prose. No gate ever wanted them — `check-context-map.sh` check 4 only requires top-level `docs/architecture/*.md` files be registered. The six `AGENT.md` files were byte-identical copies enforced identical by a gate, taxing every rule edit twice. The tool-allowance prose bound nothing: Claude Code enforces tool access through `.claude/settings.json`, and the prose was already contradicted by practice, restricting `mcp__github__*` in a repo whose workflow is issue-to-PR.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`00-Context-Map.md` is reduced to a router (context packs, authority order, maintenance protocol). The canonical file inventory moves to `00-File-Inventory.md`, loaded only when a pack falls short; version history, per-task `docs/superpowers/**` rows and Current Implementation State move to `00-Context-Map-History.md` (`status: historical`), which no task loads. `AGENT.md` stops mirroring `CLAUDE.md` and becomes a fixed pointer stub, with `scripts/check-agent-mirrors.sh` inverted to assert the stub. The `Tool Allowances & Restrictions` sections are deleted from all six `CLAUDE.md` files.".

### Consequences
the per-session context floor drops from ~39.3k to ~3.0k tokens. Nothing is deleted — every relocated token still exists in an unloaded file. Four gate scripts had to move with the split: `check-context-map.sh` registers against the inventory, `check-context-budget.sh` reads packs from the map and file rows from the inventory, `check-doc-links.sh` skips the path-backtick pass for `status: historical` documents (the carve-out `decisions/**` already had, for the identical reason), and `check-agent-mirrors.sh` asserts the stub instead of the mirror. No new gate script was created, so `.github/workflows/quality.yml` and `.husky/pre-commit` are unchanged. Future context growth lands in the history archive, which is written on every task and read on none. The graph rule in root `CLAUDE.md` — instructing agents to query a CLI that is absent from the session container — is knowingly left standing for a later change.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-19
