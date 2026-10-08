# Brand Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `app/src/styles/global.css` tokens with Brand Style so phased UI work composes from tokens only.

**Architecture:** Extend `global.css` in place: `:root` values → `@theme inline` colour maps, `@theme` type/radius/spacing scales, `@utility` surfaces. A vitest file reads the CSS as text and pins every new token (precedent: `app/tests/lib/ui/chart-tokens.test.ts`). Docs + gate follow one new decision (D428).

**Tech Stack:** Tailwind CSS v4 (`@theme`, `@utility`), Astro, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-brand-tokens-design.md`

## Global Constraints

- Branch `feat/brand-tokens` (off `origin/main`); do not touch `feat/profile-redesign`.
- Keep current semantic names; no renames. No component markup changes.
- No new asset or icon files.
- Colours in OKLCH, values verbatim from spec.
- Coral `oklch(68% 0.15 30)` is the error hue; `--missed*` alias `--error*`.
- `font-medium` allowed after Task 3; banned until then (gate still runs).
- No inline `//` comments in function bodies under `app/src` (gate); CSS `/* */` fine.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run commands from `app/` unless a path says otherwise.

## Review Focus

- Retuned `--error` shifts every `btn-error` / `alert-error` / `input-error` from red to coral — expected; confirm contrast of `--error-foreground` on `--error` still reads (visual check, Task 4).
- `glass` losing `shadow-sm` flattens every glass card — expected per spec; confirm nav and cards still separate from backdrop (visual, Task 4).
- `.field-inset` rest state via `@apply inset-well` must keep its `:focus` ring (test in Task 2 pins `.field-inset:focus` still present).
- `text-title` / `text-value` etc. must not collide with existing Tailwind keys — `npm run check` + `npm run build` catch unknown utilities (Task 4).
- `--missed` alias must keep D427 consumers rendering coral (test in Task 1 pins alias).

---

### Task 1: Colour, type, radius, spacing tokens

**Files:**
- Create: `app/tests/lib/ui/brand-tokens.test.ts`
- Modify: `app/src/styles/global.css` (`:root` ~L7-52, `@theme inline` ~L55-127, `body::after` ~L213)

**Interfaces:**
- Produces: CSS vars `--placeholder`, `--accent-deep-blue`, `--scrim`, `--gradient-blue-glass`; utilities `text-placeholder`, `bg-scrim`, `bg-accent-deep-blue`, `bg-blue-glass`, `text-hero|title|value|tile|card-title|button|eyebrow|eyebrow-lg`, `rounded-row|key|switch|board|sheet`, `size-hit`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../../src/styles/global.css", import.meta.url),
  "utf8",
);

function decl(name: string): string | undefined {
  return css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"))?.[1].trim();
}

describe("brand colour tokens", () => {
  it("uses coral as the error hue", () => {
    expect(decl("error")).toBe("oklch(68% 0.15 30)");
    expect(decl("error-hover")).toBe("oklch(63% 0.15 30)");
    expect(decl("error-muted")).toBe("oklch(68% 0.15 30 / 0.12)");
    expect(decl("error-foreground")).toBe("oklch(96% 0.01 30)");
  });

  it("aliases missed to error", () => {
    expect(decl("missed")).toBe("var(--error)");
    expect(decl("missed-muted")).toBe("var(--error-muted)");
  });

  it.each([
    ["placeholder", "oklch(48% 0 0)"],
    ["accent-deep-blue", "oklch(44.3% 0.11 240.79)"],
    ["scrim", "oklch(0% 0 0 / 0.6)"],
  ])("defines --%s", (name, value) => {
    expect(decl(name)).toBe(value);
  });

  it("defines the blue glass gradient", () => {
    expect(decl("gradient-blue-glass")).toMatch(
      /^linear-gradient\(\s*138deg,\s*oklch\(47% 0\.13 238 \/ 0\.95\) 22%,\s*oklch\(18% 0\.06 245 \/ 0\.95\) 82%\s*\)$/,
    );
  });

  it.each([
    ["color-placeholder", "var(--placeholder)"],
    ["color-accent-deep-blue", "var(--accent-deep-blue)"],
    ["color-scrim", "var(--scrim)"],
    ["background-image-blue-glass", "var(--gradient-blue-glass)"],
  ])("maps --%s in @theme", (name, value) => {
    expect(decl(name)).toBe(value);
  });

  it("vignette reads the deep-blue token", () => {
    expect(css).not.toMatch(/oklch\(44\.3% 0\.11 240\.79 \/ 0\.3\)/);
    expect(css).toMatch(/color-mix\(in oklch, var\(--accent-deep-blue\) 30%, transparent\)/);
  });
});

