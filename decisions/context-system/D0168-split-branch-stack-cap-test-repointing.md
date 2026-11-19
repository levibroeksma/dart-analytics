---
id: D0168
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Split `branch-stack-cap`/`test-repointing-heuristic` out of `checks.yml` into new

## Context and Problem Statement
`checks.yml`'s original `branches: [main]` filter meant both PR-state jobs only ran for PRs targeting `main`, so `branch-stack-cap` could never evaluate a PR targeting a stacked non-main branch — the exact D147 incident shape — making the root `CLAUDE.md` claim that D147 is "mechanically enforced on every PR" false (final whole-branch review)

## Decision Drivers
* The review of PR #56 found the `branch-stack-cap` trigger unreachable in its original `checks.yml` placement (PR #56 body, Verification).
* Root `CLAUDE.md` says D147 is "mechanically enforced on every PR", so the job has to run on every PR.

## Considered Options
* Keep both jobs in `checks.yml` under its `branches: [main]` filter (the original placement).
* Move both jobs to a new `pr-gates.yml` with an unfiltered `pull_request` trigger (chosen).

## Decision Outcome
Chosen option: "Split `branch-stack-cap`/`test-repointing-heuristic` out of `checks.yml` into new `.github/workflows/pr-gates.yml` with an unfiltered `pull_request: types: [opened, synchronize, reopened]` trigger; `checks.yml` keeps only the `quality` job on `branches: [main]`. Also dropped `--depth=1` from the test-repointing job's `git fetch` (it grafted the base tip as parentless, breaking the three-dot diff once `main` advanced past the branch point)".

### Consequences
* Neutral, because root `CLAUDE.md` names the `branch-stack-cap` job in `.github/workflows/pr-gates.yml` as the enforcement of the stacked-branch cap.
* Neutral, because PR #56 says both jobs were verified by hand-tracing the `github-script` logic against scenarios. It calls for a first-run confirmation on a real PR.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`.github/workflows/pr-gates.yml` holds `branch-stack-cap` and `test-repointing-heuristic`, and its `pull_request` trigger has no `branches` filter. `.github/workflows/checks.yml` holds only the `quality` job. The `pr-gates.yml` trigger also lists the `edited` type, which the decision text omits.

## Pros and Cons of the Options
### Both jobs in `checks.yml`
* Bad, because the `branches: [main]` filter means `branch-stack-cap` never evaluates a PR that targets a stacked non-main branch.

### New `pr-gates.yml` with an unfiltered trigger
* Good, because the jobs fire regardless of the PR's target branch (PR #56 body, Changes).

## Evidence / More Information
Decided: 2026-07-28

* Commit `1351996f` (PR #56, 2026-07-28; adds `.github/workflows/pr-gates.yml` and the PR body's Changes and Verification sections): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Moves the jobs that D162 and D163 added.
