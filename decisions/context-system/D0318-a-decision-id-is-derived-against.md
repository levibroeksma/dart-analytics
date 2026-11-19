---
id: D0318
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, gate, CI, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A decision id is derived against `origin/main`, and re-derived before the PR opens

## Context and Problem Statement
issue #386 reported PRs #381 and #382 each declaring an id that `main` had since issued to a different decision, and asked whether the check belongs pre-merge. It already is: `check-decision-ids.sh` runs from `quality.yml` on every `pull_request` to `main`, and `actions/checkout` resolves that event to the merge ref, so the uniqueness check already sees branch and `main` combined — which is how both collisions surfaced. The gap was never a missing gate; it was that both ids were correct when derived and stale by the time they landed, and that renumbering meant hand-editing every citation across `CLAUDE.md`, `00-File-Inventory.md`, `.gitignore` comments and the PR body.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/next-decision-id.sh` derives the next free id against fetched `origin/main` as well as the working tree, counting as taken the ids that plans under `docs/superpowers/plans/` reserve before their block exists, and `context-maintenance` step 3 requires re-running it immediately before opening a PR. `DECISIONS.md`'s "How to add a decision" names the script as the derivation, keeping the raw `git grep` visible as what it runs. A collision caught late is fixed with `scripts/renumber-decision.sh`, which refuses only the rewrite that would touch `main`'s own block — the id being live on `main` is the case it exists for. No new CI job is added.".

### Consequences
two branches in flight can still derive the same id — nothing local can see an unmerged branch's ledger. That race stays the CI gate's job; what changes is that fixing it is one command instead of a manual sweep. The ledger stays append-only: a renumbered id is the same block under a free number, never an edit to someone else's decision.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
