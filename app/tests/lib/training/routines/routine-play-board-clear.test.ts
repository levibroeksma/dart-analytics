// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/training-sessions", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
  abandonTraining: vi.fn(),
  resumeTraining: vi.fn(),
}));
vi.mock("@client/api/sessions", () => ({
  completeSession: vi.fn(),
  appendBatch: vi.fn(),
}));

import { routinePlay } from "@lib/training/routines/routine-play.data";
import type { RoutinePlayContext } from "@lib/types";

const dart = (sequence: number) => ({
  sequence,
  locationX: 0,
  locationY: 0,
});

interface TestTurn {
  clientKey: string;
  completedAt: string | null;
  darts: ReturnType<typeof dart>[];
}

function makeStore(turns: TestTurn[]) {
  const store = {
    ...routinePlay(),
    $store: { game: { timerPaused: false } },
  } as unknown as RoutinePlayContext;
  const engine = {
    record: vi.fn(),
    undo: vi.fn(() => true),
    isComplete: () => false,
    facts: () => ({ turns }),
  };
  store.halveItEngine =
    engine as unknown as RoutinePlayContext["halveItEngine"];
  return { store, engine };
}

describe("routinePlay — board clear after a visit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps a closed visit's darts on the board, then clears them after the delay", () => {
    const turns = [
      { clientKey: "t1", completedAt: "x", darts: [dart(1), dart(2), dart(3)] },
    ];
    const { store } = makeStore(turns);

    store.recordHalveItDart({} as never);
    expect(store.visitMarkers()).toHaveLength(3);

    vi.advanceTimersByTime(1500);
    expect(store.visitMarkers()).toEqual([]);
  });

  it("does not clear an open visit", () => {
    const turns = [{ clientKey: "t1", completedAt: null, darts: [dart(1)] }];
    const { store } = makeStore(turns);

    store.recordHalveItDart({} as never);
    vi.advanceTimersByTime(5000);

    expect(store.visitMarkers()).toHaveLength(1);
  });

  it("shows the next visit's darts after a clear", () => {
    const turns: TestTurn[] = [
      { clientKey: "t1", completedAt: "x", darts: [dart(1), dart(2), dart(3)] },
    ];
    const { store } = makeStore(turns);
    store.recordHalveItDart({} as never);
    vi.advanceTimersByTime(1500);

    turns.push({ clientKey: "t2", completedAt: null, darts: [dart(1)] });

    expect(store.visitMarkers()).toHaveLength(1);
  });

  it("undo cancels the pending clear and restores the markers", () => {
    const turns = [
      { clientKey: "t1", completedAt: "x", darts: [dart(1), dart(2), dart(3)] },
    ];
    const { store } = makeStore(turns);
    store.recordHalveItDart({} as never);
    vi.advanceTimersByTime(1500);

    store.undoVisit();

    expect(store.visitMarkers()).toHaveLength(3);
  });
});
