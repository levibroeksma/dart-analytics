---
id: D0332
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, skill, gate, CI, format, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The fallow gate is wrapped so a failure names the function that actually breached a threshold

## Context and Problem Statement
fallow's own summary line reads as a diagnosis and is not one. `Failed: … health (M above threshold): start with <file>` names entry 1 of the `Refactoring targets` quick-win list, which is ranked by ROI against churn and coupling and is computed independently of the threshold gate — so the file it names routinely has no violation at all. Reproduced on 2026-09-19 against the then-current fallow: a seeded 22-line probe in `src/modules/game/` with one cognitive-16 function was the sole entry in `health --format json`'s `findings`, while the `Failed:` line said `start with src/modules/stats/visit-stats.module.ts` (pri 15.7, zero violations) — and a second probe at cognitive 39 made the same line correct, confirming the line tracks the ROI ranking rather than the gate. #292 records what that costs: the discovering session spent an extended pass deduplicating 15 unrelated clone groups across 3 files and 9 tests before finding the `findings` array. Documenting the workaround was the alternative considered and rejected — the trap fires precisely when an agent is reading a red gate's output under time pressure, which is when a prose rule elsewhere is least likely to be recalled; the wrapper puts the answer on the same screen as the misleading line. Patching fallow was never available: it is invoked through `npx` and is not a declared dependency of `app/package.json`, so the repo has no copy to fix.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`npx fallow` is no longer invoked directly by any gate. `scripts/fallow-gate.sh` runs it from `app/`, passes its stdout/stderr through unmodified and exits with its exit code; on a non-zero exit it re-runs `npx fallow health --format json` and prints that report's `findings` array — path, function name, line, which threshold was exceeded, and the cyclomatic/cognitive/CRAP/param/line numbers — followed by the four thresholds from `summary`. When `findings` is empty the wrapper says so, because the failure is then a different gate (dead code, dependencies). `app/package.json`'s `validate:app` and `quality.yml`'s Stale-usage gate call the wrapper; `app/README.md`, `database/README.md`, `03-Engineering-Workflow.md`, `docs/architecture/README.md`, `app/CLAUDE.md` and the `validate-app` skill are repointed at it, and the skill gains the rule that the `start with` filename is never to be chased. Closes #292.".

### Consequences
a failing run now invokes fallow twice. The second run is `health` only and measured at ~2s on this tree, and it happens exclusively on the failure path, so a green gate is unchanged. The wrapper is a third place — after the script and the CI step — that encodes `app/` as fallow's working directory; it derives that from `git rev-parse --show-toplevel`, so a session anywhere in the repo can call it, but a repo restructure moving the app root would have to change it. The buried half of this knowledge stays buried: `decisions/game-engine.md` D232's Consequences paragraph already recorded the same trap in 2026-08-23 ("fallow's `start with <file>` line names its top refactoring target, not the failing item") and nothing acted on it for three weeks, which is the argument for a mechanism over a sentence. The `dupes (N clone groups)` clause of the same `Failed:` line is still misleading and still untouched here: `.fallowrc.jsonc` sets `duplicates.threshold: 0`, meaning no limit, and a green run on this tree reports 83 clone groups and exits 0 — so clone counts appear under the word "Failed" while never being able to cause one. The wrapper says nothing about that, and a future reader who trusts the line will lose the same time on dupes that #292 lost on health — filed as #504 rather than folded in here, because the scope this task was given was the health-gate filename.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
