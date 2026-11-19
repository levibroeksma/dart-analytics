---
id: D0109
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `docs/game-rules/` introduced as the non-canonical home for pre-spec, human-authored

## Context and Problem Statement
Raw domain material existed with no discovery path for agents; wiring it in without promoting it to canonical status keeps architecture-first authority intact while making the input to future game-type/routine work findable

Per the spec, the folder holds 4 subfolders: `rulesets/`, `routines/`, `trivia/` and `templates/`. Root `CLAUDE.md` and the Context Map pointed at none of them.

## Decision Drivers
* Agents need a discovery path to raw domain material that exists but is registered nowhere.
* Architecture-first authority stays intact, so the material is not promoted to canonical status.

## Considered Options
* Leave the folder unregistered (the state before this record).
* One generic "raw notes, translate later" pointer for all 4 subfolders.
* Wire the folder in as non-canonical, with a landing-spot note per subfolder (chosen).

## Decision Outcome
Chosen option: "`docs/game-rules/` introduced as the non-canonical home for pre-spec, human-authored game/routine/trivia rule descriptions (rulesets, routines, trivia, authoring templates); wired into root `CLAUDE.md`, `00-Context-Map.md`, `10-Database-Agent-Guide.md`, and `docs/CLAUDE.md` for agent discoverability; deliberately exempt from the canonical status/registration rules `check-context-map.sh` enforces for `docs/architecture/`".

### Consequences
* Good, because the discovery path does not force-load the folder: the wiring adds only pointers, so agents find it without preloading it on every task.
* Neutral, because the folder is deliberately not a File Inventory row in the Context Map. Those rows carry a canonical, historical or generated status that does not apply.
* Neutral, because `trivia/` has no existing architecture pipeline, so its target stays an open engineering-workflow decision.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Testing section requires `bash scripts/check-context-map.sh` to pass after every new backtick-wrapped path reference. All cross-references to the folder use the full `docs/game-rules/...` path. `scripts/check-context-map.sh` exists today.

## Pros and Cons of the Options
### Leave the folder unregistered
* Bad, because agents asked to add a game type, build a routine feature or scope the trivia tool have no path to the raw material.

### One generic pointer for all 4 subfolders
* Bad, because it hides that `trivia/` has no home in the existing architecture, so nobody should assume one.

### Non-canonical wiring with per-subfolder notes
* Good, because each subfolder keeps its own landing spot, and `trivia/` states that no pipeline covers it yet.
* Good, because the folder stays outside the status and registration rules, so architecture-first authority is unchanged.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-game-rules-wiring-design.md` (Context, Design § 1–3, § 5, Testing): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-16-game-rules-wiring.md` (the `DECISIONS.md` step): confirmed the D109 row text.
* Commit `7e907d1f` (PR #27, 2026-07-16; adds the D109 row): landed the wiring.
