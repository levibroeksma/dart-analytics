<!--
status: canonical
scope: the file fan-out a new game requires, and the shapes it must reuse
read-when: adding a game, or changing anything a game is wired into
updated: 2026-08-20
-->

# Adding a Game

A game is 26 files across 9 trees. Six of them are **shared registries** — a
game wired into five of the six does not fail, it goes quiet. This page is the
list; `scripts/check-game-wiring.sh` is the gate that holds it.

**Reference exemplar: Bob's 27.** When a step below says "copy the existing
shape", copy Bob's 27's — `bobs27-setup.data.ts`, `bobs27.validator.ts`,
`bobs27.engine.module.ts`. One named game, so "copy an existing game" has one
answer instead of eight.

## Two slugs, and why

| Slug | Where it appears | Shanghai | 121 |
| ---- | ---------------- | -------- | --- |
| **Route slug** — the game's real name | `pages/games/<slug>/`, the `href` in `games-visibility.ts` | `shanghai` | `121` |
| **Code slug** — its spelled-out form | `lib/game/<slug>-*.data.ts`, `services/rulesets/<slug>/` | `shanghai` | `one-twenty-one` |

They are identical for every game whose name starts with a letter, and they
differ for every game whose name starts with a digit — because a route should
read as the game's real name and a TypeScript identifier cannot start with a
digit. This is forced, not sloppy. Do not "fix" it by renaming either side.

The ruleset version key follows the route slug, quoted where it must be:
`"121_V1"`, `"501_V1"`.

## The touch list

Rows marked **shared** are files that already exist and that every game edits.
Rows marked *engine-only skips* are the ones a ruleset with an engine but no
page legitimately has none of.

### `app/src/lib/game/`

| File | What goes in it |
| ---- | --------------- |
| `<code-slug>-setup.data.ts` | A `createPresetSetupController` call. *Engine-only skips.* |
| `<code-slug>-play.data.ts` | The game's own play controller — genuinely per-game, no shared factory. *Engine-only skips.* |
| `types.ts` | **shared** — the play context; the setup context is a one-line alias of `PresetSetupContext` |

### `app/src/lib/game/rulesets/`

| File | What goes in it |
| ---- | --------------- |
| `types.ts` | **shared** — the game's Zod config schema |
| `capabilities.ts` | **shared** — the ruleset key and its capture/input mode pairs |
| `games-visibility.ts` | **shared** — the card: key, `href`, title, caption. *Engine-only skips:* a ruleset joins this list only once its `href` resolves. |

### `app/src/modules/game/`

| File | What goes in it |
| ---- | --------------- |
| `<code-slug>.engine.module.ts` | The engine + its `registerEngineFactory` call (`04-Architecture-patterns.md` Pattern 18) |
| `types.ts` | **shared** — engine options, recorded-visit shapes |

### `app/src/services/rulesets/`

| File | What goes in it |
| ---- | --------------- |
| `<code-slug>/<code-slug>.validator.ts` | For a three-dart game: a `createThreeDartValidator` call. Otherwise its own validator. |
| `registry.ts` | **shared** — ruleset key → validator. Must land in the **same commit** as the engine (`scripts/check-game-engines.sh` rejects one without the other). |

### `app/src/components/layout/games/`

| File | What goes in it |
| ---- | --------------- |
| `setup/<Game>SetupForm.astro` | The setup form. *Engine-only skips.* |
| `interfaces/<Game>.astro` | The play-screen interface. *Engine-only skips.* |
| `result-modals/<Game>Results.astro` | The results modal. *Engine-only skips.* |

Check `08-Component-Inventory.md` before hand-rolling markup — `SetupShell`,
`UserSection`, `InfoSection`, `SettingSectionShell`, `Toggle` already exist.

### `app/src/pages/games/<route-slug>/`

| File | What goes in it |
| ---- | --------------- |
| `<route-slug>/setup/index.astro` | Mounts `x-data="<codeSlug>Setup()"`. *Engine-only skips.* |
| `<route-slug>/play/index.astro` | Mounts `x-data="<codeSlug>Play()"`. *Engine-only skips.* |

