# Setup Page + Duration Field Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repo pairings (root `CLAUDE.md`): TDD procedure from `app/CLAUDE.md` §Test-Driven Development (does not apply to `.astro` markup, D101 — see Global Constraints); incidental findings → `capturing-discovered-work`; completion → `run-all-gates` + `context-maintenance` + `finishing-a-dart-branch`.

**Goal:** Replace 11 copy-pasted game setup pages with one `GameSetupPage` component, and the duplicated duration selector in two setup forms with one `DurationField`, with no rendered change.

**Architecture:** `GameSetupPage` owns `AppLayout`, the `x-data` wrapper, the continue-session modal, the reconciliation-failed alert and the slotted form. The page's `x-data` is a rest attribute spread onto the wrapper, so `scripts/check-game-wiring.sh` keeps matching it. `DurationField` is the shared FORMAT toggle + sliders block. Proof is a before/after diff of the built HTML, since `.astro` markup carries no unit test (D101).

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-11-setup-page-extraction-design.md` (#914 task A; B and C are separate branches)

## Global Constraints

- No visible or behavioural change; no controller, store, API or migration change.
- `.astro` markup is not unit-tested (D101); proof is the built-HTML diff, `npm run check` (0 errors/0 warnings/0 hints), `npm test`, fallow gate, and `scripts/check-*.sh`.
- `x-data="<name>()"` must stay a literal attribute in each page file (`scripts/check-game-wiring.sh` greps `x-data="(\w+)\(\)"`).
- Every opening tag with `x-show` also has `x-cloak`; no HTML comments in templates; no `x-bind:` (`scripts/check-astro-conventions.sh`).
- Component header style: JSDoc in frontmatter, then `// Props`, `// Components` sections (match `SetupShell.astro`).
- Pages keep `export const prerender = true`.
- `OneTwentyOneSetupForm` is not touched.
- Prettier formats everything (`npm run format:check` clean).
- `$SCRATCH` = `/tmp/claude-0/-home-user-dart-analytics/dcd12997-2ffe-5e21-b3fc-84e843afbe54/scratchpad`.
- Baseline HTML lives in `$SCRATCH/base/` (11 files, `<route-slug>.html`), captured from `origin/main` (`9cd09de`) by `npm run build` in this worktree.

## Review Focus

1. **Wiring gate regex** — a page passing `xData=`/dropping the literal `x-data="…()"` makes `check-game-wiring.sh` report "no x-data controller call found". Pinned in Task 1 Step 6 (run the script).
2. **Score Training modal title** — page omitted `gameTitle`; component default was `"Score Training"`. Expect identical modal text. Pinned by the HTML diff in Task 1 Step 5 (Score Training's modal sits inside an `x-if` template, so it is in the HTML).
3. **Apostrophe in `Bob's 27`** — title is interpolated into an attribute-bearing string; Astro must escape identically. Pinned by the Bob's 27 HTML diff.
4. **Alpine scope of the slotted form** — form must still render inside the `x-if` template within the `x-data` div, or `loading`/`start()` bindings break. Pinned by the HTML diff (structure identical).
5. **Guest/bot branch of `DurationField`** — rendered only when `guests.length > 0 || bot`; losing it would hide the ROUNDS slider for guest sessions. Pinned by the Score Training and TUOD HTML diffs, which contain both `x-if` branches.

---

### Task 1: `GameSetupPage` and the 11 setup pages

**Files:**
- Create: `app/src/components/layout/games/setup/GameSetupPage.astro`
- Modify: `app/src/pages/games/{121,501,around-the-clock,bobs27,cricket,doubles-training,score-training,shanghai,singles-training,tactics,tuod}/setup/index.astro`

**Interfaces:**
- Consumes: `AppLayout` (`@layouts/AppLayout.astro`, prop `title`), `ContinueSessionModal` (prop `gameTitle`), `Button` (`@components/forms/Button.astro`).
- Produces: `GameSetupPage` — props `{ title: string; [key: string]: unknown }`; default slot = the game's `*SetupForm`; rest props (the page's `x-data`) spread on the wrapper `div`.

- [ ] **Step 1: Confirm the baseline exists and still matches `main`**

Run (from `app/`): `ls "$SCRATCH/base" | wc -l` where `$SCRATCH` is the session scratchpad. Expected: `11`.
If missing, regenerate before touching any `.astro` file: `git switch --detach origin/main` is not needed if the tree is still clean at `9cd09de`; run `npm run build`, then copy each `dist/client/games/<slug>/setup/index.html` to `$SCRATCH/base/<slug>.html`.

- [ ] **Step 2: Create `GameSetupPage.astro`**

