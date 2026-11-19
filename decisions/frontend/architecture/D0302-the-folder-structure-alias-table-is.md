---
id: D0302
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [frontend/architecture, aliases]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The folder-structure alias table is a third source `check-alias-sync.sh` enforces

## Context and Problem Statement
The doc calls itself the authoritative `app/src/` layout, so an alias missing from its table does not read as an omission — it reads as an alias that does not exist, and an agent hand-rolls a relative import path around it. Issue #347 found the table three aliases short (`@auth`, `@server`, `@assets`), undetected because D113's gate read only the two machine sources; the drift surfaced through a manual repo audit, which is not a mechanism. Extending the existing gate costs ~20 lines and reuses its `comm`-based comparison rather than adding an eighteenth `check-*.sh`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-alias-sync.sh` compares three sources instead of two — `app/tsconfig.json`'s `compilerOptions.paths`, `app/vitest.config.ts`'s `resolve.alias`, and the Path Aliases table in `docs/architecture/07-Frontend/02-Folder-Structure.md` — failing in both directions on the new pair (an alias tsconfig declares but the doc omits, and an alias the doc promises but tsconfig does not resolve). The vitest allowlist (`@styles`) is scoped to the vitest comparison only; no alias is exempt from being documented. The doc's table gains a sentence naming the gate, so a reader adding an alias learns the obligation where they are already looking.".

### Consequences
Adding a path alias is now a two-file change — `app/tsconfig.json` and this doc — plus `app/vitest.config.ts` unless the alias is `@styles`-like and allowlisted. The gate parses the table by line shape (`| `@name/*` | ... |`), so reformatting that table into a non-table form breaks the check rather than silently passing; the table must stay a pipe table. The tree portion of the same document is still unenforced — nine missing `lib/`/`modules/` trees were the other half of #347 and no gate would have caught them either.

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
