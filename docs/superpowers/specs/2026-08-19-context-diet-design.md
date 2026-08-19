<!--
status: canonical
scope: agent context system — context map, CLAUDE.md/AGENT.md, skills
read-when: implementing the context diet (Spec 1 of 3)
updated: 2026-08-19
-->

# Design: Context diet — router/inventory/history split, AGENT.md inversion, skill prune

## Problem

The agent context system costs more to route than to use.

`docs/architecture/00-Context-Map.md` is **37.6k tokens** and the root `CLAUDE.md`
Context Loading Protocol opens it at the start of every task. Measured breakdown:

| Section | chars | ~tok | Answers a task question? |
| ------- | ----- | ---- | ------------------------ |
| Version-history blob (single line 9) | 74,965 | 18.7k | no |
| `## Context & history` — 60+ `docs/superpowers/**` rows | 32,749 | 8.2k | no |
| `# Current Implementation State` | 6,528 | 1.6k | no (drift-prone status prose) |
| `# File Inventory` — canonical rows | 29,982 | 7.5k | only on pack escalation |
| `# Context Packs` | 3,876 | 1.0k | **yes — this is the router** |
| `# Authority Order` | 794 | 0.2k | yes |
| front-matter, Non-Canonical note, Maintenance Protocol | 1,367 | 0.4k | yes |

**~28.5k of 37.6k (76%) is provenance.** The context packs it routes to budget
2–17k. The router costs 2–10x the payload.

Four further defects compound it:

1. **`AGENT.md` duplication.** Six `AGENT.md` files are byte-identical copies of
   their sibling `CLAUDE.md` (433 lines), and `scripts/check-agent-mirrors.sh`
   *mandates* the identity. Every rule edit is two edits, forever.
2. **Dead and contradictory skills.** `emil-design-eng` (680 lines),
   `apple-design` (283), `animation-vocabulary` (174), `improve-animations`
   (102) and `review-animations` (112) have zero references anywhere in the
   repo. `using-git-worktrees` (202) teaches what the root `CLAUDE.md` hard
   invariant *"No git worktrees"* forbids. `using-superpowers/references/`
   carries tool docs for other harnesses (antigravity, codex, pi). Every
   `SKILL.md` description loads into the session skill index and competes for
   triggering.
3. **Non-binding tool prose.** All six `CLAUDE.md` files carry an identically
   shaped 19-line *"Tool Allowances & Restrictions"* section — 114 lines total.
   Claude Code enforces tool access via `.claude/settings.json`, not markdown.
   The prose is already contradicted by practice: root restricts
   `mcp__github__*` while the repo's whole workflow is issue→PR, and
   `app/src/db/CLAUDE.md` lists *"Restrict: Glob — not needed"*, discouraging a
   legitimate tool while binding nothing.
4. **The component-reuse mandate is unfollowable.** `app/CLAUDE.md` requires
   *"check `components/ui/` and `components/forms/` for a fitting component
   before writing new markup"*, but 10 of 15 shared components appear in **no**
   frontend doc: `SinglePlayerDisplay`, `StatRow`, `VisitPreview`,
   `InputButton`, `SetupShell`, `SettingSectionShell`, `SettingRow`,
   `PlayerSettingsCard`, `CardWrapper`, `InfoSection`. Obeying the rule costs
   ~10 exploratory file reads.

Two supporting observations that justify the approach:

- **No gate wants the history.** `scripts/check-context-map.sh` check 4 only
  requires top-level `docs/architecture/*.md` files be registered. The 60+
  `docs/superpowers/**` rows satisfy nothing; `docs/CLAUDE.md` calls that tree
  "historical". The 8.2k is entirely self-imposed.
- **The budget gate cannot see its own host.** The inventory claims
  `00-Context-Map.md` is `~31k` against an actual 37.6k — 18% drift, parked just
  under `scripts/check-context-budget.sh`'s 20% per-file tolerance.

## Scope

Spec 1 of three. This spec is **relocation and deletion only** — no new
behavioural machinery, one new descriptive doc.

Explicitly **out of scope**, deferred to later specs:

- **Spec 2 (governance):** the inconsistency-flagging log, self-learning
  hardening, and the non-negotiable "only work with permission" rule.
- **Spec 3 (consistency):** templates / reference exemplars, and the
  `graphify-out/graph.json` usage problem — root `CLAUDE.md` instructs
  *"Consult before broad grep: `graphify query`"* while the CLI is not
  installed in the session container, making the rule unfollowable. That
  contradiction is knowingly left standing until Spec 3.

## Design

### 1. Split the map three ways

**`docs/architecture/00-Context-Map.md`** (`status: canonical`, ~1.6k) keeps
only what routes a task:

