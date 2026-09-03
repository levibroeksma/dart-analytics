# Design: Unify the 9 `*PlayContext` types onto `PlayLifecycleContext` (F29)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F29.

## Problem

`app/src/lib/game/types.ts` declares 9 near-identical `*PlayContext` types —
`Bobs27PlayContext`, `SinglesTrainingPlayContext`,
`DoublesTrainingPlayContext`, `ShanghaiPlayContext`,
`AroundTheClockPlayContext`, `FiveOhOnePlayContext`,
`OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, `TuodPlayContext` —
each hand-restating the same ~15 fields `PlayLifecycleContext<TConfig,
TEngine, TResults>` already declares (`loading`, `error`, `finished`,
`hiddenTurnKey`, `hiddenTimer`, `completionStatus`, `playAgainLoading`,
etc.), instead of being defined in terms of it. A future field added to the
shared lifecycle contract must be hand-copied into 9 places instead of one.

## Approach

Redefine each of the 9 types as an intersection:

```ts
export type XxxPlayContext = PlayLifecycleContext<
  XxxSnapshot,
  XxxEngine,
  XxxResultsSnapshot
> & {
  // per-game-only fields and methods (e.g. ScoreTrainingPlayContext's
  // scoreInput: ScoreInputBuffer, visitMarkers(), state(), etc.)
};
```

Do all 9 files in one pass rather than partially — the finding explicitly
scopes it that way ("once a task is scoped to take on that refactor across
all 9 files at once"), avoiding a mixed state where some types are
generic-based and others are still hand-restated (which would itself be a
new inconsistency worth a finding).

For each of the 9 types:

1. Identify its own `TConfig`/`TEngine`/`TResults` — generally the
   ruleset's own `XxxSnapshot`/`XxxEngine`/`XxxResultsSnapshot`, already
   named elsewhere in `types.ts` per ruleset.
2. Strip the fields that duplicate `PlayLifecycleContext`'s own (compare
   field-by-field against `PlayLifecycleContext`'s definition at
   `types.ts:247`).
3. Keep only the per-game-specific fields/methods in the intersection's
   right-hand object type.
4. Verify every existing consumer (`*-play.data.ts`'s `Alpine.data()`
   factory, any `.astro` file destructuring these fields) still typechecks
   unchanged — this is a type-level refactor; the runtime object shape each
   factory returns does not change.

## Risk

Pure type-level change — no runtime behavior differs. The risk is entirely
in `astro check`/`tsc` surfacing a field mismatch (a per-game type that
diverged slightly from `PlayLifecycleContext`'s shape without anyone
noticing, since each was hand-copied independently). Any such divergence
found during the refactor is itself worth surfacing (adjacent finding or a
one-line fix within scope, per root `CLAUDE.md`'s adjacent-edit allowance),
not silently normalized away without note.

## Testing

- `astro check --minimumFailingSeverity hint` — 0 errors/warnings/hints
  across all 9 ruleset's pages/data files.
- `cd app && npm test` full suite — no test file should need a source
  change here (`scripts/check-test-coverage.sh`, D224) unless a genuine
  field mismatch is found and fixed, in which case the covering test for
  that file is touched too.
- No new tests needed for the type change itself — TypeScript's own
  structural check is the verification; `.astro` markup isn't unit tested
  (D101).

## Non-goals

- No change to `PlayLifecycleContext` itself, `play-lifecycle.ts`'s
  implementation, or the play-data duplication (F27) — separate spec.
- No behavior change to any `*-play.data.ts` factory's returned object
  shape.
- No attempt to further generalize beyond the 9 named types (e.g. no new
  shared base for the per-game halves — only the already-shared
  `PlayLifecycleContext` portion is being reused).
