# Context-Layer Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale doc references, retire the redundant `099` workflow quick-ref (fold routing onto `03-Engineering-Workflow.md`), recalibrate Context Map token budgets to chars/4 truth, de-duplicate root `CLAUDE.md` Forbidden Actions, and mechanize link + budget drift via two new check scripts wired into Context Maintenance and CI.

**Architecture:** Docs-only change set. Targeted markdown edits for L1/L2/L3 and T2; delete `099-engineering-workflow-and-decision-framework.md` and retarget Context Map / `docs/CLAUDE.md` / architecture README / PR template to `03` alone; human-authored budget numbers in `00-Context-Map.md` guarded (never auto-rewritten) by `check-context-budget.sh`; path/link integrity guarded by `check-doc-links.sh` matching existing `scripts/check-*.sh` style (bash wrapper + embedded Python). Both scripts join the Context-Maintenance gate (5→7) and `.github/workflows/checks.yml`.

**Tech Stack:** Markdown, bash, Python 3 (stdlib only), GitHub Actions. No new dependencies. No application code.

**Spec:** `docs/superpowers/specs/2026-07-23-context-layer-hardening-design.md`

## Global Constraints

- **Docs / context-system layer only — no application code changes** (no edits under `app/src/`, `app/tests/`, or `database/migrations|seeds`).
- Minimal diffs; validate and fix docs with targeted edits — never regenerate them.
- Numbers in the Context Map are **human-authored**; scripts **never rewrite** the doc — they fail and print computed values.
- Per-file budget drift tolerance: **>20%** fails (`|claimed − computed| / computed > 0.20`).
- Per-pack budget drift tolerance: **>30%** fails; non-`.md` pack entries skipped and the row flagged `approx`.
- Token estimate heuristic: **chars/4** (no tokenizer dependency).
- Canonical scan scope for link checks: `docs/architecture/**/*.md`, the six `CLAUDE.md`/`AGENT.md` pairs, root `README.md`.
- Excluded from link scan: `docs/superpowers/**`, `.claude/`, `.cursor/`, `.superpowers/`, `node_modules/`, `graphify-out/`.
- `DECISIONS.md` backtick path-like refs are skipped (history names deleted files); its markdown links are still checked if the file is ever in scope — it is **not** in the canonical scan list, so only architecture/CLAUDE/README are scanned.
- Alias expansion (exact): `@client`→`app/src/lib/client`, `@server`→`app/src/lib/server`, `@lib`→`app/src/lib`, `@utils`→`app/src/lib/utils`, `@auth`→`app/src/lib/auth`, `@db`→`app/src/db`, `@services`→`app/src/services`, `@repositories`→`app/src/repositories`, `@routes`→`app/src/pages/api`, `@components`→`app/src/components`, `@layouts`→`app/src/layouts`, `@icons`→`app/src/icons`.
- Skip path-like backtick refs that are bare filenames (no `/`), or contain `*`, `…`, `<`, `>`, `|`, whitespace, or the placeholder token `NN`.
- Path-like backtick refs must contain `/` and end in `.md|.sh|.sql|.ts|.astro|.css`.
- Root `CLAUDE.md` and `AGENT.md` must stay **byte-identical** (`check-agent-mirrors.sh`).
- Branch: `git checkout -b feat/context-layer-hardening` in the main working copy — **no git worktrees** (D102 / root CLAUDE.md).
- Do not modify applied migrations; do not touch historical `docs/superpowers/` except this plan (already there) and the design spec (already there).
- Decision ledger entry **D133** text is fixed in the spec — use it verbatim.
- **D134** (this plan, not in the original design spec): retire `099-engineering-workflow-and-decision-framework.md`; `03-Engineering-Workflow.md` is the sole workflow/process authority; PR checklist authority moves to the inlined `.github/pull_request_template.md` (with a pointer to `03`).
- After every task: existing checkers that still apply must pass; after Task 6 all **7** scripts pass.
- Task 1 includes **L3** (`02-Middleware-And-Layering.md` abbreviated `events/batch.ts`) — not in the original spec §1, but required for `check-doc-links.sh` acceptance after §1-class fixes. Do not widen the resolver to paper over it.
- Task 2 (099 retirement) must land **before** `check-doc-links.sh` positive acceptance so no dangling path-like refs remain.
- Do **not** edit historical `docs/superpowers/plans/*` that mention `099` (historical tree).
- Task 6 must run `cd app && npm test` and `npx astro check` once (expect green; escalate if not — no app fixes under this plan).
- `docs/CLAUDE.md` and `docs/AGENT.md` must stay byte-identical (same as root mirrors).

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `docs/architecture/07-Frontend/03-Alpine-Patterns.md` | L1: `Timer` → `SegmentTimer` path/name |
| `docs/architecture/06-API/03-Shared-Conventions.md` | L2: area-barrel example paths |
| `docs/architecture/06-API/02-Middleware-And-Layering.md` | L3 (acceptance blocker): abbreviated `events/batch.ts` → real route path |
| `docs/architecture/099-engineering-workflow-and-decision-framework.md` | **Delete** — redundant quick-ref of `03-Engineering-Workflow.md` |
| `docs/architecture/00-Context-Map.md` | Drop `099` from pack / authority / inventory; later recalibrate budgets + maintenance note |
| `docs/CLAUDE.md` + `docs/AGENT.md` | Workflow/process routing → `03` only |
| `docs/architecture/README.md` | Drop `099` from tree, hierarchy, Development Workflow |
| `.github/pull_request_template.md` | Checklist authority → `03` + inlined template |
| `scripts/check-doc-links.sh` | **Create** — markdown links + path-like backticks across canonical docs |
| `scripts/check-context-budget.sh` | **Create** — per-file (20%) + per-pack (30%) chars/4 drift guard |
| `CLAUDE.md` + `AGENT.md` | T2 Forbidden Actions dedup; Context Maintenance step 5 lists 7 scripts |
| `.github/workflows/checks.yml` | Two new structure-job steps |
| `DECISIONS.md` | D133 (guards) + D134 (`099` retirement) |

