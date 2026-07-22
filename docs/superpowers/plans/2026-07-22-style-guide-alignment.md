# Style Guide Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align docs/agent rules with the finalized Score Training visual system, purge legacy tokens/`font-medium`, convert build-time `class:list` merges to `cn()`, and enforce that class-composition rule in local + GitHub PR checks.

**Architecture:** PR1 only (this plan). Rewrite `07-Style-Guide.md` as the visual SoT from design intent + live `global.css`; cascade into the Frontend Agent Guide and a short checklist in `app/CLAUDE.md`/`AGENT.md`; mechanically fix `.astro` usage; add `scripts/check-astro-class-composition.sh` wired into Context Maintenance and `.github/workflows/checks.yml`. PR2 (visual/UX polish) is out of scope — separate later plan stacked on PR1 tip. No git worktrees — branch checkout only.

**Tech Stack:** Astro `.astro` components, Tailwind v4 (`app/src/styles/global.css`), existing `cn()` (`clsx` + `tailwind-merge` at `app/src/lib/client/cn.ts`), bash gates + GitHub Actions, Alpine conventions already in `03-Alpine-Patterns.md` / `05-Astro-Components.md`.

## Global Constraints

- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold` only.
- Semantic tokens only — new names (`surface`, `foreground`, `muted`, `muted-foreground`, `accent*`, `error*`, `success*`); never `bg-bg*`, `text-fg*`, raw `teal-*`/`zinc-*` palette utilities.
- Build-time class composition uses `cn()` only — never Astro `class:list` or `.filter(Boolean).join(...)` in `app/src/**/*.astro`.
- Forward remaining Astro attributes as `...props` / `{...props}` — never `...rest` / `{...rest}` (reserved `class` still renames to `classNameProp`).
- Runtime Alpine class changes stay on `:class` (not banned by the new gate).
- `x-on:` / `x-bind:` only where Astro `{}` linter escape requires it (D100) — do not “fix” those spreads.
- Do not invent new Alpine/Astro rules — enforce existing `03` / `05`.
- No git worktrees; check out branches in the main working copy only (D102).
- No new npm dependencies.
- `.astro` markup is not unit-tested (D101) — verification is gates + `npm run validate:app` / `astro check` + smoke of Score Training setup/play.
- Do not commit unless a step below explicitly says to commit.
- Spec: `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md`.

## File map

| Path | Responsibility |
| ---- | -------------- |
| `scripts/check-astro-class-composition.sh` | **Create** — fail CI/local if `class:list` or manual class-join in `app/src/**/*.astro` |
| `.github/workflows/checks.yml` | Run the new script on PR/push to `main` |
| `.github/pull_request_template.md` | List the new verification command |
| `CLAUDE.md` / `AGENT.md` (root) | Context Maintenance step 5 includes the new script |
| `docs/architecture/07-Frontend/07-Style-Guide.md` | Full rewrite — new token/primitive vocabulary |
| `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` | §12 Styling condensed to new vocabulary |
| `docs/architecture/07-Frontend/05-Astro-Components.md` | Note mechanical `cn()` gate; document `{...props}` (not `{...rest}`); fix stale “cn not installed” if still present |
| `docs/architecture/00-Context-Map.md` | Refresh style-guide inventory date/blurb |
| `docs/architecture/07-Frontend/00-Overview.md` | Handbook index blurb date if needed |
| `app/CLAUDE.md` / `app/AGENT.md` | Style non-negotiables checklist (byte-identical) |
| `DECISIONS.md` | D125 style rewrite + D126 class-composition gate (or one combined row if preferred — use two rows as specified in Task 8) |
| `app/src/styles/global.css` | Only if audit finds banned tokens/`font-medium` still in CSS |
| 26 `.astro` files with `class:list` | Convert to `cn()` + frontmatter sections; fix `font-medium` |
| Pages/layouts with `text-fg*` / `bg-bg*` | Rename to new tokens |

**Out of this plan:** PR2 visual polish; changing Alpine rules themselves.

---

### Task 1: Branch, preserve WIP, rebase onto `origin/main`

**Files:**
- Modify: git branch state only (no doc edits yet)

**Interfaces:**
- Consumes: current `feat/score-training-play-ui` tip + uncommitted UI/CSS work
- Produces: rebased branch tip ready for PR1 commits (suggested name `docs/style-guide-alignment` or continue on feature branch after rebase)

- [ ] **Step 1: Fetch and inspect divergence**

```bash
cd /Users/levi/Development/dart-analytics
git fetch origin
git status -sb
git log --oneline --left-right HEAD...origin/main | head -40
```

Expected: local branch diverged from `origin/main` (PR #31 already on main); working tree may have uncommitted UI/CSS changes.

- [ ] **Step 2: Commit or stash WIP so rebase is safe**

If there are uncommitted changes that belong in PR1 (new UI components, `global.css`, layouts), commit them on the current branch first:

```bash
git add app/src docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md
# Do NOT add unrelated noise (e.g. database/braindump/) unless intentional
git status
git commit -m "$(cat <<'EOF'
chore: checkpoint Score Training UI + style WIP for rebase

