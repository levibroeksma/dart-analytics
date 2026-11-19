---
id: D0311
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, skill, gate, Prettier, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Superpowers process skills come from the official plugin, never vendored

## Context and Problem Statement
the copies were forked from an older Superpowers and had drifted from the installed v6.3.0 in ways nobody chose — measured against the installed version: `subagent-driven-development` 710 diff lines, `finishing-a-development-branch` 306, `brainstorming` 181, `systemic-debugging` 52, `verification-before-completion` 34, `executing-plans` 22, `writing-plans` 15, `using-superpowers` 14. `systemic-debugging` was a misspelt directory whose `name:` front-matter already read `systematic-debugging`, so it shadowed the plugin's skill from a different path; its entire diff was Prettier table reformatting, no repo content. Every plugin update widened the gap silently and nothing in the repo could detect it: none of the eight was registered in `00-File-Inventory.md`, so no gate script ever read them. A vendored copy is only worth its maintenance cost when the fork is deliberate; five of the eight carried no repo-specific content at all. An earlier attempt at this removal (2026-09-16, uncommitted on a stale base in a sibling worktree) was lost when its work was not landed — this decision records the change on `main`'s lineage so it cannot be silently restored again.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the eight vendored copies of Superpowers process skills under `.claude/skills/` (`brainstorming`, `executing-plans`, `finishing-a-development-branch`, `subagent-driven-development`, `systemic-debugging`, `using-superpowers`, `verification-before-completion`, `writing-plans`) are deleted — 26 files, 4,481 lines. The official plugin `superpowers@claude-plugins-official` is declared in `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`) and is the sole source of those skills, invoked under their `superpowers:` prefix. `.claude/skills/` now holds only this repo's own five skills (`capturing-discovered-work`, `context-maintenance`, `graphify`, `run-all-gates`, `validate-app`). The two project deviations that lived inside the vendored copies move into `CLAUDE.md` files, where the authority order already puts them above any skill: the always-Option-2 branch finish into root `CLAUDE.md`'s new §Superpowers Skills, and the `app/` red→green→refactor cycle into `app/CLAUDE.md`'s §Test-Driven Development, which had cited the vendored copy twice. Two further deviations are dropped as redundant — `writing-plans`' worktree note restates a Hard Invariant, and its plan-save path was never a deviation at all (identical upstream).".

### Consequences
plugin skills now update without repo changes, and the repo can no longer pin a version — a breaking upstream change to `finishing-a-development-branch`'s option numbering would silently invalidate root `CLAUDE.md`'s override, which names "Option 2" by number. The plugin's `using-git-worktrees` skill returns and plugin `executing-plans` step 1 points at it; D293 already allows worktrees under `.claude/worktrees/`, so this is consistent rather than contradictory. A clone that never fetches the marketplace gets no process skills at all, where before they were in-tree — accepted because `.claude/settings.json` now declares the marketplace, making the fetch automatic rather than manual. The per-session context floor is unchanged: skills load on invocation, not at session start. Prose references to the deleted copies are re-pointed at the prefixed plugin names in `.claude/skills/run-all-gates/SKILL.md`, `00-File-Inventory.md`'s `app/CLAUDE.md` row, `05-Database/10-Database-Agent-Guide.md` and `docs/game-rules/README.md`; historical mentions inside `docs/superpowers/plans/**` and `00-Context-Map-History.md` are left as written, being provenance rather than live pointers.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
