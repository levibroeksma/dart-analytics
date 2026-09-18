# P5 — Decision-Id Derivation Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a decision id that went stale between authoring and merge cheap to fix — derive it against fresh `origin/main`, and renumber it repo-wide with one command.

**Architecture:** Two advisory scripts plus one step in the `context-maintenance` skill. No new CI job: `scripts/check-decision-ids.sh` already runs on every PR at the merge ref and already catches collisions. What is missing is the authoring-time derivation and the cheap fix, not the gate.

**Tech Stack:** bash, git.

**Spec:** `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §7

**Issues closed:** #386

## Global Constraints

- Branch off `main`, named `chore/p5-decision-id-tooling`. Never commit to `main`. Do not commit unless the user asks.
- Both scripts must work from a worktree under `.claude/worktrees/` **and** from the main checkout. Every script in `scripts/` starts with `cd "$(git rev-parse --show-toplevel …)"` for this reason — follow that pattern.
- Derivation must search **both** id forms. Migrated table rows (`| D123 |`) and new blocks (`### D123`) share one id space; searching only one form under-reports the maximum and re-issues a live id.
- Never renumber an id that is already on `main`. These tools only ever move an id that exists solely on the current branch.
- The 20 never-issued ids (`D18 D19 D29 D38 D39 D42 D43 D44 D45 D46 D47 D48 D49 D53 D54 D55 D56 D57 D58 D59`) are numbering artifacts. Never "fill" them.
- Match the house style of `scripts/*.sh`: `set -euo pipefail`, a header comment stating what the script proves and what it cannot, and an `OK:` / `FAIL:` final line.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `scripts/next-decision-id.sh` | print the next free id, derived against fetched `origin/main` plus the working tree |
| `scripts/renumber-decision.sh` | rewrite one id across every tracked file, reporting each file touched |
| `.claude/skills/context-maintenance/SKILL.md` | step 3 gains the re-derive-before-PR instruction |
| `docs/architecture/00-File-Inventory.md` | one row per new script |
| `decisions/context-system.md` | the derive-at-PR-time decision |

---

### Task 1: `next-decision-id.sh`

**Files:**
- Create: `scripts/next-decision-id.sh`

**Interfaces:**
- Consumes: `decisions/**.md` on `origin/main` and in the working tree.
- Produces: a single line on stdout — the next free id, e.g. `D294`. Task 2 and the skill step both call it.

- [ ] **Step 1: Cut the branch**

```bash
git checkout main
git pull
git checkout -b chore/p5-decision-id-tooling
```

- [ ] **Step 2: Record what the canonical derivation returns today**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

This is the command `DECISIONS.md` §"How to add a decision" already prescribes. Write the number down — Step 5 checks the script against it.

- [ ] **Step 3: Write the script**

Create `scripts/next-decision-id.sh`:

```bash
#!/usr/bin/env bash
# Next-decision-id helper (issue #386). DECISIONS.md's "How to add a decision"
# tells an author to derive the next id rather than guess it. The command it
# gives reads the WORKING TREE, which is correct at authoring time and stale by
# merge time: a branch cut when main was at D286 derives D287, and if two
# decisions land on main in the meantime, that id is now someone else's.
#
# This script derives against fetched origin/main UNION the working tree, so an
# id it prints is free on both. Run it when authoring a decision, and again
# immediately before opening the PR.
#
# WHAT THIS CANNOT DO: it cannot see an id that exists only on another open
# branch that has not merged. Two branches in flight can still derive the same
# id. That race is caught by scripts/check-decision-ids.sh, which CI runs on the
# pull_request MERGE ref (.github/workflows/checks.yml -> quality.yml), and is
# fixed cheaply by scripts/renumber-decision.sh. This script narrows the window;
# it does not close it, and nothing local can.
#
# BOTH ID FORMS ARE SEARCHED: migrated table rows (`| D123 |`) and block
# headings (`### D123`) share one id space. Searching one form alone
# under-reports the maximum and re-issues a live id. Both patterns are
# position-anchored for the same reason check-decision-ids.sh anchors them:
# `D18` is also darts shorthand for double 18.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

if ! git fetch --quiet origin main 2>/dev/null; then
  echo "WARN: could not fetch origin/main — deriving from the working tree only" >&2
fi

ids_from_tree() {
  git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' 2>/dev/null || true
}

