<!--
status: canonical
scope: app game wiring — setup controller, ruleset validator, adding-a-game exemplar
read-when: implementing the consistency spec (Spec 3 of 3)
updated: 2026-08-19
-->

# Design: Consistency — one shape per game, written down once

## Problem

Adding a game means reproducing a shape nobody has written down, by copying a
game that already exists and renaming everything in it.

Measured on Shanghai, a game touches **25 files across 9 trees**:

| Tree | Files |
| ---- | ----- |
| `app/src/lib/game/` | `shanghai-setup.data.ts`, `shanghai-play.data.ts`, `types.ts` |
| `app/src/lib/game/rulesets/` | `types.ts`, `capabilities.ts`, `games-visibility.ts` |
| `app/src/modules/game/` | `shanghai.engine.module.ts`, `types.ts` |
| `app/src/services/rulesets/` | `shanghai/shanghai.validator.ts`, `registry.ts` |
| `app/src/components/layout/games/` | `setup/ShanghaiSetupForm.astro`, `result-modals/ShanghaiResults.astro` |
| `app/src/pages/games/shanghai/` | `setup/index.astro`, `play/index.astro` |
| `app/src/lib/client/alpine/` | `register-route-data.ts` |
| `app/tests/` | 6 — engine, validator, both data files, and the two shared registry suites |
| `database/` | `seeds/0008_shanghai_game_engine_reference.sql` and its verification script, plus edits to the shared `0007` capability seed and check |

Six of those are **shared registries** — `register-route-data.ts`,
`capabilities.ts`, `games-visibility.ts`, `registry.ts`, and two `types.ts`
barrels. A game wired into five of the six does not fail: it goes quiet. No
doc lists them, and no gate checks them.

The copying is not a metaphor. Three clusters are near-identical files that
differ only in the game's name:

| Cluster | Files | Lines | Lines that differ |
| ------- | ----- | ----- | ----------------- |
| `<game>-setup.data.ts` | 6 | 961 | 13 per pair (name, 2 keys, route) |
| `<game>.validator.ts` | 5 | 749 | ~19 per pair (schema, label, prose) |
| `<Game>SetupContext` in `lib/game/types.ts` | 6 | 176 | 1 per pair (the self-type) |

**1,886 lines carrying roughly 160 lines of game-specific fact.** Two examples
of what that costs:

- `bobs27.validator.ts` and `shanghai.validator.ts` differ in 37 lines. Among
  them: `DEFAULT_MAX_TURN_SCORE` sits at line 19 in one and line 96 in the
  other, with the same value and a near-identical comment. Nothing moved it
  but a hand.
- Each validator's doc comment names a *different* sibling as the file it
  mirrors (`bobs27` cites `quick-score.validator.ts`, `shanghai` cites
  `singles-training.validator.ts`). The comments are a citation ring around a
  shape that is never stated anywhere.

A fix to shared behaviour is therefore five to six edits, and an agent that
makes four of them has introduced a divergence no test will catch, because
each game's tests only ever exercise that game.

Two things are **not** the problem, and the design leaves them alone:

- **`<game>-play.data.ts` is genuinely divergent** — 189 to 643 lines, no two
  files closer than 461 differing lines. That is real per-game rules logic.
- **The slug split** — `five-oh-one-setup.data.ts` serves `/games/501`,
  `one-twenty-one` serves `/games/121`. This is forced, not sloppy: a route
  should read as the game's real name, and a TypeScript identifier cannot
  start with a digit. It needs writing down, not changing.

## Scope

Spec 3 of three, and the last. Two extractions, one exemplar doc, one gate,
one finding closed.

Explicitly **out of scope**:

- **`<game>-play.data.ts`.** See above. Extracting from files whose only
  commonality is a filename would invent a shape rather than record one.
- **`501` and `score-training` setup controllers.** Both replace `start`
  wholesale — preset selection, leg counts, a custom starting score with
  clamping. Routing them through the factory needs one hook per branch, which
  is the factory dissolving into its callers. They stay as they are, and the
  exemplar says so rather than leaving a reader to wonder.
- **Agent-artifact templates** (gate scripts, decision blocks, doc headers).
  Considered and dropped: those shapes are already uniform, and a template
  for them would guard nothing.
- **Database and API exemplars.** `10-Database-Agent-Guide.md` already rules
  that tree.
- **Renaming anything.** No slug moves, no file moves, no route changes.

## Design

### 1. `createPresetSetupController`

New: `app/src/lib/game/setup-controller.ts`.

