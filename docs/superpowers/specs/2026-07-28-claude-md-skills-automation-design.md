# Design — CLAUDE.md → Skills & Automation Gates

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-28.
> Scope: mechanize prose-only rules into gate scripts, move gates left (pre-commit), extract multi-step procedures out of always-loaded `CLAUDE.md` files into skills.
> Relates to: `/tmp/.../claude-md-skills-automation-report.md` (the audit this design implements — not committed, chat-delivered). Every phase below maps 1:1 to that report's §3–§6 and §7 priority order.

---

## 1. Background & Motivation

`DECISIONS.md`'s own history (D113, D147, D148, D149, D141) shows one recurring shape: a rule gets written in prose ("mandatory", "Non-Negotiable", "Hard Invariant"), gets obeyed by attention, and gets violated the moment attention lapses — one PR into a branch stack, one schema consolidation, one refactor under time pressure. Every one of those was caught after the fact, in PR review or a post-merge audit, never before.

Two concrete gaps cause this:

1. **Feedback latency.** All 7 code-correctness `scripts/check-*.sh` gates that exist today run only in CI (`quality.yml`), after push. `.husky/pre-commit` runs only Prettier (`lint-staged`).
2. **Prose with no gate.** The CHECK-constraint mirror rule (D149), the stacked-branch cap (D147), the tsconfig/vitest alias-sync rule (D113), the TS inline-comment ban, and the style-token non-negotiables are all stated as binding but nothing fails a build if they're violated.

A secondary, lower-severity problem: procedural prose (the Context Maintenance 8-step gate, the `validate:app` sequence, the TDD red-green-refactor steps) is duplicated in always-loaded `CLAUDE.md` files instead of living once in an on-demand skill, costing context budget on every task regardless of whether the procedure is relevant.

---

## 2. Decisions (brainstorming)

| Topic | Choice |
| ----- | ------ |
| Spec structure | One combined, phased spec (not one spec per workstream) |
| Local hook timing | Pre-commit (not pre-push, not a fast/slow split) |
| Context Maintenance extraction | New standalone `context-maintenance` skill (not folded into `finishing-a-development-branch`) |
| Branch-stack gate (D147) | CI job using GitHub MCP/`gh` against remote PR state (not a local script, not deferred) |
| Test-repointing gate (D148) | Flag-only CI step (non-blocking PR comment), not left prose-only |
| Doc edits (CLAUDE.md/AGENT.md/context-map) | Included in this spec's phases, not a fast-follow |
| `@icons`/`@layouts` tsconfig↔vitest gap | Add both to `vitest.config.ts`'s `resolve.alias` (close the real drift); `@styles` stays allowlisted (CSS-only path, structurally non-importable from `.ts`) |

---

## 3. Scope

**In:**

- 4 new `scripts/check-*.sh` gates: `check-alias-sync.sh`, `check-constraint-mirror.sh`, `check-no-inline-comments.sh`, `check-style-tokens.sh`.
- 2 new CI-only `checks.yml` jobs: branch-stack cap, test-repointing heuristic.
- `.husky/pre-commit` extended to run the 7 existing structural gates, not just Prettier.
- 2 new skills: `context-maintenance`, `validate-app`.
- In-place edit to the existing project-local `verification-before-completion` skill, adding a Dart-Analytics TDD addendum.
- New `run-all-gates` skill dispatching the right script set by changed area.
- Corresponding trims to root `CLAUDE.md`, `app/CLAUDE.md`, both `AGENT.md` mirrors, and new rows in `00-Context-Map.md`'s mechanical-guards table.
- `vitest.config.ts` alias additions for `@icons`/`@layouts`.
- One `DECISIONS.md` entry per landed phase.

**Out (this spec):**

- Full semantic verification that a Zod bound is numerically identical to its SQL `CHECK` — the constraint-mirror gate proves an acknowledged mirror exists, not bound-for-bound equality (same limitation `check-refinement-coverage.sh` already documents for itself).
- A hard-failing (blocking) version of the test-repointing gate — it stays a human-review nudge, since legitimate test updates will also trip the heuristic.
- Any change to `quality.yml`'s existing 8 jobs — they remain as the CI backstop for `--no-verify` commits or machines without hooks installed.
- Retiring or renaming any existing script.

---

## 4. Phase 1 — Pre-commit wiring

`.husky/pre-commit` changes from:

```sh
cd app && npx lint-staged
```

to:

```sh
cd app && npx lint-staged
cd .. && bash scripts/check-file-locations.sh \
       && bash scripts/check-agent-mirrors.sh \
       && bash scripts/check-astro-class-composition.sh \
       && bash scripts/check-astro-conventions.sh \
       && bash scripts/check-game-engines.sh \
       && bash scripts/check-refinement-coverage.sh \
       && bash scripts/check-type-barrels.sh
```

