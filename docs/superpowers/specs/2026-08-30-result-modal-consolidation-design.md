# Result Modal Consolidation — Architecture Design

> **Date:** 2026-08-30
> **Status:** approved (brainstorming consensus)
> **Branch:** `style/ui-polish`
> **Scope:** Three consolidation issues found while restyling the 9 game result modals (`app/src/components/layout/games/result-modals/*.astro`): (1) extract the repeated `STAT_ROWS`-driven stat block into reusable components, (2) extract each modal's inline `x-text` title ternary into a readable Alpine method, (3) fix the 6 games whose results modal is still missing real 1v1 opponent stats. All three touch the same files and land on the same branch as one spec/plan cycle.
> **Out of scope:** engine/win-condition logic (already shipped, see Context), setup forms, play interfaces/scoreboards, 2v2, any gameplay change. This is a results-reporting fix, not a gameplay fix.

---

## Context

The 9 result modals (`AroundTheClockResults.astro`, `Bobs27Results.astro`, `DoublesTrainingResults.astro`, `FiveOhOneResults.astro`, `OneTwentyOneResults.astro`, `ScoreTrainingResults.astro`, `ShanghaiResults.astro`, `SinglesTrainingResults.astro`, `TenUpOneDownResults.astro`) all follow the same shape: a `STAT_ROWS` array in frontmatter, a solo `<dl>` of `StatRow`s gated by `completionStatus`, a `StatRowSkeleton` loading variant, and (for 3 of the 9) a 1v1 comparison block using `StatRowComparison`. Each modal currently hand-rolls all of this, and a `<h2 x-text="...">` with a nested ternary computing the win/tie/loss title.