### `app/src/lib/client/alpine/`

| File | What goes in it |
| ---- | --------------- |
| `register-route-data.ts` | **shared** — the import and the `Alpine.data(…)` call for both controllers. *Engine-only skips.* A page whose controller is missing here renders, and the controller is simply undefined. |

### `app/tests/`

| File | What it covers |
| ---- | -------------- |
| `modules/game/<code-slug>.engine.module.test.ts` | The engine |
| `services/rulesets/<code-slug>/<code-slug>.validator.test.ts` | The validator |
| `lib/game/<code-slug>-setup.data.test.ts` | Setup. *Engine-only skips.* |
| `lib/game/<code-slug>-play.data.test.ts` | Play. *Engine-only skips.* |
| `app/tests/lib/game/rulesets/capabilities.test.ts` | **shared** |
| `app/tests/lib/game/rulesets/games-visibility.test.ts` | **shared**. *Engine-only skips.* |

### `database/`

| File | What goes in it |
| ---- | --------------- |
| `seeds/00NN_<slug>_game_engine_reference.sql` | The game type, ruleset version, configuration template |
| `verification/00NN_<slug>_capability_checks.sql` | Its verification script |
| `seeds/0007_ruleset_version_capabilities.sql` | **shared** — the capability rows |
| `verification/0007_capability_seed_checks.sql` | **shared** |

New schema means a new numbered migration; applied migrations (`0001`–`0022`)
are never edited. Full procedure: `05-Database/10-Database-Agent-Guide.md`
§"Add a new game type".

## Two shapes to reuse, and who opts out

### `createPresetSetupController` (`lib/game/setup-controller.ts`)

Four facts and a call:

```ts
export function bobs27Setup() {
  return createPresetSetupController<Bobs27SetupContext>({
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    playHref: "/games/bobs27/play",
    label: "Bob's 27",
  });
}
```

One optional seam, `configOverrides(ctx)`, whose return value is spread over
the preset configuration before `toSnapshot` **and** sent as `createSession`'s
`config.overrides`. Singles and Doubles Training use it for `order_mode` /
`target_order`; nothing else needs it.

`label` is copy, not a key — it reads `Bob's 27`, not `BOBS27`.

**Opted out: `501` and Score Training.** Both replace `start` wholesale —
preset selection, leg counts, a custom starting score with clamping. Routing
them through the factory would need one hook per branch, which is the factory
dissolving into its callers. They keep hand-written controllers and
hand-written `*SetupContext` types. This is a decision, not an oversight: do
not migrate them, and do not conclude from them that the factory is optional
for a new preset-driven game.

### `createThreeDartValidator` (`services/rulesets/three-dart.validator.ts`)

Three facts and a call:

```ts
export const bobs27Validator: RulesetValidator = createThreeDartValidator({
  label: "Bob's 27",
  configSchema: Bobs27Config,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`,
});
```

It asserts what the five three-dart games share: the mode pair is
`RECREATIONAL + DETAILED_DARTS` or `ANALYTICS + VISUAL_BOARD`; every turn
carries at least one dart row; scores are non-negative under keypad capture;
coordinates re-derive under visual board.

`dartlessIssue` is required rather than defaulted because the message is a
fact about the game — Around the Clock's visit can legitimately end early on a
BULL hit, and its message says so.

A game needing more than these assertions **composes**: call the builder, then
wrap the returned method. It does not fork the file.

QUICK_SCORE-shaped games (`501`, `121`, Score Training, TUOD) use
`quick-score.validator.ts` instead.

## What the gate checks, and what it cannot

`scripts/check-game-wiring.sh` walks every key in `registry.ts` and checks the
validator file, the capability declaration, and — for a game that renders a
card — both data files, both pages, and both Alpine registrations. For a game
absent from `games-visibility.ts` it checks the opposite: that none of those
exist, so a half-wired game fails whichever half it fell on.

It cannot check that anyone read this page, that a page renders, or that a
setup form binds the right fields. It catches one specific failure that no
test catches, because every game's tests only ever exercise that game: a
shared registry left half-edited.
