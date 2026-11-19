---
id: D0323
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [context-system, docs, skill, gate, CI]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The game-rules gate is blocking, and a shipped date comes from the version's design spec

## Context and Problem Statement
the merge-commit alternative is unusable and unverifiable here. The repo is cloned shallow, so none of the July/August engine PRs' merge commits are reachable, and the 2026-09-17 module restructure (D308) rewrote every `app/src/modules/game/*.engine.module.ts` file's add-date to that single day — the dates a merge-based rule would read no longer relate to shipping. A spec date is also the only one of the two that satisfies the skill's own verification rule, which requires every value to be confirmed in a **named file**. Delivery spec rather than engine spec because the V1 cut test's standard is that a player can actually play: 501's engine spec is 2026-07-24 but nothing was playable until `2026-08-01-501-recreational-v1-design.md`, and TUOD has no engine-only spec at all (its engine landed under D153), so an engine-spec rule has no answer for it and could not be applied consistently. The resulting dates: Score Training 2026-07-16, 501 2026-08-01, Bob's 27 2026-08-12, Doubles Training 2026-08-13, Singles Training V1 2026-08-13 / V2 2026-08-29 / V3 2026-09-12, 121 V1 2026-08-14 / V2 2026-08-28, Shanghai V1 2026-08-14 / V2 2026-08-28, Around the Clock 2026-08-15, Ten Up One Down 2026-08-20.

## Decision Drivers
* The repo is cloned shallow, so the July and August engine PR merge commits are not reachable.
* The 2026-09-17 module restructure (D308) rewrote every engine file's add-date to a single day.
* The skill's verification rule requires every value to be confirmed in a named file.
* The V1 cut test's standard is that a player can actually play.

## Considered Options
* Date a version from the merge commit that shipped it.
* Date a version from its engine-only design spec.
* Date a version from the design spec that delivered it as playable (chosen).

## Decision Outcome
Chosen option: "all 12 files under `docs/game-rules/` are backfilled onto the D322 template contract and `scripts/check-game-rules.sh` flips its default `MODE` from `warn` to `block`; `GAME_RULES_GATE=warn` remains as a mid-edit downgrade and is not what CI runs. `Current version:`'s shipped date is **the date of the design spec under `docs/superpowers/specs/` in which that version was delivered as playable** — the frontend or full-stack delivery spec, not the engine-only one where the two landed separately. Cricket and Tactics carry `none (V1 in design)`: neither has an engine, a `game_types` row or a seeded ruleset version, so their `## Capture` sections are written as the V1 capture shape they are designed for and say so. D322's "warn-only until the backfill" consequence is discharged by this decision rather than by an edit to its block, which the append-only rule forbids.".

### Consequences
a rules file whose version ships in two halves now dates from the later half, so `Current version:` lags the engine's own decision block by days to weeks — read it as "playable since", not "coded since". The #465 contradiction is closed by correcting `Config & presets`, not `Features`: eight rulesets had `Players` locked to single player while the seat work of 2026-08-22 had already shipped 1v1 for all of them, and three of those rows now carry a version qualifier, because `SEAT_CAPS` (`app/src/services/session-seats.service.ts`) admits a second seat for `SINGLES_V1` and `121_V1` but not for `SINGLES_V2`/`V3` or `121_V2` — a doc reader must now check which ruleset version a session runs before assuming it seats an opponent. `Applies to` is assigned per row rather than per file, so a feature that only exists with an opponent (Cricket's and Tactics' points, dead numbers and win condition) drops to `V2+` behind their unshipped multiplayer, which narrows both games' stated V1 to closing the objectives and leaves their solo win condition where it already was, an open question. Two `TBD` rows resolved to `Dropped` rather than a version — Cricket's "No Doubles/Triples categories" and Shanghai's "Only active number scores" both restated a V1 rule as if it were an option — and under D-v those rows stay forever, which is the point: the reason is what stops them being re-proposed. Nothing enforces the dating rule: the gate parses `Current version:`'s shape, never checks the date against any spec, so a wrong date still passes and only this decision records where the right one comes from.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-game-rules.sh` defaults to `block` mode and `.github/workflows/quality.yml` runs it with `scripts/test-check-game-rules.sh`. The gate parses the shape of `Current version:` and never checks the date against a spec. A wrong date still passes.

## Pros and Cons of the Options
### Date a version from the merge commit
* Bad, because the shallow clone makes the merge commits unreachable, and the D308 restructure rewrote the add-dates they would be compared with.

### Date a version from its engine-only design spec
* Bad, because nothing was playable on the engine spec date: 501's engine spec is 2026-07-24 but play began with the 2026-08-01 delivery spec.
* Bad, because Ten Up One Down has no engine-only spec, so the rule has no answer for it.

### Date a version from the design spec that delivered it as playable
* Good, because it satisfies the skill's rule that every value is confirmed in a named file.
* Good, because it matches the V1 cut test's standard that a player can actually play.

## Evidence / More Information
Decided: 2026-09-19
Refines: D322

* Commit `ef48812f` (PR #470, adds the D323 row; backfills 12 files under `docs/game-rules/` and flips the `check-game-rules.sh` default mode): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
