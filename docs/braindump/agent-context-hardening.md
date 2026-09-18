<!--
status: proposal (non-canonical)
scope: .claude/** configuration, CLAUDE.md layering, context-loading enforcement
measured-against: main @ 0c3f97e6, 2026-09-18, with branch `chore/remove-forked-skills` applied
resolved: F1 (PR #435 — D311 de-vendors the skills, D312 pairs the repo deltas with them)
-->

# Agent Context Hardening — research report

> Non-canonical proposal. Nothing here is a decision. Adopting any item is a
> separate task on its own branch, with its own `decisions/**` entry.

## Verdict

The documentation system is unusually disciplined: context packs, a token-budget
gate, an append-only decision ledger, 17 `check-*.sh` scripts. The weakness is not
the docs.

**Every context rule in this repo is advisory prose, while Claude Code now ships
deterministic loading mechanisms the repo does not use.** That is the direct cause
of the two observed failures — relevant docs not read at task start, and docs not
updated at task end.

---

## Measured baseline

Measured on a clean worktree of `main` @ `0c3f97e6` (2026-09-18) with the
`chore/remove-forked-skills` branch applied. Token figures are
`chars/4`, the same estimator `scripts/check-context-budget.sh` uses — directionally
right, not exact.

| Thing | Measured | Bar |
| --- | --- | --- |
| `CLAUDE.md` | 119 lines / 8,949 B | ≤200 lines ✅ |
| `app/CLAUDE.md` | 145 lines / 15,567 B | ✅ by line count; ~60% is path-specific |
| `app/src/db/CLAUDE.md` · `app/src/pages/api/CLAUDE.md` | 15 / 12 lines | ✅ |
| `database/CLAUDE.md` · `docs/CLAUDE.md` | 21 / 36 lines | ✅ |
| Project skills | 5 (was 13; 8 forks removed — F1 resolved) | — |
| `.claude/skills/graphify/SKILL.md` | 678 lines / 38,220 B (~9.5k tok on invoke) | ≤500 lines |
| Always-on skill metadata | ~6.8k tok (397 project / 608 superpowers / ~5.8k user-level) | — |
| `graphify-out/graph.json` | 7,732,501 B ≈ **1.9M tok if Read** · 5,491 nodes / 13,157 links · 218,728 lines, max 206 chars/line → **grep-safe** | — |
| `.claude/rules/` | **absent** | primary fix |
| `.claude/agents/` | **absent** | |
| Gates tying a code change to a doc/decision update | **none** of 17 | |
| `permissions.deny` entries | 2 (both `drizzle-kit`); no `Read(...)` rules | |
| `claudeMdExcludes` | absent | |
| Hooks configured | 2 (`PreToolUse` block-main-commit, `UserPromptSubmit` concision) | |

---

## Findings

> **F1 is resolved** — the eight drifted forks of `superpowers@6.3.0` were deleted
> and the plugin declared in `.claude/settings.json` (`extraKnownMarketplaces` +
> `enabledPlugins`) on branch `chore/remove-forked-skills` (D311). The two real
> deviations moved to the `CLAUDE.md` files that already outrank skills. Findings
> keep their original numbers; F1's slot is left empty rather than renumbered so
> the cross-references below still resolve.

### F2 — Context packs are prose, not a loading mechanism 🎯 root cause of "docs not read"

`CLAUDE.md` says: open `00-Context-Map.md`, find your task type, load exactly those
files. That is three model judgments, with zero enforcement and no feedback signal —
and it asks the agent to classify its own task *before* it has read any code. When
it is skipped, nothing reports it.

Claude Code has a deterministic equivalent. **Path-scoped rules load when Claude
touches a matching file** — no classification, no recall, no discipline required.

> "Rules with `paths` frontmatter only load when Claude works with matching files,
> saving context." — [features-overview](https://code.claude.com/docs/en/features-overview)
>
> "Path-scoped rules trigger when Claude reads files matching the pattern, not on
> every tool use." — [memory](https://code.claude.com/docs/en/memory)

**Fix:** `00-Context-Map.md` stays the human-authoritative map and the authority
order. Add thin **pointer** rules that fire mechanically. They restate nothing; they
name the pack and the three or four constraints that get violated most.

```markdown
<!-- .claude/rules/api.md -->
---
paths:
  - "app/src/pages/api/**/*.ts"
  - "app/src/services/**/*.ts"
---
Before editing: read `docs/architecture/06-API/00-Overview.md` and
`06-API/04-Endpoint-Contracts.md` (Context Map pack "New API endpoint").

