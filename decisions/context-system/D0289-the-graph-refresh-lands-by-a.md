---
id: D0289
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, CI, branch, PR, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The graph refresh lands by a human merge; a bot cannot satisfy required signatures

## Context and Problem Statement
measured on PR #379. `enablePullRequestAutoMerge` succeeded and the PR still reported "Merging is blocked — Commits must have verified signatures": the `Main branch protection` ruleset (active since 2026-07-10) carries `required_signatures`, `GET /pulls/379/commits` returns `verified: false, reason: "unsigned"` for the `github-actions[bot]` commit, and the ruleset's only bypass actor is the repository owner. D287 recorded the SQUASH pin as making auto-merge work once armed; that inference was wrong, and it was wrong in the direction D287 itself warned against — a decision block overstating automation. Approval was never the blocker, so the earlier framing ("needs one approval") misattributed the cost.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`graph.yml` no longer arms auto-merge on the refresh PR. It rebuilds, force-pushes `chore/graph-refresh`, opens or updates the PR, writes a notice naming the PR, and stops there; the PR body states that landing it is a manual merge and why. Root `CLAUDE.md`'s freshness bullet says the same. The `required_signatures` rule is not relaxed, the bot is not added as a bypass actor, and no signing key is introduced for CI.".

### Consequences
landing a refresh is one deliberate merge by a bypass actor, which is what already happened for PRs #368, #374 and #379 — the change is that the workflow and the docs now say so instead of advertising an automation that cannot complete. Three alternatives were weighed and rejected: an SSH signing key in Actions secrets (a private key to hold and rotate, for one saved click); `createCommitOnBranch`, which GitHub signs itself but would carry a 7.2 MB `graph.json` base64-encoded through GraphQL; and adding the bot as a bypass actor, which is per-ruleset rather than per-rule and would also exempt it from the pull-request and linear-history requirements. The 403 fallback from D287 is untouched: a PR that cannot be opened at all still files a tracking issue, and that remains the case this mechanism actually needs to catch.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
Refines: D287
