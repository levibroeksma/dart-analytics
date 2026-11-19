---
id: D0220
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, fact log, 501, undo, leg, bust, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Seats live in the configuration snapshot; the active seat is always derived

## Context and Problem Statement
The schema was already multiplayer-ready — `participants`, `turns.participant_id` and `validateBatchReferences` all existed — so the only thing preventing a second thrower was `buildEventsBatch(participantRef, facts)` stamping one identity onto every turn. Two alternatives were weighed and rejected: composing N single-seat sub-engines (each engine would need to know how to merge its siblings' stages, and an X01 leg is genuinely shared, not mergeable), and a full contract reshuffle passing a seat into `record()` (a caller could then disagree with the engine about whose throw it is, and undo would need seat logic of its own). Folding wins per `sideKey` rather than per seat is what lets a future 2v2 land with no state change: sides already exist, only the pairing does not.

## Decision Drivers
* The schema already holds `participants`, `turns.participant_id` and `validateBatchReferences`; only the application layer blocks a second thrower, so no migration is required (spec, Context).
* `buildEventsBatch(participantRef, facts)` stamps one ref onto every turn, and `TurnFact` carries no participant (spec, Context).
* `FiveOhOneState` mixes three scopes (per player, per side, per session) in one flat object (spec, Context).
* A future 2v2 should need no state change, only a setup screen that pairs seats (spec, Context and sides section).

## Considered Options
* Seats in the configuration snapshot, with the active seat derived from the fact log (chosen).
* A wrapper that composes N single-seat sub-engines (rejected in the spec's Stage ownership section and in the PR #152 body).
* A full contract reshuffle that passes a seat into `record()` (rejected in the PR #152 body and the commit row).

## Decision Outcome
Chosen option: "A session's participants become an ordered `seats` array (`{ participantRef, displayName, sideKey, participantTypeKey }`) written into `exercise_configurations.configuration` at create time, in the same transaction as the participant rows. No new table: a guest is a `participants` row with a name and no cross-session identity. `TurnFact` gains a required `participantRef` that the engine mints exactly as it mints `clientKey`/`sequence`/`completedAt`, so one session's log holds several throwers; `buildEventsBatch` reads it per turn instead of stamping one ref across the whole batch. The ACTIVE seat is never stored — the shared `modules/game/seat-rota.module.ts` derives it from the fact log, offsetting the visits already thrown in the open stage from that stage's own starting seat. Every engine declares a static `stageOwnership` (`SHARED` for an X01 leg holding every seat's interleaved visits, `PER_SEAT` for one stage per seat per round) so the one rota serves both shapes. `FiveOhOneState` splits into the three scopes it actually has: `remainingScore` per seat, `legsWon` per `sideKey`, `status` per session.".

### Consequences
Every one of the nine engines is touched, because making `participantRef` required breaks all nine typechecks at once — no smaller unit compiles. Eight of them declare `PER_SEAT` and stamp seat 0; only 501 is wired for rotation, and `session-seats.service.ts` refuses a second seat for any other ruleset so no participant is persisted that nothing can throw for. `applyFiveOhOneVisit` is removed in favour of `foldFiveOhOneState(facts, config)`, which the engine and the play page now share — the play page previously carried its own duplicate `foldLegState` replay that could drift. Its guarantees moved rather than vanishing: the bust matrix, score cap and double-out cases now test `resolveFiveOhOneVisit` (exported for the purpose) and the engine directly. `Seated<TConfig>` is a conditional type, because three rulesets' snapshots are `Record<string, never>` and intersecting one with a seat array narrows `seats` to `never` — a type no value can inhabit. `record()` also had to re-derive state AFTER opening the next leg's stage: it previously returned a state folded before the push, which reported the winning seat at 0 and the others un-reset. Bull-up (deciding leg 1's starter by a throw at the bull) and per-participant capture depth are deferred; no UI sends more than one seat yet, so every session the existing screens create is still solo.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/seat-rota.module.test.ts` covers the derived active seat, and `app/tests/services/session-seats.service.test.ts` covers the seat and participant agreement the server asserts. `npm run check` type-checks the required `participantRef` on every engine.

## Pros and Cons of the Options
### Seats in the snapshot, active seat derived
* Good, because the log alone decides whose throw it is, so a caller cannot disagree with the engine (row added by commit `20ca5b31`).
* Good, because no migration is required: a guest is a `participants` row (spec, Context).

### Compose N single-seat sub-engines
* Bad, because under a `SHARED` stage each sub-engine would mint its own `leg-N` stage, producing N legs in the merged log where the board saw one (spec, Stage ownership).
* Bad, because a checkout in one sub-engine could not reset another's remaining score (spec, Stage ownership).

### Pass a seat into `record()`
* Bad, because a caller could disagree with the engine about whose throw it is, and undo would need seat logic of its own (row added by commit `20ca5b31`).

## Evidence / More Information
Decided: 2026-08-21

* Commit `20ca5b31` (PR #152, 2026-08-21; adds the D220 row to `decisions/game-engine.md`): rebuilt Pros and Cons (the rejected pass-a-seat option).
* `docs/superpowers/specs/2026-08-20-guest-player-x01-design.md` (Context, Stage ownership): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* PR #152 body (Architectural decisions): rebuilt Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-20-guest-player-x01-implementation.md`: the implementation plan the PR names; no section rebuilt.
* Applied in: `docs/superpowers/plans/2026-09-01-dartbot-5-participant-write-path.md`, `docs/superpowers/specs/2026-08-21-guest-play-ui-fixes-and-split-scoreboard-design.md`.
