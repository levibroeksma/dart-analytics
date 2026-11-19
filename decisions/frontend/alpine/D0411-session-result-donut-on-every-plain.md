---
id: D0411
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Session-result donut on every plain board game's `/statistics` page

## Context and Problem Statement
the `completion` section is `any`-tag and already served for every game; only the client hard-coded Score Training.

## Decision Drivers
* The `completion` section is `any`-tag and already served for every game.
* Only the client hard-codes Score Training.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`scoreCompletionSection()` becomes `gameCompletionSection()` (`GameCompletionSection.astro`). `periodSection()` resolves the page-level `game` to its game type (`gameTypeKey()`), reloads on `game` and `rangeKey`, and makes no request for an unknown game. `HeatmapStatsOverview.astro` mounts the donut in a two-column grid above the heatmap, so every `HEATMAP_ONLY_LAYOUTS` game gets it. Design and logic are Score Training's: completed against abandoned, never-started left out, abandon rate as abandoned over started.", because the `completion` section is `any`-tag and already served for every game; only the client hard-coded Score Training.

### Consequences
no API or schema change. The donut fills the left cell only; the right cell is empty until another stat card lands there.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit edits `period-section.test.ts`, `score-section-factories.test.ts` and `register-route-data.test.ts`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D401, D402, D410).

* Commit `47b64bd4` (PR #777, 2026-10-04): rebuilt Decision Drivers and Confirmation.
