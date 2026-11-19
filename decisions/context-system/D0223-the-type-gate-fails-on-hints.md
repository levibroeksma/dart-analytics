---
id: D0223
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, gate, CI]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The type gate fails on hints; done means 0 errors, 0 warnings, 0 hints

## Context and Problem Statement
`astro check`'s default `--minimumFailingSeverity error` printed hints and then exited zero, so three unused declarations had accumulated across `src/` and `tests/` while every task truthfully reported the gate green. Reporting a diagnostic that cannot fail anything trains agents to read the summary line as decoration. CI compounded it by running the bare binary rather than the package script, so hardening the script alone would not have reached the pipeline. The same pass fixed `npx fallow`, red on the baseline (F12) because `foldFiveOhOneState` breached the cognitive-complexity ceiling: two gates that could not go green had made `validate:app` unrunnable end to end, which is the condition under which a completion bar stops being one.

## Decision Drivers
* A diagnostic that cannot fail anything trains agents to read the summary line as decoration (Context).
* `validate:app` was unrunnable end to end while two gates could not go green, which is when a completion bar stops being one (Context).

## Considered Options
* Keep `astro check`'s default `--minimumFailingSeverity error`, which prints hints and exits zero (the state before this record).
* Harden only the `check` script. CI called the bare binary, so this alone would not reach the pipeline (Context).
* Run `astro check --minimumFailingSeverity hint` through `npm run check` and call that script from CI (chosen).

## Decision Outcome
Chosen option: "`npm run check` runs `astro check --minimumFailingSeverity hint`, so any hint-level diagnostic — an unused import, an unread parameter — exits non-zero, and `.github/workflows/quality.yml`'s Type gate invokes that script instead of calling `npx astro check` directly. The definition of done for `app/` work is that every step of `validate:app` exits zero, `npx fallow` included, and the type gate reports 0 errors, 0 warnings, 0 hints. The bar is stated in `app/CLAUDE.md` and the `validate-app` skill; the fix for a hint is to delete the dead declaration, never to suppress it.".

### Consequences
dead code cannot accumulate behind a passing gate. Every future task pays the cost of deleting unused declarations before it can claim done, and an agent removing the last use of an import must remove the import in the same pass. `--minimumSeverity` stays at its default so hints are still printed; only the failing threshold moved. The 71 clone groups `fallow dupes` reports (14.9% duplication) remain non-gating: `duplicates.threshold` is unset, `fallow dupes` exits zero on its own, and the deliberate `*-play.data.ts` duplication D215 accepted is untouched by this decision.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/package.json` defines `check` as `rm -rf .astro && astro check --minimumFailingSeverity hint`. The Type gate step in `.github/workflows/quality.yml` runs `npm run check`.

## Pros and Cons of the Options
### Default failing severity
* Bad, because three unused declarations accumulated across `src/` and `tests/` while every task reported the gate green.

### Harden the script only
* Bad, because CI would still run the bare binary and miss the change.

### Hint threshold through `npm run check`, used by CI
* Good, because dead code cannot accumulate behind a passing gate.
* Bad, because every future task pays the cost of deleting unused declarations before it can claim done.

## Evidence / More Information
Decided: 2026-08-21

* Commit `20ca5b31` (PR #152, 2026-08-21; the `app/package.json`, `quality.yml`, `app/CLAUDE.md` and `validate-app` skill diffs and the D223 block): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
