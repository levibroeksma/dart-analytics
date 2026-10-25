import type {
  HeatmapCellRow,
  HomeDay,
  HomeStats,
  HomeWindows,
  VisitScoringRow,
} from "@modules/types";

export const HOME_GAME_TYPES = ["501", "SCORE_TRAINING"] as const;

export const HOME_CELL_MM = 4;

const WINDOW_DAYS = 30;
const DAILY_DAYS = 7;
const MINUTE_MS = 60_000;

type DayScoring = {
  date: string;
  points: number;
  darts: number;
  firstNinePoints: number;
  firstNineDarts: number;
};

function localDate(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(instant);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function isoWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function offsetMinutes(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / MINUTE_MS;
}

/** The first instant of local `date` in `tz`; a day whose midnight is skipped by a clock change starts at the change. */
function startOfLocalDay(date: string, tz: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetMinutes(new Date(guess), tz) * MINUTE_MS;
  const second = guess - offsetMinutes(new Date(first), tz) * MINUTE_MS;
  return new Date(localDate(new Date(second), tz) === date ? second : first);
}

/**
 * The Home read windows for `now` in `tz`: the last 30 local days, the 30
 * before, and the last 7, each bound on a local midnight; `to` is the start of
 * tomorrow.
 */
export function homeWindows(now: Date, tz: string): HomeWindows {
  const today = localDate(now, tz);
  const currentStartDate = addDays(today, -(WINDOW_DAYS - 1));
  const previousStartDate = addDays(today, -(2 * WINDOW_DAYS - 1));
  return {
    today,
    currentStartDate,
    previousStartDate,
    dailyStartDate: addDays(today, -(DAILY_DAYS - 1)),
    currentFrom: startOfLocalDay(currentStartDate, tz).toISOString(),
    previousFrom: startOfLocalDay(previousStartDate, tz).toISOString(),
    to: startOfLocalDay(addDays(today, 1), tz).toISOString(),
  };
}

function dayScoring(
  rows: readonly VisitScoringRow[],
  tz: string,
): DayScoring[] {
  return rows.map((row) => ({
    date: localDate(new Date(row.bucketStart), tz),
    points: row.points,
    darts: row.darts,
    firstNinePoints: row.firstNinePoints,
    firstNineDarts: row.firstNineDarts,
  }));
}

function firstNineAverage(
  days: readonly DayScoring[],
  fromDate: string,
  toDate: string,
): number | null {
  let points = 0;
  let darts = 0;
  for (const day of days) {
    if (day.date >= fromDate && day.date <= toDate) {
      points += day.firstNinePoints;
      darts += day.firstNineDarts;
    }
  }
  return darts === 0 ? null : (3 * points) / darts;
}

function dailyAverages(
  days: readonly DayScoring[],
  windows: HomeWindows,
): HomeDay[] {
  return Array.from({ length: DAILY_DAYS }, (_, index) => {
    const date = addDays(windows.dailyStartDate, index);
    const day = days.find((candidate) => candidate.date === date);
    return {
      date,
      weekday: isoWeekday(date),
      value: day && day.darts > 0 ? (3 * day.points) / day.darts : null,
    };
  });
}

/**
 * Folds the day-bucketed scoring rows and heatmap cells into the Home
 * payload: first-9 average per window with their difference, seven daily
 * averages, and the landing cells. A window or day with no darts is `null`.
 */
export function shapeHomeStats(input: {
  rows: readonly VisitScoringRow[];
  cells: readonly HeatmapCellRow[];
  windows: HomeWindows;
  tz: string;
}): HomeStats {
  const { rows, cells, windows, tz } = input;
  const days = dayScoring(rows, tz);
  const current = firstNineAverage(
    days,
    windows.currentStartDate,
    windows.today,
  );
  const previous = firstNineAverage(
    days,
    windows.previousStartDate,
    addDays(windows.currentStartDate, -1),
  );
  return {
    firstNine: {
      current,
      previous,
      delta: current === null || previous === null ? null : current - previous,
    },
    daily: dailyAverages(days, windows),
    landing: {
      cellMm: HOME_CELL_MM,
      cells: cells.map((cell) => [cell.ix, cell.iy, cell.darts]),
    },
  };
}
