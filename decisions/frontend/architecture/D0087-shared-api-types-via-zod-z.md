---
id: D0087
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/architecture, barrel, types]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Shared API types via Zod `z.infer<>` in `src/types/api/` with barrel raising

## Context and Problem Statement
No DTO drift from frozen contract. The 2026-07-14 spec derives shared DTO types from Zod schemas and raises them through barrels. The 2026-07-16 hardening spec found `pages/api/players/provision.ts` re-declaring its own copy of a request schema, the drift this decision targets.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Shared API types via Zod `z.infer<>` in `src/types/api/` with barrel raising", because No DTO drift from frozen contract.

### Consequences
* Good, because Zod schemas are the single source of shape and the types are always `z.infer<typeof Schema>`, never hand-authored duplicates.
* Neutral, because `*.payload.module.ts` files import types only, not server Zod validators at runtime, unless the shared schema file is browser-safe.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 11, § DECISIONS.md proposed entries): rebuilt Context and Consequences.
* `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` (Context, § 1): rebuilt Context. Related: the spec relocates these types into domain folders; D103 carries that decision.
