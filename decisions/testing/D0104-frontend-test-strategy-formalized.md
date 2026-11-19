---
id: D0104
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [testing, test, mock, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Frontend test strategy formalized

## Context and Problem Statement
`authClient` was mocked twice with inconsistent shapes; codified the promotion threshold before it recurs. The 2026-07-16 frontend conventions design records the 2 `authClient` mocks, in `auth.store.test.ts` and `login.data.test.ts`. It adds a test-strategy doc to codify the shared-mock convention.

## Decision Drivers
* A mock's shape is not re-declared in every test file.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Frontend test strategy formalized: new `06-Test-Strategy.md`, shared-mock convention (`tests/mocks/` + `setupFiles`), full-suite-always-runs completion policy", because `authClient` was mocked twice with inconsistent shapes; codified the promotion threshold before it recurs.

### Consequences
* Good, because a promoted mock has 1 shape, declared once in `app/tests/mocks/<name>.mock.ts` and wired through `app/tests/setup.ts` in `vitest.config.ts`'s `setupFiles`.
* Neutral, because tests still override return values per case with `vi.mocked(x).mockResolvedValue(...)` in their own `beforeEach`.
* Neutral, because single-use mocks stay local: the `apiRequest` mock in `players.test.ts` does not move.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`npm test` runs the complete suite, never with `--bail` and never scoped to touched files, before any task is claimed done. Failures outside the task are named in the completion report. They block completion only when the current change caused them.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` (Context, § 2, Decisions Ledger): rebuilt Context, Decision Drivers, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-16-frontend-conventions-hardening.md` (the `DECISIONS.md` step): confirmed the D104 wording.
* Commit `8205d64d` (PR #25, 2026-07-16): confirmed the shared `authClient` mock and the Test Strategy doc landed.
