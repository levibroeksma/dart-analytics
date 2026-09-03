# Design: Deduplicate the play-data lifecycle family (F27)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F27 (partially — the play-data half only; the
Score Training/TUOD engine-pair clone is explicitly left standing, per the
finding's own recommendation).

## Problem

`npx fallow` reports 14.8% duplication (76 clone groups), concentrated in
two families:

1. An 8-clone-group / 236-line family across `five-oh-one-play.data.ts` and
   `one-twenty-one-play.data.ts`.
2. A matching 8-clone-group / 236-line family across
   `score-training-play.data.ts` and `tuod-play.data.ts`.

Both are centered on `uploadAndCompleteSession` / `playAgain` /
`computeStats`-shaped logic, and both pairs already share
`play-lifecycle.ts`'s generic `PlayLifecycleContext<TConfig, TEngine,
TResults>` machinery for everything else. The engine-pair clone (501/121
duration-bounded X01 engines vs. Score Training/TUOD's own pair) is left
alone per the finding: it's whole-class structural similarity, not
extractable blocks, and dissolves on its own if either ruleset's rules ever
diverge.

## Approach

Extract the shared `uploadAndCompleteSession`/`playAgain`/`computeStats`
pattern into generic helpers in `play-lifecycle.ts`, following the same
generic-parameterization shape `PlayLifecycleContext` already establishes
(`TConfig`, `TEngine extends GameEngine<...>`, `TResults`), rather than two
separate pair-scoped helpers. Rationale: the codebase's own precedent
(`PlayLifecycleContext`, `PlayAgainOverrides<TConfig>`) is already fully
generic across all 4+ rulesets, not pair-scoped — a single generic
extraction is more consistent with the existing architecture and leaves one
shared implementation to maintain instead of two.

Concretely:

- Identify the exact duplicated logic in each of the 4 files' `playAgain`
  (config/overrides composition, `runPlayAgain` call), `computeStats`
  (per-seat stat replay shape), and `uploadAndCompleteSession` (batch
  upload, completion status transitions, results-snapshot assembly) — using
  `npx fallow dupes` to enumerate the exact clone groups before touching
  code.
- For each clone group, extract a generic function into `play-lifecycle.ts`
  parameterized the same way `PlayLifecycleContext` is; each `*-play.data.ts`
  file's own version becomes a thin wrapper supplying its own
  `TConfig`/`TEngine`/`TResults` and any ruleset-specific callback
  (mirroring how `PlayAgainOverrides<TConfig>`'s `buildOverrides` callback
  already keeps `runPlayAgain` generic).
- Do not touch the engine-pair clone
  (`score-training.engine.module.ts`/`tuod.engine.module.ts`) — out of
  scope per the finding.

## Risk

The finding itself flags this family as "hardened days earlier by the Play
Again session-participant/config reseating fix" — the most recently
repaired, most fragile path in the app. Mitigate by:

- Running the full 501/121/Score Training/TUOD test suites (not just the
  changed files) after every extraction step, not just at the end.
- Exercising Play Again specifically (1v1 and solo) for all 4 rulesets
  before/after — this is the exact path the finding warns is fragile.
- Extracting incrementally (one function at a time: `computeStats` first as
  the lowest-risk/most mechanical, then `uploadAndCompleteSession`, then
  `playAgain` last as the highest-risk) rather than one large rewrite.

## Testing

- `cd app && npx fallow` before/after — target comfortably under fallow's
  own inferred duplication threshold (14.8% today; no new clone groups
  introduced elsewhere by the extraction).
- `cd app && npm test` full suite — no regressions; extend existing
  `*-play.data.test.ts` coverage for the new shared helpers rather than
  duplicating per-file tests (`scripts/check-test-coverage.sh`, D224).
- Manual/regression focus on Play Again (1v1 and solo) across all 4
  rulesets — the path the finding calls fragile.
- `astro check --minimumFailingSeverity hint` — 0 errors/warnings/hints
  (generics must resolve cleanly across all 4 call sites).

## Non-goals

- No change to `score-training.engine.module.ts`/`tuod.engine.module.ts`'s
  structural clone — left as-is per the finding.
- No change to `PlayLifecycleContext` itself or the 9 `*PlayContext` types
  (`app/src/lib/game/types.ts`) — that's F29's separate spec.
- No new ruleset-facing behavior — pure internal refactor, output-identical
  for every existing test case.
