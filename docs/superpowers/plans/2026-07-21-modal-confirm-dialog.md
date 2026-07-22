# Modal + ConfirmDialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add portable `Modal.astro` + `ConfirmDialog.astro` UI primitives and migrate finish-confirm, ExitModal, and ContinueSessionModal onto them with `Button.astro` for all actions.

**Architecture:** Parent owns open state (`x-show` / `x-if` + `x-cloak`). `Modal` is the presentational shell (backdrop, panel, a11y, optional Escape/backdrop dismiss via Alpine expression props). `ConfirmDialog` composes `Modal` with title/description and a cancel/confirm `Button` row. ContinueSession uses `Modal` + custom `footer` slot (not the confirm preset).

**Tech Stack:** Astro, Alpine.js v3 shorthand, TypeScript, existing `Button.astro`, `cn()` from `@client/cn`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-modal-confirm-dialog-design.md`
- No Vitest for `.astro` markup (D101) — verification = existing suite green + manual dialog checks
- No focus trap / scroll lock / `modules/ui` Alpine factory
- Do **not** migrate the play-page results overlay
- Always use `Button.astro` for dialog actions (no raw `<button class="btn …">`)
- Alpine expression props as strings (`onCancel`, `onConfirm`, `onDismiss`) — same pattern as `ScoreInput`’s `click` prop
- When binding Alpine handlers from Astro expressions / spreads, use `x-on:*` (not `@`) per D100 / `05-Astro-Components.md`
- Astro frontmatter section headers per `05-Astro-Components.md`: `interface Props` → `// Props` → imports under `// Layouts` · `// Components` · `// Icons` · `// Lib` → `// Data` → `// Styles`; omit unused groups; blank line before each `// Title` header (except when it is the first non-empty line after `---`)
- `dismissible` defaults `true`; finish-confirm passes `dismissible={false}`
- No git worktrees — stay on the current branch in the main working copy
- Commit when a plan step says commit (this plan authorizes those commits)
- Presentation only — do not change finish/exit/continue business logic

## File Structure

**Create:**

| File | Responsibility |
| ---- | -------------- |
| `app/src/components/ui/Modal.astro` | Backdrop + panel + dialog a11y + optional dismiss; default + `footer` slots |
| `app/src/components/ui/ConfirmDialog.astro` | Composes `Modal` + title/body + cancel/confirm `Button`s |

**Modify:**

| File | Responsibility |
| ---- | -------------- |
| `app/src/pages/games/score-training/play/index.astro` | Replace inline finish-confirm markup with `ConfirmDialog` |
| `app/src/components/layout/games/ExitModal.astro` | Thin `ConfirmDialog` wrapper |
| `app/src/components/layout/games/ContinueSessionModal.astro` | `Modal` + body + custom `footer` `Button`s |
| `docs/architecture/07-Frontend/07-Style-Guide.md` | Replace “no modal primitive yet” with live contract |
| `docs/architecture/07-Frontend/05-Astro-Components.md` | Example row includes `ConfirmDialog.astro` |
| `DECISIONS.md` | D123 one-liner |

**Do not touch:**

| File | Why |
| ---- | --- |
| Play results overlay | Out of scope |
| `score-training-play.data.ts` / engine / store | No behavior change |
| `GameLayout.astro` / setup page wrappers | Visibility ownership already correct |

---

### Task 1: `Modal.astro` shell

**Files:**
- Create: `app/src/components/ui/Modal.astro`

**Interfaces:**
- Consumes: `cn` from `@client/cn`; no other components
- Produces: `Modal` props `{ titleId: string; descriptionId?: string; dismissible?: boolean; onDismiss?: string; class?: string }` with default slot + named `footer` slot

- [ ] **Step 1: Create `Modal.astro`**

