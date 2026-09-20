import type {
  ScheduleData,
  ScheduleSummaryData,
  RoutineSummaryData,
} from "@client/api/types";

/** One entry of `ScheduleData["days"]` — a weekday's mapped routine. */
export type ScheduleDayEntry = ScheduleData["days"][number];

export type TodayCardContext = {
  loading: boolean;
  error: string;
  schedule: ScheduleData | null;
  navigate(path: string): void;
  init(this: TodayCardContext): Promise<void>;
  entry(this: TodayCardContext): ScheduleDayEntry | null;
  isRestDay(this: TodayCardContext): boolean;
  startPath(this: TodayCardContext): string;
  start(this: TodayCardContext): void;
};

export type SchedulesIndexContext = {
  loading: boolean;
  error: string;
  schedules: ScheduleSummaryData[];
  busyId: string | null;
  navigate(path: string): void;
  init(this: SchedulesIndexContext): Promise<void>;
  refresh(this: SchedulesIndexContext): Promise<void>;
  editHref(schedule: ScheduleSummaryData): string;
  activate(
    this: SchedulesIndexContext,
    schedule: ScheduleSummaryData,
  ): Promise<void>;
  deactivate(
    this: SchedulesIndexContext,
    schedule: ScheduleSummaryData,
  ): Promise<void>;
};

/** One editor row: an ISO weekday (1 Monday..7 Sunday) and its routine, or `null` for rest. */
export type ScheduleEditorRow = {
  dayOfWeek: number;
  routineTemplateId: string | null;
};

export type ScheduleEditorContext = {
  mode: "create" | "edit";
  scheduleId: string | null;
  loading: boolean;
  saving: boolean;
  error: string;
  serverIssues: string[];
  name: string;
  rows: ScheduleEditorRow[];
  routines: RoutineSummaryData[];
  maxNameLength: number;
  navigate(path: string): void;
  init(this: ScheduleEditorContext): Promise<void>;
  loadExisting(this: ScheduleEditorContext): Promise<void>;
  routineLabel(routine: RoutineSummaryData): string;
  weekdayLabel(index: number): string;
  nameValid(this: ScheduleEditorContext): boolean;
  canSave(this: ScheduleEditorContext): boolean;
  payload(this: ScheduleEditorContext): {
    name: string;
    days: { dayOfWeek: number; routineTemplateId: string }[];
  };
  save(this: ScheduleEditorContext): Promise<void>;
  cancel(this: ScheduleEditorContext): void;
};
