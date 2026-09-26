import type {
  Bucket,
  ChunkWindow,
  ServerSectionId,
  ServerSectionMetrics,
} from "./types";

/** A calendar date with no time-of-day or zone attached — the unit every chunk-window boundary is computed in. */
type CivilDate = { year: number; month: number; day: number };

/**
 * `instant`'s wall-clock date and time in `tz`, read through
 * `Intl.DateTimeFormat` rather than a fixed-offset table — correct across a
 * DST transition by construction.
 */
function zonedParts(
  instant: Date,
  tz: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function civilOf(instant: Date, tz: string): CivilDate {
  const parts = zonedParts(instant, tz);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/**
 * The UTC instant of `civil`'s local midnight in `tz`. Two passes of
 * "format the guess, correct by the difference" converge even across a DST
 * jump, since the offset changes by at most a few hours and the first pass
 * already lands within one such jump of the target.
 */
function utcForZonedMidnight(civil: CivilDate, tz: string): Date {
  const desiredMs = Date.UTC(civil.year, civil.month - 1, civil.day);
  let guessMs = desiredMs;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(new Date(guessMs), tz);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = desiredMs - actualMs;
    if (diff === 0) break;
    guessMs += diff;
  }
  return new Date(guessMs);
}

function addDaysCivil(civil: CivilDate, days: number): CivilDate {
  const ms =
    Date.UTC(civil.year, civil.month - 1, civil.day) + days * 86_400_000;
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addMonthsCivil(civil: CivilDate, months: number): CivilDate {
  const total = civil.year * 12 + (civil.month - 1) + months;
  const year = Math.floor(total / 12);
  return { year, month: total - year * 12 + 1, day: 1 };
}

function startOfMonthCivil(civil: CivilDate): CivilDate {
  return { year: civil.year, month: civil.month, day: 1 };
}

function isoWeekdayOfCivil(civil: CivilDate): number {
  const day = new Date(
    Date.UTC(civil.year, civil.month - 1, civil.day),
  ).getUTCDay();
  return day === 0 ? 7 : day;
}

function startOfWeekCivil(civil: CivilDate): CivilDate {
  return addDaysCivil(civil, -(isoWeekdayOfCivil(civil) - 1));
}

type ChunkUnit = "day" | "week" | "month";

/** `day`/`week` chunk at their own unit; every other bucket (`month`, `none`, `year`) chunks by calendar month. */
function chunkUnitOf(bucket: Bucket): ChunkUnit {
  if (bucket === "day" || bucket === "week") return bucket;
  return "month";
}

function startOfUnitCivil(unit: ChunkUnit, civil: CivilDate): CivilDate {
  if (unit === "day") return civil;
  if (unit === "week") return startOfWeekCivil(civil);
  return startOfMonthCivil(civil);
}

function nextUnitCivil(unit: ChunkUnit, civil: CivilDate): CivilDate {
  if (unit === "day") return addDaysCivil(civil, 1);
  if (unit === "week") return addDaysCivil(civil, 7);
  return addMonthsCivil(civil, 1);
}

/** One window clipped to `[fromInstant, toInstant)`, or `null` once clipping leaves nothing. */
function clipWindow(
  windowStart: Date,
  windowEnd: Date,
  fromInstant: Date,
  toInstant: Date,
): ChunkWindow | null {
  const from =
    windowStart.getTime() < fromInstant.getTime() ? fromInstant : windowStart;
  const to = windowEnd.getTime() > toInstant.getTime() ? toInstant : windowEnd;
  if (from.getTime() >= to.getTime()) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * The chunk windows a server section's `[from, to)` splits into for chunked,
 * per-window caching (`00-Overview.md` §4, phase-3 decision 2): the bucket
 * unit itself for `day`/`week`/`month`, calendar months in `tz` for
 * `none`/`year` (a `year` view is a client regroup of its months,
 * `regroupMonthsIntoYears`). Every boundary is local midnight in `tz`, so it
 * is correct across a DST transition. The first and last windows are clipped
 * to the requested `from`/`to`; isomorphic and pure.
 */
export function chunkWindows(
  from: string,
  to: string,
  bucket: Bucket,
  tz: string,
): ChunkWindow[] {
  const fromInstant = new Date(from);
  const toInstant = new Date(to);
  const unit = chunkUnitOf(bucket);

  let cursorCivil = startOfUnitCivil(unit, civilOf(fromInstant, tz));
  let cursorUtc = utcForZonedMidnight(cursorCivil, tz);

  const windows: ChunkWindow[] = [];
  while (cursorUtc.getTime() < toInstant.getTime()) {
    const nextCivil = nextUnitCivil(unit, cursorCivil);
    const nextUtc = utcForZonedMidnight(nextCivil, tz);

    const window = clipWindow(cursorUtc, nextUtc, fromInstant, toInstant);
    if (window !== null) windows.push(window);

    cursorCivil = nextCivil;
    cursorUtc = nextUtc;
  }

  return windows;
}

/** The calendar-year window in `tz` containing `instant` — the year a `year`-bucket regroup keys its months by. */
export function zonedYearWindow(instant: string, tz: string): ChunkWindow {
  const civil = civilOf(new Date(instant), tz);
  const start = utcForZonedMidnight({ year: civil.year, month: 1, day: 1 }, tz);
  const end = utcForZonedMidnight(
    { year: civil.year + 1, month: 1, day: 1 },
    tz,
  );
  return { from: start.toISOString(), to: end.toISOString() };
}

function unionKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): string[] {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
}

/** Sums two same-shaped numeric records key by key, key sets unioned and a missing key read as `0`. */
function mergeCounts<T extends Record<string, number>>(a: T, b: T): T {
  const result: Record<string, number> = {};
  for (const key of unionKeys(a, b)) {
    result[key] = (a[key] ?? 0) + (b[key] ?? 0);
  }
  return result as T;
}

/** Sums two records of same-shaped numeric leaves, one level deep (`checkout-rate`, `double-performance`, `bust-rate`, `ladder-progress.targets`). */
function mergeCountRecord<V extends Record<string, number>>(
  a: Record<string, V>,
  b: Record<string, V>,
): Record<string, V> {
  const result: Record<string, V> = {};
  for (const key of unionKeys(a, b)) {
    result[key] = mergeCounts(a[key] ?? ({} as V), b[key] ?? ({} as V));
  }
  return result;
}

/** `checkout-path`'s two levels of keying: outer `startingRemaining`, inner route label. */
function mergeCheckoutPath(
  a: ServerSectionMetrics["checkout-path"],
  b: ServerSectionMetrics["checkout-path"],
): ServerSectionMetrics["checkout-path"] {
  const result: ServerSectionMetrics["checkout-path"] = {};
  for (const key of unionKeys(a, b)) {
    result[key] = mergeCountRecord(a[key] ?? {}, b[key] ?? {});
  }
  return result;
}

/** `maxTarget` merges by `max`, with `null` as the identity (phase-3 decision 3). */
function mergeMaxTarget(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function mergeLadderProgress(
  a: ServerSectionMetrics["ladder-progress"],
  b: ServerSectionMetrics["ladder-progress"],
): ServerSectionMetrics["ladder-progress"] {
  return {
    targets: mergeCountRecord(a.targets, b.targets),
    maxTarget: mergeMaxTarget(a.maxTarget, b.maxTarget),
    afterMiss: a.afterMiss + b.afterMiss,
    recovered: a.recovered + b.recovered,
  };
}

/**
 * One merger per server section — a `Record` over every `ServerSectionId`,
 * so a new server section that skips a merger is a type error rather than a
 * silent gap (phase-3 Task 9).
 */
const MERGERS: {
  [K in ServerSectionId]: (
    a: ServerSectionMetrics[K],
    b: ServerSectionMetrics[K],
  ) => ServerSectionMetrics[K];
} = {
  "checkout-rate": mergeCountRecord,
  "double-performance": mergeCountRecord,
  "bust-rate": mergeCountRecord,
  "leg-stats": mergeCounts,
  "checkout-path": mergeCheckoutPath,
  "ladder-progress": mergeLadderProgress,
};

/**
 * Merges two chunks of one server section's metrics (phase-3 decision 2/3):
 * numeric leaves sum, `maxTarget` merges by `max` with `null` as identity,
 * and records merge by key. Every server metric is additive, so this is
 * exact regardless of chunk boundaries.
 */
export function mergeMetrics<K extends ServerSectionId>(
  sectionId: K,
  a: ServerSectionMetrics[K],
  b: ServerSectionMetrics[K],
): ServerSectionMetrics[K] {
  return MERGERS[sectionId](a, b);
}
