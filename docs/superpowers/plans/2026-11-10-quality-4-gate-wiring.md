# Quality 4 — Path-scoped pre-commit and a gate-wiring check

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A docs-only commit takes under 15 s instead of ≈ 110 s, and a new gate script can no longer be left out of CI or the `run-all-gates` skill.

**Architecture:** The pre-commit list moves to `scripts/precommit-gates.tsv` (`script<TAB>path-regex`). A gate with a regex runs only when a staged path matches; an empty regex means always. CI keeps running every gate on every PR, so scoping can only delay a failure, never hide it. `scripts/check-gate-wiring.sh` asserts the lists agree.

**Tech Stack:** POSIX sh (husky), bash.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 3, findings 10–11.

## Global Constraints

- No gate script's logic changes; only when it runs.
- CI (`quality.yml`) is the full run and is not scoped.
- `.husky/pre-commit` stays POSIX `sh` and keeps the `main` refusal and the lint-staged step as they are.
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- A commit that stages a gate script itself must run that gate: every regex includes the script's own path.
- A merge commit or `git commit -a` with nothing staged at hook time: `git diff --cached --name-only` is the source; an empty list runs only the always-gates.
- A path with a space in it must not split into two entries.
- A row naming a script that does not exist must fail the hook, not skip.
- `check-gate-wiring.sh` must not require diff-based or CI-only gates in pre-commit; the allow-list is explicit and commented.

---

### Task 1: Scoped pre-commit

**Files:**
- Create: `scripts/precommit-gates.tsv`, `scripts/test-precommit-scope.sh`
- Modify: `.husky/pre-commit`

- [ ] **Step 1: Write `precommit-gates.tsv`.** The 25 scripts in today's order. Regex column empty for all but:

| Script | Runs when a staged path matches |
| ------ | ------------------------------- |
| `check-type-barrels.sh` (66 s) | `^(app/src/|app/tests/|app/tsconfig\.json|scripts/check-type-barrels\.sh)` |
| `check-game-rules.sh`, `test-check-game-rules.sh` (7 s + 3 s) | `^(docs/game-rules/|scripts/(test-)?check-game-rules\.sh)` |
| `check-tag-seeds.sh`, `test-check-tag-seeds.sh` (8 s + 23 s) | `^(docs/game-rules/|database/seeds/|app/scripts/(tags/|generate-tag-seed)|scripts/(test-)?check-(tag-seeds|game-rules)\.sh)` |

- [ ] **Step 2: Write the fixture test.** It calls the selection logic with `PRECOMMIT_STAGED=<file of paths>` and `PRECOMMIT_DRY=1` (prints the scripts it would run):
  1. `docs/architecture/01-Principles.md` → 20 scripts, none of the five scoped ones.
  2. `app/src/lib/game/x.ts` → includes `check-type-barrels.sh`, not `check-tag-seeds.sh`.
  3. `docs/game-rules/rulesets/501.md` → includes all four game-rules/tag-seed scripts.
  4. `scripts/check-type-barrels.sh` → includes `check-type-barrels.sh`.
  5. empty list → 20 scripts.
  6. a tsv row naming `scripts/nope.sh` → exit 1, `pre-commit: scripts/nope.sh missing`.
- [ ] **Step 3:** Run it. Expected: fails.
- [ ] **Step 4:** Replace the `GATES="…"` block in `.husky/pre-commit` with a loop over the tsv (`while IFS="$(printf '\t')" read -r gate re`), using `git diff --cached --name-only` unless `PRECOMMIT_STAGED` is set. The summary line becomes `pre-commit: <ran> gates passed, <skipped> skipped by path`.
- [ ] **Step 5: Verify.** `bash scripts/test-precommit-scope.sh` → `6 passed, 0 failed`. Stage one doc file and run `time sh .husky/pre-commit` → under 15 s, `20 gates passed, 5 skipped by path`. Stage one `app/src` file → `check-type-barrels.sh` runs.
- [ ] **Step 6:** Commit.

### Task 2: Wiring gate

**Files:**
- Create: `scripts/check-gate-wiring.sh`
- Modify: `.github/workflows/quality.yml`, `scripts/precommit-gates.tsv`, `.claude/skills/run-all-gates/SKILL.md`, `docs/architecture/00-File-Inventory.md`

**Interfaces:** `bash scripts/check-gate-wiring.sh` → `OK: <n> gate scripts wired in quality.yml and run-all-gates; pre-commit rows resolve.`

Rules it asserts:
1. Every `scripts/check-*.sh` and `scripts/test-*.sh` is named in `.github/workflows/quality.yml` or `pr-gates.yml`.
2. Every `scripts/check-*.sh` is named in `.claude/skills/run-all-gates/SKILL.md`.
3. Every row of `precommit-gates.tsv` names an existing script.
4. Every `scripts/check-*.sh` is either in the tsv or in the script's `NOT_IN_PRECOMMIT` list with a reason: `check-doc-sync.sh` (fails the code commit that precedes the docs commit), `check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`, `check-decision-ids.sh` (docs gates, CI and skill only), `check-dupes.sh`, `check-quality-benchmarks.sh` (need fallow, ≈ 5 s), `check-test-repointing.sh` (advisory), `check-gate-wiring.sh`.
5. Every script in `edit-gate.py`'s `CHECKS` exists.

- [ ] **Step 1:** Write the script. Run it. Expected today: it lists any script the lists disagree on. Fix the lists, not the rule; if a disagreement looks deliberate, add it to `NOT_IN_PRECOMMIT` with the reason.
- [ ] **Step 2:** Add it to `quality.yml` (structure job), to the tsv (always), and to the skill's "Always run" list.
- [ ] **Step 3: Verify.** `bash scripts/check-gate-wiring.sh` → `OK`. `touch scripts/check-zz.sh && bash scripts/check-gate-wiring.sh; rm scripts/check-zz.sh` → exit 1 naming `check-zz.sh` three times (CI, skill, pre-commit).
- [ ] **Step 4:** Commit; add a decision (path scoping, the allow-list) with the next id.
