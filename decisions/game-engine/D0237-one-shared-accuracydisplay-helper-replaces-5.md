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

# One shared `accuracyDisplay()` helper replaces 5 duplicated hit-rate rounding implementations

## Context and Problem Statement
Issue #173 reported Doubles Training's accuracy rounding to multiples of 10% — a symptom of `Math.round((hits/darts)*100)` against a small denominator, not a miscalculation. Four of the five hit-rate call sites used that whole-number rounding; only Around the Clock already formatted to 2 decimals, via its own locally-scoped `accuracyLabel`. Fixing Doubles Training alone would have left 4 near-identical, independently-drifting implementations in place — the same shape of duplication D232 already found and consolidated once for engine turn-log/seat-derivation mechanics.

## Decision Drivers
* Issue #173: Doubles Training's accuracy landed on multiples of 10%, because `Math.round` runs against a small denominator (design spec, Problem).
* The user wants 2 decimal places, and the logic was duplicated across 5 files (plan, Goal).
* The issue asks for consistency across all accuracy previews in the application (design spec, Alternatives considered).

## Considered Options
* Change each `Math.round` to `.toFixed(2)` in place, with no shared helper (rejected in the design spec).
* Limit the fix to fields labeled "Accuracy", skipping Singles Training's "Hit percentage" and Bob's 27's "Double hit rate" (rejected in the design spec).
* One shared `accuracyDisplay(hits, darts)` helper used at all 5 call sites (chosen).

## Decision Outcome
Chosen option: "`app/src/lib/game/play-visit-stats.ts` gains `accuracyDisplay(hits, darts): string`, formatting a hits/darts percentage to exactly 2 decimal places (`"0.00%"` when `darts === 0`). Around The Clock's, Bob's 27's, Shanghai's, Doubles Training's and Singles Training's `*-play.data.ts` result-computation code all call it instead of their own inline `Math.round`/`toFixed` arithmetic. Documented as Pattern 20 in `04-Architecture-patterns.md`.".

### Consequences
All 5 games now render exactly 2 decimal places for their hit-rate percentage, including the zero-darts fallback (previously an inconsistent bare `"0%"` in 3 of the 5 call sites, now `"0.00%"` everywhere). No field was renamed and no `.astro` template changed — every result modal already rendered its field's string value as-is. `app/tests/lib/game/play-visit-stats.test.ts` gained direct coverage for `accuracyDisplay`; the five call sites' own tests were updated to the new 2-decimal string values, not re-pointed at different inputs.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/play-visit-stats.test.ts` has an `accuracyDisplay` describe block, and the plan's step list updates each call site's own tests to the 2-decimal strings.

## Pros and Cons of the Options
### Inline fix per file
* Good, because the diff is smaller (design spec, Alternatives considered).
* Bad, because it leaves 5 near-identical implementations that can drift again (same section).

### Scope to "Accuracy" fields only
* Bad, because it does not satisfy the issue's ask for consistency across all accuracy previews (same section).

### Shared `accuracyDisplay()` helper
* Good, because every game renders the same 2-decimal format, including the `"0.00%"` zero-darts fallback (record Consequences, from commit `601cc28c`).
* Good, because no `.astro` template changes: result modals already render the field's string value (design spec, Decision).

## Evidence / More Information
Decided: 2026-08-27

* Commit `601cc28c` (2026-08-27; adds the D237 row and Pattern 20): adds the row; no section rebuilt.
* `docs/superpowers/specs/2026-08-27-accuracy-formatting-design.md` (Problem, Decision, Alternatives considered): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-27-accuracy-formatting.md` (Goal, Task 1 tests): rebuilt Decision Drivers and Confirmation.
