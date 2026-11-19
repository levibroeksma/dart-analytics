---
id: D0136
status: accepted
date: 2026-07-24
origin: contemporaneous
original-date:
tags: [context-system, CI, Prettier, format, husky, pre-commit, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Prettier enforced locally via husky + lint-staged pre-commit (`app/` prepare → repo-root

## Context and Problem Statement
PRs were failing solely on format drift; catch at commit and before PR instead of only in CI

## Decision Drivers
* Unformatted or broken code must not reach production (spec § 1).
* Agents need a mandatory format step before creating or updating any PR, not only after multi-task plans (spec § 3).

## Considered Options
* CI-only `format:check`, as before this record (spec § 1; Context).
* A pre-commit hook plus mandatory agent and pre-PR format rules, with CI staying fail-only (chosen; spec § 2).
* CI jobs that run `prettier --write` or open format-fix PRs. The spec puts these out of scope (§ 3).

## Decision Outcome
Chosen option: "Prettier enforced locally via husky + lint-staged pre-commit (`app/` prepare → repo-root `.husky/`) and mandatory agent/pre-PR `npm run format` + clean `format:check`; CI remains fail-only `format:check` with no Actions auto-format", because PRs were failing solely on format drift; catch at commit and before PR instead of only in CI.

### Consequences
* Good, because the hook rewrites unformatted staged files at commit time (spec § 11).
* Neutral, because `app` is the only npm package. Its `prepare` script runs `cd .. && husky` on `npm install` and installs the hooks into the repo-root `.husky/` (spec § 10; plan Task 6).
* Neutral, because `app/CLAUDE.md` and `AGENT.md` gain the mandatory pre-PR format step (plan Task 6).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.husky/pre-commit` runs `npx lint-staged` in `app/` when `app/node_modules` exists. `app/package.json` configures `lint-staged` to run `prettier --write --ignore-unknown`. `app/CLAUDE.md` states the mandatory pre-PR `npm run format`, and `.github/workflows/quality.yml` runs `npm run format:check`.

## Pros and Cons of the Options
### CI-only `format:check`
* Bad, because PRs failed solely on format drift.

### Pre-commit hook plus agent rules
* Good, because it catches drift at commit and before PR instead of only in CI.

### CI auto-format or format-fix PRs
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-24

* `docs/superpowers/specs/2026-07-24-ci-production-deploy-design.md` (§ 1, § 2, § 3, § 10, § 11): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-24-ci-production-deploy.md` (Task 6): rebuilt Consequences.
* Commit `ffd957e7` (2026-07-24; adds the D136 row): no section rebuilt from it.
