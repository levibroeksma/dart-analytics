---
id: D0532
status: accepted
date: 2026-11-07
origin: contemporaneous
original-date:
tags: [database, migration]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Migrations `0001`–`0053` are closed to in-place edits

## Context and Problem Statement
closes #1191. Migrations `0047`–`0053` reached production. Proof: `deploy` run 41235057275 (2026-10-31, `main` at 7fb1c12, after `0053` merged in #1157) ran the `migrate` job green, including "Confirm nothing is left pending".

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "root `CLAUDE.md` names `0001`–`0053` as applied and closed to edits (was `0001`–`0046`). The D344 carve-out still governs anything later: unmerged and pending on both `db:status` and `db:status:prod`.".

### Consequences
an edit to `0047`–`0053` is now a new numbered migration. The range is still hard-coded and goes stale with each deployed migration; the next one to deploy extends it with the same proof.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-07
