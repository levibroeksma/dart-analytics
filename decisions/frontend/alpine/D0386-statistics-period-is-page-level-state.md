---
id: D0386
status: accepted
date: 2026-10-02
origin: contemporaneous
original-date:
tags: [frontend/alpine, state, x-data]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Statistics period is page-level state, shared by every section

## Context and Problem Statement
the period applies to every card on the page, so per-section pickers would drift apart and repeat the control; the page scope is already the shared parent. Before this change, the Score Training trend section held its own range `Select`, next to two stat tiles and the chart (score-trend spec, § 1). The commit moves the period select beside a half-width game select. It also splits the 3-dart and first-nine averages into sky cards that show percent change against the preceding period.

## Decision Drivers
* The period applies to every card on the page.
* Per-section pickers would drift apart and repeat the control.
* The page scope is already the shared parent of every section.

## Considered Options
* A range picker inside the score-trend section (its shape before this change).
* One `rangeKey` in the `/statistics` page scope, read by every section (chosen).

Rationale unknown — no source found for any further option.

## Decision Outcome
Chosen option: "`/statistics` owns one `rangeKey` in its page `x-data` scope, picked by a "Period" `Select` beside the game `Select` (two half-width columns). Section factories do not own a range: they read the inherited `rangeKey` (`this.$data.rangeKey`) and reload on `$watch("rangeKey")`.", because the period applies to every card on the page, so per-section pickers would drift apart and repeat the control; the page scope is already the shared parent.

### Consequences
a new section reads the same `rangeKey` and needs no picker. The period persists across game switches. The score-trend section loses its own picker; its previous-period delta logic is unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found. The commit updates `score-trend.data.test.ts` and `score-trend-window.test.ts`.

## Pros and Cons of the Options
### A range picker inside the score-trend section
* Bad, because per-section pickers drift apart and repeat the control.

### One page-level `rangeKey`
* Good, because a new section reads the same `rangeKey` and needs no picker.
* Good, because the period persists across game switches.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (refines D385).

* `docs/superpowers/specs/2026-10-01-score-training-trend-section-design.md` (§ 1): rebuilt Context and Considered Options.
* Commit `8c88a47b` (2026-10-02; adds the D386 row): rebuilt Context, Decision Drivers, Considered Options and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-11-14-x01-statistics-page-design.md`, `docs/superpowers/specs/2026-11-17-doubles-training-statistics-page-design.md`.
