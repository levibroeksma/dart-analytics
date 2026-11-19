---
id: D0471
status: accepted
date: 2026-10-19
origin: contemporaneous
original-date:
tags: [context-system, gate, CI, deploy, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `db-rehearsal.yml` skips a PR whose only change is `app/package.json` unless dbmate or a `db:*` script moved

## Context and Problem Statement
#859. A dependency, version or script bump touches `app/package.json` on every push and cut a Neon branch from production for a PR that cannot change what the rehearsal proves; after D433 and D434 this was the largest avoidable Neon cost left in CI. The path filter cannot read file content, so the content comparison runs in a job that costs a runner minute and no Neon transfer.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`db-rehearsal.yml` gains a `gate` job (no Neon access) that `rehearse` needs. On `workflow_call` it outputs `run=true`. On `pull_request` it diffs the PR's base and head: any changed file other than `app/package.json` gives `run=true`; when `app/package.json` is the only change, it gives `run=true` only if `dependencies.dbmate`, `devDependencies.dbmate` or a script whose key starts with `db:` differs between base and head. Otherwise `rehearse` is skipped and the gate writes a note to the job summary. The `pull_request` paths filter is unchanged.".

### Consequences
a skipped required check reports as passing; if branch protection requires `rehearse` by name, a skipped job satisfies it. A change to `migrate:up`-relevant npm scripts outside the `db:` prefix would not trigger a rehearsal; none exist today. The merge-time rehearsal in `deploy.yml` is untouched. Left for a separate decision: a merge that rehearses twice (#860).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-19
