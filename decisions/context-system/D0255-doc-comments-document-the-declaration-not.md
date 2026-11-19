---
id: D0255
status: accepted
date: 2026-09-03
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Doc comments document the declaration, not its decision history

## Context and Problem Statement
the DartBot level-picker implementation plan (`docs/superpowers/plans/2026-09-03-dartbot-level-picker.md`) drafted JSDoc blocks that restated the design spec's rationale in full — the same pattern already visible across the codebase (`guest-list.ts`, `OpponentChooserModal.astro`, `BoardMagnifier.astro`), where a doc comment doubles as an architecture essay. The existing rule only said "put necessary detail in JSDoc," which had no ceiling and rewarded exactly this.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/CLAUDE.md`'s comment rule (§Comments, scope widened from `app/src/**/*.ts` to also cover `.astro` frontmatter) now bars restating decision history inside a JSDoc/block comment — no decision id, phase number, prior version, or architecture-doc paragraph narrated in prose. A comment states the declaration's contract and any genuinely non-obvious constraint; rationale and alternatives-weighed stay in `docs/architecture/**`/`decisions/**`, cited by a short pointer.".

### Consequences
existing long-form comments already in the codebase are not retroactively rewritten by this decision — the rule governs new and touched comments going forward. A comment that only points at a doc/decision id is now correct where a full restatement was previously the norm; `01-Principles.md`'s Architecture First still owns *why* code exists, comments own *what* a declaration does.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-03
