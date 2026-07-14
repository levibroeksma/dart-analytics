# Mainline Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codify the branch-integration rule (work lands on `main` via PR when a task completes) and make "ADR" resolve unambiguously to `DECISIONS.md`.

**Architecture:** Spec Decision 1 (landing the divergence) was resolved 2026-07-14 by the user's fast-forward of `main` — this plan implements only Decisions 2–3. Pure doc edits: one invariant + one gate item in the root router, then a five-file wording sweep replacing the phantom ADR mechanism.

**Tech Stack:** Markdown, bash.

**Spec:** `docs/superpowers/specs/2026-07-14-mainline-reconciliation-design.md` (Decisions 2–3)

## Global Constraints

- **Prerequisite:** repo-restructure plan DONE — paths below are POST-restructure.
- Minimal diffs; historical files (`docs/superpowers/**`, `05-Database/07`–`09`) untouched even where they say "ADR".
- The immutable D-ledger rows are never rewritten; only forward-looking rule text changes.
- `bash scripts/check-context-map.sh` passes before every commit.

---

### Task 1: Branch-integration rule in the root router

**Files:**
- Modify: `CLAUDE.md` (root — Hard Invariants + Context Maintenance sections)
- Modify: `DECISIONS.md` (append D95)

- [ ] **Step 1: Prove the gap (failing check)**

```bash
grep -n "dedicated branch" CLAUDE.md
grep -n "open PR\|integrated into" CLAUDE.md
```

Expected: first grep hits the invariant; second returns nothing — no integration rule exists.

- [ ] **Step 2: Extend the Hard Invariant**

Replace:

```markdown
- Every task uses a dedicated branch; never merge to `main` directly; do not commit unless the user asks.
```

with:

```markdown
- Every task uses a dedicated branch; never merge to `main` directly; do not commit unless the user asks. A completed task's branch is integrated into `main` via PR promptly — long-lived divergence from `main` is a defect.
```

- [ ] **Step 3: Extend the Context Maintenance gate**

After item 6 (knowledge-graph refresh), add:

```markdown
7. Confirm the work is on `main` or an open PR targets `main`; report the PR link (or the reason none exists) in the completion report.
```

- [ ] **Step 4: Record the decision**

Append to the `Context & documentation system` table in `DECISIONS.md`:

```markdown
| D95 | 2026-07-14 | Branch-integration rule: task branches land on `main` via PR at task completion; divergence is a defect; completion gate item 7 verifies it | 2026-07-14 review found `main` ~50 commits stale with zero open PRs |
```

- [ ] **Step 5: Check + commit**

```bash
bash scripts/check-context-map.sh
git add CLAUDE.md DECISIONS.md
git commit -m "docs(governance): branch-integration invariant + completion-gate item 7 (D95)"
```

---

### Task 2: "ADR" resolves to DECISIONS.md everywhere forward-looking

**Files:**
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/03-Engineering-Workflow.md`
- Modify: `docs/architecture/099-engineering-workflow-and-decision-framework.md`
- Modify: `docs/architecture/04-Architecture-patterns.md`
- Modify: `.github/pull_request_template.md` (only if it mentions ADR — verify)

- [ ] **Step 1: Enumerate every live ADR mention (failing check)**

```bash
grep -rn "ADR" CLAUDE.md DECISIONS.md docs/architecture .github --include="*.md" | grep -v superpowers | grep -viv "09-ADR"
grep -rn "09-ADR" docs/architecture --include="*.md"
```

Expected hits to fix (any additional hits get the same treatment): README hierarchy `09-ADR/ (planned)` + Versioning paragraph; `03-Engineering-Workflow.md` Phase 4 ("Major architectural changes require an ADR."), Decision Framework ("Does this require an ADR?"), Documentation questions ("Is an ADR required?"); `099-…` flow box ("Architecture Decision (ADR if required)"), AI framework item 6 ("Does this require an ADR?"), PR checklist ("Does this require an ADR?"); `04-Architecture-patterns.md` adoption item 5 ("An ADR is created when appropriate.").

- [ ] **Step 2: `docs/architecture/README.md`**

1. Documentation Hierarchy: delete the two lines

```
09-ADR/        (planned)
```

(and the arrow line above it if it dangles).

2. Versioning section: `Major changes require a version bump and, where appropriate, an Architecture Decision Record (ADR).` → `Major changes require a version bump and, where appropriate, a dated entry in \`DECISIONS.md\` (the project's ADR mechanism, D52). <!-- 2026-07-14 -->`

- [ ] **Step 3: `03-Engineering-Workflow.md`**

- `Major architectural changes require an ADR.` → `Major architectural changes require a dated \`DECISIONS.md\` entry (one line + rationale — the project's ADR mechanism).`
- `- Does this require an ADR?` → `- Does this require a \`DECISIONS.md\` entry?` (both occurrences)
- `- Is an ADR required?` → `- Is a \`DECISIONS.md\` entry required?`

- [ ] **Step 4: `099-engineering-workflow-and-decision-framework.md`**

- Flow box line `Architecture Decision (ADR if required)` → `Architecture Decision (DECISIONS.md entry if required)`
- `6. Does this require an ADR?` → `6. Does this require a DECISIONS.md entry?`
- PR checklist `✓ Does this require an ADR?` → `✓ Does this require a DECISIONS.md entry?`

- [ ] **Step 5: `04-Architecture-patterns.md`**

`5. An ADR is created when appropriate.` → `5. A \`DECISIONS.md\` entry is recorded when the pattern is adopted.`

- [ ] **Step 6: `.github/pull_request_template.md`**

```bash
grep -n "ADR" .github/pull_request_template.md
```

If it renders the 099 checklist, apply the same replacement (`Does this require an ADR?` → `Does this require a DECISIONS.md entry?`). If no hits, skip.

- [ ] **Step 7: Verify the sweep is complete**

```bash
grep -rn "ADR" CLAUDE.md DECISIONS.md docs/architecture .github --include="*.md" | grep -v superpowers | grep -v "ADR mechanism"
```

Expected: empty (the only surviving mentions are the two "the project's ADR mechanism" self-references).

- [ ] **Step 8: Check + commit**

```bash
bash scripts/check-context-map.sh
git add docs/architecture .github/pull_request_template.md 2>/dev/null; git add docs/architecture
git commit -m "docs(governance): ADR resolves to DECISIONS.md; retire the planned 09-ADR directory"
```