describe("brand type scale", () => {
  it.each([
    ["hero", "4.5rem", "1", "-0.02em"],
    ["title", "1.625rem", "1.2", "0.02em"],
    ["value", "1.875rem", "1", "0"],
    ["tile", "1.25rem", "1.2", "0"],
    ["card-title", "0.8125rem", "1.3", "0.06em"],
    ["button", "0.9375rem", "1.3", "0"],
    ["eyebrow", "0.625rem", "1.2", "0.12em"],
    ["eyebrow-lg", "0.75rem", "1.2", "0.14em"],
  ])("defines text-%s", (name, size, lh, ls) => {
    expect(decl(`text-${name}`)).toBe(size);
    expect(decl(`text-${name}--line-height`)).toBe(lh);
    expect(decl(`text-${name}--letter-spacing`)).toBe(ls);
  });
});

describe("brand radius and spacing", () => {
  it.each([
    ["radius-row", "0.875rem"],
    ["radius-key", "1.375rem"],
    ["radius-switch", "1.625rem"],
    ["radius-board", "1.75rem"],
    ["radius-sheet", "2rem"],
    ["spacing-hit", "2.75rem"],
  ])("defines --%s", (name, value) => {
    expect(decl(name)).toBe(value);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/ui/brand-tokens.test.ts`
Expected: FAIL — `error` is `oklch(65% 0.2 25)`, new vars undefined.

- [ ] **Step 3: Edit `:root`**

Replace the error block:

```css
  --error: oklch(68% 0.15 30);
  --error-hover: oklch(63% 0.15 30);
  --error-muted: oklch(68% 0.15 30 / 0.12);
  --error-foreground: oklch(96% 0.01 30);
```

Replace the two D427 missed lines:

```css
  --missed: var(--error);
  --missed-muted: var(--error-muted);
```

Add after `--accent-foreground-muted`:

```css
  --accent-deep-blue: oklch(44.3% 0.11 240.79);
  --gradient-blue-glass: linear-gradient(
    138deg,
    oklch(47% 0.13 238 / 0.95) 22%,
    oklch(18% 0.06 245 / 0.95) 82%
  );
```

Add after `--faint-foreground`:

```css
  --placeholder: oklch(48% 0 0);
  --scrim: oklch(0% 0 0 / 0.6);
```

- [ ] **Step 4: Edit `@theme inline`**

After `--color-accent-foreground-muted`:

```css
  --color-accent-deep-blue: var(--accent-deep-blue);
  --background-image-blue-glass: var(--gradient-blue-glass);
```

After `--color-faint-foreground`:

```css
  --color-placeholder: var(--placeholder);
  --color-scrim: var(--scrim);
```

After `--font-mono` line, add the type scale:

```css

  --text-hero: 4.5rem;
  --text-hero--line-height: 1;
  --text-hero--letter-spacing: -0.02em;
  --text-title: 1.625rem;
  --text-title--line-height: 1.2;
  --text-title--letter-spacing: 0.02em;
  --text-value: 1.875rem;
  --text-value--line-height: 1;
  --text-value--letter-spacing: 0;
  --text-tile: 1.25rem;
  --text-tile--line-height: 1.2;
  --text-tile--letter-spacing: 0;
  --text-card-title: 0.8125rem;
  --text-card-title--line-height: 1.3;
  --text-card-title--letter-spacing: 0.06em;
  --text-button: 0.9375rem;
  --text-button--line-height: 1.3;
  --text-button--letter-spacing: 0;
  --text-eyebrow: 0.625rem;
  --text-eyebrow--line-height: 1.2;
  --text-eyebrow--letter-spacing: 0.12em;
  --text-eyebrow-lg: 0.75rem;
  --text-eyebrow-lg--line-height: 1.2;
  --text-eyebrow-lg--letter-spacing: 0.14em;
```

After `--radius-2xl: 1.25rem;`:

```css
  --radius-row: 0.875rem;
  --radius-key: 1.375rem;
  --radius-switch: 1.625rem;
  --radius-board: 1.75rem;
  --radius-sheet: 2rem;

  --spacing-hit: 2.75rem;
```

- [ ] **Step 5: Repoint vignette in `body::after`**

```css
    background: radial-gradient(
      ellipse 100% 80% at 50% 100%,
      transparent 30%,
      color-mix(in oklch, var(--accent-deep-blue) 30%, transparent)
    );
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/lib/ui/brand-tokens.test.ts tests/lib/ui/chart-tokens.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/tests/lib/ui/brand-tokens.test.ts app/src/styles/global.css
git commit -m "feat(tokens): brand colour, type, radius scale

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Surface utilities

**Files:**
- Modify: `app/tests/lib/ui/brand-tokens.test.ts` (append)
- Modify: `app/src/styles/global.css` (`@utility glass` ~L278, after `@utility glass-button`, `.accent-orb` ~L421, `.field-inset` ~L507)

**Interfaces:**
- Consumes: `--gradient-blue-glass`, `--accent`, `rounded-sheet` (Task 1).
- Produces: utilities `glass` (retuned), `glass-blue`, `glass-info`, `inset-well`, `inset-well-muted`, `glass-sheet`.

- [ ] **Step 1: Append failing tests**

```ts
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found`);
  return css.slice(start, css.indexOf("\n}", start) + 2);
}

describe("brand surfaces", () => {
  it("glass has no drop shadow", () => {
    expect(block("@utility glass")).not.toMatch(/shadow-sm/);
  });

  it.each([
    "@utility glass-blue",
    "@utility glass-info",
    "@utility inset-well",
    "@utility inset-well-muted",
    "@utility glass-sheet",
  ])("defines %s", (selector) => {
    expect(() => block(selector)).not.toThrow();
  });

  it("glass-blue and accent-orb read the gradient token", () => {
    expect(block("@utility glass-blue")).toMatch(/var\(--gradient-blue-glass\)/);
    expect(css).toMatch(/\.accent-orb \{\s*background: var\(--gradient-blue-glass\);/);
  });

  it("inset-well is black 35% with inner shadow", () => {
    const b = block("@utility inset-well");
    expect(b).toMatch(/background: oklch\(0% 0 0 \/ 0\.35\)/);
    expect(b).toMatch(/inset 0 1px 2px oklch\(0% 0 0 \/ 0\.4\)/);
  });

  it("inset-well-muted is black 20%", () => {
    expect(block("@utility inset-well-muted")).toMatch(/oklch\(0% 0 0 \/ 0\.2\)/);
  });

  it("glass-sheet uses the sheet radius and 16px blur", () => {
    const b = block("@utility glass-sheet");
    expect(b).toMatch(/rounded-sheet/);
    expect(b).toMatch(/backdrop-blur-lg/);
  });

  it("field-inset rests on inset-well and keeps its focus ring", () => {
    expect(css).toMatch(/\.field-inset \{\s*@apply inset-well;\s*\}/);
    expect(css).toMatch(/\.field-inset:focus \{/);
  });
});
```

Note: Tailwind v4 `backdrop-blur-sm` = 8px, `backdrop-blur-lg` = 16px.

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/lib/ui/brand-tokens.test.ts`
Expected: FAIL — `@utility glass-blue not found`, glass has `shadow-sm`.

- [ ] **Step 3: Retune `glass`**

```css
@utility glass {
  @apply bg-radial-[at_50%_0%] from-white/5 to-white/10 to-85% border-y border-white/25 backdrop-blur-sm;
}
```

- [ ] **Step 4: Add utilities after `@utility glass-button { … }`**

```css
@utility glass-blue {
  @apply backdrop-blur-sm;
  background: var(--gradient-blue-glass);
  box-shadow:
    inset 0 1px 0 oklch(100% 0 0 / 0.1),
    0 0 20px 3px color-mix(in oklch, var(--accent) 12%, transparent),
    inset 0 0 0 1px oklch(100% 0 0 / 0.06);
}

@utility glass-info {
  @apply border-x-0 border-y backdrop-blur-sm;
  background: color-mix(in oklch, var(--accent) 8%, transparent);
  border-top-color: color-mix(in oklch, var(--accent) 45%, transparent);
  border-bottom-color: color-mix(in oklch, var(--accent) 25%, transparent);
}

@utility inset-well {
  @apply backdrop-blur-sm;
  background: oklch(0% 0 0 / 0.35);
  box-shadow: inset 0 1px 2px oklch(0% 0 0 / 0.4);
}

@utility inset-well-muted {
  background: oklch(0% 0 0 / 0.2);
  box-shadow: inset 0 1px 2px oklch(0% 0 0 / 0.3);
}

@utility glass-sheet {
  @apply rounded-sheet bg-radial-[at_50%_0%] from-white/5 to-white/10 to-85% border-y border-white/25 backdrop-blur-lg;
  box-shadow: 0 24px 60px oklch(0% 0 0 / 0.5);
}
```

- [ ] **Step 5: Repoint `.accent-orb` background**

```css
  .accent-orb {
    background: var(--gradient-blue-glass);
```

(keep its existing `box-shadow` lines unchanged)

- [ ] **Step 6: `.field-inset` rest state**

Replace the rest-state block (not `:focus`):

```css
  .field-inset {
    @apply inset-well;
  }
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/lib/ui/brand-tokens.test.ts`
Expected: PASS.

- [ ] **Step 8: Build to prove utilities compile**

Run: `npm run build`
Expected: exit 0, no "Cannot apply unknown utility class".

- [ ] **Step 9: Commit**

```bash
git add app/tests/lib/ui/brand-tokens.test.ts app/src/styles/global.css
git commit -m "feat(tokens): brand surface utilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Allow weight 500 — gate, decision, docs

**Files:**
- Modify: `scripts/check-style-tokens.sh:3,26-31,83`
- Modify: `decisions/frontend/style.md` (append D428; bump `updated:`)
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (version line, Tokens table, radius table, Typography, Surfaces & nesting, Primitives, Anti-patterns)
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md:118,147`
- Modify: `app/src/components/CLAUDE.md:12,15`
- Modify: `docs/architecture/00-File-Inventory.md:499`

**Interfaces:**
- Consumes: token names from Tasks 1–2 (doc tables list them verbatim).

- [ ] **Step 1: Prove the gate currently bans it**

```bash
printf '.x{@apply font-medium;}\n' > app/src/styles/__probe.css
bash scripts/check-style-tokens.sh; echo "exit=$?"
```
Expected: `FAIL: font-medium found`, `exit=1`.

- [ ] **Step 2: Remove the ban from the gate**

Delete lines 26–31 (the `FONT_MEDIUM=` block). Header line 3 becomes:

```bash
# - no {...rest} spread, no raw bg-bg*/text-fg* palette utilities (font-medium allowed since D428)
```

Line 83 OK message becomes:

```bash
echo "OK: no {...rest}, raw bg-bg*/text-fg*, important modifier (prefix or suffix), or leading-dash arbitrary (-prop-[…]) under app/src."
```

- [ ] **Step 3: Verify gate passes with probe, then remove probe**

```bash
bash scripts/check-style-tokens.sh; echo "exit=$?"
rm app/src/styles/__probe.css
```
Expected: `OK: …`, `exit=0`.

- [ ] **Step 4: Append D428 to `decisions/frontend/style.md`**

```markdown

### D428 — Brand Style is the token source; coral error; weight 500
Status: Accepted · Date: 2026-10-08
Decision: `global.css` tokens follow the Claude Design `Brand Style.dc.html` reference. Error hue is coral `oklch(68% 0.15 30)`; `--missed`/`--missed-muted` alias `--error`/`--error-muted`. New tokens: `--placeholder`, `--accent-deep-blue`, `--scrim`, `--gradient-blue-glass`; type scale `text-hero|title|value|tile|card-title|button|eyebrow|eyebrow-lg`; radii `rounded-row|key|switch|board|sheet`; `size-hit` (44px). Surfaces: `glass` drops its shadow; new `glass-blue`, `glass-info`, `inset-well`, `inset-well-muted`, `glass-sheet`. `.accent-orb` and `.field-inset` build on them. Weight 500 (`font-medium`) is allowed; `check-style-tokens.sh` no longer bans it. Names stay semantic; no icon or asset files are added — design colour variants map to `currentColor` icons.
Reason: phased UI work needs every Brand Style value as a token first; the design uses 500 for values and mono labels, and one warning hue reads clearer than two.
Consequences: errors, destructive buttons and alerts turn coral; glass cards lose their drop shadow. Components adopt the new tokens in later phases. Token presence is pinned by `tests/lib/ui/brand-tokens.test.ts`.
Supersedes: D108, D126 and D161 (the `font-medium` ban only); D426 (500→400 rendering note).
```

Set front-matter `updated: 2026-10-08`.

- [ ] **Step 5: Style guide edits** (`07-Style-Guide.md`)

Version line:

```markdown
> **Version:** 0.3.0 (2026-10-08 — Brand Style tokens: coral error, type scale, new radii, surfaces, weight 500 allowed, D428; prior 0.2.6 was `--chart-<name>` tokens, D374)
```

Tokens table — replace rows / add:

```markdown
| Surfaces | `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`, `glass` (cards; no shadow), `glass-tinted`, `glass-raised`, `glass-tinted-raised`, `glass-button` (raised glass: buttons), `glass-blue` (selected pill, avatar), `glass-info` (rules/info card), `inset-well` (tracks, fields), `inset-well-muted` (undo/delete keys, exit), `glass-sheet` (bottom sheets), `bg-scrim` (modal backdrop) (2026-10-08) |
| Text | `text-foreground`, `text-soft-foreground` (78%), `text-muted-foreground` (70%, captions/labels), `text-muted` (55%, body), `text-faint-foreground` (50%), `text-placeholder` (48%, empty fields only) |
| Accent | `accent`, `accent-hover`, `accent-muted`, `accent-foreground`, `accent-glow` (sky); `accent-bright` (sky light: accent text on dark), `accent-foreground-muted`, `accent-deep` (gradient end), `accent-deep-blue` (chart bars, vignette), `bg-blue-glass` (2026-10-08) |
| States | `error` / `error-hover` / `error-muted` / `error-foreground` (coral); `missed` / `missed-muted` alias error; `success` / `success-muted` |
| Type scale | `text-hero` 72, `text-title` 26 (screen title), `text-value` 30, `text-tile` 20, `text-card-title` 13, `text-button` 15, `text-eyebrow` 10 / `text-eyebrow-lg` 12 (mono caps); body `text-sm`, caption `text-xs` |
| Hit target | `size-hit` (44px) minimum for any tap target |
```

Radius table — append rows:

```markdown
| `rounded-row` | 14px | Select option rows |
| `rounded-key` | 22px | Keypad / tap-input keys |
| `rounded-switch` | 26px | Vertical switch track |
| `rounded-board` | 28px | Board container |
| `rounded-sheet` | 32px | Bottom sheets (`glass-sheet`) |
| `rounded-full` | pill | Pills, nav, sliders, icon buttons |
```

Typography table — replace the Weight row:

```markdown
| Weight | `font-normal`, `font-medium`, `font-semibold`, `font-bold`. Display (Michroma) 400 only; Montserrat 400/500/600/700; JetBrains Mono 500/600 (D428) |
```

Add rows:

```markdown
| Screen / card titles | Screen title `font-display text-title`; card title `font-display text-card-title` — never bold Montserrat |
| Eyebrows | `font-mono font-semibold uppercase text-eyebrow` (or `-lg`); tracking is in the token |
```

Surfaces & nesting — append rows:

```markdown
| Recessed track / field / key | `inset-well` (`inset-well-muted` for secondary keys) |
| Selected pill / avatar | `glass-blue` |
| Bottom sheet modal | `glass-sheet` over `bg-scrim` |
| Info / rules card | `glass-info` |
```

Primitives table — `@utility glass…` row append: `; glass-blue / glass-info / inset-well / inset-well-muted / glass-sheet (2026-10-08, D428)`.

Anti-patterns: delete the `font-medium` row.

Theme section: add bullet:

```markdown
- **Brand reference.** Token values come from the Claude Design `Brand Style.dc.html` file; a new value enters `global.css` as a token before any component uses it (D428).
```

- [ ] **Step 6: Agent guide + components CLAUDE.md + inventory**

`10-Frontend-Agent-Guide.md:118` — replace `Never \`font-medium\` — prefer \`font-normal\` / \`font-semibold\` / \`font-bold\`.` with `Weights: \`font-normal\` / \`font-medium\` / \`font-semibold\` / \`font-bold\` (D428).` Line 147 — remove `no \`font-medium\`, `.

`app/src/components/CLAUDE.md:12` → `- Weights: \`font-normal\` / \`font-medium\` / \`font-semibold\` / \`font-bold\` (D428)`. Line 15 — drop `font-medium/` from the enforced list and append `; font-medium ban lifted 2026-10-08, D428`.

`00-File-Inventory.md:499` → `| \`scripts/check-style-tokens.sh\` | Guard: no \`{...rest}\`, raw \`bg-bg*\`/\`text-fg*\`, Tailwind important modifier, or leading-dash arbitrary (\`-prop-[…]\`) under \`app/src/**/*.{astro,css}\` | canonical |`. Add row for `app/tests/lib/ui/brand-tokens.test.ts` beside the `chart-tokens.test.ts` row, same column shape: `Pins D428 brand tokens and surface utilities in global.css`.

- [ ] **Step 7: Check no stale ban text remains**

Run (repo root): `grep -rn "font-medium" --include='*.md' docs/architecture app scripts | grep -v D428`
Expected: no line asserting a ban.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-style-tokens.sh decisions/frontend/style.md docs/architecture app/src/components/CLAUDE.md
git commit -m "docs(style): D428 brand tokens, allow weight 500

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verify, context upkeep, PR

**Files:** none new (gate fallout only).

- [ ] **Step 1: Gates** — invoke `run-all-gates` skill; it dispatches the `check-*.sh` set incl. `check-style-tokens.sh`. Expected: all PASS.
- [ ] **Step 2: App validation** — invoke `validate-app` skill (`npm run validate:app`). Expected: tests + `astro check` PASS. If no `DATABASE_URL`, run `npm test && npm run check && npm run build` and report the db steps as skipped.
- [ ] **Step 3: Visual check** — invoke `run` skill; load Home, Profile, Games, a 501 play screen and a form error (Profile weight out of range). Confirm: coral error ring readable, glass cards still separate from backdrop, profile fields unchanged at rest and on focus.
- [ ] **Step 4: Context maintenance** — invoke `context-maintenance` skill (map, CLAUDE.md sync, graph, discovered-work issues).
- [ ] **Step 5: Finish** — invoke `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push + PR to `main`).
