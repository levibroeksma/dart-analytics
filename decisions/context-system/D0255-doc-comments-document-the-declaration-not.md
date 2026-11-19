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

# Doc comments document the declaration, not its decision history

## Context and Problem Statement
the DartBot level-picker implementation plan (`docs/superpowers/plans/2026-09-03-dartbot-level-picker.md`) drafted JSDoc blocks that restated the design spec's rationale in full — the same pattern already visible across the codebase (`guest-list.ts`, `OpponentChooserModal.astro`, `BoardMagnifier.astro`), where a doc comment doubles as an architecture essay. The existing rule only said "put necessary detail in JSDoc," which had no ceiling and rewarded exactly this.

## Decision Drivers
* The level-picker plan's JSDoc blocks restated the design spec's rationale in full instead of documenting the declaration (commit `543f26d1`).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`app/CLAUDE.md`'s comment rule (§Comments, scope widened from `app/src/**/*.ts` to also cover `.astro` frontmatter) now bars restating decision history inside a JSDoc/block comment — no decision id, phase number, prior version, or architecture-doc paragraph narrated in prose. A comment states the declaration's contract and any genuinely non-obvious constraint; rationale and alternatives-weighed stay in `docs/architecture/**`/`decisions/**`, cited by a short pointer.".

### Consequences
existing long-form comments already in the codebase are not retroactively rewritten by this decision — the rule governs new and touched comments going forward. A comment that only points at a doc/decision id is now correct where a full restatement was previously the norm; `01-Principles.md`'s Architecture First still owns *why* code exists, comments own *what* a declaration does.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-no-inline-comments.sh` fails on plan, review and fix-round citations in comments (`history_re`, labelled D255). It does not cover every form of decision history.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-03

* Commit `543f26d1` (2026-09-03; edits `app/CLAUDE.md` and trims the level-picker plan's JSDocs): rebuilt Decision Drivers.
* Commit `71e6679b` (PR #647, 2026-09-29; edits `scripts/check-no-inline-comments.sh`): rebuilt Confirmation.
* Applied in: `docs/superpowers/plans/2026-09-03-dartbot-level-picker.md`, `docs/superpowers/plans/2026-09-04-dartbot-level-select-stats.md`, `docs/superpowers/plans/2026-09-18-custom-routine-builder.md`, `docs/superpowers/plans/2026-09-04-dartbot-level-curve-refit.md`, `docs/superpowers/plans/2026-09-03-dartbot-121-tuod-score-training.md`.