ids_from_main() {
  git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' origin/main -- 'decisions/**.md' 2>/dev/null || true
}

MAX=$( { ids_from_tree; ids_from_main; } \
  | grep -oE 'D[0-9]+' \
  | sed 's/D0*//' \
  | sort -n \
  | tail -1 )

if [ -z "${MAX:-}" ]; then
  echo "FAIL: no decision ids found under decisions/ — is this the right repo?" >&2
  exit 1
fi

echo "D$((MAX + 1))"
```

- [ ] **Step 4: Make it executable**

```bash
chmod +x scripts/next-decision-id.sh
```

- [ ] **Step 5: Run it and check it against the canonical derivation**

```bash
bash scripts/next-decision-id.sh
```

Expected: exactly one line, `D<n>` where `n` is Step 2's number plus one. Any other output — a warning on stdout, more than one line — breaks the callers in Task 2 and the skill step.

- [ ] **Step 6: Prove it works from a worktree**

```bash
git worktree list
cd "$(git worktree list --porcelain | grep -m2 '^worktree ' | tail -1 | cut -d' ' -f2)" 2>/dev/null && bash scripts/next-decision-id.sh
```

Expected: the same id. If no second worktree exists, skip this step and say so — do not claim it passed.

- [ ] **Step 7: Commit**

```bash
git add scripts/next-decision-id.sh
git commit -m "chore: add next-decision-id.sh, derived against origin/main (#386)"
```

---

### Task 2: `renumber-decision.sh`

**Files:**
- Create: `scripts/renumber-decision.sh`

**Interfaces:**
- Consumes: two arguments, `<old-id> <new-id>`, each in `D<digits>` form.
- Produces: an in-place rewrite of every tracked file, plus a report of each file touched and the occurrence count.

- [ ] **Step 1: Write the script**

Create `scripts/renumber-decision.sh`:

```bash
#!/usr/bin/env bash
# Decision-id renumber helper (issue #386). When CI's check-decision-ids.sh
# reports that a branch's id collided with one main issued in the meantime, the
# fix is mechanical but spread out: the decision block itself, CLAUDE.md rule
# lines, 00-File-Inventory.md rows, .gitignore comments, plan and spec files,
# and the PR body all cite the id. Missing one leaves a dangling reference that
# no gate catches.
#
# This rewrites every tracked occurrence and reports what it touched, so the
# diff can be eyeballed before committing. The PR body is NOT rewritten — it
# lives on GitHub, not in the tree. Fix it by hand; the script reminds you.
#
# SAFETY: refuses to run with a dirty index (so the rewrite is reviewable as its
# own diff), refuses to renumber to an id that already exists anywhere, and
# never touches decisions/** blocks other than by the substitution itself —
# a renumbered id is still the same append-only block, not an edit to a
# different one.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

OLD="${1:-}"
NEW="${2:-}"

if ! [[ "$OLD" =~ ^D[0-9]+$ ]] || ! [[ "$NEW" =~ ^D[0-9]+$ ]]; then
  echo "usage: bash scripts/renumber-decision.sh <old-id> <new-id>   (e.g. D287 D291)" >&2
  exit 1
fi

if [ -n "$(git diff --cached --name-only)" ]; then
  echo "FAIL: index is not empty — commit or unstage first so the rewrite is its own diff" >&2
  exit 1
fi

if git grep -qE "^\| ${NEW} \||^### ${NEW} " -- 'decisions/**.md'; then
  echo "FAIL: ${NEW} already exists in decisions/ — derive a free id with scripts/next-decision-id.sh" >&2
  exit 1
fi

FILES=$(git grep -l "\b${OLD}\b" -- . ':!node_modules' || true)

if [ -z "$FILES" ]; then
  echo "FAIL: ${OLD} does not appear in any tracked file" >&2
  exit 1
fi

echo "Rewriting ${OLD} -> ${NEW}:"
while IFS= read -r file; do
  count=$(grep -cE "\b${OLD}\b" "$file" || true)
  perl -pi -e "s/\b${OLD}\b/${NEW}/g" "$file"
  echo "  ${file} (${count})"
done <<< "$FILES"

echo
echo "OK: rewrote ${OLD} -> ${NEW}. Two things this did NOT do:"
echo "  1. the PR body on GitHub still cites ${OLD} — edit it with 'gh pr edit'"
echo "  2. nothing was committed — review 'git diff' first"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/renumber-decision.sh
```

- [ ] **Step 3: Prove it refuses bad input**

```bash
bash scripts/renumber-decision.sh; echo "exit=$?"
bash scripts/renumber-decision.sh D287 D293; echo "exit=$?"
```

Expected: the first prints the usage line and exits 1; the second fails with `D293 already exists` and exits 1. A script that does not bite on either is not a safe tool — fix it before continuing.

- [ ] **Step 4: Prove the round trip is lossless**

Pick an id that exists only as a block, renumber it to a free id and back, then confirm the tree is unchanged:

```bash
FREE=$(bash scripts/next-decision-id.sh)
bash scripts/renumber-decision.sh D293 "$FREE"
bash scripts/renumber-decision.sh "$FREE" D293
git status --porcelain
```

Expected: `git status --porcelain` prints nothing — byte-identical round trip. Any output means the substitution is not symmetric; investigate before committing.

- [ ] **Step 5: Confirm the id gate still passes**

```bash
bash scripts/check-decision-ids.sh
```

Expected: `OK:` — the round trip left the ledger exactly as it was.

- [ ] **Step 6: Commit**

```bash
git add scripts/renumber-decision.sh
git commit -m "chore: add renumber-decision.sh for late-caught id collisions (#386)"
```

---

### Task 3: Wire it into the workflow and open the PR

**Files:**
- Modify: `.claude/skills/context-maintenance/SKILL.md` (step 3)
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `decisions/context-system.md`

**Interfaces:**
- Consumes: both scripts.
- Produces: the pre-PR re-derivation step every task now runs.

- [ ] **Step 1: Extend the context-maintenance step**

In `.claude/skills/context-maintenance/SKILL.md`, step 3 currently ends with "Run `scripts/check-decision-ids.sh` and confirm it passes before claiming the task done." Append to that same step:

```markdown
Derive the id with `bash scripts/next-decision-id.sh` (it reads fetched `origin/main` as well as the working tree, which the raw `git grep` in `DECISIONS.md` does not), and **re-run it immediately before opening the PR** — an id derived when the branch was cut is stale if any decision landed on `main` in between. If it has moved, `bash scripts/renumber-decision.sh <old> <new>` rewrites every tracked citation; the PR body needs fixing by hand.
```

- [ ] **Step 2: Register both scripts in the File Inventory**

`docs/architecture/00-File-Inventory.md` lists scripts in a table whose rows read `| path | description | status |`. Add two rows next to the other `scripts/` entries, following the existing wording style:

```markdown
| `scripts/next-decision-id.sh` | Helper: prints the next free decision id, derived against fetched `origin/main` union the working tree (both `| D<n> |` rows and `### D<n>` blocks); advisory, not a gate (2026-09-17) | canonical |
| `scripts/renumber-decision.sh` | Helper: rewrites one decision id across every tracked file when CI catches a late collision; refuses a dirty index or an already-used target id (2026-09-17) | canonical |
```

Issue #388 reports four verification scripts that were never registered here — do not repeat that, and do not fix #388 in this pass.

- [ ] **Step 3: Record the decision**

```bash
bash scripts/next-decision-id.sh
```

Append to `decisions/context-system.md` with the printed id:

```markdown
### D<next> — A decision id is derived against `origin/main`, and re-derived before the PR opens
Status: Accepted · Date: 2026-09-17
Decision: `scripts/next-decision-id.sh` derives the next free id against fetched `origin/main` as well as the working tree, and `context-maintenance` step 3 requires re-running it immediately before opening a PR. A collision caught late is fixed with `scripts/renumber-decision.sh`. No new CI job is added.
Reason: issue #386 reported PRs #381 and #382 each declaring an id that `main` had since issued to a different decision, and asked whether the check belongs pre-merge. It already is: `check-decision-ids.sh` runs from `quality.yml` on every `pull_request` to `main`, and `actions/checkout` resolves that event to the merge ref, so the uniqueness check already sees branch and `main` combined — which is how both collisions surfaced. The gap was never a missing gate; it was that both ids were correct when derived and stale by the time they landed, and that renumbering meant hand-editing every citation across `CLAUDE.md`, `00-File-Inventory.md`, `.gitignore` comments and the PR body.
Consequences: two branches in flight can still derive the same id — nothing local can see an unmerged branch's ledger. That race stays the CI gate's job; what changes is that fixing it is one command instead of a manual sweep. The ledger stays append-only: a renumbered id is the same block under a free number, never an edit to someone else's decision.
```

- [ ] **Step 4: Run the gates**

```bash
bash scripts/check-decision-ids.sh
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
cd app && npm run format:check
```

Expected: every command exits zero; report each individually.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "docs: derive decision ids against origin/main before opening a PR (#386)"
git push -u origin chore/p5-decision-id-tooling
gh pr create --base main --title "chore: decision-id derivation and renumber helpers (#386)" --body "$(cat <<'EOF'
Adds `scripts/next-decision-id.sh` (derives against fetched `origin/main` union the working tree, searching both the `| D<n> |` row form and the `### D<n>` block form) and `scripts/renumber-decision.sh` (rewrites one id across every tracked file, refusing a dirty index or an already-used target).

No new CI job. `check-decision-ids.sh` already runs on every PR at the merge ref, which is how #386's collisions were caught — the gap was authoring ergonomics and the cost of a late fix, not a missing gate.

Spec: `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §7

Closes #386

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
