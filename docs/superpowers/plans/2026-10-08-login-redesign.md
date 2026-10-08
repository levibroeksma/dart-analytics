# Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/login` to match Claude Design `Login.dc.html` in its default, focus and error states.

**Architecture:** This is a markup and style pass on `app/src/pages/login/index.astro`. Two additions go into `global.css`, the `--shadow-card` token and the `.field-inset-error` class. The page reuses `glass`, `.field-inset`, `Button variant="sheet-raised"` and `BaseLayout backdrop="home"`. `login.data.ts` does not change.

**Tech Stack:** Astro 5, Alpine.js, Tailwind v4 (`app/src/styles/global.css`, no config file), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-login-redesign-design.md`

## Global Constraints

- **Styling:** semantic tokens and primitives only. No raw oklch in markup, no palette utilities, no important modifier, and build-time classes go through `cn()` in frontmatter.
- **Fonts:** `font-mono` only on the eyebrows. Body and button use `font-sans`. Weights are `font-medium` and `font-semibold`.
- **Template:** comments are `{/* */}` only. Every `x-show` is paired with `x-cloak`. Use Alpine shorthand (`:class`, `@submit.prevent`).
- **Tests:** `.astro` markup is not unit-tested (D101). CSS is pinned in `app/tests/lib/ui/brand-tokens.test.ts`.
- **Commands:** run from `app/` unless a repo-root path is shown. Test with `npm test`.
- **Commits:** messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The branch is `feat/login-redesign`; never commit to `main`.
- **Copy:** stays as today ("Email", "Password", "Sign in"). The eyebrows render it uppercase through CSS.

## Review Focus

1. **Focus on a field that already shows an error:** the accent focus ring must win over the coral ring. `.field-inset:focus` (0,2,0) outranks `.field-inset-error` (0,1,0), and Task 1 pins that order.
2. **A failure that is not about credentials** (network down): the error text and both rings show (user decision). After the next submit clears `error`, the rings drop. This is checked in Task 3 step 3.
3. **iOS autofill:** a field filled by autofill must stay readable on the inset well, not show the white autofill box. Checked in Task 3 step 3, and captured as discovered work if it fails.
4. **A short viewport (390×667, keyboard open):** the card must stay reachable. `main` keeps `overflow-y-auto`. Checked in Task 3 step 3.
5. **Double submit:** "Sign in" stays disabled while `loading`, which `:disabled="loading"` keeps. Checked in Task 3 step 3.

---

### Task 1: Card shadow token and error field ring

**Files:**
- Modify: `app/src/styles/global.css`, in two places:
  - the `@theme inline` block, after `--text-shadow-glow` (around line 93)
  - `@layer components`, just after the `.field-inset:focus` block (around line 651–660)
- Test: `app/tests/lib/ui/brand-tokens.test.ts`

**Interfaces:**
- Produces: the utility `shadow-card` and the class `field-inset-error`, both used in Task 2.

- [ ] **Step 1: Write the failing test.** Append to `brand-tokens.test.ts`:

```ts
describe("login surfaces", () => {
  it("defines the card drop shadow", () => {
    expect(decl("shadow-card")).toBe("0 24px 60px oklch(0% 0 0 / 0.4)");
  });

  it("draws a coral inset ring on an errored inset field", () => {
    expect(css).toMatch(
      /\.field-inset-error \{\s*box-shadow:\s*inset 0 1px 2px oklch\(0% 0 0 \/ 0\.4\),\s*inset 0 0 0 1px var\(--error\);\s*\}/,
    );
  });

  it("keeps the focus ring above the error ring", () => {
    expect(css.indexOf(".field-inset-error {")).toBeGreaterThan(-1);
    expect(css).not.toMatch(/\.field-inset-error:focus/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**

Run: `npm test -- tests/lib/ui/brand-tokens.test.ts`
Expected: FAIL. The `login surfaces` cases fail because `decl("shadow-card")` is undefined and the regex finds no match.

- [ ] **Step 3: Implement.** In `@theme inline`, after `--text-shadow-glow: …;`, add:

```css
  --shadow-card: 0 24px 60px oklch(0% 0 0 / 0.4);
```

In `@layer components`, directly after the closing `}` of `.field-inset:focus`, add:

```css
  .field-inset-error {
    box-shadow:
      inset 0 1px 2px oklch(0% 0 0 / 0.4),
      inset 0 0 0 1px var(--error);
  }
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `npm test -- tests/lib/ui/brand-tokens.test.ts`
Expected: PASS, with every case green.

- [ ] **Step 5: Commit.**

```bash
git add src/styles/global.css tests/lib/ui/brand-tokens.test.ts
git commit -m "feat(login): card shadow token and errored inset field ring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Login page markup

**Files:**
- Modify: `app/src/pages/login/index.astro` (full rewrite of the template; the imports stay the same plus `cn`)

**Interfaces:**
- Consumes: `shadow-card` and `field-inset-error` from Task 1. The existing `glass`, `field-inset`, `rounded-board`, `text-eyebrow`, `text-accent-bright`, `text-error` and `h-13`. `Button` `variant="sheet-raised"` (`h-13 rounded-2xl text-button glass-button text-foreground`). `BaseLayout` prop `backdrop="home"`. `loginForm()`, which exposes `email`, `password`, `error`, `loading` and `submit`.

- [ ] **Step 1: Replace the file content.**

```astro
---
export const prerender = true;

// Layouts·Components·Icons·Lib
import BaseLayout from "@layouts/BaseLayout.astro";
import Input from "@components/forms/Input.astro";
import Button from "@components/forms/Button.astro";
import LogoLockup from "../../assets/logo-lockup.svg";
import { cn } from "@client/cn";

// Styles
const cardClass = cn(
  "glass shadow-card flex flex-col gap-2 rounded-board px-5 pt-7 pb-5",
);
const eyebrowClass = cn(
  "px-0.5 font-mono text-eyebrow font-semibold uppercase text-muted-foreground transition-colors duration-150 group-has-[:focus]:text-accent-bright",
);
const fieldClass = cn(
  "field-inset h-13 rounded-xl border-0 px-4 text-[15px] font-medium",
);
---

<BaseLayout backdrop="home">
  <div class="mx-auto flex h-full max-w-lg flex-col">
    <main
      class="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overscroll-y-contain px-4 py-6"
    >
      <div class={cardClass}>
        <div class="flex justify-center">
          <LogoLockup
            role="img"
            aria-label="Darts Analytics"
            class="h-20 w-[230px]"
          />
        </div>

        <form
          x-data="loginForm()"
          @submit.prevent="submit"
          class="flex flex-col gap-2"
        >
          <label
            for="login-email"
            class="group flex flex-col gap-2"
          >
            <span class={eyebrowClass}>Email</span>
            <Input
              id="login-email"
              type="email"
              name="email"
              autocomplete="email"
              placeholder="example@email.com"
              x-model="email"
              required
              class={fieldClass}
              :class="error && 'field-inset-error'"
            />
          </label>

          <label
            for="login-password"
            class="group flex flex-col gap-2"
          >
            <span class={eyebrowClass}>Password</span>
            <Input
              id="login-password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••"
              x-model="password"
              required
              class={fieldClass}
              :class="error && 'field-inset-error'"
            />
          </label>

          <p
            x-show="error"
            x-cloak
            x-text="error"
            role="alert"
            class="-mt-2 px-0.5 text-[13px] font-medium italic text-error select-text"
          >
          </p>

          <Button
            type="submit"
            variant="sheet-raised"
            class="mt-2 w-full rounded-xl"
            :disabled="loading"
            title="Sign in"
          />
        </form>
      </div>
    </main>
  </div>
</BaseLayout>
```

Notes for the implementer:
- `group-has-[:focus]:` is the Tailwind v4 form for "the parent label contains a focused element". The label carries `group`.
- `Input` merges `class` last through `cn()`, so `rounded-xl border-0 px-4 text-[15px]` override its `rounded-md border px-3.5 text-sm` defaults. Its remaining `.input` base styles lose to `.field-inset`, which is declared later in `@layer components`. `GuestNameModal.astro` is the precedent (`class="field-inset h-13 rounded-2xl border-0"`).
- `-mt-2` is a scale negative, which is allowed. It is not a leading-dash arbitrary.
- If `npx astro check` or `check-astro-conventions.sh` rejects `:class` on `Input` (Astro's prop typing), use `x-bind:class` inside `{}` only as the D100 escape, and record that in the commit body.

- [ ] **Step 2: Run the conventions gates.**

Run (repo root):
```bash
bash scripts/check-astro-conventions.sh && bash scripts/check-style-tokens.sh && bash scripts/check-astro-class-composition.sh
```
Expected: every line `OK`, exit 0.

- [ ] **Step 3: Type-check and format.**

Run: `npx astro check && npm run format && npm run format:check`
Expected: 0 errors from `astro check`, and `format:check` clean.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/login/index.astro
git commit -m "feat(login): restyle to design — home backdrop, inset fields, raised submit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Docs, decision, visual verification

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (Tokens table "Surfaces" row, the Primitives table, the header version line, `updated:`)
- Modify: `decisions/frontend/style.md` (append D431)
- Modify: `docs/superpowers/specs/2026-10-08-login-redesign-design.md` (Status → implemented)

- [ ] **Step 1: Style guide.**
  - Bump the header to `0.3.1 (2026-10-08 — login: shadow-card, field-inset-error, D431)` and keep the prior version note.
  - In the Tokens table "Surfaces" row, append `` `shadow-card` (floating card drop shadow, login) ``.
  - In the Primitives table, add the row:

```markdown
| `.field-inset` / `.field-inset-error` | Inset text field with accent focus ring; `-error` adds a coral inset ring, and focus still wins (login, D431, 2026-10-08) |
```

- [ ] **Step 2: Decision.** Append to `decisions/frontend/style.md`:

```markdown
### D431 — Login follows the design: inset fields, raised submit
Status: Accepted · Date: 2026-10-08
Decision: `/login` follows Claude Design `Login.dc.html`: `BaseLayout backdrop="home"`, a `glass` card at `rounded-board` with the new `shadow-card`, the 230×80 logo lockup, mono eyebrow labels that turn `accent-bright` while their field has focus, `.field-inset` fields, and a `sheet-raised` "Sign in" at `rounded-xl`. Any login error rings both fields with the new `.field-inset-error`, the same condition that shows the error text.
Reason: one condition for text and rings keeps `login.data.ts` unchanged; the design does not distinguish error kinds.
Consequences: no logic change and no new icon. `.astro` carries no unit test (D101); CSS is pinned in `brand-tokens.test.ts`. Deferred (GitHub issue): the unused Inter font link in `BaseLayout`.
Supersedes: none.
```

- [ ] **Step 3: Visual check against the design.** Run `npm run dev`, open `/login` at 390×844 (and 390×667 for Review Focus 4), and compare with the design's `login`, `login-focus` and `login-error` screens:
  - **Default:** the home backdrop is top-right, the card has 28px corners, and the eyebrows are grey.
  - **Focus:** the email eyebrow is accent-bright, with an accent ring and a 3px halo.
  - **Error:** submit bad credentials. Both fields get coral rings and the italic coral text shows. Focusing a field shows the accent ring (Review Focus 1). Typing and re-submitting clears the rings while loading (Review Focus 2). The button is disabled during loading (Review Focus 5).
  - **Autofill:** if the browser autofills, the field must stay dark and readable (Review Focus 3). If it does not, capture it as discovered work and do not fix it here.

- [ ] **Step 4: Discovered work.** Using the `capturing-discovered-work` skill, file an issue: "BaseLayout loads the unused Inter font". Add an issue for anything found in step 3.

- [ ] **Step 5: Mark the spec implemented and commit.**

```bash
git add docs/architecture/07-Frontend/07-Style-Guide.md decisions/frontend/style.md docs/superpowers/specs/2026-10-08-login-redesign-design.md
git commit -m "docs(login): D431, style guide rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Gates and finish.** Run the `context-maintenance` skill, then the `run-all-gates` skill (`validate:app`, docs gates). Then `superpowers:finishing-a-development-branch` together with `finishing-a-dart-branch`: push, and open a PR into `main`.