```astro
---
/**
 * Page shell for every game setup route: layout, the page's `x-data`
 * scope (passed as a rest attribute, so each page file still declares its
 * own `x-data="<name>Setup()"`), the continue-session modal, the
 * reconciliation-failed alert with Retry, and the game's setup form in the
 * default slot. The scope must expose `showActiveSessionModal`,
 * `activeSession`, `reconciliationFailed`, `loadingReconciliation` and
 * `retryReconciliation()`.
 * @param {string} title Display name; also names the game in the modal
 */
interface Props {
  title: string;
  [key: string]: unknown;
}

// Props
const { title, ...props }: Props = Astro.props;

// Components
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
---

<AppLayout title={`${title} — Setup`}>
  <div
    class="p-4"
    {...props}
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle={title} />
    </template>

    <template x-if="reconciliationFailed && !loadingReconciliation">
      <div
        class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-center text-sm text-error-foreground"
        role="alert"
      >
        <p>Could not clean up a previous session. Retry to continue.</p>
        <Button
          class="mt-4"
          @click="retryReconciliation()"
          title="Retry"
        />
      </div>
    </template>

    <template x-if="!showActiveSessionModal && !reconciliationFailed">
      <slot />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 3: Migrate one page (501) and diff it**

Overwrite `app/src/pages/games/501/setup/index.astro`:

```astro
---
export const prerender = true;
import GameSetupPage from "@components/layout/games/setup/GameSetupPage.astro";
import FiveOhOneSetupForm from "@components/layout/games/setup/FiveOhOneSetupForm.astro";
---

<GameSetupPage
  title="501"
  x-data="fiveOhOneSetup()"
>
  <FiveOhOneSetupForm />
</GameSetupPage>
```

Run (from `app/`): `npm run build`
Then: `diff <(npx prettier --parser html "$SCRATCH/base/501.html") <(npx prettier --parser html dist/client/games/501/setup/index.html)`
Expected: no output. If there is a diff, fix the component (not the baseline) until it is empty; whitespace-only differences are normalised by Prettier, anything else is a real change.

- [ ] **Step 4: Migrate the other 10 pages**

Run from the worktree root (generates each page from `route|title|xData|Form` rows; all values copied from the current pages):

```bash
python3 - <<'E'
rows = [
 ("121","121","oneTwentyOneSetup","OneTwentyOneSetupForm"),
 ("around-the-clock","Around the Clock","aroundTheClockSetup","AroundTheClockSetupForm"),
 ("bobs27","Bob's 27","bobs27Setup","Bobs27SetupForm"),
 ("cricket","Cricket","cricketSetup","CricketSetupForm"),
 ("doubles-training","Doubles Training","doublesTrainingSetup","DoublesTrainingSetupForm"),
 ("score-training","Score Training","scoreTrainingSetup","ScoreTrainingSetupForm"),
 ("shanghai","Shanghai","shanghaiSetup","ShanghaiSetupForm"),
 ("singles-training","Singles Training","singlesTrainingSetup","SinglesTrainingSetupForm"),
 ("tactics","Tactics","tacticsSetup","TacticsSetupForm"),
 ("tuod","Ten Up One Down","tuodSetup","TuodSetupForm"),
]
for slug,title,ctrl,form in rows:
    open(f"app/src/pages/games/{slug}/setup/index.astro","w").write(f'''---
export const prerender = true;
import GameSetupPage from "@components/layout/games/setup/GameSetupPage.astro";
import {form} from "@components/layout/games/setup/{form}.astro";
---

<GameSetupPage
  title="{title}"
  x-data="{ctrl}()"
>
  <{form} />
</GameSetupPage>
''')
E
```

- [ ] **Step 5: Format, rebuild, diff all 11 routes**

Run (from `app/`):
```bash
npx prettier --write src/pages/games src/components/layout/games/setup/GameSetupPage.astro
npm run build
for f in "$SCRATCH"/base/*.html; do n=$(basename "$f" .html); diff <(npx prettier --parser html "$f") <(npx prettier --parser html "dist/client/games/$n/setup/index.html") >/dev/null && echo "OK $n" || echo "DIFF $n"; done
```
Expected: 11 lines, all `OK`. Any `DIFF`: run the `diff` for that route alone, fix the component, rebuild, repeat.

- [ ] **Step 6: Run the gates this task can break**

Run (from the worktree root):
```bash
bash scripts/check-game-wiring.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
```
Expected: each prints `OK` (or its equivalent success line) and exits 0.
Run (from `app/`): `npm run check` — Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/layout/games/setup/GameSetupPage.astro app/src/pages/games
git commit -m "refactor: extract GameSetupPage from 11 setup pages (#914)"
```
(Append the commit attribution lines from the session's system reminder.)

---

### Task 2: `DurationField` for Score Training and TUOD

**Files:**
- Create: `app/src/components/layout/games/setup/DurationField.astro`
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro`, `app/src/components/layout/games/setup/TuodSetupForm.astro`

**Interfaces:**
- Consumes: `Toggle` (`./Toggle.astro`, props `orientation`, `options`, `class`, `x-model`), `SettingLabel` (`./SettingLabel.astro`, prop `text`), `RangeSlider` (`@components/forms/RangeSlider.astro`, props `min`, `max`, `label`, `ariaLabel`, `hint`, `x-model`).
- Produces: `DurationField` — props `{ formatOptions: { value: string; label: string }[]; rounds: { min: number; max: number }; minutes: { min: number; max: number }; soloHint: string }`. Reads the surrounding Alpine scope: `guests`, `bot`, `durationType`, `durationValue`. Renders inside a `SettingSectionShell`.

- [ ] **Step 1: Capture the pre-change HTML for the two forms**

Task 1 left the build output current for these two routes. Confirm `$SCRATCH/base/score-training.html` and `$SCRATCH/base/tuod.html` exist (they are the Task 1 baselines and already equal the post-Task-1 output). No new capture needed.

- [ ] **Step 2: Create `DurationField.astro`**

```astro
---
/**
 * Duration controls for setups that offer Rounds or Time: a FORMAT toggle
 * with a ROUNDS or MINUTES slider for solo play, and a ROUNDS-only slider
 * once a guest or bot is seated. Reads `guests`, `bot`, `durationType` and
 * `durationValue` from the setup scope.
 * @param {{ value: string; label: string }[]} formatOptions Toggle options
 * @param {{ min: number; max: number }} rounds Rounds slider bounds
 * @param {{ min: number; max: number }} minutes Minutes slider bounds
 * @param {string} soloHint Hint under the solo sliders
 */
