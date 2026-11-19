---
id: D0165
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, gate, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New skill `.claude/skills/validate-app/SKILL.md` holds the `validate:app` sequence and

## Context and Problem Statement
Same context-budget rationale as D164, scoped to `app/` tasks

## Decision Drivers
* The `validate:app` sequence is duplicated in the always-loaded `CLAUDE.md` files (`docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` § 1).

## Considered Options
* New standalone `validate-app` skill (chosen; spec § 7.2).
* Keep the full sequence in `app/CLAUDE.md` (status quo; spec § 1).

## Decision Outcome
Chosen option: "New skill `.claude/skills/validate-app/SKILL.md` holds the `validate:app` sequence and mid-task gate condition; `app/CLAUDE.md`/`AGENT.md` keep only the bare command and a pointer", because Same context-budget rationale as D164, scoped to `app/` tasks.

### Consequences
* Good, because `app/CLAUDE.md`'s Validation Standard Procedure section shrinks to the bare command plus a pointer to the skill (spec § 7.2).
* Neutral, because the skill also states the mid-task condition: after touching services, repositories, middleware or shared-client code, run `npx fallow` and `npm run check` before claiming that sub-step done (spec § 7.2).

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

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 7.2): rebuilt Decision Drivers, Considered Options, Consequences.
* Commit `1351996f` (PR #56, 2026-07-28; adds `.claude/skills/validate-app/SKILL.md`): rebuilt Confirmation.
