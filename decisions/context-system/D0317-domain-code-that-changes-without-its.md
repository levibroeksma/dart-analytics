---
id: D0317
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, gate, husky, pre-commit, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Domain code that changes without its docs fails, on paths calibrated against history

## Context and Problem Statement
"a change that leaves the docs stale is incomplete" has been a root `CLAUDE.md` rule since the context system was built, and nothing ran it. The trigger paths are calibrated rather than asserted: over the last 80 first-parent merges on `main`, the research report's candidate patterns produced 4 hits of which 3 were false positives — all three the same `app/src/modules/ui/wake-lock.module.ts`, a browser-API shim that owes no architecture entry and had in fact written a spec and a plan on each occasion. Excluding `app/src/modules/ui/` leaves 14 merges touching a trigger path, exactly 1 failing, and that one — a new `modules/training/` summary module with no document anywhere — genuinely owed docs. The confirmation run at implementation time found the three wake-lock merges had aged out of the 80-merge window, so it was widened to 100 and 120 merges: the untuned patterns reproduce all three false positives there, the tuned trigger holds zero at every window, and every tuned hit touches surface the canonical docs do describe. A threshold nobody measured is a threshold nobody can defend when it fires.

## Decision Drivers
* Docs are not updated at task end. The research report traces this to context rules that are advisory prose (spec, Problem).
* A rule whose enforcement path does not run is indistinguishable from no rule, so the gate has no advisory mode (spec, Branch 4).

## Considered Options
* Keep the root `CLAUDE.md` docs rule as prose (the state before this record; Context).
* Trigger on all of `app/src/modules/`, as the spec's candidate patterns did. The plan's calibration found 4 hits, 3 of them false positives (plan, The calibration is already done).
* Count `docs/superpowers/` as satisfying the gate. The plan rules this out because specs and plans are non-canonical (Task 1).
* Wire the gate into `.husky/pre-commit`. The spec rules this out because the gate diffs against the merge base and would misfire mid-branch (Branch 4).
* A hard-failing gate on calibrated paths plus a `Stop` hook (chosen).

## Decision Outcome
Chosen option: "`scripts/check-doc-sync.sh` fails any change set that touches `database/migrations/`, `app/src/services/`, or `app/src/modules/{game,training,dartbot,stats}/` without also touching `docs/architecture/` or `decisions/`. `docs/superpowers/` does not satisfy it. It reads its change set exactly as `check-test-coverage.sh` does — staged files mid-commit, otherwise the diff against the merge base with `$DOC_SYNC_BASE_REF` — and is wired into `run-all-gates` §Always run and `quality.yml`'s structure job, but deliberately not `.husky/pre-commit`. `.claude/hooks/context-drift.sh` runs on `Stop`, shells out to the same script, and produces output only when it fails.".

### Consequences
the gate hard-fails from day one, with no advisory mode. D312's own finding was that a rule whose enforcement path does not run is indistinguishable from no rule, and a gate that cannot fail would reproduce exactly that. The cost is that a genuine "this changed nothing any doc describes" case now has to be argued rather than assumed — the remedy is to narrow `TRIGGER` in its own change with the calibration re-run, never a per-change silencer, which would make the gate advisory on precisely the changes it exists to catch. Its absence from `.husky/pre-commit` is not an oversight: it diffs against the merge base, so mid-branch it would fail the code commit that precedes the docs commit, and the only way past would be `--no-verify`, which is forbidden. The `Stop` hook's output contract was chosen by live probe rather than from the identifiers `strings` shows in binary 2.1.236 — both `{"decision":"block","reason":...}` and `hookSpecificOutput.additionalContext` proved to be honoured on `Stop`, and the former ships because its feedback arrives labelled — and it bails on `stop_hook_active` — a `Stop` hook that speaks makes the model continue, which fires `Stop` again. What none of this proves is that anyone reads the doc they were forced to touch; the gate can only observe that a file changed, and no gate can do better.

* Neutral, because `app/tests/`, `app/src/components/`, `app/src/styles/` and `app/src/modules/ui/` are not trigger paths, so test-only and style changes do not trip the gate (plan Task 2, script header).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-doc-sync.sh` runs in the `structure` job of `.github/workflows/quality.yml` and in `run-all-gates` §Always run. `scripts/precommit-gates.tsv` does not list it. `.claude/settings.json` registers `.claude/hooks/context-drift.sh` on `Stop`. The spec (Verification) required a synthetic branch touching only `app/src/services/` to fail.

## Pros and Cons of the Options
### Docs rule as prose
* Bad, because nothing ran it (Context).

### Trigger on all of `app/src/modules/`
* Bad, because 3 of 4 hits were false positives, all the same wake-lock shim file (plan, The calibration is already done).

### Hard-failing gate on calibrated paths plus a `Stop` hook
* Good, because the tuned trigger gives 0 false positives and 1 genuine hit over the calibration window (plan, The calibration is already done).
* Bad, because a genuine "this changed nothing any doc describes" case now has to be argued rather than assumed (Consequences).

## Evidence / More Information
Decided: 2026-09-18

* `docs/superpowers/specs/2026-09-18-agent-context-hardening-implementation-design.md` (Problem, Branch 4, Verification): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-18-doc-sync-gate.md` (The calibration is already done; Task 1, Task 2): rebuilt Considered Options, Consequences and Pros and Cons.
* Commit `661ec336` (PR #453, 2026-09-18; adds the script, the hook and the wiring): rebuilt Confirmation.
* Refined by D444 (commit `7a9c08ec`): a comment-only edit owes no doc.
