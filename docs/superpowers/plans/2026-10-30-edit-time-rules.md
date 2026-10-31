# Edit-Time Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block rule-breaking edits before they land, force a reuse look before new files, gate new code duplication in CI, and slim CLAUDE.md files.

**Architecture:** Existing `scripts/check-*.sh` gates gain a per-file mode (`CHECK_ROOT` env + relpath args). Two Python PreToolUse hooks call them (`edit-gate.py`) or query the Component Inventory/graph/`git grep` (`reuse-lookup.py`). A committed duplication baseline (`scripts/dupes-baseline.txt`) ratchets fallow clone groups. Docs and one new skill carry the written rules.

**Tech Stack:** bash, python3 (stdlib only), fallow (`npx fallow dupes --format json`), GitHub Actions, Claude Code hooks/rules/skills.

**Spec:** `docs/superpowers/specs/2026-10-29-edit-time-rules-design.md`

## Global Constraints

- Hooks: bash + python3 stdlib only; no network; no `npm` install.
- Edit gate blocks via `hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`; on pass, exit 0 with no output.
- Only violations the edit **introduces** block (multiset of violation keys, line numbers stripped).
- < 1 s per edit on a single typical file (two runs: before/after). A script that cannot meet it stays gate-time only; name it in the PR.
- Hooks never re-implement a check — they call the scripts.
- No-arg behaviour of every `check-*.sh` (used by `run-all-gates` and CI) is unchanged.
- Bash-tool edits are an accepted gap (owner decision); gates remain the backstop.
- Migration carve-out and worktree rules stay in root `CLAUDE.md`, condensed not moved (owner decision).
- Stripping dated provenance tails from all CLAUDE.md files is a one-time approved exception to "minimal diffs; never regenerate docs" (owner decision) — record as a decision.
- Decisions append-only; ids via `scripts/next-decision-id.sh`. Context-system items → `decisions/context-system.md`; the rule of three → `decisions/frontend/architecture.md` (routing table: layering, types, folder structure).
- New `.claude/rules/*.md` and skills need `00-File-Inventory.md` rows (`check-skill-pointers.sh`).
- Hook output stays short: violations + one "fix and retry" line.

## Review Focus

- Hook crashes, times out, or gets malformed stdin → **fail open** (exit 0, no output); gates backstop. Tested in Task 2.
- `Edit` whose `old_string` is absent from the file → allow (the tool itself will fail). Tested in Task 2.
- File with a pre-existing violation, edit touches an unrelated line → allowed. Tested in Task 2.
- `file_path` outside the project, or extension/path with no matching check → no checks, no output. Tested in Tasks 2 and 4.
- `Write` over an existing file → edit gate applies, reuse lookup does not. Tested in Task 4.

## File Map

| File | Responsibility |
|---|---|
| `scripts/check-astro-conventions.sh`, `check-astro-class-composition.sh`, `check-style-tokens.sh`, `check-no-inline-comments.sh`, `check-file-locations.sh` | Modify: honour `CHECK_ROOT` + optional relpath args |
| `scripts/test-check-file-mode.sh` | Create: fixture test for per-file mode |
| `.claude/hooks/edit-gate.py` | Create: PreToolUse `Edit\|Write` blocking gate |
| `scripts/test-edit-gate.sh` | Create: fixture test feeding hook JSON |
| `scripts/check-dupes.sh`, `scripts/dupes-baseline.txt`, `scripts/test-check-dupes.sh` | Create: clone-group ratchet |
| `.claude/hooks/reuse-lookup.py`, `scripts/test-reuse-lookup.sh` | Create: new-file reuse prompt |
| `.claude/rules/reuse.md` | Create: rule of three |
| `.claude/skills/building-a-component/SKILL.md` | Create |
| `.claude/settings.json`, `.github/workflows/quality.yml` | Modify: register hooks; run new tests/gate |
| All `CLAUDE.md`, `docs/CLAUDE.md`, `.claude/skills/context-maintenance/SKILL.md` | Modify: slim; File Inventory grep instruction |
| `decisions/context-system.md`, `decisions/frontend/architecture.md`, `docs/architecture/00-File-Inventory.md`, `00-Context-Map.md` (budgets), `00-Context-Map-History.md` | Modify: records |

---

### Task 1: Per-file mode for gate scripts

**Files:**
- Modify: the five `scripts/check-*.sh` in the File Map
- Test: `scripts/test-check-file-mode.sh`

