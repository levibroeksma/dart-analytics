---
id: D0449
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [game-engine, 501, leg]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Single-set 501 keeps `decidingSet` true; only the subtitle flag is dropped

## Context and Problem Statement
the only set is the one that can end the match, so the margin applying is correct; the flag is noise because it says nothing a one-set match does not already imply. Changing the fold would alter rules behaviour for a display problem.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "with `sets` first to 1, `decidingSet` from the match fold stays true from the first leg, so the Win-by-2 DECIDING_SET margin scope applies to the only set. The play subtitle omits the DECIDING SET flag when the set race target is 1.".

### Consequences
`fiveOhOneSubtitle` carries the single-set check; `match-format.module.ts` is unchanged. Rules: `docs/game-rules/rulesets/501.md`. Issue #906.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-11