---

### Task 1: Stale-reference fixes (L1, L2, L3)

**Files:**
- Modify: `docs/architecture/07-Frontend/03-Alpine-Patterns.md:105`
- Modify: `docs/architecture/06-API/03-Shared-Conventions.md:128-129`
- Modify: `docs/architecture/06-API/02-Middleware-And-Layering.md:203`

**Interfaces:**
- Consumes: none
- Produces: corrected canonical prose that Task 3's positive acceptance depends on

**Note:** L1/L2 are named in the design spec. L3 is an acceptance blocker discovered during plan validation: after L1/L2 alone, the planned `check-doc-links.sh` still fails on an abbreviated route path. Fix it here so Task 3's “exit 0 after §1-class fixes” claim holds without widening the resolver.

- [ ] **Step 1: Prove L1/L2/L3 defects exist; verify timer state fields**

```bash
grep -n 'timer.module.ts\|`Timer` module' docs/architecture/07-Frontend/03-Alpine-Patterns.md
# expect line 105 mentioning modules/ui/timer.module.ts and Timer module

test -f app/src/modules/ui/segment-timer.module.ts && echo "segment-timer exists"
test ! -f app/src/modules/ui/timer.module.ts && echo "old timer path absent"

grep -n 'timerRemainingMs\|timerStartedAt' app/src/stores/game.store.ts
# expect both fields present — do NOT rename them in the doc

grep -n 'repositories/types.ts\|routes/types.ts' docs/architecture/06-API/03-Shared-Conventions.md
# expect line ~128

ls app/src/repositories/interfaces.ts app/src/pages/api/types.ts

grep -n 'events/batch\.ts' docs/architecture/06-API/02-Middleware-And-Layering.md
# expect abbreviated `events/batch.ts` (not the full sessions/[sessionId]/… path)

test -f 'app/src/pages/api/sessions/[sessionId]/events/batch.ts' && echo "batch route exists"
```

- [ ] **Step 2: Fix L1 in Alpine-Patterns**

Replace line 105 exactly:

From:
```markdown
Timer **state** (`timerRemainingMs`, `timerStartedAt`) lives in `game.store.ts` for recovery. The `Timer` module (`modules/ui/timer.module.ts`) drives display only.
```

To:
```markdown
Timer **state** (`timerRemainingMs`, `timerStartedAt`) lives in `game.store.ts` for recovery. The `SegmentTimer` module (`modules/ui/segment-timer.module.ts`) drives display only.
```

Report in the commit/body or task notes: state-field names `timerRemainingMs` / `timerStartedAt` match `game.store.ts` (no drift).

- [ ] **Step 3: Fix L2 in Shared-Conventions**

Replace the area-barrel example list only (keep surrounding raising-rule prose unchanged):

From:
```markdown
**top-level area barrel** (`services/types.ts`, `repositories/types.ts`,
`routes/types.ts`, `lib/types.ts`), so every consumer imports one shallow,
```

To:
```markdown
**top-level area barrel** (`services/types.ts`, `repositories/interfaces.ts`,
`pages/api/types.ts` (`@routes/types`), `lib/types.ts`), so every consumer imports one shallow,
```

- [ ] **Step 4: Fix L3 in Middleware-And-Layering**

In the “Route file mapping note” paragraph (~line 203), replace the abbreviated route-file backtick only (keep the public URL and surrounding prose unchanged):

From:
```markdown
served natively by the `events/batch.ts` route file.
```

To:
```markdown
served natively by the `pages/api/sessions/[sessionId]/events/batch.ts` route file.
```

Resolver check: with bases including `app/src/`, that path resolves to `app/src/pages/api/sessions/[sessionId]/events/batch.ts`. Do **not** broaden aliases or add glob/fuzzy matching to make the old shorthand pass.

- [ ] **Step 5: Verify + commit**

```bash
grep -n 'timer.module.ts\|repositories/types.ts\|routes/types.ts\|`events/batch\.ts`' \
  docs/architecture/07-Frontend/03-Alpine-Patterns.md \
  docs/architecture/06-API/03-Shared-Conventions.md \
  docs/architecture/06-API/02-Middleware-And-Layering.md
# expect: no hits on the stale forms

grep -n 'segment-timer.module.ts\|SegmentTimer\|repositories/interfaces.ts\|pages/api/types.ts\|sessions/\[sessionId\]/events/batch\.ts' \
  docs/architecture/07-Frontend/03-Alpine-Patterns.md \
  docs/architecture/06-API/03-Shared-Conventions.md \
  docs/architecture/06-API/02-Middleware-And-Layering.md
# expect: hits on the corrected lines

bash scripts/check-context-map.sh
git add docs/architecture/07-Frontend/03-Alpine-Patterns.md \
        docs/architecture/06-API/03-Shared-Conventions.md \
        docs/architecture/06-API/02-Middleware-And-Layering.md
git commit -m "$(cat <<'EOF'
docs: fix stale Timer/barrel/batch path refs in Alpine + API docs

EOF
)"
```

---

### Task 2: Retire `099` workflow quick-reference

