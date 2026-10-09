import type {
  ScheduleData,
  ScheduleSummaryData,
  RoutineSummaryData,
  TrainingCompletionListData,
} from "@client/api/types";

/** One entry of `ScheduleData["days"]` — a weekday's mapped routine. */
export type ScheduleDayEntry = ScheduleData["days"][number];

/** One weekday's state in the training page's schedule strip. */
export type DayStatus = "done" | "missed" | "today" | "scheduled" | "rest";

/** The schedule card's summary totals for the current week. */
export type WeekCounts = { done: number; missed: number; toGo: number };

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

/** A picker option for an editor row; `value` is `null` for Rest. */
export type ScheduleRoutineOption = {
  value: string | null;
  label: string;
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
  routineOptions(this: ScheduleEditorContext): ScheduleRoutineOption[];
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

export type MyScheduleFormContext = {
  loading: boolean;
  saving: boolean;
  error: string;
  serverIssues: string[];
  scheduleId: string | null;
  name: string;
  rows: ScheduleEditorRow[];
  routines: RoutineSummaryData[];
  selectedIndex: number;
  init(this: MyScheduleFormContext): Promise<void>;
  applySchedule(
    this: MyScheduleFormContext,
    schedule: ScheduleData | null,
  ): void;
  resetForm(this: MyScheduleFormContext): Promise<void>;
  dayInitial(index: number): string;
  dayLabel(index: number): string;
  selectedDayLabel(this: MyScheduleFormContext): string;
  selectDay(this: MyScheduleFormContext, index: number): void;
  hasRoutine(this: MyScheduleFormContext, index: number): boolean;
  isRoutineSelected(
    this: MyScheduleFormContext,
    routine: RoutineSummaryData,
  ): boolean;
  toggleRoutine(this: MyScheduleFormContext, routine: RoutineSummaryData): void;
  canSave(this: MyScheduleFormContext): boolean;
  payload(this: MyScheduleFormContext): {
    name: string;
    days: { dayOfWeek: number; routineTemplateId: string }[];
  };
  save(this: MyScheduleFormContext): Promise<boolean>;
};

export type TrainingWeekContext = {
  loading: boolean;
  schedule: ScheduleData | null;
  completions: TrainingCompletionListData["items"];
  today: number;
  init(this: TrainingWeekContext): Promise<void>;
  /** Adopts the schedule the edit modal just saved (its `schedule-saved` event). */
  applySaved(this: TrainingWeekContext, schedule: ScheduleData): void;
  status(this: TrainingWeekContext, index: number): DayStatus;
  /** The strip circle's size, fill, border and text classes for the day's status. */
  dayClass(this: TrainingWeekContext, index: number): string;
  counts(this: TrainingWeekContext): WeekCounts;
  hasSchedule(this: TrainingWeekContext): boolean;
  navigate(path: string): void;
  /** The schedule's entry for today, or `null` on a rest day or without a schedule. */
  todayEntry(this: TrainingWeekContext): ScheduleDayEntry | null;
  /** Whether today has a routine that is not yet done — drives the home play button. */
  canStart(this: TrainingWeekContext): boolean;
  /** Opens today's routine; a no-op on a rest day. */
  start(this: TrainingWeekContext): void;
  letter(index: number): string;
  dayLabel(this: TrainingWeekContext, index: number): string;
};