EOF
)"
```

If the user already committed everything needed, skip the commit. Do not use git worktrees.

- [ ] **Step 3: Rebase onto `origin/main`**

```bash
git rebase origin/main
```

Resolve conflicts favoring: (1) design-intent UI/CSS from this branch, (2) `main` for already-merged play-ui history. After conflicts:

```bash
git status
# fix files, then:
git add <resolved-files>
git rebase --continue
```

Expected: rebase completes; branch contains main + local PR1-bound commits.

- [ ] **Step 4: Optional dedicated PR1 branch name**

```bash
git checkout -b docs/style-guide-alignment
```

Expected: `Switched to a new branch 'docs/style-guide-alignment'` (skip if staying on rebased feature branch).

- [ ] **Step 5: Commit** — none required if Steps 2–4 produced no extra commit beyond the checkpoint; otherwise the checkpoint commit in Step 2 is the commit for this task.

---

### Task 2: Add class-composition gate (expect RED)

**Files:**
- Create: `scripts/check-astro-class-composition.sh`
- Test: run the script (must fail while `class:list` remains)

**Interfaces:**
- Consumes: nothing
- Produces: executable script exiting `1` with violation paths on stderr when `class:list` or `.filter(Boolean).join(` appears under `app/src/**/*.astro`; exiting `0` with OK message when clean

- [ ] **Step 1: Create the script**

Write `scripts/check-astro-class-composition.sh` with exactly:

```bash
#!/usr/bin/env bash
# Class-composition gate (docs/architecture/07-Frontend/05-Astro-Components.md):
# build-time class merges use cn(); never Astro class:list or .filter(Boolean).join.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0

CLASS_LIST=$(grep -RIn --include='*.astro' 'class:list' app/src 2>/dev/null || true)
if [ -n "$CLASS_LIST" ]; then
  echo "FAIL: Astro class:list found — compose with cn() in frontmatter // Styles (class={className}):" >&2
  echo "$CLASS_LIST" >&2
  FAIL=1
fi

MANUAL_JOIN=$(grep -RIn --include='*.astro' '\.filter(Boolean)\.join(' app/src 2>/dev/null || true)
if [ -n "$MANUAL_JOIN" ]; then
  echo "FAIL: manual class merge (.filter(Boolean).join) found — use cn():" >&2
  echo "$MANUAL_JOIN" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "OK: no class:list or manual class-join in app/src/**/*.astro."
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/check-astro-class-composition.sh
```

- [ ] **Step 3: Run — expect FAIL (red)**

```bash
bash scripts/check-astro-class-composition.sh; echo "exit=$?"
```

Expected: exit `1`; stderr lists ~26 files including `app/src/components/forms/Button.astro` and multiple `app/src/components/ui/*.astro`.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-astro-class-composition.sh
git commit -m "$(cat <<'EOF'
chore: add check-astro-class-composition gate (red)

EOF
)"
```

---

### Task 3: Convert `forms/Button.astro` to `cn()` + kill `font-medium`

**Files:**
- Modify: `app/src/components/forms/Button.astro` (full file)
- Test: `bash scripts/check-astro-class-composition.sh` still fails (other files), but Button absent from output

**Interfaces:**
- Consumes: `cn` from `@client/cn`
- Produces: Button using `class={className}` with `font-semibold`

- [ ] **Step 1: Replace `app/src/components/forms/Button.astro` with**

```astro
---
/**
 * Button with design-system variants.
 * @param {"button"|"submit"|"reset"} [type]
 * @param {"primary"|"secondary"|"ghost"|"error"} [variant]
 * @param {boolean} [icon] Equal padding on all sides (icon-only / square hit area)
 * @param {boolean} [disabled]
 * @param {string} [ariaLabel] Accessible name (required for icon-only)
 * @param {string} [class] Extra classes
 */
interface Props {
  type?: "button" | "submit" | "reset";
  title?: string;
  variant?: "primary" | "secondary" | "ghost" | "error";
  icon?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  type = "button",
  title,
  variant = "primary",
  icon = false,
  disabled = false,
  ariaLabel,
  class: classNameProp = "",
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const variantClasses = {
  primary: "border-transparent bg-white text-black btn-primary",
  secondary: "border-border text-foreground btn-secondary",
  ghost: "text-muted-foreground btn-ghost",
  error: "bg-error text-error-foreground btn-error",
}[variant];

const className = cn(
  "btn inline-flex items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold transition-[transform,color,background-color,border-color,box-shadow] duration-150",
  variantClasses,
  icon ? "p-2.5" : "px-4 py-2.5",
  classNameProp,
);
---

<button
  type={type}
  disabled={disabled}
  aria-label={ariaLabel}
  class={className}
  {...props}
>
  <slot name="iconBefore" />
  {title}
  <slot name="iconAfter" />
</button>
```

- [ ] **Step 2: Confirm Button is gone from gate output**

```bash
bash scripts/check-astro-class-composition.sh 2>&1 | grep Button || echo "Button clean"
```

Expected: `Button clean` (no `Button.astro` line); overall script still exits 1.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/forms/Button.astro
git commit -m "$(cat <<'EOF'
refactor(ui): Button uses cn() and font-semibold

EOF
)"
```

---

### Task 4: Convert remaining `class:list` components to `cn()`

**Files:**
- Modify (all current `class:list` hits except Button already done):
  - `app/src/components/ui/Alert.astro`
  - `app/src/components/ui/Badge.astro`
  - `app/src/components/ui/BulletItem.astro`
  - `app/src/components/ui/BulletList.astro`
  - `app/src/components/ui/Card.astro`
  - `app/src/components/ui/CardWrapper.astro`
  - `app/src/components/ui/Checkbox.astro`
  - `app/src/components/ui/Field.astro`
  - `app/src/components/ui/Fieldset.astro`
  - `app/src/components/ui/GradientCard.astro`
  - `app/src/components/ui/Input.astro`
  - `app/src/components/ui/Link.astro`
  - `app/src/components/ui/LinkCard.astro`
  - `app/src/components/ui/NavPill.astro`
  - `app/src/components/ui/Radio.astro`
  - `app/src/components/ui/Range.astro`
  - `app/src/components/ui/Section.astro`
  - `app/src/components/ui/Select.astro`
  - `app/src/components/ui/SelectOption.astro`
  - `app/src/components/ui/Tab.astro`
  - `app/src/components/ui/TabPanel.astro`
  - `app/src/components/ui/Tabs.astro`
  - `app/src/components/ui/Textarea.astro`
  - `app/src/components/layout/games/InputButton.astro`
  - `app/src/components/layout/games/SinglePlayerDisplay.astro`
- Test: `bash scripts/check-astro-class-composition.sh` → exit 0

**Interfaces:**
- Consumes: `import { cn } from "@client/cn"` (or `'@client/cn'`)
- Produces: every listed file uses `class={className}` from `cn(...)` in `// Styles`; no `class:list`

**Conversion contract (apply to every file):**

1. Keep `interface Props`.
2. Destructure under `// Props`; rename `class` → `classNameProp` (default `""`).
3. Imports under `// Lib` / `// Components` / etc. per `05` order — include `import { cn } from "@client/cn";`.
4. Under `// Styles`, build `const className = cn(...)` with the same string fragments previously inside `class:list={[...]}` (booleans stay as `cond && "..."` args to `cn`).
5. Markup uses `class={className}` only — delete every `class:list`.
6. Replace any `font-medium` in those fragments with `font-semibold`.
7. Multiple `class:list` in one file (e.g. `Alert.astro`) → multiple `cn()` consts (`titleClassName`, `bodyClassName`, …) or one per element.

**Canonical simple example — replace `BulletList.astro` entirely with:**

```astro
---
/**
 * Vertical list of bullet rows.
 * @param {string} [class] Extra classes on the ul
 */
interface Props {
  class?: string;
}

// Props
const { class: classNameProp = "" }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn("space-y-3", classNameProp);
---

<ul class={className}>
  <slot />
</ul>
```

**Canonical variant example — replace `Badge.astro` entirely with:**

```astro
---
/**
 * Small status badge.
 * @param {"accent"|"error"|"neutral"} [variant]
 * @param {string} [class] Extra classes
 */
interface Props {
  variant?: "accent" | "error" | "neutral";
  class?: string;
}

// Props
const { variant = "accent", class: classNameProp = "" }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const variantClasses = {
  accent: "border border-accent/25 bg-accent-muted text-accent",
  error: "border border-error/25 bg-error-muted text-error",
  neutral: "bg-surface-overlay text-muted-foreground",
}[variant];

const className = cn(
  "badge inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  variantClasses,
  classNameProp,
);
---

<span class={className}>
  <slot />
</span>
```

**`Link.astro` weight fix inside `cn()`:** use `font-semibold` instead of `font-medium` for both the btn branch and the text branch.

**`Alert.astro`:** three `cn()` results — root, title, body — and `font-semibold` on the title.

**`TabPanel.astro` Alpine:** keep runtime binding; prefer `:hidden={...}` if the file today uses `x-bind:hidden` and Astro accepts it; if the linter forces the long form, keep `x-bind:hidden` (D100) — class composition still must use `cn()`.

**`InputButton.astro` / `SinglePlayerDisplay.astro`:** same contract; preserve Alpine expression props on `SinglePlayerDisplay` exactly as `03` requires.

- [ ] **Step 1: Convert every file in the list above** using the contract + examples. Do not leave any `class:list` under `app/src`.

- [ ] **Step 2: Run gate — expect PASS (green)**

```bash
bash scripts/check-astro-class-composition.sh; echo "exit=$?"
```

Expected: `OK: no class:list or manual class-join in app/src/**/*.astro.` and `exit=0`.

- [ ] **Step 3: Confirm no `font-medium` left in converted components**

```bash
grep -RIn --include='*.astro' 'font-medium' app/src/components || echo "no font-medium in components"
```

Expected: `no font-medium in components` (or only hits outside scope that Task 5 will clear).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ui app/src/components/layout/games/InputButton.astro app/src/components/layout/games/SinglePlayerDisplay.astro
git commit -m "$(cat <<'EOF'
refactor(ui): replace class:list with cn() across components

EOF
)"
```

---

### Task 5: Purge legacy tokens (`text-fg*`, `bg-bg*`), remaining `font-medium`, and `{...rest}`

**Files:**
- Modify (from audit; re-run greps and include any new hits):
  - `app/src/components/forms/Input.astro` (`text-fg-muted` → `text-muted-foreground`; `...rest` → `...props`)
  - `app/src/components/layout/games/NoSessionPanel.astro`
  - `app/src/components/layout/games/ScoreInput.astro` (`text-fg-subtle` → `text-muted`)
  - `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`
  - `app/src/layouts/GameLayout.astro`
  - `app/src/pages/games/score-training/play/index.astro`
  - `app/src/pages/login/index.astro`
  - `app/src/pages/profile/index.astro`
  - `app/src/pages/statistics/index.astro`
  - any remaining `font-medium` or `...rest` / `{...rest}` under `app/src`

**Token rename map (apply everywhere in markup):**

| Legacy | Replacement |
| ------ | ----------- |
| `text-fg` | `text-foreground` |
| `text-fg-muted` | `text-muted-foreground` |
| `text-fg-subtle` | `text-muted` |
| `text-fg-faint` | `text-muted` |
| `bg-bg` | `bg-surface` |
| `bg-bg-subtle` | `bg-surface-raised` |
| `bg-bg-muted` | `bg-surface-overlay` |
| `bg-bg-emphasis` | `bg-surface-overlay` |
| `font-medium` | `font-semibold` (emphasis) or `font-normal` (body) |
| `...rest` / `{...rest}` | `...props` / `{...props}` |

- [ ] **Step 1: Grep baseline**

```bash
grep -RIn --include='*.astro' --include='*.css' -E 'text-fg|bg-bg|font-medium|fg-muted|fg-subtle|surface-elevated|nav-item-active' app/src || echo "clean"
grep -RIn --include='*.astro' '\.\.\.rest' app/src || echo "no ...rest"
```

- [ ] **Step 2: Apply renames file by file** using the map. Example for login:

Change `text-fg` → `text-foreground` and `text-fg-muted` → `text-muted-foreground` in `app/src/pages/login/index.astro`.

Example for `forms/Input.astro` — replace the props destructure + spread with:

```astro
// Props
const {
  label,
  name,
  type = 'text',
  id,
  autocomplete,
  class: classNameProp,
  ...props
}: Props = Astro.props;

// Lib
import { cn } from '@client/cn';

// Styles
const inputId = id ?? name;
const className = cn('input', classNameProp);
---

<label for={inputId} class="text-sm text-muted-foreground">{label}</label>
<input
  id={inputId}
  name={name}
  type={type}
  autocomplete={autocomplete}
  class={className}
  {...props}
/>
```

- [ ] **Step 3: Grep again — expect clean**

```bash
grep -RIn --include='*.astro' --include='*.css' -E 'text-fg|bg-bg|font-medium' app/src || echo "clean"
grep -RIn --include='*.astro' '\.\.\.rest' app/src || echo "no ...rest"
```

Expected: `clean` and `no ...rest`

- [ ] **Step 4: Commit**

```bash
git add app/src
git commit -m "$(cat <<'EOF'
fix(ui): purge legacy tokens, font-medium, and ...rest spreads

EOF
)"
```

---

### Task 6: Alpine convention pass (manual, existing rules)

**Files:**
- Modify as needed under `app/src/components/ui/`, `app/src/components/layout/games/`, related pages/layouts
- Reference: `docs/architecture/07-Frontend/03-Alpine-Patterns.md`, `05-Astro-Components.md`

**Interfaces:**
- Consumes: existing Alpine factory / expression-prop rules
- Produces: no new `x-init`; every `x-show` has `x-cloak`; no illegal `x-bind`/`x-on` outside D100 Astro escapes

- [ ] **Step 1: Run audits**

```bash
grep -RIn --include='*.astro' 'x-init' app/src || echo "no x-init"
grep -RIn --include='*.astro' 'x-show' app/src | head -80
# For each x-show line, open the file and confirm x-cloak is on the same element
grep -RIn --include='*.astro' 'x-bind:\|x-on:' app/src
```

Expected: `x-on:` / `x-bind:` only on known D100 escapes (`Modal.astro`, `ConfirmDialog.astro`, `ScoreInput.astro` spreads, maybe `TabPanel`). Any other hit → convert to `:attr` / `@event`.

- [ ] **Step 2: Fix violations** — add missing `x-cloak`, convert illegal long-form binds, ensure game display expression props are not string-quoted incorrectly (see `SinglePlayerDisplay` / `03`).

- [ ] **Step 3: Smoke-check frontmatter order on touched files** — Props → imports → Data → Styles per `05`.

- [ ] **Step 4: Commit only if Step 2 changed files**

```bash
git add app/src
git commit -m "$(cat <<'EOF'
fix(ui): align Alpine cloak/shorthand on new components

