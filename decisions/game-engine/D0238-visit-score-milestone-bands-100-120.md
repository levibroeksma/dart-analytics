---
id: D0238
status: accepted
date: 2026-08-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, Score Training, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Visit-score milestone bands (100+/120+/140+/180) are exclusive, and computed by one shared helper

## Context and Problem Statement
Issue #169 asked for a Score Training summary-modal stat set including "100+ | 120+ | 140+ | 180's." A first pass implemented this as four independent >=-threshold counts (cumulative — a single 180 would increment all four), then was corrected during spec review to exclusive bands, since a cumulative reading double- and triple-counts the same visit and does not match how these milestones are reported elsewhere in darts scoring. Declared as a shared pattern rather than a Score Training-local helper because the same milestone-band shape applies to any game whose result reports visit-total counts, not just this one — the identical duplication risk `accuracyDisplay()` (D237) was extracted to prevent a page earlier in this same file.

## Decision Drivers
* Issue #169 asked for a Score Training summary stat set of 100+, 120+, 140+ and 180's (spec, Problem and Part C).
* A first pass computed 4 independent threshold counts, and spec review corrected it to exclusive bands (row added by commit `31d64ca1`).
* The milestone-band shape applies to any game whose result reports visit-total counts, so future games should follow one rule (commit `31d64ca1` message).

## Considered Options
* Four independent `>=` threshold counts, cumulative (the first pass, corrected during spec review).
* Exclusive bands from one shared helper in `play-visit-stats.ts` (chosen).
* A Score Training-local tally (row added by commit `31d64ca1` declares the pattern shared instead).

## Decision Outcome
Chosen option: "`app/src/lib/game/play-visit-stats.ts` gains `visitScoreBandCounts(turns)`, tallying completed visits into exactly one of `hundredPlus`/`oneTwentyPlus`/`oneFortyPlus`/`oneEighties` each — whichever is the *highest* threshold that visit's total meets, never more than one band per visit (a 125 counts only as `oneTwentyPlus`, not also `hundredPlus`; a 180 counts only as `oneEighties`, not also the other three). Score Training's per-seat results-modal stats (issue #169) are the first caller. Documented as Pattern 21 in `04-Architecture-patterns.md`.".

### Consequences
A game adding visit-score milestone counts to its own results modal calls `visitScoreBandCounts(turns)` rather than writing its own threshold tallies. No other engine or modal calls it yet; the pattern and this decision exist so the next one that needs it does not reinvent (or re-diverge on) the cumulative-vs-exclusive question. `app/tests/lib/game/play-visit-stats.test.ts` covers the exclusive-band behavior directly, including the 125-counts-only-as-120+ case this decision turns on.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/play-visit-stats.test.ts` has a `visitScoreBandCounts` describe block covering the exclusive-band behaviour.

## Pros and Cons of the Options
### Cumulative threshold counts
* Bad, because one visit increments several bands (a single 180 increments all four), and it does not match how these milestones are reported elsewhere in darts scoring (row added by commit `31d64ca1`).

### Exclusive bands, shared helper
* Good, because a future game reporting visit-score milestones calls the same helper instead of re-deriving cumulative versus exclusive (commit `31d64ca1` message).

### Score Training-local tally
* Bad, because the duplication risk is the one `accuracyDisplay()` (D237) was extracted to prevent (row added by commit `31d64ca1`).

## Evidence / More Information
Decided: 2026-08-27

* Commit `31d64ca1` (2026-08-27; adds the D238 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/specs/2026-08-27-score-training-previous-throw-and-summary-stats-design.md` (Problem, Part C, Testing, Context maintenance): rebuilt Decision Drivers and Confirmation.
* `docs/superpowers/plans/2026-08-27-score-training-previous-throw-and-summary-stats.md` (Architecture notes, `visitScoreBandCounts` tests): rebuilt Confirmation.
* Applied in: `docs/superpowers/specs/2026-08-28-501-match-summary-design.md`, `docs/superpowers/specs/2026-09-02-scoring-stats-correctness-design.md`.