Absorbs the 157-line skeleton every preset-driven game repeats: load presets
and active sessions, reconcile a recovered session, retry that reconciliation,
continue or abandon, then start — create the session, snapshot the config,
push it into the store, navigate to play.

```ts
createPresetSetupController({
  gameTypeKey: "SHANGHAI",
  rulesetVersionKey: "SHANGHAI_V1",
  playHref: "/games/shanghai/play",
  label: "Shanghai",
})
```

One seam, because measurement found exactly one. `singles-training` and
`doubles-training` inject `order_mode` and `target_order` into both the config
snapshot and the store overrides; nothing else in the six deviates at all. So
the spec takes an optional hook:

```ts
configOverrides?(ctx): Record<string, unknown>
```

Its return value is spread over the preset's configuration before
`toSnapshot`, and passed as `overrides` to `startSessionInput`. Absent, both
are omitted — which is exactly today's behaviour for the other four.

`label` exists only for the two user-facing strings (`Could not find a preset
for Bob's 27.`). It is not derived from a key: the current messages read
`Bob's 27`, not `BOBS27`, and a derivation would silently reword shipped copy.

**Adopters (6):** `bobs27`, `shanghai`, `around-the-clock`, `one-twenty-one`,
`singles-training`, `doubles-training`. Each `<game>-setup.data.ts` becomes a
call plus whatever extra state that game's form binds (`orderMode` for the two
training games).

### 2. `PresetSetupContext`

`lib/game/types.ts` gains one generic base type, and the six cloned
`<Game>SetupContext` blocks become aliases of it. The self-type stays a
parameter so `this:` annotations keep resolving to the concrete context:

```ts
export type PresetSetupContext<Self> = { … };
export type ShanghaiSetupContext = PresetSetupContext<ShanghaiSetupContext>;
```

The two training contexts add their `orderMode` field on top by intersection.
`ScoreTraining` and `FiveOhOne` keep their hand-written contexts, matching
their opted-out controllers.

### 3. `createThreeDartValidator`

New: `app/src/services/rulesets/three-dart.validator.ts`.

The five clones assert the same three things: the session's mode pair is one
of `RECREATIONAL + DETAILED_DARTS` or `ANALYTICS + VISUAL_BOARD`; every turn
in the batch carries at least one dart row; and under visual board, every dart
re-derives against its coordinate. They differ in the Zod config schema, the
game's label in three messages, and prose.

```ts
createThreeDartValidator({ label: "Shanghai", configSchema: ShanghaiConfig })
```

Each `<game>.validator.ts` becomes that call, keeping its own export name so
`registry.ts` and every test import path are untouched. A game needing more
than the shared assertions composes: call the builder, then wrap the returned
`validate`.

### 4. `docs/architecture/07-Frontend/09-Adding-A-Game.md`

The exemplar doc. `status: canonical`, registered in the inventory, under the
existing `07-Frontend` numbering.

It carries:

- **The touch list** — the 25 files, grouped by tree, each with one line on
  what goes in it, and the six shared registries called out as the ones that
  fail silently. `00-Context-Map.md`'s "New game (full stack)" pack currently
  carries a partial version of this list inline; the pack points here instead,
  so the fan-out is stated once.
- **`bobs27` named the reference exemplar.** One game, named once, so
  "copy an existing game" has a defined answer instead of eight.
- **The two opt-outs** — `501` and `score-training` — with the reason, so a
  reader who opens one first does not conclude the factory is optional.
- **The slug rule** — route slug is the game's real name (`501`), code slug is
  its spelled-out form (`five-oh-one`), because identifiers cannot start with
  a digit.
- **Engine-only games are legitimate.** `TUOD_V1` has an engine and a
  validator and deliberately no page; `games-visibility.ts` already documents
  why. The touch list marks which rows an engine-only game skips.

### 5. `scripts/check-game-wiring.sh` (gate 17)

The doc states the touch list; the gate holds it. For every key in
`services/rulesets/registry.ts`:

1. A validator file exists at the path the registry imports.
2. The key is declared in `capabilities.ts`.
3. Unless the game is engine-only, it appears in `games-visibility.ts`, has
   `<game>-setup.data.ts` and `<game>-play.data.ts`, both are registered in
   `register-route-data.ts`, and `pages/games/<route>/setup` and `/play` both
   exist.

Engine-only is not a hardcoded list of one: a game is engine-only when it is
absent from `games-visibility.ts`, which is already the file that decides
whether a card renders. The gate then requires the *rest* of that row to be
absent too — a half-wired game fails whichever half it fell on.

