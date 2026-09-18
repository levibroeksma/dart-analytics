---
name: run-all-gates
description: Use before claiming any Dart Analytics task done that touched app/, database/, or docs/ — dispatches the right check-*.sh scripts and validate:app/database checklist by changed area and reports each script's pass/fail explicitly.
---

# Run All Gates

Identifies and runs the gate scripts that apply to what changed, and reports every result explicitly — the "identify the command that proves the claim, then run it" step `superpowers:verification-before-completion` demands. This skill is that skill's repo pairing (D312): it is what "the command that proves it" resolves to here, and what `superpowers:finishing-a-development-branch` Step 1 means by the test suite.

## Always run

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-worktree-location.sh
bash scripts/check-test-coverage.sh
bash scripts/check-doc-sync.sh
```

`check-doc-sync.sh` fails when the change set touches `database/migrations/`, `app/src/services/` or a domain subdirectory of `app/src/modules/` (`game`, `training`, `dartbot`, `stats`) with no edit under `docs/architecture/` or `decisions/`. It reads the change set the same way `check-test-coverage.sh` does — staged files mid-commit, otherwise the diff against the merge base with `origin/main` (override with `DOC_SYNC_BASE_REF`). `docs/superpowers/` does not satisfy it: specs and plans are non-canonical (D312). It is absent from `.husky/pre-commit` on purpose — mid-branch it would fail the code commit that precedes the docs commit.

`check-test-coverage.sh` reads the change set itself — staged files mid-commit, otherwise the diff against the merge base with `origin/main` (override with `TEST_COVERAGE_BASE_REF`). It fails when a runtime source file changed and no test importing it changed with it, so run it before the commit that would trip it, not after.

`check-skill-pointers.sh` asserts that every `.claude/skills/*/SKILL.md` and `.claude/rules/*.md` has a row in `00-File-Inventory.md`, and that every `superpowers:<name>` named in a live tracked Markdown file resolves under the installed plugin cache. That last check prints `SKIP` and passes when the cache is absent — CI installs no plugins, so it is a local-only check by design; the registration checks run everywhere.

`check-worktree-location.sh` fails when a worktree inside the repo root sits anywhere but `.worktrees/`, or when the retired `.claude/worktrees/` directory exists. A checkout *beside* the repo is out of scope — it is a separate working copy, not a task worktree. It also prints a non-fatal `WARN` for a `.worktrees/` worktree whose branch is already merged into `origin/main`: the prune signal D312 asked for, left advisory because worktrees are shared across concurrent sessions and another session's landed branch must not fail your commit. In CI there are no task worktrees, so it passes vacuously.

## If `app/` changed, also run

```bash
cd app && npm run validate:app && cd ..
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
bash scripts/check-game-wiring.sh
```

## If `database/` changed, also run

```bash
bash scripts/check-constraint-mirror.sh
```

Then work through the Validation Checklist in `database/CLAUDE.md` by hand (migration numbering, index rationale, spec sync) — it is not fully mechanized.

## If `decisions/` or `DECISIONS.md` changed, also run

```bash
bash scripts/check-decision-ids.sh
```

Durable id-integrity guard for the split ledger (uniqueness, no id regression against the 2026-08-02 baseline, `Supersedes:` targets resolve, `DECISIONS.md` stays a router, every migrated row hash-matches `scripts/decision-row-hashes.tsv`, every `decisions/**.md` file is registered in the router). Runs unconditionally in `quality.yml` CI (alongside the other doc gates), so a missed local run is still caught before merge — it is only absent from the local "Always run" list and `.husky/pre-commit` because it has nothing to say unless `decisions/**` itself changed, and pre-commit already runs on every commit for the 14 structural gates. `context-maintenance`'s decision-ledger step also calls this out directly when a new decision block is added; this entry covers the rest (e.g. re-filing an id between domain files).

## If only `docs/` changed

The "Always run" scripts above already cover doc consistency (context map, links, token budget). No additional scripts apply — also review `docs/CLAUDE.md`'s Editing Workflow by hand (canonical-doc-first, cascade to secondary docs), which is not mechanized. If the changed docs are under `decisions/` or `DECISIONS.md`, see the section above instead.

## Reporting

State each script's result (`OK` or `FAIL` and why) explicitly in the completion report. Do not summarize as "gates pass" without having actually run every applicable script in this session.
