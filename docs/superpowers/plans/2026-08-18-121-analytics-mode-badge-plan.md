# Analytics-mode badge (issue #121) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-width "Analytics mode — only games that support it are shown." text block on `/games` with a small blue pill-tag badge reading "analytics", shown inline with the page title, top-right.

**Architecture:** Add one new portable presentational primitive, `components/ui/Badge.astro` (variant-based pill, no app/store coupling). Wire it into `pages/games/index.astro` in place of the removed `<p>` block, reusing the existing `analyticsMode()` Alpine getter — no new state.

**Tech Stack:** Astro.js, Tailwind v4 (semantic tokens), Alpine.js (`x-show`/`x-cloak` only — no new reactive state), `cn()` (`clsx` + `tailwind-merge`) from `@client/cn`.

## Global Constraints

- Semantic tokens only — never raw palette utilities, never legacy `bg-bg*`/`text-fg*` (`07-Style-Guide.md`).
- Class composition via `cn()` only — never `class:list` (mechanically enforced by `scripts/check-astro-class-composition.sh`).
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold` (`07-Style-Guide.md`).
- Every `x-show` element must also carry `x-cloak` (`10-Frontend-Agent-Guide.md`).
- Forward leftover attributes as `{...props}` — never `{...rest}` (not needed here — `Badge.astro` has a closed prop set, no passthrough).
- Frontmatter order: `interface Props` → `// Props` → imports (`// Layouts` · `// Components` · `// Icons` · `// Lib`) → `// Data` → `// Styles` (`05-Astro-Components.md`).
- Template comments `{/* ... */}` only — never `<!-- -->`.
- No inline `//`/`/* */` comments inside TS function bodies (n/a here — no function bodies added).
- `.astro` markup/branching logic stays untested (D101) — no Astro-component test runner exists in this project.
- Badge text stays lowercase `analytics`, matching the issue's own wording.
- No engine/schema/API/store change — pure display layer.

---

### Task 1: Create the `Badge.astro` primitive

**Files:**
- Create: `app/src/components/ui/Badge.astro`

**Interfaces:**
- Produces: `Badge` component, default export, props `{ variant?: "accent" | "error" | "neutral"; class?: string }` (default `variant = "accent"`), renders `<span>` wrapping a default `<slot />`.

- [ ] **Step 1: Write the component**

```astro
---
/**
 * Small status/label pill.
 * @param {"accent"|"error"|"neutral"} [variant]
 * @param {string} [class] Extra classes (e.g. text size, merged last)
 */
interface Props {
  variant?: "accent" | "error" | "neutral";
  class?: string;
}

// Props
const { variant = "accent", class: classNameProp }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const variantClasses = {
  accent: "border border-accent/25 bg-accent-muted text-accent",
  error: "border border-error/25 bg-error-muted text-error",
  neutral: "bg-surface-overlay text-muted-foreground",
}[variant];

const className = cn(
  "inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold",
  variantClasses,
  classNameProp,
);
---

<span class={className}><slot /></span>
```