The route slug cannot be derived from the ruleset key (`121_V1` → `121`, but
`SINGLES_V1` → `singles-training`), so the gate reads the `href` that
`games-visibility.ts` already declares and checks the pages under it. No
second mapping table.

House style, matching the other sixteen: bash wrapper, `python3` heredoc,
`set -euo pipefail`, `FAIL:` to stderr and `OK:` to stdout, optional path
argument so fixtures can prove it bites.

### 6. F2 is closed

Root `CLAUDE.md`'s Knowledge Graph section tells every agent to run
`graphify query` before exploring. The CLI is not in the session container, so
the rule is unfollowable, in the one file that loads every session. The
committed `graphify-out/graph.json` *is* readable — the rule names the wrong
tool, not the wrong idea.

The section is reworded to consult the committed graph directly and to demote
the CLI to an optional local convenience. `F2` is then **deleted** from
`FINDINGS.md`, per the lifecycle D214 set: a resolved finding leaves no
tombstone, and this branch's commit is the record.

This is the one finding Spec 3 touches. `F1`, `F3`–`F6` stay open and
untouched, for the same reason Spec 2 left them: the log is only worth
anything if entries leave it by permission rather than by convenience. The
permission here was explicit, and both earlier specs named F2 as this spec's
subject.

## Files

**New**

| Path | Purpose |
| ---- | ------- |
| `app/src/lib/game/setup-controller.ts` | The preset setup factory |
| `app/src/services/rulesets/three-dart.validator.ts` | The validator builder |
| `app/tests/lib/game/setup-controller.test.ts` | Factory unit tests, incl. the `configOverrides` seam |
| `app/tests/services/rulesets/three-dart.validator.test.ts` | Builder unit tests |
| `docs/architecture/07-Frontend/09-Adding-A-Game.md` | The exemplar |
| `scripts/check-game-wiring.sh` | Gate 17 |

**Modified**

| Path | Change |
| ---- | ------ |
| 6 × `app/src/lib/game/<game>-setup.data.ts` | Become factory calls |
| 5 × `app/src/services/rulesets/<game>/<game>.validator.ts` | Become builder calls |
| `app/src/lib/game/types.ts` | `PresetSetupContext<Self>`; six contexts become aliases |
| `.husky/pre-commit`, `.github/workflows/quality.yml`, `.claude/skills/run-all-gates/SKILL.md` | Wire gate 17 (12 → 13 pre-commit, 16 → 17 in `structure`) |
| `app/CLAUDE.md` | Gate count; pointer to the exemplar |
| `CLAUDE.md` | Knowledge Graph section reworded (F2) |
| `FINDINGS.md` | `F2` deleted; `highest-issued` unchanged |
| `docs/architecture/00-File-Inventory.md` | Rows for the exemplar and the gate |
| `docs/architecture/00-Context-Map.md` | "New game (full stack)" pack points at the exemplar instead of carrying the fan-out inline; budget recomputed |
| `docs/architecture/00-Context-Map-History.md` | 1.10.0 entry; task records |
| `decisions/frontend/architecture.md` | One appended decision |

## Verification

**The 819 existing tests are the proof.** Both extractions are
behaviour-preserving, so the per-game suites — which never learn that a
factory exists — must stay green **unmodified**. A test edited to accommodate
the refactor is a behaviour change in disguise; if one needs editing, the
extraction is wrong and the extraction changes, not the test.

Baseline recorded before any edit: `tests/lib/game` + `tests/services/rulesets`
= 52 files, 819 tests, all passing.

Then, in order:

1. Baseline captured; the two new unit-test files added for the factory and
   builder themselves.
2. Gate 17 proven against fixtures **before** it is wired — a game missing
   from `capabilities.ts`, from `register-route-data.ts`, from
   `games-visibility.ts`, missing its pages, and a half-wired engine-only
   game. Each must exit 1 and name the file.
3. Extractions land one cluster at a time, full suite green after each.
4. `npm run check` (Astro/TS), `npm run format:check`, then the full gate chain.
5. Line-count delta reported honestly — if the extraction saves less than the
   1,886 lines the clusters hold, the figure that ships is the measured one.

`validate:app` applies: this changes `app/` source.

## Dogfood

The gate cannot prove the exemplar is followed — it checks that files exist,
not that anyone read the doc before creating them. The doc is a map; the gate
catches the specific failure that a map does not: a registry left half-edited.
Stating the boundary in the script's own header, as `check-findings-log.sh`
does, keeps its green from being mistaken for a guarantee.