interface Props {
  formatOptions: { value: string; label: string }[];
  rounds: { min: number; max: number };
  minutes: { min: number; max: number };
  soloHint: string;
}

// Props
const { formatOptions, rounds, minutes, soloHint }: Props = Astro.props;

// Components
import Toggle from "./Toggle.astro";
import SettingLabel from "./SettingLabel.astro";
import RangeSlider from "@components/forms/RangeSlider.astro";
---

<template x-if="guests.length === 0 && !bot">
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <SettingLabel text="FORMAT" />
      <Toggle
        orientation="horizontal"
        options={formatOptions}
        x-model="durationType"
        class="w-full"
      />
    </div>
    <template x-if="durationType === 'ROUNDS'">
      <RangeSlider
        min={rounds.min}
        max={rounds.max}
        label="ROUNDS"
        ariaLabel="Number of rounds"
        hint={soloHint}
        x-model="durationValue"
      />
    </template>
    <template x-if="durationType === 'MINUTES'">
      <RangeSlider
        min={minutes.min}
        max={minutes.max}
        label="MINUTES"
        ariaLabel="Number of minutes"
        hint={soloHint}
        x-model="durationValue"
      />
    </template>
  </div>
</template>
<template x-if="guests.length > 0 || bot">
  <RangeSlider
    min={rounds.min}
    max={rounds.max}
    label="ROUNDS"
    ariaLabel="Number of rounds"
    x-model="durationValue"
  />
</template>
```

- [ ] **Step 3: Use it in `ScoreTrainingSetupForm.astro`**

In the frontmatter: remove the `Toggle`, `SettingLabel` and `RangeSlider` imports (verify with grep that nothing else in the file uses them), add `import DurationField from "./DurationField.astro";`, keep `formatOpts`, `rounds`, `minutes`, `soloHint`.
In the markup, replace everything inside `<SettingSectionShell>` (both `<template x-if>` blocks) with:

```astro
    <DurationField
      formatOptions={formatOpts}
      rounds={rounds}
      minutes={minutes}
      soloHint={soloHint}
    />
