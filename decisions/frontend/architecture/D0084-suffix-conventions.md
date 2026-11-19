---
id: D0084
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/architecture, suffix]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Suffix conventions

## Context and Problem Statement
Filename encodes role. The 2026-07-14 spec lists 7 file suffixes with their responsibility and `$persist` permission.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Suffixes `*.gen.ts` and `*.page.ts`. The spec rejects them: `*.gen.ts` because the files are constructors, not generators, and `*.page.ts` in favour of `.data.ts` for Alpine data factories.
* The suffix set `.store.ts`, `.form.ts`, `.data.ts`, `.module.ts`, `.engine.module.ts`, `.payload.module.ts` (chosen).

## Decision Outcome
Chosen option: "Suffix conventions: `.store.ts`, `.form.ts`, `.data.ts`, `.module.ts`, `.engine.module.ts`, `.payload.module.ts`", because Filename encodes role.

### Consequences
* Good, because the filename encodes the file role. The ledger row gives this as the rationale.
* Neutral, because `$persist` is allowed in `.store.ts` and `.form.ts` files, and forbidden in `.data.ts`, `.module.ts`, `.engine.module.ts`, `.payload.module.ts` and `.astro` files.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### `*.gen.ts` and `*.page.ts`
Rationale unknown — no source found beyond the two stated rejections.

### The chosen suffix set
* Good, because the filename encodes the role.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 8, § DECISIONS.md proposed entries; Critique Resolution Log I21): rebuilt Context, Considered Options and Consequences.
