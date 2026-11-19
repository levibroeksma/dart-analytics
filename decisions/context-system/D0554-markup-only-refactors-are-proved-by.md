---
id: D0554
status: accepted
date: 2026-11-11
origin: contemporaneous
original-date:
tags: [context-system, gate, CI]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Markup-only refactors are proved by HTML parity; game play pages share one shell

## Context and Problem Statement
`.astro` markup has no unit-test runner here (D101), so a template split had no proof beyond reading the diff. All 49 pages prerender and no component has a scoped style, so the build output is a complete record of the markup.

## Decision Drivers
* `.astro` markup has no unit-test runner here (D101), so a template split had no proof beyond reading the diff.
* All 49 pages prerender and no component has a scoped `<style>`, so the build output is a complete record of the markup.
* The audit's plan 7 had to split long Astro templates, and its goal was a health score of at least 95.0 with the built HTML byte-identical.
* 14 near-identical game play pages and a 272-line `DartBoard.astro` block that appears twice are what the audit spec and plan 7 name.

## Considered Options
* Prove a template split by reading the diff (the state described in Context).
* Compare the prerendered HTML byte for byte with a saved base (chosen).

## Decision Outcome
Chosen option: "`scripts/check-html-parity.sh` builds the app and compares every prerendered page's HTML byte for byte with a base saved by `--save` from the tree before the change. It is run by hand around a template split and is not a CI gate; its fixture test runs in `quality / structure`. The only normalisation is the SVG gradient ids `CountdownResumePrompt.astro` mints with `crypto.randomUUID()` at build time. `PlayPageShell.astro` (`setupHref`, default slot) holds the wrapper, `ReconciliationBlocked` and `NoSessionPanel` that 17 of the 18 `pages/games/*/play/index.astro` repeated; `score-training` has no reconciliation panel and keeps its own body. `DartBoard.astro` loops over `BOARD_SEGMENTS` (`lib/ui/dart-board-segments.ts`) instead of holding twenty hand-written copies of one segment.".

### Consequences
a markup refactor is done when the script prints `html parity: 49 files identical`. It cannot see a component no page renders, markup built by a client script, or a hashed asset. Two builds of one tree differed on six pages before the id mask.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-html-parity.sh` exists, and `.github/workflows/quality.yml` runs its fixture test `scripts/test-check-html-parity.sh`. The plan's global check is `html parity: 49 files identical` after every task. The script is run by hand and is not a CI gate.

## Pros and Cons of the Options
### Prove a split by reading the diff
* Bad, because no runner covers `.astro` markup, so nothing machine-checks the split.

### Byte-for-byte HTML parity against a saved base
* Good, because every prerendered page is compared, so a one-byte difference, including whitespace, fails the task.
* Bad, because it cannot see a component no page renders, markup built by a client script, or a hashed asset.
* Bad, because it is run by hand, not in CI.

## Evidence / More Information
Decided: 2026-11-11

* `docs/superpowers/plans/2026-11-10-quality-7-astro-templates.md` (Goal, Architecture, Global Constraints, Task 1): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` (§ 5 list, plan index): rebuilt Decision Drivers.
* Commit `69ccbfc2` (PR #1318, 2026-11-11; adds the parity script, `PlayPageShell.astro` and the D554 row): source of the Context and Consequences text.
