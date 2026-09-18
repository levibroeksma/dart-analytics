# Agent Context Hardening — implementation design

**Date:** 2026-09-18
**Source:** `docs/braindump/agent-context-hardening.md` (research report, non-canonical)
**Status:** design approved in chat; each branch below still owes its own PR review
**Measured against:** `main` @ `3412047f`

> Non-canonical source material (D312). A spec is an input to a task, never
> authority — it ranks with git history and the decision ledger. The findings it
> implements live in the research report; the decisions it produces will live in
> `decisions/context-system.md`.

---

## Problem

Two observed failures: relevant architecture docs are not read at task start, and
docs are not updated at task end. The research report traces both to one cause —
**every context rule in this repo is advisory prose, while Claude Code ships
deterministic loading mechanisms the repo does not use.**

## Scope

In: **F7** (config guardrails), **F9** (cross-boundary pointer gate), **F4**
(graphify skill), **F2 + F3** (path-scoped instruction layer), **F5** (doc-sync
enforcement).

Out, deliberately: **F6** (`.claude/agents/`) depends on `omitClaudeMd`, which the
report flags as unverified. **F8**'s cuts are evidence-gathering with no change
attached. Both stay in the report for a later pass.

Also out: the `PreToolUse` `additionalContext` spike. The report sequences it before
F2, but F2 is **path**-triggered and `paths:` frontmatter needs no spike. The spike
only serves **moment**-triggered deltas — the D312 pairing table — which is not in
this scope and has no measured defect behind it.

---

## Architecture

Three mechanisms, selected by what the delta fires on. `00-Context-Map.md` remains
the sole authority; everything below is a **pointer**, never a copy, so
`check-context-budget.sh` and `check-context-map.sh` keep working unchanged.

| Trigger | Mechanism | Applied to |
| --- | --- | --- |
| a directory | that directory's `CLAUDE.md` + `AGENT.md` stub (D213) | `services/`, `components/`, `stores/`, `modules/training/`, `app/tests/` |
| a glob no directory expresses | `.claude/rules/*.md` with `paths:` | `**/*.engine.module.ts` |
| unconditional | hook | concision (exists), `Stop` drift check (F5) |

### Why not the report's nine `.claude/rules/` files

The report measured the four existing directory `CLAUDE.md` files but never compared
their content to the rules it proposed. Four of the nine duplicate work already
shipping:

| Report proposes | Already exists |
| --- | --- |
| `migrations.md`, `seeds.md` | `database/CLAUDE.md` — including the "load the context pack first" pointer F2 exists to introduce |
| `docs.md` | `docs/CLAUDE.md`, `decisions/**` scope included |
| `api.md` | `app/src/pages/api/CLAUDE.md` for routes; `app/src/services/**` genuinely uncovered |

The real gap is not "no path-scoped mechanism" — it is that `app/src/**` has
directory rules for two narrow folders and none for `services/`, `modules/`,
`components/`, `stores/` or `tests/`, which is where most work happens. Extending a
mechanism every gate already understands beats introducing a second one for the same
job.

The glob case is real and not hypothetical: `*.engine.module.ts` files exist under
**both** `app/src/modules/game/` and `app/src/modules/training/exercises/`, so no
single directory boundary expresses that trigger.

---

## Branches

Four, sequential off `main`. Each is an independent task branch with its own PR,
decision block, File Inventory rows and `00-Context-Map-History.md` entry.

Two reorderings against the report's plan table: **F9 moves first** (a gate landing
after the tree it checks has nothing to say about how that tree was built), and **F4
moves before F2/F3** (both edit `app/CLAUDE.md`; sequencing them avoids a
self-inflicted merge conflict).

### Branch 1 — `chore/context-guardrails` (F7 + F9) · D314

**`.claude/settings.json`**

```jsonc
"permissions": {
  "deny": [
    "Bash(drizzle-kit generate:*)",
    "Bash(drizzle-kit push:*)",
    "Read(./graphify-out/graph.json)",
    "Read(./.worktrees/**/*)",
    "Read(./.claude/worktrees/**/*)",
    "Read(./app/src/db/schema.ts)"
  ]
},
"claudeMdExcludes": ["**/.worktrees/**", "**/.claude/worktrees/**"]
```

