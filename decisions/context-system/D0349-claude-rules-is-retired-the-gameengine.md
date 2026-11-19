---
id: D0349
status: accepted
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, skill, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0316
superseded-by:
---
<!-- backfill: pending -->

# `.claude/rules/` is retired; the `GameEngine` contract moves to a directory `CLAUDE.md`

## Context and Problem Statement
`.claude/rules/*.md` with a `paths:` glob frontmatter is not a Claude Code mechanism — it is a Cursor convention (`.cursor/rules/*.mdc`) that was carried into this repo by an earlier session. D316's own text already flagged the weakness of its evidence: the cited probe rested on `strings` finding the identifiers `.claude/rules`, `claudeMdExcludes` and `InstructionsLoaded` in the installed binary, which D316 itself calls "not evidence of semantics," and on a marker-file read/no-read comparison that a stale or coincidental context load explains just as well as a real path-scoped loader. No Claude Code documentation describes `.claude/rules/` as a loading mechanism. D316's own Consequences paragraph names the fallback this decision now takes — "rehoming the contract into `app/src/modules/game/CLAUDE.md` and accepting the duplication the glob avoided" — and states it "went unused"; there is no duplication to accept, since `app/src/modules/training/exercises/` already carries its own carve-out in a sibling directory's `CLAUDE.md` (D264), so a directory guide scoped to `app/src/modules/game/` needs no glob to exclude it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.claude/rules/game-engines.md` is deleted. Its content — the `GameEngine` contract — becomes `app/src/modules/game/CLAUDE.md`, with the mandatory `AGENT.md` pointer stub alongside it, matching the six existing directory guides under `app/`. `.claude/rules/` no longer exists in the tree.".

### Consequences
`app/src/modules/game/CLAUDE.md` joins the seven directory guides under `app/` as an eighth; `app/CLAUDE.md`'s existing `app/src/**/CLAUDE.md` pointer already covers it, so that row needs no edit. `scripts/check-skill-pointers.sh`'s `.claude/rules/*.md` registration check and `scripts/check-doc-links.sh`'s scan of the same tree now iterate zero entries — inert, not broken, the same state they were in before D316 created the directory. Nothing else in the repo references `.claude/rules/` as a live mechanism; the remaining hits are historical design docs (`docs/superpowers/plans/2026-09-18-path-scoped-rules.md`, `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md`, `docs/braindump/agent-context-hardening.md`) left as point-in-time records per their own `historical` status, not rewritten.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-21
