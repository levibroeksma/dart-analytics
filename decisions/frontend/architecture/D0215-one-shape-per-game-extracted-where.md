---
id: D0215
status: accepted
date: 2026-08-19
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# One shape per game, extracted where measurement found a clone and written down where it did not

## Context and Problem Statement
D182 accepted mirrored duplication with two samples and named "a third same-shaped game" as the revisit trigger; D208 and D209 paid down the play-data half of that debt once CI made it a hard failure. The setup half was never revisited, and by the ninth ruleset it had reached six byte-identical files: 961 lines of setup controller and 749 of validator carrying roughly 160 lines of game-specific fact between them. The measurable cost is not the line count but the silence — `bobs27.validator.ts` and `shanghai.validator.ts` differ in 37 lines, of which the only structural difference is that `DEFAULT_MAX_TURN_SCORE` sits at line 19 in one and line 96 in the other, and each validator's doc comment cites a *different* sibling as the file it mirrors. A change to shared behaviour was five or six edits, and an agent making four of them introduced a divergence no test could catch, because each game's suite only ever exercises that game. `play.data.ts` was measured too and deliberately excluded: 189 to 643 lines with no pair closer than 461 differing lines is real per-game rules logic, and extracting from it would invent a shape rather than record one.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Two behaviour-preserving extractions plus one exemplar doc and one gate. `lib/game/setup-controller.ts` (`createPresetSetupController`) absorbs the preset setup skeleton six games repeated verbatim — Bob's 27, Shanghai, 121, Around the Clock, Singles Training, Doubles Training — parameterised by four facts (`gameTypeKey`, `rulesetVersionKey`, `playHref`, `label`) and one optional seam (`configOverrides`, used only by the two training games for `order_mode`/`target_order`). `services/rulesets/three-dart.validator.ts` (`createThreeDartValidator`) absorbs the shared assertions five three-dart validators repeated, parameterised by `label`, `configSchema` and a required `dartlessIssue`. `docs/architecture/07-Frontend/09-Adding-A-Game.md` states the 26-file fan-out, names `bobs27` the reference exemplar, and records the route-slug/code-slug split as forced rather than sloppy. `scripts/check-game-wiring.sh` (gate 13 pre-commit, 17 in CI `structure`) holds the six shared registries against each other. `501` and Score Training keep hand-written setup controllers, and `<game>-play.data.ts` is left entirely alone.".

### Consequences
The 819 existing tests passed unmodified through both extractions, which is the proof that they were behaviour-preserving — a test edited to accommodate an extraction would have been a behaviour change in disguise. Three details of the design spec did not survive the compiler and the plan corrected them: the generic self-typed `PresetSetupContext<Self>` is rejected as a circular type alias (TS2456) so the base type is non-generic and the self-type parameter lives on the factory instead; `overrides` belongs to `createSession`'s `config`, not to `startSessionInput`; and `dartlessIssue` had to become a third required field because the five validators ship three distinct message bodies, two of which a default would have silently reworded. The gate derives both slugs rather than carrying a table — code slug from the validator's directory, route slug from the `href` `games-visibility.ts` already declares — so a ninth game needs no gate edit. What it still cannot prove is that anyone read the exemplar; that boundary is stated in the script's own header.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-19