```astro
---
/**
 * Portable dialog shell. Parent owns visibility (`x-show` / `x-if` + `x-cloak`).
 * @param {string} titleId `aria-labelledby` target id (caller’s heading)
 * @param {string} [descriptionId] `aria-describedby` when body has a matching id
 * @param {boolean} [dismissible=true] Escape + backdrop click invoke `onDismiss`
 * @param {string} [onDismiss] Alpine expression; required when `dismissible`
 * @param {string} [class] Extra panel classes
 */
interface Props {
  titleId: string;
  descriptionId?: string;
  dismissible?: boolean;
  onDismiss?: string;
  class?: string;
}

// Props
const {
  titleId,
  descriptionId,
  dismissible = true,
  onDismiss,
  class: classNameProp,
}: Props = Astro.props;

if (dismissible && !onDismiss) {
  throw new Error("Modal: onDismiss is required when dismissible is true");
}

// Lib
import { cn } from "@client/cn";

// Styles
const panelClass = cn(
  "w-full max-w-sm rounded-lg border border-border bg-surface-raised p-6 shadow-lg",
  classNameProp,
);

const dismissAttrs = dismissible
  ? {
      "x-on:keydown.escape.window": onDismiss,
      "x-on:click.self": onDismiss,
    }
  : {};
---

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  {...dismissAttrs}
>
  <div class={panelClass}>
    <slot />
    <slot name="footer" />
  </div>
</div>
```

- [ ] **Step 2: Sanity-check the file compiles**

From `app/`:

```bash
npx astro check --root . 2>&1 | head -80
```

Expected: no errors naming `Modal.astro` (other pre-existing project errors may appear — ignore those unrelated to Modal).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ui/Modal.astro
git commit -m "$(cat <<'EOF'
feat(ui): add portable Modal shell

Backdrop, panel, dialog a11y, and optional Escape/backdrop dismiss
via Alpine expression props. Parent owns visibility.
EOF
)"
```

---

### Task 2: `ConfirmDialog.astro` preset

**Files:**
- Create: `app/src/components/ui/ConfirmDialog.astro`

**Interfaces:**
- Consumes: `Modal` from Task 1; `Button` from `@components/forms/Button.astro`
- Produces: `ConfirmDialog` props per spec (`title`, `titleId`, `description`, `cancelLabel`, `confirmLabel`, `onCancel`, `onConfirm`, `dismissible`, `confirmVariant`, `class`)

- [ ] **Step 1: Create `ConfirmDialog.astro`**

Use a `div slot="footer"` host (not `Fragment`) so the named slot is reliable:

```astro
---
/**
 * Confirm preset on top of Modal — title, description, cancel/confirm Buttons.
 * @param {string} title
 * @param {string} titleId Stable unique heading id for this call site
 * @param {string} description
 * @param {string} [cancelLabel="Cancel"]
 * @param {string} [confirmLabel="Confirm"]
 * @param {string} onCancel Alpine expression
 * @param {string} onConfirm Alpine expression
 * @param {boolean} [dismissible=true] When true, dismiss uses `onCancel`
 * @param {"primary"|"error"} [confirmVariant="primary"]
 * @param {string} [class] Extra Modal panel classes
 */
interface Props {
  title: string;
  titleId: string;
  description: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: string;
  onConfirm: string;
  dismissible?: boolean;
  confirmVariant?: "primary" | "error";
  class?: string;
}

// Props
const {
  title,
  titleId,
  description,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  dismissible = true,
  confirmVariant = "primary",
  class: classNameProp,
}: Props = Astro.props;

// Components
import Modal from "@components/ui/Modal.astro";
import Button from "@components/forms/Button.astro";

// Styles
const descriptionId = `${titleId}-desc`;
---

<Modal
  titleId={titleId}
  descriptionId={descriptionId}
  dismissible={dismissible}
  onDismiss={dismissible ? onCancel : undefined}
  class={classNameProp}