EOF
)"
```

If no changes: skip commit and note “Alpine audit clean” in the completion report.

---

### Task 7: Wire gate into GitHub checks + Context Maintenance

**Files:**
- Modify: `.github/workflows/checks.yml`
- Modify: `.github/pull_request_template.md`
- Modify: `CLAUDE.md` and `AGENT.md` (root — byte-identical)
- Modify: `docs/architecture/07-Frontend/05-Astro-Components.md` (gate note + remove stale “cn not in package.json” if still present)
- Modify: `DECISIONS.md` (D125/D126)
- Modify: `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` success criteria — add CI gate checkbox

**Interfaces:**
- Consumes: `scripts/check-astro-class-composition.sh` (Task 2, now green)
- Produces: PR `structure` job runs the script; protocol requires four checkers

- [ ] **Step 1: Update `.github/workflows/checks.yml` `structure` job**

After the AGENT.md mirror step, add:

```yaml
      - name: Astro class-composition gate
        run: bash scripts/check-astro-class-composition.sh
```

Full `structure` job steps become:

```yaml
    steps:
      - uses: actions/checkout@v4
      - name: Context-map consistency
        run: bash scripts/check-context-map.sh
      - name: File-location gate
        run: bash scripts/check-file-locations.sh
      - name: AGENT.md mirror gate
        run: bash scripts/check-agent-mirrors.sh
      - name: Astro class-composition gate
        run: bash scripts/check-astro-class-composition.sh
