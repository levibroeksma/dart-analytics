# Quality 8 — Skills and guardrails that keep the numbers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An agent writing code in this repo is told at edit time, not at CI time, when it adds a long function, a clone or a one-literal factory, and has a skill for each refactor shape plans 5–7 introduced.

**Architecture:** Three repo skills (each under 80 lines, written with `writing-for-agents` and `superpowers:writing-skills`), one `PostToolUse` hook that reports new long functions in the file just edited, and one CI/pre-PR step running `fallow audit` on changed files only. Skills carry procedure; the hook and the gate carry enforcement.

**Tech Stack:** Markdown skills, Python 3 hook, fallow 3.42.0, bash.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 5. Tasks 1 and 4 need only plans 1–2; tasks 2 and 3 document patterns from plans 6 and 7 and wait for them.

## Global Constraints

- Each skill: front matter `name` + `description` starting "Use when …"; body states steps and the command that proves each; no history, no rationale longer than one line (decision ids hold the why).
- Each new skill gets a File Inventory row (`check-skill-pointers.sh`) and, where it pairs with a superpowers skill, a row in the root `CLAUDE.md` pairing table.
- Hooks fail open (any exception → exit 0, no output) and finish within 3 s.
- No change under `app/src`.
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- The hook runs on every Edit/Write under `app/src`: it must not run fallow when `app/node_modules/.bin/fallow` is absent, and must stay silent when nothing got worse.
- A file that already has a long function must not be reported on every later edit: compare against `git show HEAD:<path>`.
- `fallow audit` on a PR with no `app/` change must pass in under 5 s.
- A skill description that is too broad fires on unrelated work: each names its trigger files.
- CI has no plugin cache: the skills must not be required by a gate to exist in the plugin, only in `.claude/skills/`.

---

### Task 1: Skill `refactoring-without-behaviour-change`

**Files:**
- Create: `.claude/skills/refactoring-without-behaviour-change/SKILL.md`
- Modify: `docs/architecture/00-File-Inventory.md`, root `CLAUDE.md` pairing table (row: `superpowers:test-driven-development` → this skill, "for a refactor, the red step is a characterization test that passes on the old code")

Description: `Use when a task changes code shape but must not change behaviour — folding a clone, splitting a long function, moving methods or markup.`

Body, in this order:
1. Name the observable outputs (HTTP body, SQL, persisted facts, HTML, returned object keys).
2. Write one test that pins each, green on the old code. Markup: `bash scripts/check-html-parity.sh --save`.
3. Change the shape. One shape change per commit.
4. Prove: the pinned tests, `cd app && npm test` with the count reported, parity for markup, `bash scripts/check-dupes.sh`, `bash scripts/check-quality-benchmarks.sh`.
5. Accepted differences (key order, error-column naming) are listed in the decision, never left silent.
6. A helper takes data, never a flag. Under three copies, do not share (D513).

- [ ] **Step 1:** Write it. **Step 2: Verify.** `bash scripts/check-skill-pointers.sh && bash scripts/check-context-budget.sh` → `OK`; `wc -l` < 80. **Step 3:** Commit.

### Task 2: Skill `composing-alpine-factories`

**Files:**
- Create: `.claude/skills/composing-alpine-factories/SKILL.md` with `paths: ["app/src/lib/**/*.data.ts", "app/src/stores/**"]`
- Modify: File Inventory

Description: `Use when creating or changing an Alpine x-data factory (*.data.ts) or store — adding a method, a state field or a new factory.`

Body: the three rules from `03-Alpine-Patterns.md` § Method groups (state per call; getters stay in the factory; key order kept), the 60-line factory limit, the `shapeOf` key-parity test, the two-instance isolation test, and the command `npx --no-install fallow health app/src/<file> --format json -q | jq '.large_functions'`.

- [ ] **Step 1–3:** As task 1.

### Task 3: Skill `checking-quality-benchmarks`

