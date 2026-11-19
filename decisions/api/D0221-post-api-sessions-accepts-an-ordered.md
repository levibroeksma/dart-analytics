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

# `POST /api/sessions` accepts an ordered `participants[]`

## Context and Problem Statement
D61 deferred guest participants as an explicitly additive `participants[]`; this delivers exactly that shape. The guards live in the service rather than in the Zod schema because two of them depend on the ruleset being created, which the request schema cannot see, and splitting them across both layers would put the rules in two places.

## Decision Drivers
* D61 deferred guest participants as an explicitly additive `participants[]`.
* 2 of the guards depend on the ruleset being created, which the request schema cannot see.
* The PLAYER entry's `display_name` must be copied server-side, because the `0005` CHECK requires exactly that.

## Considered Options
* Put the seat guards in the service (chosen).
* Split the guards across the Zod schema and the service.

## Decision Outcome
Chosen option: "The create-session request gains an optional `participants[]` of `{ participantTypeKey: "PLAYER" | "GUEST", displayName?, sideKey }`. Array order IS seat order — it decides who throws first in leg 1. The service mints one participant row per entry in the same transaction as the session, copies the `PLAYER`'s `displayName` from `players.display_name` (ignoring any client-supplied value), and composes the resulting refs into the configuration snapshot's `seats`. Omitting the field reproduces the single-`PLAYER` session exactly. `session-seats.service.ts` is the single place cross-field agreement is asserted, before any write: 1–4 seats, exactly one `PLAYER`, every guest named, one seat per `sideKey`, and more than one seat only for `501_V1`.".

### Consequences
`insertSessionRecords` takes a participant array in place of its four single-participant fields and returns `{ sessionId }` only. Duplicate guest display names are deliberately allowed — seats are identified by ref, not name, and refusing them would reject valid input. The one-seat-per-side guard is what stops 2v2 preparation from silently half-working: `sideKey` and per-side folding exist, the pairing does not. The events batch endpoint is unchanged; a turn's `participantRef` may now simply vary within one batch, which `validateBatchReferences` already allowed.
* Good, because the session, its participants and the snapshot share 1 transaction, so a rejected request leaves no half-built session.
* Good, because omitting `participants[]` reproduces today's single-`PLAYER` session exactly.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/session-seats.service.test.ts` and `app/tests/services/session.service.test.ts` exercise the seat guards. The spec lists every setup rejection and the omitted-`participants` path as `session.service.test.ts` cases.

## Pros and Cons of the Options
### Guards in the service
* Good, because the cross-field rules live in 1 place.

### Guards split across the Zod schema and the service
* Bad, because it would put the rules in 2 places.

## Evidence / More Information
Decided: 2026-08-21

* `docs/superpowers/specs/2026-08-20-guest-player-x01-design.md` (Context, Data Flow, Error Handling, Testing): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-08-20-guest-player-x01-implementation.md`: the implementation plan.
* Commit `20ca5b31` (2026-08-21, PR #152, adds the D221 row). Supersedes D61 (frontmatter).
* Applied in: `docs/superpowers/specs/2026-08-21-guest-play-ui-fixes-and-split-scoreboard-design.md`.