>
  <h2 id={titleId} class="text-lg font-semibold text-foreground">
    {title}
  </h2>
  <p id={descriptionId} class="mt-2 text-sm text-muted-foreground">
    {description}
  </p>
  <div slot="footer" class="mt-6 flex justify-end gap-3">
    <Button
      type="button"
      variant="ghost"
      class="w-1/3"
      title={cancelLabel}
      x-on:click={onCancel}
    />
    <Button
      type="button"
      variant={confirmVariant}
      class="w-1/3"
      title={confirmLabel}
      x-on:click={onConfirm}
    />
  </div>
</Modal>
```

- [ ] **Step 2: Verify TypeScript / Astro check for the new file**

```bash
npx astro check --root . 2>&1 | rg "ConfirmDialog|Modal" || true
```

Expected: no diagnostics for these two files.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ui/ConfirmDialog.astro
git commit -m "$(cat <<'EOF'
feat(ui): add ConfirmDialog preset on Modal

Title/description plus cancel/confirm Button row with Alpine
expression props and optional dismiss routed to onCancel.
EOF
)"
```

---

### Task 3: Migrate play finish-confirm

**Files:**
- Modify: `app/src/pages/games/score-training/play/index.astro` (finish-confirm block ~lines 80–103; add import)

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 2
- Produces: same Alpine handlers (`cancelFinish` / `confirmFinish` / `showFinishConfirm`) — no data-layer changes

- [ ] **Step 1: Add import**

In the play page frontmatter components section, add:

```astro
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
```

- [ ] **Step 2: Replace the inline finish-confirm markup**

Replace the entire `{/* Finish confirm (before results) */}` block with:

```astro
    {/* Finish confirm (before results) */}
    <div x-show="showFinishConfirm" x-cloak>
      <ConfirmDialog
        titleId="finish-confirm-title"
        title="Finish session?"
        description="This visit completes the session. Confirm to save, or cancel to adjust the score."
        confirmLabel="Confirm"
        onCancel="cancelFinish()"
        onConfirm="confirmFinish()"
        dismissible={false}
      />
    </div>
```

- [ ] **Step 3: Run existing unit tests (no behavior change expected)**

```bash
cd app && npm test
```

Expected: PASS (same as before this task).

- [ ] **Step 4: Manual check (or note for reviewer)**

With an active ROUNDS or MINUTES session that is one visit from completion: submit the completing score → modal appears → backdrop click and Escape must **not** dismiss → Cancel restores input → Confirm proceeds to results/upload path.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/games/score-training/play/index.astro
git commit -m "$(cat <<'EOF'
refactor(play): use ConfirmDialog for finish confirm

Replace duplicated overlay markup; keep dismissible false so only
explicit Cancel/Confirm close the dialog.
EOF
)"
```

---

### Task 4: Migrate `ExitModal`

**Files:**
- Modify: `app/src/components/layout/games/ExitModal.astro` (full file replace)

**Interfaces:**
- Consumes: `ConfirmDialog`
- Produces: same parent contract — `showExitModal`, `$dispatch('confirm-exit')`; `GameLayout` unchanged

- [ ] **Step 1: Replace `ExitModal.astro` contents**

```astro
---
/**
 * Presentational — parent GameLayout owns showExitModal (x-if).
 */

// Components
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
---

<ConfirmDialog
  titleId="exit-modal-title"
  title="Leave game?"
  description="This session will be recorded as abandoned."
  cancelLabel="Cancel"
  confirmLabel="Leave"
  onCancel="showExitModal = false"
  onConfirm="$dispatch('confirm-exit')"
/>
```

(Default `dismissible={true}` — Escape + backdrop invoke `onCancel`.)

- [ ] **Step 2: Smoke-check GameLayout still imports ExitModal**

No change to `app/src/layouts/GameLayout.astro` required. Confirm it still has:

```astro
<template x-if="showExitModal">
  <ExitModal />
</template>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/ExitModal.astro
git commit -m "$(cat <<'EOF'
refactor(ui): rebuild ExitModal on ConfirmDialog

