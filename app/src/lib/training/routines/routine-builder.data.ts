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
} from "@routes/routines/types";
import { routineDetailPath, routineIdFromLocation } from "./routine-route";
import type { ExerciseTemplateCatalogEntryData } from "@client/api/types";
import type { BuilderStep, RoutineBuilderContext } from "./types";

/** Mirrors the server's per-routine step cap (`pages/api/routines/types.ts`). */
export const MAX_BUILDER_STEPS = MAX_ROUTINE_STEPS;
export const DEFAULT_STEP_MINUTES = 5;
const MIN_STEP_MINUTES = 1;
/** Mirrors the server's per-step minute ceiling (`pages/api/routines/types.ts`). */
const MAX_STEP_MINUTES = MAX_ROUTINE_STEP_MINUTES;
const MAX_NAME_LENGTH = 60;

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

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: RoutineBuilderContext) {
      this.loading = true;
      this.error = "";
      try {
        this.catalog = await listExerciseTemplates();
        if (this.mode === "edit") await this.loadExisting();
      } catch {
        this.error = "Could not load the exercise catalog.";
      } finally {
        this.loading = false;
      }
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
      this.steps = this.steps.filter((_, i) => i !== index);
    },

    moveUp(this: RoutineBuilderContext, index: number) {
      if (index <= 0) return;
      this.steps = swap(this.steps, index, index - 1);
    },

    moveDown(this: RoutineBuilderContext, index: number) {
      if (index >= this.steps.length - 1) return;
      this.steps = swap(this.steps, index, index + 1);
    },

    setMinutes(this: RoutineBuilderContext, index: number, value: number) {
      const step = this.steps[index];
      if (!step) return;
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

    durationIssues(this: RoutineBuilderContext): string[] {
      const result = this.durationResult();
      return result.ok ? [] : result.issues;
    },

    nameValid(this: RoutineBuilderContext): boolean {
      const trimmed = this.name.trim();
      return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
    },

    canSave(this: RoutineBuilderContext): boolean {
      if (this.saving || this.loading || this.error) return false;
      if (this.mode === "edit" && !this.routineId) return false;
      return this.nameValid() && this.durationResult().ok;
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
          const issues = err.details?.issues;
          this.serverIssues = Array.isArray(issues)
            ? issues.map(String)
            : [String(err.details?.reason ?? "The routine was not accepted.")];
        } else {
          this.error =
            "Could not save the routine. Check your connection and retry.";
        }
      } finally {
        this.saving = false;
      }
    },

    cancel(this: RoutineBuilderContext) {
      this.navigate(
        this.routineId ? routineDetailPath(this.routineId) : "/training",
      );
    },
  };
}
