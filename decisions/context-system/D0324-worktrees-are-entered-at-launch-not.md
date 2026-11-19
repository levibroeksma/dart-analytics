---
id: D0324
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, gate, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Worktrees are entered at launch, not mid-session, and a WorktreeCreate hook puts them where the invariant requires

## Context and Problem Statement
the repo mandated a worktree path that the harness charges an unsuppressable prompt to enter. The documented rule is explicit — "When Claude enters a path outside the repository's `.claude/worktrees/` directory, Claude Code asks for your approval first … An `EnterWorktree` permission rule or choosing 'don't ask again' doesn't suppress this prompt; only `bypassPermissions` mode skips it." `.worktrees/` is outside that directory by construction, and `.claude/worktrees/` is the path D319 retired and `scripts/check-worktree-location.sh` fails on, so the two rules could not both be satisfied by any permission setting. Moving creation to launch time removes the entry event rather than the prompt: `superpowers:using-git-worktrees` Step 0 detects the session is already in a linked worktree and skips creation, so the plugin skill needs no repo delta for this. The hook contract was established by probe on 2.1.267, not from the documentation, whose hook reference gives an input schema (`repo_root`, `branch`, `worktree_path`) and a JSON stdout contract that the running binary contradicts: stdin carries `session_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `hook_event_name` and `name`, and a command hook echoes a bare path — "command: echo the path to stdout; http/callback: return hookSpecificOutput.worktreePath". Three probes passed: a bare name created `.worktrees/hookprobe` on `worktree-hookprobe`, rerunning the same name reopened it, and `chore/slash-probe` created `.worktrees/chore/slash-probe` on that branch. The binary's "dot segments" refusal proved to be about `.` and `..` spellings, not a leading-dot component.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.claude/settings.json` gains a `WorktreeCreate` hook running `.claude/hooks/worktree-create.sh`, which creates `<main checkout>/.worktrees/<name>` branched from `origin/main` and echoes the path. `claude --worktree <name>` therefore lands in the mandated location by default. A name containing `/` becomes the branch verbatim (`chore/foo` → `.worktrees/chore/foo` on `chore/foo`); a bare name becomes `worktree-<name>`; reusing a name reopens the existing worktree. Root `CLAUDE.md`'s creation invariant is rewritten around launching into a worktree, and a second invariant records that entering one mid-session always costs an approval prompt. No `WorktreeRemove` counterpart is configured: without one Claude Code falls back to `git worktree remove`, which is correct for a real linked worktree.".

### Consequences
`--worktree` is now the sanctioned entry point and `EnterWorktree` by `path` is the fallback for a worktree that already exists, still at one prompt per call. Whether `EnterWorktree`'s `name` argument now routes through the hook is documented but unverified here, because the prompt it raises cannot be exercised non-interactively; the rule against that argument therefore stands unchanged. The hook is a second place that encodes `origin/main` as the base and `.worktrees/` as the location, alongside the gate and the prose — a rename would have to change all three, and nothing cross-checks them. A separate finding surfaced while probing and is not fixed here: the workspace is untrusted in `~/.claude.json`, so Claude Code ignores all 15 `permissions.allow` entries in `.claude/settings.json` and prompts for commands the repo already allows. That is machine-local state, not repo configuration, and is resolved by accepting the trust dialog once in the main checkout.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
Refines: D319, D312