**Files:**
- Create: `.claude/skills/checking-quality-benchmarks/SKILL.md`
- Modify: File Inventory; `.claude/skills/run-all-gates/SKILL.md` (one pointer line)

Description: `Use when the fallow gate, the clone ratchet or the quality-benchmark gate fails, or before a PR that touched app/src — reads the real violator and says whether to fix code or tighten a benchmark.`

Body: a table of failure line → meaning → action:

| Output | Meaning | Do |
| ------ | ------- | -- |
| `regressed: <row>` | this branch made the row worse | fix the code; never edit `now` by hand |
| `stale benchmark, tighten it: <row>` | this branch improved the row | `bash scripts/check-quality-benchmarks.sh --update`, commit the file |
| `new clone group: <files>` | a copy was added | fold it, or at two copies leave both and make them differ honestly; never add a baseline row |
| `Failed: … start with <file>` | fallow's suggestion, not the violator (#292) | read the `health gate:` block `fallow-gate.sh` prints |

Plus: the score is read with `-c .fallowrc.score.jsonc --score`; hotspots are not part of it; the five ways a long function is shortened here (extract helper, method group, child component, lookup table, row mapper).

- [ ] **Step 1–3:** As task 1.

### Task 4: Changed-files audit gate and edit-time hook

**Files:**
- Create: `.claude/hooks/unit-size-note.py`, `scripts/test-unit-size-note.sh`
- Modify: `.claude/settings.json` (`PostToolUse`, matcher `Edit|Write`, guarded with `[ -f … ] &&` like `edit-gate.py`), `.github/workflows/quality.yml`, `docs/architecture/00-File-Inventory.md`

**Interfaces:**
- Hook: reads the tool payload; for a path matching `app/src/**/*.{ts,astro}` runs `npx --no-install fallow health <relpath> --format json -q` in `app/` (timeout 3 s), collects functions with `line_count > 60`, subtracts the names that were already over 60 in `git show HEAD:<path>` (same command on a temp copy is too slow: keep a cache file `app/.fallow/unit-size-head.json` built once per session from one whole-project run). If any remain, prints `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"<file>: <name> is <n> lines (limit 60). Split it before finishing — see the checking-quality-benchmarks skill."}}`. Otherwise prints nothing.
- CI step in the `app` job, after the benchmark ratchet, with `fetch-depth: 0` added to that job's checkout:

```yaml
      - name: Changed-files audit
        if: github.event_name == 'pull_request'
        run: npx --no-install fallow audit --base origin/${{ github.base_ref }} --gate new-only
```

- [ ] **Step 1: Fixture test** (`EDIT_GATE_ROOT`-style root override, `UNIT_SIZE_JSON` replaces the fallow run): (1) new 70-line function → context line naming it; (2) function already long at HEAD → silent; (3) file outside `app/src` → silent; (4) fallow missing → silent, exit 0; (5) malformed payload → silent, exit 0.
- [ ] **Step 2:** Run; fails. Write the hook; `5 passed, 0 failed`.
- [ ] **Step 3: Verify the audit locally.** `cd app && npx --no-install fallow audit --base origin/main --gate new-only; echo $?` on this branch → `0`. Add a 70-line function to a scratch file under `app/src/lib/`, rerun → non-zero naming it; remove the file.
- [ ] **Step 4:** Add the fixture test to `quality.yml` (structure job) and the `run-all-gates` hooks list. Decision (next id): the hook informs, the audit step blocks, both read the pinned fallow. Commit.

### Task 5: Close out

- [ ] **Step 1: Verify.** `bash scripts/check-gate-wiring.sh` (plan 4) → `OK` with the two new test scripts counted. `ls .claude/skills | wc -l` → 14.
- [ ] **Step 2:** Start a fresh session, ask it to "add a method to acePlay": confirm `composing-alpine-factories` loads. State the result in the PR body.
