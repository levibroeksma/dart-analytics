---
id: D0243
status: accepted
date: 2026-08-28
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, checkout, 501, Score Training, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# 121 V2 adds ROUNDS/MINUTES end conditions as a new ruleset version, composing with the unchanged cap-170 checkout

## Context and Problem Statement
Issue #165 asked for a way to end a 121 session as a normal `COMPLETED` game without reaching 170 or abandoning. `121_V1`'s config schema and engine behaviour are never edited in place — a new ruleset version key is the established pattern for a rule-shape change once a version has shipped against real session data (same reasoning as D236/D237's own `*_V1` additions). `scripts/check-game-wiring.sh` assumed one `GAME_CARDS` entry maps to exactly one `RulesetVersionKey`; 121 V2 deliberately shares 121 V1's existing card/route rather than rendering a second "121" tile, so the gate gained a pre-pass (`carded_code_slugs`) treating a registry key absent from `GAME_CARDS` as wired when its code slug matches a sibling key that does have a card — verified both before 121_V2 existed (unchanged green) and after (prints the new shared-slug OK line).

## Decision Drivers
* Issue #165: a 121 session can end only at the 170 checkout or by abandoning, so a player cannot stop early and still complete the game.
* `121_V1`'s config schema is `{}` and is live against real session data. Changing it would reinterpret every existing `121_V1` config snapshot.

## Considered Options
* Edit `121_V1` in place to add the end conditions.
* Add a new `121_V2` ruleset version with `duration_type` `TARGET`, `ROUNDS` and `MINUTES` (chosen).
* Keep `121_V1` as it is, with the single 170 end condition (status quo).

## Decision Outcome
Chosen option: "A new `121_V2` ruleset version (`OneTwentyOneV2Config`: `duration_type` "TARGET"/"ROUNDS"/"MINUTES", `duration_value` present only for ROUNDS/MINUTES) is registered alongside the untouched `121_V1`, both served by one `OneTwentyOneEngine` class via two `GameEngineFactory` registrations (Pattern 18) and a `durationOf()` config normalizer. Checking out the cap target (170) always wins the session immediately, in every `duration_type` — `ROUNDS`/`MINUTES` completion is an additional OR condition on top of the existing `status === "WON"` check, never a replacement for it, so `applyOneTwentyOneVisit`'s checkout mechanic needed zero changes. The pre-record finish-confirm dialog (`wouldComplete()`) predicts completion only for a checkout (climb or cap) that would close the budget; a 3rd-visit fail-reset that happens to close the budget completes silently through the existing post-record `isComplete()` safety net already present in `recordVisit`/`commitDart` — mirroring 121's existing bust-never-confirms asymmetry, and avoiding a second implementation of `settleVisit`'s bust/close boundary in a non-mutating context. `isComplete()`'s MINUTES branch snapshots the sole seat's `attemptsCompleted` at the moment `expireTimer()` is called (`attemptsCompletedAtExpiry`) and requires it to increase before reporting complete — a plain "any attempt has ever closed" check would flip true on the very next non-closing `record()` once two or more attempts had already resolved earlier in the same session, ending it mid-attempt against the design's own stated invariant that the in-flight attempt always finishes first.".

### Consequences
`OneTwentyOneSeatState` gains `attemptsCompleted` (folded, incremented on every attempt-closing branch — checkout climb, checkout at cap, 3rd-visit fail-reset); `OneTwentyOneState` gains `timerExpired`; both are always present under `121_V1` too (0-and-climbing, simply unread there) rather than being made optional, so no calling code needs a ruleset-version branch to read them. `121`'s setup controller (`oneTwentyOneSetup()`) is rewritten from `createPresetSetupController` to a hand-written controller, joining `501`/Score Training as the three games with hand-written setup contexts — `PresetSetupContext`'s own doc comment was updated to drop 121 from its "six games" list. Three new configuration-templates presets (121 — 170/10 Rounds/5 Minutes) and two capability rows ship in `seeds/0011` + an appended `seeds/0007` row pair; the two new verification scripts (`0007_capability_seed_checks.sql`'s updated counts, `0011_one_twenty_one_v2_capability_checks.sql`) require a live Neon database to run and were not executed in this session's container (D193) — flagged for the PR reviewer to run before merge. Full design and implementation plan: `docs/superpowers/specs/2026-08-28-121-rounds-timed-mode-design.md`, `docs/superpowers/plans/2026-08-28-121-rounds-timed-mode.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Edit `121_V1` in place
* Bad, because the spec says it would reinterpret every existing `121_V1` config snapshot after the fact.

### New `121_V2` ruleset version
* Good, because `121_V1` stays exactly as shipped and forever replayable, and `121_V2` is an independent contract.
* Good, because `121_V1`'s factory builds the engine with `durationType: "TARGET"`, so its behaviour is identical to before.

### Keep `121_V1` only (status quo)
* Bad, because the only exit besides the 170 checkout is "Leave game", which records the session as `ABANDONED`.

## Evidence / More Information
Decided: 2026-08-28

* `docs/superpowers/specs/2026-08-28-121-rounds-timed-mode-design.md` (Problem, Scope, Decisions, Engine): rebuilt Decision Drivers, Considered Options, Pros and Cons.
* `docs/superpowers/plans/2026-08-28-121-rounds-timed-mode.md`: named by the record as the implementation plan; not used for any section.
* Commit `7ecc77ab` (2026-08-28, adds the D243 row): the adding commit; no section rebuilt from it.
