import {
  createRoutine,
  getRoutine,
  listExerciseTemplates,
  updateRoutine,
} from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import {
  MAX_ROUTINE_MINUTES,
  MIN_USER_ROUTINE_MINUTES,
  validateRoutineDuration,
} from "@modules/training/routines/routine-duration.module";
import {
  MAX_ROUTINE_STEP_MINUTES,
  MAX_ROUTINE_STEPS,
  MAX_ROUTINE_NAME_LENGTH,
} from "@routes/routines/types";
import { tuodDurationBounds } from "@lib/game/tuod-duration";
import { routineDetailPath, routineIdFromLocation } from "./routine-route";
import type { ExerciseTemplateCatalogEntryData } from "@client/api/types";
import type { BuilderStep, RoutineBuilderContext } from "./types";

/** Mirrors the server's per-routine step cap (`pages/api/routines/types.ts`). */
const MAX_BUILDER_STEPS = MAX_ROUTINE_STEPS;
const DEFAULT_STEP_MINUTES = 5;
const MIN_STEP_MINUTES = 1;
/** Mirrors the server's per-step minute ceiling (`pages/api/routines/types.ts`). */
const MAX_STEP_MINUTES = MAX_ROUTINE_STEP_MINUTES;
/** Mirrors the server's routine-name length cap (`pages/api/routines/types.ts`). */
const MAX_NAME_LENGTH = MAX_ROUTINE_NAME_LENGTH;

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return MIN_STEP_MINUTES;
  return Math.min(
    MAX_STEP_MINUTES,
    Math.max(MIN_STEP_MINUTES, Math.floor(value)),
  );
}

