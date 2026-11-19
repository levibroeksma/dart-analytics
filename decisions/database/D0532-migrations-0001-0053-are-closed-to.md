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

# Migrations `0001`–`0053` are closed to in-place edits

## Context and Problem Statement
closes #1191. Migrations `0047`–`0053` reached production. Proof: `deploy` run 41235057275 (2026-10-31, `main` at 7fb1c12, after `0053` merged in #1157) ran the `migrate` job green, including "Confirm nothing is left pending".

## Decision Drivers
* The closed range in root `CLAUDE.md` stopped at `0046` while `0047`–`0053` had reached production (issue #1191).
* The D344 carve-out depends on this range plus `db:status` proof.

## Considered Options
* Leave the range at `0001`–`0046`.
* Extend it to `0001`–`0053` after a green production `migrate` run (chosen).

## Decision Outcome
Chosen option: "root `CLAUDE.md` names `0001`–`0053` as applied and closed to edits (was `0001`–`0046`). The D344 carve-out still governs anything later: unmerged and pending on both `db:status` and `db:status:prod`.".

### Consequences
an edit to `0047`–`0053` is now a new numbered migration. The range is still hard-coded and goes stale with each deployed migration; the next one to deploy extends it with the same proof.

### Confidence
Rationale unknown — no source found.

### Revisit When
The range is hard-coded and goes stale with each deployed migration; the next migration to deploy extends it with the same proof.

### Confirmation
Root `CLAUDE.md` states the range. Proof is the `deploy` run 41235057275, whose `migrate` job ran green including "Confirm nothing is left pending".

## Pros and Cons of the Options
### Leave the range at `0001`–`0046`
* Bad, because migrations `0047`–`0053` would look editable although they are applied.

### Extend the range to `0001`–`0053`
* Good, because an edit to `0047`–`0053` becomes a new numbered migration.
* Bad, because the range is hard-coded and goes stale with each deployed migration.

## Evidence / More Information
Decided: 2026-11-07

* Commit `3cdf283b` (2026-11-07, issue #1191; root `CLAUDE.md`, `00-Context-Map-History.md`): rebuilt Decision Drivers, Considered Options, Revisit When, Confirmation and Pros and Cons.
