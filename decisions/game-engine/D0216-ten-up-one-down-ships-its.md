---
id: D0216
status: accepted
date: 2026-08-20
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, 501, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Ten Up One Down ships its frontend fan-out; `createPresetSetupController` gains a third opt-out

## Context and Problem Statement
TUOD was seeded with two configuration-template presets and had a working engine, but no page could reach it — the games list never showed a card, so no session could be created despite the engine, validator, and DB layer all being complete since D153. This closes that gap with the smallest possible surface: no engine, validator, or schema change, matching the approved design spec (`docs/superpowers/specs/2026-08-20-tuod-frontend-design.md`).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "TUOD's frontend lands on top of its already-shipped engine/validator/DB layer (D153): bespoke `tuodSetup`/`tuodPlay` `.data.ts` controllers (mirroring `score-training-{setup,play}.data.ts`'s D88 reconciliation, `SegmentTimer` wiring, and finish-confirm gate), `TuodSetupForm.astro`/`TenUpOneDown.astro`/`TenUpOneDownResults.astro`, the two routed pages, and `games-visibility.ts`/`register-route-data.ts` wiring. `createPresetSetupController` now has three opt-outs, each for a distinct reason: 501 and Score Training bypass it for custom starting-score/duration logic (pre-existing); TUOD bypasses it because the factory assumes exactly one seeded preset per game (`this.presets[0]`) and TUOD has two (10 Rounds, 10 Minutes) the player must pick between. `tuodSetup`'s `start()` sends the picked preset's `configurationTemplateId` as `config.source: "template"` with no `overrides` — every field but session length is locked. `games-visibility.test.ts`'s ANALYTICS assertion no longer means "every carded game": TUOD_V1 (`RULESET_CAPABILITIES.TUOD_V1 = [QUICK_SCORE]`, no `VISUAL_BOARD` pair) is the first QUICK_SCORE-only card, visible under RECREATIONAL and under ANALYTICS only while it has an active session.".

### Consequences
`docs/architecture/07-Frontend/09-Adding-A-Game.md`'s "engine-only skips" note no longer names TUOD as its example — no carded ruleset is presently in that state, so the note is phrased generically until a future ruleset re-enters it. `scripts/check-game-wiring.sh` requires every registered ruleset to be fully wired or fully absent in a single commit (half a row fails either half), so all five implementation tasks (setup controller, setup page, play controller, play page/results, wiring) landed in one commit rather than the plan's original one-commit-per-task shape.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-20
