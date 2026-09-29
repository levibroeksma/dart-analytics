// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sectionsForGame } from "@lib/stats/section-registry";
import { replayPath } from "@lib/stats/replay-route";
import { STEP_METRIC_SPECS } from "@modules/stats/step-metrics.module";
import {
  routineScopeKey,
  stepScopeKey,
} from "@modules/stats/routine-scope.module";
import type { RoutineHeaderSchemaData } from "@client/api/types";

const readSection = vi.fn();
const readSessionPage = vi.fn();
const noteDataVersion = vi.fn();
const fetchTrainedRoutines = vi.fn();
const fetchRoutineHeader = vi.fn();
const fetchRoutineSection = vi.fn();
const fetchRoutineStepSection = vi.fn();
const fetchRoutineStepSessions = vi.fn();
const fetchGameSection = vi.fn();
const fetchGameSessions = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readSection: (...args: unknown[]) => readSection(...args),
  readSessionPage: (...args: unknown[]) => readSessionPage(...args),
  noteDataVersion: (...args: unknown[]) => noteDataVersion(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSection: (...args: unknown[]) => fetchGameSection(...args),
  fetchGameSessions: (...args: unknown[]) => fetchGameSessions(...args),
  fetchTrainedRoutines: (...args: unknown[]) => fetchTrainedRoutines(...args),
  fetchRoutineHeader: (...args: unknown[]) => fetchRoutineHeader(...args),
  fetchRoutineSection: (...args: unknown[]) => fetchRoutineSection(...args),
  fetchRoutineStepSection: (...args: unknown[]) =>
    fetchRoutineStepSection(...args),
  fetchRoutineStepSessions: (...args: unknown[]) =>
    fetchRoutineStepSessions(...args),
}));

const { routineStatsStore } = await import("@stores/routine-stats.store");
const { defaultRange } = await import("@stores/game-stats.store");

const ROUTINE_KEY = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const FP = "0123456789abcdef0123456789abcdef";
const WARM_UP_KEY = `1-${FP}`;
const GAME_KEY = `2-${FP}`;
const DOUBLES_KEY = `3-${FP}`;
const OLD_SWITCHING_KEY = `3-${"f".repeat(32)}`;
const OTHER_ROUTINE_KEY = `name-${"a".repeat(32)}`;
const LOAD_ERROR =
  "Could not load your routine statistics. Check your connection and try again.";

