<!--
status: canonical
scope: open findings — defects and contradictions noticed but deliberately not fixed
read-when: triaging what to fix next; never loaded by a task
updated: 2026-09-02
highest-issued: F60
-->

# Findings

> Things an agent noticed while doing something else. A finding is **not** a
> work item: it is logged here and named in the completion report, never fixed
> in the same pass. Acting on one requires explicit user permission, and is a
> new task on its own branch. (Root `CLAUDE.md`, Hard Invariants; D214.)
>
> **Opposite lifecycle to `DECISIONS.md`.** Decisions are permanent and
> append-only. Findings are open until closed, and a closed finding is
> **deleted** — the record of the fix is the commit that fixed it, plus a
> decision in `decisions/**` where the fix embodied a real choice. Nothing
> accumulates here.
>
> Guarded by `scripts/check-findings-log.sh`.

## How to add a finding

- Next id is `highest-issued` in the front matter **plus one**. Bump that line
  in the same edit. Ids are never reused — because entries are deleted, the id
  cannot be derived by scanning the file, which is exactly what the high-water
  mark is for.
- `Status:` is `Open` (logged, not yet shown to the user) or `Raised` (named in
  a completion report). There is no `Resolved`: when a finding is fixed, delete
  its block.
- `Evidence:` cites at least one real path, optionally with a `:line` locator.
  The gate checks every cited path still exists, so a finding whose subject was
  deleted or moved fails the build until the entry is corrected or removed.
- Block format:

```markdown
### F<next> — Short statement of what is wrong
Status: Open · Found: YYYY-MM-DD · Task: <branch>
Claim: what the repo asserts
Evidence: `path/to/file.md:12` vs what is actually true
Impact: what it costs an agent that trusts the claim
Proposed: the smallest change that would resolve it — a proposal, not a plan
```

---

