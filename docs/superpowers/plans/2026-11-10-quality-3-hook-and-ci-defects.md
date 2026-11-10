# Quality 3 — Fix hook and CI defects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close five audit findings: a bypassable commit hook, PRs that run no quality job, a committed `.pyc`, mixed script modes, and unused one-time scripts.

**Architecture:** Each task is one finding with its own proof. The hook gets a fixture test in the style of `scripts/test-edit-gate.sh`, added to `quality.yml`.

**Tech Stack:** Python 3 (hook), bash, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 3, findings 5–9.

## Global Constraints

- No file under `app/` changes.
- Hook output contract stays: JSON `permissionDecision: "deny"` on stdout, exit 0; any parse error exits 0 silently.
- A removed script also loses its File Inventory row and every live reference (`check-doc-links.sh` must pass). `decisions/**` and `docs/superpowers/**` are never edited.
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- A commit message that mentions `git commit` or `git push origin main` in a heredoc must not be blocked (#824 behaviour kept).
- `git push origin feature:main` and `git push origin HEAD:main` must be blocked from any branch.
- `git commit` inside `$(…)` or after `&&`/newline on `main` must be blocked.
- Dropping the `branches` filter must not start a second run for PRs to `main`.
- `renumber-decision.sh` rewrites ids in a list of files: a removed file left in that list makes it fail.

---

### Task 1: `block-main-commit.py` sees every command form

**Files:**
- Create: `scripts/test-block-main-commit.sh`
- Modify: `.claude/hooks/block-main-commit.py`, `.github/workflows/quality.yml` (structure job, next to `Edit-gate hook fixtures`), `.claude/skills/run-all-gates/SKILL.md` (hooks list)

- [ ] **Step 1: Write the fixture test.** It builds a temp git repo, checks out `main` or `task/x`, pipes `{"tool_name":"Bash","tool_input":{"command":…}}` to the hook with `cwd` in that repo, and asserts deny/allow:

| # | Branch | Command | Expect |
| - | ------ | ------- | ------ |
| 1 | main | `git commit -m x` | deny |
| 2 | main | `git add .` ⏎ `git commit -m x` (newline) | deny |
| 3 | main | `git -C . commit -m x` | deny |
| 4 | main | `git -c user.name=a commit -m x` | deny |
| 5 | main | `(git commit -m x)` | deny |
| 6 | main | `git merge task/x` | deny |
| 7 | task/x | `git push origin HEAD:main` | deny |
| 8 | task/x | `git push -u origin task/x` ⏎ `gh pr create --base main` | allow |
| 9 | task/x | `git commit -m "docs: never git push origin main"` | allow |
| 10 | task/x | `git commit -m x` | allow |
| 11 | main | `echo "git commit"` | allow |

- [ ] **Step 2:** Run it. Expected: cases 2, 3, 4, 5 fail.
- [ ] **Step 3:** In the hook, set `BOUNDARY = r"(?:\A|[;&|\n(]\s*)"` and `GIT = r"git(?:\s+-[cC]\s+\S+)*\s+"`; build the three `is_*` tests and `push_segments` from `BOUNDARY + GIT + "commit\b"` etc.
- [ ] **Step 4: Verify.** `bash scripts/test-block-main-commit.sh` → `block-main-commit: 11 passed, 0 failed`.
- [ ] **Step 5:** Commit.

### Task 2: Stacked PRs run the quality job

**Files:**
- Modify: `.github/workflows/checks.yml`, `.github/workflows/integration.yml`

- [ ] **Step 1:** In both files delete the `branches: [main]` line under `pull_request:` (keep `paths:` in `integration.yml`).
- [ ] **Step 2: Verify.** `python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/*.yml` → no output. After pushing, open this plan's PR: exactly one `quality / structure` and one `quality / app` run on it.
- [ ] **Step 3:** Commit. State in the PR body that proof for a stacked PR arrives with the next one opened.

### Task 3: Remove committed bytecode, align modes

**Files:**
- Modify: `.gitignore`
- Delete: `scripts/__pycache__/`

- [ ] **Step 1:** `git rm -r --cached scripts/__pycache__ && rm -rf scripts/__pycache__`; append `__pycache__/` to `.gitignore`.
- [ ] **Step 2:** `git update-index --chmod=+x scripts/check-dupes.sh scripts/check-test-repointing.sh scripts/refresh-schema.sh scripts/test-check-dupes.sh scripts/test-check-test-repointing.sh scripts/test-edit-gate.sh scripts/test-reuse-lookup.sh`
- [ ] **Step 3: Verify.** `git ls-files scripts | grep -c pycache` → `0`. `git ls-files -s scripts/*.sh | grep -c '^100644'` → `0`. `bash scripts/check-test-coverage.sh` → `OK` (it imports `check_test_coverage.py`, which recreates the cache untracked).
- [ ] **Step 4:** Commit.

### Task 4: Remove the one-time ledger-split scripts

**Files:**
- Delete: `scripts/split-decisions.sh`, `scripts/verify-decision-split.sh`, `scripts/decision-front-matter.txt`
- Modify: `scripts/renumber-decision.sh`, `scripts/check-decision-ids.sh` (header comments and file list only), `docs/architecture/00-File-Inventory.md`

Keep `scripts/decision-map.txt` and `scripts/decision-row-hashes.tsv`: `check-decision-ids.sh` reads them.

- [ ] **Step 1: Prove they are unwired.** `git grep -n "split-decisions\|verify-decision-split\|decision-front-matter" -- ':!docs/superpowers' ':!decisions' ':!graphify-out'`. Expected: only comments in `check-decision-ids.sh`, the file list in `renumber-decision.sh`, the three files themselves, and File Inventory rows. Anything else: stop and report.
- [ ] **Step 2:** Delete the three files; remove them from `renumber-decision.sh`'s rewrite list; reword the two comments in `check-decision-ids.sh` that point at them; delete their inventory rows.
- [ ] **Step 3: Verify.** `bash scripts/check-decision-ids.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh` → all `OK`. `bash scripts/renumber-decision.sh` with no arguments prints its usage, not a missing-file error.
- [ ] **Step 4:** Commit; add a decision recording the removal (next id from `scripts/next-decision-id.sh`).