**Files:**
- Delete: `docs/architecture/099-engineering-workflow-and-decision-framework.md`
- Modify: `docs/architecture/00-Context-Map.md` (pack row, Authority Order #7, File Inventory row)
- Modify: `docs/CLAUDE.md` + `docs/AGENT.md` (Workflow/process routing)
- Modify: `docs/architecture/README.md` (tree, hierarchy, Development Workflow)
- Modify: `.github/pull_request_template.md` (authority comments)
- Modify: `DECISIONS.md` (D134)

**Interfaces:**
- Consumes: none from Task 1
- Produces: single workflow authority (`03-Engineering-Workflow.md`); no dangling `099` path refs for Task 3 link checker; Context Map inventory/pack without `099` (budget numbers finalized in Task 4)

**Rationale:** `099` is a compressed duplicate of `03`. The workflow pack currently loads both (~3.6k). PR checklist is already inlined in the template. Historical `docs/superpowers/plans/*` that mention `099` are left untouched.

- [ ] **Step 1: Prove live references (canonical only)**

```bash
rg -n '099-engineering-workflow' \
  docs/architecture docs/CLAUDE.md docs/AGENT.md \
  .github/pull_request_template.md CLAUDE.md AGENT.md \
  --glob '!docs/superpowers/**'
# expect hits only in: 00-Context-Map, README, docs/CLAUDE, docs/AGENT, PR template, and the 099 file itself
```

- [ ] **Step 2: Context Map — pack, authority, inventory**

In `docs/architecture/00-Context-Map.md`:

1. Context Packs row — replace:

```markdown
| Workflow / process question | `03-Engineering-Workflow.md`, `099-engineering-workflow-and-decision-framework.md` | ~3.5k |
```

with:

```markdown
| Workflow / process question | `03-Engineering-Workflow.md` | ~2.2k |
```

(`~2.2k` = chars/4 of `03` alone at plan-write time; Task 4 re-verifies.)

2. Authority Order item 7 — replace:

```markdown
7. `03-Engineering-Workflow.md` / `099-engineering-workflow-and-decision-framework.md`
```

with:

```markdown
7. `03-Engineering-Workflow.md`
```

3. File Inventory — **delete** the entire row:

```markdown
| `099-engineering-workflow-and-decision-framework.md` | Workflow quick reference | canonical | ~1.3k |
```

Do not bump map version here (Task 6 owns the version/Maintenance Protocol bump with D133).

- [ ] **Step 3: `docs/CLAUDE.md` + `docs/AGENT.md`**

Replace the Workflow/process routing bullet:

From:
```markdown
- **Workflow/process:** `03-Engineering-Workflow.md` + `099-engineering-workflow-and-decision-framework.md`
```

To:
```markdown
- **Workflow/process:** `03-Engineering-Workflow.md`
```

```bash
cp docs/CLAUDE.md docs/AGENT.md
bash scripts/check-agent-mirrors.sh
```

- [ ] **Step 4: `docs/architecture/README.md`**

Three edits:

1. Repository Structure tree — delete the line:
```
│   ├── 099-engineering-workflow-and-decision-framework.md
```

2. Documentation Hierarchy — delete the companion line (exact text today):
```
099-engineering-workflow-and-decision-framework.md  (quick-reference companion)
```

3. Development Workflow section — replace:

```markdown
Every feature follows the lifecycle defined in `03-Engineering-Workflow.md` (10 phases). Use `099-engineering-workflow-and-decision-framework.md` as the quick-reference companion.
```

with:

```markdown
Every feature follows the lifecycle defined in `03-Engineering-Workflow.md` (10 phases).
```

- [ ] **Step 5: `.github/pull_request_template.md`**

Replace the authority comment at the top:

From:
```markdown
Authority for the architecture checklist below:
docs/architecture/099-engineering-workflow-and-decision-framework.md
```

To:
```markdown
Authority for the architecture checklist below:
docs/architecture/03-Engineering-Workflow.md (Review Checklist / Definition of Done).
The checkbox list is inlined here so every PR prefills it.
```

Replace the Architecture checklist HTML comment:

From:
```markdown
<!-- The Pull Request Checklist from 099-engineering-workflow-and-decision-framework.md,
     as checkboxes. Confirm each or mark N/A. -->
```

To:
```markdown
<!-- Architecture checklist derived from 03-Engineering-Workflow.md
     (Review Checklist / Definition of Done). Confirm each or mark N/A. -->
```

Do **not** change the checkbox items themselves.

- [ ] **Step 6: Delete the file + D134**

```bash
git rm docs/architecture/099-engineering-workflow-and-decision-framework.md
```

In `DECISIONS.md` section `## Context & documentation system`, append after D107 (or after whatever is last in that table before stray rows):

```markdown
| D134 | 2026-07-23 | Retired `099-engineering-workflow-and-decision-framework.md`: it was a compressed duplicate of `03-Engineering-Workflow.md`; Context Map workflow pack / Authority Order #7 / `docs/CLAUDE.md` routing / architecture README now point at `03` alone; PR template checklist authority cites `03` while the actionable checkboxes remain inlined in `.github/pull_request_template.md` | Dual load wasted tokens for no unique authority; checklist already lived in the PR template |
```

Bump `DECISIONS.md` front-matter `updated:` to `2026-07-23` if not already.

- [ ] **Step 7: Verify + commit**

```bash
rg -n '099-engineering-workflow' \
  docs/architecture docs/CLAUDE.md docs/AGENT.md \
  .github/pull_request_template.md \
  --glob '!docs/superpowers/**'
# expect: no hits

test ! -f docs/architecture/099-engineering-workflow-and-decision-framework.md && echo "099 deleted"

bash scripts/check-context-map.sh
bash scripts/check-agent-mirrors.sh

git add docs/architecture/00-Context-Map.md \
        docs/architecture/README.md \
        docs/CLAUDE.md docs/AGENT.md \
        .github/pull_request_template.md \
        DECISIONS.md
# git rm already staged the deletion
git commit -m "$(cat <<'EOF'
docs: retire 099 workflow quick-ref; route workflow/process to 03 alone

EOF
)"
```

---

### Task 3: `scripts/check-doc-links.sh`

**Files:**
- Create: `scripts/check-doc-links.sh`

**Interfaces:**
- Consumes: Task 1 corrections + Task 2 `099` retirement (positive acceptance requires L1/L2/L3 fixed and no dangling `099` refs)
- Produces: executable gate used by Task 6 (CLAUDE step 5 + CI)

- [ ] **Step 1: Create the script**

Write `scripts/check-doc-links.sh` with mode `755` (`chmod +x`). Match the bash+embedded-Python style of `scripts/check-astro-conventions.sh`. Full contents:

```bash
#!/usr/bin/env bash
# Doc-link / path-reference gate — Context Maintenance (root CLAUDE.md).
# Validates markdown links and path-like backtick refs across the canonical
# doc set. Alias/base-aware; skips bare identifiers and DECISIONS history noise
# (DECISIONS.md is outside the scan set). See D133.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(".").resolve()
FAIL = 0

ALIASES = {
    "@client": "app/src/lib/client",
    "@server": "app/src/lib/server",
    "@lib": "app/src/lib",
    "@utils": "app/src/lib/utils",
    "@auth": "app/src/lib/auth",
    "@db": "app/src/db",
    "@services": "app/src/services",
    "@repositories": "app/src/repositories",
    "@routes": "app/src/pages/api",
    "@components": "app/src/components",
    "@layouts": "app/src/layouts",
    "@icons": "app/src/icons",
}

BASES = [
    Path("."),
    Path("docs/architecture"),
    Path("docs/architecture/05-Database"),
    Path("database"),
    Path("app"),
    Path("app/src"),
]

SKIP_CHARS = set("*…<>| \t\n")
PATH_LIKE = re.compile(
    r"`([^`]*?/[^`]*?\.(?:md|sh|sql|ts|astro|css))`"
)
MD_LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def canonical_files() -> list[Path]:
    files: list[Path] = []
    files.extend(sorted(Path("docs/architecture").rglob("*.md")))
    pairs = [
        Path("CLAUDE.md"),
        Path("AGENT.md"),
        Path("app/CLAUDE.md"),
        Path("app/AGENT.md"),
        Path("app/src/db/CLAUDE.md"),
        Path("app/src/db/AGENT.md"),
        Path("app/src/pages/api/CLAUDE.md"),
        Path("app/src/pages/api/AGENT.md"),
        Path("database/CLAUDE.md"),
        Path("database/AGENT.md"),
        Path("docs/CLAUDE.md"),
        Path("docs/AGENT.md"),
        Path("README.md"),
    ]
    for p in pairs:
        if p.is_file():
            files.append(p)
    # de-dupe while preserving order
    seen: set[Path] = set()
    out: list[Path] = []
    for p in files:
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        out.append(p)
    return out


def should_skip_backtick(ref: str) -> bool:
    if "/" not in ref:
        return True
    if "NN" in ref:
        return True
    if any(c in SKIP_CHARS for c in ref):
        return True
    return False


def expand_alias(ref: str) -> str | None:
    for prefix, target in ALIASES.items():
        if ref == prefix or ref.startswith(prefix + "/"):
            rest = ref[len(prefix) :].lstrip("/")
            return f"{target}/{rest}" if rest else target
    return None


def candidates(ref: str, source: Path) -> list[Path]:
    expanded = expand_alias(ref)
    refs = [expanded] if expanded else [ref]
    # also try stripping a leading ./ 
    refs = [r[2:] if r.startswith("./") else r for r in refs]
    out: list[Path] = []
    for r in refs:
        out.append(source.parent / r)
        for base in BASES:
            out.append(base / r)
        out.append(ROOT / r)
    return out


def resolves(ref: str, source: Path) -> bool:
    for c in candidates(ref, source):
        try:
            if c.exists():
                return True
        except OSError:
            continue
    return False


def check_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    # 1) markdown links
    for m in MD_LINK.finditer(text):
        target = m.group(2).strip()
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        # strip anchor / query
        local = target.split("#", 1)[0].split("?", 1)[0]
        if not local:
            continue
        if not resolves(local, path):
            err(f"{path}: unresolved markdown link ({m.group(1)}) -> {target}")
    # 2) path-like backticks
    for m in PATH_LIKE.finditer(text):
        ref = m.group(1)
        if should_skip_backtick(ref):
            continue
        if not resolves(ref, path):
            err(f"{path}: unresolved path-like reference `{ref}`")


def main() -> int:
    files = canonical_files()
    if not files:
        err("no canonical docs found to scan")
        return 1
    for path in files:
        # safety: never scan superpowers historical tree even if rglob somehow includes it
        if "docs/superpowers" in path.parts:
            continue
        check_file(path)
    if FAIL:
        return 1
    print(f"OK: doc links and path-like references resolve ({len(files)} files scanned).")
    return 0


sys.exit(main())
PY
```

- [ ] **Step 2: Positive acceptance — must exit 0 on current tree (after Tasks 1–2)**

```bash
chmod +x scripts/check-doc-links.sh
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: `OK: doc links...` and `exit=0`.

Tasks 1–2 already cleared the known acceptance blockers (L1/L2/L3 + `099` retirement). If a *new* unresolved ref appears:

1. Prefer a **minimal targeted doc fix** (same class as L3) over widening the resolver.
2. Only adjust bases/aliases/skips when the ref is valid prose that the spec's skip/alias rules should already ignore.
3. Do **not** add fuzzy/substring matching to make abbreviated paths pass.

- [ ] **Step 3: Negative test — reintroduce L1, expect non-zero, then restore**

```bash
# break
python3 - <<'PY'
from pathlib import Path
p = Path("docs/architecture/07-Frontend/03-Alpine-Patterns.md")
t = p.read_text()
old = "The `SegmentTimer` module (`modules/ui/segment-timer.module.ts`)"
new = "The `Timer` module (`modules/ui/timer.module.ts`)"
assert old in t, "Task 1 fix not present — abort"
p.write_text(t.replace(old, new, 1))
PY

bash scripts/check-doc-links.sh; echo "exit=$?"
# expect: FAIL naming timer.module.ts (or unresolved path-like reference); exit=1

# restore
git checkout -- docs/architecture/07-Frontend/03-Alpine-Patterns.md
bash scripts/check-doc-links.sh
# expect: OK, exit 0
```

- [ ] **Step 4: Commit**

```bash
git add scripts/check-doc-links.sh
git commit -m "$(cat <<'EOF'
feat: add check-doc-links.sh for canonical doc path integrity

EOF
)"
```

---

### Task 4: Budget recalibration + `scripts/check-context-budget.sh`

**Files:**
- Modify: `docs/architecture/00-Context-Map.md` (File Inventory `~Tokens` + Context Packs `~Budget`)
- Create: `scripts/check-context-budget.sh`

**Interfaces:**
- Consumes: Task 2 already removed `099` from the map (pack/authority/inventory)
- Produces: truthful budgets + gate used by Task 6

- [ ] **Step 1: Recompute chars/4 and apply File Inventory updates**

Run (do not commit the helper output — use it to edit the map):

```bash
python3 <<'PY'
from pathlib import Path

