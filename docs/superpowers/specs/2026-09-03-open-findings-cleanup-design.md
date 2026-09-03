# Design: Open findings cleanup — dead sizing class, Version History backfill, plan-verification gate

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F15 (partially), F58, F59. Three independent, small fixes
bundled as one spec: a dead CSS class, a docs backfill, and a new process
gate — no shared code path, but each is small enough that splitting into
separate specs would be overhead. Companion specs handle F27 (play-data
duplication) and F29 (`*PlayContext` type unification) separately — both are
larger, riskier refactors that deserve their own review unit.

## Task 1 — F15 (partial): dead `flex-1` in `SplitScoreboardHalf.astro`

`SplitScoreboardHalf.astro:53`'s root `cn()` call carries `flex-1`, but its
parent (`SplitScoreboard.astro`) is `display: grid` — `flex-*` properties
have no effect inside a grid container, so the class is dead weight that
misleads a reader into thinking the element's height is flex-resolved when
it's actually grid-row-stretched.

Fix: drop `flex-1` from the `cn()` call at line 53. Spec-provable, no
behavior change — grid stretch already governs the element's height with or
without the class.

**Not fixed here:** the wider `h-full`/`flex-1` sizing-pair audit across the
9 game-interface files (`Shanghai.astro`, `ScoreTraining.astro`,
`TenUpOneDown.astro`, `OneTwentyOne.astro`, `DoublesTraining.astro`,
`SinglesTraining.astro`, `Bobs27.astro`, `AroundTheClock.astro`,
`FiveOhOne.astro`) needs on-device iOS verification this environment cannot
perform (no WebKit engine available). F15 stays open, edited rather than
deleted:

- `Claim`/`Evidence` trimmed to only the still-open h-full-audit half across
  the 9 interface files (the `SplitScoreboardHalf.astro:53` evidence line is
  removed).
- `Impact`/`Proposed` reworded to drop the resolved dead-`flex-1` clause.
- A note added that the `flex-1` half was fixed on
  `claude/open-findings-brainstorm-3sffvz`, so a future reader doesn't
  re-discover the same dead class.

## Task 2 — F58: backfill 3 missing Version History entries

Three already-landed, already-merged plans never got a
`docs/architecture/00-Context-Map-History.md` Version History entry, the
mandatory `context-maintenance` step their own "docs: context maintenance
for ..." commits should have included:

| Plan | Merge commit(s) | Findings closed |
| --- | --- | --- |
| `dartbot-setup-wiring-fixes` | `f90583e` (context-maintenance commit) | F45, F54, F55, F56, F57 |
| `alpine-reactivity-fold-fixes` | PR #224, `c30b733` (context-maintenance commit) | F31 |
| `preview-seat-scoping-fixes` | `fbec686` (context-maintenance commit) | F32, F33 |

Fix: for each plan, locate its actual merged PR/diff (PR #224 is already
identified for `alpine-reactivity-fold-fixes`; the other two need the same
lookup — `git log`/`gh`/GitHub search on the commit hashes above, or on the
plan's own file under `docs/superpowers/plans/` if still present) and write
one Version History entry per plan, in the same prose style as the existing
entries (see `1.35.0`–`1.40.0` for the pattern: what shipped, which files
changed, which findings closed, validation run). Insert them chronologically
as `1.35.1`, `1.35.2`, `1.35.3` — patch-slot versions between the existing
`1.35.0` (2026-09-01, DartBot phase 7) and `1.36.0` (2026-09-02,
doc-only-corrections) entries, in the merge order shown above, rather than
renumbering every later entry.

No code change. F58 deleted on completion.

## Task 3 — F59: automate the plan-verification gap

`process-gate-improvements`' own Task 1 shipped an unverified gate-script
diff (failed the first time it was actually run) and its Global Constraints
claimed "Closes F5, F38, F42, F43, F50" while only 3 of 5 tasks carried an
actual `FINDINGS.md` deletion step — the same failure category F50 already
named for the DartBot phase-plan series, recurring in a different series.

Two sub-problems, two different fixes:

1. **FINDINGS-closure cross-check** — fully mechanical: does every
   `Closes FINDINGS.md F<id>` claim in a plan have a matching deletion step
   named in some task? New `scripts/check-plan-findings-closure.sh`, same
   shape/style as `scripts/check-findings-log.sh` — parses a plan file's
   closure claim(s) and each task's "Files"/step text, fails (non-zero exit,
   naming the missing id) if any claimed id has no matching deletion step
   anywhere in the plan.
2. **Gate-script-diff verification** — not mechanically provable (requires
   executing the plan's own proposed change against the live repo); the fix
   is a reminder, not a check.

Wire both into a `PostToolUse` hook in `.claude/settings.json` (via the
`update-config` skill, since hooks are its domain) matching `Write`/`Edit`
on `docs/superpowers/plans/*.md`:

- Runs `check-plan-findings-closure.sh` against the written/edited plan file
  — **blocking** (non-zero exit fails the tool call) on a mismatch.
- Separately prints a **non-blocking** stderr reminder: "This plan proposes
  N gate-script/checklist diff(s) — run them against the current repo before
  publishing." (triggered by a simple heuristic: the plan file contains a
  fenced diff/code block naming a path under `scripts/` or a checklist
  script).

F59 deleted on completion — its Proposed section's suggestion ("extend F50's
own suggestion... to all plans") is fulfilled by this automated,
always-on check rather than a one-off manual habit.

## Testing

- Task 1: `SplitScoreboardHalf.astro` has no dedicated `.astro` component
  test (per `app/CLAUDE.md`'s TDD rules, `.astro` markup logic isn't unit
  tested — D101). Verify visually is out of scope (grid stretch, not a
  behavior change); confirm via `astro check` and the existing game-play
  test suites that exercise the split scoreboard layout still pass
  unchanged.
- Task 2: doc-only; `scripts/check-doc-links.sh`,
  `scripts/check-context-budget.sh` must still pass after the 3 new entries.
- Task 3: new script needs its own fixture-style test coverage, mirroring
  `check-findings-log.sh`'s pattern of proving the gate fails on malformed
  input (a fixture plan file with a closure claim and no matching deletion
  step) before proving it passes on a well-formed one. Manually verify the
  hook fires (`Write`/`Edit` a scratch file under
  `docs/superpowers/plans/` and confirm the block/reminder behavior) since
  hooks have no automated test harness in this repo.

## Non-goals

- No fix to the 8 remaining `h-full`/`flex-1` interface files — stays open
  in FINDINGS.md pending on-device verification.
- No renumbering of existing Version History entries beyond inserting the 3
  new `1.35.x` slots.
- No attempt to mechanically verify a plan's proposed gate-script diff
  actually passes — flagged for human/agent follow-through, not enforced.
- No change to `check-findings-log.sh` itself; the new script is additive.
