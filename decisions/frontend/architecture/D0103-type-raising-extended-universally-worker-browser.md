---
id: D0103
status: accepted
date: 2026-07-16
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

# Type-raising extended universally (Worker + browser, Zod + hand-authored)

## Context and Problem Statement
Codebase self-audit found these conventions already documented but violated (deep-relative imports, a re-declared Zod schema, an unraised interface). The 2026-07-16 spec lists the violations: a 3-level relative import in `lib/client/api/players.ts`, a re-declared `ProvisionPlayerRequest` schema, parent-relative imports across `services/`, `repositories/` and `db/`, and an inline `ProvisionedPlayer` interface with no barrel.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Keep the Worker-only barrel framing and the top-level `types/` tree. The spec treats this as the state it replaces.
* Universal type and interface raising with contract types in domain folders (chosen).
* Rejected inside the chosen option: one mixed barrel file for types and interfaces. The spec keeps `interfaces.ts` separate from `types.ts`.

## Decision Outcome
Chosen option: "Type-raising extended universally (Worker + browser, Zod + hand-authored); contract types relocated from top-level `types/` into owning domain folders (`pages/api/<domain>/types.ts`, new `@routes` alias); `types.ts` standardized as the sole barrel filename, replacing the 2 existing `index.ts` files; TS `interface` declarations raised through a parallel, separate `interfaces.ts` barrel chain (same mechanics, kept out of `types.ts`), excluding `.astro` frontmatter (D92) and `env.d.ts` ambient declarations", because Codebase self-audit found these conventions already documented but violated (deep-relative imports, a re-declared Zod schema, an unraised interface).

### Consequences
* Good, because browser code reaches domain DTOs through a client-owned barrel, `@client/api/types`. That file is the only browser file with an `@routes/types` import.
* Neutral, because the alias set gains `@services`, `@repositories`, `@db` and `@routes`, and loses `@types`.
* Neutral, because a type is raised only once a file outside its defining file consumes it.
* Neutral, because `lib/env.ts` keeps its `../../neon` import, which targets `app/neon.ts` outside `src/`.
* Neutral, because `ErrorCode` stays defined in `lib/server/errors.ts` and is re-exported type-only through `@routes/types` and `@client/api/types`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The 2026-07-16 spec requires `astro check` and `npx fallow` to pass after the alias changes and `npm test` to show the same pass count.

## Pros and Cons of the Options
### Worker-only barrels with a top-level `types/` tree
Rationale unknown — no source found beyond the listed violations of the documented conventions.

### Universal raising with separate `types.ts` and `interfaces.ts` chains
* Good, because separate files keep structural `type` aliases and `interface` contracts separable at a glance.
* Good, because `types.ts` is documented about 15 times, against 2 real `index.ts` files, so standardizing on it matches the docs.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` (Context, § 1, Decisions Ledger, Testing): rebuilt Context, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-16-frontend-conventions-hardening.md` (Tasks 1–4 and 13): rebuilt Confirmation. Task 13 adds the ledger row.
* Applied in: `docs/superpowers/plans/2026-08-19-consistency.md`, `docs/superpowers/plans/2026-07-16-style-guide-hardening.md`.
