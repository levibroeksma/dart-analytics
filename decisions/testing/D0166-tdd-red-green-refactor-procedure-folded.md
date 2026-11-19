---
id: D0166
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [testing, test, TDD, Vitest, test location]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# TDD red→green→refactor procedure folded into the existing project-local

## Context and Problem Statement
Same principle (evidence before claims) already lived in that skill; folding avoids a third near-duplicate procedure skill. The 2026-07-28 spec finds the TDD red→green→refactor steps duplicated in always-loaded `CLAUDE.md` files, which costs context budget on every task whether or not the procedure applies.

## Decision Drivers
* A procedure lives once, in an on-demand skill, not in always-loaded `CLAUDE.md` files.
* Avoid a third near-duplicate procedure skill.

## Considered Options
* Fold the procedure into the existing `verification-before-completion` skill (chosen).
* A new standalone TDD procedure skill, which the record calls a third near-duplicate.

## Decision Outcome
Chosen option: "TDD red→green→refactor procedure folded into the existing project-local `verification-before-completion` skill as a Dart-Analytics addendum; `app/CLAUDE.md`/`AGENT.md`'s TDD section keeps only the non-procedural rules (test location, Vitest-only mocks, `.astro` inline-logic exemption D101)", because Same principle (evidence before claims) already lived in that skill; folding avoids a third near-duplicate procedure skill.

### Consequences
* Good, because `app/CLAUDE.md` keeps only the non-procedural TDD rules, and a pointer to the skill replaces its 5 numbered steps.
* Neutral, because the skill gains a "Dart Analytics: red→green→refactor" section with the 5-step cycle and the Vitest commands.
* Neutral, because the `AGENT.md` mirrors update identically.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's success criteria (§ 10) require the root `CLAUDE.md` and `app/CLAUDE.md` word counts to drop measurably.

## Pros and Cons of the Options
### Fold into `verification-before-completion`
* Good, because the same principle (evidence before claims) already lives in that skill.

### New standalone TDD skill
* Bad, because it is a third near-duplicate procedure skill.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 7.3, § 10): rebuilt Context, Decision Drivers, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (the `DECISIONS.md` step for D166): rebuilt Considered Options and Pros and Cons from the D166 row.
* Commit `1351996f` (PR #56, 2026-07-28): confirmed the skill edit and doc trims landed.