Both worktree roots are listed because D312 moved the home to `.worktrees/` while
pre-D312 worktrees stay populated until their branches land.

**`scripts/check-skill-pointers.sh`** — three assertions:

1. every `.claude/skills/*/SKILL.md` has a `00-File-Inventory.md` row;
2. every `.claude/rules/*.md` has one — an empty set today, so the gate lands green
   and branch 3's new tree is born covered rather than retrofitted;
3. every `superpowers:<name>` mentioned in tracked Markdown resolves under the
   installed plugin cache — **skipped, not failed, when the cache is absent**, since
   CI has none. Local runs carry the check; CI does not.

**`scripts/check-doc-links.sh`** — widen the hardcoded six-file scan list to include
`.claude/skills/**/*.md` and `.claude/rules/*.md`.

**Wiring:** `run-all-gates` §Always run, `quality.yml`, `.husky/pre-commit`.

**Known risk:** widening `check-doc-links.sh` over `.claude/skills/**` will likely
surface pre-existing broken path references in the six surviving skills. Fixing them
is adjacent work the gate genuinely requires, not discovered work — but it may push
this branch past its 1 h estimate. If it balloons, land the gate scoped to
`.claude/rules/` and add `.claude/skills/**` as a follow-up rather than growing the
branch.

### Branch 2 — `refactor/graph-lookup-skill` (F4) · D315

- `.claude/skills/graphify/SKILL.md` (678 lines / ~9.5k tok per invoke) →
  `.claude/skills/graph-lookup/SKILL.md` (~30 lines) plus
  `references/building.md` for the pipeline manual.
- **The rename is load-bearing.** The current description — *"any question about a
  codebase, its architecture, file relationships, or project content"* — is the
  broadest trigger in the set, so it fires on routine questions and injects a build
  manual the agent is explicitly told not to act on.
- Root `CLAUDE.md` § Knowledge Graph: delete *"or read it directly"*. That clause
  invites a ~1.9M-token read of a 7.7 MB file. Grep stays — verified safe at 218,728
  lines, max 206 chars per line.
- `app/CLAUDE.md` L21–35 (graphify install block) → `references/building.md`, leaving
  a two-line pointer.

### Branch 3 — `refactor/path-scoped-rules` (F2 + F3) · D316

Five directory pairs (`CLAUDE.md` + mandatory `AGENT.md` stub):

| New file | Carries, relocated from `app/CLAUDE.md` |
| --- | --- |
| `app/src/services/CLAUDE.md` | Controller→Service→Repository layering, UUIDv7 minting, ruleset registry wiring, the Zod ↔ `chk_*` mirror |
| `app/src/components/CLAUDE.md` | style non-negotiables, `cn()` composition, `Button.astro` reuse, `{...props}` (L136–145) |
| `app/src/stores/CLAUDE.md` | `$persist`, `PersistFactory` once per field (D120), `.store.ts` suffix (from L126) |
| `app/src/modules/training/CLAUDE.md` | `ExerciseEngine` contract, the no-clock rule, `ExerciseRulesetVersionKey` separation (L59) |
| `app/tests/CLAUDE.md` | test placement mirroring `app/src/`, Vitest mocks, no colocation, D101 |

One rule file: `.claude/rules/game-engines.md`, `paths: ["**/*.engine.module.ts",
"app/src/modules/game/**"]`, carrying L58's `GameEngine` contract and routing
exercise engines to the training guide.

Removed from `app/CLAUDE.md`: L37–46 (Astro documentation link list — deleted
outright, not relocated), L58–59, L126, L136–145.

**Target: ~85–90 lines, from 145.** The report's ~55–60 target is not reachable —
Development, Comments, Formatting, TDD, Validation Standard Procedure, Forbidden and
eight of the ten Non-Negotiables are genuinely app-wide and stay. A ~40% cut of the
always-on `app/` context is still the single largest saving available.

**Consequential tail, easy to miss:**

- the five new `CLAUDE.md` files must be added to `check-doc-links.sh`'s hardcoded
  list, or their pointers go unchecked;
- five `AGENT.md` stubs are mandatory — `check-agent-mirrors.sh` auto-discovers every
  `CLAUDE.md` via `git ls-files`;
