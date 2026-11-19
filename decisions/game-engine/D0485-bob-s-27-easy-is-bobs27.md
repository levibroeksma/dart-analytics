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

# Bob's 27 Easy is `BOBS27_V2`: the same engine, no death check

## Context and Problem Statement
`Bobs27Config` is `.strict()` with no mode key and V1 is live against real session data, so a mode field would change what V1 validates (the D243/D245 rule: a shipped version is never edited in place). Never losing means the fold and outcome code need no change.

## Decision Drivers
* Easy is a beginner mode with the same path, scoring and bull rule as Traditional, where the score may go negative and nobody dies.
* Easy has no win or loss in solo; in 1v1 the higher final score wins and equal scores tie.
* The mode is a setup switch only, with no new games-index card.
* `BOBS27_V1` stays untouched beside the new version.

## Considered Options
* Add a `mode` key to `Bobs27Config`.
* Add `BOBS27_V2` as a new ruleset version served by the same engine class (chosen).

## Decision Outcome
Chosen option: "Bob's 27 Easy is a new ruleset version `BOBS27_V2` (`Bobs27V2Config` = the V1 fields plus a required literal `mode: "EASY"`), served by the same `Bobs27Engine` class through `rulesetVersionKeys` and a second factory. Easy skips the `outAtOrBelowZero` judgement only, so a seat is never `LOST`, the score may go negative, and the run ends after the bull visit (seat status `WON` means "finished the path"). 1v1 keeps the existing score-compare outcome (higher final score wins, equal is a tie); a solo run has no win or loss. Selection is a setup switch with no games-index card.".

### Consequences
no new Track policy, no migration, no results row and no replay cell. The stats section groups by `ruleset_version_key`, so Easy forms its own group. `GAME_TYPE_BY_RULESET.BOBS27_V2` keeps an Easy session in the resume deck. Tags are not versioned (`TAGS.md`), so Easy inherits `bobs-27.md`'s. Spec: `docs/superpowers/specs/2026-10-23-bobs-27-easy-design.md`; plan: `docs/superpowers/plans/2026-10-23-bobs-27-easy.md`. Rules: `docs/game-rules/rulesets/bobs-27.md`.
* Neutral, because the results title carries the Easy distinction: a solo run reads "Run complete!" instead of a win or loss.
* Neutral, because every V1 golden stays unchanged and new Easy goldens are added.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/bobs27.engine.module.test.ts` and `app/tests/modules/game/bobs27.golden.test.ts` check the engine, including V1 behaviour. `app/tests/modules/stats/sections/bobs27-survival.module.test.ts` checks the Easy stats group.

## Pros and Cons of the Options
### Add a `mode` key to `Bobs27Config`
* Bad, because V1 is live against real session data, so a mode field would change what V1 validates.

### New ruleset version `BOBS27_V2`
* Good, because the V1 key, schema and factory stay untouched, and golden and V1-replay tests guard against V2 leaking into V1 sessions.
* Good, because the stats section groups by `ruleset_version_key`, so Easy runs never mix with Traditional runs.
* Bad, because seat status `WON` means "finished the path" under Easy, so result copy must never say "win" for a solo Easy run.

## Evidence / More Information
Decided: 2026-10-23

* `docs/superpowers/specs/2026-10-23-bobs-27-easy-design.md` (§ 1, § 2, § 4, § 7, § 9, § 11): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `cf459c29` (PR #1072, 2026-10-24; adds the D485 row and the Easy tests): confirmed Confirmation.