def est(p: Path) -> float:
    return len(p.read_text(encoding="utf-8")) / 4 / 1000

def fmt(c: float) -> str:
    r = round(c * 10) / 10
    return f"~{int(r)}k" if r == int(r) else f"~{r}k"

arch = Path("docs/architecture")
db = arch / "05-Database"
# Print targets — apply these to the ~Tokens column (leave Answers/Status alone).
# Apply ALL rows except 00-Context-Map.md last (recompute after other edits).
rows = [
    (arch / "README.md", "README.md"),
    (arch / "01-Principles.md", "01-Principles.md"),
    (arch / "02-System-Architecture.md", "02-System-Architecture.md"),
    (arch / "03-Engineering-Workflow.md", "03-Engineering-Workflow.md"),
    (arch / "04-Architecture-patterns.md", "04-Architecture-patterns.md"),
]
# NOTE: 099-engineering-workflow-and-decision-framework.md was deleted in Task 2 — do not list it.
for path, label in rows:
    print(f"{label}: {fmt(est(path))}")
for name in [
    "00-OVERVIEW.md", "01-Naming-Conventions.md", "02-Design-Rules.md",
    "03-Migrations.md", "04-Indexes.md", "05-Views.md",
    "06-Database-Specification.md",
    "06-Spec/01-Reference-Layer.md", "06-Spec/02-Template-Layer.md",
    "06-Spec/03-Player-Layer.md", "06-Spec/04-Runtime-Layer.md",
    "06-Spec/05-Read-Model-Layer.md", "06-Spec/06-Relationships-and-Evolution.md",
    "07-Data-Model-Review.md", "08-Physical-Schema-Mapping.md",
    "09-Pre-Implementation-Review.md", "10-Database-Agent-Guide.md",
    "11-Neon-Integration.md",
]:
    print(f"{name}: {fmt(est(db / name))}")
