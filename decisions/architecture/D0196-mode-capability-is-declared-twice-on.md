---
id: D0196
status: accepted
date: 2026-08-08
origin: contemporaneous
original-date:
tags: [architecture, session, stage, ruleset, player, capability, input mode]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Mode capability is declared twice on purpose, and keyed on ruleset version

## Context and Problem Statement
a mode a player can select but no engine implements produces a session that cannot be played, and before this the only statement of what each engine supports was a hard-coded string comparison inside each validator. One declaration is not enough on its own: a constant alone cannot stop a direct write or a future second writer, and a table alone is unreadable from the browser, which is where the games list is filtered. Keying on ruleset version follows D03/D13 — the ruleset version is the immutable unit an engine is written against, so "501 supports the visual board" is only ever true of a particular version of the 501 rules; keying on game type would silently grant a future `501_V2` whatever `501_V1` happened to support.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "which capture/input mode pairs an engine actually implements is declared in two places that must agree. The code-side source is `RULESET_CAPABILITIES` in `app/src/lib/game/rulesets/capabilities.ts` — a cross-runtime constant in the one tree both the browser and the Worker may import (D140) — read by `supportsMode` / `capableRulesets` in the engine registry, the session-creation guard, the settings service and the games-page filter. The database-side guarantee is `ruleset_version_capabilities` (migration `0019`), filled by `seeds/0007_ruleset_version_capabilities.sql` and referenced by the composite foreign key `fk_sessions_capability` on `exercise_sessions` (migration `0020`). Capability is keyed on **ruleset version**, never on game type. What actually shipped: `501_V1` and `SCORE_TRAINING_V1` declare `RECREATIONAL + QUICK_SCORE` and `ANALYTICS + VISUAL_BOARD`; `TUOD_V1` declares `RECREATIONAL + QUICK_SCORE`; `SINGLES_V1`, `BOBS27_V1` and `DOUBLES_TRAINING_V1` declare `RECREATIONAL + DETAILED_DARTS` — not `ANALYTICS + DETAILED_DARTS`, which is what the plan asserted and what their validators contradict.".

### Consequences
adding a pair means editing both sides. A parity test (`capabilities.ts` against seed `0007`) and `database/verification/0007_capability_seed_checks.sql` fail when they drift, and `scripts/check-game-engines.sh` fails when a registered engine declares no capability at all. The apply order is now three-stage — `db:migrate` through `0019`, `db:seed` for `0007`, then `db:migrate` for `0020` — because seeds run after migrations, so no single migration can create, fill and reference the table. `0007`'s check 3 (zero undeclared `exercise_sessions`) is the precondition for `0020` and must be read by its `undeclared`/`total` detail, since an empty table passes it trivially. The declaration is not versioned per capture depth beyond the pair itself: a ruleset that later wants a third mode adds a row, never a column.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-08
