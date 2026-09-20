# Agent Operating Manual — Dart Analytics

> Router file — auto-loaded every session. Every rule lives in exactly one place; this file tells you where. (2026-07-15)

---

# Project

Personal darts scoring app with long-term progression tracking. Architecture-first: design before implementation.

**Stack:** Astro.js, TypeScript, Alpine.js, PostgreSQL (Neon), Cloudflare Workers API (in `app/`).

**Principle:** Store what happened. Derive what it means.

---

# Behaviour Constraints

- Extreme concision: all interactions, commits, plans.
- Sacrifice grammar & pleasantries for brevity.
- Prefer short words; avoid polysyllabic synonyms.
- No recaps; go straight to the point.

---

# Output Acknowledgment

- No acknowledgment sentences on initial responses.
- Reply "On it." or "Starting search." then execute immediately.
- Forbidden: transitional phrases ("I can help...", "Let me...", etc.).

---

# Superpowers Skills

Process skills come from the official `superpowers` plugin (`superpowers@claude-plugins-official`, declared in `.claude/settings.json`) and are invoked under their `superpowers:` prefix. They are not vendored into `.claude/skills/` — that directory holds only this repo's own skills. Never copy a plugin skill into the repo to edit it; carry the deviation in the paired file below instead, which is always a *delta* — never a copy of upstream text that can drift. (2026-09-18, D311)

Where a plugin skill and this repo disagree, load both — the plugin skill for the procedure, the pairing for what this repo does differently:

| Plugin skill | Also load | The deviation |
| ------------ | --------- | ------------- |
| `superpowers:finishing-a-development-branch` | `finishing-a-dart-branch` skill | Step 4's menu is skipped — Option 2 (push + PR), every time |
| `superpowers:test-driven-development` | `app/CLAUDE.md` §Test-Driven Development | the repo's red→green→refactor procedure and `npm test` commands (D99) |
| `superpowers:verification-before-completion` | `run-all-gates` skill | which command actually proves a claim here |
| `superpowers:executing-plans`, `superpowers:subagent-driven-development` | `capturing-discovered-work` skill | incidental findings become GitHub issues; they are never fixed in the same pass |
| `superpowers:brainstorming` | `authoring-game-rules` skill | for a game, exercise, routine or trivia tool, the rules document is authored first and is brainstorming's *input* — this skill owns the V1 cut test and the defer list, brainstorming still owns the spec (D322) |

`superpowers:brainstorming` and `superpowers:using-git-worktrees` run as written, unmodified — see the commit and worktree invariants below, which were aligned to them rather than the reverse. (2026-09-18, D312)

---

# Context Loading Protocol

1. Open `docs/architecture/00-Context-Map.md` — the router.
2. Find your task type in its Context Packs table and load exactly those files.
3. Do not preload anything else. Escalate to `docs/architecture/00-File-Inventory.md` only when the pack demonstrably lacks the answer.

The authority order for conflicts is defined once, in the context map. Docs win over code.

---

# Knowledge Graph (graphify)

A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built with the `graphifyy` CLI — PyPI package `graphifyy`, repo `Graphify-Labs/graphify`).

- **Consult the committed file before broad grep/exploration.** `graphify-out/graph.json` is in the repo and queryable with the tools every session already has — grep it for an entity, or use the `graph-lookup` skill's recipe. Never read it whole: 7.7 MB is roughly 1.9M tokens, and `.claude/settings.json` denies the read (D314). Use it to orient across app code + SQL schema + docs, then read the specific files it points to.
- **The CLI is optional.** Where `graphify` is installed, `graphify query "<question>"`, `graphify path "<A>" "<B>"` and `graphify explain "<entity>"` are the nicer interface to the same file. It is not present in the session container, so nothing in this manual depends on it — see `.claude/skills/graph-lookup/references/building.md` for a local install.
- **The graph is a map, not authority.** On any conflict, the authority order in `00-Context-Map.md` wins; verify a graph answer against the cited file before acting.
- **Freshness is CI-owned; landing it is one human merge**: `.github/workflows/graph.yml` rebuilds the graph on every merge to `main`, pushes it to `chore/graph-refresh` and opens a PR. The bot's commit is unsigned and `main`'s ruleset requires verified signatures, so only a bypass actor can merge it — no amount of approval lets it land itself (D289). If the PR cannot be opened at all, the workflow files a `graph: refresh PR could not be opened` issue rather than passing silently (D287). Either way it is not a local completion-report item.
- **Scope caveat:** `.astro` files are only partially parsed (no tree-sitter grammar); TS/JS/SQL/Markdown are fully covered.

---

# Hard Invariants

