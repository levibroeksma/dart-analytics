# Modal + ConfirmDialog — Design

> **Date:** 2026-07-21
> **Status:** approved (brainstorming consensus)
> **Scope:** Portable `Modal.astro` shell + `ConfirmDialog.astro` preset in `components/ui/`; migrate finish-confirm, ExitModal, and ContinueSessionModal onto them; reuse `Button.astro` for all dialog actions.
> **Out of scope:** Results overlay on Score Training play; focus trap; Alpine `modules/ui` modal factory; Vitest for `.astro` markup (D101).

---

## Context

Three near-copies of the same overlay markup exist today:

| Call site | File | Pattern |
| --------- | ---- | ------- |
| Finish confirm | Inline in `pages/games/score-training/play/index.astro` | Title + body + Cancel / Confirm |
| Leave game | `components/layout/games/ExitModal.astro` | Title + body + Cancel / Leave |
| Active session | `components/layout/games/ContinueSessionModal.astro` | Title + body + Start New / Continue (not cancel/confirm) |

Style guide (`07-Frontend/07-Style-Guide.md`) already has forward guidance for a modal primitive (action row, Escape/backdrop dismiss, a11y). `05-Astro-Components.md` lists `Modal.astro` under `components/ui/`. No primitive exists yet.

Decisions locked in brainstorming:

| Topic | Choice |
| ----- | ------ |
| Shape | Shell (`Modal`) + confirm preset (`ConfirmDialog`) — Approach 1 |
| Migration | All three call sites in this change |
| Action wiring | Alpine expression props (`onCancel` / `onConfirm` / `onDismiss`) |
| Dismiss | Opt-in via `dismissible` (default `true`); finish-confirm uses `false` |
| Buttons | Always `Button.astro` (ghost cancel, primary/error confirm) — no raw `<button class="btn …">` |

Authority: `07-Frontend/07-Style-Guide.md`, `05-Astro-Components.md`, `04-Modules-And-OOP.md` (portable UI constraints).

---

## Scope

In scope:

- `app/src/components/ui/Modal.astro` — backdrop, panel, a11y, optional dismiss
- `app/src/components/ui/ConfirmDialog.astro` — composes `Modal` + title/body + two `Button`s
- Migrate play finish-confirm → inline `ConfirmDialog`
- Refactor `ExitModal.astro` → thin `ConfirmDialog` wrapper (file kept)
- Refactor `ContinueSessionModal.astro` → `Modal` + custom `footer` slot with two `Button`s
- Update style-guide forward guidance to “primitive exists”
- Targeted docs touch in `05-Astro-Components.md` / `DECISIONS.md` as needed for Context Maintenance

Out of scope:

- Play-page results overlay (may adopt `Modal` later)
- Focus trap / return-focus management
- `modules/ui` Alpine factory for open state
- Unit tests for Astro markup (D101)

---

## Design

### Architecture

| Piece | Path | Role |
| ----- | ---- | ---- |
| `Modal.astro` | `components/ui/` | Portable shell: backdrop + panel + dialog a11y; default slot (body); optional named `footer` slot |
| `ConfirmDialog.astro` | `components/ui/` | Composes `Modal`; title/description props; cancel/confirm `Button` row |
| Call sites | play page, Exit, Continue | Parent owns open state (`x-show` / `x-if` + `x-cloak`); dialogs stay presentational |

Visibility stays on the parent wrapper — not inside `Modal`. No Alpine `modules/ui` pairing in v1.

### `Modal.astro` API

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `titleId` | string | required | `aria-labelledby` |
| `descriptionId` | string? | — | `aria-describedby` when provided |
| `dismissible` | boolean | `true` | Escape + backdrop click → `onDismiss` |
| `onDismiss` | string | — | Alpine expression; required when `dismissible` |
| `class` | string? | — | Extra panel classes via `cn()` |

Slots:

- default — body content
- `footer` — optional action row (caller-provided)

Markup contract:

- Backdrop: `fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4`
- Panel: raised surface tokens, `max-w-sm w-full p-6 rounded-lg`
- When `dismissible`: `@keydown.escape.window` and `@click.self` on backdrop invoke `onDismiss`
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`, optional `aria-describedby`

### `ConfirmDialog.astro` API

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `title` | string | required | Rendered as `h2` with `titleId` |
| `titleId` | string | required | Stable unique id per call site |
| `description` | string | required | Body copy |
| `cancelLabel` | string | `"Cancel"` | `Button` variant `ghost` |
| `confirmLabel` | string | `"Confirm"` | `Button` variant from `confirmVariant` |
| `onCancel` | string | required | Alpine expression |
| `onConfirm` | string | required | Alpine expression |
| `dismissible` | boolean | `true` | Forwarded to `Modal`; when true, dismiss uses `onCancel` |
| `confirmVariant` | `"primary" \| "error"` | `"primary"` | Destructive confirms later |
| `class` | string? | — | Forwarded to `Modal` panel |

Action row (style guide): cancel left, confirm right, `justify-end gap-3`, buttons ~`w-1/3` via `Button` + class.

Illustrative usage:

```astro
<ConfirmDialog
  titleId="finish-confirm-title"
  title="Finish session?"
  description="This visit completes the session. Confirm to save, or cancel to adjust the score."
  confirmLabel="Confirm"
  onCancel="cancelFinish()"
  onConfirm="confirmFinish()"
  dismissible={false}
/>
```

### Call-site migration

| Call site | Becomes | Notes |
| --------- | ------- | ----- |
| Play finish-confirm | Inline `<ConfirmDialog>` | `dismissible={false}` — explicit buttons only (current behavior) |
| `ExitModal.astro` | Thin `<ConfirmDialog>` wrapper | `onCancel="showExitModal = false"`, `onConfirm="$dispatch('confirm-exit')"`, confirm label `"Leave"`, `dismissible` default true |
| `ContinueSessionModal.astro` | `<Modal>` + custom footer | Not cancel/confirm — `footer` slot with `Button` secondary (`Start New` / `abandonSession`) and primary (`Continue` / `continueSession`); error `<p>` stays in body slot |

### A11y, motion, errors

- Dialogs: labelled (and described when `descriptionId` set).
- No focus trap in v1 — document as known gap (none today).
- Motion: optional opacity fade 150–200ms `ease-out`; skip if it fights Alpine `x-show`.
- `ConfirmDialog` has no error slot; ContinueSession keeps its error line in the body slot.

### Testing

- No Astro-component unit tests (D101).
- No new store/engine logic — existing play/setup Alpine data tests must stay green.
- Manual check: finish confirm (no backdrop/Escape dismiss), exit (backdrop + Escape → cancel), continue session (custom footer + error line).

### Docs / context maintenance

- Style guide: replace “no modal primitive exists yet” with the live `Modal` / `ConfirmDialog` contract; keep action-row and dismiss rules.
- `05-Astro-Components.md`: ensure `Modal.astro` / `ConfirmDialog.astro` example row matches reality.
- `DECISIONS.md`: one-liner for shell + confirm preset + parent-owned visibility + `Button` reuse.
- Run Context Maintenance checkers after implementation (not required for this design-doc-only commit beyond map/date if inventory requires the new spec — historical `docs/superpowers/**` stays historical per docs CLAUDE; specs are already under that tree).

---

## Non-goals (reiterated)

- Migrating the results overlay
- Focus trap / scroll lock beyond current behavior
- Portable Alpine modal factory in `modules/ui`
- Changing finish/exit/continue business logic — presentation only
