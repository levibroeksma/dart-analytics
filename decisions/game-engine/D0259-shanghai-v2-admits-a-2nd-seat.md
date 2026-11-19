---
id: D0259
status: accepted
date: 2026-09-07
origin: contemporaneous
original-date:
tags: [game-engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Shanghai V2 admits a 2nd seat (guest or DartBot), completing D245's unconditional-V2 intent

## Context and Problem Statement
Issue #237 reported that Hard mode silently never applied against a DartBot opponent — the toggle stayed selectable and visibly "HARD" after a bot was seated, but the session actually created was `SHANGHAI_V1` (no `difficulty` field at all), because a 2-seat `SHANGHAI_V2` session had never been wired into `SEAT_CAPS`/`RULESET_DARTBOT` and 422s at `createSession`. A prior task closing `FINDINGS.md` F45 worked around that gap by routing any guested session back to `SHANGHAI_V1`, silently narrowing D245's own stated intent ("creates `SHANGHAI_V2` sessions rather than `SHANGHAI_V1`" — unconditionally) without its own decision entry. This decision fixes the seat-admission gap directly rather than routing around it again, for both DartBot and human-guest 1v1 — the gap was never opponent-specific, and a human 1v1 hit the identical silent-drop bug.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SEAT_CAPS` (`session-seats.service.ts`) gains `SHANGHAI_V2: 2`; `RULESET_DARTBOT` (`capabilities.ts`) gains `SHANGHAI_V2: true`. `shanghai-setup.data.ts` drops its `guested()` helper and the `SHANGHAI_V1`/`SHANGHAI_V2` ruleset-version branch entirely — every new Shanghai session is `SHANGHAI_V2`, and `configOverrides` unconditionally supplies `difficulty`; `addGuest`/`addBot` no longer reset `difficulty` back to `NORMAL`. `ShanghaiSetupForm.astro`'s difficulty toggle is unconditionally visible (no guest/bot guard) and its `allowDartbot` reads `supportsDartbot("SHANGHAI_V2")`.".

### Consequences
`ShanghaiEngine`/`foldShanghaiState`/`applyShanghaiDart` are unchanged — Hard-mode halving already folded per seat for any seat count. `shanghai-play.data.ts` is unchanged — its `RESUMABLE_RULESET_VERSIONS` set and DartBot-turn wiring already treat both ruleset versions and any active seat's `participantTypeKey` generically. `capabilities.ts`'s `RULESET_DARTBOT` doc comment is corrected to no longer claim Shanghai V2 can never seat a 2nd player (Singles Training V2 still can't — logged as `FINDINGS.md` F69, out of scope here). Test updates: `capabilities.test.ts` (`supportsDartbot("SHANGHAI_V2")` flips to `true`), `session-seats.service.test.ts` (`SHANGHAI_V2` + a `DARTBOT` seat now accepted, plus 2-seat-cap coverage), `shanghai-setup.data.test.ts` (the two tests asserting the old "forces NORMAL" contract are deleted — not repointed, since the guarantee itself is being intentionally removed — and replaced with tests proving `HARD` survives a guest/bot add). No migration or seed change: `SHANGHAI_V2`'s `ruleset_versions` row and capability rows already exist; seat-count admission is an app-level map, not a DB constraint. Full design: `docs/superpowers/specs/2026-09-07-shanghai-v2-guest-dartbot-design.md`, implementation plan: `docs/superpowers/plans/2026-09-07-shanghai-v2-guest-dartbot.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-07