### F15 — Every game interface repeats a fragile `max-h-2/5 h-full` sizing pair, and one grid item carries a dead `flex-1`
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: fixing a real-device-only (iPhone 12 Pro, not reproducible in this environment's Chromium or in desktop-simulated mobile viewports) overlap in the split scoreboard found the nested `glass` (`backdrop-filter`) stack unique to that path and removed it; this closes the one occurrence actually reported, not the underlying sizing pattern all nine interfaces share
Evidence: every interfaces file passes `class="max-h-2/5 h-full"` (or `min-h-2/5 max-h-2/5 h-full`) to its `SinglePlayerDisplay`/`SplitScoreboard` — `app/src/components/layout/games/interfaces/Shanghai.astro:24`, `app/src/components/layout/games/interfaces/ScoreTraining.astro:23`, `app/src/components/layout/games/interfaces/TenUpOneDown.astro:21`, `app/src/components/layout/games/interfaces/OneTwentyOne.astro:21`, `app/src/components/layout/games/interfaces/DoublesTraining.astro:24`, `app/src/components/layout/games/interfaces/SinglesTraining.astro:24`, `app/src/components/layout/games/interfaces/Bobs27.astro:24`, `app/src/components/layout/games/interfaces/AroundTheClock.astro:23`, `app/src/components/layout/games/interfaces/FiveOhOne.astro:25` — stacking `h-full` (percentage height) on a flex item whose `flex-1` already sets `flex-basis: 0%`, which per spec makes the percentage height inert; separately, `app/src/components/layout/games/SplitScoreboardHalf.astro:53`'s root div carries `flex-1`, but its parent (`app/src/components/layout/games/SplitScoreboard.astro`) is `display: grid`, where `flex-*` properties have no effect at all. The `SplitScoreboard` call site at `app/src/components/layout/games/interfaces/FiveOhOne.astro:76` was changed to h-2/5 (2026-08-22, reported production overlap still visible under the old classes) — this only fixes that one call site, not the pattern across the other eight interfaces
Impact: the pattern was never proven to be the reported bug's cause (the nested `glass` fix was), so it may or may not harbor a real cross-browser sizing risk on the other eight interfaces' own iOS rendering — unverified either way since no WebKit engine is available in this environment; the dead `flex-1` class is harmless but misleads a reader into thinking `SplitScoreboardHalf`'s height is flex-resolved when it is actually grid-row-stretched
Proposed: audit whether `h-full` can simply be dropped everywhere it sits beside `flex-1` (no behavior change per spec, one less redundant declaration), and replace `SplitScoreboardHalf.astro:53`'s `flex-1` with nothing (or an explicit `h-full`, if grid stretch is ever found unreliable) — small, mechanical, but touches nine files and deserves its own task and on-device verification rather than folding into this one

### F29 — 5 near-identical `*PlayContext` types restate `PlayLifecycleContext`'s shape instead of reusing it
Status: Open · Found: 2026-08-26 · Task: claude/dart-previews-architecture-9tomxf
Claim: `Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, `AroundTheClockPlayContext`, `FiveOhOnePlayContext`, `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, and `TuodPlayContext` (all in `app/src/lib/game/types.ts`) each hand-declare `hiddenTurnKey`, `hiddenTimer`, `loading`, `error`, `finished`, and the rest of `PlayLifecycleContext<TConfig, TEngine, TResults>`'s fields, rather than being defined in terms of it
Evidence: `app/src/lib/game/types.ts` — compare `PlayLifecycleContext` (around line 181) against any of the 9 named types; each restates the same ~15 fields verbatim with only `TConfig`/`TEngine`/`TResults` substituted by hand
Impact: a future field added to the shared lifecycle contract (e.g. a new timer or status field) must be hand-copied into 9 places instead of one; noticed while extracting `playPreviewSegments`/unifying the reveal timer, then widened when `FiveOhOnePlayContext`/`OneTwentyOnePlayContext`/`ScoreTrainingPlayContext`/`TuodPlayContext` picked up the same fields (D234) — a full generic-based unification is a separate, larger type-level refactor outside either task's scope
Proposed: define each `*PlayContext` as `PlayLifecycleContext<XxxSnapshot, XxxEngine, XxxResultsSnapshot> & { <per-game methods> }` instead of a fully hand-written object type, once a task is scoped to take on that refactor across all 9 files at once

### F58 — Three already-landed plans' `context-maintenance` passes skipped the Version History entry
Status: Open · Found: 2026-09-02 · Task: claude/rebase-pr-three-docs-4tm39h
Claim: `dartbot-setup-wiring-fixes` (commit `f90583e`), `alpine-reactivity-fold-fixes` (`c30b733`), and `preview-seat-scoping-fixes` (`fbec686`) each shipped a "docs: context maintenance for ..." commit closing their own findings (F45/F54-F57, F31, F32/F33 respectively), but none of the three added a `docs/architecture/00-Context-Map-History.md` Version History entry — the mandatory step this same skill's own procedure requires (root `CLAUDE.md`, Context Maintenance section)
Evidence: `git log --oneline --all -S"F54 —" -- FINDINGS.md` / `-S"F31 —"` / `-S"F32 —"` each resolve to the three commits named above, all already on this branch; `grep -n "alpine-reactivity\|dartbot-setup-wiring\|preview-seat-scoping" docs/architecture/00-Context-Map-History.md` returns nothing, while every other 2026-09-02 plan on this branch (board-dart-bull-double-checkout, tuod-hardening, scoring-stats-correctness) has its own Version entry
Impact: the Version History section is meant to be the running, authoritative record of what changed and why (per its own file header and `00-File-Inventory.md`'s "Current Implementation State" disclaimer added by F53); a reader relying on it to reconstruct why Singles Training/Around the Clock/Bob's27/Singles Training now fold `$store.game` directly, why DartBot's 501/121/Singles Training setup screens seat bots the way they do, or why the two preview strips scope to the throwing seat, would find no entry — only the commit messages and the plans themselves
Proposed: a follow-up doc-only task should backfill three Version History entries (1.x slots between 1.35.0 and 1.37.0, chronologically) summarizing each plan's actual shipped diff from its own commits — cheap since the plans and commits are already complete and on this branch; no code change involved

### F59 — `process-gate-improvements` plan's own Task 1 code and findings-closure list were both unverified against the repo before publishing
Status: Open · Found: 2026-09-02 · Task: claude/rebase-pr-three-docs-4tm39h
Claim: this plan's Task 1 gave an exact regex diff for `scripts/check-context-map.sh` and its own Step 3 claimed running the script afterward would exit 0; committed verbatim it instead failed on two real lines in `docs/architecture/README.md` (a Version History note pairing "migration/seed ranges" under one shared label, and a sentence stating a migration range and a seed range together) that the plan's own baseline note ("the two lines this section currently matches repeat-wide are ...") never accounted for. Separately, the plan's Global Constraints state it "Closes FINDINGS.md F5, F38, F42, F43, F50," but only Tasks 2, 3, and 6 (F38, F50, F42) carried an actual FINDINGS.md deletion step — Tasks 1 and 4 fixed F5's and F43's underlying defects with no corresponding deletion step, so following the plan task-by-task would have left F5 and F43 open indefinitely despite the constraint claiming otherwise
Evidence: `docs/superpowers/plans/2026-09-02-process-gate-improvements.md` Task 1 Steps 2-3 (diff and expected exit-0) vs. the actual `bash scripts/check-context-map.sh` run against unmodified `docs/architecture/README.md`, which failed until a label-adjacency regex was used instead and the doc's own stale `0001`-`0021`/`0001`-`0007` claim was corrected; Task 1's and Task 4's own "Files" sections list no `FINDINGS.md` edit, unlike Tasks 2/3/6
Impact: same failure category F50 already named for the DartBot phase-plan series — a plan giving "complete, ready-to-commit" code or a "this closes X" claim that fails verification the first time it is actually run, discoverable only by executing the plan rather than reading it; this is the same gap recurring in a different plan series (gate/process plans, not DartBot phases), suggesting it is not series-specific
Proposed: extend F50's own suggestion beyond DartBot phase plans — run every gate-script diff a plan proposes against the actual repo state before publishing, and cross-check every id named in a "Closes FINDINGS.md ..." Global Constraint against an actual deletion step in some task, not just against the underlying defect being fixed

### F60 — Removing the play-data lifecycle's literal duplication (F27) grew Score Training/TUOD's own play-data near-twin clone from 105 to 531 lines
Status: Open · Found: 2026-09-03 · Task: claude/open-findings-brainstorm-3sffvz
Claim: the `2026-09-03-play-data-lifecycle-dedup` plan's own Task 5 Step 1 expected `npx fallow`'s total duplication percentage to drop below the 11.4% baseline it measured before Task 1, once `uploadAndCompleteSession`/`abandonAndExit`/`playAgain`/`currentFacts` were deduplicated across `five-oh-one-play.data.ts`/`one-twenty-one-play.data.ts`/`score-training-play.data.ts`/`tuod-play.data.ts`; it instead rose to 12.2%
Evidence: `cd app && npx fallow dupes --format json` before vs. after the plan's 4 tasks — the literal duplication the plan targeted is gone (no more 3-/4-way clone groups spanning `uploadAndCompleteSession`/`abandonAndExit`/`playAgain`/`computeStats` across the 4 files), but a single near-miss clone group between `app/src/lib/game/score-training-play.data.ts:121-548` and `app/src/lib/game/tuod-play.data.ts:106-548` appeared, matching most of both files; combined with two smaller pre-existing pairings, fallow now reports "3 groups, 531 lines" shared between just those two files, up from 105 lines (two groups) at the same baseline. `resumeEngine`, `init`, and the MINUTES-countdown helpers in these files are unchanged, byte-identical text before and after — the near-miss detector simply bridges a much longer span once the divergent per-file bodies that used to interrupt the match are gone
Impact: this is the same class of "whole-file near-twin similarity, not extractable blocks" clone F27 already named and left out of scope for `score-training.engine.module.ts`/`tuod.engine.module.ts` — it has now visibly spread to these two rulesets' play-data files as well, for the same underlying reason (TUOD was built as Score Training's structural sibling). No new duplicate code was introduced; the total reported percentage is a lagging, sometimes counter-intuitive proxy once a near-miss detector is involved, so a future dedup pass should not assume a lower literal-duplication count always yields a lower reported percentage
Proposed: no action until one of the two rulesets' rules diverge on their own — forcing an extraction now would fight the same currently-real structural symmetry F27 already declined to touch on the engine side; if `score-training-play.data.ts`/`tuod-play.data.ts` are ever revisited, treat both play-data and engine-module pairs as one combined near-twin question rather than two separate findings

