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

## If only `docs/` changed

The "Always run" scripts above already cover doc consistency (context map, links, token budget). No additional scripts apply — also review `docs/CLAUDE.md`'s Editing Workflow by hand (canonical-doc-first, cascade to secondary docs), which is not mechanized.

## Reporting

State each script's result (`OK` or `FAIL` and why) explicitly in the completion report. Do not summarize as "gates pass" without having actually run every applicable script in this session.