Note: text size is deliberately not in the base classes — it varies by call site, so callers pass it via `class` (merged last, wins any conflict via `cn()`'s `twMerge`).

- [ ] **Step 2: Verify Astro can type-check the new file**

Run: `cd app && npx astro check`
Expected: `0 errors` (this file has no other consumer yet, so it only needs to compile cleanly on its own — Task 2 wires it up).

- [ ] **Step 3: Commit**

```bash
cd app && git add src/components/ui/Badge.astro
git commit -m "Add Badge.astro primitive"
```

---

### Task 2: Wire the badge into the games index page

**Files:**
- Modify: `app/src/pages/games/index.astro:1-27`

**Interfaces:**
- Consumes: `Badge` from Task 1 (`components/ui/Badge.astro`), default export, props as above.

- [ ] **Step 1: Add the import**

In `app/src/pages/games/index.astro`, add the import alongside the existing ones (frontmatter currently has no `// Layouts`/`// Components` section headers — match existing style, don't introduce new headers as an unrelated diff):

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import Badge from "@components/ui/Badge.astro";
import GameCard from "@components/layout/games/GameCard.astro";
import { GAME_CARDS } from "@lib/game/rulesets/games-visibility";
---
```

- [ ] **Step 2: Replace the `<h1>` + text-block markup**

Find (current lines 14–27):

```astro
    <h1 class="text-xl font-semibold text-foreground">Games</h1>

    <div
      class="space-y-4"
      x-show="!$store.settings.loading"
      x-cloak
    >
      <p
        class="alert rounded-md border border-border px-4 py-3 text-sm text-muted-foreground"
        x-show="analyticsMode()"
        x-cloak
      >
        Analytics mode — only games that support it are shown.
      </p>
```

Replace with:

```astro
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-foreground">Games</h1>
      <Badge
        class="text-xs"
        x-show="analyticsMode()"
        x-cloak
      >
        analytics
      </Badge>
    </div>

    <div
      class="space-y-4"
      x-show="!$store.settings.loading"
      x-cloak
    >
```

The full file's `<div class="p-4 space-y-4" x-data="gamesIndex()">` body now reads:

```astro
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-foreground">Games</h1>
      <Badge
        class="text-xs"
        x-show="analyticsMode()"
        x-cloak
      >
        analytics
      </Badge>
    </div>

    <div
      class="space-y-4"
      x-show="!$store.settings.loading"
      x-cloak
    >
      {
        GAME_CARDS.map((game) => (
          <div
            x-show={`isVisible('${game.rulesetVersionKey}')`}
            x-cloak
          >
            <GameCard
              href={game.href}
              title={game.title}
              caption={game.caption}
            />
          </div>
        ))
      }

      <div
        class="alert rounded-md border border-border px-4 py-3 space-y-2"
        x-show="noneVisible()"
        x-cloak
      >
        <p class="text-sm text-muted-foreground">
          No game supports your current app mode, so there is nothing to start
          here until you pick a mode one of them records.
        </p>
        <a
          class="text-sm text-accent"
          href="/profile"
        >
          Change your app mode on your profile
        </a>
      </div>
    </div>
```

(The loading-skeleton block below, and everything else in the file, is unchanged.)

- [ ] **Step 3: Format check**

Run: `cd app && npm run format:check`
Expected: clean (0 files needing formatting). If it reports the file, run `npm run format` and re-check.

- [ ] **Step 4: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: passes (0 violations) — confirms `x-show`/`x-cloak` pairing and template comment rules.

- [ ] **Step 5: Astro class composition gate**

Run: `bash scripts/check-astro-class-composition.sh` (from repo root)
Expected: passes — confirms no `class:list`/manual `.filter(Boolean).join(` was introduced.

- [ ] **Step 6: Type-check**

Run: `cd app && npx astro check`
Expected: `0 errors`.

- [ ] **Step 7: Manual browser verification**

Run: `cd app && astro dev --background`, then open `/games` (or `astro dev status`/`astro dev logs` to confirm it's up).

Confirm:
1. With analytics app mode active (Settings → App mode → Analytics): the blue "analytics" pill renders top-right, inline with "Games" — no leftover text block.
2. With recreational app mode active: neither the pill nor the old text block renders.

Stop the dev server when done: `astro dev stop`.

- [ ] **Step 8: Commit**

```bash
cd app && git add src/pages/games/index.astro
git commit -m "Replace analytics-mode text block with a badge on /games"
```

---

### Task 3: Context maintenance

**Files:**
- Possibly modify: `docs/architecture/00-Context-Map.md` (File Inventory + version history entry), per root `CLAUDE.md`'s mandatory Context Maintenance protocol.

- [ ] **Step 1: Run the context-maintenance skill**

Invoke the `context-maintenance` skill (per root `CLAUDE.md`, mandatory before claiming the task done). It determines whether `Badge.astro` and this plan/spec need registering in `00-Context-Map.md`'s File Inventory and whether a version-history line is needed, and applies those edits itself.

- [ ] **Step 2: Run the full gate suite**

Invoke the `run-all-gates` skill (covers changed areas — here, `app/` frontend — dispatching the relevant `check-*.sh` scripts and `validate:app`).

- [ ] **Step 3: Commit any context-maintenance edits**

```bash
git add -A
git commit -m "Context maintenance for issue #121 badge"
```

(Skip this step if the context-maintenance skill made no file changes.)

---

## Notes for the implementer

- This is a two-file change (`Badge.astro` new, `games/index.astro` modified) plus whatever context-maintenance requires — no database, API, or engine work.
- No `decisions/**` entry is expected: this is reuse of already-decided styling patterns (semantic tokens, `cn()`, primitive-component extraction), matching the precedent noted in the spec (1.7.42-class fix).
- Do not add a `.test.ts` for `Badge.astro` — `.astro` markup has no test runner in this project (D101); this is a deliberate, documented gap, not an oversight.
