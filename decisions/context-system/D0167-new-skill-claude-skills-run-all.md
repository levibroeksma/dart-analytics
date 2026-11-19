---
id: D0167
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, docs, skill, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New skill `.claude/skills/run-all-gates/SKILL.md` dispatches the right `check-*.sh`

## Context and Problem Statement
Which gate applies to a given change was previously a memory burden; this makes it a lookup, and gives `verification-before-completion` a concrete command to point at

## Decision Drivers
* The spec wants `verification-before-completion` to have a concrete command that proves a claim.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "New skill `.claude/skills/run-all-gates/SKILL.md` dispatches the right `check-*.sh` scripts and `validate:app`/database checklist by changed area (`app/`, `database/`, `docs/`) and reports each result explicitly", because Which gate applies to a given change was previously a memory burden; this makes it a lookup, and gives `verification-before-completion` a concrete command to point at.

### Consequences
* Good, because the `context-maintenance` skill's step 5 invokes `run-all-gates` and no longer restates the script list.
* Bad, because the `database/` checklist in `database/CLAUDE.md` stays a manual pass, as the plan notes it is not fully mechanized.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.claude/skills/run-all-gates/SKILL.md` exists today. The plan's Task 12 requires a dry run of every command the skill lists against the current tree.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 7.1, § 8): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 12, the D167 row): rebuilt Consequences and Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28): added the skill.
