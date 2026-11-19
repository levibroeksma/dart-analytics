---
id: D0221
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [api, endpoint, batch, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0061
superseded-by:
---
<!-- backfill: pending -->

# `POST /api/sessions` accepts an ordered `participants[]`

## Context and Problem Statement
D61 deferred guest participants as an explicitly additive `participants[]`; this delivers exactly that shape. The guards live in the service rather than in the Zod schema because two of them depend on the ruleset being created, which the request schema cannot see, and splitting them across both layers would put the rules in two places.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The create-session request gains an optional `participants[]` of `{ participantTypeKey: "PLAYER" | "GUEST", displayName?, sideKey }`. Array order IS seat order — it decides who throws first in leg 1. The service mints one participant row per entry in the same transaction as the session, copies the `PLAYER`'s `displayName` from `players.display_name` (ignoring any client-supplied value), and composes the resulting refs into the configuration snapshot's `seats`. Omitting the field reproduces the single-`PLAYER` session exactly. `session-seats.service.ts` is the single place cross-field agreement is asserted, before any write: 1–4 seats, exactly one `PLAYER`, every guest named, one seat per `sideKey`, and more than one seat only for `501_V1`.".

### Consequences
`insertSessionRecords` takes a participant array in place of its four single-participant fields and returns `{ sessionId }` only. Duplicate guest display names are deliberately allowed — seats are identified by ref, not name, and refusing them would reject valid input. The one-seat-per-side guard is what stops 2v2 preparation from silently half-working: `sideKey` and per-side folding exist, the pairing does not. The events batch endpoint is unchanged; a turn's `participantRef` may now simply vary within one batch, which `validateBatchReferences` already allowed.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-21
