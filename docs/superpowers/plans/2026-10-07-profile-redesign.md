# Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/profile` matches `Profile.dc.html` (view + edit frames) at 390px, behaviour unchanged, stats line from a fixture.

**Architecture:** Restyle the five existing profile components in place; add one new `ProfileIdentity` component reading a fixture factory `profileSnapshot()` plus `$store.profile`. New colours go into `global.css` as tokens/classes; everything else is Tailwind utilities.

**Tech Stack:** Astro, Alpine.js, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-profile-redesign-design.md`

## Global Constraints

- Raw `oklch(...)` only in `app/src/styles/global.css`, never in components.
- No `font-medium` (repo gate). Design weight 500 text renders at default weight (400); 600 → `font-semibold`.
- `font-display` (Michroma) for titles/values; `font-mono` only for eyebrows.
- No inline `//` comments inside function bodies; JSDoc headers on components.
- `x-show` always paired with `x-cloak`; no `class:list`; no template HTML comments.
- Bottom nav untouched. `prerender = true` stays on the page.
- Display name `maxlength=24` client-side only (no API/schema change).

## Review Focus

1. Blank or whitespace display name (load failed / first login) → avatar shows nothing, no `undefined`; `initials("  ")` = `""`.
2. Long display name (24 chars) → identity name and field value truncate, no row overflow at 390px.
3. Weight `null` → field shows "Not set", not "null g".
4. Counter with `null`/number model (weight row) → counter only renders on rows given `maxlength`; display name model is always a string.
5. App mode stored as RECREATIONAL+DETAILED_DARTS → neither pill on, Quick score still holds the tab stop (existing logic kept verbatim).

Tests for 1 are in Task 1; 2–5 are markup and verified in Task 6's visual check (no Astro component runner, D101).

---

### Task 1: `profileSnapshot()` fixture factory

**Files:**
- Create: `app/src/lib/profile/types.ts`
- Create: `app/src/lib/profile/profile-snapshot.data.ts`
- Modify: `app/src/lib/types.ts` (barrel: add `export * from "./profile/types";`)
- Modify: `app/src/lib/client/alpine/register-route-data.ts` (import + `Alpine.data("profileSnapshot", profileSnapshot);` after `homeSnapshot`)
- Test: `app/tests/lib/profile/profile-snapshot.data.test.ts`

**Interfaces:**
- Produces: `ProfileStats = { games: number; darts: number; minutes: number }`, `ProfileSnapshotContext = { stats: ProfileStats; statsLine: string; initials: (name: string) => string }`, `formatStatsLine(stats: ProfileStats): string`, `initials(name: string): string`, `profileSnapshot(): ProfileSnapshotContext`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  formatStatsLine,
  initials,
  profileSnapshot,
} from "@lib/profile/profile-snapshot.data";

describe("formatStatsLine", () => {
  it("groups thousands and splits minutes into hours", () => {
    expect(formatStatsLine({ games: 412, darts: 18342, minutes: 3680 })).toBe(
      "412 games · 18,342 darts · 61h 20m",
    );
  });

  it("keeps zero minutes", () => {
    expect(formatStatsLine({ games: 1, darts: 3, minutes: 0 })).toBe(
      "1 games · 3 darts · 0h 0m",
    );
  });
});

describe("initials", () => {
  it("takes one letter from a single word", () => {
    expect(initials("levi")).toBe("L");
  });

  it("takes the first letters of the first two words", () => {
    expect(initials("Levi Broeksma")).toBe("LB");
    expect(initials("  ada   b  lovelace ")).toBe("AB");
  });

  it("is empty for blank names", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
  });
});

