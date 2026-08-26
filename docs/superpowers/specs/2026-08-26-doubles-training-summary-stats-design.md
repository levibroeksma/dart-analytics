# Doubles Training — Summary Modal Stats (Issue #133) — Design

Status: approved (brainstorming). Source: `app/src/lib/game/doubles-training-play.data.ts`,
`app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`,
`app/src/modules/game/doubles-training.engine.module.ts`, `app/src/modules/game/types.ts`
(`DoublesVisitOutcome`), `docs/game-rules/rulesets/doubles-training.md`.

## Why

Issue #133 ("Summary doubles training"): the single-player results modal shows Hits/Misses but not
which dart of the visit scored the hit, and no accuracy figure. A visit ends the instant a hit
lands (1st or 2nd dart) or after 3 misses, so darts-thrown-per-visit varies — accuracy must be
against darts actually thrown, not a fixed 21×3.

Scope note: issue #133's own wording ("a round ends early when a target is hit on 1st or 2nd")
describes Doubles Training's early-visit-end rule specifically, not Bob's 27 (which always throws a
fixed 3 darts/visit, no early stop) — confirmed with the user during brainstorming. This design is
Doubles Training only.

## Scope

In: single-player results-modal stats for Doubles Training (`DoublesTrainingResults.astro`,
`doubles-training-play.data.ts`).

Out: Bob's 27, Singles Training, or any other ruleset. Multiplayer win/tie logic (unchanged —
stats section already scopes to the owning `PLAYER` seat regardless of seat count, same as today).
No engine, schema, or migration change: `DoublesVisitOutcome.hitDartNumber` (`1 | 2 | 3 | null`) is
already captured per visit by the engine (`doubles-training.engine.module.ts`), so this is a
results-snapshot computation + modal-markup change only.

## `resultsSnapshot` shape

`doubles-training-play.data.ts` extends the existing inline type and the object built in
`uploadAndCompleteSession`:

```ts
resultsSnapshot: {
  hits: number;
  on1st: number;
  on2nd: number;
  on3rd: number;
  accuracy: string;   // e.g. "67%", "0%" when no darts thrown
  misses: number;
  winningSideKey: string | null;
  status: "COMPLETE" | "TIE";
} | null
```

Computed from `ownerSeat.outcomes` (`DoublesVisitOutcome[]`), same spot that already derives
`hits`/`misses`:

- `on1st` / `on2nd` / `on3rd` = count of outcomes where `hit && hitDartNumber === 1 / 2 / 3`
  respectively. Every hit outcome falls into exactly one bucket, so `on1st + on2nd + on3rd ===
  hits`.
- `accuracy` = `hits / dartsThrown`, where
  `dartsThrown = outcomes.reduce((sum, o) => sum + (o.hit ? o.hitDartNumber : 3), 0)` — a hit visit
  only threw as many darts as the hit took; a miss visit always threw all 3. Formatted `"0%"` when
  `dartsThrown === 0`, else `` `${Math.round((hits / dartsThrown) * 100)}%` `` — same formatting
  precedent as `bobs27-play.data.ts`'s `doubleHitRate` and `singles-training-play.data.ts`'s
  `hitPercentage` (both inline, no shared formatter — matching that existing duplication rather
  than introducing a new abstraction for a third caller).

## Modal (`DoublesTrainingResults.astro`)

Add four `StatRow` entries between the existing `Hits` and `Misses` rows: `On 1st`, `On 2nd`,
`On 3rd`, `Accuracy`. Final row order: Hits, On 1st, On 2nd, On 3rd, Accuracy, Misses. No new
component — `StatRow` (`label`/`value` props) already covers this shape.

## Testing

TDD per `app/CLAUDE.md`. `doubles-training-play.data.test.ts` already exact-`toEqual`s
`resultsSnapshot` in its `uploadAndCompleteSession` cases (e.g. "captures the final hits/misses
split in resultsSnapshot") — these are updated in place to include the four new fields (test
subject unchanged, assertion widened — not a re-pointed test per the root `CLAUDE.md` invariant).
New cases added for:

- A visit hit on the 2nd or 3rd dart (current fixtures only exercise 1st-dart hits) — asserts
  `on2nd`/`on3rd` land in the right bucket and `accuracy` reflects the extra darts thrown.
- A full-miss visit mixed with hit visits — asserts `misses` and `accuracy`'s denominator both
  account for the 3 darts a miss visit always throws.
- Zero-darts-thrown edge case (if reachable pre-completion) — `accuracy` stays `"0%"`, not `NaN%`.

No `.astro` component test (D101 — `.astro` markup logic is untested by project convention).

## Considered and rejected

- **Shared `outcomeStats()` helper** — no other ruleset consumes `DoublesVisitOutcome`-shaped data
  today; a helper with one caller is premature abstraction (YAGNI).
- **Push the breakdown into the engine's `state()` / `DoublesTrainingSeatState`** — the engine's own
  contract keeps only the raw fact log authoritative; `hitCountFor`/`missCountFor` already establish
  that per-dart display stats are computed in the play-data layer, not the engine.

## Out of scope / deferred

- Bob's 27 and Singles Training summary modals — untouched.
- Any change to Doubles Training's engine, capture rules, or database schema.