- Completed gameplay is immutable; corrections create new records.
- Store facts; statistics live in views (`v_*`) only — never persisted.
- An engine-only task must still prove its state shape can be persisted: name the capture/input mode, the stage type, and the `turns`/`darts` mapping in the spec before implementation. Deferring persistence is allowed; choosing a state shape that cannot express it is not. (2026-07-26)
- IDs: UUIDv7 for domain entities (app/Worker generated), SMALLINT for seeded lookups. The database never generates ids.
- Runtime tables never FK-reference templates; configuration is copied as a snapshot.
- Never modify applied migrations (`0001`–`0041`); new schema change = new numbered migration + spec update. The one carve-out (D344): a migration may be corrected in place while it is still unmerged **and** both `npm run db:status` and `npm run db:status:prod` report it pending — proof, not judgement. A session with no `DATABASE_URL` cannot run that proof and so cannot use the carve-out; inferring "unapplied" from that silence is what the rule forbids. `0040` and `0041` were applied on 2026-09-20, so the whole chain through `0041` is now closed to in-place edits. (2026-09-19; rewritten 2026-09-20, D344)
- Reads via views, writes to runtime tables in transactions; gameplay is uploaded in batches.
- Every task uses a dedicated branch; never merge to `main` directly; do not commit unless the user asks. A completed task's branch is integrated into `main` via PR promptly — long-lived divergence from `main` is a defect.
- One exception to "do not commit unless the user asks": the design doc `superpowers:brainstorming` produces. That skill runs unmodified — it writes the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and commits it, without asking. That tree is non-canonical source material (see the context map), so no File Inventory row is owed per spec. Nothing else commits itself. (2026-09-18, D312)
- At most one open task branch may target another task branch. A third stacked branch means the first must land, or the work merges into one branch. Mechanically enforced on every PR by the `branch-stack-cap` job in `.github/workflows/pr-gates.yml`. (2026-07-26; gate added 2026-07-28)
- Task branches may be worked in a git worktree under `.worktrees/` or checked out directly in the main working copy; both are allowed. A worktree is cleaned up once its branch lands — a worktree left behind after its PR merges is a defect. The path is `.worktrees/` because that is one of the two prefixes `superpowers:finishing-a-development-branch` claims ownership of at cleanup; anything else it leaves in place, so the old `.claude/worktrees/` silently defeated the rule. `scripts/check-worktree-location.sh` enforces the path and warns when a merged branch still holds one. (2026-09-17, D293; path moved 2026-09-18, D312, supersedes D102; gate added 2026-09-18, D319)
- Start a task worktree by launching the session in one: `claude --worktree <name>`. The `WorktreeCreate` hook declared in `.claude/settings.json` (`.claude/hooks/worktree-create.sh`) places it at `.worktrees/<name>` branched from `origin/main`, so the mandated path is what the tool does by default rather than something to correct afterwards. A name shaped like `chore/foo` becomes that branch verbatim; a bare name becomes `worktree-<name>`; reusing a name reopens the existing worktree. Creating one by hand with `git worktree add .worktrees/<name> -b <branch> origin/main` stays valid. (2026-09-19, D324)
- Entering a worktree mid-session costs an approval prompt every single time, and no permission rule or "don't ask again" suppresses it — Claude Code always asks before entering a path outside `.claude/worktrees/`, which is the path this repo forbids. So launching into the worktree is the default and `EnterWorktree`'s `path` argument is the fallback for a worktree that already exists. Do **not** use `EnterWorktree`'s `name` argument. (2026-09-18, D319; 2026-09-19, D324) The `Read(./.worktrees/**/*)` deny in `.claude/settings.json` resolves against the session's current directory, so it blocks worktree files only while the session still sits in the main copy — and it covers Bash `cat`/`head`/`sed` too. Entering with `path` is what lifts it; `cd`-ing into a worktree, or reading one from the main copy, hits the deny by design. (2026-09-18, D320)
- Minimal diffs; validate and fix docs with targeted edits — never regenerate them.
- When a test's subject is removed or migrated, the test must be deleted or re-pointed at the same guarantee — never re-pointed at a different input so it keeps passing. A green suite after a constraint is removed is a failure to detect, not evidence of safety. (2026-07-26)
- Discovered work is not a work item. Anything you notice that the task did not ask you to change — a bug, a stale doc, a contradicting rule, a dead file — is captured as a GitHub issue (`discovered-work` label) per the `capturing-discovered-work` skill, and named in the completion report; it is never fixed in the same pass. Acting on one requires explicit user permission, always. This governs *incidental* discovery only: work a task step names, including adjacent edits that work genuinely requires, proceeds as normal. (2026-08-19; GitHub-issue mechanism 2026-09-13, D273, supersedes D214)

---

# Context Maintenance (mandatory, every task)

The context system is part of every deliverable. Before claiming any task done, run the `context-maintenance` skill.

A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works. (procedure moved to `.claude/skills/context-maintenance/SKILL.md`, 2026-07-28)

Decisions are append-only and domain-scoped: never edit or delete an existing block in `decisions/**`; a reversal is a new decision citing `Supersedes:` in the domain file it belongs to, per `DECISIONS.md`'s routing table. (2026-08-02)

---

# Forbidden Actions

(These are the standalone prohibitions; the Hard Invariants above are equally binding.)

- Expose raw database tables through the API
- Generic EAV / polymorphic FK patterns for gameplay
- Force-push to main/master; commit secrets (`.env`, credentials)

---

# Where Everything Lives

| Need | File |
| ---- | ---- |
| Context packs, authority order | `docs/architecture/00-Context-Map.md` |
| File inventory (escalation only) | `docs/architecture/00-File-Inventory.md` |
| Why a decision was made | `DECISIONS.md` (router); domain files live in `decisions/**` |
| Something noticed but not fixed | GitHub issue, `discovered-work` label — see `.claude/skills/capturing-discovered-work/SKILL.md` |
| App implementation rules + validation procedure | `app/CLAUDE.md` |
| Condensed database rules | `docs/architecture/05-Database/10-Database-Agent-Guide.md` |
| Pre-spec game/exercise/routine/trivia rule notes (non-canonical, permanent) | `docs/game-rules/README.md`; authored via the `authoring-game-rules` skill |

---