- the ~12 Context Map pack rows citing `app/CLAUDE.md`, and its `00-File-Inventory.md`
  `~tokens` value, must be recomputed in the same commit or `check-context-budget.sh`
  fails on >20% drift.

### Branch 4 — `feat/doc-sync-gate` (F5) · D317

**Calibrate before building.** For the last ~20 first-parent merges: compute each
one's changed-file set against its merge base, apply the candidate heuristic, record
hit/miss, hand-label every hit as *docs genuinely owed* or *false positive*, and tune
the path patterns until false positives are ≈ 0. The resulting table goes in the PR
body so the threshold is auditable rather than asserted. The calibration itself is
throwaway analysis — no script from it is kept.

Then ship both pieces, hard-failing from day one:

- `scripts/check-doc-sync.sh` — a change under `database/migrations/`,
  `app/src/services/` or `app/src/modules/` with no `docs/architecture/` or
  `decisions/` edit fails. Deliberately narrow; style tweaks and test-only changes do
  not trip it.
- `.claude/hooks/context-drift.sh` + a `Stop` entry in `settings.json`, emitting
  `additionalContext` only on drift, so a clean turn costs nothing.

Wired into `run-all-gates` and `quality.yml`, **not** `.husky/pre-commit` — it diffs
against the merge base and would misfire mid-branch.

No permanently-advisory mode. D312's own finding was that *a rule whose enforcement
path does not run is indistinguishable from no rule*; shipping a gate that cannot
fail would reproduce it.

---

## Verification

| Branch | Proof |
| --- | --- |
| 1 | Negative fixtures: a skill directory with no inventory row must fail; a bogus `superpowers:does-not-exist` mention must fail **with** the plugin cache present and **skip** without it. Then all seven gates green. |
| 2 | `grep -rn graphify` over tracked files returns no stale skill-name references; `check-doc-links.sh` green over the new `references/` path. |
| 3 | All gates green including the recomputed budgets, plus the manual probe below. |
| 4 | The calibration replay is the test, plus a synthetic branch touching only `app/src/services/` which must fail. |

### Stated uncertainty — probe required before branch 3

`strings` on the installed binary (`2.1.236`) confirms `.claude/rules`,
`claudeMdExcludes`, `InstructionsLoaded`, `additionalContext` and `alwaysApply` are
present **as strings**. That is not confirmation of their semantics on this build.
Branch 3's entire premise is that a `paths:`-scoped rule loads when a matching file
is touched; branch 1 ships `claudeMdExcludes` on the same basis.

**Before branch 3 commits to six files:** a ~10-minute throwaway probe — one rule
carrying an obvious marker string, touch a matching file in a fresh session, confirm
the marker reaches context.

If the probe fails, approach A degrades gracefully. The five directory `CLAUDE.md`
files still work — that mechanism is already proven in this repo, since
`database/CLAUDE.md` does exactly this today — and only `game-engines.md` needs
rehoming (most likely split across `modules/game/` and `modules/training/`
directory files, accepting the duplication the glob was meant to avoid).

### What cannot be verified mechanically

No gate can assert "the agent actually read the pack." Pickup is unobservable from
CI. The honest success measure is `/context` in a live session before and after each
branch, plus whether the two observed failures recur. That is an observation, not a
test, and no part of this design should be read as claiming otherwise.

## Failure modes and rollback

Every branch is documentation and configuration only — no migrations, no data, no
runtime code. Rollback is reverting a single PR. The one non-trivial failure mode is
branch 1's widened link gate turning red on pre-existing skill references, handled by
the narrowing fallback described there.

## Out of scope, recorded

- **F6** `.claude/agents/` — blocked on verifying `omitClaudeMd`.
- **F8** pruning — needs `InstructionsLoaded` evidence first; the report is explicit
  that it is observe-then-cut, not a blind delete.
- The `PreToolUse` `additionalContext` spike.
- The three discovered-work items in the report (stale `.claude/worktrees/`
  directories, the `dart-analytics-superpowers-plugin` worktree, the "read it
  directly" clause — the last of which branch 2 does fix). Acting on discovered work
  requires explicit permission; none is assumed here.
