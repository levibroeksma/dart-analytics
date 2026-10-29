# Edit-Time Rules — Design

Date: 2026-10-29. Status: draft for owner review.

## Intent

Agents drift from repo rules: they skip the reuse check, write a third copy instead of extracting a shared component/helper/type, ignore patterns, and use forbidden forms such as `x-bind:`. The rules exist, but reach the agent at the wrong moment — buried in long CLAUDE.md files or docs it may not load, and enforced only by gate scripts that run at the end (`run-all-gates`, CI), after the agent has built on the violation.

Goal: put the right rule in front of the agent **at the moment of the edit**, and block the edit when it breaks one. Secondary: stop each task piling avoidable tokens on top of the session baseline.

### Evidence (measured 2026-10-29)

- Fresh-session baseline: 65.4k tokens. Repo-controlled share ≈ 6k (root CLAUDE.md 4.9k, own skill descriptions ≈ 0.7k, hook text). The rest is harness: MCP tools 20.5k, system tools 18.4k, system prompt 11.6k, other skills. Baseline is not the lever.
- Per-task loads are the lever: context packs are 12–24k; `00-File-Inventory.md` is 200 KB (≈ 50k tokens) and `docs/CLAUDE.md` step 1 plus `context-maintenance` step 2 send agents to it; `08-Component-Inventory.md` is ≈ 11k.
- "Rule of three" is not written as a rule anywhere — only cited in decision reasons. `app/src/components/CLAUDE.md` has a reuse rule for markup only.
- `npx fallow dupes`: 4,275 duplicated lines (4.9%) across 88 files, heaviest in `app/src/lib/game/*-play.data.ts`, `*-setup.data.ts`, `rulesets/types.ts`. No `duplicates.threshold` in `app/.fallowrc.jsonc`, so dupes can never fail the gate (`scripts/fallow-gate.sh` says so).
- `x-bind:` is forbidden in three docs and rejected by `scripts/check-astro-conventions.sh` — but only when gates run.
- `graph-lookup` is description-triggered only; nothing invokes it before code is written. Its own text steers agents away from it for frontend work (`.astro` markup is not parsed).

## Goals

1. Path-matched convention checks run before every `Edit`/`Write` and **block** a violating edit; the agent fixes and retries in the same step (owner decision).
2. Before a new file is created in a reuse-relevant area, the agent is shown the closest existing matches and must consciously reuse or decline.
3. The rule of three is written once and mechanically backed: new duplication fails CI.
4. CLAUDE.md files and the docs workflow stop costing tokens that carry no rule.
5. One skill for the most-repeated drift-prone task: building a component.

## Non-goals

- Cutting the harness baseline (system prompt, tool schemas, connectors). Optional owner action only: disable unused connectors (e.g. Claude Docs) for this environment.
- Fixing the existing 4.9% duplication in this work. Each clone family becomes a `discovered-work` issue.
- New convention rules. Only existing gate scripts move to edit time; the one new written rule is the rule of three.
- Replacing context packs or the authority order.

## Anti-goals (failure even if it works)

- Hooks so slow edits feel sluggish (target: < 1 s per edit on a typical file).
- False blocks on legitimate edits with no way out — every block names the rule and the fix.
- A second definition of a rule. Hooks call the existing scripts; they never re-implement a check.
- Blocking during an in-progress fix of a pre-existing violation the agent didn't cause (see §1 "only new violations").
- Reintroducing cost: hook output must be short (violations only, no rule essays).

## Design

### 1. Edit-time gate (PreToolUse, `Edit|Write`, blocking) — owner decided: block