```

- [ ] **Step 4: Use it in `TuodSetupForm.astro`**

Same as Step 3: drop the `Toggle`, `SettingLabel` and `RangeSlider` imports (grep first: nothing else in the file uses them; keep `Switch`), add the `DurationField` import. Replace the two `<template x-if>` blocks with the same `<DurationField formatOptions={durationOpts} … />` call (the options const is named `durationOpts` here). The `<Switch label="Show checkout hints" …/>` after the blocks stays.

- [ ] **Step 5: Format, rebuild, diff the two routes**

Run (from `app/`):
```bash
npx prettier --write src/components/layout/games/setup
npm run build
for n in score-training tuod; do diff <(npx prettier --parser html "$SCRATCH/base/$n.html") <(npx prettier --parser html "dist/client/games/$n/setup/index.html") >/dev/null && echo "OK $n" || echo "DIFF $n"; done
```
Expected: `OK score-training`, `OK tuod`. On `DIFF`, inspect with `diff` and fix `DurationField` until empty.

- [ ] **Step 6: Re-diff all 11 routes and run gates**

Re-run the Task 1 Step 5 loop (all 11 `OK`), then from the worktree root `bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh`, and from `app/` `npm run check` (0/0/0).

- [ ] **Step 7: Confirm the clone is gone**

Run (from `app/`): `npx fallow dupes --format json --mode mild --min-tokens 40 --min-lines 6 | python3 -c "import json,sys; g=json.load(sys.stdin)['clone_groups']; print([x for x in g if any('ScoreTrainingSetupForm' in i['file'] and 'TuodSetupForm' in j['file'] for i in x['instances'] for j in x['instances'])])"`
Expected: `[]`. Also expected: no `pages/games/*/setup/index.astro` entries in any clone group (`grep` the same JSON for `setup/index.astro`).

- [ ] **Step 8: Commit**

```bash
git add app/src/components/layout/games/setup
git commit -m "refactor: extract DurationField from Score Training and TUOD setup forms (#914)"
```

---

### Task 3: Docs, context maintenance, full validation

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (the `components/layout/games/setup/` table, ~line 114-124)
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (the `<route-slug>/setup/index.astro` row, ~line 85, and the "Check `08-Component-Inventory.md`" sentence, ~line 78)
- Modify: `decisions/frontend/architecture.md` (new append-only entry; check `DECISIONS.md`'s routing table and next free `D###` first)
- Modify: `docs/architecture/00-File-Inventory.md` only if `scripts/check-context-map.sh` demands rows for the new components

- [ ] **Step 1: Add the two inventory rows**

Append to the setup shells table, in the file's existing row format:
`| \`DurationField.astro\` | Solo FORMAT toggle with ROUNDS/MINUTES slider, and the guest/bot ROUNDS slider, bound to \`durationType\`/\`durationValue\`; used by Score Training and TUOD (121 keeps its own: third TARGET format, text note for guest/bot) (#914, 2026-10-11) | \`formatOptions\`, \`rounds\`, \`minutes\`, \`soloHint\` |`
`| \`GameSetupPage.astro\` | Page shell for every game setup route: \`AppLayout\`, the page's \`x-data\` (rest attribute), continue-session modal, reconciliation-failed alert + Retry, slotted \`*SetupForm\` (#914, 2026-10-11) | \`title\`, \`x-data\` (rest) |`
Keep the table's alphabetical order.

- [ ] **Step 2: Update `09-Adding-A-Game.md`**

Change the setup page row to: `| \`<route-slug>/setup/index.astro\` | \`<GameSetupPage title="<Game>" x-data="<codeSlug>Setup()">\` wrapping the setup form. *Engine-only skips.* |` and add `GameSetupPage` to the list of existing components in the "Check `08-Component-Inventory.md`" sentence.

- [ ] **Step 3: Record the decision**

Read `DECISIONS.md` (router) for the routing table and next id; append one entry to `decisions/frontend/architecture.md` in the file's existing block format: decision (GameSetupPage owns the setup page shell, `x-data` as rest attribute so the wiring gate still matches; DurationField shared by two forms; 121 deliberately excluded), consequences (new game's setup page is a 5-line file; HTML-diff proof, no unit test, D101). Never edit an existing block.

- [ ] **Step 4: Run `context-maintenance`**

Invoke the `context-maintenance` skill and do what it lists (CLAUDE.md sync, context-map registration, gate scripts, graph note). Fix anything it flags that this change caused.

- [ ] **Step 5: Run `run-all-gates` and the app tests**

Invoke the `run-all-gates` skill for the changed areas (`app/`, `docs/`). Run from `app/`: `npm test` (all pass), `npm run check` (0/0/0), `bash ../scripts/fallow-gate.sh` (exit 0), `npm run format:check` (clean). `npm run validate:app` needs `DATABASE_URL` for its `db:*` steps; run the non-DB steps individually as listed and report that the `db:*` and graph-refresh steps were not run if no DB is reachable.

- [ ] **Step 6: Commit**

```bash
git add docs decisions
git commit -m "docs: record GameSetupPage and DurationField (#914)"
```
Then follow `finishing-a-dart-branch` (push, open PR referencing #914, which stays open for tasks B and C).

---

## Self-Review

- **Spec coverage:** `GameSetupPage` + 11 pages → Task 1; `DurationField` (Score Training, TUOD; 121 excluded) → Task 2; verification and docs → Tasks 1–3. Out-of-scope items untouched.
- **Placeholders:** none; page values copied from current files; docs row text is given.
- **Type consistency:** `GameSetupPage { title, ...rest }` and `DurationField { formatOptions, rounds, minutes, soloHint }` match between Interfaces blocks and code.
- **Review Focus:** five items, each pinned to a named step.