`&&`-chained: first failure stops the commit, prints that script's own `FAIL:` output. No wrapper script needed. Verified clean against the current tree (all 7 pass as of this design's writing).

`check-context-map.sh` / `check-doc-links.sh` / `check-context-budget.sh` stay CI + `context-maintenance`-skill-only — doc-consistency checks, not code-correctness, deferred to the completion gate where they already run.

**Doc edit:** `app/CLAUDE.md` Formatting section gains a line noting pre-commit now runs the 7 structural gates in addition to Prettier.

---

## 5. Phase 2 — New check scripts

### 5.1 `check-alias-sync.sh`

Parses `tsconfig.json`'s `compilerOptions.paths` keys (python3 `json.load`, strip `/*`) and `vitest.config.ts`'s `resolve.alias` keys (regex-scan of quoted keys inside the `alias: { ... }` block — same non-executing-source technique the existing scripts use). Diffs the two sets, fails on asymmetry.

Ships with a documented allowlist (header comment, same convention as `check-refinement-coverage.sh`'s blind-spots section) for aliases that structurally can't resolve in a Vitest context:

```
ALLOWLIST_TSCONFIG_ONLY="@styles"   # CSS-only path; never a valid .ts import target
```

`@icons` and `@layouts` are **not** allowlisted — they get added to `vitest.config.ts`'s `resolve.alias` as part of this phase (real drift, closed outright, costs nothing: two more `path.resolve()` lines).

### 5.2 `check-constraint-mirror.sh` (closes D149)

Extracts every `chk_*` constraint name from `database/migrations/*.sql`. Requires a matching `// MIRRORS: chk_x` anchor comment in the shared batch request schema (`app/src/pages/api/sessions/types.ts`, per D149's "mirrored once" rule). Fails on any `chk_*` with no anchor.

Proves "someone declared and bounded this constraint," not numeric equality — same honestly-stated limitation as `check-refinement-coverage.sh`. Real enforcement is a companion `app/tests/pages/api/sessions/constraint-mirror.test.ts` that `safeParse`s the declared boundary values and asserts the schema's accept/reject agrees with the DB constraint's, mirroring the existing `refinement-contract.test.ts` pattern.

### 5.3 `check-no-inline-comments.sh`

Adapts `check-type-barrels.sh`'s comment-stripping tokenizer to instead track brace depth and flag any `//` or `/* */` at depth > 0 (inside a function/method body) under `app/src/**/*.ts`, excluding `app/tests/` and `app/scripts/` (per the existing rule's stated scope) and exempting `fallow-ignore-next-line` / `///`.

Stated blind spot (header comment): brace-depth tracking is syntax-position based, not AST-based — a comment inside a top-level object/array literal (not a function body) could false-positive. Rare in this codebase's style; documented rather than silently accepted.

### 5.4 `check-style-tokens.sh`

New script, pure grep, three rules across `app/src/**/*.{astro,css}`:

- No `font-medium` (use `font-normal`/`font-semibold`/`font-bold`).
- No `{...rest}` spread (use `{...props}`).
- No raw palette utilities `bg-bg*` / `text-fg*` (semantic tokens only).

**Doc edit:** `app/CLAUDE.md`'s Style non-negotiables gain a one-line pointer to `check-style-tokens.sh`; `00-Context-Map.md`'s mechanical-guards table gains all 4 new scripts.

---

## 6. Phase 3 — CI-only gates (remote state)

### 6.1 Branch-stack cap (closes D147)

New `checks.yml` job, not a `scripts/*.sh` (needs remote PR state a local script can't see reliably). Triggers on `pull_request: [opened, synchronize]`. Uses GitHub MCP (`list_pull_requests` / `pull_request_read`) to enumerate open PRs, builds the base-branch graph, fails if any PR's base branch is itself the head of another open PR targeting a third branch — the exact 4-deep-stack shape from the incident (`main ← #41 ← #42 ← #43 ← #48`).

### 6.2 Test-repointing heuristic (closes D148, non-blocking)

New `checks.yml` job. Diffs `app/tests/**` against the PR's base branch, flags any hunk where an assertion literal (`.toBe(`, `.toEqual(`, `expect(...)` args, fixture values passed to `parse(`) changed but the enclosing `describe`/`it` title text in the same file did not. Posts a PR comment (GitHub MCP `add_issue_comment`) listing flagged spots; does **not** fail the job — legitimate test updates will also trip this, so it's a directed nudge for human review, not a hard gate.

**Doc edit:** root `CLAUDE.md`'s Hard Invariants gain a one-line pointer from the branch-stack cap and test-repointing rules to these two `checks.yml` jobs by name.

---

## 7. Phase 4 — Skill extraction

### 7.1 `context-maintenance` (new skill)

`.claude/skills/context-maintenance/SKILL.md`, frontmatter `description` tuned to trigger on "before claiming a task done" / "update CLAUDE.md" / "refresh knowledge graph." Body holds the current 8 numbered Context Maintenance steps verbatim, with step 5 changed to invoke `run-all-gates` (Phase 5) instead of restating the script list.

Root `CLAUDE.md`'s Context Maintenance section shrinks to the invariant only: *"A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works. Before claiming any task done, run the `context-maintenance` skill."*

### 7.2 `validate-app` (new skill)

`.claude/skills/validate-app/SKILL.md` wraps `npm run validate:app` and states the mid-task gate condition (services/repositories/middleware/shared-client code touched mid-task → also run `npx fallow` + `npm run check` before claiming that sub-step done). `app/CLAUDE.md`'s "Validation Standard Procedure" section shrinks to the bare command plus a pointer to the skill for the full sequence and the mid-task trigger condition.

### 7.3 TDD fold into `verification-before-completion`

In-place edit to the existing project-local `.claude/skills/verification-before-completion/SKILL.md`: add a "Dart Analytics: red→green→refactor" section with this repo's 5-step cycle (write failing test → `npm test` confirm right failure → minimal implementation → `npm test` green → refactor only with tests green) and the Vitest commands.

`app/CLAUDE.md`'s TDD section keeps only the rules that are not procedure: tests live under `app/tests/` mirroring `app/src/`, never colocated; Vitest mocks only, no real network/Neon calls in unit tests; `.astro` variant/branching logic stays inline in frontmatter (D101), not extracted for testability. A pointer to `verification-before-completion` replaces the 5 numbered steps.

**Doc edit:** `AGENT.md` mirrors of root and `app/CLAUDE.md` updated identically; `00-Context-Map.md` registers both new skills alongside the existing `.claude/skills/graphify/SKILL.md` entry.

---

## 8. Phase 5 — `run-all-gates` skill

`.claude/skills/run-all-gates/SKILL.md`: dispatches on which top-level area changed (`app/`, `database/`, `docs/`) —

- Always: `check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`, `check-agent-mirrors.sh`, `check-file-locations.sh`.
- `app/` touched: `npm run validate:app` (from `app/`) plus `check-astro-class-composition.sh`, `check-astro-conventions.sh`, `check-game-engines.sh`, `check-refinement-coverage.sh`, `check-type-barrels.sh`, `check-alias-sync.sh`, `check-constraint-mirror.sh`, `check-no-inline-comments.sh`, `check-style-tokens.sh`.
- `database/` touched: the Validation Checklist in `database/CLAUDE.md`, plus `check-constraint-mirror.sh`.
- Reports every script's pass/fail explicitly — this is the "identify the command that proves the claim" evidence `verification-before-completion` already demands, given something concrete to point at.

Depends on Phases 1–4 existing (references scripts and the `context-maintenance` skill created in those phases) — lands last.

---

## 9. Rollout & validation approach

Phases land as separate small commits/PRs, matching this repo's existing granular-commit convention (visible in `git log`):

1. Phase 1 first — zero new scripts, immediate payoff, already verified clean against the current tree.
2. Phase 2 scripts one at a time — each verified two ways before landing: passes cleanly on the current tree (post `@icons`/`@layouts` fix for 5.1), and fails with the expected message against a deliberately broken fixture. Same bar the existing scripts were held to (their headers cite the real incident that motivated them).
3. Phase 3 CI jobs.
4. Phase 4 skills.
5. Phase 5 last (depends on everything above).

No new error-handling layer for pre-commit: scripts already print their own `FAIL:` lines and exit non-zero. `git commit --no-verify` remains the existing escape hatch, still caught by the unchanged CI backstop.

Each phase gets its own `DECISIONS.md` entry per the existing granular D-numbering convention and its own Context Maintenance pass, run via the `context-maintenance` skill once Phase 4 lands, via the current root `CLAUDE.md` prose procedure before then.

---

## 10. Success criteria

- All 7 existing + 4 new `scripts/check-*.sh` gates pass locally at commit time, not just in CI.
- `check-alias-sync.sh`, `check-constraint-mirror.sh` each catch a seeded fixture violation before landing (proof of correctness, not just clean-tree silence).
- Root `CLAUDE.md` and `app/CLAUDE.md` word counts drop measurably (Context Maintenance + Validation Procedure + TDD steps removed, replaced by one-line pointers).
- `00-Context-Map.md`'s mechanical-guards table lists all 11 scripts; both new skills are registered.
- `check-branch-stack` and test-repointing jobs both fire correctly on a real PR before this design is considered done (not just reviewed as code).
