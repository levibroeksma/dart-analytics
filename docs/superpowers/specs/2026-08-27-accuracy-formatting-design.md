<!--
status: historical
scope: design record for issue #173
read-when: never (superpowers specs are not part of the context-load path)
updated: 2026-08-27
-->
# Accuracy Formatting Consistency — Design

Source: GitHub issue #173 ("Rounding issue summary doubles training").

## Problem

Accuracy/hit-rate percentages (`hits / darts * 100`) are computed
independently in 5 places. 4 of them round to a whole number via
`Math.round(...)`; one (`around-the-clock-play.data.ts`) already formats to
2 decimals via `.toFixed(2)`. Because Doubles Training's denominator is
often a multiple of 10 (darts thrown), its `Math.round` output only ever
lands on multiples of 10% — the reported symptom. The underlying defect is
duplicated, inconsistent formatting logic, not a single miscalculation.

## Decision

Extract one shared helper, `accuracyDisplay(hits, darts): string`, into
`app/src/lib/game/play-visit-stats.ts` — the existing home for shared
display-formatting helpers (`perVisitAverageDisplay`,
`threeDartAverageDisplay`). It always formats to exactly 2 decimal places
(`"33.33%"`, `"50.00%"`, `"0.00%"` when `darts === 0`), matching
Around-the-Clock's existing behavior.

All 5 call sites are updated to use the shared helper instead of their own
inline calculation:

| File | Field | Current |
| ---- | ----- | ------- |
| `around-the-clock-play.data.ts` | `accuracy` (`accuracyFor`, session snapshot) | local `accuracyLabel`, `.toFixed(2)` — behavior unchanged, delegates to shared helper |
| `bobs27-play.data.ts` | `doubleHitRate` | `Math.round(...)`  → 2 decimals |
| `shanghai-play.data.ts` | `accuracy` | `Math.round(...)` → 2 decimals |
| `doubles-training-play.data.ts` | `accuracy` | `Math.round(...)` → 2 decimals |
| `singles-training-play.data.ts` | `hitPercentage` | `Math.round(...)` → 2 decimals |

No field renames. No `.astro` changes — result-modal components already
render the field's string value directly (`resultsSnapshot?.accuracy`,
etc.), so the display updates automatically once the underlying string
format changes.

## Alternatives considered

- **Inline fix per file** (change each `Math.round` to `.toFixed(2)` in
  place, no shared helper): smaller diff, but leaves 5 near-identical
  implementations that can drift again — this duplication is exactly what
  produced today's inconsistency. Rejected.
- **Scope to only fields labeled "Accuracy"** (skip Singles Training's "Hit
  percentage" and Bob's 27's "Double hit rate"): doesn't satisfy the
  issue's explicit ask for consistency across "all accuracy previews in the
  whole application." Rejected.

## Documentation

Add **Pattern 20** to `docs/architecture/04-Architecture-patterns.md`,
following the existing Pattern 19 ("Shared Reveal-Then-Clear Preview")
template: states that any hits/darts percentage is computed once via
`accuracyDisplay()`, always to 2 decimals, never a local
`Math.round`/`toFixed` reimplementation. Bump the doc's version header per
its own convention.

## Testing

- New unit tests for `accuracyDisplay` in
  `app/tests/lib/game/play-visit-stats.test.ts`: zero darts, exact
  percentage, repeating-decimal percentage.
- Update existing hardcoded whole-number percent assertions in
  `bobs27-play.data.test.ts`, `shanghai-play.data.test.ts`,
  `doubles-training-play.data.test.ts`, `singles-training-play.data.test.ts`
  (e.g. `"100%"` → `"100.00%"`, `"0%"` → `"0.00%"`).
  `around-the-clock-play.data.test.ts` already expects 2-decimal strings
  and needs no assertion changes, only re-verification.

## Out of scope

- `average` fields (Score Training, 121, 501) — these are point averages,
  not hit-rate percentages, and already use a separate 1-decimal
  convention (`play-visit-stats.ts`'s `threeDartAverageDisplay`). Issue
  #173 is about accuracy percentages specifically.
