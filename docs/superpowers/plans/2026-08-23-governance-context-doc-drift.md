# Governance/Context-Doc Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close findings F1, F3, F4, F6, F14 — five pieces of stale/dead metadata in the governance/context-doc tree, each a mechanical correction with no code risk.

**Architecture:** Doc/config-only change set, no `app/` or `database/` files touched. Five independent edits (settings.json, .graphifyignore, DECISIONS.md, 00-File-Inventory.md, 00-Context-Map-History.md), each verified by grep/diff plus the relevant `check-*.sh` gate, followed by the mandatory FINDINGS.md cleanup and context-maintenance self-registration.

**Tech Stack:** Plain text/JSON/Markdown edits; bash gate scripts (`scripts/check-*.sh`); no build tooling involved.

**Source spec:** `docs/superpowers/specs/2026-08-23-governance-context-doc-drift-design.md`

## Global Constraints

- Every task branches from `main` per root `CLAUDE.md`; this plan assumes a single branch already checked out for the whole plan (no git worktrees — see root `CLAUDE.md` "No git worktrees").
- Minimal diffs only — do not touch any line not named by a task below.
- `DECISIONS.md` stays a router: no decision block gets added by this plan (nothing here is a "choice with rationale," per `docs/CLAUDE.md`'s "Facts vs. decisions").
- `docs/architecture/00-Context-Map-History.md` is append-only — new entries go at the top with a new highest version number, body text only, never edited/reordered.
- `FINDINGS.md` closures are deletions, not status changes — never write `Status: Resolved`.
- Substitute the actual execution date (`YYYY-MM-DD`, today when each task actually runs) everywhere this plan says "today's date" — same convention `DECISIONS.md`'s own template uses for its `YYYY-MM-DD` placeholder.

---

## File Structure

| File | Change |
| ---- | ------ |
| `.claude/settings.json` | Delete 3 `gh` allowlist lines (F1) |
| `.graphifyignore` | Delete 1 dead ignore line (F4) |
| `DECISIONS.md` | Drop 3 hardcoded id/count references (F3) |
| `docs/architecture/00-File-Inventory.md` | Reword 2 stale `AGENT.md` rows (F6) |
| `docs/architecture/00-Context-Map-History.md` | Append 2 new version entries: one retroactive registration (F14), one for this task itself (context-maintenance step 2) |
| `FINDINGS.md` | Delete the F1, F3, F4, F6, F14 blocks; bump nothing else in front matter |

---

### Task 1: Drop unusable `gh` CLI allowlist entries (F1)

**Files:**
- Modify: `.claude/settings.json:19-22`

**Interfaces:** None — standalone JSON edit, no other task depends on this file's content.

- [ ] **Step 1: Confirm the finding still holds**

Run: `command -v gh; echo "exit: $?"`
Expected: `exit: 1` (no `gh` binary in this environment) — confirms the three entries are dead weight before touching them.

- [ ] **Step 2: Edit `.claude/settings.json`**

Current (lines 15-23):

```json
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git branch:*)",
      "Bash(gh pr view:*)",
      "Bash(gh pr list:*)",
      "Bash(gh pr diff:*)"
    ],
```

Replace with:

```json
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git branch:*)"
    ],
```

(Drop the three `gh` lines and the now-trailing comma on the `git branch` line — it is the new last array element.)

- [ ] **Step 3: Verify valid JSON and the entries are gone**

Run: `python3 -m json.tool .claude/settings.json > /dev/null && echo "valid json"`
Expected: `valid json`

Run: `grep -c '"Bash(gh ' .claude/settings.json`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json
git commit -m "fix: drop unusable gh CLI allowlist entries (F1)"
```

---

### Task 2: Delete dead `.graphifyignore` line (F4)

**Files:**
- Modify: `.graphifyignore:6`

**Interfaces:** None.

- [ ] **Step 1: Confirm the finding still holds**

Run: `grep -n "worktrees" CLAUDE.md`
Expected: a line under "Hard Invariants" stating "No git worktrees" — confirms `.worktrees/` can never exist, making the ignore line dead.

- [ ] **Step 2: Edit `.graphifyignore`**

Current (lines 1-6):

```
# build & vendored
node_modules/
dist/
.astro/
.wrangler/
.worktrees/
```

Replace with:

```
# build & vendored
node_modules/
dist/
.astro/
.wrangler/
```

- [ ] **Step 3: Verify the line is gone**

Run: `grep -c "worktrees" .graphifyignore`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add .graphifyignore
git commit -m "fix: delete dead .graphifyignore worktrees line (F4)"
```

---

### Task 3: Purge hardcoded decision-id/count references in `DECISIONS.md` (F3)

**Files:**
- Modify: `DECISIONS.md:5`, `DECISIONS.md:47`, `DECISIONS.md:62-64`

**Interfaces:** None — the derive command (`git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`) becomes the sole source of truth for "what's the next id"; no other file references these three lines.

- [ ] **Step 1: Confirm the finding still holds and capture the real current max**

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -3`
Expected: three numbers, all greater than 212 (confirms `DECISIONS.md:47`'s `D198` and `DECISIONS.md:64`'s `D212`/"192 decisions" are both already stale, not just eventually-stale).

- [ ] **Step 2: Edit the front-matter `updated` line**

Current (line 5):

```
updated: 2026-08-15 (D212)
```

Replace with:

```
updated: 2026-08-15
```

- [ ] **Step 3: Edit the "How to add a decision" next-id line**

Current (line 47):

```markdown
- Next id is the current maximum plus one (`D198` at time of writing). Don't trust that number — derive it: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`. Migrated table rows and new blocks share one id space, so both patterns must be searched.
```

Replace with:

```markdown
- Next id is the current maximum plus one — derive it, don't guess: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`. Migrated table rows and new blocks share one id space, so both patterns must be searched.
```

- [ ] **Step 4: Edit the ID-gap note**

Current (lines 62-64):

```markdown
## ID-gap note

Ids are non-contiguous: 192 decisions exist (163 migrated rows plus D184–D212), the highest is `D212`, and these 20 were never issued: `D18 D19 D29 D38 D39 D42 D43 D44 D45 D46 D47 D48 D49 D53 D54 D55 D56 D57 D58 D59`. These are numbering artifacts from the original distillation of the raw design history into this ledger (2026-07-11), not lost or deleted decisions. Do not renumber existing decisions or try to "fill" these ids.
```

Replace with:

```markdown
## ID-gap note

Ids are non-contiguous: derive the current count and highest id with the command in "How to add a decision" above rather than trusting a number here. These 20 were never issued: `D18 D19 D29 D38 D39 D42 D43 D44 D45 D46 D47 D48 D49 D53 D54 D55 D56 D57 D58 D59`. These are numbering artifacts from the original distillation of the raw design history into this ledger (2026-07-11), not lost or deleted decisions. Do not renumber existing decisions or try to "fill" these ids.
```

- [ ] **Step 5: Verify no hardcoded id/count figures remain**

Run: `grep -nE 'D198|D212|192 decisions' DECISIONS.md`
Expected: no output (exit code 1).

- [ ] **Step 6: Run the decision-ledger gate**

Run: `bash scripts/check-decision-ids.sh`
Expected: exits 0 (this script validates id uniqueness/registration, not the prose this task edited, so it should be unaffected — run it because `DECISIONS.md` changed).

- [ ] **Step 7: Commit**

```bash
git add DECISIONS.md
git commit -m "fix: purge hardcoded decision-id/count references in DECISIONS.md (F3)"
```

---

### Task 4: Correct `00-File-Inventory.md`'s stale `AGENT.md` description (F6)

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md:172`, `docs/architecture/00-File-Inventory.md:233`

**Interfaces:** None.

- [ ] **Step 1: Confirm the finding still holds against the live gate**

Run: `grep -n "STUB" scripts/check-agent-mirrors.sh | head -1`
Expected: a line showing the script asserts a fixed pointer-stub heredoc (D213), not a byte-identical mirror — confirms the two rows below are stale.

- [ ] **Step 2: Edit the `check-agent-mirrors.sh` row**

Current (line 172):

```markdown
| `scripts/check-agent-mirrors.sh` | Guard: every `CLAUDE.md` has a byte-identical `AGENT.md` sibling | canonical |
```

Replace with:

```markdown
| `scripts/check-agent-mirrors.sh` | Guard: every `CLAUDE.md` has an `AGENT.md` sibling holding the fixed pointer stub (D213) | canonical |
```

- [ ] **Step 3: Edit the `AGENT.md` row**

Current (line 233):

```markdown
| `AGENT.md` (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`) | Exact mirror of the sibling `CLAUDE.md` in the same directory, for agent tools that read `AGENT.md` instead of `CLAUDE.md`; edit both together (2026-07-15) | canonical |
```

Replace with:

```markdown
| `AGENT.md` (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`) | Fixed pointer stub redirecting to the sibling `CLAUDE.md` in the same directory — not a rule source, never carries content (D213, 2026-07-15) | canonical |
```

- [ ] **Step 4: Verify the stale wording is gone**

Run: `grep -n "byte-identical\|Exact mirror" docs/architecture/00-File-Inventory.md`
Expected: no output (exit code 1).

- [ ] **Step 5: Run the context-map gate**

Run: `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/00-File-Inventory.md
git commit -m "fix: correct File-Inventory.md's stale AGENT.md mirror description (F6)"
```

---

### Task 5: Register the two missing Context-Map-History rows (F14)

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (insert new entry at the top of the Version History section, immediately after the `# Version History` heading, above the current `> **Version:** 1.21.0` entry)

**Interfaces:** None — this is the file's next version number; Task 7 will add the entry after this one.

- [ ] **Step 1: Confirm the finding still holds**

Run: `grep -n "guest-player-501-setup-ui" docs/architecture/00-Context-Map-History.md`
Expected: no output (exit code 1) — confirms neither the spec nor the plan has a row yet.

Run: `git log -1 --format=%H --date=short -- docs/superpowers/specs/2026-08-21-guest-player-501-setup-ui-design.md`
Expected: `7e355d3` (the commit that introduced the spec).

Run: `git log -1 --format=%H --date=short -- docs/superpowers/plans/2026-08-21-guest-player-501-setup-ui.md`
Expected: `a66cd9f` (the commit that introduced the plan).

- [ ] **Step 2: Insert the new version entry**

Current top of the Version History section (lines 16-20):

```markdown
---

# Version History

> **Version:** 1.21.0 (2026-08-22 — whole-plan review fixes for the single-opponent-seat-remaining-engines plan, ...
```

Replace with (inserting the new entry between the heading and the 1.21.0 entry; substitute today's actual date for `YYYY-MM-DD`):

```markdown
---

# Version History

> **Version:** 1.22.0 (YYYY-MM-DD — belated registration: `docs/superpowers/specs/2026-08-21-guest-player-501-setup-ui-design.md` (2026-08-21, commit `7e355d3`) and its plan `docs/superpowers/plans/2026-08-21-guest-player-501-setup-ui.md` (2026-08-21, commit `a66cd9f`) never got a row here when they landed — F14. Added here as a belated registration of a previously-completed task; no code or other doc content changes with this entry.)

> **Version:** 1.21.0 (2026-08-22 — whole-plan review fixes for the single-opponent-seat-remaining-engines plan, ...
```

(Only the first two lines shown change; the rest of the 1.21.0 entry and everything below it is untouched — do not reflow or re-copy the full 1.21.0 body, this is a pure insertion above it.)

- [ ] **Step 3: Verify the insertion**

Run: `grep -n "guest-player-501-setup-ui" docs/architecture/00-Context-Map-History.md`
Expected: two lines, both inside the new 1.22.0 entry.

Run: `grep -n "Version:\*\* 1.2" docs/architecture/00-Context-Map-History.md | head -3`
Expected: `1.22.0` listed above `1.21.0`, confirming append-at-top ordering held.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/00-Context-Map-History.md
git commit -m "docs: register missing context-map-history rows for guest-player-501-setup-ui (F14)"
```

---

### Task 6: Close F1, F3, F4, F6, F14 in `FINDINGS.md`

**Files:**
- Modify: `FINDINGS.md` (delete 5 blocks, update `updated:` front matter)

**Interfaces:** None.

- [ ] **Step 1: Delete the five closed blocks**

Delete the entire `### F1 — ...` block (from `### F1` through the line before `### F3`), the entire `### F3 — ...` block, the entire `### F4 — ...` block, the entire `### F6 — ...` block, and the entire `### F14 — ...` block, each including its trailing blank line before the next `### F<n>` header. Do not touch `highest-issued: F27` — deleted ids are never reused, so the high-water mark does not move.

- [ ] **Step 2: Update the front-matter `updated` date**

Current (line 5 of `FINDINGS.md`):

```
updated: 2026-08-23
```

Replace with today's actual execution date in the same format (leave unchanged if a task in this plan already runs on 2026-08-23).

- [ ] **Step 3: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0, and confirms F1/F3/F4/F6/F14 are gone:

Run: `grep -cE '^### F(1|3|4|6|14) —' FINDINGS.md`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F1, F3, F4, F6, F14 (governance/context-doc drift fixes)"
```

---

### Task 7: Context-maintenance self-registration and full gate run

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (append this task's own entry, above the 1.22.0 entry added in Task 5)

**Interfaces:** None — this is the plan's final task.

- [ ] **Step 1: Confirm the next version number**

Run: `grep -m1 "Version:" docs/architecture/00-Context-Map-History.md`
Expected: `> **Version:** 1.22.0 ...` (Task 5's entry, the current top) — this task's entry becomes `1.23.0`.

- [ ] **Step 2: Insert this task's own version entry**

Insert immediately above the `> **Version:** 1.22.0` line (which stays exactly as Task 5 left it), substituting today's actual date for `YYYY-MM-DD`:

```markdown
> **Version:** 1.23.0 (YYYY-MM-DD — governance/context-doc drift closed: F1 (dropped 3 unusable `gh` CLI entries from `.claude/settings.json`'s allowlist), F3 (purged 3 hardcoded decision-id/count references from `DECISIONS.md`, leaving only the derive command as source of truth), F4 (deleted the dead `.worktrees/` line from `.graphifyignore`), F6 (corrected `00-File-Inventory.md`'s two stale "byte-identical AGENT.md mirror" rows to describe the D213 pointer-stub gate), F14 (see the 1.22.0 entry immediately below — belated registration of the guest-player-501-setup-ui spec/plan). Doc/config-only change set, no `app/` or `database/` files touched. Validation: `check-context-map.sh`, `check-doc-links.sh`, `check-decision-ids.sh`, `check-findings-log.sh`, `check-agent-mirrors.sh` all pass; `.claude/settings.json` confirmed valid JSON)
```

- [ ] **Step 3: Run the full applicable gate set**

Per the `run-all-gates` skill's "If only `docs/` changed" branch, plus the two decision/findings-specific gates this change set touches:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-decision-ids.sh
python3 -m json.tool .claude/settings.json > /dev/null && echo "settings.json valid"
```

Expected: every script exits 0; last line prints `settings.json valid`.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/00-Context-Map-History.md
git commit -m "docs: register governance-context-doc-drift task in context-map-history"
```

- [ ] **Step 5: Report**

State in the completion report: which of the five findings closed, the two Context-Map-History versions added (1.22.0, 1.23.0), and that every gate in Step 3 passed — per `context-maintenance`'s step 7 (confirm work is on an open PR targeting `main`, or note why not).

---

## Self-Review Notes

- **Spec coverage:** F1 → Task 1; F3 → Task 3; F4 → Task 2; F6 → Task 4; F14 → Task 5; FINDINGS.md closure (mandatory per root `CLAUDE.md`) → Task 6; context-maintenance registration (mandatory per `.claude/skills/context-maintenance/SKILL.md`) → Task 7. All five spec sections plus the two standing repo-wide obligations are covered.
- **No task depends on another's file** except Task 7, which depends on Task 5's insertion being present (checked explicitly in Task 7 Step 1) and Task 6 having already deleted the FINDINGS.md blocks (order: Tasks 1-5 in any order, then 6, then 7).
- **Placeholder scan:** the only unresolved value in any step is `YYYY-MM-DD`, which this plan's Global Constraints section explicitly defines as "substitute the actual execution date" — the same sanctioned pattern `DECISIONS.md`'s own decision-block template uses, not an unresolved TBD.