`.claude/hooks/edit-gate.sh` (name: builder's call), registered in `.claude/settings.json` under `PreToolUse` with matcher `Edit|Write`.

- Build the would-be file: `Write` → `tool_input.content`; `Edit` → current file with `old_string`→`new_string` applied (`replace_all` honoured). *(Claude's call)* Checks run against a shadow tree: a temp dir mirroring the target's repo-relative path (plus the sibling files a check reads, e.g. `types.ts` for `check-type-barrels.sh`), so path-keyed allow-lists like `ARBITRARY_ALLOW` in `check-style-tokens.sh` still match. The real file is never swapped in place.
- Run only the checks whose scope matches the target path:

  | Target | Checks |
  |---|---|
  | `app/src/**/*.astro` | `check-astro-conventions.sh`, `check-astro-class-composition.sh`, `check-style-tokens.sh` |
  | `app/src/**/*.ts` | `check-no-inline-comments.sh`, `check-type-barrels.sh` (if it can run per-file), `check-file-locations.sh` (path-only) |

  The table is a starting set; the builder confirms each script's scope from its header and may add others that are per-file and fast. Repo-wide-only checks stay at gate time.
- **Only new violations block**: compare violations on the would-be file against the current file; block only on ones the edit introduces. A new file has no baseline. *(Claude's call)* Key = script + violation message with line numbers stripped, compared as a multiset (count per key); a key whose count rises blocks.
- On violation: `hookSpecificOutput.permissionDecision: "deny"` with `permissionDecisionReason` = script output lines for the file + one line "fix and retry". On pass: exit 0, no output.
- Scripts that today scan the whole tree gain a file-argument mode that inspects only the given files (only `check-astro-conventions.sh` takes file args today); the default no-arg behaviour used by `run-all-gates`/CI is unchanged. *(Claude's call)* The < 1 s budget is per edit on a single typical file, two runs (before/after); a script that cannot meet it in file-arg mode stays gate-time only and is named in the PR.
- Must work locally and in cloud sessions (bash + python3 only).

### 2. Reuse lookup before a new file (PreToolUse, `Write`, new file only)

`.claude/hooks/reuse-lookup.sh`. Fires when the `Write` target does not exist and lies under `app/src/components/**`, `app/src/lib/**`, `app/src/modules/**`, `app/src/types/**`.

- Candidates:
  - `.astro`: rows from `docs/architecture/07-Frontend/08-Component-Inventory.md` matched on name tokens of the new file (grep, never a whole-file read into context).
  - `.ts`: `graphify-out/graph.json` nodes whose label matches the new file's name tokens or the names it exports (parsed from `content`); same query shape as the `graph-lookup` skill. *(Claude's call)* The graph lags the branch, so also `git grep` `app/src` for `export … <name>` of each exported name — covers helpers added earlier on the same branch.
- First `Write` to a new path → deny, reason = up to ~8 candidates (`name — path`) + "reuse one, or retry stating why none fits". Second `Write` to the same path in the same session → allow. State keyed by `session_id` + path in a temp file.
- No candidates → allow silently.

This is what puts the graph to use; the `graph-lookup` skill stays for ad-hoc questions and drops its "not for frontend" steer only where the hook now covers `.ts`.

### 3. Rule of three — written once, gated in CI

- `.claude/rules/reuse.md`, `paths: ["app/src/**"]`, ≤ 15 lines: the third occurrence of the same markup shape, type, or logic block is never written — extract a shared component/helper/type first and migrate the existing two; reuse checks start at `08-Component-Inventory.md` and the graph. Cite the decision id.
- New decision recording the rule and the gate, in the domain file `DECISIONS.md`'s routing table assigns to cross-cutting app conventions (the rule spans `components/`, `lib/`, `types/` — not frontend only); builder reads the routing table to pick it.
- *(Claude's call)* A percentage threshold cannot guarantee "a new clone group fails" (small clones hide under it; growth dilutes it). The gate is a **baseline diff** instead: CI runs `fallow dupes` (JSON) on the PR head and on the merge base and fails on any clone group present on head and absent on base. Builder confirms fallow's JSON output supports stable group identity (e.g. by file set + fingerprint); if it cannot, fall back to failing when the clone-group count rises. `duplicates.threshold` may additionally be set to the current percentage as a coarse floor.
- Backlog: one `discovered-work` issue per fallow clone family (13 at measure time), via `capturing-discovered-work`. Not fixed here.

### 4. Slimmer rule files

- Root `CLAUDE.md` → target ≈ 1.5k tokens: keep invariants as one-line rules; move provenance tails (`(2026-…, Dxxx)`) and long rationale out — the decision ids already hold the why. The migration carve-out and worktree mechanics move to `.claude/rules/` (`paths: ["database/migrations/**"]`) and to a skill respectively; builder picks the exact split.
- Nested CLAUDE.md files: same treatment — rules stay, dated history goes. Directory-scoped files are already lazily loaded, so do **not** mass-migrate them into `.claude/rules/`; use rules only for cross-cutting globs (e.g. `**/*.astro` across `components/` and `pages/`).
- `docs/CLAUDE.md` step 1 and `context-maintenance` step 2: "grep `00-File-Inventory.md` for the row; Read with offset/limit; never read it whole".
- Note from official docs: path-scoped rules reload only when a matching file is touched again after `/compact`; anything that must survive compaction stays unscoped.

### 5. Skill: `building-a-component`

`.claude/skills/building-a-component/SKILL.md`, `paths:` on `app/src/components/**` and `app/src/pages/**`. Steps: inventory lookup → reuse or justify → pattern checklist (Alpine shorthand, `x-cloak`, `cn()`, tokens, `Button.astro`, spread binding) as pointers to the canonical docs, not copies → register the new component in `08-Component-Inventory.md`. The edit gate (§1) enforces; the skill guides.

## Constraints

- Decisions are append-only; reversals cite `Supersedes:`.
- New `.claude/rules/*.md` and skills need `00-File-Inventory.md` rows (`check-skill-pointers.sh`); budgets per `check-context-budget.sh`.
- `context-maintenance` and `run-all-gates` before done; one branch, PR to `main`.
- Hooks: no network, no `npm` install, bash + python3 only.

## Builder's latitude

Hook names and file layout; temp-file and state mechanics; exact check-to-path table after reading each script; candidate matching heuristic and cap; exact CLAUDE.md split; delivery order (suggested: §1 → §3 → §2 → §4 → §5, each a separate PR is acceptable).

## Success

- Writing `x-bind:` in an `.astro` file is refused before it lands.
- A PR adding a clone group fails CI.
- Creating a new component/helper/type shows existing matches first.
- Root CLAUDE.md ≈ 1.5k tokens; no task instruction reads the File Inventory whole.