describe("profileSnapshot", () => {
  it("returns the fixture stats and their line", () => {
    const snap = profileSnapshot();
    expect(snap.stats).toEqual({ games: 412, darts: 18342, minutes: 3680 });
    expect(snap.statsLine).toBe("412 games · 18,342 darts · 61h 20m");
    expect(snap.initials("Levi")).toBe("L");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/profile/profile-snapshot.data.test.ts`
Expected: FAIL — cannot resolve `@lib/profile/profile-snapshot.data`.

- [ ] **Step 3: Implement**

`app/src/lib/profile/types.ts`:

```ts
/** Career totals shown under the player's name on `/profile`. */
export type ProfileStats = { games: number; darts: number; minutes: number };

/** Alpine scope of `profileSnapshot()`. */
export type ProfileSnapshotContext = {
  stats: ProfileStats;
  statsLine: string;
  initials: (name: string) => string;
};
```

`app/src/lib/profile/profile-snapshot.data.ts`:

```ts
import type { ProfileSnapshotContext, ProfileStats } from "@lib/types";

const STATS: ProfileStats = { games: 412, darts: 18342, minutes: 3680 };

const NUMBER = new Intl.NumberFormat("en-US");

/** `412 games · 18,342 darts · 61h 20m`. */
export function formatStatsLine({ games, darts, minutes }: ProfileStats): string {
  const hours = Math.floor(minutes / 60);
  return `${NUMBER.format(games)} games · ${NUMBER.format(darts)} darts · ${hours}h ${minutes % 60}m`;
}

/** Upper-case first letters of the first two words; blank → `""`. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * Profile identity stats. Fixture values from the design until the data
 * pass replaces them with reads; the returned shape is the contract.
 */
export function profileSnapshot(): ProfileSnapshotContext {
  return { stats: STATS, statsLine: formatStatsLine(STATS), initials };
}
```

Barrel + registration edits as listed under Files.

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npx vitest run tests/lib/profile/profile-snapshot.data.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/profile app/src/lib/types.ts app/src/lib/client/alpine/register-route-data.ts app/tests/lib/profile
git commit -m "feat(profile): profileSnapshot fixture factory"
```

---

### Task 2: Tokens and classes

**Files:** Modify `app/src/styles/global.css`

**Interfaces:** Produces `text-strong-foreground`, `.accent-orb`, `.accent-orb-halo`, `.field-inset` (+ `:focus`).

- [ ] **Step 1:** In `:root`, after `--soft-foreground`, add `--strong-foreground: oklch(86% 0 0);`. In `@theme inline`, after `--color-soft-foreground`, add `--color-strong-foreground: var(--strong-foreground);`.
- [ ] **Step 2:** In `@layer components`, after `.home-day-today`, add:

```css
  .accent-orb {
    background: linear-gradient(
      138deg,
      oklch(47% 0.13 238 / 0.95) 22%,
      oklch(18% 0.06 245 / 0.95) 82%
    );
    box-shadow:
      inset 0 1px 0 oklch(100% 0 0 / 0.1),
      0 0 20px 3px color-mix(in oklch, var(--accent) 12%, transparent),
      inset 0 0 0 1px oklch(100% 0 0 / 0.06);
  }

  .accent-orb-halo {
    box-shadow:
      inset 0 1px 0 oklch(100% 0 0 / 0.1),
      0 0 20px 3px color-mix(in oklch, var(--accent) 12%, transparent),
      0 0 40px 20px color-mix(in oklch, var(--accent) 8%, transparent),
      inset 0 0 0 1px oklch(100% 0 0 / 0.06);
    @apply backdrop-blur-sm;
  }

  .field-inset {
    background: oklch(0% 0 0 / 0.35);
    box-shadow: inset 0 1px 2px oklch(0% 0 0 / 0.4);
    @apply backdrop-blur-sm;
  }

  .field-inset:focus {
    outline: none;
    caret-color: var(--accent);
    box-shadow:
      inset 0 1px 2px oklch(0% 0 0 / 0.4),
      inset 0 0 0 1px var(--accent),
      0 0 0 3px color-mix(in oklch, var(--accent) 25%, transparent);
  }
```

- [ ] **Step 3:** `cd app && npx astro check 2>&1 | tail -3` → 0 errors.
- [ ] **Step 4: Commit** `git commit -am "feat(profile): accent-orb, field-inset, strong-foreground tokens"`

---

### Task 3: Page shell, header, logout, identity

**Files:**
- Modify: `app/src/pages/profile/index.astro`
- Modify: `app/src/components/ui/LogoutButton.astro`
- Create: `app/src/components/layout/profile/ProfileIdentity.astro`

**Interfaces:** Consumes `profileSnapshot()` (`statsLine`, `initials`), `$store.profile.displayName`.

- [ ] **Step 1: Page**

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import AppModeForm from "@components/forms/AppModeForm.astro";
import PlayerSettingsCard from "@components/forms/PlayerSettingsCard.astro";
import LogoutButton from "@components/ui/LogoutButton.astro";
import ProfileIdentity from "@components/layout/profile/ProfileIdentity.astro";
---

<AppLayout
  title="Profile"
  backdrop="home"
>
  <div class="flex flex-col gap-3 px-4 pt-2">
    <div class="flex items-center justify-between px-1 pt-5 pb-3">
      <h1 class="font-display text-[26px]/[normal] tracking-[0.02em]">
        Profile
      </h1>
      <LogoutButton />
    </div>
    <ProfileIdentity />
    <PlayerSettingsCard />
    <AppModeForm />
  </div>
</AppLayout>
```

- [ ] **Step 2: LogoutButton** — `Button variant="secondary" icon loadingExpr="false"` with `class="glass-button size-11 shrink-0 rounded-full p-0 text-foreground"`; icon `class="size-5"`. Keep `x-data="logoutButton()"`, `@click="submit"`, `:disabled="loading"`.
- [ ] **Step 3: ProfileIdentity**

```astro
---
/**
 * Profile identity row inside its own `profileSnapshot()` scope: initials
 * avatar and name from `$store.profile`, fixture stats line.
 */
---

<div
  class="flex items-center gap-3.5 px-1 pt-1 pb-2"
  x-data="profileSnapshot()"
>
  <div
    class="accent-orb accent-orb-halo flex size-14 shrink-0 items-center justify-center rounded-full font-display text-lg/[normal]"
    aria-hidden="true"
    x-text="initials($store.profile.displayName)"
  ></div>
  <div class="flex min-w-0 flex-col gap-1">
    <span
      class="truncate font-display text-lg/[normal]"
      x-text="$store.profile.displayName"
    ></span>
    <span
      class="text-[13px]/[normal] text-strong-foreground"
      x-text="statsLine"
    ></span>
  </div>
</div>
```

- [ ] **Step 4:** `cd app && npx astro check 2>&1 | tail -3 && bash ../scripts/check-astro-conventions.sh` → pass.
- [ ] **Step 5: Commit** `git commit -am "feat(profile): header, glass logout, identity row"` (add new file first).

---

### Task 4: Player settings card + SettingRow

**Files:**
- Modify: `app/src/components/forms/SettingRow.astro`
- Modify: `app/src/components/forms/PlayerSettingsCard.astro`

**Interfaces:** `SettingRow` gains optional `maxlength?: number` prop (passed to input, enables the hint).

- [ ] **Step 1: SettingRow markup** (logic `dataExpr`/`commit` unchanged):
  - Root: `flex flex-col gap-2`.
  - Label: `<label for={id} class="px-0.5 font-mono text-[10px]/[normal] font-semibold tracking-[0.12em] uppercase" :class="editing ? 'text-accent-bright' : 'text-muted-foreground'">{label}</label>`.
  - View: `Button variant="ghost" loadingExpr="false"` (`x-show="!editing" x-cloak`, `ariaLabel={`Edit ${label}`}`, `:disabled`, `@click={openExpr}`) with `class="field-inset flex h-13 w-full items-center justify-between gap-3 rounded-xl border-0 px-4 text-left text-foreground"`; children: value span `truncate text-[15px]/[normal]` with `x-text={displayExpr}`, then `PencilIcon class="size-4 shrink-0 text-muted-foreground"`. Remove the separate pencil Button.
  - Edit: `Input` with `class="field-inset h-13 rounded-xl border-0 px-4 text-[15px]"` plus `maxlength={maxlength}`; same directives as now.
  - Hint (only when `maxlength`): `<span class="px-0.5 text-xs/[normal] text-muted" x-show="editing" x-cloak x-text={`(${modelExpr} ?? '').toString().length + ' / ${maxlength} · saves when you leave the field'`}></span>`.
  - JSDoc: add `@param {number} [maxlength]`.
  - If `Button`/`Input` base classes (`btn`, `input`, border, padding) bleed through `cn`, compare against frame and override with utilities in `class`.
- [ ] **Step 2: PlayerSettingsCard**:
  - Root: `glass flex flex-col gap-4 rounded-2xl p-4 shadow-none`.
  - Title: `<h2 class="font-display text-[13px]/[normal] tracking-[0.06em]">Player settings</h2>`; rows directly in root (no divider wrapper).
  - Labels: "Display name" (add `maxlength={24}`), "Darts", "Weight". Weight `valueExpr="$store.profile.dartsWeightGrams == null ? '' : $store.profile.dartsWeightGrams + ' g'"`, `emptyText="Not set"`.
  - Handed: `<div class="flex flex-col gap-2"><span id="handedness-label" class="px-0.5 font-mono text-[10px]/[normal] font-semibold tracking-[0.12em] text-muted-foreground">HANDED</span><HandednessForm /></div>`.
  - `ErrorAlert` kept (drop `mt-3`; gap handles it).
- [ ] **Step 3:** `npx astro check` + conventions script pass.
- [ ] **Step 4: Commit** `git commit -am "feat(profile): inset setting fields and player settings card"`

---

### Task 5: Segmented pickers

**Files:**
- Modify: `app/src/components/forms/HandednessForm.astro`
- Modify: `app/src/components/forms/AppModeForm.astro`

- [ ] **Step 1: HandednessForm** — root class `field-inset grid grid-cols-2 gap-1 rounded-full p-1`; `optionClass = "flex h-10 items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-150"`; on `:class` → `'accent-orb text-foreground'`, off → `'text-muted-foreground'`. Remove `CheckIcon` import + spans; button text is the label. Keep `aria-labelledby="handedness-label"` replacing `aria-label` only if the label is in the same card (it is) — keep `aria-label="Throwing hand"` to stay safe. Update JSDoc (no checkmark).
- [ ] **Step 2: AppModeForm** — root `glass flex flex-col gap-4 rounded-2xl p-4 shadow-none`; heading block `flex flex-col gap-2`: `h2` `font-display text-[13px]/[normal] tracking-[0.06em]` "App mode", `p` `text-xs/[1.5] text-pretty text-muted` (no italic). Then `flex flex-col gap-2` with eyebrow `MODE` (same classes as HANDED, `id="app-mode-label"`) and the radiogroup (`aria-labelledby="app-mode-heading"` kept) styled as HandednessForm: `field-inset grid grid-cols-2 gap-1 rounded-full p-1`, same option classes, drop checkmarks, keep all `@keydown`/tabindex/disabled logic verbatim. Skeleton: same track with two `h-10 animate-pulse rounded-full bg-surface-raised` pills. JSDoc: drop checkmark sentence.
- [ ] **Step 3:** `npx astro check` + conventions script pass.
- [ ] **Step 4: Commit** `git commit -am "feat(profile): segmented handedness and app-mode pickers"`

---

### Task 6: Visual check, docs, gates, PR

- [ ] **Step 1: Visual check** — run app (`run` skill / `npm run dev` in `app/`), open `/profile` at 390×844, compare with both frames: header 26px title + 44px logout, avatar 56px, card radii 20px, field 52px, pill 40px, gaps 12/16/8px. Check Review Focus 2–5. Fix diffs in the owning component.
- [ ] **Step 2: Docs**
  - `docs/architecture/07-Frontend/08-Component-Inventory.md`: update `LogoutButton`, `AppModeForm`, `HandednessForm`, `PlayerSettingsCard`, `SettingRow` (add `maxlength`) rows; add a `components/layout/profile/` section with `ProfileIdentity`.
  - `decisions/frontend/style.md`: append D426 (profile static pass behind `profileSnapshot()`; `.accent-orb`, `.field-inset`, `--strong-foreground`; segmented pickers drop checkmarks; weight-500 text renders 400 per the no-`font-medium` rule).
  - Spec: status → implemented; note `.profile-card` became `glass shadow-none` utilities and eyebrows stayed utilities.
- [ ] **Step 3: Gates** — `run-all-gates` + `validate-app` skills; `context-maintenance` skill.
- [ ] **Step 4: Commit** docs; **Step 5:** `finishing-a-dart-branch` → push + PR.