```

- [ ] **Step 2: Update PR template Verification list**

In `.github/pull_request_template.md`, under Verification, add:

```markdown
     - scripts/check-astro-class-composition.sh (Astro class:list / cn() gate)
```

- [ ] **Step 3: Update root `CLAUDE.md` and `AGENT.md` Context Maintenance step 5**

Change:

```markdown
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, and `scripts/check-agent-mirrors.sh` — all three must pass.
```

to:

```markdown
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, and `scripts/check-astro-class-composition.sh` — all four must pass.
```

Keep `CLAUDE.md` / `AGENT.md` byte-identical (`cmp CLAUDE.md AGENT.md`).

- [ ] **Step 4: Document the gate + `{...props}` rule in `05-Astro-Components.md`**

In the **Props** section, after the bullet about renaming reserved words (`class` → `classNameProp`), add:

```markdown
- When forwarding undeclared HTML/Astro attributes to the root element, collect them as `...props` and spread `{...props}` — **never** name the rest collector `rest` / `{...rest}`.
```

In the Class Composition section, after the sentence that `cn()` is the only helper, add:

```markdown
Mechanically enforced by `scripts/check-astro-class-composition.sh` (local Context Maintenance + CI on PRs to `main`): no `class:list` and no `.filter(Boolean).join(` in `app/src/**/*.astro`.
```

If the doc still claims `cn()` / deps are not installed, delete that stale paragraph — `app/src/lib/client/cn.ts` already exists.

Update the file’s `updated:` front-matter date to `2026-07-22`.

- [ ] **Step 5: Add decision rows to `DECISIONS.md`**

Under the Frontend / UI section (near D124), append:

```markdown
| D125 | 2026-07-22 | Style guide rewritten to sky/glass/`surface`/`foreground` vocabulary matching finalized Score Training UI; legacy `fg`/`bg-bg`/old `.surface`/`.nav-item`/`.badge` doc contract retired; `font-medium` ban retained | Docs had drifted from `global.css` and live UI |
| D126 | 2026-07-22 | Build-time Astro class composition must use `cn()`; `class:list` and `.filter(Boolean).join` banned in `app/src/**/*.astro`, enforced by `scripts/check-astro-class-composition.sh` in Context Maintenance + GitHub `checks` workflow | Prevents new UI primitives from regressing on `05-Astro-Components.md` |
| D127 | 2026-07-22 | Astro components forward leftover attributes as `...props` / `{...props}` — never `...rest` / `{...rest}` | One consistent rest-spread name across UI primitives |
```

Update the ledger `updated:` header date to `2026-07-22`.

- [ ] **Step 6: Extend design-spec success criteria**

In `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md`, ensure these are present (add any missing):

```markdown
- [ ] `scripts/check-astro-class-composition.sh` passes locally and is wired into `.github/workflows/checks.yml` + root Context Maintenance
- [ ] Rest spreads use `{...props}` not `{...rest}`; documented in `05` + agent rules
```

- [ ] **Step 7: Run all four gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
```

