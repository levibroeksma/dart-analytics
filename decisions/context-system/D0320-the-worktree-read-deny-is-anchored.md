---
id: D0320
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, gate, branch, PR, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The worktree Read deny is anchored at the session directory, and entering the worktree is what lifts it

## Context and Problem Statement
#447 reported the deny made the worktree workflow unusable — `cat`, `awk` and `Read` on `.worktrees/path-scoped-rules/app/CLAUDE.md` all failed — and proposed dropping the deny or adding a per-session `settings.local.json` allow. A live probe on Claude Code 2.1.267 reproduced the failure only from the main copy: with the session in the repo root, `Read` on `.worktrees/worktree-read-deny/CLAUDE.md` returned "File is in a directory that is denied by your permission settings" and Bash `head` on the same path was denied; after `EnterWorktree({path})` both succeeded on the same file, and after `ExitWorktree` both were denied again. The permissions docs state the rule: `path` or `./path` is "relative to current directory", `/path` to the settings source, which in a worktree session is the worktree itself. #447 was filed at 14:49 on 2026-09-18, between D314 landing the deny (PR #443, 14:23) and D319 landing the `EnterWorktree({path})` recipe (PR #455, 21:00) — the reporting session read its worktree from the main copy, the only condition under which the failure reproduces. The deny therefore does what D314 asked: an agent in the main copy cannot load a second copy of a file it already has, and an agent that has entered its worktree sees only that copy. Dropping it would give up the guardrail to fix a recipe gap; a per-session local allow would add a file per branch to fix the same gap.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.claude/settings.json` keeps `Read(./.worktrees/**/*)` unchanged. Root `CLAUDE.md`'s worktree recipe gains the fact that makes it usable: a `./path` rule resolves against the session's current directory, so the deny blocks `.worktrees/**` only from a session whose directory is the main working copy; once `EnterWorktree` (`path` argument) moves the session into the worktree the pattern names `<worktree>/.worktrees/**`, which does not exist, and every file in the worktree reads normally. The deny also covers the Bash file commands Claude Code recognises (`cat`, `head`, `tail`, `sed`), so `cd .worktrees/<name> && cat …` from the main copy is denied as well. Closes #447.".

### Consequences
the guardrail is one-directional. Inside worktree A, `./.worktrees/**` names nothing, so A can read sibling worktree B via `../B/…` or the main copy via `../../…`; nothing blocks that, and a `//` absolute anchor was rejected because it would bake a machine path into shared settings. The recipe's `path` step is now load-bearing for reads, not only for placement: a session that skips it is blocked on its first read, which is the designed signal, but the error text names a permission setting rather than the recipe, so the reader has to know to look here. The probe is manual — nothing in the gate set exercises harness permission semantics, and a future Claude Code change to `./` anchoring would surface only as a re-report of #447.

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
Refines: D314, D319
