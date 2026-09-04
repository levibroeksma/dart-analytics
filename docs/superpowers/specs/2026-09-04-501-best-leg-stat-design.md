# 501 "Best leg" stat — design

Status: approved
Date: 2026-09-04

## Purpose

Add a "Best leg" stat row to the 501 match-summary modal for 1v1 games (guest
or DartBot opponent): the fewest darts a seat's side needed to win any leg it
won. A side that never won a leg (single-leg loss, or a whitewash) shows "—".

## Scope

1v1 comparison view only. `FiveOhOneResults.astro`'s shared `STAT_ROWS` (feeds
both `SinglePlayerSummary` and `ComparisonSummary`) is untouched; a new row is
appended only for the `ComparisonSummary` call. Solo games are unaffected.

## Placement

New row `{ label: "Best leg", key: "bestLeg" }`, positioned immediately after
"Legs won" — both are leg-scoped stats, ahead of the visit-average/score-band
rows.

## Computation

### `legResultsOf` (new, exported from `five-oh-one.engine.module.ts`)

```
legResultsOf(facts: EngineFacts, config: Seated<FiveOhOneSnapshot>):
  { sideKey: string; participantRef: string; darts: number }[]
```

One entry per completed leg (stage), naming the winner and the dart count
that winner's side used across all its visits in that leg.

- Reuses the existing (currently unexported) `foldLeg` to find each leg's
  winner — no reimplementation of checkout/fold logic. `foldLeg` is exported
  for this purpose; its behavior is unchanged.
- Per-visit dart count: `turn.darts.length` when populated (VISUAL_BOARD —
  exact), else `config.maxDartsPerTurn` (QUICK_SCORE). This mirrors the
  existing approximation convention in `play-visit-stats.ts`'s
  `dartsThrownCount`. QUICK_SCORE turns carry no dart rows by deliberate,
  documented design (`FiveOhOneVisitInput`'s doc comment: "never persisted,
  because a turn under quick score carries no dart rows") — persisting exact
  checkout dart counts there would be a schema change and is out of scope.
- All stages in a completed match's fact log are decided legs (the engine
  only pushes a new leg stage after a won, non-final leg), so no filtering
  for "in progress" is needed at the point this is called.

### `buildResultsSnapshot` (`five-oh-one-play.data.ts`)

- Calls `legResultsOf(facts, config)` once.
- Per seat: filters results to that seat's `participantRef`, takes the
  minimum `darts`; `bestLeg = "—"` when there are no entries (side won zero
  legs), else `String(minimum)`.
- "—" (em dash) matches the existing missing-value convention already used
  by `checkoutPercentage`'s fallback and `previousScoreDisplay` — not a
  literal `-` hyphen character.

## Type change

`FiveOhOneSeatResult` (`lib/game/types.ts`) gains `bestLeg: string`.

## Data flow

`$store.game.stages` + `$store.game.turns` (already available at
match-complete time) → `legResultsOf` → per-seat minimum →
`FiveOhOneSeatResult.bestLeg` → rendered by the existing generic
`StatRowComparison` via the new row's `key: "bestLeg"`.

## Error handling

None needed — pure derivation over an already-validated, immutable fact log.
No new failure modes.

## Testing

- `tests/modules/game/five-oh-one.engine.module.test.ts`: `legResultsOf` —
  winner identification, dart counts under QUICK_SCORE (max-darts
  approximation) and VISUAL_BOARD (exact `darts.length`), multi-leg matches.
- `tests/lib/game/five-oh-one-play.data.test.ts` /
  `tests/lib/game/five-oh-one-legs.test.ts`: `buildResultsSnapshot`'s
  `bestLeg` field — single-leg loss → "—", whitewash loser → "—", normal
  match with legs on both sides → correct per-seat minimum.

## Non-goals

- No change to solo (`SinglePlayerSummary`) games.
- No schema change to persist exact QUICK_SCORE checkout dart counts.
