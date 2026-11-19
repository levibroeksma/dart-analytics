---
id: D0474
status: accepted
date: 2026-10-20
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0357
superseded-by:
---
<!-- backfill: pending -->

# Switching Target Scoring is erased; Chain returns as a second ruleset version of Switching

## Context and Problem Statement
the erased type had exactly one active player and the author authorised destroying its data, so a tombstoned type carried only cost — a dead row in every catalog read, a dead branch in every registry, a dead rules file. Chain and Standard are the same exercise seen at two difficulties, not two exercises: one card, two configs is what the catalog should show. Putting the mode in the configuration instead would change Standard's stored JSONB and therefore its step fingerprint, restarting the stats trend of the one thing this merge had to preserve.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the `SWITCHING_TARGET_SCORING` exercise type is **erased**, not superseded — app code, both databases (migration `0048`), the live documentation and the client stats cache. Its rules return as the **Chain** config of the surviving `SWITCHING` type: a second ruleset version, `SWITCHING_CHAIN_V1` (seed `0044`), under the same exercise type rather than a type of its own, so `SWITCHING` now ships two system templates — Standard (Beginner, `SWITCHING_V1`) and Chain (Intermediate). The config is carried by the **ruleset version key**, never by the step configuration: Standard's stored `default_configuration` is untouched, so its `step_key` fingerprint (`v_stats_routine_step_facts`, migration `0045`) is unchanged and every player's Standard trend survives. `DartExerciseKind` becomes composite — `SWITCHING:STANDARD` and `SWITCHING:CHAIN` — and a routine step keys on its exercise type unless its ruleset version names an adapter of its own, which is how Chain reaches `SwitchingChainPanel.astro`. `app/tests/scripts/erasure.test.ts` keeps the erased name out of every path that is not append-only history.".

### Consequences
`migrate:down` for `0048` is a comment only — nothing is left to restore from (D472). Seed `0045` rewrites the type description so the single card blurb covers both configs. The stats cache version bumps to 5 so no client reads a kind that no longer exists. The two configs are the labelled Difficulty pair D473's grammar allows. A third Switching config is another ruleset version, not a configuration key. Spec: `docs/superpowers/specs/2026-10-19-switching-merge-design.md`; plan: `docs/superpowers/plans/2026-10-19-switching-merge.md`; rules: `docs/game-rules/training/exercises/switching.md`. Issue #799.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-20
