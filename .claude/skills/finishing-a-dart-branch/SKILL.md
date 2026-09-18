---
name: finishing-a-dart-branch
description: Use together with superpowers:finishing-a-development-branch on this repo — replaces that skill's Step 4 menu with Dart Analytics' fixed choice (Option 2, push and open a PR, every time) and names the gates that stand in for "run the test suite".
---

# Finishing a Dart Analytics Branch

The delta only. Everything `superpowers:finishing-a-development-branch` says still applies except where contradicted below.

## Step 1 is wider than "the test suite"

`npm test` alone does not prove this repo green. Invoke the `run-all-gates` skill — it dispatches the `check-*.sh` scripts and `validate:app` by changed area, and each result is reported explicitly. A gate failure stops the finish exactly as a test failure does.

## Step 4: skip the menu — Option 2, every time

Do not present the three options. Do not ask which one. Go straight to **Push and Create PR**.

The Hard Invariant in root `CLAUDE.md` already requires every completed task's branch to reach `main` via PR promptly, so there is no choice left to offer. Option 1 (merge locally) is forbidden outright — `main` is never merged into directly.

- **Open the PR, don't just push.** After `git push -u origin <branch>`, create the PR immediately; check for a PR template first.
- **Drive it to green.** Where the harness offers `subscribe_pr_activity`, call it on the new PR right away. Either way the posture is "PRs you created — yours to drive": for every CI failure or review comment, push a fix or reply explaining why not. Never leave a wake silent.
- **Never `--no-verify`.** A pre-commit or pre-push hook failure is fixed at its cause and re-staged, never bypassed.

## Step 6: cleanup

Unchanged — Option 2 preserves the worktree for PR iteration. It is removed once the branch lands; a worktree still present after its PR merges is a defect (D293, D312).

## Everything else is upstream

Step 2 (detect environment), Step 3 (confirm the base branch), the discard path and its typed `discard` confirmation are unchanged. Read them there.