**Interfaces:**
- Produces: `CHECK_ROOT=<dir> bash scripts/check-X.sh [relpath ...]`. `CHECK_ROOT` replaces the `cd "$(git rev-parse --show-toplevel …)"` target when set. With relpaths (relative to root), scan only those files; exit 1 and print `relpath:line: message`-style findings exactly as today; exit 0 silent on clean. With no args, behaviour and output are byte-identical to today.

- [ ] **Step 1: Write failing fixture test** — same harness style as `scripts/test-check-engine-kernels.sh` (`tree`/`expect`, PASSED/FAILED counters, temp dir per case). Cases:
  - `astro-conventions`: `app/src/components/a/X.astro` with `<div x-bind:class="y">` → fail, needle `x-bind`; same file with `:class` → pass.
  - `astro-class-composition`: `class:list={…}` → fail; `cn(...)` → pass.
  - `style-tokens`: `class="!flex"` → fail; `class="flex"` → pass.
  - `no-inline-comments`: `.ts` with `function f(): void { // x\n }` → fail; JSDoc above → pass.
  - `file-locations`: relpath `app/src/components/a/x.ts` → fail; `app/src/lib/x.ts` → pass.
  - Scope: a violating sibling file NOT passed as arg is ignored (pass).
- [ ] **Step 2: Run** `bash scripts/test-check-file-mode.sh` → FAIL (scripts ignore `CHECK_ROOT`/args).
- [ ] **Step 3: Implement.** Bash/grep scripts: `cd "${CHECK_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"`, `TARGETS=("${@:-app/src}")`, pass `"${TARGETS[@]}"` where `app/src` was hard-coded (verify `--include` still filters explicit file args on GNU and BSD grep; if not, filter args by extension first). Python heredoc scripts: when `sys.argv[1:]` non-empty, iterate those paths instead of `ROOT.rglob`. `check-file-locations.sh`: with args, test the given relpaths against its rule (file need not exist).
- [ ] **Step 4: Run** `bash scripts/test-check-file-mode.sh` → all PASS; then each script with no args → same exit code and output as on `main` (`diff <(git stash; bash s; git stash pop) <(bash s)` or compare against a saved run).
- [ ] **Step 5: Time** each script on one real `.astro`/`.ts` file: `time CHECK_ROOT=$PWD bash scripts/check-X.sh app/src/components/forms/Button.astro` → record; flag any > 0.4 s.
- [ ] **Step 6: Add** `bash scripts/test-check-file-mode.sh` to `.github/workflows/quality.yml` next to the existing gate steps. Commit `feat(scripts): per-file mode for edit-time gates`.

### Task 2: Edit gate hook

**Files:**
- Create: `.claude/hooks/edit-gate.py`
- Modify: `.claude/settings.json` (PreToolUse, matcher `Edit|Write`, `python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/edit-gate.py"`)
- Test: `scripts/test-edit-gate.sh`

**Interfaces:**
- Consumes: Task 1 contract.
- Produces: `CHECKS: list[tuple[str, str]]` (glob, script) — `app/src/**/*.astro` → conventions, class-composition, style-tokens; `app/src/**/*.ts` → no-inline-comments, file-locations (drop any Task 1 flagged slow). Root = `EDIT_GATE_ROOT` env or `CLAUDE_PROJECT_DIR`. Helpers: `would_be(tool_name, tool_input, current: str|None) -> str|None` (None = old_string absent → allow); `violation_keys(output: str) -> Counter[str]` (strip `:\d+(:\d+)?` after paths and `line \d+`).

- [ ] **Step 1: Write failing fixture test** — temp root with `scripts/` symlinked to the real `scripts/` and an `app/src/components/a/X.astro`; pipe hook JSON via stdin with `EDIT_GATE_ROOT=$T`. Cases (assert on stdout JSON):
  - Write new `.astro` containing `x-bind:class` → `permissionDecision == "deny"`, reason contains `x-bind` and `fix and retry`.
  - Write clean `.astro` → empty stdout, exit 0.
  - Edit adding `x-bind:` → deny.
  - File already contains `x-bind:`; Edit changes an unrelated line → empty stdout.
  - Edit whose `old_string` absent → empty stdout.
  - `file_path` `/etc/x.astro` and `README.md` → empty stdout.
  - Stdin `not json` → empty stdout, exit 0.
  - Script missing/timeout (`EDIT_GATE_TIMEOUT=0.001`) → empty stdout, exit 0.
