---
id: D0300
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [api, contract, envelope, auth, Worker]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The envelope builders emit `X-Request-Id`; the header contract covers envelope responses only

## Context and Problem Statement
issue #340. The header half of the contract was specified on 2026-07-10 and never built — `JSON_HEADERS` was a shared frozen constant carrying `Content-Type` alone, so the request id existed only inside the JSON body. D282 surfaced `requestId` in client errors precisely so a user-visible failure could be correlated to its Worker log line; anything that reads headers rather than parsing the body — a proxy, the devtools network pane, a log shipper, a future error reporter — could not correlate at all. The proxy exemption is recorded rather than closed because that route returns the upstream response untouched by design and is never wrapped in the envelope; synthesising a header onto a body the API does not own would make the proxy less of a pass-through, not more correct.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`ok()` and `fail()` build their headers per response, adding `X-Request-Id: <requestId>` alongside `Content-Type`, so the header and the body always carry the same id. `03-Shared-Conventions.md`'s header contract is narrowed from "all responses" to "all envelope responses", naming the `/api/auth/*` pass-through proxy as the one route outside it.".

### Consequences
the headers object is now allocated per response instead of shared, which also means two responses can never alias one header set. Every other response the API produces comes from one of the two builders, so the contract holds everywhere it claims to. `app/tests/lib/server/envelope.test.ts` asserts the header against the body's id on both builders, so the contract stops being unenforced.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
