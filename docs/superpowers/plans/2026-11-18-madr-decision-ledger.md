# MADR Decision Ledger (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 538-record decision ledger into 1 MADR file per decision and add a bot that numbers new decisions before merge.

**Architecture:** 1 Node module (`scripts/decisions/lib.mjs`) parses, renders and validates a record. Thin entry scripts build on it: the one-shot split, the gates, the index and the numbering bot. A workflow runs the bot on the `ready-to-merge` label and posts its own commit status.

**Tech Stack:** Node 22 ESM (`.mjs`, no new dependencies), bash wrappers, Vitest (tests under `app/tests/scripts/decisions/`, run from `app/`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-18-madr-decision-ledger-design.md`

## Global Constraints

- Existing ids keep their number. File name: `D<4-digit id>-<slug>.md`, slug from the title, lower case, at most 6 words.
- Pending file: `decisions/<domain>/pending-<slug>.md`; citation: `[pending:<slug>]`.
- Domain directories: `architecture`, `database`, `api`, `game-engine`, `testing`, `context-system`, `frontend/architecture`, `frontend/astro`, `frontend/alpine`, `frontend/style`.
- Frontmatter key order: `id, status, date, origin, original-date, tags, scope, decision-makers, consulted, informed, supersedes, superseded-by`.
- Every template heading is required, in template order. An empty section holds exactly `Rationale unknown — backfill pending.`
- Thin record marker: `<!-- backfill: pending -->`.
- The split copies text as it is. It changes no wording beyond the spec § 5 mapping.
- `date` may be empty only on ids at or below the split maximum (D564, re-derived in Task 5).
- No new npm dependency. YAML frontmatter here is flat: scalars and `[a, b]` lists only.
- Bot token: default `GITHUB_TOKEN`; informational status context `decision-numbering`; the required check is the `decision-ledger` job in `quality.yml`.

## Review Focus

1. A block whose `Reason:` or `Consequences:` spans several lines or paragraphs: the split must keep every line. Test in Task 2.
2. A title with backticks, `—`, `/` or quotes: the slug must hold only `[a-z0-9-]`. Test in Task 1.
3. `Supersedes:` variants (`D86`, `D86.`, `none (extends D41)`, `none. Narrows …`): ids go to `supersedes` only when the line does not start with `none`. Test in Task 2.
4. 2 pending files with the same slug in different domains: the bot must give them 2 ids and rewrite each citation to the right one. Test in Task 4.
5. A pending PR rebased after `main` gained a new id: the bot must take max of `origin/main` and the branch, plus 1. Test in Task 4.

---

## File Structure

| Path | Job |
| ---- | --- |
| `scripts/decisions/lib.mjs` | `parseRecord`, `renderRecord`, `validateRecord`, `slugify`, `listRecords` |
| `scripts/decisions/split.mjs` | One-shot: old domain files → record files. Deleted in a follow-up after merge. |
| `scripts/decisions/check.mjs` + `scripts/check-decision-ids.sh` | Ledger integrity gate |
| `scripts/decisions/baseline-ids.txt` | The ids present at the split, 1 per line |
| `scripts/check-decision-pending.sh` | Fails on any pending file or citation |
| `scripts/decisions/index.mjs` + `scripts/decision-index.sh` | Prints the index |
| `scripts/decisions/number.mjs` + `scripts/number-decisions.sh` | Numbers pending decisions |
| `.github/workflows/decision-ids.yml` | The bot |
| `decisions/TEMPLATE.md` | The template |
| `app/tests/scripts/decisions/*.test.ts` | Tests, with fixtures in `app/tests/scripts/decisions/fixtures/` |

---

### Task 1: Record library

**Files:**
- Create: `scripts/decisions/lib.mjs`, `decisions/TEMPLATE.md` (spec § 5 template, with `id: pending`)
- Test: `app/tests/scripts/decisions/lib.test.ts`

**Interfaces:**
- Produces:
  - `slugify(title: string): string`
  - `parseRecord(text: string): { fm: Record<string, string | string[]>, title: string, sections: Map<string, string>, thin: boolean }`
  - `renderRecord(r: { fm, title, sections, thin }): string` — keys and headings in fixed order
  - `validateRecord(r, path: string, opts: { maxBaselineId: number }): string[]` — error messages, empty if valid
  - `listRecords(root = "decisions"): { path: string, record }[]` — skips `TEMPLATE.md`
  - `HEADINGS: string[]`, `FM_KEYS: string[]`, `DOMAINS: string[]`, `UNKNOWN = "Rationale unknown — backfill pending."`

- [ ] **Step 1: Write the failing tests**

```ts
it("slugify keeps a-z0-9- and 6 words", () => {
  expect(slugify("Migrations `0001`–`0053` are closed to in-place edits"))
    .toBe("migrations-0001-0053-are-closed-to");
});
it("round-trips TEMPLATE.md", () => {
  const t = readFileSync("../decisions/TEMPLATE.md", "utf8");
  expect(renderRecord(parseRecord(t))).toBe(t);
});
it("rejects a missing heading, a key out of order, a bad status, a name/id mismatch", () => {
  // 1 fixture per case; each yields exactly 1 error naming the rule
});
it("allows empty date only at or below maxBaselineId", () => {
  expect(validateRecord(rec({ id: "D0020", date: "" }), p("D0020"), { maxBaselineId: 564 })).toEqual([]);
  expect(validateRecord(rec({ id: "D0600", date: "" }), p("D0600"), { maxBaselineId: 564 })).toHaveLength(1);
});
```

- [ ] **Step 2: Run** `cd app && npx vitest run tests/scripts/decisions/lib.test.ts` — expect FAIL, module not found.
- [ ] **Step 3: Implement `lib.mjs`.** Hand-written flat frontmatter parser. Sections split on `^## ` and `^### ` headings that match `HEADINGS`.
- [ ] **Step 4: Run the tests again** — expect PASS.
- [ ] **Step 5: Commit** `feat(decisions): record library and MADR template`

### Task 2: Split script

**Files:**
- Create: `scripts/decisions/split.mjs`
- Test: `app/tests/scripts/decisions/split.test.ts`, fixtures `fixtures/old-domain.md` (2 table rows, 3 blocks, 1 supersede pair, 1 `none (extends D…)`, 1 multi-paragraph block)

**Interfaces:**
- Consumes: Task 1.
- Produces: `splitDomainFile(text: string, domain: string): Record[]`; `linkSupersedes(records: Record[]): void` (fills `superseded-by`, sets `status: superseded`, sets `date` to the superseding record's date); CLI `node scripts/decisions/split.mjs [--dry-run]` writes `decisions/<domain>/D####-<slug>.md` and prints `wrote <n> records`.

- [ ] **Step 1: Write the failing tests**, 1 per mapping row in spec § 5:
  - table row: Decision → `Decision Outcome` starts `Chosen option: "`; Rationale → Context; Source → Evidence `Decided: <date>` or `Source: P21–30`; `date` empty for a `P` source.
  - block: `Status: Accepted · Date: 2026-11-07` → `status: accepted`, `date: 2026-11-07`; `Reason:` → Context; `Consequences:` copied verbatim under `### Consequences`.
  - `Supersedes: D86.` → `supersedes: D0086`; `Supersedes: none (extends D41)` → no `supersedes`, Evidence holds `Supersedes: none (extends D41)` verbatim; `Supersedes: none.` → dropped.
  - `tags`: domain plus only the `load-when` keywords present in that record's text, case-insensitive whole word.
  - every record is `thin: true`; `decision-makers: [owner]`; `origin: contemporaneous`; `scope: repository`.
  - the multi-paragraph block loses no line (compare the set of non-empty lines).
- [ ] **Step 2: Run** `cd app && npx vitest run tests/scripts/decisions/split.test.ts` — expect FAIL.
- [ ] **Step 3: Implement `split.mjs`.** Domain name = old file path minus `decisions/` and `.md`.
- [ ] **Step 4: Run the tests again** — expect PASS.
- [ ] **Step 5: Dry run on the real ledger:** `node scripts/decisions/split.mjs --dry-run` — expect `wrote 538 records`, 0 slug clashes, 0 validation errors.
- [ ] **Step 6: Commit** `feat(decisions): one-shot ledger split script`

### Task 3: Gates and index

**Files:**
- Create: `scripts/decisions/check.mjs`, `scripts/decisions/index.mjs`, `scripts/check-decision-pending.sh`, `scripts/decision-index.sh`
- Rewrite: `scripts/check-decision-ids.sh` (calls `node scripts/decisions/check.mjs`)
- Test: `app/tests/scripts/decisions/check.test.ts`, `index.test.ts`, `pending.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `checkLedger(root: string, baselineIds: string[]): string[]` — checks: every record valid; ids unique across the tree; file name matches id; `supersedes` ↔ `superseded-by` point both ways; every baseline id present; no file under `decisions/` outside the 10 domain directories except `TEMPLATE.md`.
  - `check-decision-pending.sh` exits 1 if `git ls-files 'decisions/**/pending-*.md'` is non-empty or `git grep -n '\[pending:'` finds a hit outside `decisions/TEMPLATE.md`, `DECISIONS.md` and `docs/superpowers/`.
  - `decision-index.sh [--domain <d>] [--tag <t>] [--status <s>]` prints `D0532 | accepted | database | <title> | <path>`, sorted by id.

- [ ] **Step 1: Write the failing tests:** 1 fixture tree per `checkLedger` rule, each yielding 1 error; pending gate fails on a `pending-x.md` file and on a `[pending:x]` citation in `docs/architecture/`; index filters by domain and tag.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/scripts/decisions/` — expect FAIL.
- [ ] **Step 3: Implement** the 3 modules and the 3 wrappers.
- [ ] **Step 4: Run the tests again** — expect PASS.
- [ ] **Step 5: Commit** `feat(decisions): ledger gates and index`

### Task 4: Numbering bot

**Files:**
- Create: `scripts/decisions/number.mjs`, `scripts/number-decisions.sh`, `.github/workflows/decision-ids.yml`
- Test: `app/tests/scripts/decisions/number.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 3.
- Produces: `numberPending(opts: { root: string, mainMaxId: number, changedFiles: string[] }): { renames: [from: string, to: string][], rewrites: string[] }`. Next id = max(`mainMaxId`, highest id in the branch) + 1. Pending files are numbered in sorted path order. A citation `[pending:<slug>]` is rewritten to `D####` only in `changedFiles`. If 2 pending files share a slug, the citation must be domain-qualified (`[pending:<domain>/<slug>]`); a bare clashing citation is an error.

- [ ] **Step 1: Write the failing tests:** 1 pending → `D0565` when `mainMaxId` is 564; branch already holds D0565 → `D0566`; 2 same-slug files in `api` and `database` with qualified citations → 2 ids, each citation correct; bare clashing citation → error; a citation in an unchanged file is left alone.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/scripts/decisions/number.test.ts` — expect FAIL.
- [ ] **Step 3: Implement `number.mjs`** and the wrapper. The wrapper derives `mainMaxId` from `git ls-tree -r --name-only origin/main decisions/` and `changedFiles` from `git diff --name-only origin/main...HEAD`.
- [ ] **Step 4: Run the tests again** — expect PASS.
- [ ] **Step 5: Write `decision-ids.yml`.** Trigger `pull_request: types: [labeled]`, `if: github.event.label.name == 'ready-to-merge'`, `permissions: { contents: write, statuses: write, pull-requests: write }`. Steps: checkout the head ref with `fetch-depth: 0`; `git fetch origin main`; `bash scripts/number-decisions.sh`; commit as `github-actions[bot]` with message `chore(decisions): number pending decisions` if anything changed, then push; run `check-decision-ids.sh` and `check-decision-pending.sh`; post status `decision-numbering` (success or failure) on the pushed SHA with `gh api repos/{owner}/{repo}/statuses/<sha>`; remove the label with `gh pr edit --remove-label ready-to-merge`. Skip fork PRs.
- [ ] **Step 6: Lint the workflow:** `npx --yes actionlint .github/workflows/decision-ids.yml` if available, else `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" .github/workflows/decision-ids.yml` — expect no output.
- [ ] **Step 7: Commit** `feat(decisions): numbering bot on ready-to-merge label`

### Task 5: Run the split and the new decision

**Files:**
- Create: `decisions/<domain>/D####-*.md` (538 files), `scripts/decisions/baseline-ids.txt`, the PR 1 decision file
- Delete: the 10 old domain files, `scripts/next-decision-id.sh`, `scripts/renumber-decision.sh`, `scripts/decision-row-hashes.tsv`, `scripts/decision-map.txt`

- [ ] **Step 1: Re-derive the max id** before deleting the old tool: `git fetch origin main && bash scripts/next-decision-id.sh`. The PR 1 decision takes that id (D564 on 2026-11-18). If it moved, rebase first.
- [ ] **Step 2: Find the decision that set the append-only rule:** `git grep -n 'never edit' decisions/context-system.md`. Note its id.
- [ ] **Step 3: Run** `node scripts/decisions/split.mjs` — expect `wrote 538 records`.
- [ ] **Step 4: Write `baseline-ids.txt`** from the generated files: `ls decisions/**/D*.md | grep -oE 'D[0-9]{4}' | sort`, then append the PR 1 decision's id.
- [ ] **Step 5: Write the PR 1 decision** in `decisions/context-system/D0564-decision-records-are-madr-files.md` (id per Step 1). Use the full template, `origin: contemporaneous`, `status: accepted`, `supersedes:` the id from Step 2. Fill every section from the spec: drivers from § 1, options from § 4, consequences including at least 1 real cost (old paths in history docs stay dead; thin records until enrichment), Confirmation naming `check-decision-ids.sh` and `check-decision-pending.sh`. Not thin.
- [ ] **Step 6: Delete** the old files and retired scripts listed above.
- [ ] **Step 7: Run** `bash scripts/check-decision-ids.sh` — expect `PASS`, 539 records.
- [ ] **Step 8: Commit** `refactor(decisions): split ledger into MADR record files`

### Task 6: Other gates, hook and tests

**Files:**
- Modify: `scripts/check-context-map.sh`, `scripts/check-context-budget.sh`, `scripts/check-doc-links.sh`, `scripts/check-doc-sync.sh`, `scripts/check-gate-wiring.sh`, `scripts/check-skill-pointers.sh`, `.claude/hooks/context-drift.sh`, `.github/workflows/quality.yml`, `app/tests/scripts/erasure.test.ts`, the comment in `app/src/modules/stats/sections/heatmap-density.module.ts`
- Test: existing `scripts/test-check-context-budget.sh` and any `test-check-*.sh` for the touched gates

- [ ] **Step 1: Run all 6 gates** and note each failure the split caused.
- [ ] **Step 2: Fix each gate**, per spec § 7 "Loading decisions" and "Old file paths":
  - context-map and context-budget: a domain directory is 1 unit; for `decisions/**` accept YAML frontmatter in place of the HTML `status` header; price the unit by `decision-index.sh --domain <d>` output.
  - doc-links: a fixed list of the 10 retired paths, ignored only in `docs/superpowers/**` and `decisions/**`.
  - gate-wiring: register `check-decision-pending.sh`.
  - `quality.yml` `structure` job: add `actions/setup-node@v4` with `node-version: 22` before the decision gate; add a `Decision-pending gate` step.
  - erasure test and context-drift hook: replace the file paths with the directory prefix.
- [ ] **Step 3: Add a fixture case** to each touched gate's existing `test-check-*.sh`, if it has one, for the new directory shape.
- [ ] **Step 4: Run** every touched gate and its test script — expect PASS each.
- [ ] **Step 5: Commit** `chore(gates): read the split decision ledger`

### Task 7: Docs and skills

**Files:**
- Modify: `CLAUDE.md`, `docs/CLAUDE.md`, `app/CLAUDE.md`, `DECISIONS.md`, `docs/architecture/00-Context-Map.md`, `00-File-Inventory.md`, every other `docs/architecture/**` file and `docs/game-rules/**` file that names an old domain file, `.claude/skills/{context-maintenance,run-all-gates,syncing-design-system}/SKILL.md`, `.claude/skills/authoring-game-rules/references/amending.md`

- [ ] **Step 1: List the targets:** `git grep -lE 'decisions/[a-z/-]+\.md|next-decision-id|renumber-decision|append a new block' -- ':!docs/superpowers' ':!decisions' ':!graphify-out'`.
- [ ] **Step 2: Rewrite `DECISIONS.md`.** Routing table points to directories. "How to add a decision" becomes a numbered procedure: copy `decisions/TEMPLATE.md` to `decisions/<domain>/pending-<slug>.md`; cite it as `[pending:<slug>]`; add the `ready-to-merge` label; the bot numbers it. Keep the Deferred list and "Facts vs. decisions" as they are.
- [ ] **Step 3: Rewrite the decision rule** in root `CLAUDE.md` (Hard Invariants and § Context Maintenance) and `docs/CLAUDE.md`: the chosen option and `Decided:` date are fixed; other sections and `status` may be filled in later; a reversal is a new record with `supersedes`.
- [ ] **Step 4: Edit each remaining target** with a minimal diff: old file path → directory path; id derivation → pending file and label.
- [ ] **Step 5: Run** `bash scripts/check-doc-links.sh && bash scripts/check-skill-pointers.sh && bash scripts/check-context-map.sh` — expect PASS.
- [ ] **Step 6: Commit** `docs: route the decision ledger to MADR record files`

### Task 8: Finish

- [ ] **Step 1:** Run the `run-all-gates` skill. Expect every gate PASS.
- [ ] **Step 2:** Run the `context-maintenance` skill.
- [ ] **Step 3:** Run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch`: push and open the PR. The PR body lists these manual owner steps before merge:
  1. Turn on "Require branches to be up to date before merging" for `main`.
  2. Allow squash merge only.
  3. Add `decision-ledger` as a required status check (a job in `quality.yml`, called by `checks.yml`).
  4. Create the `ready-to-merge` label.
  5. Check open PRs that append to an old domain file; they convert to `pending-<slug>.md` at rebase.
