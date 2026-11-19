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
<!-- backfill: pending -->

# The idempotency hash omits a defaulted `kept: false`; replay also accepts the hash that kept it

## Context and Problem Statement
#1155. After migration `0051` the parsed batch always carried `kept: false`, so a retry of a batch stored before that deploy hashed differently and failed with `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`. Records stored since then hold the with-defaults hash, so dropping it would repeat the failure in the other direction.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`hashBatchPayload` leaves a turn's `kept` out when it is `false`, so a batch hashes the same whether or not the client sends the field. `appendBatch` accepts a stored hash equal to either that hash or `hashBatchPayloadWithDefaults` (the parsed batch with every default).".

### Consequences
new records store the hash without defaults. A later schema default is handled the same way: omit it from the hash. The with-defaults comparison can go once no such record can still be retried.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-08
