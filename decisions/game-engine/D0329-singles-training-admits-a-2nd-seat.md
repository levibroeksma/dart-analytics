---
id: D0329
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Singles Training admits a 2nd seat on `SINGLES_V3`, the same fix D259 made for Shanghai

## Context and Problem Statement
Issue #290, the twin of #237 that D259 fixed for Shanghai. Hard/Extreme and Accuracy stayed visibly selected after a guest or DartBot was seated, but the session actually created was `SINGLES_V1` — whose `difficulty` is `z.enum(["EASY"])` with no `scoring_mode` field at all — because a 2-seat `SINGLES_V3` session had never been wired into `SEAT_CAPS`/`RULESET_DARTBOT` and 422s at `createSession`. Hiding the toggles when guested was rejected for the same reason D259 rejected it: it freezes 1v1 at Easy/Standard forever and routes around the seat-admission gap instead of closing it. The gap was never opponent-specific — a human 1v1 hit the identical silent-drop.

## Decision Drivers
* A 2-seat `SINGLES_V3` session was never wired into `SEAT_CAPS`/`RULESET_DARTBOT`, so the setup screen downgraded a guested session to `SINGLES_V1` (commit `ba50c9b6` message).
* `SINGLES_V1`'s `difficulty` is EASY-only and it has no `scoring_mode`, while the toggles still showed Hard/Extreme or Accuracy as selected (same message).
* D259 made the same fix for Shanghai (issue #237) (same message).

## Considered Options
* Hide the difficulty and scoring toggles when a guest or DartBot is seated (rejected in the Context, for the reason D259 rejected it).
* Admit a 2nd seat on `SINGLES_V3` in `SEAT_CAPS` and `RULESET_DARTBOT` (chosen).

## Decision Outcome
Chosen option: "`SEAT_CAPS` (`session-seats.service.ts`) gains `SINGLES_V3: 2`; `RULESET_DARTBOT` (`capabilities.ts`) gains `SINGLES_V3: true`. `singles-training-setup.data.ts` drops its `guested()` helper and the `SINGLES_V1`/`SINGLES_V3` ruleset-version branch entirely — every new Singles Training session is `SINGLES_V3`, and `configOverrides` unconditionally supplies `order_mode`/`target_order`/`difficulty`/`scoring_mode`; `addGuest`/`addBot` are gone, so neither resets `difficulty` to `EASY` or `scoringMode` to `STANDARD`. `SinglesTrainingSetupForm.astro`'s difficulty and scoring toggles stay unguarded (the scoring toggle keeps its existing `captureModeKey === 'ANALYTICS'` guard, which is about capture mode, not seats) and its `allowDartbot` reads `supportsDartbot("SINGLES_V3")`.".

### Consequences
`SinglesTrainingEngine`/`foldSinglesTrainingState` are unchanged — HARD/EXTREME elimination and Accuracy ring scoring already fold per seat for any seat count. `singles-training-play.data.ts` is unchanged — its `RESUMABLE_RULESET_VERSIONS` set already holds all three versions and its DartBot wiring treats any active seat's `participantTypeKey` generically. `SINGLES_V2` is now absent from both maps on its own terms: no setup screen creates a session on it, so its old "still broken" comment (the retired `FINDINGS.md` F69) is replaced rather than re-pointed. Test updates: `capabilities.test.ts` (`supportsDartbot("SINGLES_V3")` flips to `true`, the `RULESET_DARTBOT` roster grows to eleven, the V2 rejection keeps its assertion with a corrected rationale), `session-seats.service.test.ts` (`SINGLES_V3` joins the 2-seat/3rd-seat-rejected cases and accepts a `DARTBOT` seat), `singles-training-setup.data.test.ts` (the four tests asserting the old "resolves `SINGLES_V1` and forces `EASY`/`STANDARD`" contract are deleted, not re-pointed — the guarantee itself is intentionally removed — and replaced with two proving `HARD`/`EXTREME` plus `ACCURACY` survive a guest add and a bot add). No migration or seed change: `SINGLES_V3`'s `ruleset_versions` row and capability rows already exist (`seeds/0018`, `seeds/0007`); seat-count admission is an app-level map, not a DB constraint. Existing `SINGLES_V1`/`SINGLES_V2` sessions keep resuming and replaying unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/session-seats.service.test.ts` covers `SINGLES_V3` seat admission, including a `DARTBOT` seat. `app/tests/lib/game/rulesets/capabilities.test.ts` covers the `RULESET_DARTBOT` roster. `app/tests/lib/game/singles-training-setup.data.test.ts` covers difficulty and scoring surviving a guest add.

## Pros and Cons of the Options
### Hide the toggles when guested
* Bad, because it freezes 1v1 at Easy/Standard and routes around the seat-admission gap instead of closing it (row added by commit `ba50c9b6`).

### Admit a 2nd seat on `SINGLES_V3`
* Good, because the engine and play data stay unchanged: both fold per seat for any seat count (commit `ba50c9b6` message).
* Good, because no migration or seed change is needed; seat-count admission is an app-level map (row added by commit `ba50c9b6`).

## Evidence / More Information
Decided: 2026-09-19

* Commit `ba50c9b6` (2026-09-19, fixes #290; adds the D329 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-09-07-shanghai-v2-guest-dartbot.md` (D259 references): the Shanghai precedent the commit names; no section rebuilt.
