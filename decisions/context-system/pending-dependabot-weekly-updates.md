---
id: pending
status: accepted
date: 2026-11-20
origin: contemporaneous
original-date:
tags: [context-system, CI, workflow, dependencies, security]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Dependencies update weekly through Dependabot; Claude reviews breaking updates

## Context and Problem Statement
Nothing kept `app/` npm packages or the GitHub Actions in `.github/workflows/` up to date. Every PR runs the full CI set, so an update tool that opens many PRs a day would multiply CI runs. The owner wants a 48-hour buffer before a release reaches a PR, an exception for CVE fixes, and an impact check before a breaking update is merged. Everything must stay on free tiers.

## Decision Drivers
* Free tier only: no pay-per-use cost.
* Commits must pass `main`'s verified-signature rule (D289).
* A release younger than 48 hours does not reach a PR; a CVE fix does.
* A breaking update carries an impact review before the owner looks at it.
* No bot may push, approve or merge.

## Considered Options
* A. Dependabot + a Claude review workflow
* B. Renovate app + the same Claude review workflow
* C. A scheduled Claude job that finds and applies updates
* Status quo: no automated updates

## Decision Outcome
Chosen option: "A. Dependabot + a Claude review workflow", because it is native to GitHub, free, and its commits are signed by GitHub, so they pass the signature rule without a bypass actor.

`.github/dependabot.yml` runs weekly (Monday 06:00 Europe/Amsterdam) for npm in `/app` and github-actions in `/`, with `cooldown.default-days: 2`, at most 5 open PRs, and minor+patch grouped per ecosystem. Majors arrive one per PR. Dependabot security updates run outside the schedule and skip the cooldown. `.github/workflows/dependency-review.yml` runs on Dependabot PRs; when `scripts/dependency-review-select.sh` finds a semver-major update or a minor bump of a 0.x version, `anthropics/claude-code-action` posts 1 impact comment. The job has `contents: read` and `pull-requests: write` only, and authenticates with the owner's Claude plan token (Dependabot secret `CLAUDE_CODE_OAUTH_TOKEN`), never an API key.

### Consequences
* Good, because update PRs arrive once a week, so CI runs once per batch instead of once per release.
* Good, because a breaking update carries its changelog impact before review.
* Bad, because Dependabot's rules are coarser than Renovate's: 0.x minor bumps stay grouped with patches and need the selector script to be flagged.
* Bad, because the review depends on a personal plan token; if the plan lapses or the token expires, the review job fails on every breaking PR.
* Neutral, because the owner still merges every PR by hand.

### Confidence
Medium — Dependabot's `cooldown` and the action's bot handling were checked against their docs and source on 2026-11-20, but the review path is unproven until a real Dependabot PR runs it.

### Revisit When
* A pay-per-use cost appears, or the plan token stops working in CI.
* Dependabot drops or changes `cooldown`.
* The owner needs finer rules (per-package schedules, auto-merge).

### Confirmation
`scripts/check-dependabot-config.sh` (pre-commit and `quality.yml`) fails when `.github/dependabot.yml` or `.github/workflows/dependency-review.yml` drifts from these values; `scripts/test-check-dependabot-config.sh` proves each rule on a mutated copy.

## Pros and Cons of the Options
### A. Dependabot + a Claude review workflow
* Good, because it is free and native, with signed commits.
* Bad, because its rules are less fine-grained.

### B. Renovate app + the same Claude review workflow
* Good, because it has finer rules, a dashboard issue, and can treat 0.x minors as breaking.
* Bad, because it needs a third-party app with write access, and its commit signing was unconfirmed.

### C. A scheduled Claude job that finds and applies updates
* Good, because one tool does everything.
* Bad, because it uses the Claude plan every week and rebuilds what the bots already do.

### Status quo
* Good, because nothing changes.
* Bad, because vulnerable dependencies stay until someone notices.

## Evidence / More Information
Decided: 2026-11-20

* Spec: `docs/superpowers/specs/2026-11-19-dependency-updates-design.md`.
* Plan: `docs/superpowers/plans/2026-11-20-dependency-updates.md`.
* Branch: `chore/dependabot-updates`.
* Storing the token needs the co-one Security Officer's approval before setup.
