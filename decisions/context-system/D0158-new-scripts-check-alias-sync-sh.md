---
id: D0158
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New `scripts/check-alias-sync.sh` fails when `tsconfig.json`'s `compilerOptions.paths`

## Context and Problem Statement
Closes D113's exact failure mode (an alias declared in one config but not the other, invisible until a genuine non-mocked import breaks) with a standing gate instead of a one-off fix

The 2026-07-28 spec lists the alias-sync rule among rules stated as binding that no build checks (§ 1). `@icons` and `@layouts` were declared in `tsconfig.json` but absent from `vitest.config.ts` (plan Task 2).

## Decision Drivers
* D113 stays prose with no gate: "nothing fails a build if they're violated" (spec § 1).
* `@icons` and `@layouts` show real drift between the two config files (spec § 2, § 5.1).

## Considered Options
* Keep D113 as a prose rule with no gate (the state before this record).
* Add a script that diffs the alias keys and allowlists `@styles`, and add `@icons` and `@layouts` to `vitest.config.ts` (chosen).

## Decision Outcome
Chosen option: "New `scripts/check-alias-sync.sh` fails when `tsconfig.json`'s `compilerOptions.paths` and `vitest.config.ts`'s `resolve.alias` diverge (allowlisting `@styles` as CSS-only); `@icons`/`@layouts` added to `vitest.config.ts` to close the real gap the gate found", because Closes D113's exact failure mode (an alias declared in one config but not the other, invisible until a genuine non-mocked import breaks) with a standing gate instead of a one-off fix.

### Consequences
* Good, because the script runs at commit time and in CI, so alias drift fails before review (plan Task 3, Steps 4–5).
* Neutral, because `@styles` stays allowlisted: it is a CSS-only path that a `.ts` test cannot import (spec § 2, § 5.1).
* Neutral, because the script reads `vitest.config.ts` by regex scan of quoted keys, without executing it (spec § 5.1).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-alias-sync.sh` runs in the `structure` job of `.github/workflows/quality.yml` and `scripts/precommit-gates.tsv` lists it. Plan Task 3, Step 3 required a fixture check: deleting the `@icons` entry from `vitest.config.ts` must print `FAIL` and exit 1.

## Pros and Cons of the Options
### Keep D113 as a prose rule with no gate
* Bad, because nothing fails a build when the rule is violated (spec § 1).

### Alias-sync script plus the missing aliases
* Good, because adding the two missing aliases closes the real drift at the cost of two `path.resolve()` lines (spec § 5.1).

## Evidence / More Information
Decided: 2026-07-28

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1, § 2, § 5.1, § 9, § 10): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 2, Task 3): rebuilt Context and Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28; adds `scripts/check-alias-sync.sh`, the two aliases and the `quality.yml` step): confirmed the wiring named in Confirmation.
