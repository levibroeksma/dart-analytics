# PR2 UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear D129 by deleting unwired UI kit members (and `CustomTabs`), keep only route-wired primitives, fix frontmatter section order on kept files that still bleed, polish Score Training + shell visuals to the style guide, and optionally align Context Maintenance with CI’s `check-astro-conventions.sh`.

**Architecture:** Branch `ui/score-training-polish` from `origin/main` @ `4ab73bf`+ (already created). YAGNI for the fallow-ignored kit: **delete** unused Astro wrappers; CSS primitives in `global.css` stay. Do not re-litigate tokens, `cn()`, or Alpine rules. Visual polish is minimal diffs against `07-Style-Guide.md` / `global.css`.

**Tech Stack:** Astro `.astro`, Tailwind v4 (`global.css`), existing `cn()`, Alpine factories already on main, fallow, bash gates.

## Global Constraints

- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold` only.
- Semantic tokens only (`surface*`, `foreground`, `muted*`, `accent*`, `error*`, `success*`); never `bg-bg*`, `text-fg*`, raw palette utilities.
- Build-time class composition uses `cn()` only — never `class:list` or `.filter(Boolean).join(...)`.
- Forward remaining attributes as `...props` / `{...props}` — never `...rest`.
- Frontmatter order per `05-Astro-Components.md`: Props → imports (`Layouts`/`Components`/`Icons`/`Lib`) → Data → Styles. Derived consts belong in `// Styles` (or after imports), never between `// Props` and imports.
- No git worktrees (D102). No new npm dependencies. No new game types / theme toggle.
- `.astro` markup is not unit-tested (D101) — verify with gates + `npm run validate:app` + smoke.
- Do not commit unless a step explicitly says to commit.
- Spec / handoff: `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` §1 PR2; `docs/superpowers/plans/2026-07-22-ui-polish-pr2-handoff.md`.

## Keep / delete (locked)

| Keep (already imported by routes/layouts) | Delete (unwired or placeholder) |
| ----------------------------------------- | -------------------------------- |
| `Modal.astro`, `ConfirmDialog.astro`, `LogoutButton.astro`, `IsLoading.astro`, `Link.astro`, `CardWrapper.astro` | `CustomTabs.astro` |
| | `Alert`, `Badge`, `BulletItem`, `BulletList`, `Card`, `Checkbox`, `Field`, `Fieldset`, `GradientCard`, `Input` (ui), `LinkCard`, `NavPill`, `Radio`, `Range`, `Section`, `Select`, `SelectOption`, `Tab`, `TabPanel`, `Tabs`, `Textarea` |

Rationale: Alpine-driven errors use `x-text` — `Alert.astro` slot API does not fit without API changes. CSS `.alert` / `.gradient-card` / `.link-card` / `.nav-pill` / `.tab` remain available. Login keeps `forms/Input.astro`.

## File map

| Path | Responsibility |
| ---- | -------------- |
| `app/src/components/CustomTabs.astro` | **Delete** |
| `app/src/components/ui/{Alert,Badge,…}.astro` (delete list) | **Delete** |
| `app/.fallowrc.jsonc` | Remove D129 `ignorePatterns`; revisit `thresholdOverrides` |
| `DECISIONS.md` | D130: retire D129 (kit policy = keep wired only) |
| `app/src/components/ui/Link.astro` | Frontmatter order fix (kept) |
| `app/src/components/layout/games/*`, pages, `BottomNav`, login | Visual/UX polish |
| `CLAUDE.md` / `AGENT.md` (root) | Add `check-astro-conventions.sh` to step 5 |
| `docs/architecture/00-Context-Map.md` | Inventory/date only if docs changed |

---

### Task 1: Delete unwired kit + CustomTabs; shrink fallow; retire D129

**Files:**
- Delete: `app/src/components/CustomTabs.astro`
- Delete: every `app/src/components/ui/*.astro` in the delete list above
- Modify: `app/.fallowrc.jsonc` — remove entire `ignorePatterns` array (or leave empty omitted)
- Modify: `DECISIONS.md` — add D130 retiring D129
- Test: `cd app && npx fallow` (via `npm run validate:app` later; at least `npx fallow` here)

**Interfaces:**
- Consumes: keep list (do not delete Modal, ConfirmDialog, LogoutButton, IsLoading, Link, CardWrapper)
- Produces: fallow clean without UI `ignorePatterns`; D130 recorded

- [ ] **Step 1: Confirm keep files still have importers**

```bash
cd /Users/levi/Development/dart-analytics
rg -n "ui/(Modal|ConfirmDialog|LogoutButton|IsLoading|Link|CardWrapper)" app/src --glob '!app/src/components/ui/**'
```

Expected: at least one hit each (Link via NoSessionPanel, etc.).

- [ ] **Step 2: Delete CustomTabs and unwired ui components**

