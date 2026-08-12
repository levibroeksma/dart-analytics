# 501 Extended Setup Config — Design

Status: draft — pending user review
Date: 2026-08-11

## Scope

Extend the 501 setup screen beyond the V1 locked config:

- Starting score picker: 301 / 501 / 701 / Custom (custom input defaults to 101)
- FirstTo-legs control, restyled to match Score Training's input pattern
- Reuse Score Training's setup components (`SetupShell`, `SettingSectionShell`, `UserSection`, `InfoSection`, `Toggle`, `Input`)
- Play-page stat tiles reordered and relabeled: 3 dart avg → Previous score → Darts
- Double out stays the default and is not exposed as a control

## Out of scope

- Legs vs. sets (match structure) — separate future spec; `stage_types` already has a `SET` row but no engine wiring exists yet
- Double-in / master-in / master-out / straight-out variants
- Multiplayer

## 1. Setup form — component reuse

`FiveOhOneSetupForm.astro` moves from `components/layout/games/` to `components/layout/games/setup/`, alongside `ScoreTrainingSetupForm.astro`, and is rebuilt on the same shell:

```
<SetupShell title="501">
  <UserSection />
  <InfoSection title="501 rules" description="…" />
  <SettingSectionShell>
    <Toggle orientation="horizontal" options={[301, 501, 701, Custom]} x-model="startingScoreOption" class="w-full" />
    <Input id="startingScoreValue" x-show="startingScoreOption === 'CUSTOM'" x-model.number="startingScoreValue" @input="scoreClampNotice = ''" class="glass border-tab-border rounded-full! mt-4" />
    <p role="status" clamp notice — scoreClampNotice />
    <Input id="legsToWin" x-model.number="legsToWin" @input="legsClampNotice = ''" class="glass border-tab-border rounded-full! mt-4" />
    <label for="legsToWin" class="text-xs text-muted-foreground px-4 py-0 italic">Legs</label>
    <p role="status" clamp notice — legsClampNotice />
  </SettingSectionShell>
  <p alert error />
</SetupShell>
```

The old locked-settings `<dl>` (Players / Start score / In / Out) is dropped entirely — matches Score Training's shape, where fixed rules live in `InfoSection`'s description instead of a separate card.

`pages/games/501/setup/index.astro` stops passing `title`/`description` props to the form; mirrors `pages/games/score-training/setup/index.astro`'s bare `<ScoreTrainingSetupForm />` call. Import path updates to `@components/layout/games/setup/FiveOhOneSetupForm.astro`.

## 2. Starting score state + validation

New `app/src/lib/game/five-oh-one-starting-score.ts`, mirroring `five-oh-one-legs.ts`:

```ts
export const FIVE_OH_ONE_STARTING_SCORE_MIN = 2;
const FIVE_OH_ONE_STARTING_SCORE_MAX = 999;
const FIVE_OH_ONE_STARTING_SCORE_DEFAULT = 101;

export const FIVE_OH_ONE_STARTING_SCORE_NOTICE = "Allowed range: 2–999";

export function clampFiveOhOneStartingScore(value: unknown): {
  value: number;
  clamped: boolean;
};
```

Non-finite/blank input clamps to `FIVE_OH_ONE_STARTING_SCORE_DEFAULT` (101), not the bare min of 2 — matches the stated default for the custom field. Only exercised when `startingScoreOption === "CUSTOM"`; the 301/501/701 toggle values are fixed numbers needing no clamp.

`five-oh-one-setup.data.ts` state additions:

- `startingScoreOption: "301" | "501" | "701" | "CUSTOM"`, default `"501"`
- `startingScoreValue: number | string | null`, default `101`
- `scoreClampNotice: string` (new, separate from the existing legs notice)
- existing `clampNotice` renamed `legsClampNotice` for clarity now that two independently-clamped fields exist

No watcher resets `startingScoreValue` when toggling away from and back to Custom — whatever the player typed is preserved.

## 3. `start()` — no API/schema/seed changes

`FiveOhOneConfig` (`app/src/lib/game/rulesets/types.ts`) already declares `starting_score` (`.min(2).default(501)`) and `legs_to_win` (`.min(1).max(20)`). `POST /api/sessions`'s template config path already merges arbitrary `overrides` onto the resolved preset and validates the merged result against the ruleset schema (`06-API/04-Endpoint-Contracts.md` §Discriminated config input). So `start()` only widens its existing override object:

```ts
const { value: legsValue, clamped: legsClamped } = clampFiveOhOneLegs(this.legsToWin);
const startingScore =
  this.startingScoreOption === "CUSTOM"
    ? clampFiveOhOneStartingScore(this.startingScoreValue).value
    : Number(this.startingScoreOption);

overrides: { legs_to_win: legsValue, starting_score: startingScore }
```

`basePreset()` keeps resolving the single-leg seed preset (`legs_to_win === FIVE_OH_ONE_LEGS_MIN`) as the base template — both keys are overridden on top of it regardless of the preset's own stored values. No new seed presets. `config-codec.ts`'s snake↔camel mapping is fully generic (`mapKeys` over every key), so `starting_score` ↔ `startingScore` needs no manual wiring — already proven by `FiveOhOneSnapshot.startingScore` existing today.

## 4. Play-page stat tiles

`components/layout/games/interfaces/FiveOhOne.astro`: reorder and relabel the three `StatRow`s inside the `progress` slot:

1. `label="3 dart avg"` → `value="average()"`
2. `label="Previous score"` → `value="previousScore()"`
3. `label="Darts"` → `value="dartsThrownThisLeg()"`

Pure markup change. `average()` (`five-oh-one-play.data.ts`) already computes the 3-dart average via `threeDartAverageDisplay`; no data-layer change.

## 5. Testing

- New unit test for `clampFiveOhOneStartingScore`, mirroring the existing `five-oh-one-legs` clamp test (bounds, non-finite fallback to 101, floor behavior).
- Update `five-oh-one-setup.data.ts` tests: the `start()` override payload now carries `starting_score`; add cases for each toggle option and for Custom with an out-of-range value asserting the clamp fires and `scoreClampNotice` is set.
- No `GameEngine` contract changes — `checkGameEngines.sh` / engine tests unaffected.

## Files touched

- New: `app/src/lib/game/five-oh-one-starting-score.ts`
- Moved + rewritten: `components/layout/games/FiveOhOneSetupForm.astro` → `components/layout/games/setup/FiveOhOneSetupForm.astro`
- Edited: `app/src/lib/game/five-oh-one-setup.data.ts`, `app/src/pages/games/501/setup/index.astro`, `app/src/components/layout/games/interfaces/FiveOhOne.astro`
- New/updated tests under `app/tests/` mirroring the above paths
