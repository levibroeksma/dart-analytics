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

# The envelope builders emit `X-Request-Id`; the header contract covers envelope responses only

## Context and Problem Statement
issue #340. The header half of the contract was specified on 2026-07-10 and never built — `JSON_HEADERS` was a shared frozen constant carrying `Content-Type` alone, so the request id existed only inside the JSON body. D282 surfaced `requestId` in client errors precisely so a user-visible failure could be correlated to its Worker log line; anything that reads headers rather than parsing the body — a proxy, the devtools network pane, a log shipper, a future error reporter — could not correlate at all. The proxy exemption is recorded rather than closed because that route returns the upstream response untouched by design and is never wrapped in the envelope; synthesising a header onto a body the API does not own would make the proxy less of a pass-through, not more correct.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Emit `X-Request-Id` from the `ok()` and `fail()` builders and narrow the contract to envelope responses.
* Add the header to the `/api/auth/*` proxy response as well.

## Decision Outcome
Chosen option: "`ok()` and `fail()` build their headers per response, adding `X-Request-Id: <requestId>` alongside `Content-Type`, so the header and the body always carry the same id. `03-Shared-Conventions.md`'s header contract is narrowed from "all responses" to "all envelope responses", naming the `/api/auth/*` pass-through proxy as the one route outside it.".

### Consequences
the headers object is now allocated per response instead of shared, which also means two responses can never alias one header set. Every other response the API produces comes from one of the two builders, so the contract holds everywhere it claims to. `app/tests/lib/server/envelope.test.ts` asserts the header against the body's id on both builders, so the contract stops being unenforced.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/server/envelope.test.ts` asserts the `X-Request-Id` header against the body's id on both builders.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-17

* Commit `1ca45c03` (PR #407, 2026-09-17; fixes #340, #341, #339; adds the D300 row to `decisions/api.md`): rebuilt Considered Options and Confirmation; source of the split-copied Context.
