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

# Mode capability is declared twice on purpose, and keyed on ruleset version

## Context and Problem Statement
a mode a player can select but no engine implements produces a session that cannot be played, and before this the only statement of what each engine supports was a hard-coded string comparison inside each validator. One declaration is not enough on its own: a constant alone cannot stop a direct write or a future second writer, and a table alone is unreadable from the browser, which is where the games list is filtered. Keying on ruleset version follows D03/D13 — the ruleset version is the immutable unit an engine is written against, so "501 supports the visual board" is only ever true of a particular version of the 501 rules; keying on game type would silently grant a future `501_V2` whatever `501_V1` happened to support.

## Decision Drivers
* A mode a player can select but no engine implements produces a session that cannot be played.
* A constant alone cannot stop a direct write or a future second writer.
* A table alone is unreadable from the browser, where the games list is filtered.
* The ruleset version is the immutable unit an engine is written against (D03/D13).

## Considered Options
* A hard-coded string comparison inside each validator, the status quo before this decision.
* A cross-runtime constant only, or a seeded table only.
* A `CHECK` enumerating legal mode triples.
* A capability column on `game_types` or `ruleset_versions`.
* A constant plus a seeded `ruleset_version_capabilities` table with a composite foreign key, keyed on ruleset version.

## Decision Outcome
Chosen option: "which capture/input mode pairs an engine actually implements is declared in two places that must agree. The code-side source is `RULESET_CAPABILITIES` in `app/src/lib/game/rulesets/capabilities.ts` — a cross-runtime constant in the one tree both the browser and the Worker may import (D140) — read by `supportsMode` / `capableRulesets` in the engine registry, the session-creation guard, the settings service and the games-page filter. The database-side guarantee is `ruleset_version_capabilities` (migration `0019`), filled by `seeds/0007_ruleset_version_capabilities.sql` and referenced by the composite foreign key `fk_sessions_capability` on `exercise_sessions` (migration `0020`). Capability is keyed on **ruleset version**, never on game type. What actually shipped: `501_V1` and `SCORE_TRAINING_V1` declare `RECREATIONAL + QUICK_SCORE` and `ANALYTICS + VISUAL_BOARD`; `TUOD_V1` declares `RECREATIONAL + QUICK_SCORE`; `SINGLES_V1`, `BOBS27_V1` and `DOUBLES_TRAINING_V1` declare `RECREATIONAL + DETAILED_DARTS` — not `ANALYTICS + DETAILED_DARTS`, which is what the plan asserted and what their validators contradict.".

### Consequences
adding a pair means editing both sides. A parity test (`capabilities.ts` against seed `0007`) and `database/verification/0007_capability_seed_checks.sql` fail when they drift, and `scripts/check-game-engines.sh` fails when a registered engine declares no capability at all. The apply order is now three-stage — `db:migrate` through `0019`, `db:seed` for `0007`, then `db:migrate` for `0020` — because seeds run after migrations, so no single migration can create, fill and reference the table. `0007`'s check 3 (zero undeclared `exercise_sessions`) is the precondition for `0020` and must be read by its `undeclared`/`total` detail, since an empty table passes it trivially. The declaration is not versioned per capture depth beyond the pair itself: a ruleset that later wants a third mode adds a row, never a column.

* Good, because the database cannot hold an undeclared capture/input mode pair, and the code side stays readable from the browser.
* Bad, because adding a pair means editing both sides.
* Neutral, because the apply order is three-stage (`db:migrate` through `0019`, `db:seed` for `0007`, `db:migrate` for `0020`), since seeds run after migrations.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
A parity test (`app/tests/lib/game/rulesets/capabilities.test.ts`) and `database/verification/0007_capability_seed_checks.sql` fail when the constant and seed drift. `scripts/check-game-engines.sh` fails when a registered engine declares no capability. Check 3 of `0007` is read by its `undeclared`/`total` detail.

## Pros and Cons of the Options
### Hard-coded comparison in each validator
* Bad, because a mode a player can select but no engine implements produces a session that cannot be played.

### Constant only, or table only
* Bad, because a constant cannot stop a direct write or a second writer, and a table is unreadable from the browser.

### `CHECK` enumerating legal triples
* Bad, because one expression lists every game, changes by migration each time, and cannot be queried.

### Capability column on `game_types` or `ruleset_versions`
* Bad, because it claims a capability the engine may not implement, with nothing to catch the drift.

### Constant plus seeded table, keyed on ruleset version
* Good, because code owns what an engine implements and the database cannot hold an undeclared combination.
* Good, because keying on ruleset version stops a future `501_V2` inheriting what `501_V1` supports.

## Evidence / More Information
Decided: 2026-08-08

* `docs/superpowers/specs/2026-08-05-visual-board-input-design.md` (decision row 7 and "Rejected alternatives"; Database section on the two-migration split): rebuilt Context, Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-05-visual-board-capability-and-settings.md` (plan 2, Tasks 1, 1b and 2): source of Decision Outcome detail and Consequences.
* Commit `70d5b5e7` (PR #75, 2026-08-09; adds D196 to `decisions/architecture.md`): source of Context, Consequences and Confirmation. Its messages record that the brief's ANALYTICS rows for `SINGLES_V1`, `BOBS27_V1` and `DOUBLES_TRAINING_V1` were corrected to RECREATIONAL.
* Applied in: `docs/superpowers/plans/2026-08-12-bobs27-phase2-visual-board-capability.md`, `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`, `docs/superpowers/plans/2026-08-14-shanghai-v1.md`.
