---
id: D0439
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [api, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# X01 checkout folds count undecodable-snapshot sessions in `skippedSessions`

## Context and Problem Statement
a ruleset schema change that invalidated stored configs would zero those sections for the affected sessions with no signal, while every `stepsLoad` section already reports the skip (#855).

## Decision Drivers
* A session that never stored a snapshot has lost nothing to drift, so it is not counted (Section Catalog note added by commit `623bab05`).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`sessionCheckoutVisits` marks each session `undecodable` when its stored snapshot exists but `snapshotOf` cannot decode it. `foldLoad` returns `{ sessions, skippedSessions }`, and a `foldHandler` threads the count into the response for `ladder-progress`, `checkout-rate`, `double-performance`, `checkout-path`, `bust-rate` and `leg-stats`. A session with no stored snapshot is not counted.", because a ruleset schema change that invalidated stored configs would zero those sections for the affected sessions with no signal, while every `stepsLoad` section already reports the skip (#855).

### Consequences
no schema or contract change; `skippedSessions` was already optional on these responses. `SessionCheckoutVisits` gains a required `undecodable` boolean. The statistics cards for these sections do not yet show a notice.

* Neutral, because a session with no stored snapshot is not counted. Nothing was lost to drift (Section Catalog note, commit `623bab05`).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/modules/stats/x01-checkout-sessions.module.test.ts` asserts that `sessionCheckoutVisits` sets `undecodable` on a session whose snapshot does not decode. `tests/services/statistics.service.test.ts` asserts that such a session counts as skipped and that a fully decodable batch reports zero skipped sessions.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-09
Supersedes: none (extends D370).

* Commit `623bab05` (2026-10-09, #877; adds the D439 row, the Section Catalog note and the module and service tests): rebuilt Decision Drivers, Confirmation and Consequences.