- front-matter and one-paragraph purpose
- `# Context Packs` (audited — see §4)
- `# Authority Order`
- `# Non-Canonical Source Material` note
- `# Maintenance Protocol`
- three pointer lines: to the inventory, to the history archive, to
  `DECISIONS.md`

Under the pack table, one line: *"Pack lacks the answer? Escalate to
`00-File-Inventory.md`."*

**`docs/architecture/00-File-Inventory.md`** (new, `status: canonical`, ~7.5k)
receives the `# File Inventory` canonical rows verbatim — Foundation, Database
handbook, API/Frontend, SQL, game engine, settings, cross-cutting guards, brand
generators, decision ledger, and the canonical rows of `## Context & history`
(`README.md`, `app/CLAUDE.md`, `app/DEPLOYMENT.md`, `AGENT.md`, the four
`.claude/skills/**` rows, `graph.yml`, `graph-delta.py`, `graph.json`). Loaded
only on pack escalation.

**`docs/architecture/00-Context-Map-History.md`** (new, `status: historical`,
~28.5k) receives, unedited:

- the line-9 version-history blob
- the 60+ `docs/superpowers/**` rows of `## Context & history`
- `# Current Implementation State`

Never in a pack. Never loaded by a task. `context-maintenance` appends its
version entry here instead of the map.

No content is deleted. The split is a move.

### 2. Invert `AGENT.md`

Each of the six `AGENT.md` files becomes exactly:

```md
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
```

`scripts/check-agent-mirrors.sh` inverts its assertion: it currently fails when
a pair differs; it will fail when an `AGENT.md` is anything other than this
stub, or when a `CLAUDE.md` has no `AGENT.md` sibling. Same script, same
mechanical guarantee, opposite direction — and the "edit both together" tax is
gone.

### 3. Prune the skill layer

Delete (`git rm -r`):

| Skill | Lines | Why |
| ----- | ----- | --- |
| `emil-design-eng` | 680 | zero repo references |
| `apple-design` | 283 | zero repo references |
| `animation-vocabulary` | 174 | zero repo references |
| `review-animations` | 112 | zero repo references |
| `improve-animations` | 102 | zero repo references |
| `using-git-worktrees` | 202 | contradicts the *No git worktrees* hard invariant |
| `using-superpowers/references/{antigravity,codex,pi}-tools.md` | 78 | other harnesses |

Line counts are `SKILL.md` only; the deleted directories also carry
`PLAN-TEMPLATE.md`, `AUDIT.md` and `STANDARDS.md`. Total removed: ~2,200 lines.

**Required companion edit:** `.claude/skills/writing-plans/SKILL.md` line 16
references `superpowers:using-git-worktrees`. It must be rewritten to state that
task branches are checked out directly in the main working copy, or the prune
leaves a dangling skill reference.

`using-superpowers/SKILL.md` also conflicts with root `CLAUDE.md` — it demands
*"Invoke relevant skills BEFORE any response"* and *"announce 'Using [skill] to
[purpose]'"*, while root `CLAUDE.md` forbids acknowledgment phrases and requires
"On it." then immediate execution. Resolve by adding one line to the skill
deferring announcement style to the root `CLAUDE.md` Output Acknowledgment
section. The skill is kept; only the contradiction is removed.

### 4. Audit and repair the pack table

The pack table is the one thing that stays in the always-loaded file, so it must
be correct. For every existing pack row: verify each listed file exists and
recompute `~Budget` from `chars/4`. Add two packs covering the task types the
recent commit history shows are most common and currently improvised:

- **Issue-driven UI polish** — `07-Frontend/10-Frontend-Agent-Guide.md`,
  `07-Frontend/07-Style-Guide.md`, `08-Component-Inventory.md`, `app/CLAUDE.md`
- **New game (full stack)** — the DB `New game type` entries plus
  `07-Frontend/04-Modules-And-OOP.md`, `08-Component-Inventory.md`, and the
  setup/play/results/`register-route-data.ts` fan-out an actual new game
  requires (Shanghai v1 touched 32 files; today's `New game type` pack is
  DB-only at 5.9k and names none of them)

Fix the self-referential `~31k` row (§Problem) to the post-split value.

### 5. Add the component inventory

New `docs/architecture/07-Frontend/08-Component-Inventory.md` (`status:
canonical`, ~1k): one table row per component under `app/src/components/ui/`,
`components/forms/`, and the shared (non-per-game) components of
`components/layout/games/` — name, one-line purpose, key props. Added to the
frontend context packs.

This replaces ~10 exploratory reads with one table and makes `app/CLAUDE.md`'s
reuse mandate followable. It is descriptive only — no gate enforces it in this
spec; keeping it fresh is a `context-maintenance` step.

### 6. Delete the tool-allowance prose

Remove the *"Tool Allowances & Restrictions"* section from all six `CLAUDE.md`
files (19 lines each, 114 total). Nothing replaces them: real enforcement
already lives in `.claude/settings.json`'s `permissions.allow` / `permissions.deny`,
which stays as-is.

