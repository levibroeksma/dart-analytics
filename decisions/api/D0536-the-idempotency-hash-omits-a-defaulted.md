---
id: D0536
status: accepted
date: 2026-11-08
origin: contemporaneous
original-date:
tags: [api, idempotency, batch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The idempotency hash omits a defaulted `kept: false`; replay also accepts the hash that kept it

## Context and Problem Statement
#1155. After migration `0051` the parsed batch always carried `kept: false`, so a retry of a batch stored before that deploy hashed differently and failed with `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`. Records stored since then hold the with-defaults hash, so dropping it would repeat the failure in the other direction.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Leave a defaulted `kept: false` out of the hash, and accept both the old and new hash on replay.
* Hash the with-defaults payload only, which fails retries of batches stored before the deploy.
* Drop the with-defaults hash, which repeats the failure for records stored since migration `0051`.

## Decision Outcome
Chosen option: "`hashBatchPayload` leaves a turn's `kept` out when it is `false`, so a batch hashes the same whether or not the client sends the field. `appendBatch` accepts a stored hash equal to either that hash or `hashBatchPayloadWithDefaults` (the parsed batch with every default).".

### Consequences
new records store the hash without defaults. A later schema default is handled the same way: omit it from the hash. The with-defaults comparison can go once no such record can still be retried.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/session.service.test.ts` holds "hashes a turn without kept the same as one with the default kept: false" and "returns the stored result when the stored hash kept the default fields".

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-08

* Commit `db893504` (PR #1282, 2026-11-08; closes #1155): rebuilt Considered Options and Confirmation; source of the split-copied Context and Consequences. The PR body lists the red-first tests.
