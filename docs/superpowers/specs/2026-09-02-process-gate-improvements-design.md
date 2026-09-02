# Design: Process/gate improvements (F5, F38, F42, F43, F50)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F5, F38, F42, F43, F50. Five independent
governance/gate items — two already resolved (close only), one a small
gate-script fix, one a new structural gate, one a scoped investigation.
Bundled as one spec, five independent tasks, splittable at review/PR
time.

## Task 1 — F5: `check-context-map.sh`'s migration-range regex can't tell a seed range from a migration range

The check (`scripts/check-context-map.sh:57-68`) flags any doc line
quoting a range `0001–NNNN` whose end doesn't match the migration chain's
own max, unless the line also contains the literal word "seed"
(`grep -iv 'seed'`, added by D194). Seeds are numbered `0001`–`0013`
today (`database/seeds/`) — the same starting point the regex looks for —
so a seed-range mention that doesn't happen to use the word "seed" on
that exact line still misfires. Verified against the two lines this
regex currently matches repo-wide
(`docs/architecture/README.md:70`, `database/README.md:16`, both reading
`migrations/ … 0001–0023`) — both correctly say "migrations", so today's
check passes cleanly; the gap is latent, not currently tripped.

A keyword blocklist (must not contain "seed") is the wrong shape for this
— it's an exclusion list of one word standing in for an open-ended set of
ways a doc might phrase a seed reference. Flip it to a positive
requirement instead: only enforce the check on a line that names
"migration" (case-insensitive) at all. Every legitimate migration-range
claim in this repo already does (both current matches confirm it), and a
line that doesn't mention migrations has no business being held to the
migration chain's own max regardless of what it does mention.

Fix:

```sh
for q in $(grep -hiE '0001.?[–-].?.?[0-9]{4}' "$f" 2>/dev/null \
  | grep -iE 'migration' \
  | grep -oE '0001.?[–-].?.?[0-9]{4}' | grep -oE '[0-9]{4}$' | sort -u); do
```

(swap `grep -iv 'seed'` for `grep -iE 'migration'`). Re-run the script
against the repo's current doc set as part of this task to confirm both
known-good lines still pass and nothing new fails.

## Task 2 — F38: already closed, no action

F38's own Proposed field already says "none — historical specs are
status notes, never rewritten; noted here only so the discrepancy isn't
mistaken for a live doc defect." There is nothing to implement.

Fix: no code change. Remove the F38 entry from `FINDINGS.md`.

## Task 3 — F50: already resolved, close the finding

F50 claimed `2026-09-01-dartbot-4-seat-admission.md`'s Task 7
`buildSeatPlan` code, if committed verbatim, would fail `npx fallow`'s
health gate (interleaved ternaries, cyclomatic 10 / cognitive 11 / CRAP
31.6) — but notes "fixed on this branch by replacing the interleaved
ternaries with one early return per `participantTypeKey` branch." Verified
against the shipped code: `app/src/services/session.service.ts:251-300`'s
`buildSeatPlan` already has exactly that shape — one early return per
`PLAYER`/`DARTBOT`/`GUEST` branch, no interleaved ternaries. The fix
landed; only the finding entry is stale.

Fix: no code change. Remove the F50 entry from `FINDINGS.md`. (Leave its
own process suggestion — "run `npx fallow` against every code block
before publishing a DartBot phase plan" — for the user to decide whether
to adopt going forward; not a repo file to edit.)

## Task 4 — F43: no gate enforces a shared play page resumes every registered ruleset version

`scripts/check-game-engines.sh` enforces that a new engine's
`rulesetVersionKey` lands with its server-side validator, but nothing
enforces that a shared play page (`*-play.data.ts`) actually resumes
every version registered for its game type. SHANGHAI_V2 shipped its
engine, validator, registry entry, and setup-screen wiring across four
commits but never touched `shanghai-play.data.ts`'s `resumeEngine`, which
stayed hardcoded to `SHANGHAI_V1` — every session created under V2
silently failed to resume (fixed on the branch that found this).

Every `*.engine.module.ts` file's basename already matches its
`*-play.data.ts` counterpart 1:1 (verified: `around-the-clock`,
`bobs27`, `doubles-training`, `five-oh-one`, `one-twenty-one`,
`score-training`, `shanghai`, `singles-training`, `tuod` — nine for
nine), and `check-game-engines.sh` already extracts every
`rulesetVersionKey` string an engine module names (its `KEYS` variable,
one or more per file — e.g. Shanghai's own module already reports
`SHANGHAI_V1 SHANGHAI_V2`). That's everything a new check needs: for an
engine module naming more than one key, confirm its paired
`*-play.data.ts` file's source text contains every one of those keys
literally.

Fix: extend `scripts/check-game-engines.sh` with a new section after the
existing per-module loop:

```sh
# --- Resumable ruleset version wiring -----------------------------------
# A game with more than one registered rulesetVersionKey needs its shared
# play page to actually resume all of them, not just the first one ever
# shipped — SHANGHAI_V2 shipped without this and every V2 session silently
# failed to resume (F43).
for file in $MODULES; do
  BASENAME=$(basename "$file" .engine.module.ts)
  PLAY_FILE="app/src/lib/game/${BASENAME}-play.data.ts"
  KEYS=$(grep -oE 'rulesetVersionKey[[:space:]]*[:=][[:space:]]*"[A-Z0-9_]+"' "$file" \
    | grep -oE '"[A-Z0-9_]+"' | tr -d '"' | sort -u)
  KEY_COUNT=$(printf '%s\n' "$KEYS" | grep -c .)
  [ "$KEY_COUNT" -le 1 ] && continue

  if [ ! -f "$PLAY_FILE" ]; then
    echo "FAIL: $file names $KEY_COUNT ruleset versions but $PLAY_FILE does not exist" >&2
    FAIL=1
    continue
  fi
  for key in $KEYS; do
    if ! grep -qF "\"$key\"" "$PLAY_FILE"; then
      echo "FAIL: $PLAY_FILE never references rulesetVersionKey \"$key\" (registered in $file)" >&2
      FAIL=1
    fi
  done
done
```

(`if`/`then` throughout, matching the existing script's own style rather
than the terser `||`/`&&` chains used elsewhere in this design doc — a
chained `grep || echo && FAIL=1` here would set `FAIL=1` unconditionally,
since `||` and `&&` are equal-precedence and left-associative in `sh`;
this shape avoids that trap.) Also add this failure mode to
`docs/architecture/07-Frontend/09-Adding-A-Game.md`'s touch list for
"adding a second ruleset version to an existing game", per the finding's
own fallback option — cheap, and the gate script's own error message
won't be the first thing a plan-writer reads.

## Task 5 — F42: why didn't `fallow`'s duplication gate catch the pre-fix bust/checkout duplication?

Before a prior task's Tasks 1-7, the bust/checkout rule was hand-duplicated
5 times across 3 engine files and `otherSeatsComplete`-shaped inline folds
3 times — clone families comparable in size to one `fallow` caught before
(D232) — yet `npx fallow` was passing on `main` the whole time. Whether
that's a `.fallowrc.jsonc` tuning gap (threshold, ignore list) or a
structural blind spot (method-body clones spread across a class, vs. free
functions) is currently unknown either way.

This is a research task, not a code fix — its deliverable is an answer,
not a diff:

1. On a throwaway local branch (never pushed, discarded after), reproduce
   the pre-fix duplication: revert the bust/checkout and
   `otherSeatsComplete` extractions from
   `docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md`'s
   own Tasks 1-7 (or hand-copy the rule back into the 3 sites it was
   pulled from, matching what the spec describes as the pre-fix state).
2. Run `npx fallow dupes` directly against that branch and read its
   output: does it list the reconstructed clone family at all? At what
   size/threshold does `fallow` start reporting it, if not by default?
3. Record the answer — a short note (a few sentences) either as a
   `decisions/**` entry (if it changes how `.fallowrc.jsonc` should be
   tuned) or as this task's own completion note in the PR/plan, per
   whichever `context-maintenance` judges the right home for a
   process-tooling finding, not a product decision.
4. If the investigation finds a real configuration gap, a defined
   follow-up: tune `.fallowrc.jsonc` accordingly, as a separate small
   task (not bundled into this one — a tuning change deserves its own
   review, not to ride along on a research task).
5. If the investigation finds a structural blind spot in `fallow` itself
   (method-body clones across classes not tokenized the same as free
   functions), no repo change is possible — record it as a known
   limitation (e.g. in `07-Frontend/06-Test-Strategy.md` or wherever
   `fallow`'s own gate is documented) so a future near-miss isn't
   re-investigated from scratch.

## Testing

- Task 1: no test file — a `scripts/*.sh` change with no covering unit
  test today (`check-context-map.sh` has none); verify by re-running the
  script against the current repo (`bash scripts/check-context-map.sh`)
  and confirming it still exits 0.
- Tasks 2, 3: doc-only (`FINDINGS.md` entry removal); no test file.
- Task 4: `scripts/check-game-engines.sh` has no existing unit test
  either (a `.sh` gate script, exempt from `check-test-coverage.sh`'s
  `app/src/`/`app/scripts/` scope). Verify by running the script against
  the current repo (should still report all 9 conforming) and against a
  throwaway local edit that reintroduces Shanghai's old single-version
  `resumeEngine` (should newly FAIL) — confirms the new section actually
  catches the exact bug F43 describes, then revert the throwaway edit.
- Task 5: no code artifact to test — the investigation's own procedure
  (steps 1-2 above) is its verification.

## Non-goals

No change to `.fallowrc.jsonc` as part of this spec — Task 5 only
investigates; any tuning change it surfaces is explicitly deferred to a
follow-up task. No change to `docs/superpowers/specs/**`'s historical-record
policy (Task 2 respects it, doesn't touch the cited spec). No change to
`app/src/services/session.service.ts` (Task 3's `buildSeatPlan` is
already correct; nothing to touch). No change to
`check-game-engines.sh`'s existing per-module checks (Task 4 only adds a
new section after them).