for name in [
    "06-API/00-Overview.md", "06-API/01-Implementation-Strategy.md",
    "06-API/02-Middleware-And-Layering.md", "06-API/03-Shared-Conventions.md",
    "06-API/04-Endpoint-Contracts.md",
    "07-Frontend/00-Overview.md", "07-Frontend/01-Rendering-Strategy.md",
    "07-Frontend/02-Folder-Structure.md", "07-Frontend/03-Alpine-Patterns.md",
    "07-Frontend/04-Modules-And-OOP.md", "07-Frontend/05-Astro-Components.md",
    "07-Frontend/06-Test-Strategy.md", "07-Frontend/07-Style-Guide.md",
    "07-Frontend/10-Frontend-Agent-Guide.md",
]:
    print(f"{name}: {fmt(est(arch / name))}")
PY
```

**Baseline targets at plan-write time** (re-run the helper if files changed; round with the same `fmt`):

| Path | Old | New |
| ---- | --- | --- |
| `README.md` (architecture) | ~1.8k | ~1.5k |
| `00-Context-Map.md` | ~1.5k | set last after all map edits |
| `01-Principles.md` | ~2.1k | ~2.1k |
| `02-System-Architecture.md` | ~1.9k | ~1.9k |
| `03-Engineering-Workflow.md` | ~2.1k | ~2.2k |
| `04-Architecture-patterns.md` | ~2.8k | ~3k |
| `00-OVERVIEW.md` | ~2.5k | ~2.5k |
| `01-Naming-Conventions.md` | ~1.9k | ~2.3k |
| `02-Design-Rules.md` | ~2.4k | ~2.4k |
| `03-Migrations.md` | ~2.9k | ~3.5k |
| `04-Indexes.md` | ~2.5k | ~2.6k |
| `05-Views.md` | ~2.0k | ~2.2k |
| `06-Database-Specification.md` | ~2.2k | ~2.2k |
| `06-Spec/01-Reference-Layer.md` | ~1.6k | ~1.7k |
| `06-Spec/02-Template-Layer.md` | ~1.6k | ~1.6k |
| `06-Spec/03-Player-Layer.md` | ~0.6k | ~0.7k |
| `06-Spec/04-Runtime-Layer.md` | ~2.8k | ~3k |
| `06-Spec/05-Read-Model-Layer.md` | ~1.2k | ~1.7k |
| `06-Spec/06-Relationships-and-Evolution.md` | ~1.7k | ~1.7k |
| `07-Data-Model-Review.md` | ~2.2k | ~2.3k |
| `08-Physical-Schema-Mapping.md` | ~2.2k | ~2.2k |
| `09-Pre-Implementation-Review.md` | ~1.4k | ~1.5k |
| `10-Database-Agent-Guide.md` | ~2.0k | ~2.2k |
| `11-Neon-Integration.md` | ~1.0k | ~1.3k |
| `06-API/00-Overview.md` | ~1.7k | ~2.6k |
| `06-API/01-Implementation-Strategy.md` | ~2.0k | ~2.1k |
| `06-API/02-Middleware-And-Layering.md` | ~2.2k | ~2.9k |
| `06-API/03-Shared-Conventions.md` | ~1.4k | ~3.3k |
| `06-API/04-Endpoint-Contracts.md` | ~2.9k | ~5.1k |
| `07-Frontend/00-Overview.md` | ~1.8k | ~2.6k |
| `07-Frontend/01-Rendering-Strategy.md` | ~2k | ~2.1k |
| `07-Frontend/02-Folder-Structure.md` | ~2k | ~1.7k |
| `07-Frontend/03-Alpine-Patterns.md` | ~2.5k | ~3.2k |
| `07-Frontend/04-Modules-And-OOP.md` | ~2k | ~1.3k |
| `07-Frontend/05-Astro-Components.md` | ~2k | ~2.1k |
| `07-Frontend/06-Test-Strategy.md` | ~1k | ~0.7k |
| `07-Frontend/07-Style-Guide.md` | ~3k | ~2.9k |
| `07-Frontend/10-Frontend-Agent-Guide.md` | ~2k | ~2.1k |

Edit only the `~Tokens` cell values. Do not invent a `~Tokens` column for the Context & history section (DECISIONS pack budget is updated in Step 2).

- [ ] **Step 2: Recalibrate Context Pack `~Budget` values**

Replace each pack's `~Budget` with the chars/4 sum of its backticked `.md` files (non-`.md` entries skipped — those rows are `approx` under the guard). Baseline targets:

| Task type | Old | New |
| --------- | --- | --- |
| New table / column / constraint | ~7k | ~5.7k |
| New view / analytics query | ~5k | ~3.9k |
| New seed data | ~5k | ~1.7k |
| Neon environment / tooling | ~2k | ~3.5k |
| New API endpoint | ~6k | ~9.9k |
| API middleware / layering change | ~5k | ~8.3k |
| Frontend page / component work | ~7.5k | ~11.9k |
| Frontend gameplay / session features | ~8k | ~14.3k |
| Frontend new route / rendering | ~6k | ~10.7k |
| Frontend architecture / new pattern | ~10k | ~15.6k |
| New portable UI primitive | ~6.5k | ~9.5k |
| New test / test-strategy question | ~3k | ~2.9k |
| New game type | ~7k | ~5.5k |
| Architecture question / new pattern | ~5k | ~5.2k |
| Workflow / process question | ~2.2k (set in Task 2) | ~2.2k |
| "Why was X decided?" | ~2k | ~8.5k |
| Bug in migration chain | ~6k | ~3.5k |

Then set `00-Context-Map.md`'s own inventory `~Tokens` from `fmt(est(arch/"00-Context-Map.md"))` after these edits (expect ~3.5k–3.7k).

- [ ] **Step 3: Create `scripts/check-context-budget.sh`**

```bash
#!/usr/bin/env bash
# Context-map token-budget drift gate — Context Maintenance (root CLAUDE.md).
# Compares human-authored ~Nk values in 00-Context-Map.md to chars/4 estimates.
# Never rewrites the map. Per-file tolerance 20%; per-pack tolerance 30% (approx
# when non-.md entries are skipped). See D133.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(".").resolve()
MAP = Path("docs/architecture/00-Context-Map.md")
ARCH = Path("docs/architecture")
FAIL = 0

