# Context Diet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the per-session agent context floor from ~39.3k to ~3.0k tokens by splitting `00-Context-Map.md` into router/inventory/history, inverting `AGENT.md` into pointer stubs, pruning dead skills, and deleting non-binding tool prose — with zero information loss.

**Architecture:** Relocation and deletion only. Content moves between markdown files; four existing gate scripts are re-pointed at the new shape. One new descriptive doc (component inventory) is added. No new gate script is created, so `.github/workflows/quality.yml` and `.husky/pre-commit` need **no** edits — verify this rather than assuming it.

**Tech Stack:** Markdown, Bash, Python 3 (embedded in the gate scripts), git.

**Spec:** `docs/superpowers/specs/2026-08-19-context-diet-design.md`

## Global Constraints

- Branch: `claude/context-diet`. Never merge to `main` directly; never force-push.
- Minimal diffs. Validate and fix docs with targeted edits — never regenerate them.
- Decisions are append-only: never edit or delete an existing block in `decisions/**`.
- Every newly added or changed docs row entry carries an ISO date (`YYYY-MM-DD`). Today is `2026-08-19`.
- No `app/` source file changes in this plan, so `npm run validate:app` is never required.
- `.husky/pre-commit` runs 11 structural gates on every commit under `set -e`. A commit that leaves `check-agent-mirrors.sh` red cannot land — Task 3 must therefore change stubs and script in **one** commit.
- Canonical docs under `docs/architecture/` require `<!-- ... status: ... -->` front-matter (`scripts/check-context-map.sh` check 3) and registration (check 4).
- The graph rule in root `CLAUDE.md` ("Consult before broad grep: `graphify query`") is knowingly left standing — it belongs to Spec 3. Do not touch it.

---

## File Structure

**Created:**
- `docs/architecture/07-Frontend/08-Component-Inventory.md` — one row per shared component; makes `app/CLAUDE.md`'s reuse mandate followable.
- `docs/architecture/00-File-Inventory.md` — the canonical File Inventory rows; loaded only on pack escalation.
- `docs/architecture/00-Context-Map-History.md` — version history, `docs/superpowers/**` rows, Implementation State; `status: historical`, never loaded by a task.

**Modified:**
- `docs/architecture/00-Context-Map.md` — reduced to router: packs, authority order, non-canonical note, maintenance protocol, three pointers.
- `scripts/check-context-map.sh` — check 4 re-pointed at the inventory file.
- `scripts/check-context-budget.sh` — packs from map, file rows from inventory.
- `scripts/check-doc-links.sh` — `status: historical` skip for the path-backtick pass.
- `scripts/check-agent-mirrors.sh` — assertion inverted to stub-form.
- 6× `AGENT.md` — reduced to pointer stubs.
- 6× `CLAUDE.md` — `Tool Allowances & Restrictions` sections removed; root also gets the Context Loading Protocol rewrite.
- `.claude/skills/context-maintenance/SKILL.md` — steps 1 and 2 rewritten, new component-inventory step.
- `.claude/skills/writing-plans/SKILL.md` — dangling `using-git-worktrees` reference.
- `.claude/skills/using-superpowers/SKILL.md` — announcement-style conflict.
- `decisions/context-system.md` — one appended `D213` block.
- Pointer updates: `docs/CLAUDE.md`, `database/CLAUDE.md`, `app/CLAUDE.md`, `docs/architecture/README.md`, `docs/game-rules/README.md`, `DECISIONS.md`, `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`.

**Deleted:**
- `.claude/skills/{emil-design-eng,apple-design,animation-vocabulary,improve-animations,review-animations,using-git-worktrees}/`
- `.claude/skills/using-superpowers/references/{antigravity,codex,pi}-tools.md`

---

### Task 1: Component inventory

Must land first — Task 2's audited pack table cites this file.

**Files:**
- Create: `docs/architecture/07-Frontend/08-Component-Inventory.md`
- Modify: `docs/architecture/00-Context-Map.md` (register the new file in the still-inline File Inventory)

**Interfaces:**
- Consumes: nothing.
- Produces: the path `07-Frontend/08-Component-Inventory.md`, cited by Task 2's `Issue-driven UI polish` and `New game (full stack)` packs and by Task 5's `context-maintenance` step.

- [ ] **Step 1: Verify the gap the file closes**

```bash
cd /home/user/dart-analytics
for c in SinglePlayerDisplay StatRow VisitPreview InputButton SetupShell \
         SettingSectionShell SettingRow PlayerSettingsCard CardWrapper InfoSection; do
  printf '%-24s %s\n' "$c" "$(grep -rl "$c" docs/architecture/07-Frontend/ 2>/dev/null | wc -l)"
done
```

Expected: every component prints `0` — ten shared components documented nowhere.

- [ ] **Step 2: Create the inventory file**