function swap(steps: BuilderStep[], a: number, b: number): BuilderStep[] {
  const next = [...steps];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/**
 * Formats a `VALIDATION_FAILED` envelope's `details` into user-facing lines.
 * The duration pre-check reports `{ issues: string[] }`; the GAME-step bound
 * (`routine.service.ts`'s `writeIssues`) reports `{ reason, step, min, max }`
 * instead — this surfaces the latter's `step`/`min`/`max` rather than
 * discarding them behind the bare `reason` string.
 */
function formatServerIssues(
  details: Record<string, unknown> | undefined,
): string[] {
  if (!details) return ["The routine was not accepted."];
  if (Array.isArray(details.issues)) return details.issues.map(String);
  const reason =
    typeof details.reason === "string"
      ? details.reason
      : "The routine was not accepted.";
  const extras: string[] = [];
  if (typeof details.step === "number") extras.push(`step ${details.step}`);
  if (typeof details.min === "number" && typeof details.max === "number") {
    extras.push(`allowed ${details.min}–${details.max} minutes`);
  }
  return [extras.length > 0 ? `${reason} (${extras.join(", ")})` : reason];
}

/**
 * Builder state for `/training/routines/new` and `/edit`. Pre-validates with
 * the same module the service runs; the `0038` trigger is the guarantee behind
 * both. Lives in the page's `x-data`, not a store (`app/src/stores/CLAUDE.md`).
 */
export function routineBuilder(mode: "create" | "edit") {
  return {
    mode,
    routineId: null as string | null,
    loading: true,
    saving: false,
    error: "",
    serverIssues: [] as string[],
    name: "",
    description: "",
    catalog: [] as ExerciseTemplateCatalogEntryData[],
    steps: [] as BuilderStep[],
    minMinutes: MIN_USER_ROUTINE_MINUTES,
    maxMinutes: MAX_ROUTINE_MINUTES,
    maxSteps: MAX_BUILDER_STEPS,
    stepMinMinutes: MIN_STEP_MINUTES,
    stepMaxMinutes: MAX_STEP_MINUTES,
    maxNameLength: MAX_NAME_LENGTH,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: RoutineBuilderContext) {
      this.loading = true;
      this.error = "";
      try {
        this.catalog = await listExerciseTemplates();
      } catch {
        this.error = "Could not load the exercise catalog.";
        this.loading = false;
        return;
      }
      if (this.mode === "edit") {
        try {
          await this.loadExisting();
        } catch {
          this.error = "Could not load this routine.";
        }
      }
      this.loading = false;
    },

    async loadExisting(this: RoutineBuilderContext) {
      const routineId = routineIdFromLocation();
      if (!routineId) {
        this.error = "No routine selected.";
        return;
      }
      const routine = await getRoutine(routineId);
      if (routine.isSystemTemplate) {
        this.error =
          "A system routine cannot be edited. Build your own instead.";
        return;
      }
      this.routineId = routine.routineId;
      this.name = routine.routineName;
      this.description = routine.description ?? "";
      this.steps = routine.steps.map((step) => ({
        exerciseTemplateId: step.exerciseTemplateId,
        name: step.exerciseName,
        exerciseTypeKey: step.exerciseTypeKey,
        durationValue: step.durationValue,
      }));
    },

    addStep(
      this: RoutineBuilderContext,
      entry: ExerciseTemplateCatalogEntryData,
    ) {
      if (this.steps.length >= MAX_BUILDER_STEPS) return;
      this.serverIssues = [];
      this.steps = [
        ...this.steps,
        {
          exerciseTemplateId: entry.exerciseTemplateId,
          name: entry.name,
          exerciseTypeKey: entry.exerciseTypeKey,
          durationValue: DEFAULT_STEP_MINUTES,
        },
      ];
    },

    removeStep(this: RoutineBuilderContext, index: number) {
      this.serverIssues = [];
      this.steps = this.steps.filter((_, i) => i !== index);
    },

    moveUp(this: RoutineBuilderContext, index: number) {
      if (index <= 0) return;
      this.serverIssues = [];
      this.steps = swap(this.steps, index, index - 1);
    },

    moveDown(this: RoutineBuilderContext, index: number) {
      if (index >= this.steps.length - 1) return;
      this.serverIssues = [];
      this.steps = swap(this.steps, index, index + 1);
    },

    setMinutes(this: RoutineBuilderContext, index: number, value: number) {
      const step = this.steps[index];
      if (!step) return;
      this.serverIssues = [];
      this.steps = this.steps.map((s, i) =>
        i === index ? { ...s, durationValue: clampMinutes(Number(value)) } : s,
      );
    },

    durationResult(this: RoutineBuilderContext) {
      return validateRoutineDuration(
        this.steps.map((step, index) => ({
          sequenceNumber: index + 1,
          durationTypeKey: "MINUTES" as const,
          durationValue: step.durationValue,
        })),
        { minMinutes: MIN_USER_ROUTINE_MINUTES },
      );
    },

    totalMinutes(this: RoutineBuilderContext): number {
      return this.steps.reduce((sum, step) => sum + step.durationValue, 0);
    },

    gameStepIssues(this: RoutineBuilderContext): string[] {
      const { min, max } = tuodDurationBounds("MINUTES");
      return this.steps.flatMap((step, index) =>
        step.exerciseTypeKey === "GAME" &&
        (step.durationValue < min || step.durationValue > max)
          ? [
              `step ${index + 1} (${step.name}) must be between ${min} and ${max} minutes`,
            ]
          : [],
      );
    },

    durationIssues(this: RoutineBuilderContext): string[] {
      const result = this.durationResult();
      return [...this.gameStepIssues(), ...(result.ok ? [] : result.issues)];
    },

    nameValid(this: RoutineBuilderContext): boolean {
      const trimmed = this.name.trim();
      return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
    },

    canSave(this: RoutineBuilderContext): boolean {
      if (this.saving || this.loading) return false;
      if (this.mode === "edit" && !this.routineId) return false;
      return (
        this.nameValid() &&
        this.durationResult().ok &&
        this.gameStepIssues().length === 0
      );
    },

    payload(this: RoutineBuilderContext) {
      return {
        name: this.name.trim(),
        description: this.description.trim() || null,
        steps: this.steps.map((step) => ({
          exerciseTemplateId: step.exerciseTemplateId,
          durationTypeKey: "MINUTES" as const,
          durationValue: step.durationValue,
        })),
      };
    },

    async save(this: RoutineBuilderContext) {
      if (!this.canSave()) return;
      this.saving = true;
      this.error = "";
      this.serverIssues = [];
      try {
        const saved =
          this.mode === "edit" && this.routineId
            ? await updateRoutine(this.routineId, this.payload())
            : await createRoutine(this.payload());
        this.navigate(routineDetailPath(saved.routineId));
      } catch (err) {
        if (
          err instanceof SessionApiError &&
          err.code === "VALIDATION_FAILED"
        ) {
          this.serverIssues = formatServerIssues(err.details);
        } else {
          this.error =
            "Could not save the routine. Check your connection and retry.";
        }
      } finally {
        this.saving = false;
      }
    },

    async resetForm(this: RoutineBuilderContext) {
      this.error = "";
      this.serverIssues = [];
      if (this.mode === "edit" && this.routineId) {
        try {
          await this.loadExisting();
        } catch {
          this.error = "Could not load this routine.";
        }
        return;
      }
      this.name = "";
      this.description = "";
      this.steps = [];
    },

    cancel(this: RoutineBuilderContext) {
      this.navigate(
        this.routineId ? routineDetailPath(this.routineId) : "/training",
      );
    },
  };
}