- [ ] **Step 2: Run** `bash scripts/test-edit-gate.sh` → FAIL (no hook).
- [ ] **Step 3: Implement** `edit-gate.py`: parse stdin; resolve relpath under root; pick checks by glob; build would-be content; shadow dir = temp dir with would-be file at relpath; run each script twice (`CHECK_ROOT=root relpath` if file exists, `CHECK_ROOT=shadow relpath`) with `subprocess.run(timeout=EDIT_GATE_TIMEOUT or 2)`; deny on any key whose after-count > before-count; whole body in `try/except Exception: sys.exit(0)`. Reason: offending lines (max 20) + `Edit blocked by repo gate — fix and retry.` Reuse `deny()` shape from `block-main-commit.py`.
- [ ] **Step 4: Run** test → PASS; manual: `time` the hook on a real Button.astro edit JSON → < 1 s.
- [ ] **Step 5: Register** in `settings.json`; add `bash scripts/test-edit-gate.sh` to `quality.yml`. Commit `feat(hooks): block rule-breaking edits at edit time`.

### Task 3: Rule of three + duplication ratchet

**Files:**
- Create: `scripts/check-dupes.sh`, `scripts/dupes-baseline.txt`, `scripts/test-check-dupes.sh`, `.claude/rules/reuse.md`
- Modify: `.github/workflows/quality.yml` (step after "Stale-usage gate", `working-directory: app`), `decisions/frontend/architecture.md`, `00-File-Inventory.md`

**Interfaces:**
- Produces: `bash scripts/check-dupes.sh [--update]`. Reads `npx fallow dupes --format json` from `app/` (or `DUPES_JSON=<file>` for tests). Group key = sorted unique `instances[].file` joined by ` | `. Baseline line = `<count>\t<key>`. Fail if any key's current count > baseline (`new clone group: <key>`), or baseline count > current (`stale baseline row, lower it: <key>` — ratchet). `--update` rewrites the baseline. Fail if `clone_groups_omitted > 0` (verify the flag that lists all groups).

*Plan's call vs spec:* the spec named a merge-base diff; a committed baseline gives the same "new group fails" result, runs locally, and needs no second checkout in CI. Key by file set (not fragment hash) so editing inside an existing clone does not read as new.

- [ ] **Step 1: Failing test** — fixture JSONs via `DUPES_JSON`: same as baseline → pass; extra group on new file set → fail, needle `new clone group`; one group fewer → fail, needle `stale baseline row`; `--update` then rerun → pass.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `bash scripts/check-dupes.sh --update` against the real repo; then `bash scripts/check-dupes.sh` → pass.
- [ ] **Step 5: Rule** `.claude/rules/reuse.md`, frontmatter `paths: ["app/src/**"]`, ≤ 15 lines: same markup shape/type/logic block a third time → extract a shared component/helper/type first and migrate the other two; look first in `08-Component-Inventory.md` (markup) and graph/`git grep` (TS); `scripts/check-dupes.sh` fails on any new clone group. Cite the new decision id.
- [ ] **Step 6: Decision** in `decisions/frontend/architecture.md` (id from `scripts/next-decision-id.sh`): rule of three + ratchet gate. Inventory row for `reuse.md`.
- [ ] **Step 7: Backlog** — one `discovered-work` issue per clone family in the baseline (fallow `clone_families`), via `capturing-discovered-work`. Do not fix.
- [ ] **Step 8:** CI step + test step in `quality.yml`. Commit `feat(gates): rule of three with clone-group ratchet`.

### Task 4: Reuse lookup hook

**Files:**
- Create: `.claude/hooks/reuse-lookup.py`, `scripts/test-reuse-lookup.sh`
- Modify: `.claude/settings.json` (PreToolUse, matcher `Write`)

**Interfaces:**
- Produces: `name_tokens(path: str) -> set[str]` — split basename on `-_.` and camelCase, lowercase, drop `module data engine types type astro ts index` and tokens < 3 chars. `export_names(content: str) -> list[str]` — `export (const|function|class|type|interface) (\w+)`. `candidates(relpath, content, root) -> list[str]` — `.astro`: inventory rows (`| \`Name.astro\` | purpose |`) sharing ≥ 1 token; `.ts`: graph nodes (`norm_label` contains a token or export name, `source_file` under `app/src`) + `git grep -n -E "export .*\b<name>\b" -- app/src` per export name; dedupe by path, cap 8, format `name — path`. State: `$TMPDIR/reuse-lookup-<session_id>` holds seen relpaths.

