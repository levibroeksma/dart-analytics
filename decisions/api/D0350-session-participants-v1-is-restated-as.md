---
id: D0350
status: accepted
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0061
superseded-by:
---

# Session participants (v1) is restated as shipped: 1-4 seats, one `PLAYER`, `GUEST`/`DARTBOT` implemented per-ruleset `SEAT_CAPS`

## Context and Problem Statement
issue #406. D221 (2026-08-21) shipped the guest half of D61's deferral — `participants[]`, seat rejections, `SEAT_CAPS` — and superseded D61 for that portion, but the frozen bullets in both `00-Overview.md` and `04-Endpoint-Contracts.md` were never updated and kept asserting "guest/DartBot play is deferred post-v1". The DartBot half shipped later still: the write path admitted a `DARTBOT`-typed seat 2026-09-01 (`08-DartBot.md` phase 5), and the play loop wiring across all nine rulesets completed 2026-09-16 (issue #283). Both docs were left contradicting shipped code for a month — the same defect class as D301 (issue #339), one bullet lower in the same frozen list, deliberately left alone when D301 was scoped to activity grouping only.

## Decision Drivers
* Guest seats (D221, 2026-08-21) and the DartBot write path and play-loop wiring (2026-09-01 to 2026-09-16) shipped, but the frozen bullets still said guest and DartBot play were deferred post-v1.
* The same defect class as D301 and issue #339, which was scoped to the activity-grouping bullet only.

## Considered Options
* Leave the frozen "Session participants (v1)" bullet and "Participants (v1)" note as they were (the state before this record).
* Restate both to describe what ships (chosen).

## Decision Outcome
Chosen option: "`06-API/00-Overview.md`'s frozen "Session participants (v1)" bullet and `04-Endpoint-Contracts.md`'s "Participants (v1)" note are restated to describe what ships: a session admits 1-4 seats via an optional ordered `participants[]` input (array order is seat order), exactly one `PLAYER` seat is required and server-derived, and `GUEST`/`DARTBOT` seats are implemented, capped per ruleset by `SEAT_CAPS` (`app/src/services/session-seats.service.ts`). Guest and DartBot play are no longer described as deferred post-v1.".

### Consequences
the freeze on session participants is lifted in the documents rather than in behaviour; nothing in `app/` changes. This is a semantics correction, not a doc-only bump, so both `00-Overview.md` and `04-Endpoint-Contracts.md` take a minor version bump and this block is the authority for it. `04-Endpoint-Contracts.md`'s "Participants (v1)" note still documents the single-`PLAYER`-seat default; its own "Participants (guests)" note (added 2026-08-21) remains the shipped contract for the `participants[]` shape and is unchanged by this block.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Leave the frozen bullets as they were
* Bad, because both documents contradict shipped guest and DartBot behaviour.

### Restate both as shipped
* Good, because the documents describe the 1-4 seat, one-`PLAYER` contract that ships.

## Evidence / More Information
Decided: 2026-09-21

* Commit `e4961474` (2026-09-21, issue #406; adds the D350 row and the two doc edits): rebuilt Decision Drivers, Considered Options and Pros and Cons.
