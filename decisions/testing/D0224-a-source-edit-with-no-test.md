---
id: D0224
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [testing, test, coverage, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A source edit with no test edit is not a completed task

## Context and Problem Statement
the suite going green proved only that the assertions that already existed still held. Nothing in the repository asked whether any assertion described the change under review, and the completion bar — `validate:app` — could be satisfied by a diff that moved behaviour and touched no test at all. Writing this gate immediately found one: `ParticipantInput`, the Zod schema deciding which participant payloads `POST /api/sessions` accepts, shipped with no test parsing it; `app/tests/pages/api/sessions/types.test.ts` was written in the same pass. A silencer was considered and rejected — an escape hatch would be reached for on exactly the changes the gate exists to catch, and the honest cost of a change that needs no new assertion is opening the covering test to confirm the existing ones still describe the behaviour.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-test-coverage.sh` (with `scripts/check_test_coverage.py`) fails any change set that modifies a runtime `.ts` file under `app/src/` or `app/scripts/` unless a test importing that file changed in the same set. It runs as the fourteenth `.husky/pre-commit` gate and as an eighteenth `quality.yml` structure gate, where the `structure` job now checks out with `fetch-depth: 0` so the merge base exists. Coverage is decided by resolving each test's import specifiers through `app/tsconfig.json`'s alias table, not by filename, because `app/src/lib/utils/is-nav-active.ts` is covered off-mirror by `app/tests/utils/is-nav-active.test.ts`. Three exemptions are derived, never listed by name: `.d.ts` files; modules that declare no runtime value of their own, which covers every pure re-export barrel; and edits whose runtime shape is unchanged once type declarations are stripped, so adding a type to a file that also holds Zod schemas costs nothing. `drizzle-kit introspect` output is the one path-keyed exemption, with the owning command recorded beside it. No per-file silencer exists.".

### Consequences
every task that edits runtime code now edits a test, and a file with no covering test cannot be changed until one is written — which converts the untested corners of `app/src/` (the Alpine registration modules, `lib/server/envelope.ts`, `stores/board-input.store.ts`) from invisible debt into a bill payable on first touch. That is deliberate and it will slow some tasks down. The gate proves a covering test file was edited, never that the edit asserts anything: a whitespace change satisfies it, and it cannot catch a test repointed at a different input to keep it passing — root `CLAUDE.md`'s test invariant and human review still carry that. Type-shape comparison strips declarations by consuming each from its keyword to its own terminator rather than by splitting the file into statements, because a conditional type returns to depth zero twice before it ends and statement splitting left the tail behind as apparent runtime code. It fails closed: a file with no previous version, and any change it cannot compare, counts as changed.

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
