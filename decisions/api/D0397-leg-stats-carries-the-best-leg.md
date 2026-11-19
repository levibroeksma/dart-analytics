---
id: D0397
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `leg-stats` carries the best leg's session id so the Best leg card links to replay (#638)

## Context and Problem Statement
the owner chose the narrowest slice of #638. Highest checkout is not a phase 2–4 section metric (it comes from the career overview), and per-key ids on the checkout family would change every bucket's shape. A wrapper object is needed because the histogram's `Record<string, number>` has no slot for a non-count field; the version bump makes cached v1 buckets refresh instead of failing to parse.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Carry per-key session ids on the checkout family.
* Wrap the histogram and carry the best leg's session id in `leg-stats` only (chosen).

## Decision Outcome
Chosen option: "`leg-stats` moves to section version 2. Its metrics become `{ legs: Record<dartsPerLeg, count>, bestLeg: { darts, sessionId } | null }`: `legs` is the old histogram, `bestLeg` the fewest-darts finished leg in the bucket (first session in input order keeps a tie). `mergeMetrics` sums `legs` and keeps the lower `bestLeg.darts` (the first argument keeps a tie). The `gameStats` store gains `bestLegSessionId`, and the Best leg card links through `replayPath`. Scope is `leg-stats` only.".

### Consequences
`leg-stats` is no longer additive on the wire, so the version bump is load-bearing. Highest checkout and the other record-style metrics remain unlinked; #638 stays open for them. `.astro` markup is untested (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/stats/merge-metrics.test.ts` covers the `bestLeg` merge, keeping the lower darts. `app/tests/stores/game-stats.store.test.ts` covers the store getter.

## Pros and Cons of the Options
### Per-key session ids on the checkout family
* Bad, because it changes the shape of every bucket.

### Wrapper object in `leg-stats`
* Good, because the version bump makes cached v1 buckets refresh instead of failing to parse.

## Evidence / More Information
Decided: 2026-10-03
Supersedes: none (extends D369, D371).

* Commit `15bc74ca` (2026-10-03, issue #638; adds the D397 row, the `merge-metrics` cases and the store test): rebuilt Considered Options, Confirmation and Pros and Cons.
