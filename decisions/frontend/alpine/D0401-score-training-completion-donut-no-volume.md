---
id: D0401
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Score Training: completion donut, no volume section, completed-only paginated replay

## Context and Problem Statement
never-started sessions carry no play, so counting them as abandoned misstated the rate; volume was unwanted and is not to return as it was; unfinished games have nothing worth replaying and a 25-row list buried the cards.

## Decision Drivers
* Never-started sessions carry no play, so counting them as abandoned misstates the rate.
* Volume was unwanted and is not to return as it was.
* Unfinished games have nothing worth replaying.
* A 25-row list buried the cards.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Score Training's `/statistics` layout drops the `volume` section (`scoreVolumeSection`, `volumeSummary`, `VolumeSummary`). The `completion` section becomes a donut card (`ScoreCompletionSection.astro`, `scoreCompletionSection()`): square, at most half the page wide, completed green and abandoned red through `Chart.astro` as a new `doughnut` `ChartKind` (`modules/ui/chart.module.ts`: one series, `sliceColors` per slice, Chart.js `DoughnutController`/`ArcElement`; legend and tooltip per slice). Never-started sessions are neither shown nor counted: `completionSummary()` returns `completed`, `abandoned` and `abandonRate = abandoned / (completed + abandoned)`. The session list becomes the replay list: `status: completed` only, `PAGE_SIZE` 10, previous/next over a cursor stack (`next()`, `previous()`) instead of Load more, each row a `ReplayCard.astro` (`components/layout/statistics/`, reusable: href, title and caption are Alpine expression props) — `GameCard.astro`'s layout with `play-solid.svg` for the dart. `CardWrapper.astro` forwards leftover attributes so a card can take an Alpine `:href`. Page order: trend, treble rate, heatmap, session result, completion, replay.".

### Consequences
the API `volume` and `completion` sections are unchanged (other games' pages still read them; `neverStarted` stays in the `completion` metrics). Covered by the summaries, factory and session-list tests; `.astro` markup is untested (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit edits `score-summaries.test.ts`, `score-section-factories.test.ts`, `score-session-list.data.test.ts` and `register-route-data.test.ts`. `.astro` markup is untested (D101).

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-03
Supersedes: D399 in part (the `volume` section, the completion tiles and the session list's page size and Load more).
Referenced by D0402's `Supersedes:` line.
Referenced by D0404's `Supersedes:` line.

* Commit `e266cbec` (2026-10-03; message and the `decisions/frontend/alpine.md` row): rebuilt Decision Drivers and Confirmation.
