---
id: D0485
status: accepted
date: 2026-10-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Bob's 27 Easy is `BOBS27_V2`: the same engine, no death check

## Context and Problem Statement
`Bobs27Config` is `.strict()` with no mode key and V1 is live against real session data, so a mode field would change what V1 validates (the D243/D245 rule: a shipped version is never edited in place). Never losing means the fold and outcome code need no change.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Bob's 27 Easy is a new ruleset version `BOBS27_V2` (`Bobs27V2Config` = the V1 fields plus a required literal `mode: "EASY"`), served by the same `Bobs27Engine` class through `rulesetVersionKeys` and a second factory. Easy skips the `outAtOrBelowZero` judgement only, so a seat is never `LOST`, the score may go negative, and the run ends after the bull visit (seat status `WON` means "finished the path"). 1v1 keeps the existing score-compare outcome (higher final score wins, equal is a tie); a solo run has no win or loss. Selection is a setup switch with no games-index card.".

### Consequences
no new Track policy, no migration, no results row and no replay cell. The stats section groups by `ruleset_version_key`, so Easy forms its own group. `GAME_TYPE_BY_RULESET.BOBS27_V2` keeps an Easy session in the resume deck. Tags are not versioned (`TAGS.md`), so Easy inherits `bobs-27.md`'s. Spec: `docs/superpowers/specs/2026-10-23-bobs-27-easy-design.md`; plan: `docs/superpowers/plans/2026-10-23-bobs-27-easy.md`. Rules: `docs/game-rules/rulesets/bobs-27.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-23
