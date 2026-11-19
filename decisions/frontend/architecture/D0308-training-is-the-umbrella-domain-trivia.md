---
id: D0308
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [frontend/architecture, barrel, types]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `training/` is the umbrella domain; trivia and exercises are its sub-domains

## Context and Problem Statement
D265 retired "trivia" as a UI category — Quick Subtract is a flat card under `/training`, a sibling of Balanced Training — but only the page routes moved, leaving three source folders named after an IA that no longer exists (issue #297). `/training` bundles trivia tools and routine exercises, so one umbrella with named sub-domains says what the app is, where three flat siblings said what it used to be.

## Decision Drivers
* Issue #297: three source folders still carried the retired "trivia" label after D265.
* `/training` bundles trivia tools and routine exercises, so one umbrella names what the app is.
* `check-type-barrels.sh` rule 2 allows a barrel to raise only a direct child.

## Considered Options
* Keep three flat sibling folders named `trivia/`, `exercise/` and the flat `training/`.
* One `training/` umbrella with `trivia/`, `exercises/` and `routines/` children (chosen).
* Fold trivia into exercises. The spec rejects this: trivia stays its own domain.

## Decision Outcome
Chosen option: "`lib/`, `modules/` and `components/layout/` each carry one `training/` domain with three children — `trivia/`, `exercises/`, `routines/`. `docs/architecture/09-Training/` and `docs/game-rules/training/` mirror it. `components/layout/games/`, `services/exercise-rulesets/` and `docs/game-rules/rulesets/` stay outside the umbrella.".

### Consequences
the type-barrel chain gained a level — `training/types.ts` is now a pure barrel raising its three children, and the routine declarations live in `training/routines/types.ts`, because `check-type-barrels.sh` rule 2 forbids raising a grandchild. `services/exercise-rulesets/` keeps its name and does not mirror `lib/training/exercises/`: the two sit on opposite sides of the Worker/browser boundary and were never a mirrored pair. Games are not training, so `components/layout/games/` stays where it is.

* Good, because the source tree no longer names an information architecture D265 retired.
* Neutral, because `training/types.ts` becomes a pure barrel and the routine declarations move into `training/routines/types.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's acceptance list (§ 3.5) names `check-context-map.sh`, `check-doc-links.sh`, `check-file-locations.sh`, `check-alias-sync.sh`, `check-type-barrels.sh` and `check-context-budget.sh`. All must pass.

## Pros and Cons of the Options
### Three flat sibling folders

* Bad, because the folder names describe an IA that no longer exists.

### One `training/` umbrella (chosen)

* Good, because it keeps trivia a domain next to the routine exercises, as `/training` bundles both.
* Bad, because the type-barrel chain gains a level to satisfy rule 2.

### Fold trivia into exercises

* Bad, because the spec says trivia is preserved as a domain and does not become an exercise.

## Evidence / More Information
Decided: 2026-09-17
Refines: D261, D265

* `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` (§ 3.1–3.5): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-17-p1-training-taxonomy.md` (Architecture, Decision text): rebuilt Consequences.
* Commit `b30e4cc9` (PR #419, 2026-09-17; moves the folders and adds the row).
