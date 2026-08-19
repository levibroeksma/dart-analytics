<!--
status: canonical
scope: implementation plan — findings log, permission rule, findings gate
read-when: executing the governance spec (Spec 2 of 3)
updated: 2026-08-19
-->

# Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "a finding is logged, never fixed without permission" a mechanically-shaped, always-loaded rule: a root `FINDINGS.md` log, a Hard Invariant, and a gate that keeps the log well-formed and its evidence live.

**Architecture:** One new markdown log at the repo root (`FINDINGS.md`, block format copied from `DECISIONS.md`, but append-then-**delete** lifecycle with an explicit `highest-issued:` high-water mark), one new bash+python gate script (`scripts/check-findings-log.sh`, gate 16) wired into `.husky/pre-commit`, `.github/workflows/quality.yml` and the `run-all-gates` skill, one new Hard Invariant in root `CLAUDE.md`, and the absorption of the existing self-learning gate (D107) into a rewritten `context-maintenance` step 8.

**Tech Stack:** Bash + `python3` heredoc gate scripts (match `scripts/check-decision-ids.sh`'s shape exactly), Markdown, husky, GitHub Actions.

**Source spec:** `docs/superpowers/specs/2026-08-19-governance-design.md`

## Global Constraints

- Branch: `claude/governance-spec2`, already checked out, already pushed. Do **not** create a worktree (root `CLAUDE.md`: "No git worktrees"). Do not open a PR unless the user asks.
- Today's date for every ISO stamp in this plan: `2026-08-19`.
- Next decision id is **D214** (derived max is `D213`; `DECISIONS.md:45`'s "D198" is stale and is deliberately NOT fixed — it is seeded finding `F3`).
- Decisions are append-only: never edit or delete an existing block in `decisions/**`. D214 goes at the **end** of `decisions/context-system.md`.
- Never modify applied migrations. Never commit secrets.
- No model identifier in any commit message, code comment, or file content.
- **The dogfood rule, load-bearing:** this plan seeds `F1`–`F5` and fixes **none** of them, including one-line fixes. Any additional contradiction discovered while executing is logged as a new `F` entry (Task 8), never fixed. A plan that establishes "log, do not fix" and then fixes things on its way past teaches every later agent that the rule yields to convenience.
- Gate scripts print `OK: …` on success and `FAIL: …` on stderr, and exit 1 if any check failed — copy `scripts/check-decision-ids.sh`'s conventions.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `FINDINGS.md` (new, repo root) | The log itself: front-matter with `highest-issued:`, how-to-add prose, `F1`–`F5` blocks |
| `scripts/check-findings-log.sh` (new) | Gate 16 — six shape/liveness checks over `FINDINGS.md`; takes an optional path argument so fixtures can be tested |
| `.husky/pre-commit` (modify) | Runs the gate on every commit (11 → 12 scripts) |
| `.github/workflows/quality.yml` (modify) | Runs the gate in the `structure` job (15 → 16 scripts) |
| `.claude/skills/run-all-gates/SKILL.md` (modify) | "Always run" list gains the gate; the "11 structural gates" count becomes 12 |
| `CLAUDE.md` (modify) | The Hard Invariant + a "Where Everything Lives" row |
| `.claude/skills/context-maintenance/SKILL.md` (modify) | Step 8 rewritten from "Self-learning gate" to "Findings gate"; front-matter description updated |
| `DECISIONS.md` (modify) | Deferred boundary line; the `check-context-map.sh` false-positive entry removed (it migrates to `F5`) |
| `decisions/context-system.md` (modify) | D214, `Supersedes: D107`, appended at end of file |
| `docs/architecture/00-File-Inventory.md` (modify) | Rows for `FINDINGS.md` and the new script |
| `docs/architecture/00-Context-Map.md` (modify) | One pointer line in the router's intro bullets |
| `docs/architecture/00-Context-Map-History.md` (modify) | Version entry + this plan/spec's task rows |

---

### Task 1: The gate script

Written **before** the log it guards, so the log's first run is a real test rather than a formality.

**Files:**
- Create: `scripts/check-findings-log.sh`
- Test: no repo test file — verified against throwaway fixtures under the scratchpad (Steps 3–5). The repo has no bash test harness; every existing `check-*.sh` is verified the same way.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `bash scripts/check-findings-log.sh [path]` — path defaults to `FINDINGS.md`, resolved from the repo root. Exit 0 = pass, exit 1 = at least one check failed. Tasks 2 and 8 invoke it; Task 2 wires the zero-argument form into pre-commit and CI.

- [ ] **Step 1: Write the gate script**

Create `scripts/check-findings-log.sh` with exactly this content:

```bash
#!/usr/bin/env bash
# Findings-log gate — durable guard for FINDINGS.md (root CLAUDE.md's
# "A finding is not a work item" hard invariant; D214, which supersedes
# D107's narrower self-learning gate).
#
# Six checks:
#   1. Front matter  — the file exists, opens with an HTML comment carrying
#                      `status:`, and carries `highest-issued: F<n>`.
#   2. Field shape   — every `### F<id> — <title>` block carries all seven
#                      required fields: Status, Found, Task (on the header
#                      line, `·`-separated) plus Claim, Evidence, Impact,
#                      Proposed (one leading-anchored line each).
#   3. Id integrity  — ids are unique and none exceeds `highest-issued`.
#   4. Status vocab  — `Status:` is `Open` or `Raised`. Never `Resolved`:
#                      a resolved finding is DELETED, not restatused. This
#                      is the load-bearing difference from DECISIONS.md and
#                      the reason ids come from a high-water mark instead of
#                      a scan (deleting the highest-numbered entry must not
#                      make the next id collide with it).
#   5. Live evidence — every backtick-quoted path in an `Evidence:` line
#                      resolves to a file that exists. The check with teeth
#                      over time: a finding whose evidence was deleted or
#                      moved fails the build, so the log cannot rot into a
#                      list of claims about files that no longer exist.
#   6. ISO dates     — every `Found:` value is a real YYYY-MM-DD date.
#
# WHAT THIS GATE CANNOT DO, stated plainly so nobody mistakes its green for
# a guarantee: it proves the log is well-formed and its evidence is live. It
# cannot prove an agent logged a finding instead of fixing it — no script
# detects the absence of a fix that was never written. The CLAUDE.md
# invariant carries that obligation; this script carries only the shape.
#
# EVIDENCE-PATH HEURISTIC (check 5): a backtick span counts as a path only
# when it contains `/` or ends in a known file extension, and any trailing
# `:<line>` / `:<start>-<end>` locator is stripped before the existence
# test. Prose in an Evidence line legitimately backticks non-paths (`gh`,
# `D213`, `graphify query "<q>"`), and demanding those exist on disk would
# make the check unusable. Paths are resolved from the repo root, never
# from the caller's cwd.
#
# ARGUMENT: takes an optional path (default FINDINGS.md) purely so the
# gate can be aimed at a fixture file to prove it FAILS on malformed input.
# A gate not proven to bite is not a gate. Pre-commit and CI both invoke
# the zero-argument form.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FINDINGS="${1:-FINDINGS.md}"

[ -f "$FINDINGS" ] || { echo "FAIL: $FINDINGS not found" >&2; exit 1; }

python3 - "$FINDINGS" <<'PY'
import datetime
import re
import sys
from pathlib import Path

findings_path = sys.argv[1]
FAIL = 0


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def ok(msg: str) -> None:
    print(f"OK: {msg}")


text = Path(findings_path).read_text(encoding="utf-8")
lines = text.split("\n")

HEADING_RE = re.compile(r"^### F([0-9]+) — (.+)$")
HIGH_WATER_RE = re.compile(r"^highest-issued: F([0-9]+)\s*$", re.MULTILINE)
HEADER_FIELD_RE = re.compile(
    r"^Status:\s*(\S+)\s*·\s*Found:\s*(\S+)\s*·\s*Task:\s*(\S.*)$"
)
BODY_FIELDS = ("Claim", "Evidence", "Impact", "Proposed")
VALID_STATUS = {"Open", "Raised"}

# --- Check 1: front matter --------------------------------------------------
if not lines or not lines[0].startswith("<!--"):
    err(f"{findings_path} does not open with an HTML-comment front-matter block")
head = "\n".join(lines[:8])
if not re.search(r"^status:", head, re.MULTILINE):
    err(f"{findings_path} front matter lacks a `status:` line")

hw_match = HIGH_WATER_RE.search(head)
if hw_match is None:
    err(f"{findings_path} front matter lacks a `highest-issued: F<n>` line")
    high_water = None
else:
    high_water = int(hw_match.group(1))
    ok(f"front matter — `status:` present, high-water mark F{high_water}")

# --- Parse blocks -----------------------------------------------------------
blocks: list[dict] = []
current: dict | None = None
for lineno, line in enumerate(lines, start=1):
    m = HEADING_RE.match(line)
    if m:
        current = {
            "id": int(m.group(1)),
            "title": m.group(2),
            "lineno": lineno,
            "body": [],
        }
        blocks.append(current)
        continue
    if current is not None:
        if line.startswith("## ") or line.startswith("# "):
            current = None
            continue
        current["body"].append((lineno, line))

if not blocks:
    ok(f"{findings_path} holds no findings (an empty log is a valid state)")

# --- Checks 2, 4, 6: per-block field shape, status vocabulary, dates --------
for b in blocks:
    label = f"F{b['id']}"
    body_text = [ln for _, ln in b["body"]]
    header_line = next((ln for ln in body_text if ln.startswith("Status:")), None)
    if header_line is None:
        err(f"{findings_path}:{b['lineno']}: {label} has no `Status: … · Found: … · Task: …` header line")
    else:
        hm = HEADER_FIELD_RE.match(header_line)
        if hm is None:
            err(
                f"{findings_path}:{b['lineno']}: {label} header line is malformed — "
                f"expected `Status: <s> · Found: <YYYY-MM-DD> · Task: <branch>`, got {header_line!r}"
            )
        else:
            status, found, _task = hm.group(1), hm.group(2), hm.group(3)
            if status not in VALID_STATUS:
                err(
                    f"{findings_path}:{b['lineno']}: {label} has Status: {status} — "
                    f"only {sorted(VALID_STATUS)} are valid; a resolved finding is DELETED, never restatused"
                )
            try:
                datetime.date.fromisoformat(found)
            except ValueError:
                err(f"{findings_path}:{b['lineno']}: {label} Found: {found!r} is not an ISO YYYY-MM-DD date")
    for field in BODY_FIELDS:
        if not any(ln.startswith(f"{field}:") for ln in body_text):
            err(f"{findings_path}:{b['lineno']}: {label} is missing its required `{field}:` field")

if blocks and not FAIL:
    ok(f"field shape — all {len(blocks)} block(s) carry the seven required fields, valid Status, ISO Found date")

# --- Check 3: ids unique and within the high-water mark ---------------------
seen: dict[int, int] = {}
for b in blocks:
    if b["id"] in seen:
        err(f"{findings_path}:{b['lineno']}: duplicate id F{b['id']} (first seen at line {seen[b['id']]})")
    else:
        seen[b["id"]] = b["lineno"]
    if high_water is not None and b["id"] > high_water:
        err(
            f"{findings_path}:{b['lineno']}: F{b['id']} exceeds the high-water mark F{high_water} — "
            "bump `highest-issued:` in the same edit that issues a new id"
        )
if blocks and high_water is not None and len(seen) == len(blocks):
    ok(f"ids — {len(blocks)} unique id(s), none above the high-water mark F{high_water}")

# --- Check 5: evidence paths resolve ---------------------------------------
BACKTICK_RE = re.compile(r"`([^`]+)`")
KNOWN_EXT = (
    ".md", ".sh", ".ts", ".js", ".json", ".sql", ".yml", ".yaml",
    ".astro", ".css", ".py", ".tsv", ".txt", ".graphifyignore",
)
LOCATOR_RE = re.compile(r":\d+(-\d+)?$")


def looks_like_path(token: str) -> bool:
    if " " in token:
        return False
    stripped = LOCATOR_RE.sub("", token)
    return "/" in stripped or stripped.endswith(KNOWN_EXT) or stripped.startswith(".")


checked = 0
for b in blocks:
    for lineno, line in b["body"]:
        if not line.startswith("Evidence:"):
            continue
        for token in BACKTICK_RE.findall(line):
            if not looks_like_path(token):
                continue
            candidate = LOCATOR_RE.sub("", token)
            checked += 1
            if not Path(candidate).exists():
                err(
                    f"{findings_path}:{lineno}: F{b['id']} cites evidence `{token}` "
                    "but that path does not exist — a finding whose evidence is gone is a finding to delete"
                )
if checked:
    ok(f"evidence — all {checked} cited path(s) resolve")
elif blocks:
    ok("evidence — no path-shaped citations to resolve")

if FAIL:
    sys.exit(1)
sys.exit(0)
PY
```

- [ ] **Step 2: Make it executable and confirm it fails with no log present**

Run:

```bash
chmod +x scripts/check-findings-log.sh
bash scripts/check-findings-log.sh; echo "exit=$?"
```

Expected: `FAIL: FINDINGS.md not found` on stderr, `exit=1`. `FINDINGS.md` does not exist yet — this is the red state.

- [ ] **Step 3: Build the six malformed fixtures**

The spec requires the gate be proven to fail on each of: a block missing a field, a duplicate id, an id above the high-water mark, `Status: Resolved`, a non-existent `Evidence:` path, a non-ISO date. Write them to the scratchpad (never into the repo):

```bash
FIX=/tmp/claude-0/-home-user-dart-analytics/14792fb8-cb81-5b2a-9dc5-8ad87b6dd8ce/scratchpad/findings-fixtures
mkdir -p "$FIX"

head_fm() { printf '<!--\nstatus: canonical\nhighest-issued: F2\n-->\n\n# Findings\n\n'; }

# good — the control: every check passes
{ head_fm; cat <<'EOF'
### F1 — A control finding that is entirely well-formed
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: this fixture is well-formed
Evidence: `CLAUDE.md`
Impact: none — it exists to prove the gate passes something
Proposed: nothing
EOF
} > "$FIX/good.md"

# 1. missing a required field (no Impact:)
{ head_fm; cat <<'EOF'
### F1 — A block missing its Impact field
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: this block omits Impact
Evidence: `CLAUDE.md`
Proposed: add the field
EOF
} > "$FIX/missing-field.md"

# 2. duplicate id
{ head_fm; cat <<'EOF'
### F1 — First use of the id
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: a
Evidence: `CLAUDE.md`
Impact: b
Proposed: c

### F1 — Second use of the same id
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: a
Evidence: `CLAUDE.md`
Impact: b
Proposed: c
EOF
} > "$FIX/duplicate-id.md"

# 3. id above the high-water mark (F9 > F2)
{ head_fm; cat <<'EOF'
### F9 — An id issued past the high-water mark
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: a
Evidence: `CLAUDE.md`
Impact: b
Proposed: c
EOF
} > "$FIX/above-high-water.md"

# 4. Status: Resolved
{ head_fm; cat <<'EOF'
### F1 — A finding marked resolved instead of deleted
Status: Resolved · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: a
Evidence: `CLAUDE.md`
Impact: b
Proposed: c
EOF
} > "$FIX/resolved-status.md"

# 5. evidence path that does not exist
{ head_fm; cat <<'EOF'
### F1 — A finding whose evidence has been deleted
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: a
Evidence: `docs/architecture/99-Does-Not-Exist.md`
Impact: b
Proposed: c
EOF
} > "$FIX/dead-evidence.md"

# 6. non-ISO date
{ head_fm; cat <<'EOF'
### F1 — A finding with a non-ISO found date
Status: Open · Found: 19-08-2026 · Task: claude/governance-spec2
Claim: a
Evidence: `CLAUDE.md`
Impact: b
Proposed: c
EOF
} > "$FIX/bad-date.md"

# 7. missing the high-water mark entirely
printf '<!--\nstatus: canonical\n-->\n\n# Findings\n\n' > "$FIX/no-high-water.md"

ls "$FIX"
```

Expected: eight files listed (`good.md` plus seven malformed).

- [ ] **Step 4: Prove the gate bites on every fixture**

Run:

```bash
FIX=/tmp/claude-0/-home-user-dart-analytics/14792fb8-cb81-5b2a-9dc5-8ad87b6dd8ce/scratchpad/findings-fixtures
for f in good missing-field duplicate-id above-high-water resolved-status dead-evidence bad-date no-high-water; do
  bash scripts/check-findings-log.sh "$FIX/$f.md" >/dev/null 2>&1
  echo "$f -> exit=$?"
done
```

Expected, exactly:

```
good -> exit=0
missing-field -> exit=1
duplicate-id -> exit=1
above-high-water -> exit=1
resolved-status -> exit=1
dead-evidence -> exit=1
bad-date -> exit=1
no-high-water -> exit=1
```

This exact matrix was run against this exact script while the plan was written — all eight exit codes above are observed, not predicted. A deviation means the script was transcribed wrong, not that the expectation is off.

If `good` is not 0, the gate is over-strict — fix the script, not the fixture. If any malformed fixture is 0, that check does not work; fix it before continuing. **Do not proceed past this step with a wrong exit code.**

- [ ] **Step 5: Read the failure messages once, to confirm they name the problem**

Run:

```bash
FIX=/tmp/claude-0/-home-user-dart-analytics/14792fb8-cb81-5b2a-9dc5-8ad87b6dd8ce/scratchpad/findings-fixtures
for f in missing-field duplicate-id above-high-water resolved-status dead-evidence bad-date; do
  echo "--- $f ---"
  bash scripts/check-findings-log.sh "$FIX/$f.md" 2>&1 >/dev/null | head -2
done
```

Expected: each block names the specific defect and the file:line, e.g. `FAIL: …:8: F1 is missing its required `Impact:` field`. A gate whose message does not tell you what to fix costs the next agent a debugging session.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-findings-log.sh
git commit -m "feat(gates): add findings-log shape gate

Six checks over FINDINGS.md: front matter with a high-water mark, seven
required fields per block, unique ids within the mark, Open/Raised only
(a resolved finding is deleted, not restatused), every cited evidence
path still resolves, ISO Found dates.

Proven to fail on each of seven malformed fixtures before landing. The
gate carries the log's shape only; the CLAUDE.md invariant carries the
obligation to log rather than fix."
```

---

### Task 2: The log, seeded with F1–F5

**Files:**
- Create: `FINDINGS.md`

**Interfaces:**
- Consumes: `scripts/check-findings-log.sh` from Task 1.
- Produces: `FINDINGS.md` with `highest-issued: F5` and blocks `F1`–`F5`. Task 8 appends `F6` and bumps the mark to `F6`.

- [ ] **Step 1: Verify every evidence path this log will cite actually exists**

The gate's check 5 will reject any that don't. Run:

```bash
for p in .claude/settings.json CLAUDE.md DECISIONS.md .graphifyignore scripts/check-context-map.sh docs/architecture/00-Context-Map.md; do
  [ -e "$p" ] && echo "OK  $p" || echo "MISSING  $p"
done
command -v gh || echo "gh absent (F1's premise)"
command -v graphify || echo "graphify absent (F2's premise)"
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected: six `OK` lines, both `absent` lines, and `213` as the derived max id. If the derived max is not 213, use the real value in `F3` below and in Task 6's decision id.

- [ ] **Step 2: Write `FINDINGS.md`**

Create `FINDINGS.md` at the repo root with exactly this content:

```markdown
<!--
status: canonical
scope: open findings — defects and contradictions noticed but deliberately not fixed
read-when: triaging what to fix next; never loaded by a task
updated: 2026-08-19
highest-issued: F5
-->

# Findings

> Things an agent noticed while doing something else. A finding is **not** a
> work item: it is logged here and named in the completion report, never fixed
> in the same pass. Acting on one requires explicit user permission, and is a
> new task on its own branch. (Root `CLAUDE.md`, Hard Invariants; D214.)
>
> **Opposite lifecycle to `DECISIONS.md`.** Decisions are permanent and
> append-only. Findings are open until closed, and a closed finding is
> **deleted** — the record of the fix is the commit that fixed it, plus a
> decision in `decisions/**` where the fix embodied a real choice. Nothing
> accumulates here.
>
> Guarded by `scripts/check-findings-log.sh`.

## How to add a finding

- Next id is `highest-issued` in the front matter **plus one**. Bump that line
  in the same edit. Ids are never reused — because entries are deleted, the id
  cannot be derived by scanning the file, which is exactly what the high-water
  mark is for.
- `Status:` is `Open` (logged, not yet shown to the user) or `Raised` (named in
  a completion report). There is no `Resolved`: when a finding is fixed, delete
  its block.
- `Evidence:` cites at least one real path, optionally with a `:line` locator.
  The gate checks every cited path still exists, so a finding whose subject was
  deleted or moved fails the build until the entry is corrected or removed.
- Block format:

```markdown
### F<next> — Short statement of what is wrong
Status: Open · Found: YYYY-MM-DD · Task: <branch>
Claim: what the repo asserts
Evidence: `path/to/file.md:12` vs what is actually true
Impact: what it costs an agent that trusts the claim
Proposed: the smallest change that would resolve it — a proposal, not a plan
```

---

### F1 — `permissions.allow` pre-approves a CLI that is not installed
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `.claude/settings.json:20-22` grants `Bash(gh pr view:*)`, `Bash(gh pr list:*)` and `Bash(gh pr diff:*)`
Evidence: `.claude/settings.json:20` — `command -v gh` finds nothing in the session container; GitHub access runs through the `mcp__github__*` tools instead
Impact: an agent reading the allowlist as a capability inventory tries `gh pr diff`, gets a shell error, and spends a round discovering the MCP tools it should have used first
Proposed: drop the three `gh` entries, or keep them and note in the settings file that they cover a locally-installed `gh` only

### F2 — Root `CLAUDE.md` mandates a knowledge-graph CLI that is not installed
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `CLAUDE.md:48` — "Consult before broad grep/exploration: `graphify query`, `graphify path`, `graphify explain`"
Evidence: `CLAUDE.md:48` — `command -v graphify` finds nothing in the session container; D213's own Consequences paragraph records this rule as "knowingly left standing for a later change"
Impact: the rule is unfollowable as written, and an unfollowable rule in the always-loaded file teaches that the always-loaded file is advisory
Proposed: reword to consult the committed `graphify-out/graph.json` directly (it is in the repo and readable without the CLI), and make the CLI an optional convenience — this is Spec 3's subject and is deliberately not fixed here

### F3 — `DECISIONS.md` states a stale maximum decision id
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: "How to add a decision" names `D198` as the current maximum
Evidence: `DECISIONS.md:45` vs the derived max `D213`; the same line's ID-gap note at `DECISIONS.md:62` independently says `D212`
Impact: an agent trusting either number issues a colliding id; the derive command on the same line is correct, so the stale figures are pure trap
Proposed: drop both parentheticals and keep only the derive command, so there is no number to go stale

### F4 — `.graphifyignore` excludes a directory the invariants make impossible
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `.graphifyignore:6` ignores `.worktrees/`
Evidence: `.graphifyignore:6` vs `CLAUDE.md`'s "No git worktrees" hard invariant (D102), which forbids the directory from ever existing
Impact: small — a dead ignore line. It is logged because it is exactly the kind of residue that reads as evidence the practice is allowed
Proposed: delete the line

### F5 — A broken script is filed as a deferred feature
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `scripts/check-context-map.sh`'s migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at `0003` is compared against the migration chain end and fails
Evidence: `scripts/check-context-map.sh` — the check at its "2. Migration range consistency" section; the workaround was to reword the affected doc line, leaving the script deliberately unfixed (2026-07-26)
Impact: the defect sat in `DECISIONS.md`'s Deferred list among eleven unbuilt features, where "we chose not to build this" and "this is broken" are indistinguishable
Proposed: narrow the regex to skip lines naming seeds — partly done for `decisions/**` and seed lines by D194, but the seed-vs-migration ambiguity itself remains
```

- [ ] **Step 3: Run the gate against the real log**

Run:

```bash
bash scripts/check-findings-log.sh; echo "exit=$?"
```

Expected: `exit=0`, with `OK:` lines for front matter (high-water F5), field shape (5 blocks), ids, and evidence.

- [ ] **Step 4: Confirm the seeded count and the mark**

Run:

```bash
grep -c '^### F[0-9]' FINDINGS.md
grep '^highest-issued:' FINDINGS.md
```

Expected: `5` and `highest-issued: F5`.

- [ ] **Step 5: Confirm nothing was fixed on the way past**

Run:

```bash
git status --porcelain
```

Expected: exactly one path — `?? FINDINGS.md`, untracked, and nothing else. If `.claude/settings.json`, `.graphifyignore`, `DECISIONS.md` or `CLAUDE.md` show as modified here, a seeded finding was fixed instead of logged. Revert that file and re-read the dogfood rule in Global Constraints.

- [ ] **Step 6: Commit**

```bash
git add FINDINGS.md
git commit -m "docs(governance): add FINDINGS.md seeded with F1-F5

Root-level log for defects noticed while doing something else. Block
format mirrors DECISIONS.md so nothing new has to be learned; the
lifecycle is the opposite — a resolved finding is deleted, and ids come
from a highest-issued high-water mark rather than a scan.

Seeds the five live contradictions found while writing the spec and
fixes none of them, F3's one-word fix included. A log that establishes
'log, do not fix' and then fixes the easy ones has already taught the
next agent that the rule yields to convenience."
```

---

### Task 3: Wire the gate into pre-commit, CI, and the gates skill

**Files:**
- Modify: `.husky/pre-commit`
- Modify: `.github/workflows/quality.yml`
- Modify: `.claude/skills/run-all-gates/SKILL.md`

**Interfaces:**
- Consumes: `scripts/check-findings-log.sh` (Task 1), `FINDINGS.md` (Task 2). Both must exist, or every commit in the repo starts failing.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Add the gate to `.husky/pre-commit`**

The file is one `&&`-chained command. Append the new gate as the last link — change the final line from:

```
       && bash scripts/check-style-tokens.sh
```

to:

```
       && bash scripts/check-style-tokens.sh \
       && bash scripts/check-findings-log.sh
```

- [ ] **Step 2: Add the gate to `.github/workflows/quality.yml`**

In the `structure` job, after the `Style-tokens gate` step (the last step in that job), add:

```yaml
      - name: Findings-log gate
        run: bash scripts/check-findings-log.sh
```

- [ ] **Step 3: Add the gate to the `run-all-gates` skill's "Always run" list**

In `.claude/skills/run-all-gates/SKILL.md`, change the "Always run" block from:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
```

to:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
```

This is one file beyond the spec's Files table, and deliberate: the skill is the local dispatcher an agent runs before claiming a task done, and a gate absent from it produces a completion report that claims full coverage while omitting a gate CI will run anyway.

- [ ] **Step 4: Correct the stale gate count in the same skill**

In `.claude/skills/run-all-gates/SKILL.md`, the decision-ids section says "pre-commit already runs on every commit for the 11 structural gates". Change `11 structural gates` to `12 structural gates`.

This is not a finding — Step 1 is what made the number wrong, so correcting it is part of this change, exactly the carve-out the invariant names ("adjacent edits that work genuinely requires").

- [ ] **Step 5: Verify the whole pre-commit chain still passes**

Run:

```bash
bash .husky/pre-commit 2>&1 | tail -20; echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`, and the tail shows the findings-log gate's `OK:` lines last. If `lint-staged` complains about having nothing staged, stage the three modified files first and re-run.

- [ ] **Step 6: Verify the CI workflow file still parses**

Run:

```bash
python3 -c "import sys,yaml;yaml.safe_load(open('.github/workflows/quality.yml'));print('yaml OK')" 2>/dev/null \
  || grep -c 'bash scripts/check-' .github/workflows/quality.yml
```

Expected: `yaml OK`, or — if PyYAML is not installed — the count `16`, one per gate script in the `structure` job.

- [ ] **Step 7: Commit**

```bash
git add .husky/pre-commit .github/workflows/quality.yml .claude/skills/run-all-gates/SKILL.md
git commit -m "chore(gates): run the findings-log gate in pre-commit, CI and run-all-gates

Twelfth pre-commit gate, sixteenth in quality.yml's structure job, and
added to the run-all-gates 'Always run' list so a local completion
report covers what CI will check. Corrects that skill's now-stale
'11 structural gates' count."
```

---

### Task 4: The Hard Invariant

The rule itself. Deliberately separate from the log and the gate: this is the only change in the whole spec that costs the per-session context floor, so it gets its own reviewable commit.

**Files:**
- Modify: `CLAUDE.md` (Hard Invariants section, after line 68; "Where Everything Lives" table, after line 101)

**Interfaces:**
- Consumes: `FINDINGS.md` must already exist (Task 2) — `scripts/check-context-map.sh` check 1 verifies every path referenced from a `CLAUDE.md` exists, so this edit fails the gate if Task 2 has not landed.
- Produces: the rule that Task 5's step-8 rewrite and Task 6's D214 both cite.

- [ ] **Step 1: Add the invariant**

In `CLAUDE.md`, in `# Hard Invariants`, immediately after the "When a test's subject is removed or migrated…" bullet (currently the last one, line 68), append:

```markdown
- A finding is not a work item. Anything you notice that the task did not ask you to change — a bug, a stale doc, a contradicting rule, a dead file — is logged in `FINDINGS.md` and raised in the completion report; it is never fixed in the same pass. Acting on a finding requires explicit user permission, always. This governs *incidental* discovery only: work a task step names, including adjacent edits that work genuinely requires, proceeds as normal. (2026-08-19)
```

- [ ] **Step 2: Add the "Where Everything Lives" row**

In `CLAUDE.md`, in the `# Where Everything Lives` table, after the `Why a decision was made` row, insert:

```markdown
| Something noticed but not fixed | `FINDINGS.md` (open findings; delete on resolution) |
```

- [ ] **Step 3: Measure the floor cost**

Run:

```bash
python3 -c "
import pathlib
for p in ['CLAUDE.md','docs/architecture/00-Context-Map.md']:
    n=len(pathlib.Path(p).read_text(encoding='utf-8'))
    print(f'{p}: {n} chars ≈ {n/4/1000:.1f}k tokens')
"
```

Expected: root `CLAUDE.md` around 1.5k and the map around 1.8k, for a floor near ~3.3k — up from ~3.2k. Record the real figures; Task 7's history entry quotes them.

- [ ] **Step 4: Verify the path reference resolves**

Run:

```bash
bash scripts/check-context-map.sh; echo "exit=$?"
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: `exit=0` from both. `check-context-map.sh` check 1 scans every `CLAUDE.md` for path-like references; if `FINDINGS.md` were missing this is where it would fail.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(governance): make log-don't-fix a hard invariant

The only per-session context-floor increase in this spec (~3.2k to
~3.3k), and deliberate: the rule is non-negotiable, so it belongs where
every task already reads. Scoped to incidental discovery — work a task
step names, and adjacent edits that work requires, are unaffected."
```

---

### Task 5: Absorb the self-learning gate into a findings gate

**Files:**
- Modify: `.claude/skills/context-maintenance/SKILL.md` (front-matter `description`, line 3; step 8, line 17)

**Interfaces:**
- Consumes: the `CLAUDE.md` invariant (Task 4) and `FINDINGS.md` (Task 2).
- Produces: the step-8 text that D214 (Task 6) records as superseding D107.

- [ ] **Step 1: Rewrite step 8**

In `.claude/skills/context-maintenance/SKILL.md`, replace step 8 in full — from `8. **Self-learning gate.**` to the end of that line — with:

```markdown
8. **Findings gate.** Anything this task surfaced that it was not asked to change — a contradiction, an unenforced rule, a stale doc, a bug outside scope — is appended to `FINDINGS.md` as a new `F` entry (bump `highest-issued:` in the same edit) and named in the completion report. Never fix it in the same pass; never apply a rule change unilaterally. A rule sharpening is just a finding whose subject is a rule — it uses this same path, not a separate one. If the user approves acting on a finding, that is a new task on its own branch, and the entry is deleted when it lands. Run `scripts/check-findings-log.sh` and confirm it passes.
```

- [ ] **Step 2: Update the skill's front-matter description**

In the same file, line 3, change the trailing `self-learning gate)` to `findings gate)`. The full line becomes:

```yaml
description: Use before claiming any Dart Analytics task done — runs the mandatory context-upkeep steps (CLAUDE.md sync, context-map registration, decisions/** entry, gate scripts, branch/PR check, findings gate) so the context system never goes stale.
```

- [ ] **Step 3: Confirm nothing else still calls step 8 "self-learning"**

Run:

```bash
grep -rn 'self-learning' --include='*.md' . | grep -v '^./docs/superpowers/'
```

Expected: no output. Matches under `docs/superpowers/**` are historical plans and specs recording what was true when written — leave them; that tree is `status: historical` and `check-doc-links.sh` already skips it.

- [ ] **Step 4: Verify**

Run:

```bash
bash scripts/check-doc-links.sh; echo "exit=$?"
```

Expected: `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/context-maintenance/SKILL.md
git commit -m "docs(governance): absorb the self-learning gate into a findings gate

A rule sharpening is a finding whose subject happens to be a rule, so it
needs no separate mechanism — and its own mechanism was half-dead once
every AGENT.md became a pointer stub with no rules to sharpen.
Propose-then-confirm is preserved verbatim and widened to every kind of
finding, with a durable home instead of chat."
```

---

### Task 6: The Deferred/Findings boundary, and D214

Both halves of the ledger's change land together: the boundary line is meaningless without the decision that explains it, and `scripts/check-decision-ids.sh` covers both files in one run.

**Files:**
- Modify: `DECISIONS.md` (Deferred section, lines 33–35)
- Modify: `decisions/context-system.md` (append at end of file)

**Interfaces:**
- Consumes: `FINDINGS.md`'s `F5` (Task 2) — the migrated entry must already exist in the log before it is removed from Deferred, or the record is briefly lost.
- Produces: D214, cited by nothing later in this plan.

- [ ] **Step 1: Add the boundary line**

In `DECISIONS.md`, under `## Deferred (open, not rejected)` (line 33), insert a line immediately after the heading and before the run-on entry line:

```markdown
> Unbuilt things defer here. Broken things go to `FINDINGS.md`.
```

- [ ] **Step 2: Remove the migrated entry from the Deferred run-on line**

In the same section's single `·`-separated line, delete this trailing segment and the ` · ` that precedes it:

```
 · `scripts/check-context-map.sh` false positive — its migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at 0003 is compared against the migration chain end and fails; worked around by rewording the affected doc line, script deliberately left unfixed (2026-07-26)
```

The line must now end at `…bust rate + true checkout attempts become computable (2026-07-26)`. The 501 capture-mode entry **stays** — it is a genuine unbuilt capability, not a defect.

This migration is the assignment, not a finding: this spec is what establishes the boundary, so drawing it is in scope.

- [ ] **Step 3: Confirm the entry now lives in exactly one place**

Run:

```bash
grep -c 'check-context-map.sh false positive' DECISIONS.md
grep -c 'check-context-map.sh' FINDINGS.md
```

Expected: `0` and `1`.

- [ ] **Step 4: Derive the next decision id**

Run:

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected: `213`, so the new id is `D214`. If it prints something higher (the branch moved), use that value plus one everywhere below.

- [ ] **Step 5: Append D214 to `decisions/context-system.md`**

Append at the **end** of the file — never inside it, and never editing an existing block:

```markdown

### D214 — A finding is logged, not fixed; acting on one needs permission
Status: Accepted · Date: 2026-08-19 · Supersedes: D107
Decision: Anything an agent notices that its task was not asked to change is appended to a new root `FINDINGS.md` and named in the completion report, never fixed in the same pass; acting on a finding requires explicit user permission and becomes its own task on its own branch. The rule is a root `CLAUDE.md` Hard Invariant, the log is shape-guarded by `scripts/check-findings-log.sh` (gate 16, in `.husky/pre-commit` and `quality.yml`), and `context-maintenance` step 8 becomes the Findings gate. Findings are deleted when resolved, and ids come from a `highest-issued:` high-water mark rather than a scan.
Reason: an agent that found a defect mid-task had three bad options and no good one — widen the diff past its assignment, mention it in chat where the record dies with the session, or park it in `DECISIONS.md`'s Deferred list, where five deliberately-unbuilt features and a known-broken script were filed under one heading. Five live contradictions were sitting unrecorded in the repo when this was written, every one found incidentally during earlier tasks. D107's self-learning gate already encoded propose-then-confirm but only for `CLAUDE.md`/`AGENT.md` rule sharpenings, and half its target went dead when D213 reduced every `AGENT.md` to a pointer stub; a stale doc or a bug outside scope is not a rule sharpening, so it never fired for any of the five.
Consequences: the per-session context floor rises from ~3.2k to ~3.3k tokens — the only floor increase in the change, accepted because a non-negotiable rule belongs where every task already reads. `FINDINGS.md` cannot grow into a provenance blob the way the pre-D213 context map did, because resolved entries are deleted rather than restatused; the cost is that a finding's history after deletion is git history alone, plus a `decisions/**` entry where the fix embodied a real choice. The gate proves the log's shape and that every cited evidence path still resolves; it cannot prove an agent logged instead of fixed, and no script can — the invariant carries that obligation. The log ships seeded with F1–F5 and none of them fixed, F3's one-word correction included: a rule that yields to convenience on its first pass is read as advisory forever after.
```

- [ ] **Step 6: Verify the ledger**

Run:

```bash
bash scripts/check-decision-ids.sh; echo "exit=$?"
```

Expected: `exit=0`, with `OK:` for uniqueness (now 193 ids), no regression, `Supersedes` targets resolving (D107 still exists as a migrated row — the check requires the target exist, not that it be un-superseded), router shape, row integrity and registration.

- [ ] **Step 7: Commit**

```bash
git add DECISIONS.md decisions/context-system.md
git commit -m "docs(governance): record D214 and draw the Deferred/Findings boundary

Deferred holds unbuilt things; FINDINGS.md holds broken ones. The
check-context-map.sh false positive moves out of the Deferred run-on
line to F5, where a known-broken script is no longer indistinguishable
from a feature nobody built. The 501 capture-mode entry stays: it is a
genuine unbuilt capability."
```

---

### Task 7: Context registration

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `docs/architecture/00-Context-Map-History.md`

**Interfaces:**
- Consumes: every file created in Tasks 1–6.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Register `FINDINGS.md` in the inventory**

In `docs/architecture/00-File-Inventory.md`, in the `## Decision ledger (repo root, `decisions/`) (2026-08-02)` table — the one with a `~Tokens` column — insert immediately after the `DECISIONS.md` row:

```markdown
| `FINDINGS.md` | Open findings: defects and contradictions noticed but deliberately not fixed; append-then-delete, high-water-mark ids, guarded by `scripts/check-findings-log.sh` (2026-08-19) | canonical | ~1.3k |
```

The `~1.3k` is the figure measured while writing this plan (5 entries, 5,396 chars) — Step 3 re-measures and corrects it if the entries were reworded. `scripts/check-context-budget.sh` fails any row drifting more than 20% from a `chars/4` estimate.

- [ ] **Step 2: Register the gate script in the inventory**

In the same file, in the `## Cross-cutting mechanical guards (2026-07-28)` table — three columns, no `~Tokens` — append after the `scripts/decision-row-hashes.tsv` row:

```markdown
| `scripts/check-findings-log.sh` | Guard: `FINDINGS.md` front matter carries `status:` and `highest-issued: F<n>`; every block has all seven fields; ids unique and within the mark; `Status:` is `Open`/`Raised` only (resolved findings are deleted, never restatused); every backticked `Evidence:` path still resolves; `Found:` dates are ISO (2026-08-19, D214) | canonical |
```

- [ ] **Step 3: Measure `FINDINGS.md` and correct the claimed token count**

Run:

```bash
python3 -c "
import pathlib
n=len(pathlib.Path('FINDINGS.md').read_text(encoding='utf-8'))
print(n, 'chars ->', round(n/4/1000,1), 'k')
"
```

Replace the `~1.3k` from Step 1 with the printed value formatted the same way the other rows are (`~2.3k`, `~0.6k` — one decimal, trailing `.0` dropped). Then run:

```bash
bash scripts/check-context-budget.sh; echo "exit=$?"
```

Expected: `exit=0`. If it reports drift on the `FINDINGS.md` row, use the computed figure it names.

- [ ] **Step 4: Add the context-map pointer line**

In `docs/architecture/00-Context-Map.md`, in the intro blockquote bullets (currently three, lines 12–15), append a fourth:

```markdown
> - Noticed something the task didn't ask you to change? Log it in
>   `FINDINGS.md`; never fix it in the same pass.
```

`FINDINGS.md` sits in **no context pack** — agents write to it, humans read it when triaging — so this pointer is its only mention in the router.

- [ ] **Step 5: Append the history version entry**

In `docs/architecture/00-Context-Map-History.md`, under `# Version History`, insert a new entry **above** the current `1.8.0` line:

```markdown
> **Version:** 1.9.0 (2026-08-19 — governance: new root `FINDINGS.md` log for defects noticed but deliberately not fixed (append-then-delete lifecycle, `highest-issued:` high-water-mark ids, seeded with F1–F5 and none of them fixed); new root `CLAUDE.md` Hard Invariant making log-don't-fix non-negotiable and permission-gated, the only per-session floor increase in the change (~3.2k → ~3.3k); new `scripts/check-findings-log.sh` as the twelfth pre-commit gate and sixteenth `quality.yml` structure gate, proven to fail on seven malformed fixtures before landing; `context-maintenance` step 8 rewritten from Self-learning gate to Findings gate, absorbing D107 — a rule sharpening is a finding whose subject is a rule; `DECISIONS.md` Deferred gains an explicit boundary line and sheds the `check-context-map.sh` false positive to F5; D214 recorded, superseding D107)
```

- [ ] **Step 6: Add the spec and plan task rows**

In the same file, under `# Task Records`, append at the end of the table:

```markdown
| `docs/superpowers/specs/2026-08-19-governance-design.md` | Spec 2 of the three-spec agent-context program: a finding is logged, not acted on. Establishes one rule (a root `CLAUDE.md` Hard Invariant, permission required to act on any incidental discovery), one log (`FINDINGS.md`, `DECISIONS.md`'s block shape with the opposite lifecycle — resolved entries are deleted, so ids come from a `highest-issued:` mark rather than a scan) and one gate (`scripts/check-findings-log.sh`, shape and evidence-liveness only, with its inability to prove an agent logged rather than fixed stated plainly). Absorbs D107's self-learning gate rather than running it alongside. Ships seeded with the five live contradictions found while writing it and fixes none of them — the restraint is load-bearing, not an omission (2026-08-19) | historical |
| `docs/superpowers/plans/2026-08-19-governance.md` | The 8-task plan implementing that spec: gate script first and proven to bite on seven malformed fixtures (Task 1), the seeded log (Task 2), pre-commit/CI/run-all-gates wiring (Task 3), the Hard Invariant (Task 4), the step-8 rewrite (Task 5), the Deferred boundary + D214 (Task 6), context registration (Task 7), and a closing task that logs findings surfaced during execution rather than fixing them (Task 8) (2026-08-19) | historical |
```

- [ ] **Step 7: Verify**

Run:

```bash
bash scripts/check-context-map.sh; echo "exit=$?"
bash scripts/check-doc-links.sh; echo "exit=$?"
bash scripts/check-context-budget.sh; echo "exit=$?"
```

Expected: `exit=0` from all three.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map.md docs/architecture/00-Context-Map-History.md
git commit -m "docs(governance): register FINDINGS.md and the findings gate

Inventory rows for both, one router pointer line (FINDINGS.md sits in no
context pack — agents write to it, humans read it when triaging), and
the 1.9.0 history entry."
```

---

### Task 8: Close out — log what execution surfaced, then verify everything

The plan's own dogfood. Every task above may surface contradictions; none of them fixed one. This task writes them down.

**Files:**
- Modify: `FINDINGS.md` (append entries, bump `highest-issued:`)

**Interfaces:**
- Consumes: everything.
- Produces: the completion report's findings section.

- [ ] **Step 1: Log the known finding surfaced while writing this plan**

`docs/architecture/00-File-Inventory.md` still describes `AGENT.md` as a byte-identical mirror in two places, which D213 made false when it reduced all six to pointer stubs and inverted `scripts/check-agent-mirrors.sh` to assert the stub. It was noticed while adding rows to that file in Task 7 and deliberately left unfixed.

Append to `FINDINGS.md`:

```markdown

### F6 — The file inventory still describes `AGENT.md` as a byte-identical mirror
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `docs/architecture/00-File-Inventory.md` describes `scripts/check-agent-mirrors.sh` as asserting "every `CLAUDE.md` has a byte-identical `AGENT.md` sibling", and the `AGENT.md` row as an "Exact mirror of the sibling `CLAUDE.md` … edit both together"
Evidence: `docs/architecture/00-File-Inventory.md` — both rows, against D213 in `decisions/context-system.md`, which reduced all six `AGENT.md` files to pointer stubs and inverted the gate to assert the stub
Impact: an agent following the inventory copies rules into an `AGENT.md` and the inverted gate rejects the commit; the stale row says to do the exact thing the gate now forbids
Proposed: restate both rows against the stub behaviour D213 actually shipped
```

and change the front matter's `highest-issued: F5` to `highest-issued: F6`.

- [ ] **Step 2: Log anything else execution surfaced**

Re-read the diff of every commit in this branch and note anything you noticed and did not change. Each gets its own block, its own id, and a bump of `highest-issued:` in the same edit. If nothing else surfaced, skip — an empty step is a legitimate outcome, a silently-skipped one is not.

Run, to review what this branch changed:

```bash
git log --oneline origin/main..HEAD
git diff origin/main..HEAD --stat
```

- [ ] **Step 3: Verify the log**

Run:

```bash
bash scripts/check-findings-log.sh; echo "exit=$?"
grep -c '^### F[0-9]' FINDINGS.md
grep '^highest-issued:' FINDINGS.md
```

Expected: `exit=0`, a count matching the number of blocks, and a high-water mark equal to the highest id present.

- [ ] **Step 4: Correct the inventory's own token figure for `FINDINGS.md`**

Appending F6 grew the file past what Task 7 measured. Re-run:

```bash
python3 -c "
import pathlib
n=len(pathlib.Path('FINDINGS.md').read_text(encoding='utf-8'))
print(n, 'chars ->', round(n/4/1000,1), 'k')
"
bash scripts/check-context-budget.sh; echo "exit=$?"
```

If the budget gate reports drift on the `FINDINGS.md` row, update that row's `~Nk` to the computed value and re-run until `exit=0`.

- [ ] **Step 5: Run every gate**

Invoke the `run-all-gates` skill. Nothing under `app/` or `database/` changed, so the "Always run" list plus the decision-ids gate is the applicable set:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-decision-ids.sh
```

Expected: `exit=0` from each. State each result explicitly in the completion report — `run-all-gates`'s Reporting section forbids summarising as "gates pass".

- [ ] **Step 6: Run the full pre-commit chain once more**

Run:

```bash
bash .husky/pre-commit 2>&1 | tail -5; echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`.

- [ ] **Step 7: Commit and push**

```bash
git add FINDINGS.md docs/architecture/00-File-Inventory.md
git commit -m "docs(governance): log F6, found while registering the inventory rows

The inventory still describes AGENT.md as a byte-identical mirror, which
D213 made false. Logged, not fixed — this branch is what establishes
that rule, so it is the first branch that has to keep it."
git push -u origin claude/governance-spec2
```

If the push fails on a network error, retry up to four times with 2s, 4s, 8s, 16s backoff.

- [ ] **Step 8: Report**

The completion report states: each gate's result individually; the measured per-session floor before and after the `CLAUDE.md` edit; the finding count and high-water mark; that F1–F6 are logged and **none** fixed; and the branch name plus the fact that no PR exists (root `CLAUDE.md` requires an open PR to `main` or a stated reason — the reason is that the user has not asked for one, and this plan does not open one on its own).

---

## Verification Summary

Every claim the spec makes, and the command that proves it:

| Claim | Command | Expected |
| ----- | ------- | -------- |
| Gate passes the real log | `bash scripts/check-findings-log.sh` | exit 0 |
| Gate bites on all seven malformed shapes | Task 1 Step 4's loop | `good` 0, all others 1 |
| Log holds the seeded findings | `grep -c '^### F[0-9]' FINDINGS.md` | 6 after Task 8 (5 after Task 2) |
| High-water mark agrees | `grep '^highest-issued:' FINDINGS.md` | `F6` after Task 8 |
| No seeded finding was fixed | `git diff origin/main..HEAD -- .graphifyignore .claude/settings.json` | empty diff |
| Gate runs in pre-commit | `grep -c check-findings-log .husky/pre-commit` | 1 |
| Gate runs in CI | `grep -c check-findings-log .github/workflows/quality.yml` | 1 |
| Ledger intact | `bash scripts/check-decision-ids.sh` | exit 0 |
| Context system intact | `check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh` | exit 0 each |
| Floor cost measured | Task 4 Step 3 | ~3.2k → ~3.3k |

One exception to "empty diff" in row 5: `.claude/settings.json` already lost its `Bash(git worktree:*)` entry in commit `d99e9d3`, by explicit user instruction, before this plan begins. That diff is expected and is not a violation — it is the sanctioned path, permission first.
