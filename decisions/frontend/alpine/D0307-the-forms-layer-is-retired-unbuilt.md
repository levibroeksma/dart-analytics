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

# The `forms/` layer is retired unbuilt; `settings.store.ts` is D77's substitute in practice

## Context and Problem Statement
D77 deferred `player_settings` post-v1 and named `forms/` as the local-persistence substitute. The substitute that actually shipped was `settings.store.ts`, and `src/forms/` was never created: no `*.form.ts` file exists, nothing imports `@forms`, and the alias resolves to a missing directory in both configs (issue #348). A documented non-negotiable convention governing a layer with zero instances costs attention on every read and traps the first file that tries to use the broken alias. The technical debt sweep spec groups issue #348 with #297 because both touch `07-Frontend/02-Folder-Structure.md`, `app/CLAUDE.md` and the alias configs. Before the change, `app/CLAUDE.md` listed `.form.ts` among the non-negotiable suffix conventions. `02-Folder-Structure.md` documented the tree entry, the suffix row, the import-direction rules and the `$persist` permission (spec § 3.1).

## Decision Drivers
* `src/forms/` does not exist, no `*.form.ts` file exists, and nothing imports `@forms` (spec § 3.1).
* The `@forms` alias must leave `app/tsconfig.json` and `app/vitest.config.ts` in one commit, because `check-alias-sync.sh` fails when they diverge (spec § 3.3).
* D77 and D86 stay unedited, because the ledger is append-only (spec § 3.3).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "the `@forms` alias, the `src/forms/` tree entry, the `.form.ts` suffix convention, its `$persist` permission, and every remaining prose, table and diagram description of the pattern — including `03-Alpine-Patterns.md`'s `# Form Pattern` section in full — are removed from `app/tsconfig.json`, `app/vitest.config.ts`, `app/CLAUDE.md`, and every architecture doc that documented them — `07-Frontend/02-Folder-Structure.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/10-Frontend-Agent-Guide.md`, `04-Architecture-patterns.md`, `06-API/03-Shared-Conventions.md` and `08-DartBot.md`. D77, D84 and D86 are not edited — the ledger is append-only and their reasoning was sound at the time.".

### Consequences
a future forms layer is a new decision, not a resumption of this one — it would re-add both alias entries in one commit (`check-alias-sync.sh`) and restate the suffix convention. Local per-device preferences continue to live in stores, as D86's handedness field already does.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's acceptance criteria (§ 3.5) require `grep -rn "@forms" app/` to return nothing. They also require `check-alias-sync.sh`, `check-doc-links.sh`, `check-context-map.sh` and the other listed gate scripts to pass. Plan Task 4, Step 1 proves the layer empty first: `app/src/forms` is absent, `@forms` has no hits, and no `*.form.ts` file exists. Step 6 runs `check-alias-sync.sh`, `check-decision-ids.sh` and `check-doc-links.sh`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-17
Refines: D77

* `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` (§ 3.1, § 3.3, § 3.4, § 3.5): rebuilt Context, Decision Drivers and Confirmation.
* `docs/superpowers/plans/2026-09-17-p1-training-taxonomy.md` (Task 4, Steps 1 and 6): rebuilt Confirmation. Its draft decision entry matches the Decision Outcome.
* Commit `b30e4cc9` (PR #419, 2026-09-17): adds the D307 row. No section rebuilt from it.