```bash
cat > docs/architecture/07-Frontend/08-Component-Inventory.md <<'DOC'
<!--
status: canonical
scope: shared Astro component inventory
read-when: before writing markup for any recurring UI shape
updated: 2026-08-19
-->

# Component Inventory

Every shared, reusable `.astro` component, one row each. `app/CLAUDE.md`
requires checking this list before hand-rolling markup for a recurring UI
shape; if nothing here fits, propose a new component rather than writing
inline markup.

Out of scope: per-game components (`interfaces/`, `result-modals/`,
`setup/*SetupForm.astro`), which are one-per-ruleset by design and are not
reusable.

Alpine-bound props take **expression strings**, not values — the component
renders them into `x-text` / `x-model` / `@click` and the expression is
evaluated in the page's own Alpine scope.

## `components/ui/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `Badge.astro` | Small inline status pill | `variant` (`accent`/`error`/`neutral`) |
| `BoardMagnifier.astro` | Zoomed board detail follows the pointer during visual capture | `zoom` |
| `CardWrapper.astro` | Bordered card, optionally a link | `href`, `title`, `description`, `color`, `external` |
| `ConfirmDialog.astro` | Modal with cancel/confirm actions | `title`, `titleId`, `description`, `onCancel`, `onConfirm`, `confirmVariant`, `loadingExpr`, `dismissible` |
| `DartBoard.astro` | Dartboard SVG plus an overlay slot for markers | `boardRef` |
| `InfoSection.astro` | Titled explanatory block | `title`, `description`, `id` |
| `IsLoading.astro` | Loading skeleton / spinner panel | `title` |
| `Link.astro` | Anchor styled as text link or button | `href`, `variant` (`inline`/`primary`/`secondary`/`ghost`), `external`, `icon`, `ariaLabel` |
| `LogoutButton.astro` | Sign-out action wired to the auth flow | none |
| `Modal.astro` | Base dialog shell; `ConfirmDialog` builds on it | `titleId`, `descriptionId`, `dismissible`, `onDismiss` |

## `components/forms/`

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `AppModeForm.astro` | Analytics/recreational app-mode radio picker | none (reads the settings store) |
| `Button.astro` | **The** standalone action element — never hand-roll a `<button>` | `type`, `variant` (`primary`/`secondary`/`ghost`/`error`), `icon`, `disabled`, `ariaLabel`, `loadingExpr` |
| `HandednessForm.astro` | Left/right-handed radio picker | none (reads the settings store) |
| `Input.astro` | Styled text/number/email input | `id`, `type`, `name`, `value`, `placeholder`, `error`, `required`, `disabled` |
| `PlayerSettingsCard.astro` | Bordered card grouping the player-settings rows | none |
| `SettingRow.astro` | Label plus inline-editable value with a save action | `id`, `label`, `valueExpr`, `modelExpr`, `saveExpr`, `emptyText`, `numeric`, `inputmode`, `required`, `disabledExpr` |

## `components/layout/games/` (shared across rulesets)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `BoardInputPanel.astro` | Visual-board capture surface plus undo/bounce-out row; shown instead of the keypad for `ANALYTICS` + `VISUAL_BOARD` | none (reads `boardInputData()` from the page scope) |
| `ContinueSessionModal.astro` | Resume-or-discard prompt for an unfinished session | `gameTitle` |
| `DoubleCheckoutConfirm.astro` | Double-out confirmation gate | none |
| `DoublesPathRecreationalInput.astro` | Doubles-path tap input row | none |
| `ExitModal.astro` | Leave-session confirmation | none |
| `GameCard.astro` | Games-index entry | `href`, `title`, `caption` |
| `InputButton.astro` | Single key in a tap/keypad input row | `type` |
| `NoSessionPanel.astro` | Empty state when no session is active | `href` |
| `ReconciliationBlocked.astro` | Blocked-upload explanation panel | none |
| `ScoreInput.astro` | Numeric keypad with submit/delete/undo | `value`, `digitHandler`, `onDelete`, `onSubmit`, `submitDisabled`, `padDisabled`, `undoClick`, `undoDisabled` |
| `SinglePlayerDisplay.astro` | Large score-or-target panel with a `progress` slot | `score`, `target`, `isTarget` |
| `SinglesRecreationalInput.astro` | Target-aware S/D/T or Bull tap row | none |
| `StatRow.astro` | Label/value row inside a progress or results list | `label`, `value` |
| `VisitPreview.astro` | Three-dart preview strip for the open visit | none |

## `components/layout/games/setup/` (shared shells)

| Component | Purpose | Key props |
| --------- | ------- | --------- |
| `SettingSectionShell.astro` | Bordered section wrapper inside a setup form | none |
| `SetupShell.astro` | Page shell for every game setup screen | `title` |
| `Toggle.astro` | Segmented option control bound via `x-modelable` | `options`, `orientation` (`horizontal`/`vertical`), `initial`, `hint` |
| `ToggleListItem.astro` | One option inside a vertical `Toggle` | `value`, `label` |
| `UserIconDisplay.astro` | Avatar/initial badge | `name`, `nameExpr` |
| `UserSection.astro` | Player row on the setup screen | none |
DOC
```

- [ ] **Step 3: Register it in the map's File Inventory**

Open `docs/architecture/00-Context-Map.md`, find the `## API (`06-API/`) and Frontend (`07-Frontend/`)` table, and append this row after the `07-Frontend/07-Style-Guide.md` row (compute `~Tokens` with the command in Step 4):

```markdown
| `07-Frontend/08-Component-Inventory.md` | Every shared `.astro` component, its purpose and key props; check before hand-rolling markup (2026-08-19) | canonical | ~1.2k |
```

- [ ] **Step 4: Verify the claimed token count**

```bash
python3 -c "print(round(len(open('docs/architecture/07-Frontend/08-Component-Inventory.md').read())/4000,1))"
```

Expected: a number within 20% of the `~Tokens` value written in Step 3. If it differs by more, edit the row to match — `scripts/check-context-budget.sh` enforces a 20% per-file tolerance and will fail otherwise.

- [ ] **Step 5: Run the doc gates**

```bash
bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh
```

Expected: three `OK:` lines. A `FAIL: ... is not registered` means Step 3 was missed; a drift failure means Step 4's number is wrong.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/07-Frontend/08-Component-Inventory.md docs/architecture/00-Context-Map.md
git commit -m "docs(context): add shared component inventory"
```

---

### Task 2: Split the map, audit the packs, re-point three gate scripts

The split and the script changes must be one commit — the scripts parse the map's current shape and any intermediate state is red.

**Files:**
- Create: `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`
- Modify: `docs/architecture/00-Context-Map.md`, `scripts/check-context-map.sh:76-79`, `scripts/check-context-budget.sh:17-18,87-92,150-156`, `scripts/check-doc-links.sh:159-184`, `CLAUDE.md`, `docs/CLAUDE.md`, `database/CLAUDE.md`, `app/CLAUDE.md`, `docs/architecture/README.md`, `docs/game-rules/README.md`, `DECISIONS.md`, `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`

**Interfaces:**
- Consumes: `07-Frontend/08-Component-Inventory.md` from Task 1.
- Produces: `docs/architecture/00-File-Inventory.md` (the registration target `check-context-map.sh` check 4 now greps, and the file-row source `check-context-budget.sh` now reads) and `docs/architecture/00-Context-Map-History.md` (where `context-maintenance` appends from Task 5 onward).

- [ ] **Step 1: Record the before-state**

```bash
python3 -c "
t=open('docs/architecture/00-Context-Map.md').read()
print('map chars', len(t), '~tok', round(len(t)/4000,1))
print('line9 chars', len(t.split(chr(10))[8]))
"
```

Expected: `map chars 150261 ~tok 37.6` and `line9 chars 74965`. If these differ, the map changed since the spec was measured — re-derive the section boundaries before continuing.

- [ ] **Step 2: Split the file mechanically**

The map is 150k chars; splitting by hand loses content. Run this splitter, which cuts on the existing headings and moves text verbatim:

```bash
python3 - <<'PY'
from pathlib import Path

src = Path("docs/architecture/00-Context-Map.md")
text = src.read_text(encoding="utf-8")
lines = text.split("\n")

version_history = lines[8]
assert version_history.startswith("> **Version:**"), "line 9 is not the version blob"

def cut(start, end=None):
    i = text.index(start)
    j = text.index(end) if end else len(text)
    return text[i:j], i, j

inventory_all, inv_i, inv_j = cut("# File Inventory", "# Non-Canonical Source Material")
ctx_hist, _, _ = cut("## Context & history", "# Non-Canonical Source Material")
impl, _, _ = cut("# Current Implementation State", "# Maintenance Protocol")
packs, _, _ = cut("# Context Packs", "# Authority Order")
authority, _, _ = cut("# Authority Order", "# File Inventory")
noncanon, _, _ = cut("# Non-Canonical Source Material", "# Current Implementation State")
maint, _, _ = cut("# Maintenance Protocol")

# Canonical inventory = File Inventory minus the Context & history section,
# which is split again by hand in Step 3 (canonical rows stay, superpowers
# rows go to the archive).
inventory_canonical = inventory_all.replace(ctx_hist, "")

Path("docs/architecture/00-File-Inventory.md").write_text(
    "<!--\n"
    "status: canonical\n"
    "scope: canonical file inventory — what each document answers\n"
    "read-when: a context pack demonstrably lacks the answer\n"
    "updated: 2026-08-19\n"
    "-->\n\n"
    "> Escalation target for `00-Context-Map.md`. Packs come first; open this\n"
    "> only when the pack lacks the answer. History lives in\n"
    "> `00-Context-Map-History.md`.\n\n"
    "---\n\n"
    + inventory_canonical.rstrip() + "\n\n"
    "---\n\n"
    + ctx_hist.rstrip() + "\n",
    encoding="utf-8",
)

Path("docs/architecture/00-Context-Map-History.md").write_text(
    "<!--\n"
    "status: historical\n"
    "scope: context-map version history and point-in-time task records\n"
    "read-when: never during a task — provenance only\n"
    "updated: 2026-08-19\n"
    "-->\n\n"
    "# Context Map History\n\n"
    "> Append-only. `context-maintenance` writes its version entry here, not\n"
    "> into `00-Context-Map.md`. Nothing in this file is authority; path\n"
    "> references may name files since renamed or deleted, which is why\n"
    "> `scripts/check-doc-links.sh` skips the path-backtick pass for\n"
    "> `status: historical` documents.\n\n"
    "---\n\n"
    "# Version History\n\n"
    + version_history + "\n\n"
    "---\n\n"
    + impl.rstrip() + "\n",
    encoding="utf-8",
)

src.write_text(
    "<!--\n"
    "status: canonical\n"
    "scope: repository-wide context routing\n"
    "read-when: start of every task (via root CLAUDE.md protocol)\n"
    "updated: 2026-08-19\n"
    "-->\n"
    "# Context Map\n\n"
    "> The router: which files a task loads, and which document wins when two\n"
    "> disagree. Kept small on purpose — it is read at the start of every task.\n"
    ">\n"
    "> - Pack lacks the answer? Escalate to `00-File-Inventory.md`.\n"
    "> - Why was something decided? `DECISIONS.md` routes to `decisions/**`.\n"
    "> - Provenance and version history? `00-Context-Map-History.md` (never\n"
    ">   loaded by a task).\n\n"
    "---\n\n"
    + packs.rstrip() + "\n\n"
    "---\n\n"
    + authority.rstrip() + "\n\n"
    "---\n\n"
    + noncanon.rstrip() + "\n\n"
    "---\n\n"
    + maint.rstrip() + "\n",
    encoding="utf-8",
)

for name in ["00-Context-Map.md", "00-File-Inventory.md", "00-Context-Map-History.md"]:
    n = len((Path("docs/architecture") / name).read_text(encoding="utf-8"))
    print(f"{name:30s} {n:7d} ch  ~{n/4000:.1f}k")
PY
```

Expected roughly: map `~2k`, file inventory `~16k` (it still holds the superpowers rows at this point), history `~21k`.

- [ ] **Step 3: Move the `docs/superpowers/**` rows to the archive**

`00-File-Inventory.md` now ends with the whole `## Context & history` section. Its rows split two ways:

- **Stay** in `00-File-Inventory.md`: `README.md`, `.github/pull_request_template.md`, `docs/CLAUDE.md`, `app/CLAUDE.md`, `app/DEPLOYMENT.md`, `AGENT.md`, the four `.claude/skills/**` rows, `.github/workflows/graph.yml`, `scripts/graph-delta.py`, `graphify-out/graph.json`, and the `docs/superpowers/{specs,plans,handoffs}/` *directory* row.
- **Move** to `00-Context-Map-History.md` (append under a new `# Task Records` heading at the end): every row whose first cell is a specific `docs/superpowers/specs/...` or `docs/superpowers/plans/...` or `docs/superpowers/handoffs/...` file — all ~60 of them.

Cut and paste; do not retype. Verify the count:

```bash
grep -c '^| `docs/superpowers/[sph]' docs/architecture/00-Context-Map-History.md
grep -c '^| `docs/superpowers/[sph]' docs/architecture/00-File-Inventory.md
```

Expected: a count around `60` in the history file and `0` in the inventory.

- [ ] **Step 4: Audit the pack table**

In `00-Context-Map.md`, for every existing pack row confirm each backticked `.md` path resolves, then recompute the `~Budget` as the sum of `chars/4` over the row's `.md` entries:

```bash
python3 - <<'PY'
import re
from pathlib import Path
ARCH = Path("docs/architecture"); ROOT = Path(".")
text = Path("docs/architecture/00-Context-Map.md").read_text(encoding="utf-8")
section = text.split("# Context Packs",1)[1].split("# Authority Order",1)[0]
for row in section.splitlines():
    if not row.startswith("| ") or row.startswith("| ---") or row.startswith("| Task type"):
        continue
    cells = [c.strip() for c in row.strip("|").split("|")]
    total, missing = 0.0, []
    for ref in re.findall(r"`([^`]+)`", cells[1]):
        if not ref.endswith(".md"):
            continue
        for base in (ARCH, ARCH/"05-Database", ROOT, ROOT/"docs", ROOT/"app"):
            p = base/ref
            if p.is_file():
                total += len(p.read_text(encoding="utf-8"))/4000
                break
        else:
            missing.append(ref)
    print(f"{cells[0][:42]:44s} claimed={cells[2]:8s} computed=~{total:.1f}k missing={missing}")
PY
```

Correct any `~Budget` cell whose computed value differs by more than 30% (the gate's per-pack tolerance), and fix any path in `missing=[...]`.

- [ ] **Step 5: Add the two missing packs**

Append these rows to the pack table, substituting the `computed=` values Step 4 prints for them after they are added:

```markdown
| Issue-driven UI polish | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/07-Style-Guide.md`, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md` | ~Xk |
| New game (full stack) | `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md`; plus the per-game fan-out: engine + validator (one commit), seed, `lib/game/<game>-setup.data.ts` / `-play.data.ts`, `components/layout/games/{interfaces,result-modals,setup}/`, `pages/games/<game>/{setup,play}/index.astro`, `lib/client/alpine/register-route-data.ts` | ~Xk |
```

Re-run Step 4's command and replace each `~Xk` with the computed value.

- [ ] **Step 6: Fix the self-referential row**

In `00-File-Inventory.md`, the Foundation table row for `00-Context-Map.md` claims `~31k`. Replace it with the post-split value, and add rows for the two new files:

```markdown
| `00-Context-Map.md` | This file's router — context packs, authority order, maintenance protocol (2026-08-19) | canonical | ~2k |
| `00-File-Inventory.md` | This file — what each canonical document answers; escalation target when a pack falls short (2026-08-19) | canonical | ~8k |
| `00-Context-Map-History.md` | Context-map version history and point-in-time task records; provenance only, never loaded by a task (2026-08-19) | historical | ~21k |
```

Verify each against `python3 -c "print(round(len(open('<path>').read())/4000,1))"` and correct to within 20%.

- [ ] **Step 7: Re-point `check-context-map.sh` check 4**

Replace lines 76–79:

```bash
# --- 4. Map registration ----------------------------------------------------
for f in $(git ls-files 'docs/architecture/*.md' | grep -v -e 'CLAUDE.md' -e 'AGENT.md'); do
  base=$(basename "$f")
  grep -q "$base" "$MAP" || err "$f is not registered in $MAP"
done
```

with:

```bash
# --- 4. Inventory registration ----------------------------------------------
# Registration moved out of the map when it was split into router / inventory /
# history (D213): the router is deliberately small and no longer lists files.
for f in $(git ls-files 'docs/architecture/*.md' | grep -v -e 'CLAUDE.md' -e 'AGENT.md'); do
  base=$(basename "$f")
  grep -q "$base" "$INVENTORY" || err "$f is not registered in $INVENTORY"
done
```

and add the `INVENTORY` definition immediately after the existing `MAP=` line (line 33):

```bash
INVENTORY="docs/architecture/00-File-Inventory.md"
```

- [ ] **Step 8: Split `check-context-budget.sh`'s two readers**

After line 17's `MAP = Path(...)`, add:

```python
INVENTORY = Path("docs/architecture/00-File-Inventory.md")
```

In `check_files`, replace the guard and split (lines 88–92):

```python
    if "# File Inventory" not in text:
        err("00-Context-Map.md missing # File Inventory heading")
        return
    inv = text.split("# File Inventory", 1)[1]
```

with:

```python
    if "# File Inventory" not in text:
        err("00-File-Inventory.md missing # File Inventory heading")
        return
    inv = text.split("# File Inventory", 1)[1]
```

In `main`, replace lines 150–156's body:

```python
def main() -> int:
    if not MAP.is_file():
        err(f"missing {MAP}")
        return 1
    text = MAP.read_text(encoding="utf-8")
    check_files(text)
    check_packs(text)
```

with:

```python
def main() -> int:
    if not MAP.is_file():
        err(f"missing {MAP}")
        return 1
    if not INVENTORY.is_file():
        err(f"missing {INVENTORY}")
        return 1
    check_files(INVENTORY.read_text(encoding="utf-8"))
    check_packs(MAP.read_text(encoding="utf-8"))
```

- [ ] **Step 9: Teach `check-doc-links.sh` to skip historical path refs**

In `check_file` (line 159), after `is_decision` is computed (line 164), add:

```python
    is_historical = bool(re.search(r"^status:\s*historical", text, re.MULTILINE))
```

and change the early return at line 176 from:

```python
    if is_decision:
        return
```

to:

```python
    # A record of history is not required to track current file layout — the
    # same carve-out decisions/** already has, for the same reason (D213).
    if is_decision or is_historical:
        return
```

`re` is already imported at line 33 of the embedded Python — no new import is needed.

- [ ] **Step 10: Update the Context Loading Protocol and the pointers**

In root `CLAUDE.md`, replace the `# Context Loading Protocol` body with:

```markdown
1. Open `docs/architecture/00-Context-Map.md` — the router.
2. Find your task type in its Context Packs table and load exactly those files.
3. Do not preload anything else. Escalate to `docs/architecture/00-File-Inventory.md` only when the pack demonstrably lacks the answer.

The authority order for conflicts is defined once, in the context map. Docs win over code.
```

In the same file's `# Where Everything Lives` table, replace the first row and add one:

```markdown
| Context packs, authority order | `docs/architecture/00-Context-Map.md` |
| File inventory (escalation only) | `docs/architecture/00-File-Inventory.md` |
```

Then update every remaining reference that names the map as the *inventory* home — grep for them and fix each in place:

```bash
grep -rn "context-map inventory\|00-Context-Map.md" --include="*.md" \
  CLAUDE.md app/CLAUDE.md docs/CLAUDE.md database/CLAUDE.md DECISIONS.md \
  docs/architecture/README.md docs/game-rules/README.md \
  docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md
```

References that mean "packs / authority order" stay pointing at the map; references that mean "the list of files" (notably `docs/CLAUDE.md`'s Editing Workflow step 1, "use the context-map inventory") change to `00-File-Inventory.md`. `docs/superpowers/**` is excluded from every gate — leave it alone.

- [ ] **Step 11: Run the doc gates**

```bash
bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh
```

Expected: three `OK:` lines. A `FAIL: ... not registered in docs/architecture/00-File-Inventory.md` means Step 6 missed a row.

- [ ] **Step 12: Verify the router is actually small**

```bash
python3 -c "print(round(len(open('docs/architecture/00-Context-Map.md').read())/4000,1),'k tok')"
```

Expected: `≤ 2.0 k tok`. If larger, content that belongs in the inventory or the history file is still inline.

- [ ] **Step 13: Commit**

```bash
git add docs/architecture/00-Context-Map.md docs/architecture/00-File-Inventory.md \
        docs/architecture/00-Context-Map-History.md scripts/check-context-map.sh \
        scripts/check-context-budget.sh scripts/check-doc-links.sh CLAUDE.md AGENT.md \
        app/CLAUDE.md app/AGENT.md docs/CLAUDE.md docs/AGENT.md database/CLAUDE.md \
        database/AGENT.md DECISIONS.md docs/architecture/README.md \
        docs/game-rules/README.md docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md
git commit -m "docs(context): split context map into router, inventory and history"
```

`AGENT.md` mirrors are staged because `check-agent-mirrors.sh` still demands byte-identity at this point — apply the same `CLAUDE.md` edits to each mirror before committing. Task 3 removes that obligation.

---

### Task 3: Invert `AGENT.md` into pointer stubs

Stubs and script must be one commit: `.husky/pre-commit` runs `check-agent-mirrors.sh` under `set -e`.

**Files:**
- Modify: `AGENT.md`, `app/AGENT.md`, `app/src/db/AGENT.md`, `app/src/pages/api/AGENT.md`, `database/AGENT.md`, `docs/AGENT.md`, `scripts/check-agent-mirrors.sh`, `.claude/skills/context-maintenance/SKILL.md`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the stub text that `check-agent-mirrors.sh` asserts, reproduced byte-for-byte in the script's heredoc.

- [ ] **Step 1: Write the stubs**

```bash
cd /home/user/dart-analytics
for d in . app app/src/db app/src/pages/api database docs; do
  cat > "$d/AGENT.md" <<'STUB'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
STUB
done
wc -l AGENT.md app/AGENT.md app/src/db/AGENT.md app/src/pages/api/AGENT.md database/AGENT.md docs/AGENT.md
```

Expected: `4` lines each, `24 total`.

- [ ] **Step 2: Confirm the old gate now fails**

```bash
bash scripts/check-agent-mirrors.sh; echo "exit=$?"
```

Expected: six `FAIL: ... have diverged` lines and `exit=1`. This is the red state the inverted script must turn green.

- [ ] **Step 3: Invert the script**

Replace the whole of `scripts/check-agent-mirrors.sh` with:

```bash
#!/usr/bin/env bash
# AGENT.md stub checker — every CLAUDE.md must have an AGENT.md sibling whose
# only content is the pointer stub below. AGENT.md is not a rule source; it
# redirects to the sibling CLAUDE.md, which is the single authority (D213).
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

STUB=$(cat <<'EOF'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
EOF
)

FAIL=0
for claude in $(git ls-files '*CLAUDE.md'); do
  dir=$(dirname "$claude")
  agent="$dir/AGENT.md"
  if [ ! -f "$agent" ]; then
    echo "FAIL: $claude has no AGENT.md sibling" >&2
    FAIL=1
    continue
  fi
  if [ "$(cat "$agent")" != "$STUB" ]; then
    echo "FAIL: $agent is not the pointer stub — AGENT.md must not carry rules" >&2
    FAIL=1
  fi
done

[ $FAIL -eq 0 ] && echo "OK: every AGENT.md is the pointer stub redirecting to its CLAUDE.md."
exit $FAIL
```

- [ ] **Step 4: Confirm the inverted gate passes**

```bash
bash scripts/check-agent-mirrors.sh; echo "exit=$?"
```

Expected: `OK: every AGENT.md is the pointer stub redirecting to its CLAUDE.md.` and `exit=0`.

- [ ] **Step 5: Prove the gate still bites**

```bash
echo "- a smuggled rule" >> docs/AGENT.md
bash scripts/check-agent-mirrors.sh; echo "exit=$?"
git checkout -- docs/AGENT.md
```

Expected: `FAIL: docs/AGENT.md is not the pointer stub` and `exit=1`, then a clean restore. A gate that cannot fail is not a gate.

- [ ] **Step 6: Update `context-maintenance` step 1**

In `.claude/skills/context-maintenance/SKILL.md`, replace step 1 with:

```markdown
1. **CLAUDE.md sync.** Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it. `AGENT.md` files are pointer stubs, not mirrors — never copy rules into them; `scripts/check-agent-mirrors.sh` rejects any `AGENT.md` that carries content.
```

- [ ] **Step 7: Run the gates and commit**

```bash
bash scripts/check-agent-mirrors.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-map.sh
git add AGENT.md app/AGENT.md app/src/db/AGENT.md app/src/pages/api/AGENT.md \
        database/AGENT.md docs/AGENT.md scripts/check-agent-mirrors.sh \
        .claude/skills/context-maintenance/SKILL.md
git commit -m "docs(context): AGENT.md becomes a pointer stub, mirror gate inverted"
```

The pre-commit hook re-runs `check-agent-mirrors.sh`; the commit failing means Step 1's stub and Step 3's heredoc differ byte-for-byte.

---

### Task 4: Prune the skill layer

**Files:**
- Delete: `.claude/skills/{emil-design-eng,apple-design,animation-vocabulary,improve-animations,review-animations,using-git-worktrees}/`, `.claude/skills/using-superpowers/references/{antigravity,codex,pi}-tools.md`
- Modify: `.claude/skills/writing-plans/SKILL.md:16`, `.claude/skills/using-superpowers/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed later.

- [ ] **Step 1: Confirm the five design skills are unreferenced**

```bash
cd /home/user/dart-analytics
grep -rn "emil-design-eng\|apple-design\|animation-vocabulary\|improve-animations\|review-animations" \
  --include="*.md" . \
  | grep -v '^\./\.claude/skills/\(emil-design-eng\|apple-design\|animation-vocabulary\|improve-animations\|review-animations\)/'
echo "exit=$?"
```

Expected: no output, `exit=1` (grep found nothing). Any hit must be resolved before deleting.

- [ ] **Step 2: Find the worktree references**

```bash
grep -rn "using-git-worktrees" --include="*.md" . | grep -v '^\./\.claude/skills/using-git-worktrees/'
```

Expected: exactly one hit — `.claude/skills/writing-plans/SKILL.md:16`.

- [ ] **Step 3: Delete**

```bash
git rm -r -q .claude/skills/emil-design-eng .claude/skills/apple-design \
             .claude/skills/animation-vocabulary .claude/skills/improve-animations \
             .claude/skills/review-animations .claude/skills/using-git-worktrees
git rm -q .claude/skills/using-superpowers/references/antigravity-tools.md \
          .claude/skills/using-superpowers/references/codex-tools.md \
          .claude/skills/using-superpowers/references/pi-tools.md
```

- [ ] **Step 4: Fix the dangling reference in `writing-plans`**

Replace line 16 of `.claude/skills/writing-plans/SKILL.md`:

```markdown
**Context:** If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.
```

with:

```markdown
**Context:** This repo does not use git worktrees. Task branches are checked out directly in the main working copy (`git checkout -b <branch>`) — see the root `CLAUDE.md` hard invariants.
```

- [ ] **Step 5: Resolve the announcement conflict in `using-superpowers`**

In `.claude/skills/using-superpowers/SKILL.md`, find the line reading:

```markdown
Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.
```

and replace it with:

```markdown
Then follow the skill exactly. If it has a checklist, create a todo per item. Announcement style is owned by the root `CLAUDE.md` Output Acknowledgment section — in this repo that means "On it." and immediate execution, never a "Using [skill] to [purpose]" preamble.
```

- [ ] **Step 6: Verify nothing dangles**

```bash
grep -rn "using-git-worktrees\|emil-design-eng\|apple-design\|animation-vocabulary\|improve-animations\|review-animations\|antigravity-tools\|codex-tools\|pi-tools" \
  --include="*.md" . | grep -v '^\./docs/superpowers/'
echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 7: Measure and commit**

```bash
git diff --cached --stat | tail -1
bash scripts/check-doc-links.sh && bash scripts/check-context-map.sh
git add .claude/skills/writing-plans/SKILL.md .claude/skills/using-superpowers/SKILL.md
git commit -m "chore(skills): drop unreferenced and contradictory skills"
```

Expected: the stat line shows roughly `2,200` deletions.

---

### Task 5: Delete the tool-allowance prose

**Files:**
- Modify: `CLAUDE.md`, `app/CLAUDE.md`, `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`, `database/CLAUDE.md`, `docs/CLAUDE.md`, `.claude/skills/context-maintenance/SKILL.md`

**Interfaces:**
- Consumes: Task 3's stub `AGENT.md` files — because `AGENT.md` is no longer a mirror, these edits touch `CLAUDE.md` only.
- Produces: nothing consumed later.

- [ ] **Step 1: Confirm the sections are uniform**

```bash
cd /home/user/dart-analytics
for f in CLAUDE.md app/CLAUDE.md database/CLAUDE.md docs/CLAUDE.md \
         app/src/db/CLAUDE.md app/src/pages/api/CLAUDE.md; do
  printf '%-32s %s\n' "$f" "$(awk '/^#+ *Tool Allowances/{f=1} f{c++} END{print c+0}' "$f")"
done
```

Expected: `19` for each — 114 lines total.

- [ ] **Step 2: Delete each section**

In all six files the section runs from its `Tool Allowances & Restrictions` heading to end of file — the `Allow` / `Restrict` headings beneath it are its own subsections, not siblings. Confirm that before cutting:

```bash
for f in CLAUDE.md app/CLAUDE.md database/CLAUDE.md docs/CLAUDE.md \
         app/src/db/CLAUDE.md app/src/pages/api/CLAUDE.md; do
  printf '%-32s last line: %s\n' "$f" "$(tail -1 "$f")"
done
```

Expected: every file's last line is a `Restrict` bullet (`- Agent spawning ...`, `- Glob ...`, or `- WebFetch, WebSearch ...`). If any file ends on something else, it has content after the section — remove only the section and keep that trailing content. Otherwise:

```bash
for f in CLAUDE.md app/CLAUDE.md database/CLAUDE.md docs/CLAUDE.md \
         app/src/db/CLAUDE.md app/src/pages/api/CLAUDE.md; do
  python3 - "$f" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
m = re.search(r"\n#+ *Tool Allowances[^\n]*\n", t)
assert m, f"no Tool Allowances section in {p}"
p.write_text(t[: m.start()].rstrip() + "\n", encoding="utf-8")
print(f"trimmed {p}")
PY
done
```

- [ ] **Step 3: Verify they are gone**

```bash
grep -rn "Tool Allowances" --include="CLAUDE.md" . | grep -v '^\./docs/superpowers/'
echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 4: Confirm real enforcement is untouched**

```bash
python3 -c "import json;d=json.load(open('.claude/settings.json'));print(len(d['permissions']['allow']),'allow /',len(d['permissions']['deny']),'deny')"
```

Expected: `19 allow / 2 deny`. `.claude/settings.json` is where tool access is actually enforced and this plan does not change it.

- [ ] **Step 5: Add the component-inventory maintenance step**

Append to `.claude/skills/context-maintenance/SKILL.md`, as a new step before the closing paragraph:

```markdown
9. **Component inventory.** If this task added, renamed, or removed a shared component under `app/src/components/ui/`, `components/forms/`, or the shared (non-per-game) part of `components/layout/games/`, update `docs/architecture/07-Frontend/08-Component-Inventory.md` in the same change. Per-game components (`interfaces/`, `result-modals/`, `*SetupForm.astro`) are out of scope.
```

- [ ] **Step 6: Run the gates and commit**

```bash
bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && \
bash scripts/check-context-budget.sh && bash scripts/check-agent-mirrors.sh
git add CLAUDE.md app/CLAUDE.md database/CLAUDE.md docs/CLAUDE.md \
        app/src/db/CLAUDE.md app/src/pages/api/CLAUDE.md \
        .claude/skills/context-maintenance/SKILL.md
git commit -m "docs(context): drop non-binding tool-allowance prose"
```

---

### Task 6: Record the decision and close out

**Files:**
- Modify: `decisions/context-system.md`, `docs/architecture/00-Context-Map-History.md`, `.claude/skills/context-maintenance/SKILL.md`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `D213`, the ledger entry later work cites.

- [ ] **Step 1: Derive the next decision id**

```bash
cd /home/user/dart-analytics
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' \
  | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected: `212`, so the next id is `D213`. If it prints something else, use that number plus one everywhere below.

- [ ] **Step 2: Append the decision block**

Append to the **end** of `decisions/context-system.md` — never inside it:

```markdown
### D213 — The context map routes; it does not carry the record
Status: Accepted · Date: 2026-08-19
Decision: `00-Context-Map.md` is reduced to a router (context packs, authority order, maintenance protocol). The canonical file inventory moves to `00-File-Inventory.md`, loaded only when a pack falls short; version history, per-task `docs/superpowers/**` rows and Current Implementation State move to `00-Context-Map-History.md` (`status: historical`), which no task loads. `AGENT.md` stops mirroring `CLAUDE.md` and becomes a fixed pointer stub, with `scripts/check-agent-mirrors.sh` inverted to assert the stub. The `Tool Allowances & Restrictions` sections are deleted from all six `CLAUDE.md` files.
Reason: the map was 37.6k tokens and the root `CLAUDE.md` protocol opened it at the start of every task, while the packs it routes to budget 2–17k — the router cost 2–10x the payload. 28.5k of it (76%) was provenance: a single 75k-character version-history line, 60+ rows describing point-in-time specs and plans, and drift-prone status prose. No gate ever wanted them — `check-context-map.sh` check 4 only requires top-level `docs/architecture/*.md` files be registered. The six `AGENT.md` files were byte-identical copies enforced identical by a gate, taxing every rule edit twice. The tool-allowance prose bound nothing: Claude Code enforces tool access through `.claude/settings.json`, and the prose was already contradicted by practice, restricting `mcp__github__*` in a repo whose workflow is issue-to-PR.
Consequences: the per-session context floor drops from ~39.3k to ~3.0k tokens. Nothing is deleted — every relocated token still exists in an unloaded file. Four gate scripts had to move with the split: `check-context-map.sh` registers against the inventory, `check-context-budget.sh` reads packs from the map and file rows from the inventory, `check-doc-links.sh` skips the path-backtick pass for `status: historical` documents (the carve-out `decisions/**` already had, for the identical reason), and `check-agent-mirrors.sh` asserts the stub instead of the mirror. No new gate script was created, so `.github/workflows/quality.yml` and `.husky/pre-commit` are unchanged. Future context growth lands in the history archive, which is written on every task and read on none. The graph rule in root `CLAUDE.md` — instructing agents to query a CLI that is absent from the session container — is knowingly left standing for a later change.
```

- [ ] **Step 3: Verify ledger integrity**

```bash
bash scripts/check-decision-ids.sh
```

Expected: `OK`. A uniqueness failure means `D213` already exists — re-derive with Step 1.

- [ ] **Step 4: Append the version entry to the history archive**

Under `# Version History` in `docs/architecture/00-Context-Map-History.md`, add a new entry **before** the retained `1.7.51` blob:

```markdown
> **Version:** 1.8.0 (2026-08-19 — context diet: `00-Context-Map.md` reduced from 37.6k to ~2k tokens as a pure router; canonical file inventory extracted to `00-File-Inventory.md`; version history, per-task `docs/superpowers/**` rows and Current Implementation State extracted to this file; `07-Frontend/08-Component-Inventory.md` added and wired into the frontend packs; two packs added (issue-driven UI polish, new game full stack) and every existing pack budget recomputed; all six `AGENT.md` files reduced to pointer stubs with `scripts/check-agent-mirrors.sh` inverted; `.claude/skills/{emil-design-eng,apple-design,animation-vocabulary,improve-animations,review-animations,using-git-worktrees}` and `using-superpowers/references/{antigravity,codex,pi}-tools.md` deleted (~2,200 lines, unreferenced or contradicting the No-git-worktrees invariant); `Tool Allowances & Restrictions` deleted from all six `CLAUDE.md` files (114 lines, non-binding); `scripts/check-context-map.sh`, `scripts/check-context-budget.sh` and `scripts/check-doc-links.sh` re-pointed at the new shape. Decision: D213. Per-session context floor ~39.3k → ~3.0k. No `app/` source changed, so `validate:app` did not apply. Deferred to later specs: the flagging/self-learning system, templates, and the unfollowable `graphify query` rule.)
```

- [ ] **Step 5: Update the map's maintenance protocol pointer**

In `docs/architecture/00-Context-Map.md`'s `# Maintenance Protocol`, confirm it states that the version entry is appended to `00-Context-Map-History.md` and that new docs are registered in `00-File-Inventory.md`. Correct it if it still names the map for either.

Also update `.claude/skills/context-maintenance/SKILL.md` step 2:

```markdown
2. **Context map.** Register new, moved, renamed, or deleted docs in `docs/architecture/00-File-Inventory.md` in the same change, and append the version entry to `docs/architecture/00-Context-Map-History.md` — never to `00-Context-Map.md`, which is the router and stays small.
```

- [ ] **Step 6: Run every applicable gate**

Invoke the `run-all-gates` skill, or run its docs-only set directly:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-decision-ids.sh
```

Expected: six `OK:` lines. Report each result explicitly — do not summarize as "gates pass".

- [ ] **Step 7: Confirm the outcome numbers**

```bash
python3 - <<'PY'
from pathlib import Path
for f in ["CLAUDE.md", "docs/architecture/00-Context-Map.md",
          "docs/architecture/00-File-Inventory.md",
          "docs/architecture/00-Context-Map-History.md"]:
    n = len(Path(f).read_text(encoding="utf-8"))
    print(f"{f:44s} {n:7d} ch  ~{n/4000:5.1f}k")
floor = sum(len(Path(f).read_text(encoding="utf-8"))
            for f in ["CLAUDE.md", "docs/architecture/00-Context-Map.md"]) / 4000
print(f"per-session floor: ~{floor:.1f}k  (was ~39.3k)")
PY
wc -l AGENT.md app/AGENT.md app/src/db/AGENT.md app/src/pages/api/AGENT.md database/AGENT.md docs/AGENT.md | tail -1
```

Expected: floor `≤ 3.5k`, `AGENT.md` total `24` lines. A floor above that means Task 2 left content in the router.

- [ ] **Step 8: Confirm no workflow edit was needed**

```bash
git diff origin/main --stat -- .github/workflows/ .husky/
echo "exit=$?"
```

Expected: no output. No gate script was added or renamed, so CI and the pre-commit hook are untouched by design. If this shows a diff, something in Tasks 2–5 changed a script name and the three dispatch lists (`quality.yml`, `.husky/pre-commit`, `run-all-gates/SKILL.md`) must be reconciled.

- [ ] **Step 9: Commit and push**

```bash
git add decisions/context-system.md docs/architecture/00-Context-Map-History.md \
        docs/architecture/00-Context-Map.md .claude/skills/context-maintenance/SKILL.md
git commit -m "docs(context): record D213 and close out the context diet"
git push -u origin claude/context-diet
```

---

## Verification (whole plan)

- Six `OK:` gate lines from Task 6 Step 6.
- Per-session floor ≤ 3.5k (Task 6 Step 7); was ~39.3k.
- `git grep -c 'Tool Allowances' -- '**/CLAUDE.md'` returns nothing.
- `git grep -n 'using-git-worktrees'` returns nothing outside `docs/superpowers/`.
- Every `AGENT.md` is byte-identical to the Task 3 stub (`check-agent-mirrors.sh` asserts it).
- `.github/workflows/` and `.husky/` unchanged versus `origin/main`.
- No `app/` source file changed, so `npm run validate:app` does not apply.
