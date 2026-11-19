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
<!-- backfill: pending -->

# Markup-only refactors are proved by HTML parity; game play pages share one shell

## Context and Problem Statement
`.astro` markup has no unit-test runner here (D101), so a template split had no proof beyond reading the diff. All 49 pages prerender and no component has a scoped style, so the build output is a complete record of the markup.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-html-parity.sh` builds the app and compares every prerendered page's HTML byte for byte with a base saved by `--save` from the tree before the change. It is run by hand around a template split and is not a CI gate; its fixture test runs in `quality / structure`. The only normalisation is the SVG gradient ids `CountdownResumePrompt.astro` mints with `crypto.randomUUID()` at build time. `PlayPageShell.astro` (`setupHref`, default slot) holds the wrapper, `ReconciliationBlocked` and `NoSessionPanel` that 17 of the 18 `pages/games/*/play/index.astro` repeated; `score-training` has no reconciliation panel and keeps its own body. `DartBoard.astro` loops over `BOARD_SEGMENTS` (`lib/ui/dart-board-segments.ts`) instead of holding twenty hand-written copies of one segment.".

### Consequences
a markup refactor is done when the script prints `html parity: 49 files identical`. It cannot see a component no page renders, markup built by a client script, or a hashed asset. Two builds of one tree differed on six pages before the id mask.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-11
