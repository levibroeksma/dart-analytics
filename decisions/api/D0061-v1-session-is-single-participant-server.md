---
id: D0061
status: superseded
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: [D0221, D0350]
---

# v1 session is single-participant (server-derived `PLAYER`)

## Context and Problem Statement
Close participant gap without multiplayer scope

## Decision Drivers
* Participants exist in the runtime layer and `TurnFact.participantRef` assumes them, but `CreateSessionRequest` had no way to declare one (validation spec, Section 3 finding F1).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "v1 session is single-participant (server-derived `PLAYER`); guest/DartBot deferred as additive `participants[]`", because Close participant gap without multiplayer scope.

### Consequences
* Neutral, because `POST /api/sessions` creates exactly one `PLAYER` participant for the authenticated player, with `display_name` copied from `players.display_name`.
* Neutral, because the creation response returns the participant reference so the client can fill `TurnFact.participantRef` on the batch write.
* Neutral, because an unmatched `participantRef` maps to `BATCH_REFERENCE_MISSING`.
* Neutral, because guest and DartBot play return later as an optional `participants[]` array on `CreateSessionRequest`, added without changing existing fields.

### Confidence
Rationale unknown — no source found.

### Revisit When
Post-v1, when guest or DartBot play is added; the validation spec defers it as an additive `participants[]`.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-v1-api-freeze-validation-design.md` (Section 3 F1, Section 4 D1; the spec's own numbering): rebuilt Decision Drivers, Consequences and Revisit When.
* `docs/superpowers/plans/2026-07-12-v1-api-freeze-reconciliation.md` (Task 5 Step 2): appends the ledger row D61 dated 2026-07-12.
* Superseded by D0221 and D0350 (frontmatter `superseded-by`). The guest-player spec (`docs/superpowers/specs/2026-08-20-guest-player-x01-design.md`, Context and Touch List) calls `participants[]` the addition D61 deferred and lists D61 as superseded on the create contract.
