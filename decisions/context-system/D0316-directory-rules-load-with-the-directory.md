---
id: D0316
status: superseded
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, gate, branch, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0349
---

# Directory rules load with the directory; app/CLAUDE.md keeps only what is app-wide

## Context and Problem Statement
`app/CLAUDE.md` was loaded in full on every `app/` task while roughly a third of it applied to one directory. The trigger already existed and was already proven here — `database/CLAUDE.md` opens by telling the reader which context pack to load, and fires only when `database/` is touched. What the repo lacked was coverage: two narrow directories had guides while `services/`, `components/`, `stores/`, `modules/` and `tests/` — where most work happens — had none. Extending a mechanism every gate already understands beat introducing a second one for the same job, which is why the research report's nine `.claude/rules/` files became one: four of the nine duplicated directory guides that already exist. The single glob is not a preference — `*.engine.module.ts` spans `modules/game/` and `modules/training/exercises/`, so no directory boundary expresses it.

## Decision Drivers
* `app/CLAUDE.md` loaded in full on every `app/` task, while roughly a third of it applied to one directory.
* The directory-triggered guide mechanism already existed: `database/CLAUDE.md` fires only when `database/` is touched.
* `services/`, `components/`, `stores/`, `modules/` and `tests/` had no guides, though most work happens there.
* `*.engine.module.ts` spans `modules/game/` and `modules/training/exercises/`, so no directory boundary expresses it.

## Considered Options
* Add the research report's 9 `.claude/rules/` files.
* Add 5 directory guides and 1 path-scoped rule file for the engine glob (chosen).

## Decision Outcome
Chosen option: "five directory guides are added — `app/src/services/`, `app/src/components/`, `app/src/stores/`, `app/src/modules/training/` and `app/tests/` — each with the mandatory `AGENT.md` pointer stub, joining the two that already existed under `app/src/`. The `GameEngine` contract moves to `.claude/rules/game-engines.md`, scoped by `paths: ["**/*.engine.module.ts", "app/src/modules/game/**"]`. `app/CLAUDE.md` loses the style non-negotiables, the Alpine and store clauses of the Handbook line, both engine Non-Negotiables, the Astro upstream link list and two TDD detail bullets — 145 lines to 104, counting the graphify trim in D315. Every relocated rule is deleted from `app/CLAUDE.md` in the same commit that adds it elsewhere. `scripts/check-doc-links.sh` derives its `CLAUDE.md`/`AGENT.md` scan set from `git ls-files` instead of a hardcoded list.".

### Consequences
what moves is decided by when a rule must fire, not by how much text it saves. Test *placement* stays in `app/CLAUDE.md` because a directory guide loads on read and placement is needed before the first read; the red→green→refactor procedure stays for the same reason, and remains the sole definition (D99). That principle caps the reachable saving well above the research report's ~55–60 line target and above this branch's own spec figure of ~85–90; the measured landing point is 104 lines, and chasing a smaller number would mean deleting rules that genuinely are app-wide. `.claude/rules/game-engines.md` rests on a mechanism confirmed by a live probe before this branch committed to it — `strings` on binary 2.1.236 shows the identifiers exist, which is not evidence of semantics; the probe put a marker behind `paths: ["**/*.engine.module.ts"]`, saw it arrive in a fresh session that read `bobs27.engine.module.ts` and not in one that read `lib/utils/route-class.ts`, and the documented fallback — rehoming the contract into `app/src/modules/game/CLAUDE.md` and accepting the duplication the glob avoided — went unused. Seven directory guides now exist under `app/`, each a maintenance surface: a rule that belongs in two of them is a signal it belongs in `app/CLAUDE.md` instead. Nothing here is mechanically provable — no gate can assert that a guide was read when its directory was opened. The honest measure is `/context` before and after, which is an observation, not a test.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Superseded. Commit `980aab86` added `.claude/rules/game-engines.md`; commit `b019f99c` removed it and added `app/src/modules/game/CLAUDE.md`. The 5 directory guides remain: `app/src/services/`, `app/src/components/`, `app/src/stores/`, `app/src/modules/training/` and `app/tests/` each hold a `CLAUDE.md`. `scripts/check-doc-links.sh` derives its scan set from `git ls-files`.

## Pros and Cons of the Options
### Add the report's 9 `.claude/rules/` files
* Bad, because 4 of the 9 duplicate directory guides that already exist (`database/CLAUDE.md`, `docs/CLAUDE.md`).

### Add 5 directory guides and 1 path-scoped rule file
* Good, because it extends a mechanism every gate already understands instead of introducing a second one for the same job.
* Bad, because 7 directory guides now exist under `app/`, each a maintenance surface.
* Bad, because no gate can assert that a guide was read when its directory was opened.

## Evidence / More Information
Decided: 2026-09-18

* Commit `980aab86` (adds the D316 row; adds the 5 guides and `.claude/rules/game-engines.md`): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` (Architecture, "Why not the report's nine `.claude/rules/` files", Branch 3): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-09-18-path-scoped-rules.md` (Task 8): holds the D316 text.
* Superseded by D0349. Commit `b019f99c` (its message calls the record D348) retired `.claude/rules/` and moved the `GameEngine` contract to `app/src/modules/game/CLAUDE.md`.