/** A promise the test settles by hand, to land a response after a later selection. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Descriptor = RoutineHeaderSchemaData["steps"][number];

function step(
  overrides: Pick<
    Descriptor,
    "stepKey" | "sequenceNumber" | "exerciseTypeKey"
  > &
    Partial<Descriptor>,
): Descriptor {
  return {
    exerciseRulesetVersionKey: null,
    gameTypeKey: null,
    rulesetVersionKey: null,
    durationSeconds: 300,
    sessionCount: 2,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-02-01T00:00:00.000Z",
    current: true,
    ...overrides,
  };
}

const HEADER = {
  routineKey: ROUTINE_KEY,
  routineName: "Balanced Training",
  runCount: 3,
  firstRunAt: "2026-01-01T00:00:00.000Z",
  lastRunAt: "2026-02-01T00:00:00.000Z",
  dataVersion: "djE6MzoxNzAw",
  steps: [
    step({
      stepKey: WARM_UP_KEY,
      sequenceNumber: 1,
      exerciseTypeKey: "WARM_UP",
    }),
    step({
      stepKey: GAME_KEY,
      sequenceNumber: 2,
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
      rulesetVersionKey: "TUOD_V1",
    }),
    step({
      stepKey: DOUBLES_KEY,
      sequenceNumber: 3,
      exerciseTypeKey: "DOUBLE_PATTERN",
      exerciseRulesetVersionKey: "DOUBLE_PATTERN_V1",
    }),
    step({
      stepKey: OLD_SWITCHING_KEY,
      sequenceNumber: 3,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      current: false,
    }),
  ],
};

const TRAINED = {
  routineKey: ROUTINE_KEY,
  routineTemplateId: ROUTINE_KEY,
  routineName: "Balanced Training",
  runCount: 3,
  completedRunCount: 2,
  lastRunAt: "2026-02-01T00:00:00.000Z",
};

function series(sectionId: string, metrics: unknown[]) {
  return {
    sectionId,
    sectionVersion: 1,
    dataVersion: HEADER.dataVersion,
    bucket: "month",
    tz: "UTC",
    range: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z" },
    buckets: metrics.map((m, index) => ({
      start: `2026-0${index + 1}-01T00:00:00.000Z`,
      end: `2026-0${index + 2}-01T00:00:00.000Z`,
      closed: true,
      sampleSize: 1,
      metrics: m,
    })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchTrainedRoutines.mockResolvedValue({ items: [TRAINED] });
  fetchRoutineHeader.mockResolvedValue(HEADER);
  readSection.mockImplementation((_player, _scope, meta) =>
    Promise.resolve(series(meta.id, [])),
  );
  readSessionPage.mockResolvedValue({
    items: [],
    nextCursor: null,
    dataVersion: HEADER.dataVersion,
  });
  noteDataVersion.mockResolvedValue(undefined);
});

describe("routineStatsStore loading", () => {
  it("starts on game-stats.store's default range and bucket", () => {
    const store = routineStatsStore();
    const expected = defaultRange();

    expect(store.range.bucket).toBe(expected.bucket);
    expect(store.range.tz).toBe(expected.tz);
  });

  it("init fetches nothing: Alpine calls it on every page, and the tab loads lazily", async () => {
    const store = routineStatsStore();

    store.init();
    await Promise.resolve();

    expect(fetchTrainedRoutines).not.toHaveBeenCalled();
    expect(fetchRoutineHeader).not.toHaveBeenCalled();
    expect(readSection).not.toHaveBeenCalled();
    expect(readSessionPage).not.toHaveBeenCalled();
  });

  it("activate with no trained routines leaves the empty state and never asks for a header", async () => {
    fetchTrainedRoutines.mockResolvedValue({ items: [] });
    const store = routineStatsStore();

    await store.activate();

    expect(store.routines).toEqual([]);
    expect(store.routineKey).toBeNull();
    expect(store.header).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(fetchRoutineHeader).not.toHaveBeenCalled();
    expect(readSection).not.toHaveBeenCalled();
  });

  it("activate loads the trained routines and selects the first", async () => {
    const store = routineStatsStore();

    await store.activate();

    expect(store.routines).toEqual([TRAINED]);
    expect(store.routineKey).toBe(ROUTINE_KEY);
    expect(fetchRoutineHeader).toHaveBeenCalledWith(ROUTINE_KEY);
  });

  it("activate loads once: activating the tab again does not reload", async () => {
    const store = routineStatsStore();

    await store.activate();
    await store.activate();

    expect(fetchTrainedRoutines).toHaveBeenCalledTimes(1);
    expect(fetchRoutineHeader).toHaveBeenCalledTimes(1);
  });

  it("activate surfaces a failed routine list as friendly error text, never the raw cause", async () => {
    fetchTrainedRoutines.mockRejectedValue(new Error("offline"));
    const store = routineStatsStore();

    await store.activate();

    expect(store.error).toBe(LOAD_ERROR);
    expect(store.loading).toBe(false);
  });

  it("selectRoutine notes the header's dataVersion, then reads both routine sections under routine:<key>", async () => {
    const store = routineStatsStore();

    await store.selectRoutine(ROUTINE_KEY);

    expect(store.header).toEqual(HEADER);
    expect(noteDataVersion).toHaveBeenCalledWith(
      "me",
      routineScopeKey(ROUTINE_KEY),
      HEADER.dataVersion,
    );
    const routineCalls = readSection.mock.calls.filter(
      (call) => call[1].key === routineScopeKey(ROUTINE_KEY),
    );
    expect(routineCalls.map((call) => call[2].id).sort()).toEqual([
      "routine-completion",
      "routine-volume",
    ]);
    for (const call of routineCalls) {
      expect(call[1]).toEqual({
        key: `routine:${ROUTINE_KEY}`,
        gameTypeKey: null,
        versionKey: `routine:${ROUTINE_KEY}`,
      });
    }
    const firstRead = Math.min(...readSection.mock.invocationCallOrder);
    expect(noteDataVersion.mock.invocationCallOrder[0]).toBeLessThan(firstRead);
    expect(Object.keys(store.routineSections).sort()).toEqual([
      "routine-completion",
      "routine-volume",
    ]);
  });

  it("selectRoutine selects the first current step", async () => {
    const store = routineStatsStore();

    await store.selectRoutine(ROUTINE_KEY);

    expect(store.stepKey).toBe(WARM_UP_KEY);
  });

  it("selectRoutine falls back to the first step when none is current", async () => {
    fetchRoutineHeader.mockResolvedValue({
      ...HEADER,
      steps: HEADER.steps.map((s) => ({ ...s, current: false })),
    });
    const store = routineStatsStore();

    await store.selectRoutine(ROUTINE_KEY);

    expect(store.stepKey).toBe(HEADER.steps[0]?.stepKey);
  });

  it("selectRoutine surfaces a failed header as friendly error text", async () => {
    fetchRoutineHeader.mockRejectedValue(new Error("not found"));
    const store = routineStatsStore();

    await store.selectRoutine(ROUTINE_KEY);

    expect(store.error).toBe(LOAD_ERROR);
    expect(store.header).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("drops a stale routine's late failure instead of writing it into the new routine's view", async () => {
    const stale = deferred<typeof HEADER>();
    fetchRoutineHeader.mockReturnValueOnce(stale.promise);
    const store = routineStatsStore();

    const first = store.selectRoutine(ROUTINE_KEY);
    await store.selectRoutine(OTHER_ROUTINE_KEY);
    stale.reject(new Error("late failure"));
    await first;

    expect(store.routineKey).toBe(OTHER_ROUTINE_KEY);
    expect(store.error).toBeNull();
    expect(store.header).toEqual(HEADER);
  });
});

describe("routineStatsStore selectStep", () => {
  it("on a game step requests sectionsForGame's ids under the step scope", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSection.mockClear();

    await store.selectStep(GAME_KEY);

    const ids = readSection.mock.calls.map((call) => call[2].id).sort();
    expect(ids).toEqual(sectionsForGame("TUOD").slice().sort());
    for (const call of readSection.mock.calls) {
      expect(call[1]).toEqual({
        key: stepScopeKey(ROUTINE_KEY, GAME_KEY),
        gameTypeKey: "TUOD",
        versionKey: routineScopeKey(ROUTINE_KEY),
      });
    }
    expect(store.stepGame.gameTypeKey).toBe("TUOD");
    expect(store.stepGame.sections).toBe(store.stepSections);
  });

  it("reads a game step's checkout-path un-bucketed, as the Games tab does", async () => {
    const oneTwentyOneKey = `4-${FP}`;
    fetchRoutineHeader.mockResolvedValue({
      ...HEADER,
      steps: [
        step({
          stepKey: oneTwentyOneKey,
          sequenceNumber: 4,
          exerciseTypeKey: "GAME",
          gameTypeKey: "ONE_TWENTY_ONE",
          rulesetVersionKey: "121_V2",
        }),
      ],
    });
    const store = routineStatsStore();

    await store.selectRoutine(ROUTINE_KEY);

    const checkoutPath = readSection.mock.calls.find(
      (call) => call[2].id === "checkout-path",
    );
    expect(checkoutPath?.[3]).toMatchObject({ bucket: "none" });
    await checkoutPath?.[4]({ from: "a", to: "b" });
    expect(fetchRoutineStepSection).toHaveBeenCalledWith(
      ROUTINE_KEY,
      oneTwentyOneKey,
      "checkout-path",
      { from: "a", to: "b", bucket: "none" },
    );
    const volume = readSection.mock.calls.find(
      (call) => call[2].id === "volume",
    );
    expect(volume?.[3]).toMatchObject({ bucket: "month" });
  });

  it("on Warm-Up requests step-volume only", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSection.mockClear();

    await store.selectStep(WARM_UP_KEY);

    expect(readSection).toHaveBeenCalledTimes(1);
    expect(readSection.mock.calls[0][2].id).toBe("step-volume");
    expect(readSection.mock.calls[0][1]).toEqual({
      key: stepScopeKey(ROUTINE_KEY, WARM_UP_KEY),
      gameTypeKey: null,
      versionKey: routineScopeKey(ROUTINE_KEY),
    });
  });

  it("on a dart exercise step passes its exerciseKind for step-result", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSection.mockClear();

    await store.selectStep(DOUBLES_KEY);

    const ids = readSection.mock.calls.map((call) => call[2].id).sort();
    expect(ids).toEqual(["step-result", "step-volume"]);
    for (const call of readSection.mock.calls) {
      expect(call[1]).toEqual({
        key: stepScopeKey(ROUTINE_KEY, DOUBLES_KEY),
        gameTypeKey: null,
        exerciseKind: "DOUBLE_PATTERN",
        versionKey: routineScopeKey(ROUTINE_KEY),
      });
    }
  });

  it("loads the first session page under the step scope and the routine's versionKey", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSessionPage.mockClear();
    readSessionPage.mockResolvedValueOnce({
      items: [{ sessionId: "s1" }],
      nextCursor: "c2",
      dataVersion: HEADER.dataVersion,
    });

    await store.selectStep(DOUBLES_KEY);

    expect(readSessionPage).toHaveBeenCalledWith(
      "me",
      stepScopeKey(ROUTINE_KEY, DOUBLES_KEY),
      expect.anything(),
      expect.any(Function),
      routineScopeKey(ROUTINE_KEY),
    );
    expect(store.stepSessions).toEqual([{ sessionId: "s1" }]);
    expect(store.nextCursor).toBe("c2");
  });

  it("loadMoreStepSessions appends the next page and stops at nextCursor: null", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSessionPage.mockResolvedValueOnce({
      items: [{ sessionId: "s1" }],
      nextCursor: "c2",
      dataVersion: HEADER.dataVersion,
    });
    await store.selectStep(DOUBLES_KEY);
    readSessionPage.mockClear();
    readSessionPage.mockResolvedValueOnce({
      items: [{ sessionId: "s2" }],
      nextCursor: null,
      dataVersion: HEADER.dataVersion,
    });

    await store.loadMoreStepSessions();

    expect(readSessionPage.mock.calls[0][2]).toMatchObject({ cursor: "c2" });
    expect(
      store.stepSessions.map((s: { sessionId: string }) => s.sessionId),
    ).toEqual(["s1", "s2"]);
    expect(store.nextCursor).toBeNull();

    await store.loadMoreStepSessions();
    expect(readSessionPage).toHaveBeenCalledTimes(1);
  });
});

describe("routineStatsStore getters", () => {
  it("splits steps by current and hides earlier versions until showEarlierSteps", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);

    expect(store.currentSteps.map((s) => s.stepKey)).toEqual([
      WARM_UP_KEY,
      GAME_KEY,
      DOUBLES_KEY,
    ]);
    expect(store.earlierSteps.map((s) => s.stepKey)).toEqual([
      OLD_SWITCHING_KEY,
    ]);
    expect(store.shownEarlierSteps).toEqual([]);

    store.showEarlierSteps = true;

    expect(store.shownEarlierSteps.map((s) => s.stepKey)).toEqual([
      OLD_SWITCHING_KEY,
    ]);
  });

  it("labels a step from its adapter's headerLabel plus its step number", () => {
    const store = routineStatsStore();

    expect(store.stepLabel(HEADER.steps[1])).toBe("Step 2 · finishing");
    expect(store.stepLabel(HEADER.steps[2])).toBe("Step 3 · doubles");
  });

  it("falls back to the raw exercise type when no step adapter matches", () => {
    const store = routineStatsStore();

    expect(
      store.stepLabel(
        step({
          stepKey: `5-${FP}`,
          sequenceNumber: 5,
          exerciseTypeKey: "FUTURE_DRILL",
        }),
      ),
    ).toBe("Step 5 · FUTURE_DRILL");
  });

  it("details a step with its session count, configured minutes and last run date", () => {
    const store = routineStatsStore();
    const lastRun = new Date("2026-02-01T00:00:00.000Z").toLocaleDateString();

    expect(store.stepDetail(HEADER.steps[3])).toBe(
      `2 sessions · 5 min · last run ${lastRun}`,
    );
  });

  it("tells two versions of one step number apart by their last run date", () => {
    const store = routineStatsStore();
    const older = step({
      stepKey: OLD_SWITCHING_KEY,
      sequenceNumber: 3,
      exerciseTypeKey: "SWITCHING",
      lastSeenAt: "2026-01-10T12:00:00.000Z",
      current: false,
    });
    const newer = { ...older, lastSeenAt: "2026-01-20T12:00:00.000Z" };

    expect(store.stepLabel(older)).toBe(store.stepLabel(newer));
    expect(store.stepDetail(older)).not.toBe(store.stepDetail(newer));
  });

  it("omits the configured minutes when the step's snapshot sets no duration", () => {
    const store = routineStatsStore();
    const lastRun = new Date("2026-02-01T00:00:00.000Z").toLocaleDateString();

    expect(
      store.stepDetail({ ...HEADER.steps[1], durationSeconds: null }),
    ).toBe(`2 sessions · last run ${lastRun}`);
  });

  it("has a display label for every STEP_METRIC_SPECS metric key", () => {
    const store = routineStatsStore();
    const keys = Object.values(STEP_METRIC_SPECS).flatMap((spec) =>
      Object.keys(spec.metrics),
    );

    for (const key of keys) {
      expect(store.metricLabel(key)).not.toBe(key);
    }
  });

  it("gives a zero-denominator rate as null and a real one as a share", async () => {
    readSection.mockImplementation((_player, _scope, meta) => {
      if (meta.id === "step-result") {
        return Promise.resolve(
          series("step-result", [
            {
              metrics: { hits: 0, darts: 0 },
              headlineMin: null,
              headlineMax: null,
              sessions: 0,
              skippedSessions: 0,
            },
          ]),
        );
      }
      return Promise.resolve(series(meta.id, []));
    });
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    await store.selectStep(DOUBLES_KEY);

    expect(store.stepRates).toEqual([
      { numerator: "hits", denominator: "darts", rate: null },
    ]);
  });

  it("merges step-result buckets, rates them, and takes the PB from the spec's direction", async () => {
    readSection.mockImplementation((_player, _scope, meta) => {
      if (meta.id === "step-result") {
        return Promise.resolve(
          series("step-result", [
            {
              metrics: { hits: 3, darts: 10 },
              headlineMin: 1,
              headlineMax: 2,
              sessions: 2,
              skippedSessions: 0,
            },
            {
              metrics: { hits: 7, darts: 10 },
              headlineMin: 3,
              headlineMax: 4,
              sessions: 2,
              skippedSessions: 1,
            },
          ]),
        );
      }
      return Promise.resolve(series(meta.id, []));
    });
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    await store.selectStep(DOUBLES_KEY);

    expect(store.stepResultTotals).toEqual({
      metrics: { hits: 10, darts: 20 },
      headlineMin: 1,
      headlineMax: 4,
      sessions: 4,
      skippedSessions: 1,
    });
    expect(store.stepRates).toEqual([
      { numerator: "hits", denominator: "darts", rate: 0.5 },
    ]);
    expect(store.stepHeadline).toEqual({
      key: "hits",
      total: 10,
      personalBest: 4,
    });
  });

  it("converts routine and step volume seconds to whole minutes", async () => {
    readSection.mockImplementation((_player, _scope, meta) => {
      if (meta.id === "routine-volume") {
        return Promise.resolve(
          series("routine-volume", [
            {
              runs: 2,
              durationSeconds: 3000,
              minDurationSeconds: 1200,
              maxDurationSeconds: 1800,
              darts: 300,
            },
            {
              runs: 1,
              durationSeconds: 2400,
              minDurationSeconds: 2400,
              maxDurationSeconds: 2400,
              darts: 150,
            },
          ]),
        );
      }
      if (meta.id === "step-volume") {
        return Promise.resolve(
          series("step-volume", [
            { sessions: 3, durationSeconds: 900, darts: 0 },
          ]),
        );
      }
      return Promise.resolve(series(meta.id, []));
    });
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);

    expect(store.routineVolumeTotals).toEqual({
      runs: 3,
      minutes: 90,
      shortestMinutes: 20,
      longestMinutes: 40,
      darts: 450,
    });
    expect(store.stepVolumeTotals).toEqual({
      sessions: 3,
      minutes: 15,
      darts: 0,
    });
  });

  it("sums routine completion and orders the abandon points by steps completed", async () => {
    readSection.mockImplementation((_player, _scope, meta) => {
      if (meta.id === "routine-completion") {
        return Promise.resolve(
          series("routine-completion", [
            {
              completed: 2,
              abandoned: 1,
              neverStarted: 1,
              stepsCompletedAtAbandon: { "2": 1 },
            },
            {
              completed: 1,
              abandoned: 2,
              neverStarted: 0,
              stepsCompletedAtAbandon: { "10": 1, "2": 1 },
            },
          ]),
        );
      }
      return Promise.resolve(series(meta.id, []));
    });
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);

    expect(store.routineCompletionTotals).toEqual({
      completed: 3,
      abandoned: 3,
      neverStarted: 1,
    });
    expect(store.abandonPoints).toEqual([
      { steps: 2, runs: 2 },
      { steps: 10, runs: 1 },
    ]);
  });

  it("links a dart step's session rows through replayPath, and none for Warm-Up", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);

    await store.selectStep(DOUBLES_KEY);
    expect(store.sessionHref("s1")).toBe(replayPath("s1"));

    await store.selectStep(GAME_KEY);
    expect(store.sessionHref("s1")).toBe(replayPath("s1"));

    await store.selectStep(WARM_UP_KEY);
    expect(store.sessionHref("s1")).toBeNull();
  });
});

function page(sessionIds: string[], nextCursor: string | null) {
  return {
    items: sessionIds.map((sessionId) => ({ sessionId })),
    nextCursor,
    dataVersion: HEADER.dataVersion,
  };
}

describe("routineStatsStore stale responses and failures", () => {
  it("drops a step load from routine A that lands after routine B selected the same step key", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    const staleA = deferred<ReturnType<typeof page>>();
    readSessionPage.mockReturnValueOnce(staleA.promise);
    readSessionPage.mockResolvedValueOnce(page(["b1"], null));

    const pendingA = store.selectStep(WARM_UP_KEY);
    await store.selectRoutine(OTHER_ROUTINE_KEY);
    staleA.resolve(page(["a1"], "a-cursor"));
    await pendingA;

    expect(store.routineKey).toBe(OTHER_ROUTINE_KEY);
    expect(store.stepKey).toBe(WARM_UP_KEY);
    expect(store.stepSessions).toEqual([{ sessionId: "b1" }]);
    expect(store.nextCursor).toBeNull();
  });

  it("drops a stale step failure instead of writing it into the new routine's view", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    const staleA = deferred<ReturnType<typeof page>>();
    readSessionPage.mockReturnValueOnce(staleA.promise);

    const pendingA = store.selectStep(WARM_UP_KEY);
    await store.selectRoutine(OTHER_ROUTINE_KEY);
    staleA.reject(new Error("late failure"));
    await pendingA;

    expect(store.error).toBeNull();
  });

  it("drops a loadMoreStepSessions page from routine A that lands after routine B is selected", async () => {
    readSessionPage.mockResolvedValueOnce(page(["a1"], "a-cursor"));
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    const staleMore = deferred<ReturnType<typeof page>>();
    readSessionPage.mockReturnValueOnce(staleMore.promise);
    readSessionPage.mockResolvedValueOnce(page(["b1"], null));

    const pendingMore = store.loadMoreStepSessions();
    await store.selectRoutine(OTHER_ROUTINE_KEY);
    staleMore.resolve(page(["a2"], "a-cursor-2"));
    await pendingMore;

    expect(store.stepSessions).toEqual([{ sessionId: "b1" }]);
    expect(store.nextCursor).toBeNull();
  });

  it("loadMoreStepSessions surfaces a failed page as friendly error text and keeps the loaded rows", async () => {
    readSessionPage.mockResolvedValueOnce(page(["a1"], "a-cursor"));
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSessionPage.mockRejectedValueOnce(new Error("offline"));

    await expect(store.loadMoreStepSessions()).resolves.toBeUndefined();

    expect(store.error).toBe(LOAD_ERROR);
    expect(store.stepSessions).toEqual([{ sessionId: "a1" }]);
    expect(store.nextCursor).toBe("a-cursor");
  });

  it("selectStep surfaces a failed section read as friendly error text", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    readSection.mockRejectedValueOnce(new Error("VALIDATION_FAILED"));

    await store.selectStep(DOUBLES_KEY);

    expect(store.error).toBe(LOAD_ERROR);
    expect(store.loading).toBe(false);
  });
});

describe("routineStatsStore GAME step view", () => {
  it("names the selected GAME step's type on stepGame as soon as it is selected, before its sections land", async () => {
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);
    const pendingSection = deferred<ReturnType<typeof series>>();
    readSection.mockReturnValue(pendingSection.promise);

    const pending = store.selectStep(GAME_KEY);

    expect(store.stepGame.gameTypeKey).toBe("TUOD");
    expect(store.stepGame.sections).toEqual({});
    pendingSection.resolve(series("volume", []));
    await pending;
  });

  it("reads a GAME step only through the routine step route, never the game route", async () => {
    readSection.mockImplementation((_player, _scope, _meta, _query, fetcher) =>
      fetcher({ from: "a", to: "b" }),
    );
    fetchRoutineSection.mockImplementation((_key, id) =>
      Promise.resolve(series(id, [])),
    );
    fetchRoutineStepSection.mockImplementation((_key, _step, id) =>
      Promise.resolve(series(id, [])),
    );
    const store = routineStatsStore();
    await store.selectRoutine(ROUTINE_KEY);

    await store.selectStep(GAME_KEY);

    expect(fetchGameSection).not.toHaveBeenCalled();
    expect(fetchGameSessions).not.toHaveBeenCalled();
    expect(
      fetchRoutineStepSection.mock.calls
        .filter((call) => call[1] === GAME_KEY)
        .map((call) => call[2])
        .sort(),
    ).toEqual(sectionsForGame("TUOD").slice().sort());
  });
});
