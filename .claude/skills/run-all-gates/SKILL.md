---
name: run-all-gates
description: Use before claiming any Dart Analytics task done that touched app/, database/, or docs/ — dispatches the right check-*.sh scripts and validate:app/database checklist by changed area and reports each script's pass/fail explicitly.
---

# Run All Gates

Identifies and runs the gate scripts that apply to what changed, and reports every result explicitly — the "identify the command that proves the claim, then run it" step `verification-before-completion` demands.

## Always run

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
```

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

Durable id-integrity guard for the split ledger (uniqueness, no id regression against the 2026-08-02 baseline, `Supersedes:` targets resolve, `DECISIONS.md` stays a router, every migrated row hash-matches `scripts/decision-row-hashes.tsv`, every `decisions/**.md` file is registered in the router). Runs unconditionally in `quality.yml` CI (alongside the other doc gates), so a missed local run is still caught before merge — it is only absent from the local "Always run" list and `.husky/pre-commit` because it has nothing to say unless `decisions/**` itself changed, and pre-commit already runs on every commit for the 12 structural gates. `context-maintenance`'s decision-ledger step also calls this out directly when a new decision block is added; this entry covers the rest (e.g. re-filing an id between domain files).

## If only `docs/` changed

The "Always run" scripts above already cover doc consistency (context map, links, token budget). No additional scripts apply — also review `docs/CLAUDE.md`'s Editing Workflow by hand (canonical-doc-first, cascade to secondary docs), which is not mechanized. If the changed docs are under `decisions/` or `DECISIONS.md`, see the section above instead.

## Reporting

State each script's result (`OK` or `FAIL` and why) explicitly in the completion report. Do not summarize as "gates pass" without having actually run every applicable script in this session.
