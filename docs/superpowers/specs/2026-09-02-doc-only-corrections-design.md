# Design: Doc-only corrections batch

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F9, F28, F30, F46, F51, F53. Six independent, small doc
fixes (one docstring in a `.ts` file, F51) with no shared code path — bundled
as one spec so they land as one small pass over `docs/CLAUDE.md`'s
"minimal diff, targeted edits" rule, six independent tasks, splittable at
review/PR time.

Each fix is a targeted edit to the file the finding names, not a rewrite.

## Task 1 — F9: `09-Adding-A-Game.md` doesn't warn about commit atomicity

`scripts/check-game-wiring.sh` requires a ruleset to be fully wired (both
data files, both pages, both Alpine registrations, its visibility card) or
fully absent, in the state of **every commit**, not just the final one — a
plan that lands the touch list one file per commit fails the pre-commit
`game-wiring` hook on its first task.

Fix: add a short note under "## What the gate checks, and what it cannot" (or
directly after "## The touch list") stating the touch list's 26 files land in
one commit, or stay uncommitted until wiring is complete — a plan cannot
split them into sequential per-file commits.

## Task 2 — F28: File-Inventory row hardcodes `context-maintenance`'s step count

`00-File-Inventory.md:239` describes the skill as an "8-step procedure"; it
is 9 steps today (step 9, "Component inventory," was added after this row was
last touched). The step count has no gate checking it, so it can keep
drifting.

Fix: drop the number — reword to "Context Maintenance procedure, invoked
before claiming any task done" — so the row can't go stale on the next step
addition either, per the finding's own fallback option.

## Task 3 — F30: File-Inventory row undercounts `decisions/frontend/alpine.md`

`00-File-Inventory.md:210` says "14 decisions"; `git grep -cE '^\| D[0-9]+
\||^### D[0-9]+' decisions/frontend/alpine.md` returns 17 today — it has
drifted twice since the finding was filed (13 at filing, 14 now, 17 actual).
Same shape as F28: no gate checks this number.

Fix: drop the count — reword to "Alpine, stores, state, persist, recovery,
x-data, x-show" (matching the topic-list style already used for
`decisions/frontend/style.md`'s row on the line below it), so it can't drift
again.

## Task 4 — F46: `.control` documented as having wrapper components that don't exist

`07-Frontend/07-Style-Guide.md:74`'s Primitives table lists `.control` as
"Checkbox / radio appearance (`Checkbox.astro`, `Radio.astro`)" — neither
file exists anywhere under `app/src/components/`. `.control` itself is real
(`app/src/styles/global.css:369-397`) and usable directly on a raw
`<input type="checkbox">`/`<input type="radio">`.

`08-Component-Inventory.md` currently carries no matching row (checked; the
finding's claim that it "repeats the same two component names" no longer
holds against the doc as it stands today) — only `07-Style-Guide.md` needs
the edit.

Fix: reword the Primitives table row to "Checkbox / radio appearance —
apply directly to a raw `<input type="checkbox">`/`<input type="radio">`; no
dedicated wrapper component exists yet", per the finding's proposed option
(b).

## Task 5 — F51: stale cross-reference to a deleted function name

`app/src/lib/game/session-mode-resolution.ts:120-121` — `participantsFromSeats`'s
JSDoc calls itself "the inverse of `seatsFromParticipants`", a function
deleted and replaced by a private `toSeatFacts` in the same file during a
prior task that left this one cross-reference untouched.

Fix: reword the docstring's cross-reference to name `toSeatFacts` instead of
`seatsFromParticipants` — no behavior change, comment only.

Note for the plan: this is a docstring-only edit inside `app/src/**/*.ts`,
which `scripts/check-test-coverage.sh` (D224) still counts as a changed
runtime source file requiring a touched covering test — there is no
comment-only exemption. The plan's task must also touch
`app/tests/lib/game/session-mode-resolution.test.ts` (e.g. confirm/annotate
the existing `participantsFromSeats` test still describes current behavior)
to satisfy the gate, even though no behavior changed.

## Task 6 — F53: `00-Context-Map-History.md`'s "Current Implementation State" table is stale

The table's "Game engines" row (line 87) still says "All six (Score
Training, Bob's 27, Singles Training, Doubles Training, 501, Ten Up One
Down)"; nine engines are registered today (`scripts/check-game-engines.sh`
itself reports 9, adding Around the Clock, 121, Shanghai, TUOD), and no row
mentions DartBot at all despite seven shipped phases. The table has drifted
for at least 13 versions per its own adjacent Version History section.

Rewriting every stale row to be exactly current is itself a moving target
(more DartBot phases are actively in flight — this task's own DartBot-wiring
and F57-doc-reword specs touch `08-DartBot.md`, not this table) and risks
re-introducing the same drift the next time an engine ships. Fix, per the
finding's own second option: add a one-line note directly under the "#
Current Implementation State" heading — "This table is maintained
best-effort and can lag; the Version History section above is the
authoritative current-state source when they disagree." — rather than
rewriting the table's rows. No content row is edited.

## Testing

- Tasks 1–4, 6: doc-only; no test file to touch (`scripts/check-test-coverage.sh`
  only gates `app/src/`/`app/scripts/` runtime files). Each still runs
  through `docs/CLAUDE.md`'s Consistency Checks and `context-maintenance`'s
  Findings gate before being claimed done.
- Task 5: see the gate note above — touch
  `app/tests/lib/game/session-mode-resolution.test.ts` to satisfy D224.

## Non-goals

No rewrite of any doc beyond the single row/section each task names. No
change to `08-DartBot.md` (covered by the DartBot-wiring spec's Task 5). No
change to `check-game-wiring.sh`, `check-test-coverage.sh`, or any other
gate script.
