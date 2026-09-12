# Training Page & Balanced Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `/trivia` IA to `/training` (Quick Subtract becomes a flat card beside the new routine), and ship the first routine-detail page — `Balanced Training` — as a static, read-only template: ordered step list + duration pill + an inert `Start` button.

**Architecture:** Pure frontend/Astro change. No migration, no seed, no API route, no `TrainingEngine`/`ExerciseEngine` wiring — `Balanced Training`'s 4 steps are hand-written static copy in the page, not read from `routine_templates`/`routine_steps`. `GameCard.astro` gains an optional `duration` prop (renders the existing `Badge.astro`). A new shared component, `RoutineDetail.astro`, is the reusable step-list-plus-CTA shell any future routine's detail page will reuse unchanged.

**Tech Stack:** Astro.js, TypeScript, Alpine.js (no new Alpine data factory needed — nothing on these pages is interactive beyond a disabled button), Vitest.

## Global Constraints

- Source doc: `docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` (read in full before starting; it is the authority for every piece of copy and every deferred item below).
- Explicitly **out of scope** (per the spec's §7 and this plan): any schema/migration/seed work for `SWITCHING`/`DOUBLE_PATTERN`/`LADDER`/the `WARM_UP` weight change; the training-session API route; wiring the `Start` button to anything; any config UI; renaming `lib/trivia/`/`modules/trivia/`/`components/layout/trivia/`; the ping sound (§6.1) and warm-up dartboard-outline highlight (§6.2) — both require a running exercise-session page, which does not exist yet and is not built by this plan.
- `lib/trivia/`, `modules/trivia/`, `components/layout/trivia/` keep their current names and import paths — only the **pages** (routes) move. Do not rename the domain folders.
- No `.ts` file goes directly under `components/` or `pages/` (enforced by `scripts/check-file-locations.sh`) — static per-page copy (the 4 Balanced Training steps) is a literal array in the page's own Astro frontmatter, not a new `.ts` data module.
- `app/CLAUDE.md` D101: `.astro` markup logic is not unit-tested — no test file for `GameCard.astro`'s new prop or the new `RoutineDetail.astro` component.
- `scripts/check-test-coverage.sh`: any edited runtime `.ts` file under `app/src/` needs a touched test that imports it — applies to Task 2's one-line redirect change in `quick-subtract-play.data.ts`.
- Run `cd app && npm run validate:app` before every commit that touches `app/`; run `cd app && npm run format` and commit any diff before considering the branch done (`app/CLAUDE.md`).
- Semantic Tailwind tokens only, reuse `Badge.astro`/`Button.astro`/`GameCard.astro`/`AppLayout.astro` — no hand-rolled buttons or pills.

---

### Task 1: `GameCard.astro` gains an optional duration pill

**Files:**
- Modify: `app/src/components/layout/games/GameCard.astro`

**Interfaces:**
- Consumes: `Badge.astro` (`app/src/components/ui/Badge.astro`) — props `variant?: "accent"|"error"|"neutral"`, default slot for the label text.
- Produces: `GameCard.astro`'s `Props` gains `duration?: string`. Existing callers (`app/src/pages/games/index.astro`) pass no `duration` and are unaffected (prop is optional, renders nothing when absent).

- [ ] **Step 1: Read the current component so the edit is a true diff**

Current file (`app/src/components/layout/games/GameCard.astro`):

```astro
---
interface Props {
  href: string;
  title: string;
  caption: string;
}

// Props
const { href = "#", title, caption }: Props = Astro.props;

// Components
import CardWrapper from "@components/ui/CardWrapper.astro";

// Icons
import DartIcon from "@icons/dart.svg";
---

<CardWrapper
  class="flex-row justify-between items-center gap-4 glass"
  href={href}
>
  <div class="flex flex-col gap-0.5">
    <h3 class="font-semibold text-base text-accent">
      {title}
    </h3>
    <p class="text-xs text-muted-foreground">
      {caption}
    </p>
  </div>
  <DartIcon class="-rotate-45 size-8 text-accent" />
</CardWrapper>
```

- [ ] **Step 2: Add the `duration` prop and render it via `Badge`**

Replace the whole file with:

```astro
---
/**
 * @param {string} href
 * @param {string} title
 * @param {string} caption
 * @param {string} [duration] Optional duration pill (e.g. "30 min") shown next to the title.
 */
interface Props {
  href: string;
  title: string;
  caption: string;
  duration?: string;
}

// Props
const { href = "#", title, caption, duration }: Props = Astro.props;

// Components
import CardWrapper from "@components/ui/CardWrapper.astro";
import Badge from "@components/ui/Badge.astro";

// Icons
import DartIcon from "@icons/dart.svg";
---

<CardWrapper
  class="flex-row justify-between items-center gap-4 glass"
  href={href}
>
  <div class="flex flex-col gap-0.5">
    <div class="flex items-center gap-2">
      <h3 class="font-semibold text-base text-accent">
        {title}
      </h3>
      {duration && <Badge class="text-xs">{duration}</Badge>}
    </div>
    <p class="text-xs text-muted-foreground">
      {caption}
    </p>
  </div>
  <DartIcon class="-rotate-45 size-8 text-accent" />
</CardWrapper>
```

- [ ] **Step 3: Visual sanity check**

Run `cd app && astro dev --background`, open `/games` in a browser, confirm every existing `GameCard` (no `duration` passed) renders exactly as before — no empty badge, no layout shift. Stop the server when done (`astro dev stop`).

- [ ] **Step 4: Format and commit**

```bash
cd app && npm run format
git add app/src/components/layout/games/GameCard.astro
git commit -m "feat: add optional duration pill to GameCard"
```

---

### Task 2: Move the Trivia routes under `/training`, update every reference

**Files:**
- Create (moved content): `app/src/pages/training/index.astro`
- Create (moved content): `app/src/pages/training/quick-subtract/index.astro`
- Delete: `app/src/pages/trivia/index.astro`, `app/src/pages/trivia/quick-subtract/index.astro`
- Modify: `app/src/components/layout/BottomNav.astro`
- Modify: `app/src/lib/trivia/quick-subtract-play.data.ts`
- Modify (test): `app/tests/lib/trivia/quick-subtract-play.data.test.ts`

**Interfaces:**
- Consumes: `GameCard.astro`'s new `duration` prop (Task 1). `AppLayout.astro` (`title?: string`, unchanged). `QuickSubtract.astro`/`GameLayout.astro` (unchanged — only the page that mounts them moves).
- Produces: `/training` and `/training/quick-subtract` as the live routes; `/trivia*` no longer exists.

- [ ] **Step 1: Move the Quick Subtract page, unchanged**

```bash
git mv app/src/pages/trivia/quick-subtract/index.astro app/src/pages/training/quick-subtract/index.astro
```

No content change — it only imports `GameLayout`/`QuickSubtract`, neither of which is path-dependent.

- [ ] **Step 2: Replace the Trivia landing page with the Training landing page**

```bash
git mv app/src/pages/trivia/index.astro app/src/pages/training/index.astro
```

Replace its contents with:

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import GameCard from "@components/layout/games/GameCard.astro";
---

<AppLayout title="Training">
  <div class="p-4 space-y-4">
    <h1 class="text-xl font-semibold text-foreground">Training</h1>
    <GameCard
      href="/training/balanced-training"
      title="Balanced Training"
      caption="Warm up, switch targets, then finish on doubles — one guided 30-minute session"
      duration="30 min"
    />
    <GameCard
      href="/training/quick-subtract"
      title="Quick Subtract"
      caption="Drill checkout mental math against the clock or a target count"
    />
  </div>
</AppLayout>
```

(`/training/balanced-training` is built in Task 3; the card links to it now so Task 3's verification has a working landing-page link.)

- [ ] **Step 3: Confirm the old `trivia` page directories are gone**

```bash
ls app/src/pages/trivia 2>&1 || echo "removed"
```

Expected: `removed` (or an empty-directory/no-such-file message) — `git mv` should have left nothing behind. If `app/src/pages/trivia/` still exists as an empty directory, remove it:

```bash
rmdir app/src/pages/trivia 2>/dev/null || true
```

- [ ] **Step 4: Update `BottomNav.astro`'s Trivia entry**

In `app/src/components/layout/BottomNav.astro`, change:

```ts
  {
    label: "Trivia",
    icon: TargetIcon,
    href: "/trivia",
  },
```

to:

```ts
  {
    label: "Training",
    icon: TargetIcon,
    href: "/training",
  },
```

(Icon unchanged — no icon swap was requested.)

- [ ] **Step 5: Update Quick Subtract's exit redirect**

In `app/src/lib/trivia/quick-subtract-play.data.ts`, change:

```ts
    exit() {
      this.destroy();
      window.location.href = "/trivia";
    },
```

to:

```ts
    exit() {
      this.destroy();
      window.location.href = "/training";
    },
```

- [ ] **Step 6: Update the test that asserts the old redirect**

In `app/tests/lib/trivia/quick-subtract-play.data.test.ts`, change the last test:

```ts
  it("exit() tears down the game and navigates to the Trivia landing page", () => {
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    const destroySpy = vi.spyOn(ctx.game!, "destroy");
    const location = { href: "" };
    vi.stubGlobal("location", location);
    ctx.exit();
    expect(destroySpy).toHaveBeenCalled();
    expect(location.href).toBe("/trivia");
  });
```

to:

```ts
  it("exit() tears down the game and navigates to the Training landing page", () => {
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    const destroySpy = vi.spyOn(ctx.game!, "destroy");
    const location = { href: "" };
    vi.stubGlobal("location", location);
    ctx.exit();
    expect(destroySpy).toHaveBeenCalled();
    expect(location.href).toBe("/training");
  });
```

- [ ] **Step 7: Run the affected test file**

```bash
cd app && npx vitest run tests/lib/trivia/quick-subtract-play.data.test.ts
```

Expected: all tests PASS, including the renamed one.

- [ ] **Step 8: Manual route check**

```bash
cd app && astro dev --background
```

In a browser: `/training` loads the new landing page with both cards (Balanced Training shows a "30 min" pill, Quick Subtract does not); `/training/quick-subtract` loads and plays exactly as `/trivia/quick-subtract` did before; `/trivia` and `/trivia/quick-subtract` both 404; the bottom nav's "Training" tab highlights on `/training*` routes. Then:

```bash
astro dev stop
```

- [ ] **Step 9: Format, full validation, commit**

```bash
cd app && npm run format && npm run validate:app
git add app/src/pages/training app/src/components/layout/BottomNav.astro app/src/lib/trivia/quick-subtract-play.data.ts app/tests/lib/trivia/quick-subtract-play.data.test.ts
git status
```

Confirm `git status` shows `app/src/pages/trivia/` as deleted and `app/src/pages/training/` as added (from the `git mv`s), then:

```bash
git commit -m "refactor: rename /trivia IA to /training"
```

---

### Task 3: `RoutineDetail.astro` shell + the Balanced Training page

**Files:**
- Create: `app/src/components/layout/training/RoutineDetail.astro`
- Create: `app/src/pages/training/balanced-training/index.astro`

**Interfaces:**
- Consumes: `Badge.astro` (duration pill), `Button.astro` (`title`, `variant`, `grow`, `disabled`, `ariaLabel` props, per `app/src/components/forms/Button.astro`).
- Produces: `RoutineDetail.astro`'s `Props`: `{ title: string; durationLabel: string; steps: { name: string; duration: string; description: string }[] }`. Any future routine detail page imports this component and supplies its own `steps` array — no other routine exists yet, so no second caller is added in this task.

- [ ] **Step 1: Create the reusable `RoutineDetail.astro` shell**

```astro
---
/**
 * Reusable routine-detail shell: title + duration pill, an ordered list of
 * steps (name, duration, plain-language explanation), and a single CTA.
 * Nothing here is configurable — callers that need settings are a later
 * design (docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md §3).
 * @param {string} title
 * @param {string} durationLabel e.g. "30 min"
 * @param {{name: string, duration: string, description: string}[]} steps
 */
interface RoutineDetailStep {
  name: string;
  duration: string;
  description: string;
}

interface Props {
  title: string;
  durationLabel: string;
  steps: RoutineDetailStep[];
}

// Props
const { title, durationLabel, steps }: Props = Astro.props;

// Components
import Badge from "@components/ui/Badge.astro";
import Button from "@components/forms/Button.astro";
---

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">{title}</h1>
    <Badge>{durationLabel}</Badge>
  </div>

  <ol class="space-y-4">
    {
      steps.map((step, index) => (
        <li class="space-y-1">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold text-accent">
              {index + 1}. {step.name}
            </span>
            <span class="text-xs text-muted-foreground">— {step.duration}</span>
          </div>
          <p class="text-sm text-muted-foreground">{step.description}</p>
        </li>
      ))
    }
  </ol>

  <Button
    title="Start"
    variant="primary"
    grow
    disabled
    ariaLabel="Start — coming soon"
  />
</div>
```

- [ ] **Step 2: Create the Balanced Training page, static copy from the spec's §3/§4**

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import RoutineDetail from "@components/layout/training/RoutineDetail.astro";

const steps = [
  {
    name: "Warm-Up",
    duration: "10 min",
    description:
      "Loosen up through 5 board zones: upper (5, 20, 1), lower (19, 3, 17), right (13, 6, 10), left (8, 11, 14), and bull.",
  },
  {
    name: "Switching: Target",
    duration: "5 min",
    description:
      "Each visit, throw one dart each at 20, 19 and 18. Single = 1 point, double = 2, treble = 3. Repeat for the full five minutes and see how many points you can score.",
  },
  {
    name: "Switching: Doubles",
    duration: "5 min",
    description:
      "Cycle through three visits: D20, D10, D5 — then D16, D8, D4 — then D12, D6, D3. Each double you hit is worth 1 point. Repeat for the full five minutes.",
  },
  {
    name: "Finishing",
    duration: "10 min",
    description: "Ten Up One Down, timed.",
  },
];
---

<AppLayout title="Balanced Training">
  <div class="p-4">
    <RoutineDetail
      title="Balanced Training"
      durationLabel="30 min"
      steps={steps}
    />
  </div>
</AppLayout>
```

- [ ] **Step 3: Manual verification**

```bash
cd app && astro dev --background
```

In a browser: `/training/balanced-training` shows the title "Balanced Training", a "30 min" pill, the 4 numbered steps in order with the exact copy above, and a disabled "Start" button (correct cursor/opacity for disabled, no click handler fires). Confirm the Balanced Training card on `/training` links here. Then:

```bash
astro dev stop
```

- [ ] **Step 4: Format, full validation**

```bash
cd app && npm run format && npm run validate:app
```

Expected: `validate:app` passes with 0 errors/warnings/hints. No test-coverage failure is expected here — both new files are `.astro` (D101-exempt), not `.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/training/RoutineDetail.astro app/src/pages/training/balanced-training/index.astro
git commit -m "feat: add Balanced Training routine detail page"
```

---

### Task 4: Context maintenance — decision, finding, component inventory

**Files:**
- Modify: `decisions/frontend/astro.md`
- Modify: `FINDINGS.md`
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`

**Interfaces:** None — documentation only, no code consumed or produced.

- [ ] **Step 1: Append a decision to `decisions/frontend/astro.md`**

Derive the id first (do not hardcode — re-run in case another decision landed since this plan was written):

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Append (substituting the derived id, `D265` if the command above still returns `264`) at the end of `decisions/frontend/astro.md`:

```markdown
### D265 — `/training` replaces `/trivia` as a flat IA; routine detail pages get a reusable static shell
Status: Accepted · Date: 2026-09-11
Decision: `/trivia` is renamed to `/training`. Quick Subtract relocates to `/training/quick-subtract` as a flat `GameCard`, at the same level as the new `Balanced Training` routine — not nested under a trivia or routines sub-path. `GameCard.astro` gains an optional `duration` prop (renders `Badge.astro`) so a routine's card can show its total time; game cards that pass no `duration` are unchanged. `RoutineDetail.astro` (`components/layout/training/`) is a new shared shell — title, duration pill, an ordered step list (name/duration/plain-language explanation), and a single disabled `Start` button — with no settings, since nothing is configurable yet. `Balanced Training`'s 4 steps are static copy hand-written into its page, not read from `routine_templates`/`routine_steps`.
Reason: the Training/Routine/`ExerciseEngine` model (`09-training-routines.md`, D264) needed its first frontend surface, but wiring a real training-session page (reading the routine snapshot, running `TrainingEngine`, advancing `ExerciseEngine`s) is a separate, larger task gated on schema work for `SWITCHING`/`DOUBLE_PATTERN` that hasn't landed yet. Shipping the IA move and a static detail page now, ahead of that wiring, gives the new model a real landing spot without inventing a second parallel "routines" UI later.
Consequences: `lib/trivia/`, `modules/trivia/`, `components/layout/trivia/` keep their current names — only the page routes moved, not the domain folders (logged as `FINDINGS.md` F77, not fixed here). The `Start` button is inert; wiring it to a real training session is a follow-up task, along with the `SWITCHING`/`DOUBLE_PATTERN` schema and the Warm-Up engine's fixed-to-proportional duration change (`docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` §5-7). D261 (trivia tools stay outside `GameEngine`/`ExerciseEngine`) is unaffected — this is a navigation move, not an architecture reversal.
```

- [ ] **Step 2: Log the naming-mismatch finding in `FINDINGS.md`**

Bump the front-matter `highest-issued:` line (currently `F76`) to `F77`, then append at the end of the file:

```markdown
### F77 — `lib/trivia/`, `modules/trivia/`, `components/layout/trivia/` keep "trivia" naming after the IA rename to `/training`
Status: Open · Found: 2026-09-11 · Task: claude/training-exercises-architecture-pq6v0e
Claim: the "trivia" UI category no longer exists — Quick Subtract is a flat card under `/training`, the same level as Balanced Training (`docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` §2, D265)
Evidence: `app/src/lib/trivia/quick-subtract-play.data.ts`, `app/src/modules/trivia/quick-subtract.module.ts`, `app/src/modules/trivia/dart-scores.module.ts`, `app/src/modules/trivia/interfaces.ts`, `app/src/modules/trivia/types.ts`, `app/src/components/layout/trivia/QuickSubtract.astro` — all still named after the retired "trivia" label; only the page routes moved
Impact: a reader navigating the source tree by folder name expects a `/trivia` route that no longer exists anywhere in the app; the domain-folder name and the shipped IA now disagree, though every import path still resolves correctly
Proposed: rename `lib/trivia/` → `lib/training/`, `modules/trivia/` → `modules/training/`, `components/layout/trivia/` → `components/layout/training/` in a follow-up task, updating every import, `app/src/modules/types.ts`/`app/src/modules/interfaces.ts`'s barrel re-exports, and `decisions/frontend/architecture.md`'s D261 cross-reference
```

- [ ] **Step 3: Update the Component Inventory**

In `docs/architecture/07-Frontend/08-Component-Inventory.md`, update the `GameCard.astro` row to mention the new prop, and add a row for `RoutineDetail.astro`:

```markdown
| `GameCard.astro` | Games-index entry | `href`, `title`, `caption`, `duration` (optional pill, e.g. "30 min") (2026-09-11) |
```

Add a new row (same table, alongside the other shared/layout entries) for:

```markdown
| `RoutineDetail.astro` | Routine-detail shell: title + duration pill, ordered step list, disabled `Start` CTA | `title`, `durationLabel`, `steps` (2026-09-11) |
```

- [ ] **Step 4: Run the findings and decision gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-findings-log.sh
bash scripts/check-decision-ids.sh
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add decisions/frontend/astro.md FINDINGS.md docs/architecture/07-Frontend/08-Component-Inventory.md
git commit -m "docs: log D265, F77, and the Component Inventory for the /training IA move"
```

---

### Task 5: Full validation and branch check

**Files:** None (verification only).

- [ ] **Step 1: Full app validation**

```bash
cd app && npm run validate:app
```

Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Full test suite**

```bash
cd app && npx vitest run
```

Expected: all tests PASS (no regressions from the `/trivia` → `/training` rename).

- [ ] **Step 3: Run the repo's gate scripts**

Invoke the `run-all-gates` skill (or, if unavailable in this session, run each script listed under `app/CLAUDE.md`'s pre-commit hooks manually: file-locations, findings-log, decision-ids, style-tokens, astro-conventions) and confirm every one passes.

- [ ] **Step 4: Confirm branch state**

```bash
git status
git log --oneline -6
```

Confirm a clean working tree, 4 commits on top of the task branch (Tasks 1-4), and that the branch is not `main`.

- [ ] **Step 5: Report**

Summarize in the completion report: routes moved (`/trivia` → `/training`, `/trivia/quick-subtract` → `/training/quick-subtract`), new `Balanced Training` detail page live at `/training/balanced-training`, `D265` and `F77` logged, and the explicit deferred list (ping sound, warm-up highlight, `SWITCHING`/`DOUBLE_PATTERN`/`LADDER` schema, `Start` wiring, `lib/trivia`/`modules/trivia` rename) carried forward unchanged from the spec.