```bash
rm -f app/src/components/CustomTabs.astro \
  app/src/components/ui/Alert.astro \
  app/src/components/ui/Badge.astro \
  app/src/components/ui/BulletItem.astro \
  app/src/components/ui/BulletList.astro \
  app/src/components/ui/Card.astro \
  app/src/components/ui/Checkbox.astro \
  app/src/components/ui/Field.astro \
  app/src/components/ui/Fieldset.astro \
  app/src/components/ui/GradientCard.astro \
  app/src/components/ui/Input.astro \
  app/src/components/ui/LinkCard.astro \
  app/src/components/ui/NavPill.astro \
  app/src/components/ui/Radio.astro \
  app/src/components/ui/Range.astro \
  app/src/components/ui/Section.astro \
  app/src/components/ui/Select.astro \
  app/src/components/ui/SelectOption.astro \
  app/src/components/ui/Tab.astro \
  app/src/components/ui/TabPanel.astro \
  app/src/components/ui/Tabs.astro \
  app/src/components/ui/Textarea.astro
```

Verify remaining ui directory:

```bash
ls app/src/components/ui/
```

Expected exactly: `CardWrapper.astro` `ConfirmDialog.astro` `IsLoading.astro` `Link.astro` `LogoutButton.astro` `Modal.astro`

- [ ] **Step 3: Remove `ignorePatterns` from fallow config**

Edit `app/.fallowrc.jsonc`: delete the whole `"ignorePatterns": [ ... ],` block (including the D129 comment). Leave `thresholdOverrides` for `CardWrapper` / `ScoreInput` for now — Task 3 revisits after polish.

- [ ] **Step 4: Record D130 in DECISIONS.md**

Append a row (next id after D129):

```markdown
| D130 | 2026-07-22 | Retire D129: delete unwired `components/ui` primitives + `CustomTabs`; keep only route-wired Modal/ConfirmDialog/LogoutButton/IsLoading/Link/CardWrapper; CSS primitives remain in `global.css` | Fallow ignore was temporary until PR2 adoption-or-delete |
```

- [ ] **Step 5: Run fallow**

```bash
cd app && npx fallow
```

Expected: exit 0. If unused exports appear for kept components, stop and fix imports — do not re-add broad ignorePatterns.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/CustomTabs.astro app/src/components/ui app/.fallowrc.jsonc DECISIONS.md
git commit -m "$(cat <<'EOF'
chore(ui): delete unwired kit and retire D129

EOF
)"
```

---

### Task 2: Frontmatter section purity on kept Link (+ scan siblings)

**Files:**
- Modify: `app/src/components/ui/Link.astro` — move any derived consts out from between `// Props` and `// Lib`
- Modify: `app/src/components/ui/CardWrapper.astro`, `IsLoading.astro`, `LogoutButton.astro`, `Modal.astro`, `ConfirmDialog.astro` only if they violate the same order
- Modify: `app/src/components/layout/games/GameCard.astro` — add `// Props` / `// Components` section headers to match `05`

**Interfaces:**
- Consumes: `05-Astro-Components.md` order
- Produces: kept ui + GameCard frontmatter compliant

- [ ] **Step 1: Fix Link.astro**

Current bleed: derived `variantClasses` / class composition sit after imports under Styles (OK) but confirm Props → Lib → Styles with no consts between Props and Lib. Pattern:

```astro
---
interface Props {
  href: string;
  title?: string;
  variant?: "inline" | "button" | "nav";
  class?: string;
}

// Props
const {
  href,
  title,
  variant = "inline",
  class: classNameProp,
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const variantClasses = {
  inline: "text-sm text-accent no-underline hover:text-accent-hover",
  // …keep existing variant map values verbatim
} as const;

const className = cn(variantClasses[variant], classNameProp);
---
```

(Adjust to match actual props in file — do not invent new variants.)

- [ ] **Step 2: Align GameCard frontmatter**

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
```

- [ ] **Step 3: Quick scan of other kept ui files for Props→Lib bleed; fix if found**

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ui/Link.astro app/src/components/layout/games/GameCard.astro app/src/components/ui
git commit -m "$(cat <<'EOF'
refactor(ui): align kept component frontmatter with 05 order

EOF
)"
```

---

### Task 3: Visual / UX polish — Score Training + shell

**Files (touch only what needs polish):**
- Modify: `app/src/pages/games/index.astro`, `GameCard.astro`
- Modify: `SetupSessionForm.astro`, `NoSessionPanel.astro`, `ContinueSessionModal.astro`, setup `index.astro`
- Modify: `ScoreTraining.astro`, `ScoreInput.astro`, `SinglePlayerDisplay.astro`, `StatRow.astro`, play `index.astro`
- Modify: `ScoreTrainingResults.astro`, `ExitModal.astro`
- Modify: `BottomNav.astro` / `NavBtn.astro`, `login/index.astro` if glass/raised drift remains
- Possibly: `app/.fallowrc.jsonc` — drop `thresholdOverrides` if fallow health is green after polish

**Interfaces:**
- Consumes: `07-Style-Guide.md` tokens/primitives; existing Alpine expression props
- Produces: denser, consistent glass/raised hierarchy; fix obvious copy/spacing bugs; no API changes

- [ ] **Step 1: Fix known copy/spacing bugs on setup**