Keep GameLayout visibility ownership; Leave still dispatches
confirm-exit; backdrop/Escape dismiss via onCancel.
EOF
)"
```

---

### Task 5: Migrate `ContinueSessionModal`

**Files:**
- Modify: `app/src/components/layout/games/ContinueSessionModal.astro` (full file replace)

**Interfaces:**
- Consumes: `Modal`, `Button`
- Produces: same Alpine handlers (`abandonSession`, `continueSession`, `loading`, `error`); setup page `x-if` wrapper unchanged

- [ ] **Step 1: Replace `ContinueSessionModal.astro` contents**

```astro
---
/**
 * Presentational — parent setup page owns showActiveSessionModal (x-if).
 * Custom two-action footer (not cancel/confirm) on Modal shell.
 */

// Components
import Modal from "@components/ui/Modal.astro";
import Button from "@components/forms/Button.astro";
---

<Modal
  titleId="continue-session-title"
  descriptionId="continue-session-desc"
  dismissible={false}
>
  <h2 id="continue-session-title" class="text-lg font-semibold text-foreground">
    Active Session
  </h2>
  <p id="continue-session-desc" class="mt-2 text-sm text-muted-foreground">
    You have an active Score Training session. Continue playing or start a new
    one?
  </p>
  <p class="mt-3 text-sm text-error" x-show="error" x-text="error" x-cloak></p>

  <div slot="footer" class="mt-6 flex gap-3">
    <Button
      type="button"
      variant="secondary"
      class="flex-1"
      title="Start New"
      @click="abandonSession()"
      :disabled="loading"
    />
    <Button
      type="button"
      class="flex-1"
      title="Continue"
      @click="continueSession()"
      :disabled="loading"
    />
  </div>
</Modal>
```

Notes:
- `dismissible={false}` — user must pick Start New or Continue (matches current lack of backdrop dismiss).
- Prefer `@click` / `:disabled` on `Button` as in the prior ContinueSessionModal (already worked). Fall back to `x-on:click` / `x-bind:disabled` only if the linter rejects `@` / `:` on the component tag.

- [ ] **Step 2: Commit**

```bash
git add app/src/components/layout/games/ContinueSessionModal.astro
git commit -m "$(cat <<'EOF'
refactor(ui): rebuild ContinueSessionModal on Modal shell

Custom footer with Button actions; keep error line in body;
non-dismissible so the user must choose Continue or Start New.
EOF
)"
```

---

### Task 6: Docs + Context Maintenance + verification

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md`
- Modify: `docs/architecture/07-Frontend/05-Astro-Components.md`
- Modify: `DECISIONS.md`
- Run: context checkers + tests (+ graph refresh if hooks did not)

**Interfaces:**
- Consumes: shipped `Modal` / `ConfirmDialog` behavior from Tasks 1–5
- Produces: D123 ledger entry; style-guide primitive contract; updated component examples

- [ ] **Step 1: Update style guide modal sections**

In `docs/architecture/07-Frontend/07-Style-Guide.md`:

1. Keep or refresh the `updated:` date in the HTML comment to `2026-07-21`.
2. Replace the **Modal action row** paragraph (currently “forward guidance — no modal primitive exists yet”) with:

```markdown
**Modal action row** (`ConfirmDialog.astro`): cancel `Button` (ghost) on the left, confirm `Button` (primary or error) on the right, row `justify-end gap-3`, buttons roughly `w-1/3` each. Custom footers (e.g. ContinueSession) compose `Modal`’s `footer` slot and may use different layouts.
```

3. Under **Interactivity**, replace the dialogs forward-guidance bullet with:

```markdown
- Dialogs (`Modal.astro`): when `dismissible` (default true), Escape and backdrop click invoke `onDismiss`. Parents own visibility (`x-show` / `x-if` + `x-cloak`). Set `dismissible={false}` when only explicit actions may close the dialog.
```

4. Under **Accessibility**, replace the dialogs forward-guidance bullet with:

