---
id: D0319
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, gate, husky, pre-commit, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The legacy worktree path is retired, and the location rule is a gate rather than prose

## Context and Problem Statement
D312 wrote the grandfather clause with an explicit expiry — the old path stays "until the pre-D312 worktrees land" — because those worktrees held other branches' work and could not be moved by hand. The last of them, `p5-decision-id`, landed with PR #451, so the clause's precondition is spent and the text would be stale the day anyone next read it. The gate addresses the other half of D312, which named its own gap: "nothing mechanically proves a landed branch's worktree was removed, so `git worktree list` showing a worktree whose branch is merged is the signal to prune." That signal was left for a human to notice, and was not noticed — six worktrees were live when D312 was written, four of them stale. The recipe exists because the constraint was mis-diagnosed: `EnterWorktree`'s `name` argument does hardcode `.claude/worktrees/`, which is what made the old path keep reappearing, but its `path` argument accepts any worktree already registered in `git worktree list`. `.worktrees/` was therefore never unreachable from a session — the branch carrying this decision was created there to prove it — and the earlier reading, that the repo mandated a path no session could use, was wrong.

## Decision Drivers
* D312's grandfather clause expired when the last pre-D312 worktree, `p5-decision-id`, landed with PR #451.
* D312 named a gap: nothing mechanically proves a landed branch's worktree was removed.
* 6 worktrees were live when D312 was written, 4 of them stale.
* The earlier reading, that the repo mandated a path no session could use, was wrong: `EnterWorktree`'s `path` argument accepts any registered worktree.

## Considered Options
* Keep the `.claude/worktrees/` grandfather clause and the prose-only location rule (the prior state).
* Retire `.claude/worktrees/` and add `scripts/check-worktree-location.sh` (chosen).
* Make the gate fail on a checkout beside the repo (rejected).
* Make the merged-branch check fail instead of warn (rejected).

## Decision Outcome
Chosen option: "`.claude/worktrees/` is retired. Its `.gitignore` line and comment are removed, root `CLAUDE.md`'s worktree invariant drops the "worktrees already under `.claude/worktrees/` stay put until their branch lands" sentence, and `check-doc-links.sh`'s comment naming both prefixes as gitignored is corrected to one. A new gate, `scripts/check-worktree-location.sh`, makes the rule mechanical: it fails when a worktree inside the repo root sits anywhere but `.worktrees/`, and when the retired directory exists at all; it warns, without failing, when a `.worktrees/` worktree holds a branch already merged into `origin/main`. It is wired into `run-all-gates` §Always run, `quality.yml`'s structure job and `.husky/pre-commit`. Root `CLAUDE.md` gains the compliant creation recipe as its own invariant: `git worktree add .worktrees/<name> -b <branch> origin/main`, then enter with the `EnterWorktree` tool's `path` argument, never its `name` argument.".

### Consequences
the gate is scoped to worktrees *inside* the repo root, so a checkout beside the repo — `dart-analytics-superpowers-plugin`, live on `claude/superpowers-plugin-migration` — passes untouched. That is a real hole: such a checkout is exactly as invisible to the plugin's cleanup step as `.claude/worktrees/` was, and nothing here catches it. Failing on it was rejected because a separate long-lived working copy is not a task worktree and the gate would have been red from its first run, which is the advisory-gate failure mode D317 already named. The merged-branch check warns rather than fails for the same class of reason: worktrees are shared across concurrent sessions, and another session's landed branch must not block an unrelated commit — so the prune signal is delivered, but acting on it stays the owning session's job and remains unenforced. `.claude/settings.json` deliberately keeps its `Read(./.claude/worktrees/**/*)` deny and its `claudeMdExcludes` entry for the retired path, which now look like dead config and will read as such to anyone who does not find this block: `EnterWorktree({name})` can still create that directory, and the deny is what limits the damage in the window before a gate runs. Removing them is safe only once the tool stops offering the path.

### Confidence
Rationale unknown — no source found.

### Revisit When
Removing the `Read(./.claude/worktrees/**/*)` deny and the `claudeMdExcludes` entry for the retired path is safe only once `EnterWorktree` stops offering that path.

### Confirmation
`scripts/check-worktree-location.sh` runs in `.github/workflows/quality.yml` and is listed in `.claude/skills/run-all-gates/SKILL.md`. It fails on a worktree inside the repo root outside `.worktrees/`, and when `.claude/worktrees/` exists. It warns on a merged branch.

## Pros and Cons of the Options
### Keep the grandfather clause and prose rule
* Bad, because the clause's precondition was spent, and the prune signal was left for a human to notice and was not noticed.

### Retire the path and add a gate
* Good, because the location rule becomes mechanical.
* Bad, because the gate misses a checkout beside the repo, which is as invisible to the plugin's cleanup as `.claude/worktrees/` was.

### Fail on a checkout beside the repo
* Bad, because a separate long-lived working copy is not a task worktree and the gate would have been red from its first run.

### Fail on a merged-branch worktree
* Bad, because worktrees are shared across concurrent sessions, and another session's landed branch must not block an unrelated commit.

## Evidence / More Information
Decided: 2026-09-18
Refines: D312, D293

* Commit `10a22050` (PR #455, adds the D319 row and `scripts/check-worktree-location.sh`): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When and Confirmation.
