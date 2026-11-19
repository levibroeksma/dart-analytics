---
id: D0160
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New `scripts/check-no-inline-comments.sh` fails on a `//` or non-JSDoc `/* */` comment

## Context and Problem Statement
The rule existed since app/CLAUDE.md's TypeScript comments section but was never mechanically checked; the gate's first real run caught real violations, confirming the prose-only gap

The 2026-07-28 spec lists the TypeScript inline-comment ban among rules stated as binding that no build checks (§ 1).

## Decision Drivers
* The inline-comment rule in `app/CLAUDE.md` had no mechanical check (spec § 1).
* A prototype run before the gate landed found 3 pre-existing violations of the rule (plan Task 5).

## Considered Options
* Keep the rule as prose in `app/CLAUDE.md` (the state before this record).
* A lexical script that tracks brace depth and flags comments inside function and method bodies (chosen).

## Decision Outcome
Chosen option: "New `scripts/check-no-inline-comments.sh` fails on a `//` or non-JSDoc `/* */` comment lexically inside a function/method body under `app/src/**/*.ts` (JSDoc `/**` above a declaration stays exempt, matching the existing "JSDoc above the declaration" rule); found and fixed 3 pre-existing violations (`register-stores.ts`, two in `score-training-setup.data.ts`) that had shipped under the same rule as prose only", because The rule existed since app/CLAUDE.md's TypeScript comments section but was never mechanically checked; the gate's first real run caught real violations, confirming the prose-only gap.

### Consequences
* Bad, because the script is a lexical heuristic, not an AST. A bare module-level block counts as non-function, and a module-level `switch (x) {` counts as a function body (plan Task 5, script header).
* Neutral, because `app/tests/` and `app/scripts/` stay out of scope, and `fallow-ignore-next-line` directives and `///` references are exempt (spec § 5.3).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-no-inline-comments.sh` runs in the `structure` job of `.github/workflows/quality.yml` and `scripts/precommit-gates.tsv` lists it. Plan Task 5, Step 6 required a fixture check: a `//` comment inserted into a function body in `register-stores.ts` must print `FAIL` and exit 1.

## Pros and Cons of the Options
### Keep the rule as prose
* Bad, because the rule was never mechanically checked (spec § 1).

### Lexical brace-depth script
* Bad, because its lexical heuristic has the blind spots named in Consequences.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 5.3): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 5): rebuilt Decision Drivers, Consequences and Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28; adds the script and the `quality.yml` step): confirmed the wiring named in Confirmation.
