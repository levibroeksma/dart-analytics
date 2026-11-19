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

# One shape per game, extracted where measurement found a clone and written down where it did not

## Context and Problem Statement
D182 accepted mirrored duplication with two samples and named "a third same-shaped game" as the revisit trigger; D208 and D209 paid down the play-data half of that debt once CI made it a hard failure. The setup half was never revisited, and by the ninth ruleset it had reached six byte-identical files: 961 lines of setup controller and 749 of validator carrying roughly 160 lines of game-specific fact between them. The measurable cost is not the line count but the silence — `bobs27.validator.ts` and `shanghai.validator.ts` differ in 37 lines, of which the only structural difference is that `DEFAULT_MAX_TURN_SCORE` sits at line 19 in one and line 96 in the other, and each validator's doc comment cites a *different* sibling as the file it mirrors. A change to shared behaviour was five or six edits, and an agent making four of them introduced a divergence no test could catch, because each game's suite only ever exercises that game. `play.data.ts` was measured too and deliberately excluded: 189 to 643 lines with no pair closer than 461 differing lines is real per-game rules logic, and extracting from it would invent a shape rather than record one.

## Decision Drivers
* A new game touches 26 files across 9 trees, and 6 of them are shared registries that a half-wired game falls through silently, because no doc lists them and no gate checks them.
* Six setup files and five validators repeat near-identical code: 961 and 749 lines carrying roughly 160 lines of game-specific fact.
* A fix to shared behaviour is 5 or 6 edits, and a missed edit escapes the tests, because each game's suite exercises only that game.
* `play.data.ts` is real per-game rules logic, so extracting from it would invent a shape rather than record one.

## Considered Options
* Leave the copying in place.
* Extract the setup skeleton and the three-dart validator assertions, write the exemplar doc and add the wiring gate (chosen).
* Also extract from `<game>-play.data.ts`.
* Also route the 501 and Score Training setup controllers through the new factory.

## Decision Outcome
Chosen option: "Two behaviour-preserving extractions plus one exemplar doc and one gate. `lib/game/setup-controller.ts` (`createPresetSetupController`) absorbs the preset setup skeleton six games repeated verbatim — Bob's 27, Shanghai, 121, Around the Clock, Singles Training, Doubles Training — parameterised by four facts (`gameTypeKey`, `rulesetVersionKey`, `playHref`, `label`) and one optional seam (`configOverrides`, used only by the two training games for `order_mode`/`target_order`). `services/rulesets/three-dart.validator.ts` (`createThreeDartValidator`) absorbs the shared assertions five three-dart validators repeated, parameterised by `label`, `configSchema` and a required `dartlessIssue`. `docs/architecture/07-Frontend/09-Adding-A-Game.md` states the 26-file fan-out, names `bobs27` the reference exemplar, and records the route-slug/code-slug split as forced rather than sloppy. `scripts/check-game-wiring.sh` (gate 13 pre-commit, 17 in CI `structure`) holds the six shared registries against each other. `501` and Score Training keep hand-written setup controllers, and `<game>-play.data.ts` is left entirely alone.".

### Consequences
The 819 existing tests passed unmodified through both extractions, which is the proof that they were behaviour-preserving — a test edited to accommodate an extraction would have been a behaviour change in disguise. Three details of the design spec did not survive the compiler and the plan corrected them: the generic self-typed `PresetSetupContext<Self>` is rejected as a circular type alias (TS2456) so the base type is non-generic and the self-type parameter lives on the factory instead; `overrides` belongs to `createSession`'s `config`, not to `startSessionInput`; and `dartlessIssue` had to become a third required field because the five validators ship three distinct message bodies, two of which a default would have silently reworded. The gate derives both slugs rather than carrying a table — code slug from the validator's directory, route slug from the `href` `games-visibility.ts` already declares — so a ninth game needs no gate edit. What it still cannot prove is that anyone read the exemplar; that boundary is stated in the script's own header.

* Good, because the 819 existing tests pass unmodified through both extractions, which is the proof they preserve behaviour.
* Neutral, because 501 and Score Training keep hand-written setup controllers, and `<game>-play.data.ts` is left entirely alone.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The plan holds the 819 existing tests green and unmodified through both extractions, checked with `git status --short app/tests/`. It requires the `fallow` duplication percentage to fall below the baseline measured in Task 0. It proves the gate against fixtures before wiring it, and `.github/workflows/quality.yml` runs `scripts/check-game-wiring.sh` today.

## Pros and Cons of the Options
### Leave the copying in place
* Bad, because a shared-behaviour fix stays 5 or 6 edits, and a missed edit escapes every test.

### Two extractions, one exemplar doc and one gate
* Good, because the 6 setup files and 5 validators collapse onto 2 factories parameterised by a few game-specific facts.
* Good, because the gate derives the code slug from the validator's directory and the route slug from the `href` in `games-visibility.ts`, so a ninth game needs no gate edit.
* Bad, because the gate cannot prove anyone read the exemplar, a boundary the script's own header states.

### Also extract from `<game>-play.data.ts`
* Bad, because the files run 189 to 643 lines with no pair closer than 461 differing lines, so an extraction would invent a shape.

### Also route 501 and Score Training through the factory
* Bad, because both replace `start` wholesale, and routing them through the factory needs one hook per branch, which is the factory dissolving into its callers.

## Evidence / More Information
Decided: 2026-08-19

* `docs/superpowers/specs/2026-08-19-consistency-design.md` (Problem, Scope, § 1–6): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-19-consistency.md` (Global Constraints, Three corrections, Tasks 0 and 6–8): rebuilt Decision Drivers and Confirmation. The plan measures 26 files where the spec says 25.
* Commit `b0fe9685` (2026-08-19; adds the D215 row): confirmed the decision text.
* Applied in: `docs/superpowers/specs/2026-08-28-components-dedup-design.md`, `docs/superpowers/plans/2026-08-28-components-dedup.md`, `docs/superpowers/plans/2026-08-21-iconbtn.md`.
