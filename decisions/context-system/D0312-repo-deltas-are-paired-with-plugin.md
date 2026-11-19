---
id: D0312
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, skill, gate, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Repo deltas are paired with plugin skills, and the repo bends where the plugin is right

## Context and Problem Statement
D311 removed the forks but left both deviations as prose in `CLAUDE.md` files, which is the weakest possible coupling for the branch-finish rule: `finishing-a-development-branch` says "Present the menu exactly as written" and "Integration is your human partner's decision" — emphatic text arriving in-context long after the line that overrides it. A paired skill fires at the same moment as the skill it modifies and costs one description line until invoked. The worktree path was a measured defect, not a preference: the plugin's Step 6 claims cleanup only for worktrees under `.worktrees/` or `worktrees/` and leaves everything else to "the host environment", so D293's `.claude/worktrees/` meant the plugin never removed a worktree it created while the invariant said one left behind is a defect — six were live when this was written, four of them stale. The brainstorming commit carve-out follows the same logic in the other direction: the blanket no-commit rule was written before the plugin owned the spec artifact, and intercepting a skill's own output is exactly the local contradiction D311 set out to stop. `app/CLAUDE.md`'s TDD section was also mis-paired, citing `verification-before-completion` when the plugin ships a `test-driven-development` skill that is the actual counterpart.

## Decision Drivers
* The plugin's cleanup step claims only worktrees under `.worktrees/` or `worktrees/`, so `.claude/worktrees/` silently defeated the cleanup invariant (commit `d43bce20` message).
* `app/CLAUDE.md`'s TDD section cited `verification-before-completion`, which was the wrong counterpart (commit `d43bce20` message).

## Considered Options
* Carry each deviation in a paired file named by a table in root `CLAUDE.md` (chosen).
* Keep worktrees under `.claude/worktrees/` (the state before this record).

## Decision Outcome
Chosen option: "each deviation from a `superpowers` plugin skill is carried in a *paired* file named by a four-row table in root `CLAUDE.md`, never as prose the reader must remember to apply and never as a copy of upstream text. The pairs: `finishing-a-development-branch` → the new `.claude/skills/finishing-a-dart-branch` skill (Step 4's menu skipped, Option 2 every time, `run-all-gates` standing in for "the test suite"); `test-driven-development` → `app/CLAUDE.md` §Test-Driven Development; `verification-before-completion` → `run-all-gates`; `executing-plans` and `subagent-driven-development` → `capturing-discovered-work`, which is preserved as-is — incidental findings become GitHub issues and are never fixed in the same pass. Where the plugin was right and the repo was not, the repo moves instead: worktrees live under `.worktrees/` (gitignored) rather than `.claude/worktrees/`, and `superpowers:brainstorming` runs unmodified — it writes its design doc to `docs/superpowers/specs/` and commits it without asking, the single named exception to the "do not commit unless the user asks" invariant. `docs/superpowers/specs/` is declared non-canonical in `00-Context-Map.md` on the same terms as `docs/game-rules/`.".

### Consequences
a plugin skill can now be read on its own without silently violating a repo rule, because the override travels with it. The pairing table is a maintenance surface: an upstream rename breaks a row, and nothing mechanically checks the four names resolve — the same version-pinning gap D311 already accepted, now with four rows instead of one prose block. `finishing-a-dart-branch` is a skill in `.claude/skills/` that shadows nothing: the name is distinct, so both it and the plugin skill stay addressable, and it carries only the delta, so there is no upstream text to drift. Two worktree homes coexist until the pre-D312 worktrees land — `.gitignore` covers both, and the older path is not migrated by hand because those worktrees hold other branches' work. Specs now enter the repo without a gate having seen them; they are historical material, already registered as one inventory row for the tree rather than per file, and rank below every numbered item in the authority order.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Root `CLAUDE.md` section "Superpowers Skills" holds the pairing table. The `.claude/skills/finishing-a-dart-branch` skill exists, and `scripts/check-worktree-location.sh` enforces the `.worktrees/` path.

## Pros and Cons of the Options
### Paired files named by a table
Rationale unknown — no source found.

### Worktrees under `.claude/worktrees/`
* Bad, because the plugin only claims cleanup for `.worktrees/`, so `.claude/worktrees/` silently defeated the cleanup invariant (commit `d43bce20` message).

## Evidence / More Information
Decided: 2026-09-18
Supersedes: D293 (worktree path only)
Refines: D311

* Commit `d43bce20` (2026-09-18; de-vendors the Superpowers skills and adds `finishing-a-dart-branch`): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md`, `docs/superpowers/plans/2026-09-18-doc-sync-gate.md`.
