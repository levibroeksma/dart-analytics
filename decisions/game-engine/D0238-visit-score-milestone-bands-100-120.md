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
<!-- backfill: pending -->

# Visit-score milestone bands (100+/120+/140+/180) are exclusive, and computed by one shared helper

## Context and Problem Statement
Issue #169 asked for a Score Training summary-modal stat set including "100+ | 120+ | 140+ | 180's." A first pass implemented this as four independent >=-threshold counts (cumulative — a single 180 would increment all four), then was corrected during spec review to exclusive bands, since a cumulative reading double- and triple-counts the same visit and does not match how these milestones are reported elsewhere in darts scoring. Declared as a shared pattern rather than a Score Training-local helper because the same milestone-band shape applies to any game whose result reports visit-total counts, not just this one — the identical duplication risk `accuracyDisplay()` (D237) was extracted to prevent a page earlier in this same file.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/src/lib/game/play-visit-stats.ts` gains `visitScoreBandCounts(turns)`, tallying completed visits into exactly one of `hundredPlus`/`oneTwentyPlus`/`oneFortyPlus`/`oneEighties` each — whichever is the *highest* threshold that visit's total meets, never more than one band per visit (a 125 counts only as `oneTwentyPlus`, not also `hundredPlus`; a 180 counts only as `oneEighties`, not also the other three). Score Training's per-seat results-modal stats (issue #169) are the first caller. Documented as Pattern 21 in `04-Architecture-patterns.md`.".

### Consequences
A game adding visit-score milestone counts to its own results modal calls `visitScoreBandCounts(turns)` rather than writing its own threshold tallies. No other engine or modal calls it yet; the pattern and this decision exist so the next one that needs it does not reinvent (or re-diverge on) the cumulative-vs-exclusive question. `app/tests/lib/game/play-visit-stats.test.ts` covers the exclusive-band behavior directly, including the 125-counts-only-as-120+ case this decision turns on.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-27