Expected: all exit 0. (Context-map may still fail until Task 8/9 updates inventory dates — if so, run this step again after Task 9.)

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/checks.yml .github/pull_request_template.md CLAUDE.md AGENT.md docs/architecture/07-Frontend/05-Astro-Components.md DECISIONS.md docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md
git commit -m "$(cat <<'EOF'
chore: enforce Astro cn() class composition in CI

EOF
)"
```

---

### Task 8: Rewrite `07-Style-Guide.md`

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (full rewrite)
- Modify: `docs/architecture/00-Context-Map.md` inventory row for the style guide
- Modify: `docs/architecture/07-Frontend/00-Overview.md` handbook index date/blurb if present

**Interfaces:**
- Consumes: live `app/src/styles/global.css` + finalized Score Training UI
- Produces: canonical visual contract matching new vocabulary

- [ ] **Step 1: Replace `07-Style-Guide.md` content**

Keep the HTML comment header; set `updated: 2026-07-22`. Version bump to `0.2.0`. Structure the doc with these sections and facts (write complete prose/tables — no TBDs):

1. **Purpose** — one fixed set of semantic tokens + primitive classes from `global.css`; this doc owns the visual contract; `05` owns class composition (`cn()`).
2. **Theme** — dark-only (`color-scheme: dark only`); ambient `body::before`/`::after` gradients; mobile shell (`h-dvh`, content width as used by layouts); tap highlight off; `touch-action: manipulation`.
3. **Tokens** — table:

| Role | Classes / tokens |
| ---- | ---------------- |
| Surfaces | `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`, `glass`, `glass-strong` |
| Text | `text-foreground`, `text-muted-foreground`, `text-muted` |
| Borders | `border-border`, `border-border-strong` |
| Accent | `accent`, `accent-hover`, `accent-muted`, `accent-foreground`, `accent-glow` (sky) |
| States | `error` / `error-muted` / `error-foreground`, `success` / `success-muted` |
| Radius | `rounded-sm` … `rounded-2xl` per `@theme` |
| Fonts | `font-sans` (Montserrat), `font-display` (Michroma), `font-mono` (JetBrains Mono) |
| Motion | `--ease-out`; keep UI ≤ ~300ms; transform/opacity only |

Authority: if this doc and CSS disagree after landing, `global.css` wins — update the doc.

4. **Primitives** — `.btn` + `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-error`; `.input` / `.input-error`; `.control`; `.tab`; `.alert` / `.alert-error` / `.alert-success`; `.nav-pill`; `.gradient-card`; `.link-card`; `.card-wrapper`; `@utility glass` / `glass-strong`. Dialogs remain `Modal.astro` / `ConfirmDialog.astro`.
5. **Typography** — headings `font-display`; body `font-sans`; scores `font-mono font-bold tabular-nums`; **never `font-medium`**; case rules as today.
6. **Spacing / buttons / surfaces / motion / interactivity / a11y** — update to current patterns (press scale on `.btn:active`, hover gated behind `@media (hover: hover) and (pointer: fine)`, `x-show`+`x-cloak`, ConfirmDialog action row).
7. **Anti-patterns** — include legacy names: `bg-bg*`, `text-fg*`, old `.surface`/`.surface-elevated`/`.nav-item`/`.badge` *as formerly documented*, raw palette utils, `class:list`, `font-medium`, nested old surfaces.

- [ ] **Step 2: Update Context Map inventory**

In `docs/architecture/00-Context-Map.md`, set the `07-Style-Guide.md` row description/date to reflect sky/glass/surface vocabulary (`2026-07-22`). Bump map version note if the file uses one.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/07-Frontend/07-Style-Guide.md docs/architecture/00-Context-Map.md docs/architecture/07-Frontend/00-Overview.md
git commit -m "$(cat <<'EOF'
docs: rewrite style guide for sky/glass surface system

EOF
)"
```