- [ ] **Step 1: Failing test** — with `REUSE_ROOT=$T` fixture (mini inventory with a `Badge.astro` row; mini `graph.json` with node `formatScore` in `app/src/lib/score.ts`; git-init'd tree):
  - Write new `app/src/components/ui/StatusBadge.astro` → deny, reason contains `Badge.astro` and `retry`.
  - Same JSON again, same `session_id` → empty stdout.
  - Write new `app/src/lib/score-format.ts` exporting `formatScore` → deny listing `app/src/lib/score.ts`.
  - Write over existing file → empty stdout.
  - New file with no matching tokens → empty stdout.
  - Path outside watched dirs (`app/src/pages/x.astro`) → empty stdout.
  - Bad stdin → empty stdout, exit 0.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (fail open like Task 2; graph read with `json.load` once — never print it). **Step 4: Run** → PASS; `time` on the real repo < 1 s (if the 7.7 MB graph load exceeds budget, pre-filter with `grep` on the file before parsing).
- [ ] **Step 5:** Register; add test to `quality.yml`. Commit `feat(hooks): reuse lookup before new files`.

### Task 5: Slim CLAUDE.md files

**Files:** all 12 `CLAUDE.md`; `docs/CLAUDE.md` step 1; `.claude/skills/context-maintenance/SKILL.md` step 2; `decisions/context-system.md`; `00-Context-Map.md` budgets; `00-File-Inventory.md` `~tokens`; `00-Context-Map-History.md`.

- [ ] **Step 1: Baseline** — record `wc -c` of every CLAUDE.md; check `check-context-budget.sh`, `check-agent-mirrors.sh`, `context-drift.sh`, `check-doc-links.sh` for anything that parses dated tails (expect none; note any).
- [ ] **Step 2: Strip** `(YYYY-MM-DD…)` / `(… Dxxx …)` provenance parentheticals and rationale prose that states history, not a rule. Keep every rule, every invariant, and D-ids only where a rule says "see Dxxx" for its definition. Root: condense the migration carve-out to the rule + "0001–0046 applied, closed to edits"; condense worktree bullets; both stay in root.
- [ ] **Step 3: File Inventory** — `docs/CLAUDE.md` step 1 and `context-maintenance` step 2: "grep `00-File-Inventory.md` for the row; Read with offset/limit; never read it whole."
- [ ] **Step 4: Decision** in `decisions/context-system.md`: one-time exception + edit-time hooks (Tasks 2, 4).
- [ ] **Step 5: Verify** — `grep -rnE '\(20[0-9]{2}-[0-9]{2}-[0-9]{2}' --include=CLAUDE.md .` → no hits outside deliberate keeps; `bash scripts/check-context-budget.sh`, `check-context-map.sh`, `check-doc-links.sh`, `check-agent-mirrors.sh` → update budgets/`~tokens` until pass. Report before/after bytes. Commit `docs: slim CLAUDE.md files (one-time exception)`.

### Task 6: `building-a-component` skill

**Files:** Create `.claude/skills/building-a-component/SKILL.md`; Modify `00-File-Inventory.md`.

- [ ] **Step 1:** Write the skill (< 80 lines) per `superpowers:writing-skills`: frontmatter `name`, `description` ("Use when creating or changing a shared .astro component or page markup…"), `paths: ["app/src/components/**", "app/src/pages/**"]`. Body: inventory lookup → reuse or state why not → checklist as pointers (Alpine shorthand + spread bind → `03-Alpine-Patterns.md`; `x-cloak`, `cn()` → `05-Astro-Components.md`; tokens → `07-Style-Guide.md`; `Button.astro` → `components/CLAUDE.md`) → register new shared component in `08-Component-Inventory.md`. No copied rule text.
- [ ] **Step 2: Verify** `bash scripts/check-skill-pointers.sh` → pass. Commit `feat(skills): building-a-component`.

### Task 7: Finish

- [ ] Run `context-maintenance` and `run-all-gates` skills; all scripts pass.
- [ ] Manual smoke in a fresh session: ask the agent to add `x-bind:class` to an `.astro` file → edit refused; ask it to create a new badge component → candidates shown.
- [ ] `finishing-a-dart-branch` → push, PR to `main`.
