---
id: D0106
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [frontend/architecture, error]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the

## Context and Problem Statement
`login.data.ts`'s local `mapSignInError`/`mapProvisionError` conflated two distinct error surfaces and weren't reusable. The 2026-07-16 spec finds 2 error surfaces: the API code registry (`ErrorCode`), and the Neon Auth SDK, which returns message-only errors with no domain code.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Per-page mapping functions such as `mapSignInError` and `mapProvisionError` in `login.data.ts`.
* One module, `lib/client/errors.ts`, with a `Partial<Record<ErrorCode, string>>` message table (chosen).

## Decision Outcome
Chosen option: "Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the shared `ErrorCode` type; replaces ad hoc per-page mapping functions", because `login.data.ts`'s local `mapSignInError`/`mapProvisionError` conflated two distinct error surfaces and weren't reusable.

### Consequences
* Good, because `Partial<Record<ErrorCode, string>>` is checked against the shared `ErrorCode` union, so a typo or rename fails to compile.
* Good, because the table needs no speculative UX copy for gameplay codes that have no UI yet. It grows as real UI consumes each code.
* Neutral, because `login.data.ts` loses its local mapping functions and `auth.store.ts` stays a thin pass-through of the raw SDK error.
* Neutral, because the "Client wrapper responsibilities" row in `07-Frontend/00-Overview.md` names `lib/client/errors.ts` as the single mechanism.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/client/errors.test.ts` exists. The 2026-07-16 spec has it cover a known `ProvisionError` code, an unknown code falling back to `err.message`, an SDK credential message mapping to the `UNAUTHORIZED` copy, and a generic error mapping to the fallback.

## Pros and Cons of the Options
### Per-page mapping functions
* Bad, because they conflate the API error registry with the Neon Auth SDK surface and cannot be reused (the ledger row).

### Central `lib/client/errors.ts`
* Good, because it is typed against `ErrorCode` and reusable across pages.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` (§ 4, Testing, Decisions Ledger): rebuilt Context, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-16-frontend-conventions-hardening.md` (Tasks 10–11): rebuilt Confirmation.
* Commit `8205d64d` (PR #25): adds the D106 row.
