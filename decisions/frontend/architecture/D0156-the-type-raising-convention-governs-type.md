---
id: D0156
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [frontend/architecture, barrel, types, interfaces]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The type-raising convention governs **type imports**

## Context and Problem Statement
The distinction was real but unstated, so the same call got made ad hoc twice; meanwhile the gate demanded the barrel path from value imports too — the one case where the barrel hop has a runtime cost. Of the 81 violations the two prior rounds fixed, 12 were value imports the principle now permits outright; the 61 type imports and 8 declaration/raising breaks all still fail

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The type-raising convention governs **type imports**: every `import type` reaches its declaration through the area-root barrel, never a deeper path nor a parent-relative one. **Value imports are exempt** — a Zod schema, `const` map, class or function may use its direct module path, because a value pulled through a barrel drags that barrel's whole subtree into the runtime module graph and can cycle; a file's own `./types`/`./interfaces` stays correct for both. `06-API/03-Shared-Conventions.md` → 1.7.0 states the principle and folds the two ad-hoc exceptions under it (`lib/server/types.ts` left unraised so the runtime `ERROR_HTTP` map stays out of the browser barrel's graph, D117; a route handler importing the Zod schema it validates against, D155); the `ErrorCode` cross-area re-export exception is untouched. `scripts/check-type-barrels.sh` rules 3 and 4 now classify each whole statement (joined across Prettier's line wraps): type-only ones are checked, value-binding ones skipped, and a mixed `import { type Foo, bar }` counts as a value import because one runtime binding is enough to create the edge the exemption exists for; re-export statements stay checked as raising-chain mechanics".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26
