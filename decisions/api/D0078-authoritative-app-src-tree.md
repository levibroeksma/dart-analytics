---
id: D0078
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, envelope]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Authoritative `app/src` tree

## Context and Problem Statement
Frozen docs contradicted each other on layout

Decision 10 of the architecture-hardening spec records the reconciliation of the frozen docs against `app/src/`.

## Decision Drivers
* The tree should match the documented alias set (Decision 10).
* Browser and Worker code never share a folder (Decision 10).

## Considered Options
* Keep the nested layout the `01` and `02` diagrams show: `src/lib/services/**`, `src/lib/repositories/**` and `lib/db/client.ts`.
* Use top-level `services`, `repositories` and `db` areas, with `lib/api/` for the browser client and `lib/server/` for response helpers (chosen).

## Decision Outcome
Chosen option: "Authoritative `app/src` tree: top-level `services`/`repositories`/`db` areas; `lib/api/` = browser client (D41); `lib/server/` = envelope/error helpers", because Frozen docs contradicted each other on layout.

### Consequences
* Good, because browser-facing and Worker-side code live in separate folders.
* Neutral, because the diagrams in `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md` and the `lib/db/client.ts` heading in `02` are corrected to the top-level paths.
* Neutral, because `envelope.ts` and `errors.ts` move out of `lib/api/` into `lib/server/`, and the `07-Frontend/00-Overview.md` client-structure section is aligned.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep the nested layout
* Bad, because the frozen docs contradicted each other on the layout.

### Top-level areas with a browser/server split
* Good, because the tree matches the documented alias set.
* Good, because browser and Worker code never share a folder.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Decision 10): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-07-14-docs-consistency-and-gates-design.md` (row 6, the `db/client.ts` heading).
