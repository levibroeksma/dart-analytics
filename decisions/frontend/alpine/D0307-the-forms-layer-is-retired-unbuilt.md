---
id: D0307
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, stores, persist]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The `forms/` layer is retired unbuilt; `settings.store.ts` is D77's substitute in practice

## Context and Problem Statement
D77 deferred `player_settings` post-v1 and named `forms/` as the local-persistence substitute. The substitute that actually shipped was `settings.store.ts`, and `src/forms/` was never created: no `*.form.ts` file exists, nothing imports `@forms`, and the alias resolves to a missing directory in both configs (issue #348). A documented non-negotiable convention governing a layer with zero instances costs attention on every read and traps the first file that tries to use the broken alias.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the `@forms` alias, the `src/forms/` tree entry, the `.form.ts` suffix convention, its `$persist` permission, and every remaining prose, table and diagram description of the pattern — including `03-Alpine-Patterns.md`'s `# Form Pattern` section in full — are removed from `app/tsconfig.json`, `app/vitest.config.ts`, `app/CLAUDE.md`, and every architecture doc that documented them — `07-Frontend/02-Folder-Structure.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/10-Frontend-Agent-Guide.md`, `04-Architecture-patterns.md`, `06-API/03-Shared-Conventions.md` and `08-DartBot.md`. D77, D84 and D86 are not edited — the ledger is append-only and their reasoning was sound at the time.".

### Consequences
a future forms layer is a new decision, not a resumption of this one — it would re-add both alias entries in one commit (`check-alias-sync.sh`) and restate the suffix convention. Local per-device preferences continue to live in stores, as D86's handedness field already does.

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
Refines: D77