- Controller → Service → Repository layering.
- Reads go through `v_*` views; writes go to runtime tables.
- Middleware verifies JWT; handlers and services never parse it.
- Service layer mints UUIDv7. The database never generates ids.
```

Proposed set — one per pack cluster, each ≤25 lines:

| Rule file | `paths:` |
| --- | --- |
| `migrations.md` | `database/migrations/**` |
| `seeds.md` | `database/seeds/**` |
| `api.md` | `app/src/pages/api/**`, `app/src/services/**` |
| `astro.md` | `app/src/components/**`, `app/src/pages/**/*.astro` |
| `game-engines.md` | `app/src/modules/game/**`, `**/*.engine.module.ts` |
| `training.md` | `app/src/modules/training/**` |
| `stores.md` | `app/src/stores/**` |
| `tests.md` | `app/tests/**` |
| `docs.md` | `docs/architecture/**`, `decisions/**` |

Marginal always-on cost: **zero**. A rule only enters context when a matching file
is touched.

---

### F3 — `app/CLAUDE.md` pays always-on cost for sometimes-relevant content

At 145 lines it clears the 200-line bar, but it loads the `GameEngine` contract, the
`ExerciseEngine` contract, the Astro documentation link list, the style-token
non-negotiables and the Alpine conventions on **every** `app/` session — including
one that only touches `app/src/services/`.

> "If an entry is a multi-step procedure or only matters for one part of the
> codebase, move it to a skill or a path-scoped rule instead."
> — [memory](https://code.claude.com/docs/en/memory)
>
> Anti-pattern: "**Unscoped API-specific rules** → add `paths:` frontmatter to keep
> irrelevant rules out of context."
> — [Steering Claude Code, 2026-06-18](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)

**Fix:** `app/CLAUDE.md` keeps only what is true across all of `app/` — commands
(`env:dev`/`env:prod`, `db:*`, `astro dev --background`), the Forbidden list, the
comments policy, TDD placement, the `validate:app` bar, format-before-PR.

Relocate:

| Block | Destination |
| --- | --- |
| **Game engines** (longest block in the file) | `.claude/rules/game-engines.md` |
| **Exercise engines** | `.claude/rules/training.md` |
| **Style non-negotiables** + Handbook 0.1.0 line | `.claude/rules/astro.md` |
| **TypeScript file organization** | `.claude/rules/astro.md` (enforced by `check-file-locations.sh` regardless) |
| **Astro Documentation** link list | delete — Claude knows Astro; the Context Map already routes frontend work |

Target: ~55 lines. Nothing is lost; each rule fires exactly when its subject is
being edited, which is *more* reliable than always-on prose competing with 12 other
sections.

---

### F4 — The `graphify` skill is the wrong shape for this repo

678 lines describing how to **build** a knowledge graph (`--mode deep`, `--obsidian`,
cross-repo merge, community detection, incremental update). The repo's actual need is
to **query a committed one** — CI owns rebuilds (`.github/workflows/graph.yml`, D185,
D287) and `app/CLAUDE.md` explicitly tells the agent not to rebuild locally.

Its description — *"Use for any question about a codebase, its architecture, file
relationships, or project content"* — is the broadest trigger in the set, so it fires
on routine questions and injects ~9.5k tokens of pipeline manual that the agent must
not act on.

Compounding it, `CLAUDE.md` currently states the graph is *"readable with the tools
every session already has — grep it for an entity, **or read it directly**."*
Reading `graphify-out/graph.json` costs ~1.9M tokens. That clause is a context bomb.
(Grep is genuinely fine: 218,728 lines, max 206 chars per line — verified.)

**Fix:** replace with a ~30-line `graph-lookup` skill, and move the pipeline manual
to a supporting file that loads only if someone rebuilds.

```markdown
---
name: graph-lookup
description: Find where a symbol, file, table or doc connects in this repo. Use before grepping broadly.
allowed-tools: Bash(python3 *), Bash(grep *), Read
---
`graphify-out/graph.json` is NetworkX node-link JSON: 5,491 nodes, 13,157 links.
NEVER Read it whole (~1.9M tokens). Query it:

# what does X connect to
python3 -c "import json;g=json.load(open('graphify-out/graph.json'));print([(l['relation'],l['target'],l['source_file']) for l in g['links'] if 'X' in l['source']][:40])"

# which file defines a label
grep -n '"label": "X"' graphify-out/graph.json

Then Read the `source_file` it names.

The graph is a map, not authority — on conflict the authority order in
`docs/architecture/00-Context-Map.md` wins; verify against the cited file.
`.astro` files are only partially parsed. Rebuilding: see references/building.md
(CI owns freshness — never commit a local graph).
```

> "Keep `SKILL.md` under 500 lines. Move detailed reference material to separate
> supporting files." — [skills](https://code.claude.com/docs/en/skills)

Also fix the `CLAUDE.md` clause: `grep it for an entity` — drop "or read it directly".

---

### F5 — Nothing enforces the "update the docs afterward" half

`context-maintenance` is a 9-step skill the agent has to **remember** to invoke, at
precisely the moment it is most inclined to declare victory. The 17 `check-*.sh`
scripts validate doc *internal* consistency (links, budgets, decision ids, front
matter) — **none** asserts that a code change arrived with a doc or decision change.

> "An instruction like 'never edit `.env`' in CLAUDE.md or a skill is a request, not
> a guarantee. A `PreToolUse` hook that blocks the edit is enforcement. **If a rule
> must hold every time, make it a hook.**"
> — [features-overview](https://code.claude.com/docs/en/features-overview)
>
> "Add a `Stop` hook that proposes updates: a `Stop` hook receives the path to the
> session transcript when Claude finishes responding, so a script can review the
> session and propose CLAUDE.md updates while the gap it exposed is fresh."
> — [large-codebases](https://code.claude.com/docs/en/large-codebases)

**Fix — two small pieces.**

**(a) `scripts/check-doc-sync.sh`** — mechanical, joins the existing gate suite and
the `run-all-gates` skill:

```bash
#!/usr/bin/env bash
# Structural change with no documentation change is an incomplete task
# (root CLAUDE.md, Context Maintenance).
set -euo pipefail
CHANGED=$(git diff --name-only "$(git merge-base HEAD main)"...HEAD)

echo "$CHANGED" | grep -qE '^database/migrations/|^app/src/(services|modules)/' || exit 0
echo "$CHANGED" | grep -qE '^docs/architecture/|^decisions/' && exit 0

echo "FAIL: schema/service/module change with no docs/architecture or decisions/ edit." >&2
echo "      Run the context-maintenance skill, or justify the exemption." >&2
exit 1
```

Deliberately narrow: only migrations, services and modules trip it. A style tweak or
a test-only change does not.

**(b) `Stop` hook** — fires only when it would have something to say, so a clean turn
costs nothing:

```json
"Stop": [{
  "hooks": [{
    "type": "command",
    "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/context-drift.sh\"",
    "statusMessage": "Checking context drift"
  }]
}]
```

…emitting, only on drift:

```json
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"Uncommitted changes under app/src/services|modules or database/migrations with no docs/architecture or decisions/ edit. Run the context-maintenance skill before reporting done."}}
```

Together these convert steps 1–4 and 9 of `context-maintenance` from *hope* into
*checked*.

---

### F6 — No `.claude/agents/`, despite heavy subagent prescription

`superpowers:subagent-driven-development` and `superpowers:brainstorming` both dispatch
subagents, but with no definitions present every subagent inherits the full
CLAUDE.md chain and the entire skill-description block. Two definitions would pay
for themselves:

```markdown
<!-- .claude/agents/doc-router.md -->
---
name: doc-router
description: Given a task description, returns the exact Context Map pack file list and its binding constraints. Returns a list, not prose.
tools: Read, Grep, Glob
omitClaudeMd: true
model: haiku
---
Read `docs/architecture/00-Context-Map.md`. Match the task to exactly one pack row.
Read those files. Return:
1. the file list,
2. ≤10 bullets of binding constraints,
3. anything the pack demonstrably lacks (name the escalation target).
Do not summarise the docs. Do not propose an implementation.
```

`omitClaudeMd: true` plus Haiku makes pack resolution nearly free, and it returns a
*conclusion* rather than dumping five architecture files into the main window — the
mental test Anthropic's own teams use: *will I need this tool output again, or just
the conclusion?*

Second candidate: a `gate-runner` (Bash-only, `omitClaudeMd`) so the 13 pre-commit
gates' output never lands in the main context.

> "Built-in agents (`Explore`, `Plan`) skip CLAUDE.md to keep context small."
> — [skills](https://code.claude.com/docs/en/skills)

---

### F7 — Cheap guardrails currently missing

```jsonc
// .claude/settings.json
"permissions": {
  "deny": [
    "Bash(drizzle-kit generate:*)",
    "Bash(drizzle-kit push:*)",
    "Read(./graphify-out/graph.json)",      // 7.7 MB — grep it, never Read it
    "Read(./.worktrees/**/*)",              // sibling checkouts of this same repo
    "Read(./.claude/worktrees/**/*)",       // pre-D312 worktrees, same reason
    "Read(./app/src/db/schema.ts)"          // drizzle-kit introspect output
  ]
},
"claudeMdExcludes": ["**/.worktrees/**", "**/.claude/worktrees/**"]
```

Both paths are listed because D312 moved worktrees to `.worktrees/` and the older
directory stays populated until its branches land.

Each live worktree carries a **full duplicate set of 5
CLAUDE.md files** that load on demand the moment anything reads a file there, plus
duplicate hits in every `grep` and `Glob`.

> "Each subdirectory's CLAUDE.md loads as soon as Claude reads a file in that
> directory. The `claudeMdExcludes` setting skips specific files by path or glob
> pattern so they never load."
> — [large-codebases](https://code.claude.com/docs/en/large-codebases)

`claudeMdExcludes` fixes this permanently, independent of worktree hygiene — worth
having even when zero worktrees are stale.

---

### F8 — Some rules are over-constraint by 2026 standards

Anthropic removed **over 80% of Claude Code's system prompt** for Claude Opus 5 and
Fable 5 "with no measurable loss on coding evaluations," reporting that teams "were
overconstraining Claude Code, both through system prompt and in CLAUDE.md files and
skills."
— [The new rules of context engineering, 2026-07-24](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models)

Candidates here, in descending confidence:

1. The Astro documentation link list in `app/CLAUDE.md` (F3).
2. `CLAUDE.md` § *Output Acknowledgment*, which prescribes exact opening tokens —
   the `UserPromptSubmit` concision hook already injects this on every prompt. One
   instruction, two homes, two places to drift.

**Treat F8 as observe-then-cut, not a blind delete.** Add an `InstructionsLoaded`
hook logging to `.claude/logs/loaded.jsonl` to see what actually loads and when,
before removing anything.

> "Use the `InstructionsLoaded` hook to log exactly which instruction files are
> loaded, when they load, and why." — [memory](https://code.claude.com/docs/en/memory)

---

## Plan

| # | Change | Effort | Risk | Payoff |
| --- | --- | --- | --- | --- |
| 2 | Add `.claude/rules/` (9 path-scoped pointer files) | 2 h | low | **fixes "docs not read"** |
| 3 | Slim `app/CLAUDE.md` 145 → ~60 lines into those rules | 1 h | low | −60% always-on `app/` context |
| 4 | `graphify` → `graph-lookup` + `references/building.md`; fix the "read it directly" clause in `CLAUDE.md` | 1 h | low | −9.5k tok per invoke; removes context bomb |
| 5 | `check-doc-sync.sh` + `Stop` hook | 2 h | med | **fixes "docs not updated"** |
| 6 | `.claude/agents/doc-router.md`, `gate-runner.md` | 1 h | low | keeps research out of the main window |
| 7 | `permissions.deny` Read rules + `claudeMdExcludes` | 20 min | low | removes phantom CLAUDE.md + grep noise |
| 8 | `InstructionsLoaded` logging, then prune per F8 | 1 h | low | evidence before cuts |

Sequence: **7** first (pure config, immediate effect), then **2 + 3** as one refactor
(they are the same move), then **5**.

Each is an independent branch. The one-open-stacked-branch cap
(`branch-stack-cap` in `pr-gates.yml`) means 2 and 3 must land as one branch, not two
stacked ones.

---

## Why this scales

- **Extendable** — a new subsystem is one new `.claude/rules/<area>.md`. Today it is a
  new Context Map row **plus** an `app/CLAUDE.md` paragraph **plus** a File Inventory
  row.
- **Flexible** — rules are *pointers*, not copies. `00-Context-Map.md` stays the single
  authority, so `check-context-budget.sh` and `check-context-map.sh` keep working
  unchanged, and there is no second place for a pack to drift.
- **Proportionate** — no MCP server, no RAG index, no plugin authoring. Net file count
  is roughly flat: +9 rules, +2 agents, +2 hooks, −636 lines of graphify (the 26 forked
  skill files are already gone).

## Explicitly not recommended

- **Do not** package this as an internal plugin. Plugins are for multi-repo reuse; a
  single repo does not earn the indirection.
- **Do not** build a graph MCP server. Grep over `graph.json` is already fast, free
  and deterministic.
- **Do not** add a `PreToolUse` hook blocking `Edit` until the pack docs have been
  read. Tempting, but it needs per-session read-state tracking and will false-block
  trivial edits. Path-scoped rules get most of the benefit deterministically with
  none of the fragility.
- **Do not** add detail to `00-Context-Map.md`. It is already the right size. The gap
  is enforcement, not content.

---

## Discovered work

Per the root `CLAUDE.md` invariant, captured rather than fixed. None of these were
touched by this report.

1. **Stale worktrees under `.claude/worktrees/`** — cleanup was in progress while this
   was written and is still partial. As of `main` @ `0c3f97e6`, with no open PR on the
   repo: `issue-345-graph-freshness` survives as a detached-HEAD directory after its
   branch (`fix/p3-constraint-naming`) landed as #431 and was deleted;
   `p4-dartbot-bias` holds `fix/p4-dartbot-bias-flatspots`, already merged and 0
   commits ahead, so its worktree is now a D293 violation; `b9-finishing-seam`
   (`test/b9-finishing-step-seam`) and `trivial-cleanup-2`
   (`docs/trivial-issues-cleanup-2`) each sit 1 commit ahead, unmerged, with no PR —
   the long-lived-divergence invariant. D312 (PR #435) found the *mechanical* reason
   this set accumulates and fixed it going forward — `superpowers:finishing-a-development-branch`
   claims cleanup only for worktrees under `.worktrees/` or `worktrees/` and leaves
   every other path to "the host environment", so nothing was ever going to remove a
   worktree at `.claude/worktrees/`. New worktrees live under `.worktrees/`; these four
   predate the move and still need disposing of by hand.
2. **`CLAUDE.md` § Knowledge Graph** instructs the agent it may "read it directly" for
   a 7.7 MB file — ~1.9M tokens. See F4.
3. **`/Users/levi.broeksma/Dev/dart-analytics-superpowers-plugin`** — a worktree
   *outside* `.claude/worktrees/` on branch `claude/superpowers-plugin-migration`
   (an ancestor of `main`, 0 commits ahead) carrying 34 staged-but-never-committed
   files: a complete earlier execution of this report's F1, based on `2f81bcd8`.
   Because it was never committed, the forks it deleted came back with the next
   checkout — the exact "restored via a worktree merge" symptom. D311 re-lands the
   change from current `main` (PR #435); the directory itself still needs disposing of.

---

## Caveats

- Token figures are `chars/4` estimates. Run `/context` in a live session for the
  authoritative startup number before and after any change.
- `omitClaudeMd` (F6) is documented but was **not** verified against the installed
  Claude Code version. Check before relying on it.
- The `Stop` hook in F5 and the `check-doc-sync.sh` heuristic are proposals, not
  tested scripts. Both need a trial run against recent merged PRs to calibrate the
  false-positive rate before being added to `run-all-gates`.

---

## Sources

All current Claude Code documentation, or blog posts dated on/after 2026-01-01.

| Source | Date | Used for |
| --- | --- | --- |
| [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) | current docs | verification loops, subagents for investigation, CLAUDE.md pruning |
| [How Claude remembers your project](https://code.claude.com/docs/en/memory) | current docs | 200-line target, `.claude/rules/` + `paths:`, `claudeMdExcludes`, `InstructionsLoaded` |
| [Set up Claude Code in a monorepo or large codebase](https://code.claude.com/docs/en/large-codebases) | current docs | per-directory vs path-scoped rules, `Read` deny rules, `Stop` hook for upkeep |
| [Extend Claude Code (features overview)](https://code.claude.com/docs/en/features-overview) | current docs | CLAUDE.md vs Rules vs Skills table, context-cost-by-feature, hooks-are-enforcement |
| [Skills](https://code.claude.com/docs/en/skills) | current docs | 500-line limit, progressive disclosure, `allowed-tools`, agents skip CLAUDE.md |
| [Hooks](https://code.claude.com/docs/en/hooks) | current docs | event list, `additionalContext`, `permissionDecision` |
| [The new rules of context engineering for Claude 5 generation models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) | 2026-07-24 | 80% system-prompt cut; over-constraining |
| [Steering Claude Code: when to use CLAUDE.md, skills, hooks, rules, subagents and more](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more) | 2026-06-18 | anti-pattern list; size guidance |
| [How Claude Code works in large codebases](https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start) | 2026-05-14 | layering; review configs every 3–6 months |
