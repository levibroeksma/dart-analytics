import { fetchCatalogTags } from "@client/api/catalog";
import { deleteRoutine, getRoutine } from "@client/api/routines";
import { cardTags } from "@lib/catalog/tags";
import {
  routineEditPath,
  routineIdFromLocation,
  routinePlayPath,
} from "./routine-route";
import { stepTagSet } from "./step-tag-set";
import type { RoutineExecutionData } from "@client/api/types";
import type { CatalogTagsResponse } from "@lib/types";
import type { RoutineDetailContext } from "./types";

type Step = RoutineExecutionData["steps"][number];

const TONE_BG = ["bg-accent", "bg-accent/70", "bg-accent/45", "bg-white/35"];
const TONE_BORDER = [
  "border-accent",
  "border-accent/70",
  "border-accent/45",
  "border-white/35",
];

export function routineDetail() {
  return {
    loading: true,
    error: "",
    routine: null as RoutineExecutionData | null,
    deleting: false,
    deleteBusy: false,
    starting: false,
    catalogTags: null as CatalogTagsResponse | null,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: RoutineDetailContext) {
      const routineId = routineIdFromLocation();
      if (!routineId) {
        this.error = "No routine selected.";
        this.loading = false;
        return;
      }
      try {
        const [routine, tags] = await Promise.all([
          getRoutine(routineId),
          fetchCatalogTags().catch(() => null),
        ]);
        this.routine = routine;
        this.catalogTags = tags;
      } catch {
        this.error = "Could not load this routine.";
      } finally {
        this.loading = false;
      }
    },

    totalMinutes(this: RoutineDetailContext): number {
      return (this.routine?.steps ?? []).reduce(
        (sum, step) =>
          step.durationTypeKey === "MINUTES" ? sum + step.durationValue : sum,
        0,
      );
    },

    durationLabel(this: RoutineDetailContext): string {
      return `${this.totalMinutes()} min`;
    },

    stepWeight(step: Step): number {
      return step.durationTypeKey === "MINUTES" ? step.durationValue : 1;
    },

    stepTone(index: number, part: "bg" | "border"): string {
      const tones = part === "bg" ? TONE_BG : TONE_BORDER;
      return tones[index % tones.length];
    },

    stepTag(this: RoutineDetailContext, step: Step): string | null {
      const set = stepTagSet(
        this.catalogTags,
        step.exerciseTypeKey,
        step.gameTypeKey,
      );
      return set ? (cardTags(set, "exercise")[0]?.name ?? null) : null;
    },

    stepDuration(step: Step): string {
      return step.durationTypeKey === "MINUTES"
        ? `${step.durationValue} min`
        : `${step.durationValue} rounds`;
    },

    canEdit(this: RoutineDetailContext): boolean {
      return this.routine !== null && !this.routine.isSystemTemplate;
    },

    playPath(this: RoutineDetailContext): string {
      return this.routine
        ? routinePlayPath(this.routine.routineId)
        : "/training";
    },

    editPath(this: RoutineDetailContext): string {
      return this.routine
        ? routineEditPath(this.routine.routineId)
        : "/training";
    },

    start(this: RoutineDetailContext) {
      this.starting = true;
      this.navigate(this.playPath());
    },

    requestDelete(this: RoutineDetailContext) {
      this.deleting = true;
    },

    cancelDelete(this: RoutineDetailContext) {
      this.deleting = false;
    },

    async confirmDelete(this: RoutineDetailContext) {
      if (!this.routine || this.deleteBusy) return;
      this.deleteBusy = true;
      try {
        await deleteRoutine(this.routine.routineId);
        this.navigate("/training");
      } catch {
        this.error = "Could not delete this routine.";
        this.deleteBusy = false;
        this.deleting = false;
      }
    },
  };
}