---

### Task 9: Cascade agent guide + `app/CLAUDE.md` checklist

**Files:**
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
- Modify: `app/CLAUDE.md` and `app/AGENT.md` (byte-identical)

**Interfaces:**
- Consumes: rewritten `07-Style-Guide.md`
- Produces: agents see condensed new vocabulary + style non-negotiables without opening the full guide

- [ ] **Step 1: Replace §12 Styling in `10-Frontend-Agent-Guide.md`** with:

```markdown
## 12. Styling

Semantic tokens only (`surface` / `foreground` / `muted*` / `border*` / `accent*` / `error*` / `success*` / `glass*`) — never raw palette utilities and never legacy `bg-bg*` / `text-fg*`. Primitive classes (`.btn` + variants, `.input`, `.control`, `.tab`, `.alert`, `.nav-pill`, `.gradient-card`, `.link-card`, `.card-wrapper`, `glass`) live in `global.css` — reuse, never reinvent. Build-time classes via `cn()` only (`scripts/check-astro-class-composition.sh`). Never `font-medium` — prefer `font-normal` / `font-semibold` / `font-bold`. Full rules: `07-Style-Guide.md`.
```

Also in the Astro / components condensed section of the same file (wherever frontmatter/`cn()` is mentioned), add one line:

```markdown
- Forward leftover attributes as `{...props}` — never `{...rest}` (`05-Astro-Components.md`)
```

