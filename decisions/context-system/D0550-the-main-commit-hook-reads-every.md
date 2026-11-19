---
id: D0550
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system, CI, husky, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The main-commit hook reads every command form; quality CI runs on stacked PRs; spent ledger-split scripts are removed

## Context and Problem Statement
the hook saw only commands starting the string or following `;&|`, so `git add .` then `git commit` on the next line, `git -C . commit` and `(git commit)` passed on `main`; a newline also did not end a push segment, so `gh pr create --base main` on the next line was read as a push target. A stacked PR, which the repo allows one deep, ran no quality job. The split scripts ran once on 2026-08-02, refuse to run again and were wired nowhere.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "(1) `.claude/hooks/block-main-commit.py` treats a newline and `(` as command boundaries and allows `-C <dir>` / `-c <k=v>` between `git` and the subcommand; `scripts/test-block-main-commit.sh` holds 11 cases and runs in the `quality / structure` job. (2) `checks.yml` and `integration.yml` drop `pull_request: branches: [main]`, so a PR targeting a task branch runs the same jobs. (3) `scripts/__pycache__/` is untracked and ignored; all `scripts/*.sh` are mode 755. (4) `scripts/split-decisions.sh`, `scripts/verify-decision-split.sh` and `scripts/decision-front-matter.txt` are deleted; `scripts/decision-map.txt` and `scripts/decision-row-hashes.tsv` stay because `check-decision-ids.sh` reads them.".

### Consequences
husky remains the second guard for commits; the hook is the only guard for the push form. Stacked PRs cost one more CI run each. The split's history is in git and in the decisions that describe it.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
