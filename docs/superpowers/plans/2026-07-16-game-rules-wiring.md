# Game Rules Folder Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `docs/game-rules/` folder (raw, pre-spec, human-authored game/routine/trivia notes) into the agent-facing documentation system so it's discoverable, clearly non-canonical, and each subfolder has a stated landing spot — plus make `CLAUDE.md`/`AGENT.md` mirroring a mechanically enforced rule project-wide.

**Architecture:** Pure documentation + one new shell script. No application code changes. `docs/game-rules/` content itself is untouched — only new/edited `README.md` files inside it, plus cross-references added to the existing canonical docs (`CLAUDE.md`, `00-Context-Map.md`, `10-Database-Agent-Guide.md`, `docs/CLAUDE.md`) and their `AGENT.md` mirrors.

**Tech Stack:** Markdown docs, Bash (`scripts/check-agent-mirrors.sh`), GitHub Actions (`.github/workflows/checks.yml`).

## Global Constraints

- `docs/game-rules/` is non-canonical: no `status:` front-matter required, no registration in `00-Context-Map.md`'s File Inventory tables (confirmed `scripts/check-context-map.sh` only scans `docs/architecture/*.md` and `database/*.md`).
- Every cross-reference into `docs/game-rules/` from a routing file (`CLAUDE.md`/`AGENT.md`/`00-Context-Map.md`) must use the full `docs/game-rules/...` path — the checker's path-resolution bases do not include `docs/game-rules/` as an implicit prefix.
- No changes to the content of any existing file under `docs/game-rules/rulesets/`, `routines/README.md`'s routine outlines, `trivia/checkouts.md`, or `templates/GAME_ENGINE_TEMPLATE.md`.
- Every `CLAUDE.md` edit gets its sibling `AGENT.md` updated identically, in the same task, before that task's commit — this plan's own execution must follow the rule it's introducing.
- Do not decide trivia's eventual architecture — state explicitly that it's an open question.
- New branch `docs/wire-game-rules-folder`, based on `main` (not the still-open `frontend/style-guide-hardening`/PR #26 branch), checked out directly — never under `.worktrees/`.
- Do not commit unless a step below explicitly instructs it.

---

### Task 1: Branch setup

**Files:** none created/modified — git operations only.

**Interfaces:**
- Consumes: nothing.
- Produces: a clean `docs/wire-game-rules-folder` branch off `main`, carrying forward the untracked `docs/game-rules/` folder and `docs/superpowers/specs/2026-07-16-game-rules-wiring-design.md` from the working tree.

- [ ] **Step 1: Confirm the stray local branch has no unique work**

```bash
cd /Users/levi/Development/dart-analytics
git rev-parse architecture/game-rules frontend/style-guide-hardening
```

Expected: both commands print the identical SHA (already confirmed: `833ea8038c728798e7f73d2ce5fc7aead154d06d`). If they differ, STOP — `architecture/game-rules` has unique commits that must be investigated before deleting it.

- [ ] **Step 2: Discard the stale background-regenerated graph.json**

```bash
git status --short
```

Expected: `M graphify-out/graph.json` plus the two untracked entries (`docs/game-rules/`, the spec file). The modified `graph.json` is generated noise from the graphify branch-switch hook — safe to discard since it's fully reproducible via `scripts/refresh-graph.sh`, re-run later in this plan.

```bash
git checkout -- graphify-out/graph.json
git status --short
```

Expected: only the two untracked entries remain.

- [ ] **Step 3: Switch to main and create the new branch**

```bash
git checkout main
git pull
git checkout -b docs/wire-game-rules-folder
git status --short
```

Expected: `Switched to a new branch 'docs/wire-game-rules-folder'`; `git status --short` still shows the same two untracked entries (they carry over since neither exists as a tracked file on `main`).

- [ ] **Step 4: Delete the now-unused stray branch**

```bash
git branch -D architecture/game-rules
```

Expected: deletes cleanly. Safe per Step 1 — every commit on it also exists on `origin/frontend/style-guide-hardening` (already pushed, PR #26 open), so nothing is lost.

No commit for this task — it's pure branch/workspace setup.

---

### Task 2: `scripts/check-agent-mirrors.sh` + CI wiring

**Files:**
- Create: `scripts/check-agent-mirrors.sh`
- Modify: `.github/workflows/checks.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `scripts/check-agent-mirrors.sh` (exit 0 if every tracked `CLAUDE.md` matches its sibling `AGENT.md` byte-for-byte, exit 1 with a `FAIL:` line per diverged pair otherwise) — consumed by Task 3's verification step, the root `CLAUDE.md` Context Maintenance step 5 reference (Task 3), and CI.

- [ ] **Step 1: Write the script**

Create `scripts/check-agent-mirrors.sh`:

```bash
#!/usr/bin/env bash
# AGENT.md mirror checker — every CLAUDE.md must have a byte-identical
# AGENT.md sibling (Context Map: "exact mirror... edit both together").
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0
for claude in $(git ls-files '*CLAUDE.md'); do
  dir=$(dirname "$claude")
  agent="$dir/AGENT.md"
  if [ -f "$agent" ]; then
    diff -q "$claude" "$agent" >/dev/null 2>&1 \
      || { echo "FAIL: $claude and $agent have diverged" >&2; FAIL=1; }
  fi
done

[ $FAIL -eq 0 ] && echo "OK: every CLAUDE.md/AGENT.md pair is identical."
exit $FAIL
```

```bash
chmod +x scripts/check-agent-mirrors.sh
```

- [ ] **Step 2: Verify it passes against the current (fully-synced) tree**

```bash
bash scripts/check-agent-mirrors.sh
```

Expected: `OK: every CLAUDE.md/AGENT.md pair is identical.`

- [ ] **Step 3: Verify it actually catches divergence**

```bash
echo "TEMP DIVERGENCE" >> AGENT.md
bash scripts/check-agent-mirrors.sh; echo "exit code: $?"
```

Expected: a line `FAIL: CLAUDE.md and AGENT.md have diverged` and `exit code: 1`.

```bash
git checkout -- AGENT.md
bash scripts/check-agent-mirrors.sh
```

Expected: reverts cleanly, `OK: every CLAUDE.md/AGENT.md pair is identical.` again.

- [ ] **Step 4: Wire into CI**

In `.github/workflows/checks.yml`, change the `structure` job:

```yaml
  structure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Context-map consistency
        run: bash scripts/check-context-map.sh
      - name: File-location gate
        run: bash scripts/check-file-locations.sh
```

to:

```yaml
  structure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Context-map consistency
        run: bash scripts/check-context-map.sh
      - name: File-location gate
        run: bash scripts/check-file-locations.sh
      - name: AGENT.md mirror gate
        run: bash scripts/check-agent-mirrors.sh
```

- [ ] **Step 5: Commit**

```bash
git add scripts/check-agent-mirrors.sh .github/workflows/checks.yml
git commit -m "feat(scripts): add check-agent-mirrors.sh, wire into CI"
```

---

### Task 3: Root and `docs/` `CLAUDE.md`/`AGENT.md` wiring

**Files:**
- Modify: `CLAUDE.md` (repo root)
- Modify: `AGENT.md` (repo root)
- Modify: `docs/CLAUDE.md`
- Modify: `docs/AGENT.md`

**Interfaces:**
- Consumes: `scripts/check-agent-mirrors.sh` (Task 2) for verification.
- Produces: root `CLAUDE.md`/`AGENT.md`'s amended Context Maintenance step 1 (AGENT.md-mirroring is now an explicit protocol step) and step 5 (mentions the new script) — both read by every future task, not just this one. `docs/game-rules/README.md`'s existence is referenced here but created in Task 4 — the reference is written now and resolves once Task 4 lands, verified together in Task 4.

- [ ] **Step 1: Root `CLAUDE.md` — add a "Where Everything Lives" row**

Change:

```markdown
| Condensed database rules | `docs/architecture/05-Database/10-Database-Agent-Guide.md` |
```

to:

```markdown
| Condensed database rules | `docs/architecture/05-Database/10-Database-Agent-Guide.md` |
| Raw, pre-spec game/routine/trivia rule notes (non-canonical) | `docs/game-rules/README.md` |
```

- [ ] **Step 2: Root `CLAUDE.md` — amend Context Maintenance step 1**

Change:

```markdown
1. Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it.
```

to:

```markdown
1. Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it — and its `AGENT.md` mirror in the same directory, if one exists, kept byte-for-byte identical (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`).
```

- [ ] **Step 3: Root `CLAUDE.md` — amend Context Maintenance step 5**

Change:

```markdown
5. Run `scripts/check-context-map.sh` and `scripts/check-file-locations.sh` — both must pass.
```

to:

```markdown
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, and `scripts/check-agent-mirrors.sh` — all three must pass.
```

- [ ] **Step 4: Mirror all three edits into root `AGENT.md`**

Apply the identical three changes from Steps 1–3 to `AGENT.md` at the repo root (same before/after text, same locations).

- [ ] **Step 5: Verify root mirror**

```bash
cd /Users/levi/Development/dart-analytics
diff CLAUDE.md AGENT.md
```

Expected: no output (files identical).

- [ ] **Step 6: `docs/CLAUDE.md` — add the `docs/game-rules/` scope carve-out**

Change:

```markdown
Scope: all documentation under `docs/` (foundation docs, database handbook, API/frontend docs; `docs/superpowers/` is historical). Global rules, authority order, and context packs live in `docs/architecture/00-Context-Map.md` — not repeated here. SQL migration/seed rules live in `database/CLAUDE.md`. (2026-07-14)
```

to:

```markdown
Scope: all documentation under `docs/` (foundation docs, database handbook, API/frontend docs; `docs/superpowers/` is historical, `docs/game-rules/` is non-canonical pre-spec source material — see `docs/game-rules/README.md`). Global rules, authority order, and context packs live in `docs/architecture/00-Context-Map.md` — not repeated here. SQL migration/seed rules live in `database/CLAUDE.md`. (2026-07-14)
```

- [ ] **Step 7: Mirror the edit into `docs/AGENT.md`**

Apply the identical change from Step 6 to `docs/AGENT.md`.

- [ ] **Step 8: Verify docs mirror**

```bash
diff docs/CLAUDE.md docs/AGENT.md
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md AGENT.md docs/CLAUDE.md docs/AGENT.md
git commit -m "docs: wire docs/game-rules/ into CLAUDE.md/AGENT.md, make AGENT.md mirroring an explicit protocol step"
```

(`scripts/check-agent-mirrors.sh` isn't run against the full tree again here since `docs/game-rules/README.md` doesn't exist yet — Task 4 creates it, and Task 7's final validation runs every checker against the complete result.)

---

### Task 4: `docs/game-rules/` entry point and per-subfolder landing notes

**Files:**
- Create: `docs/game-rules/README.md`
- Create: `docs/game-rules/trivia/README.md`
- Modify: `docs/game-rules/rulesets/README.md`
- Modify: `docs/game-rules/routines/README.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `docs/game-rules/README.md` (the path referenced by root `CLAUDE.md`/`AGENT.md`, Task 3) — this task makes that reference resolve.

- [ ] **Step 1: Create `docs/game-rules/README.md`**

```markdown
# Game Rules — Raw Source Material

This tree holds **non-canonical, pre-spec, human-authored** descriptions of dartboard games, training routines, and standalone practice tools. Nothing here has `status:` front-matter and nothing here is registered in `docs/architecture/00-Context-Map.md` — `scripts/check-context-map.sh` deliberately does not scan this folder, since it only enforces the canonical rules for `docs/architecture/` and `database/`.

| Subfolder | Contents | Lands in |
| --- | --- | --- |
| `rulesets/` | One file per dartboard game, in the `templates/GAME_ENGINE_TEMPLATE.md` shape | `docs/architecture/05-Database/10-Database-Agent-Guide.md` § "Add a new game type" |
| `routines/` | Training-routine outlines | The deferred `ROUTINE_RUN` entity / routine-run write path (D64, `DECISIONS.md`) |
| `trivia/` | Standalone practice-tool descriptions (e.g. checkout trivia) | **No pipeline yet** — open question, resolved via the normal engineering workflow (`docs/architecture/03-Engineering-Workflow.md`) when first implemented, not predetermined here |
| `templates/` | Authoring template(s) used to write files under `rulesets/` | N/A — meta-doc, stays in place |

**Translation mechanism:** when a ruleset or routine is ready to build, its raw-notes file here is the *input* to a `brainstorming` session. The output — a real spec under `docs/superpowers/specs/`, then the corresponding canonical doc/schema updates — is what becomes authoritative. The raw-notes file itself is disposable once translated; it is not a second source of truth alongside the spec.
```

- [ ] **Step 2: Create `docs/game-rules/trivia/README.md`**

```markdown
# Trivia

This folder holds descriptions of standalone practice/study tools (e.g. `checkouts.md`'s checkout-route flashcard game) — these are **not** dartboard games played under the `game_types` model.

**No existing architecture pipeline covers this yet.** When the first trivia tool is implemented, its target shape (a standalone route, a different domain model, or something else) is an open engineering-workflow decision — see `docs/architecture/03-Engineering-Workflow.md` — not predetermined here. Once that decision is made, it gets its own spec under `docs/superpowers/specs/` and a `DECISIONS.md` entry, the same as any other architecture choice.
```

- [ ] **Step 3: Append a landing-spot line to `docs/game-rules/rulesets/README.md`**

Read the current file first, then change:

```markdown
# Rulesets

This folder contains the raw description of rulesets for games. These are the starting point for developing game engines later on.
```

to:

```markdown
# Rulesets

This folder contains the raw description of rulesets for games. These are the starting point for developing game engines later on.

Translation target: `docs/architecture/05-Database/10-Database-Agent-Guide.md` § "Add a new game type".
```

- [ ] **Step 4: Append a landing-spot line to `docs/game-rules/routines/README.md`**

Read the current file first, then change:

```markdown
# Routines

This folder contains outlines for training routines. These routines are designed to create practice sessions providing the user with a structure 'routine' to improve over time.
```

to:

```markdown
# Routines

This folder contains outlines for training routines. These routines are designed to create practice sessions providing the user with a structure 'routine' to improve over time.

Translation target: the deferred `ROUTINE_RUN` entity / routine-run write path (D64, `DECISIONS.md`).
```

- [ ] **Step 5: Verify the root `CLAUDE.md` reference now resolves**

```bash
cd /Users/levi/Development/dart-analytics
ls docs/game-rules/README.md docs/game-rules/trivia/README.md
```

Expected: both files listed, no "No such file" errors.

- [ ] **Step 6: Commit**

```bash
git add docs/game-rules/
git commit -m "docs(game-rules): add entry point README and per-subfolder landing-spot notes"
```

---

### Task 5: `00-Context-Map.md` — Non-Canonical Source Material section + Context Packs footnote

**Files:**
- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: `docs/game-rules/README.md` (Task 4).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Add a footnote under the Context Packs table**

Change:

```markdown
Paths are relative to `docs/architecture/` unless they start with `docs/`, `database/`, or `app/`.

---

# Authority Order (single source)
```

to:

```markdown
Paths are relative to `docs/architecture/` unless they start with `docs/`, `database/`, or `app/`.

For "New game type" tasks, also check `docs/game-rules/rulesets/<game>.md` if a raw ruleset note exists for that game — optional human-authored input, not part of the fixed budget above. See "Non-Canonical Source Material" below.

---

# Authority Order (single source)
```

- [ ] **Step 2: Add a new "Non-Canonical Source Material" section**

Change:

```markdown
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
| `graphify-out/graph.json` | Committed AST-only knowledge graph (generated; queried, not hand-edited) | generated |

---

# Current Implementation State
```

to:

```markdown
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
| `graphify-out/graph.json` | Committed AST-only knowledge graph (generated; queried, not hand-edited) | generated |

---

# Non-Canonical Source Material

`docs/game-rules/` holds raw, pre-spec, human-authored game/routine/trivia rule descriptions — entry point `docs/game-rules/README.md` (2026-07-16). This tree is deliberately **not** registered in the File Inventory above and carries no `status:` front-matter requirement: `scripts/check-context-map.sh` only enforces those rules for `docs/architecture/` and `database/`. See `docs/game-rules/README.md` for the per-subfolder translation targets.

---

# Current Implementation State
```

- [ ] **Step 3: Bump the Context Map's version line and date**

Change:

```markdown
> **Version:** 1.6.3 (2026-07-15 — Alpine v3 shorthand D100)
```

to:

```markdown
> **Version:** 1.6.4 (2026-07-16 — docs/game-rules/ wiring D109)
```

Change the front-matter comment's `updated:` line from `2026-07-15` to `2026-07-16`.

- [ ] **Step 4: Run the context-map checker**

```bash
cd /Users/levi/Development/dart-analytics
bash scripts/check-context-map.sh
```

Expected: exits 0, no `FAIL:` lines. If it fails, fix the specific line it names before proceeding.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/00-Context-Map.md
git commit -m "docs(context-map): add Non-Canonical Source Material section for docs/game-rules/"
```

---

### Task 6: `10-Database-Agent-Guide.md` — optional raw-notes pointer

**Files:**
- Modify: `docs/architecture/05-Database/10-Database-Agent-Guide.md`

**Interfaces:**
- Consumes: `docs/game-rules/rulesets/README.md` (Task 4, conceptually — the pointer here is generic, not to a specific game file).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Add the pointer line, steps 1–7 unchanged**

Change:

```markdown
## Add a new game type

1. Seed row in `game_types` (UUID + implementation_key)
```

to:

```markdown
## Add a new game type

Optional input: `docs/game-rules/rulesets/<game>.md` — a human-authored, non-canonical description of how the game is played, if one exists. Translate it into the steps below via a `brainstorming` session; it is not itself part of this procedure's output.

1. Seed row in `game_types` (UUID + implementation_key)
```

- [ ] **Step 2: Verify no other numbered step referenced "step 1" by number elsewhere in the file**

```bash
cd /Users/levi/Development/dart-analytics
grep -n "step 1\|Step 1" docs/architecture/05-Database/10-Database-Agent-Guide.md
```

Expected: no cross-references that would be broken by the new unnumbered lead-in line (the numbered list 1–7 itself is untouched, so this should be empty or only match unrelated text).

- [ ] **Step 3: Run the context-map checker**

```bash
bash scripts/check-context-map.sh
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/05-Database/10-Database-Agent-Guide.md
git commit -m "docs(db): point 'Add a new game type' at optional docs/game-rules/ raw notes"
```

---

### Task 7: `DECISIONS.md` entries and final validation

**Files:**
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: everything from Tasks 1–6 (closing task).
- Produces: nothing (terminal task).

- [ ] **Step 1: Determine the next available decision IDs**

```bash
cd /Users/levi/Development/dart-analytics
grep -oE 'D[0-9]+' DECISIONS.md | sed 's/D//' | sort -n | tail -1
```

This branch is off `main`, which currently ends at **D107** — so the next two IDs are **D108** and **D109**. If this command prints something higher than `107` (meaning PR #26, which independently claims D108, merged to `main` first and this branch was rebased past it), shift both new entries up by however much the tip has moved — e.g. if the tip is `108`, use **D109**/**D110** instead. Use whatever the command actually outputs; the two entries below are written for the `D108`/`D109` case.

- [ ] **Step 2: Append the two entries to the main decisions table**

Immediately after the last row of the first table (currently ending `D106`, or `D108` if PR #26 has already merged), insert:

```markdown
| D108 | 2026-07-16 | `docs/game-rules/` introduced as the non-canonical home for pre-spec, human-authored game/routine/trivia rule descriptions (rulesets, routines, trivia, authoring templates); wired into root `CLAUDE.md`, `00-Context-Map.md`, `10-Database-Agent-Guide.md`, and `docs/CLAUDE.md` for agent discoverability; deliberately exempt from the canonical status/registration rules `check-context-map.sh` enforces for `docs/architecture/` | Raw domain material existed with no discovery path for agents; wiring it in without promoting it to canonical status keeps architecture-first authority intact while making the input to future game-type/routine work findable |
| D109 | 2026-07-16 | `CLAUDE.md`/`AGENT.md` mirroring, previously a documented-but-unenforced fact (Context Map, 2026-07-15), made an explicit Context Maintenance protocol step and mechanically enforced via new `scripts/check-agent-mirrors.sh` (local + CI, alongside `check-context-map.sh`/`check-file-locations.sh`) | User-directed: mirror drift should never be possible to land silently, matching the D105 precedent of converting discipline-only rules into enforced ones |
```

(Renumber to `D109`/`D110` if Step 1 determined the tip had already moved past `D107`.)

- [ ] **Step 3: Add the `docs/game-rules/routines/` pointer to the existing deferred-items line**

In the "## Deferred (open, not rejected)" section, change:

```markdown
ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12) · multi-session activities (2026-07-12)
```

to:

```markdown
ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12; raw notes: `docs/game-rules/routines/`) · multi-session activities (2026-07-12)
```

(Only this one segment of the deferred-items line changes — the rest of the `·`-separated list is untouched.)

- [ ] **Step 4: Run every checker**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
```

Expected: all three print their `OK:` line and exit 0.

- [ ] **Step 5: Refresh the knowledge graph**

```bash
bash scripts/refresh-graph.sh
git status --short graphify-out/graph.json
```

Expected: completes (warns instead of failing if `graphify` isn't installed — note that in the completion report if it warns). If `graphify-out/graph.json` shows modified, it gets staged in Step 6.

- [ ] **Step 6: Commit**

```bash
git add DECISIONS.md
git add graphify-out/graph.json 2>/dev/null || true
git commit -m "docs(decisions): log docs/game-rules/ wiring and AGENT.md mirror enforcement"
```

- [ ] **Step 7: If the background graphify hook produces a further diff after this commit, commit it separately**

```bash
sleep 8
git status --short
```

If `graphify-out/graph.json` shows modified again (the post-commit hook rebuilding asynchronously — seen in prior sessions), stage and commit it alone:

```bash
git add graphify-out/graph.json
git commit -m "chore(graph): refresh graph.json after post-commit hook rebuild"
```

If `git status --short` is clean, skip this step.

- [ ] **Step 8: Confirm branch state**

```bash
git log --oneline main..docs/wire-game-rules-folder
git status --short
```

Expected: six or seven commits ahead of `main` (Tasks 2, 3, 4, 5, 6, 7 — one commit each, plus Task 7's optional extra graph-refresh commit), clean working tree.