```markdown
- Dialogs (`Modal.astro`): `role="dialog"`, `aria-modal="true"`, `aria-labelledby` required; `aria-describedby` when `descriptionId` is set. No focus trap in v1 (known gap).
```

5. Add a short note under Primitives (do not invent fake CSS class names) pointing at the components:

```markdown
Dialog components (not CSS classes): `components/ui/Modal.astro` (shell) and `components/ui/ConfirmDialog.astro` (cancel/confirm preset). See Interactivity / Accessibility.
```

6. Update the Related Documents line that says forward-guidance “will apply once built” for modal — change to present tense for Modal/ConfirmDialog.

- [ ] **Step 2: Update `05-Astro-Components.md` example row**

Change the `components/ui/` example cell from `` `Toast.astro`, `Modal.astro` `` to:

```markdown
| `components/ui/`     | portable, app-agnostic primitives (paired with `modules/ui/`) | `Modal.astro`, `ConfirmDialog.astro`, `Alert.astro` |
```

- [ ] **Step 3: Add D123 to `DECISIONS.md`**

In the Frontend table, after D122, add:

```markdown
| D123 | 2026-07-21 | Portable `Modal.astro` shell + `ConfirmDialog.astro` preset in `components/ui/`; parent owns visibility; Alpine expression props for dismiss/cancel/confirm; all dialog actions use `Button.astro`; `dismissible` opt-out for hard gates (finish-confirm, continue-session). ExitModal and ContinueSessionModal compose these primitives. | One overlay contract; stop duplicating backdrop/panel markup |
```

- [ ] **Step 4: Run Context Maintenance checkers**

From repo root:

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
```

Expected: all three pass. (No new `docs/architecture/` inventory file required for `docs/superpowers/**` — historical.)

- [ ] **Step 5: Run app tests**

```bash
cd app && npm test
```

Expected: PASS.

- [ ] **Step 6: Refresh knowledge graph if needed**

```bash
bash scripts/refresh-graph.sh
git add graphify-out/graph.json
```

If graphify CLI is absent, record the warning in the completion report instead of failing.

- [ ] **Step 7: Commit docs**

```bash
git add docs/architecture/07-Frontend/07-Style-Guide.md \
  docs/architecture/07-Frontend/05-Astro-Components.md \
  DECISIONS.md \
  graphify-out/graph.json
git commit -m "$(cat <<'EOF'
docs: record D123 Modal + ConfirmDialog primitive

Update style guide and Astro component examples now that the
dialog shell and confirm preset exist.
EOF
)"
```

---

## Manual verification checklist (end of plan)

| Dialog | Expect |
| ------ | ------ |
| Finish confirm | Opens on completing visit; Escape/backdrop do nothing; Cancel restores input; Confirm uploads/results |
| Exit (GameLayout) | Leave opens modal; backdrop/Escape cancel; Leave abandons via existing `confirm-exit` path |
| Continue session (setup) | Modal on active match; Start New / Continue work; no backdrop dismiss; error line still shows |

---

## Spec coverage (self-review)

| Spec requirement | Task |
| ---------------- | ---- |
| `Modal.astro` shell + a11y + dismiss | Task 1 |
| `ConfirmDialog.astro` + `Button` actions | Task 2 |
| Play finish-confirm migration, `dismissible={false}` | Task 3 |
| ExitModal → ConfirmDialog | Task 4 |
| ContinueSessionModal → Modal + footer | Task 5 |
| Style guide + 05-Astro-Components + DECISIONS | Task 6 |
| Results overlay out of scope | Explicit non-touch |
| No Astro Vitest (D101) | Global Constraints + verify via `npm test` |
| No focus trap / modules/ui factory | Global Constraints |

**Placeholder scan:** none intentional.  
**Type consistency:** prop names match the spec (`titleId`, `descriptionId`, `dismissible`, `onDismiss`, `onCancel`, `onConfirm`, `confirmVariant`).