Update the file `updated:` date to `2026-07-22`. Adjust the pre-completion checklist styling bullet to the same vocabulary; add a checklist item for `{...props}` if a props/components checklist exists.

- [ ] **Step 2: Add Style non-negotiables to `app/CLAUDE.md` under Frontend Rules**

Insert (then copy identically to `app/AGENT.md`):

```markdown
**Style non-negotiables:**
- Semantic tokens only — `surface` / `foreground` / `muted*` / `accent*` / states; never `bg-bg*` / `text-fg*` or raw palette utilities
- Reuse primitives from `app/src/styles/global.css`; do not reinvent per screen
- Build-time class composition via `cn()` only — never `class:list` (enforced by `scripts/check-astro-class-composition.sh`)
- Forward leftover attributes as `{...props}` — never `{...rest}`
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold`
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props)
```

- [ ] **Step 3: Verify mirrors**

```bash
cmp app/CLAUDE.md app/AGENT.md && echo "app mirrors OK"
bash scripts/check-agent-mirrors.sh
```

Expected: both OK.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md app/CLAUDE.md app/AGENT.md
git commit -m "$(cat <<'EOF'
docs: cascade style contract into agent guides

EOF
)"
```

---

### Task 10: Context Maintenance + app validation + open PR1

**Files:**
- Modify: `graphify-out/graph.json` if refresh changes it
- Verify: all gates + `npm run validate:app`

