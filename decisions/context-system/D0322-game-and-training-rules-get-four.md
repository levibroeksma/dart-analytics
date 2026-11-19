---
id: D0322
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [context-system, docs, skill, gate, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Game and training rules get four templates, an authoring skill and a gate; the rules file becomes permanent

## Context and Problem Statement
the tree served games only, and unevenly. `training/routines/` held a README and nothing else despite `09-Training/01-Routines.md` and five roadmap specs; `training/trivia/checkouts.md` followed no template at all. The one mandatory section the old template had — `## Capture`, marked "Required — do not skip" — was absent from four rulesets, two of which (Around the Clock, Shanghai) shipped engines anyway, so the template was provably advisory (#464). `Applies to` exists because applicability was prose: five rulesets declare multiplayer at V1 in `Features` while `Config & presets` locks `Players` to single player, and nothing could see the contradiction (#465). The permanence rule follows from the defer list — if the file records why V1 cut something, deleting the file after translation destroys the only copy of that reasoning. Two axes are kept explicitly separate because conflating them is the likeliest design error here: execution model (game/exercise/trivia) and entry points (standalone/routine step). Warm-Up proves they are independent — `database/seeds/0015_warm_up_routine.sql` seeds it with `game_type_id NULL` and `01-Routines.md` §7 records it as used both standalone and inside Balanced Training — so an exercise gaining standalone play is an amendment, not a migration to `rulesets/`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`docs/game-rules/` gains three shapes beside the game ruleset — exercise type (`training/exercises/`, a new folder), routine and trivia tool — each with its own template under `templates/`, and `GAME_ENGINE_TEMPLATE.md` is renamed `GAME_RULESET_TEMPLATE.md`. A new skill, `authoring-game-rules`, owns the procedure: a hard V1 cut test ("without it, the thing cannot be used at all"), a forced defer list where every non-`V1` row carries a reason, and an amend mode for files that already exist. The `Features` table gains `Applies to` (`All`/`Single`/`1v1`/`2+`) and `Reason` columns; `TBD` is banned from the `Version` column in favour of `V1`/`V<n>`/`V2+`/`Deferred`/`Dropped`. Two header fields are added: `Current version:` (the file's only as-built fact) and `Entry points:` (games and exercises only). `scripts/check-game-rules.sh` checks all of it per shape, warn-only until the #464/#465 backfill flips `GAME_RULES_GATE` to `block`. The tree stays non-canonical, but a rules file is no longer disposable once translated: it is the standing register of deferred scope, revised when a later version ships. Supersedes `docs/game-rules/README.md`'s "disposable once translated" rule.".

### Consequences
the gate ships warn-only, which D317 named as a failure mode, and the mitigation is that its blocking flip is the backfill's own deliverable rather than a later judgement call — all 12 existing files fail it today (102 findings), so landing it blocking would have required bundling 12 file rewrites with new infrastructure. A training-only rule can never become a training-aware branch in a game ruleset: `01-Routines.md` §2 and §10 require a `GameEngine` to stay independent of the exercise system, so the skill routes such a rule to a game variant the routine merely configures, or to its own exercise type, and anything else needs its own decision. Amend mode blocks on a changed shipped rule for the same reason — rewriting a rule the engine already implements is an architecture change wearing a notes edit's clothes. The `Applies to` vocabulary stops at `2+`; `501.md`'s `sideKey` folding anticipates real teams, and `2v2` versus free-for-all will need distinct tokens when that ships. Assertion 9 checks Glossary → Features only, so a named variant that never reaches the Glossary stays invisible to the gate — the skill's step 4 is the only thing that catches it.

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
