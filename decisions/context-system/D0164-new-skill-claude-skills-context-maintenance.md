---
id: D0164
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New skill `.claude/skills/context-maintenance/SKILL.md` holds the 8-step Context

## Context and Problem Statement
Procedure prose was loaded on every session regardless of relevance; skills load on demand

## Decision Drivers
* Always-loaded `CLAUDE.md` files carry multi-step procedures, which costs context budget on every task whether or not the procedure is relevant (`docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` § 1).

## Considered Options
* New standalone `context-maintenance` skill (chosen; spec § 2).
* Fold the procedure into `finishing-a-development-branch` (spec § 2 lists this as not chosen).
* Keep the procedure in the always-loaded root `CLAUDE.md` (status quo; spec § 1).

## Decision Outcome
Chosen option: "New skill `.claude/skills/context-maintenance/SKILL.md` holds the 8-step Context Maintenance procedure verbatim; root `CLAUDE.md`/`AGENT.md` keep only the invariant and a pointer to the skill", because Procedure prose was loaded on every session regardless of relevance; skills load on demand.

### Consequences
* Good, because the root `CLAUDE.md` Context Maintenance section shrinks to the invariant plus a pointer (spec § 7.1), and the spec expects measurably lower root word counts (spec § 10).
* Neutral, because step 5 of the skill invokes `run-all-gates` instead of restating the script list (spec § 7.1).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-skill-pointers.sh` fails when a `.claude/skills/*/SKILL.md` has no row in `docs/architecture/00-File-Inventory.md`. It checks registration only; it does not prove this decision.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 2, § 7.1, § 10): rebuilt Decision Drivers, Considered Options, Consequences.
* Commit `1351996f` (PR #56, 2026-07-28; adds `.claude/skills/context-maintenance/SKILL.md`): rebuilt Confirmation.