**Interfaces:**
- Consumes: all prior tasks
- Produces: PR1 targeting `main`

- [ ] **Step 1: Run Context Maintenance checkers**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
```

Expected: all exit 0.

- [ ] **Step 2: Refresh graph**

```bash
bash scripts/refresh-graph.sh
git add graphify-out/graph.json
```

If graphify CLI absent: record warning in the completion report; do not fake the file.

- [ ] **Step 3: Validate app**

```bash
cd app && npm run validate:app
```

Expected: pass (or fix failures introduced by renames/`cn()`). From repo root afterward.

- [ ] **Step 4: Commit any graph/validation fixes**

```bash
git add graphify-out/graph.json
git status
# if other fixups:
git commit -m "$(cat <<'EOF'
chore: refresh graph after style alignment

EOF
)"
```

- [ ] **Step 5: Push and open PR1**

```bash
git push -u origin HEAD
gh pr create --title "docs/ui: style guide alignment + cn() CI gate" --body "$(cat <<'EOF'
## Summary
- Rewrite `07-Style-Guide.md` to the sky/glass/`surface` visual system
- Cascade agent/`app/CLAUDE` style non-negotiables; purge legacy `fg`/`font-medium`
- Convert build-time `class:list` to `cn()`; enforce via `scripts/check-astro-class-composition.sh` in CI

## Spec
`docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md`

## Test plan
- [ ] `bash scripts/check-astro-class-composition.sh` passes
- [ ] Other three structure gates pass
- [ ] `npm run validate:app` passes
- [ ] Smoke Score Training setup + play (tokens/layout look correct)

EOF
)"
```

Expected: PR URL printed. Report it in the completion report.

- [ ] **Step 6: Stop** — do **not** start PR2 polish in this plan.

---

## Self-review (author)

| Spec requirement | Task |
| ---------------- | ---- |
| Rewrite style guide | Task 8 |
| Agent guide + app CLAUDE checklist | Task 9 |
| Legacy token / `font-medium` purge | Tasks 3–5 |
| `{...props}` not `{...rest}` | Tasks 5, 7, 9 |
| Component `cn()` / conventions | Tasks 3–4, 6 |
| Rebase onto `origin/main` | Task 1 |
| PR1 then PR2 later | Tasks 1, 10; PR2 out of plan |
| Class composition CI gate (user add-on) | Tasks 2, 7 |
| Context Maintenance + DECISIONS | Tasks 7–10 |
| No worktrees | Global Constraints + Task 1 |

No TBD placeholders. Gate script and Button/Badge examples are complete. Remaining `class:list` files follow the Task 4 conversion contract with verification via the gate (exit 0).
