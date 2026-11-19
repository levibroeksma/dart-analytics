---
id: D0303
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [testing, test, mock, coverage, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A repository's write paths are asserted as rendered SQL, not as a mocked builder

## Context and Problem Statement
the repository tests mocked the query builder itself, so no test in the suite had ever seen a statement drizzle emits. `abandonActiveTrainingActivities` shipped a predicate built with `exists()` over a raw `sql` chunk, which renders as `exists select 1 ...` without the parentheses Postgres requires; 3996 tests passed and every routine start in production failed 42601 until it was found by hand (issue #397, fixed in #400). Mocking the builder means the only thing under test is the arguments handed to a fake — the translation step where this class of defect lives is skipped entirely. pg-proxy renders without a connection, so the assertion stays a unit test and the "no real Neon calls" rule (D99, D104) holds.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every mutating repository function, plus the single-active session lookups, has a test that runs the real drizzle builder through `drizzle-orm/pg-proxy` and asserts the statement it emits, via the shared `app/tests/repositories/render-sql.ts` helper. The existing mocked-builder tests stay: they assert the function's control flow and return shape, which rendering does not cover. Functions that open their own transaction (`upsertSettings`, `insertBatchRecords`) get the rendering client through a `vi.mock("@db/client")` of `withTransaction`, in their own test files, because that mock is module-scoped.".

### Consequences
the expected statements are written out in full, so any change to a table's columns, a predicate, or drizzle's own SQL generation fails these tests and must be re-read and re-approved. That is the intended cost — an emitted-SQL change is exactly what should not pass silently — but it is a real maintenance tax on schema work, and drizzle version bumps will land in this file. Coverage is deliberately bounded to writes and the single-active reads rather than every read path: those are where a malformed statement loses or corrupts data rather than failing a screen. The tests prove the SQL is well-formed and shaped as intended; they still prove nothing about whether it is correct against the live schema — that remains `npm run db:verify` and the rehearsal job.

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