## Gate changes

Four scripts are coupled to the map's current shape and **will break** if the
split lands without them. This is the highest-risk part of the change.

1. **`scripts/check-context-map.sh`** — check 4 greps `$MAP` for every top-level
   `docs/architecture/*.md`. Re-point it at `00-File-Inventory.md`. Both new
   files need `status:` front-matter to satisfy check 3, and must themselves be
   registered.
2. **`scripts/check-context-budget.sh`** — parses `# Context Packs` **and**
   `# File Inventory` from one file. Split: read packs from the map, file rows
   from the inventory.
3. **`scripts/check-doc-links.sh`** — scans all canonical docs and will fail on
   the history archive's stale path references (files renamed or deleted since
   those entries were written). Add a `status: historical` skip for the
   path-like-backtick pass only, leaving the markdown-link pass in force.
   Precedent: the identical carve-out already exists for `decisions/**`, for
   the identical reason — a record of history is not required to track current
   file layout.
4. **`scripts/check-agent-mirrors.sh`** — inverted per §2.

Every gate change must be reflected in **three** places:
`.github/workflows/quality.yml` (runs all 15), `.husky/pre-commit` (runs the 11
structural gates), and `.claude/skills/run-all-gates/SKILL.md` (whose "Always
run" list hardcodes the five doc gates).

## Downstream edits

- **Root `CLAUDE.md`** — Context Loading Protocol (open the router; escalate to
  the inventory), the "Where Everything Lives" table, and removal of the tool
  prose. The graph rule stays untouched (Spec 3).
- **`.claude/skills/context-maintenance/SKILL.md`** — step 1 (`AGENT.md` is a
  stub, not a mirror), step 2 (register in the inventory; append the version
  entry to the history archive), plus a new step keeping
  `08-Component-Inventory.md` current when a shared component is added.
- **Pointer updates** where a file names the map for inventory purposes:
  `docs/CLAUDE.md`, `database/CLAUDE.md`, `app/CLAUDE.md`,
  `docs/architecture/README.md`, `docs/game-rules/README.md`, `DECISIONS.md`,
  `07-Frontend/10-Frontend-Agent-Guide.md`, `decisions/context-system.md`.
  `docs/superpowers/**` references are excluded from every gate and stay stale
  by design.
- **`decisions/context-system.md`** — one new appended decision block recording
  the router/inventory/history split, the `AGENT.md` inversion, and the
  tool-prose deletion. Next id derived per `DECISIONS.md`; `scripts/check-decision-ids.sh`
  must pass.

## Expected outcome

| | Before | After |
| --- | --- | --- |
| `00-Context-Map.md` | 37.6k | ~1.6k |
| `00-File-Inventory.md` | — | 7.5k (escalation only) |
| `00-Context-Map-History.md` | — | ~28.5k (never loaded) |
| Root `CLAUDE.md` | 1.7k | ~1.4k |
| **Per-session context floor** | **~39.3k** | **~3.0k** |
| `AGENT.md` total | 433 lines | ~18 lines |
| Skill layer | — | ~2,200 lines removed |
| Tool-allowance prose | 114 lines | 0 |
| Component inventory | none | ~1k, in-pack |

**~13x reduction in the per-session floor**, with zero information loss: every
removed token is either relocated to an unloaded file or was prose that bound
nothing.

## Verification

- `bash scripts/check-context-map.sh` · `check-doc-links.sh` ·
  `check-context-budget.sh` · `check-agent-mirrors.sh` · `check-decision-ids.sh`
  — all pass (these are the four modified scripts plus the ledger guard).
- `run-all-gates` skill reports every applicable script explicitly.
- `git grep -n 'using-git-worktrees'` returns nothing outside the history
  archive.
- `git grep -c 'Tool Allowances'` returns zero across `**/CLAUDE.md`.
- Every `AGENT.md` is byte-identical to the §2 stub.
- Recompute `00-Context-Map.md` at `chars/4` and confirm ≤2k.
- No `app/` source changes, so `validate:app` is not triggered by this spec.

## Risks

- **Gate coupling (high).** Four scripts parse the map's shape. Mitigation: land
  the script changes in the same commit as the split, and run all five doc gates
  locally before pushing.
- **Pointer rot (medium).** ~8 files name the map as the inventory home.
  Mitigation: `check-doc-links.sh` catches unresolved references; `check-context-map.sh`
  catches unregistered docs.
- **Pack audit scope creep (medium).** Recomputing every budget could expand
  into rewriting the packs' file lists. Mitigation: the audit corrects existing
  rows and adds exactly two; anything else is logged, not fixed.
- **History archive is write-heavy (low).** Every future task appends to a 28.5k
  file. Acceptable: it is never read by a task, and the alternative — deleting
  the record — was explicitly rejected.
