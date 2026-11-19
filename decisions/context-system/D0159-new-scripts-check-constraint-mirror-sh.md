---
id: D0159
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New `scripts/check-constraint-mirror.sh` requires every live `chk_*` CHECK constraint on

## Context and Problem Statement
Mechanizes D149 (constraints mirrored once, in the batch schema) the same way `check-refinement-coverage.sh` mechanizes refinement coverage — manifest-matched, not text-scanned

The 2026-07-28 spec lists D149's CHECK-constraint mirror rule among rules stated as binding that no build checks (§ 1).

## Decision Drivers
* A Zod bound can let a value through that a SQL `CHECK` rejects. That aborts the whole batch write transaction with a 500, not a `VALIDATION_FAILED` naming the record (plan Task 4, script header).
* D149 is prose with no gate (spec § 1).

## Considered Options
* Keep D149 as a prose rule (the state before this record).
* Require a `// MIRRORS: chk_x` anchor per constraint, plus a companion test that executes the boundary values (chosen).
* Check in the script that each Zod bound equals its `CHECK` expression numerically. The spec puts this out of scope (§ 3).

## Decision Outcome
Chosen option: "New `scripts/check-constraint-mirror.sh` requires every live `chk_*` CHECK constraint on `exercise_stages`/`turns`/`darts` to have a `// MIRRORS: chk_x` anchor comment in the shared batch schema (`app/src/pages/api/sessions/types.ts`); a companion `constraint-mirror.test.ts` executes the boundary agreement", because Mechanizes D149 (constraints mirrored once, in the batch schema) the same way `check-refinement-coverage.sh` mechanizes refinement coverage — manifest-matched, not text-scanned.

### Consequences
* Good, because the companion `constraint-mirror.test.ts` runs `safeParse` on the declared boundary values and asserts the schema agrees with the database constraint (spec § 5.2).
* Bad, because the script proves only that an anchor exists. It cannot show a bound is numerically identical to its `CHECK` expression (spec § 3, § 5.2).
* Neutral, because the required set covers constraints on `exercise_stages`, `turns` and `darts`, read from each migration's `migrate:up` region. A constraint a later `migrate:up` drops, such as `chk_turn_completed_after_created`, leaves the set (plan Task 4, Step 1).
* Neutral, because an anchor with no live constraint behind it also fails the script (plan Task 4, Step 2).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-constraint-mirror.sh` runs in the `structure` job of `.github/workflows/quality.yml` and `scripts/precommit-gates.tsv` lists it. `app/tests/pages/api/sessions/constraint-mirror.test.ts` carries the boundary check. Plan Task 4, Step 3 required the script to print 10 `FAIL` lines before the anchors existed.

## Pros and Cons of the Options
### Keep D149 as a prose rule
* Bad, because nothing fails a build when the rule is violated (spec § 1).

### Anchor comments plus a companion test
* Bad, because it proves an anchor exists, not that the bound matches. The companion test covers only the declared boundary values (spec § 5.2).

### Numeric bound equality in the script
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 3, § 5.2): rebuilt Context, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 4): rebuilt Decision Drivers, Consequences and Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28; adds the script, the test and the `quality.yml` step): confirmed the wiring named in Confirmation.