In `setup/index.astro`, change description prop to correct English:

```astro
description="Pick your desired configuration, then let's play."
```

Replace the reconciliation-failed ad-hoc box with style-guide alert utility classes (no Alert.astro):

```astro
<div
  class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-center text-sm text-error-foreground"
  role="alert"
>
  <p>Could not clean up a previous session. Retry to continue.</p>
  <Button class="mt-4" @click="retryReconciliation()" title="Retry" />
</div>
```

In `SetupSessionForm.astro`, give the error `<p>` the same alert utility treatment (keep `x-show` / `x-text` / `x-cloak`).

- [ ] **Step 2: Games index / GameCard**

Ensure card uses `glass` + `rounded-2xl` hierarchy per guide; tighten caption/title spacing (`gap-0.5` on text stack). No new Card.astro.

- [ ] **Step 3: Play chrome**

Polish `ScoreInput` readout (`font-mono tabular-nums`), keypad gap consistency, undo/finish affordances already present — only spacing/token fixes. Do not change ScoreInputBuffer behavior.

- [ ] **Step 4: Results modal**

Tighten summary typography (`font-display` for headline if appropriate, mono for scores); CTA row gap consistent with ConfirmDialog.

- [ ] **Step 5: Login / BottomNav**

Confirm login panel uses `glass` + `bg-surface-raised` + `border-border` (already largely correct). Fix any leftover muted token drift on nav labels.

- [ ] **Step 6: Revisit fallow health overrides**

```bash
cd app && npx fallow
```

If CardWrapper/ScoreInput no longer need overrides, remove those `thresholdOverrides` entries. If still over threshold, keep overrides and note in commit body “health overrides retained”.

- [ ] **Step 7: Commit**

```bash
git add app/src/pages app/src/components/layout app/src/components/forms app/.fallowrc.jsonc
git commit -m "$(cat <<'EOF'
style(ui): polish Score Training and shell surfaces

EOF
)"
```

---

### Task 4: Context Maintenance — add conventions checker to step 5

**Files:**
- Modify: `CLAUDE.md` and `AGENT.md` (root) — byte-identical — append `scripts/check-astro-conventions.sh` to Context Maintenance step 5
- Modify: `docs/architecture/00-Context-Map.md` only if an inventory row needs a 2026-07-22 date for this change (usually not)

**Interfaces:**
- Consumes: D123 gap noted in handoff
- Produces: local protocol lists five checkers matching CI

- [ ] **Step 1: Update both mirrors**

Change step 5 from four scripts to:

```markdown
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, `scripts/check-astro-class-composition.sh`, and `scripts/check-astro-conventions.sh` — all five must pass.
```

Keep `CLAUDE.md` and `AGENT.md` byte-identical.

- [ ] **Step 2: Run mirrors + conventions**

```bash
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-conventions.sh
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENT.md
git commit -m "$(cat <<'EOF'
docs: include astro conventions checker in Context Maintenance

EOF
)"
```

---

### Task 5: Full verification + open PR

**Files:**
- Possibly: `graphify-out/graph.json` if refresh changes it
- Possibly: context map date rows if any doc inventory drifted

- [ ] **Step 1: Run all gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
cd app && npm run validate:app
```

Expected: all exit 0. If graphify warns, note in PR body — do not fail silently.

- [ ] **Step 2: Manual smoke checklist (dev server if env available)**

- Games index → Score Training card
- Setup → pick preset → start (or continue modal)
- Play → enter scores → undo → finish confirm
- Results → play again / back

- [ ] **Step 3: Refresh graph if hooks did not**

```bash
bash scripts/refresh-graph.sh
git add graphify-out/graph.json   # only if changed
git commit -m "$(cat <<'EOF'
chore(graph): refresh after PR2 UI polish

EOF
)" || true
```

- [ ] **Step 4: Push and open PR targeting `main`**

```bash
git push -u origin HEAD
gh pr create --title "ui: Score Training polish + retire unwired kit (D129)" --body "$(cat <<'EOF'
## Summary
- Delete unwired `components/ui` primitives + `CustomTabs`; keep Modal/ConfirmDialog/LogoutButton/IsLoading/Link/CardWrapper (D130 retires D129)
- Frontmatter order fixes on kept components; Score Training + shell visual polish
- Context Maintenance step 5 includes `check-astro-conventions.sh`

## Test plan
- [ ] `bash scripts/check-astro-class-composition.sh` + `check-astro-conventions.sh` + other Context Maintenance checkers
- [ ] `cd app && npm run validate:app` (fallow clean without UI ignorePatterns)
- [ ] Smoke: setup → play → finish confirm → results

EOF
)"
```

---

## Self-review (plan author)

1. **Spec coverage:** D129 clear ✓; frontmatter ✓; conventions CI parity ✓; visual polish ✓; out-of-scope (tokens/Alpine rewrite) excluded ✓
2. **Placeholders:** none — delete list and keep list are explicit
3. **Type consistency:** no new TS APIs; Alert not adopted (Alpine `x-text` mismatch documented)
