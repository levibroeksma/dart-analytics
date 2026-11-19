---
id: D0237
status: accepted
date: 2026-08-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# One shared `accuracyDisplay()` helper replaces 5 duplicated hit-rate rounding implementations

## Context and Problem Statement
Issue #173 reported Doubles Training's accuracy rounding to multiples of 10% — a symptom of `Math.round((hits/darts)*100)` against a small denominator, not a miscalculation. Four of the five hit-rate call sites used that whole-number rounding; only Around the Clock already formatted to 2 decimals, via its own locally-scoped `accuracyLabel`. Fixing Doubles Training alone would have left 4 near-identical, independently-drifting implementations in place — the same shape of duplication D232 already found and consolidated once for engine turn-log/seat-derivation mechanics.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/src/lib/game/play-visit-stats.ts` gains `accuracyDisplay(hits, darts): string`, formatting a hits/darts percentage to exactly 2 decimal places (`"0.00%"` when `darts === 0`). Around The Clock's, Bob's 27's, Shanghai's, Doubles Training's and Singles Training's `*-play.data.ts` result-computation code all call it instead of their own inline `Math.round`/`toFixed` arithmetic. Documented as Pattern 20 in `04-Architecture-patterns.md`.".

### Consequences
All 5 games now render exactly 2 decimal places for their hit-rate percentage, including the zero-darts fallback (previously an inconsistent bare `"0%"` in 3 of the 5 call sites, now `"0.00%"` everywhere). No field was renamed and no `.astro` template changed — every result modal already rendered its field's string value as-is. `app/tests/lib/game/play-visit-stats.test.ts` gained direct coverage for `accuracyDisplay`; the five call sites' own tests were updated to the new 2-decimal string values, not re-pointed at different inputs.

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
