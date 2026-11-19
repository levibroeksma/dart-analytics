---
id: D0398
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `highestCheckout` carries the session id of its first hit (#638)

## Context and Problem Statement
completes #638 after D397 covered best leg. The overview is not a versioned section, so no section version bump applies; the field is additive and nullable. First hit wins a tie to match D397's tie rule.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`StatisticsOverviewResponse.highestCheckout` gains `sessionId: string | null` (UUID): the session of the first visit, in `v_x01_checkout_darts` row order, that finished at the highest value. `highestCheckout()` accepts visits with an optional `sessionId` and returns `null` there when none carries one; the overview builds its visits with the new `checkoutVisitsWithSession()`, which tags each visit with its session. The `stats` store exposes `highestCheckoutSessionId`.".

### Consequences
no card renders the career overview's highest checkout today, so nothing links to replay yet; the store field is ready for one. Other record-style metrics have no session id and none is added here.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/stores/stats.store.test.ts` asserts `highestCheckoutSessionId`. `app/tests/services/statistics.service.test.ts` and `app/tests/pages/api/statistics/overview.test.ts` cover the overview response shape.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-03
Supersedes: none (extends D397).

* Commit `14c4cbc7` (2026-10-03, issue #638; adds the D398 row, store field and tests): rebuilt Confirmation.
