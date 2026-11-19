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

# The folder-structure alias table is a third source `check-alias-sync.sh` enforces

## Context and Problem Statement
The doc calls itself the authoritative `app/src/` layout, so an alias missing from its table does not read as an omission — it reads as an alias that does not exist, and an agent hand-rolls a relative import path around it. Issue #347 found the table three aliases short (`@auth`, `@server`, `@assets`), undetected because D113's gate read only the two machine sources; the drift surfaced through a manual repo audit, which is not a mechanism. Extending the existing gate costs ~20 lines and reuses its `comm`-based comparison rather than adding an eighteenth `check-*.sh`.

## Decision Drivers
* The doc calls itself the authoritative `app/src/` layout, so a missing alias reads as a nonexistent one.
* Issue #347 found the table three aliases short, and the drift surfaced only through a manual repo audit.
* The existing gate can be extended in about 20 lines, reusing its `comm`-based comparison.

## Considered Options
* Extend `scripts/check-alias-sync.sh` with the doc's alias table as a third source.
* Add a separate `check-*.sh` script for the doc table.
* Rely on manual repo audits, which is how #347 surfaced.

## Decision Outcome
Chosen option: "`scripts/check-alias-sync.sh` compares three sources instead of two — `app/tsconfig.json`'s `compilerOptions.paths`, `app/vitest.config.ts`'s `resolve.alias`, and the Path Aliases table in `docs/architecture/07-Frontend/02-Folder-Structure.md` — failing in both directions on the new pair (an alias tsconfig declares but the doc omits, and an alias the doc promises but tsconfig does not resolve). The vitest allowlist (`@styles`) is scoped to the vitest comparison only; no alias is exempt from being documented. The doc's table gains a sentence naming the gate, so a reader adding an alias learns the obligation where they are already looking.".

### Consequences
Adding a path alias is now a two-file change — `app/tsconfig.json` and this doc — plus `app/vitest.config.ts` unless the alias is `@styles`-like and allowlisted. The gate parses the table by line shape (`| `@name/*` | ... |`), so reformatting that table into a non-table form breaks the check rather than silently passing; the table must stay a pipe table. The tree portion of the same document is still unenforced — nine missing `lib/`/`modules/` trees were the other half of #347 and no gate would have caught them either.

* Good, because alias drift between `tsconfig.json` and the doc table now fails mechanically in both directions.
* Bad, because the gate parses the table by line shape, so reformatting it away from a pipe table breaks the check.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-alias-sync.sh` runs the three-way comparison. The commit message says the change was mutation-checked in both directions.

## Pros and Cons of the Options
### Extend `check-alias-sync.sh` (chosen)

* Good, because it reuses the existing `comm`-based comparison instead of adding a script.

### Add a separate `check-*.sh` script

* Bad, because the Context rules it out: it adds one more script where the existing gate already holds the comparison.

### Rely on manual repo audits

* Bad, because the audit that found #347 is not a mechanism and drift stayed undetected until then.

## Evidence / More Information
Decided: 2026-09-17

* Commit `0b63fa9e` (PR #411, 2026-09-17; `scripts/check-alias-sync.sh` diff and the commit message for #347): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