The `2026-08-22-single-opponent-seat-remaining-engines-design.md` design wired real 1v1 play into the 7 engines that were solo-only (Bob's 27, 121, Around the Clock, TUOD, Shanghai, Score Training, Singles Training, Doubles Training) — every engine now derives `MultiSeatState` (`seats[]`, `winningSideKey`, `status`) from the fact log, confirmed present in the current engine source. Score Training and Shanghai's results modals already consume this correctly: their `*ResultsSnapshot` types carry `seats: XSeatResult[]`, built via a `statsFor(seat, turns)` helper mapped over every seat.

The other 6 games' results modals never received the equivalent data-layer update. Their `*ResultsSnapshot` types (`app/src/lib/game/types.ts`) are still flat, single-seat shapes, and their `buildResultsSnapshot`/`computeStats` functions (`app/src/lib/game/*-play.data.ts`) explicitly filter the fact log down to the owning player's own turns before computing stats — e.g. `around-the-clock-play.data.ts`'s `uploadAndCompleteSession` builds `ownerTurns` and never looks at the opponent's. The opponent's stats are not merely unrendered — they are never computed. This is issue 3: it requires a data-layer fix, not a template change.

---

## Issue 1 — Reusable summary components

Replace the incomplete `SinglePlayerSummary.astro` stub and add one sibling component, both in `app/src/components/layout/games/`:

### `SinglePlayerSummary.astro`

```ts
interface Props {
  statRows: readonly { label: string; key: string; fallback?: string }[];
  seatIndex?: number; // default 0
}
```

Renders two sibling blocks, both internally gated (callers no longer write `x-show` for these):

- Succeeded: `<dl x-show="completionStatus === 'succeeded' && resultsSnapshot?.seats?.length === 1">` — one `StatRow` per row, value expression built internally as `` `resultsSnapshot?.seats?.[${seatIndex}]?.${row.key}` `` (`` ?? ${row.fallback} `` appended when the row declares one, matching today's `FiveOhOneResults.astro` `checkoutPercentage` fallback).
- Loading: `<dl x-show="completionStatus === 'pending' || completionStatus === 'saving'">` — one `StatRowSkeleton` per row.

### `ComparisonSummary.astro` (new)

```ts
interface Props {
  statRows: readonly { label: string; key: string; fallback?: string }[];
}
```

Renders the 1v1 two-column block gated on `resultsSnapshot?.seats?.length === 2`: a name-header row (`$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0|1]?.participantRef)?.displayName`, unchanged from today) followed by one `StatRowComparison` per row, reading seats `[0]`/`[1]` internally the same way `SinglePlayerSummary` reads `seatIndex`.

### Per-modal result

Every modal's stat-block markup converges on:

```astro
<SinglePlayerSummary statRows={STAT_ROWS} />
<ComparisonSummary statRows={STAT_ROWS} />
```

`StatRow.astro`, `StatRowComparison.astro`, `StatRowSkeleton.astro` are unchanged — they're already correctly scoped, single-purpose leaf components. The per-modal `seatValueExpr()` helper (currently duplicated in `FiveOhOneResults.astro`, `ScoreTrainingResults.astro`, `ShanghaiResults.astro`) is deleted; its logic moves inside the two new components.

**Dependency on Issue 3:** `ComparisonSummary` and the seat-indexed path in `SinglePlayerSummary` only produce correct output once a game's `resultsSnapshot` actually carries `seats[]` — true today for FiveOhOne/ScoreTraining/Shanghai, true for the other 6 only after Issue 3 lands. This is why Issue 3 follows Issue 1 immediately in the rollout order, before Issue 2.

---

## Issue 2 — Alpine title extraction

New shared helper, `app/src/lib/game/match-result-text.ts`:

```ts
export function matchWinnerName(
  seats: readonly { participantRef: string; sideKey: string; displayName: string }[],
  winningSideKey: string | null,
): string | undefined
```

Factors out the lookup every modal currently repeats: `$store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName`.

Each `*PlayContext` type (`types.ts`) gains a `resultsTitle(this: XPlayContext): string` method; each `*-play.data.ts` factory implements it, composing `matchWinnerName()` with that game's own phrasing — copied verbatim from the current ternary, just given a name and a body instead of living inline in the template:

| Game | Phrasing kept as-is |
| --- | --- |
| Five Oh One | `'Match Summary'` / `'{name} wins the match!'` (no TIE branch — X01 has no tie) |
| Around the Clock | `'TIE'` → `'Tie — same darts!'`; else `'Session complete'` / `'{name} wins — fewest darts!'` |
| Bob's 27 | `'LOST'` → `'Game over!'`; `'WON'`/solo → `'Winner!'`; else `'{name} wins!'` — collapses today's two-`<h2>`-with-`x-show` pattern into one `x-text` |
| 121 | non-`'WON'` → `'Session complete'`; solo `'WON'` → `'170 checked out!'`; else `'{name} checks out 170!'` |
| Score Training | `'TIE'` → `'Tie — same total!'`; else `'Game Summary'` / `'{name} wins — highest total!'` |
| Shanghai | nested: not-succeeded → `'Session complete'`; `'TIE'` → `'Tie — same score!'`; solo → `'SHANGHAI'`-aware (`'Shanghai!'` vs `'Session complete'`); else `'{name} wins!'`/`'{name} hits a Shanghai!'` |
| Singles Training | `'LOST'` → `'Game over — missed the target'` (solo) / `'Game over — you missed the target'` (1v1); `'WON'` → opponent-name + `' missed the target — you win!'`; `'TIE'` → `'Tie — same points!'`; else `'Session complete'` / `'{name} wins — highest points!'` — the only modal whose title names the *losing* seat |
| Doubles Training | `'TIE'` → `'Tie — same doubles hit!'`; else `'Session complete'` / `'{name} wins — most doubles hit!'` |
| Ten Up One Down | `'TIE'` → `'Tie — same target!'`; else `'Game Summary'` / `'{name} wins — highest target!'` |

Modals become one line: `<h2 slot="title" class="..." x-text="resultsTitle()"></h2>`.

---

## Issue 3 — Data layer fix for missing 1v1 stats

Applied identically to all 6 lagging games (Around the Clock, Bob's 27, Doubles Training, 121, Singles Training, TUOD), following the Score Training precedent exactly (`statsFor(seat, turns): XSeatResult`, `app/src/lib/game/score-training-play.data.ts:71-87`):

1. **`types.ts`** — promote each flat/inline `resultsSnapshot` shape to a named pair: `XSeatResult = { participantRef; sideKey; ...that game's existing stat fields }` and `XResultsSnapshot = { status; winningSideKey; seats: XSeatResult[] }`.
2. **`*-play.data.ts`** — each game's `computeStats`/`buildResultsSnapshot` currently does `ownerTurns = turns.filter(t => t.participantRef === ownerRef)` (or `ownerSeat = state.seats.find(...) ?? state.seats[0]`) then computes stats for that one seat only. Replace with a `statsFor(seat, turns)` computed once per seat in `state.seats`, mapped into `seats: XSeatResult[]`. The per-stat math itself (`accuracyDisplay`, `targetHitCounts`, dart/visit counting, `currentTarget`/`totalPoints` reads off state) is unchanged — it already exists per-seat in engine state or is trivially filterable per-seat from `turns`; only the "which participant" scoping changes, from one to all.

   Touch list (current owner-only function → new per-seat function, same file):

   | Game | File | Current function |
   | --- | --- | --- |
   | Around the Clock | `around-the-clock-play.data.ts` | inline in `uploadAndCompleteSession` (`ownerTurns`, `accuracyDisplay`, `countHits`, `countDarts`) |
   | Bob's 27 | `bobs27-play.data.ts` | `computeStats(state, turns, ownerRef)` |
   | 121 | `one-twenty-one-play.data.ts` | `computeStats(state, turns, owner)` |
   | Doubles Training | `doubles-training-play.data.ts` | inline in `uploadAndCompleteSession` (`ownerSeat`, `hitOutcomes`) |
   | Singles Training | `singles-training-play.data.ts` | inline in `uploadAndCompleteSession` (`ownerSeat`, `targetHitCounts`) |
   | TUOD | `tuod-play.data.ts` | `computeStats(state, ownerRef)` — bespoke inline upload path, not `playUploadAndCompleteSession`; same `statsFor` treatment, wired by hand |

3. **Tests** — each touched `*-play.data.ts` gets coverage for the 2-seat path (both seats' stats present and correct) per `scripts/check-test-coverage.sh`, plus confirmation the solo (`seats.length === 1`) path is byte-for-byte unchanged — the same no-regression anchor the engine plan used.

Once this lands, `SinglePlayerSummary`/`ComparisonSummary` (Issue 1) render real opponent data for all 9 games with no further template work — each modal just switches `STAT_ROWS` to reference the new per-seat keys and drops its bespoke comparison markup.

---

## Docs & decisions

- `docs/architecture/07-Frontend/` — document `SinglePlayerSummary.astro` / `ComparisonSummary.astro` as the canonical results-summary pattern (supersedes hand-rolled `STAT_ROWS.map()` + `<dl>` per modal), and `resultsTitle()` / `matchWinnerName()` as the canonical results-title pattern.
- `docs/architecture/04-Architecture-patterns.md` (Pattern 18 area) — note all 9 rulesets' results snapshots now uniformly carry `seats: XSeatResult[]`, closing the gap the 2026-08-22 design left open (that design's Touch List named the 7 results-modal files for "show `winningSideKey`" but didn't specify the snapshot-shape change these 6 needed).
- Append-only entry in the decisions file the frontend/game-engine routing table in `DECISIONS.md` points to, recording the snapshot-shape fix as a correction to the prior design's scope.
- Run the `context-maintenance` skill once, after all three issues land — not per issue.

---

## Testing

Per `app/CLAUDE.md`: TDD, full suite every run, `npm run validate:app` before any issue is marked done, `npm run format` + `format:check` clean before any PR.

- **Issue 1**: `.astro` markup is exempt from unit testing per `app/CLAUDE.md` ("keep variant/branching logic inline in the component's own frontmatter... no Astro-component test runner", D101) — verified visually via `run` (dev server + browser) instead, across a solo game and a 1v1-capable game, both loading and succeeded states.
- **Issue 2**: no new test files — `resultsTitle()` methods are thin composition over existing state already covered by each play-data test suite; `match-result-text.ts`'s `matchWinnerName()` gets its own unit test (new, small, pure — same spirit as `match-outcome.module.test.ts`).
- **Issue 3**: new/extended tests per touched `*-play.data.ts`, per the touch list above — 2-seat stats correct for both seats, solo path unchanged.

---

## Rollout order

1. **Issue 1** — build `SinglePlayerSummary.astro` + `ComparisonSummary.astro`, wire into the 3 games already `seats[]`-shaped (FiveOhOne, Score Training, Shanghai) to prove the components against real data first.
2. **Issue 3** — data-layer fix for the 6 lagging games, then wire their modals onto the same two components.
3. **Issue 2** — title extraction across all 9, independent of 1 and 3.
4. Docs/decisions update, `context-maintenance` skill, full `validate:app` pass.

All three issues ship as one plan (task-grouped, per issue) on the current branch `style/ui-polish` — not three separate spec/PR cycles — since they share every touched file.