FILE_ROW = re.compile(
    r"\|\s*`([^`]+)`\s*\|[^|]*\|[^|]*\|\s*(~[\d.]+k)\s*\|"
)
PACK_ROW = re.compile(
    r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(~[\d.]+k)\s*\|"
)
BACKTICK = re.compile(r"`([^`]+)`")


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def chars4_k(path: Path) -> float:
    return len(path.read_text(encoding="utf-8")) / 4 / 1000


def parse_claimed(token: str) -> float:
    return float(token[1:-1])  # strip leading ~ and trailing k


def fmt_k(v: float) -> str:
    r = round(v * 10) / 10
    return f"~{int(r)}k" if r == int(r) else f"~{r}k"


def resolve_inventory_path(ref: str) -> Path | None:
    """Resolve a File Inventory backtick path to a real file."""
    candidates = [
        ARCH / ref,
        ARCH / "05-Database" / ref,
        ROOT / ref,
        ROOT / "docs" / ref,
        ROOT / "database" / ref,
        ROOT / "app" / ref,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def resolve_pack_md(ref: str) -> Path | None:
    if not ref.endswith(".md"):
        return None
    if ref == "DECISIONS.md":
        p = ROOT / "DECISIONS.md"
        return p if p.is_file() else None
    if ref == "app/CLAUDE.md":
        p = ROOT / "app" / "CLAUDE.md"
        return p if p.is_file() else None
    candidates = [
        ARCH / ref,
        ARCH / "05-Database" / ref,
        ROOT / ref,
        ROOT / "docs" / ref,
        ROOT / "app" / ref,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def check_files(text: str) -> None:
    # Only scan File Inventory section (after "# File Inventory")
    if "# File Inventory" not in text:
        err("00-Context-Map.md missing # File Inventory heading")
        return
    inv = text.split("# File Inventory", 1)[1]
    # stop before Non-Canonical / later sections that lack ~Tokens
    for stop in ("# Non-Canonical Source Material", "# Current Implementation State", "# Maintenance Protocol"):
        if stop in inv:
            inv = inv.split(stop, 1)[0]
            break
    for m in FILE_ROW.finditer(inv):
        ref, claimed_s = m.group(1), m.group(2)
        path = resolve_inventory_path(ref)
        if path is None:
            err(f"inventory path not found: `{ref}` claimed={claimed_s}")
            continue
        computed = chars4_k(path)
        claimed = parse_claimed(claimed_s)
        if computed <= 0:
            err(f"{ref}: computed token estimate is 0")
            continue
        drift = abs(claimed - computed) / computed
        if drift > 0.20:
            err(
                f"{ref} claimed={claimed_s} computed={fmt_k(computed)} "
                f"(drift={drift:.0%} > 20%)"
            )


def check_packs(text: str) -> None:
    if "# Context Packs" not in text:
        err("00-Context-Map.md missing # Context Packs heading")
        return
    section = text.split("# Context Packs", 1)[1]
    if "# Authority Order" in section:
        section = section.split("# Authority Order", 1)[0]
    for m in PACK_ROW.finditer(section):
        task, load, claimed_s = (x.strip() for x in m.groups())
        if task in ("Task type",) or task.startswith("-"):
            continue
        refs = BACKTICK.findall(load)
        total = 0.0
        skipped: list[str] = []
        for ref in refs:
            path = resolve_pack_md(ref)
            if path is None:
                skipped.append(ref)
                continue
            total += chars4_k(path)
        if total <= 0:
            err(f"pack `{task}`: no .md files resolved (skipped={skipped})")
            continue
        claimed = parse_claimed(claimed_s)
        drift = abs(claimed - total) / total
        approx = " approx" if skipped else ""
        if drift > 0.30:
            err(
                f"pack `{task}` claimed={claimed_s} computed={fmt_k(total)} "
                f"(drift={drift:.0%} > 30%){approx} skipped={skipped}"
            )


def main() -> int:
    if not MAP.is_file():
        err(f"missing {MAP}")
        return 1
    text = MAP.read_text(encoding="utf-8")
    check_files(text)
    check_packs(text)
    if FAIL:
        return 1
    print("OK: context-map per-file and per-pack token budgets within tolerance.")
    return 0


sys.exit(main())
PY
```

```bash
chmod +x scripts/check-context-budget.sh
```

- [ ] **Step 4: Positive + negative acceptance**

```bash
bash scripts/check-context-budget.sh; echo "exit=$?"
# expect OK, exit=0

# negative: revert one known-stale value
python3 <<'PY'
from pathlib import Path
p = Path("docs/architecture/00-Context-Map.md")
t = p.read_text()
# 04-Endpoint-Contracts should now be ~5.1k; poke it back to ~2.9k
old = "| `06-API/04-Endpoint-Contracts.md` |"
assert old in t
# replace only the tokens cell on that row
import re
t2, n = re.subn(
    r"(\| `06-API/04-Endpoint-Contracts\.md` \|[^|]*\|[^|]*\| )~[\d.]+k( \|)",
    r"\1~2.9k\2",
    t,
    count=1,
)
assert n == 1
p.write_text(t2)
PY

bash scripts/check-context-budget.sh; echo "exit=$?"
# expect FAIL naming 06-API/04-Endpoint-Contracts.md; exit=1

git checkout -- docs/architecture/00-Context-Map.md
# Re-apply Steps 1–2 edits if checkout wiped them — prefer editing before the
# negative test is committed, or stash the recalibrated map:
#   git stash push -m budget -u -- docs/architecture/00-Context-Map.md
#   ... negative on HEAD ...
#   git stash pop
```

Safer negative-test sequence (recommended):

```bash
# after Steps 1–2 are saved in the working tree but before commit:
cp docs/architecture/00-Context-Map.md /tmp/context-map-recalibrated.md
# poke stale value in working copy, run script (expect fail), then:
cp /tmp/context-map-recalibrated.md docs/architecture/00-Context-Map.md
bash scripts/check-context-budget.sh   # expect OK
```

- [ ] **Step 5: Commit**

```bash
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
git add docs/architecture/00-Context-Map.md scripts/check-context-budget.sh
git commit -m "$(cat <<'EOF'
docs: recalibrate context-map token budgets and add drift guard

EOF
)"
```

---

### Task 5: Dedup root `CLAUDE.md` / `AGENT.md` Forbidden Actions (T2)

**Files:**
- Modify: `CLAUDE.md` (Forbidden Actions section)
- Modify: `AGENT.md` (byte-identical mirror)

**Interfaces:**
- Consumes: none
- Produces: thinner always-loaded router; Task 6 extends step 5 on the same files

- [ ] **Step 1: Replace Forbidden Actions body**

Keep the `# Forbidden Actions` heading. Replace the bullet list with exactly:

```markdown
# Forbidden Actions

(These are the standalone prohibitions; the Hard Invariants above are equally binding.)

- Expose raw database tables through the API
- Generic EAV / polymorphic FK patterns for gameplay
- Force-push to main/master; commit secrets (`.env`, credentials)
```

Removed (already Hard Invariants or Context Maintenance): modify applied migrations; store derivable statistics; template FKs; DB-generated ids; regenerate architecture docs; skip documentation/context updates.

Hard Invariants section: **unchanged**.

- [ ] **Step 2: Mirror to AGENT.md and verify**

```bash
cp CLAUDE.md AGENT.md
bash scripts/check-agent-mirrors.sh
# expect OK

# prove the three standalone bullets remain and the five duplicates are gone
grep -n 'Expose raw database tables\|Generic EAV\|Force-push to main' CLAUDE.md
grep -n 'Modify applied migration files\|Store derivable statistics\|Add template foreign keys\|Use database-generated\|Regenerate architecture\|Skip documentation' CLAUDE.md
# second grep: expect no hits under Forbidden Actions (Hard Invariants may still mention the topics)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENT.md
git commit -m "$(cat <<'EOF'
docs: dedupe Forbidden Actions against Hard Invariants in root router

EOF
)"
```

---

### Task 6: Wiring — Context Maintenance step 5, CI, map note, D133

**Files:**
- Modify: `CLAUDE.md` + `AGENT.md` (step 5: five → seven scripts)
- Modify: `.github/workflows/checks.yml`
- Modify: `docs/architecture/00-Context-Map.md` (version/date + Maintenance Protocol note)
- Modify: `DECISIONS.md` (D133)

**Interfaces:**
- Consumes: Task 3 + Task 4 scripts exist and pass; Task 5 dedup already on CLAUDE/AGENT; Task 2 already recorded D134

- [ ] **Step 1: Extend Context Maintenance step 5**

In both `CLAUDE.md` and `AGENT.md`, replace step 5's script list:

From:
```markdown
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, `scripts/check-astro-class-composition.sh`, and `scripts/check-astro-conventions.sh` — all five must pass.
```

To:
```markdown
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, `scripts/check-astro-class-composition.sh`, `scripts/check-astro-conventions.sh`, `scripts/check-doc-links.sh`, and `scripts/check-context-budget.sh` — all seven must pass.
```

```bash
cp CLAUDE.md AGENT.md
bash scripts/check-agent-mirrors.sh
```

- [ ] **Step 2: Add CI steps**

In `.github/workflows/checks.yml`, under the `structure` job, after the Astro conventions step, append:

```yaml
      - name: Doc-links gate
        run: bash scripts/check-doc-links.sh
      - name: Context-budget gate
        run: bash scripts/check-context-budget.sh
```

Match existing indentation (two spaces for `steps` children, six spaces for `run`).

- [ ] **Step 3: Context Map version + Maintenance Protocol**

In `docs/architecture/00-Context-Map.md`:

1. Bump the header version line from `1.6.10 (2026-07-22 — ...)` to:

```markdown
> **Version:** 1.6.11 (2026-07-23 — context-integrity guards D133: `check-doc-links.sh` + `check-context-budget.sh`; prior 1.6.10 mid-task fallow/`npm run check` gate)
```

2. Replace the Maintenance Protocol paragraph so it names the new guards (keep the CLAUDE.md pointer):

```markdown
# Maintenance Protocol

This map is kept correct by the mandatory Context Maintenance rules in the root `CLAUDE.md`: every new, moved, renamed, or deleted doc must be registered here in the same change; `scripts/check-context-map.sh` must pass; and the context-integrity guards `scripts/check-doc-links.sh` (canonical doc links + path-like refs) and `scripts/check-context-budget.sh` (per-file / per-pack `~tokens` drift) must pass before any task is claimed done. (2026-07-23)
```

3. Recompute and update this file's own inventory `~Tokens` after the edit (chars/4), then re-run `bash scripts/check-context-budget.sh`.

- [ ] **Step 4: Add D133 to `DECISIONS.md`**

In section `## Context & documentation system`, append this row immediately after D134 (added in Task 2) — or after D107 if D134 is adjacent; keep chronological/numeric order with D133 then D134 already present:

```markdown
| D133 | 2026-07-23 | Context-integrity guards mechanized: `scripts/check-doc-links.sh` validates every markdown link + path-like backtick reference across the canonical doc set (alias/base-aware, bare-identifier-skipping, `DECISIONS.md` history-refs and `docs/superpowers/` excluded), and `scripts/check-context-budget.sh` fails when the Context Map's per-file `~tokens` (strict) or per-pack `~Budget` (best-effort sum) drift >20%/>30% from a chars/4 estimate. Both added to Context-Maintenance step 5 and `checks.yml`. Same audit corrected two stale references (Alpine-Patterns `Timer`→`SegmentTimer`, Shared-Conventions barrel examples) and de-duplicated the always-loaded root `CLAUDE.md` (Forbidden Actions no longer restates Hard Invariants) | Linking staleness and budget drift both slipped past every existing check — mechanize them per the D105/D110/D127 precedent, and stop the always-loaded router paying for redundancy |
```

If Task 2 already set `updated: 2026-07-23`, leave it. Prefer table order **D133 then D134** (insert D133 above D134 if Task 2 appended D134 first).
- [ ] **Step 5: Full Context-Maintenance gate (all seven)**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
# all seven must print OK / exit 0
```

- [ ] **Step 6: App smoke (required once — docs-only; must stay green)**

Spec §6: no app code changes, so confirm the suite is unaffected:

```bash
cd app
npm test
npx astro check
cd ..
```

Expected: tests pass (same count order of magnitude as current main); `astro check` reports 0 errors. If either fails, the failure is **not** in scope for this plan's doc edits — stop and escalate (do not “fix” app code under this plan).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md AGENT.md \
        .github/workflows/checks.yml \
        docs/architecture/00-Context-Map.md \
        DECISIONS.md
git commit -m "$(cat <<'EOF'
chore: wire doc-link and budget guards into Context Maintenance + CI

EOF
)"
```

---

## Self-Review (plan author)

**1. Spec coverage**

| Spec item | Task |
| --------- | ---- |
| §1 L1 Alpine-Patterns Timer→SegmentTimer | Task 1 |
| §1 L2 Shared-Conventions barrels | Task 1 |
| L3 `events/batch.ts` abbreviated path (plan-validation acceptance blocker; not in original spec §1) | Task 1 |
| Retire `099` + retarget Context Map / `docs/CLAUDE.md` / README / PR template → `03` (plan extension; D134) | Task 2 |
| §2 `check-doc-links.sh` + positive/negative | Task 3 |
| §3 budget recalibration | Task 4 |
| §3 `check-context-budget.sh` + positive/negative | Task 4 |
| §4 Forbidden Actions dedup + AGENT mirror | Task 5 |
| §5 step 5 five→seven, CI, map note, D133 | Task 6 |
| §6 `npm test` + `astro check` once still green | Task 6 Step 6 |
| Out-of-scope (app code, DECISIONS split, tokenizer, historical superpowers rewrites) | not tasked |

**2. Placeholder scan:** none — scripts, replacement prose, budget tables, and commands are concrete.

**3. Type consistency:** script names, alias map, tolerances (20%/30%), and D133 text match the spec verbatim; D134 is plan-authored for the `099` retirement.

**4. Plan-validation follow-ups (2026-07-23):** L3 named + required app smoke restored; `099` retirement added (Task 2); DECISIONS scan ambiguity left as Canonical-scope-only.
---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-23-context-layer-hardening.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
