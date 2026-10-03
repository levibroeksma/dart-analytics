// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { replayPath } from "@lib/stats/replay-route";
import { REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import type { ReplayPageSchemaData } from "@client/api/types";
import {
  PLAYER_ONE,
  PLAYER_TWO,
  playBobs27,
  playFiveOhOne,
  type ScriptedGame,
} from "../lib/stats/replay-games";

const readReplayPage = vi.fn();
const apiRequest = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readReplayPage: (...args: unknown[]) => readReplayPage(...args),
}));
vi.mock("@client/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

// replay.store.ts's replayFacts import points at @modules/stats/replay.module
// now; this suite's own assertions are unchanged, only the import path moved.
const { replayStore } = await import("@stores/replay.store");

type Header = NonNullable<ReplayPageSchemaData["header"]>;

/**
 * `game`'s replay cut into pages at `cuts` (turn indices): the first page
 * carries the header, every page but the last a cursor naming its page.
 */
function pagesOf(
  game: ScriptedGame,
  cuts: readonly number[],
  header: Header = game.header,
): Map<string | undefined, ReplayPageSchemaData> {
  const bounds = [0, ...cuts, game.turns.length];
  const pages = new Map<string | undefined, ReplayPageSchemaData>();
  for (let page = 0; page < bounds.length - 1; page += 1) {
    pages.set(page === 0 ? undefined : `c${page}`, {
      header: page === 0 ? header : null,
      turns: game.turns.slice(bounds[page], bounds[page + 1]),
      nextCursor: page === bounds.length - 2 ? null : `c${page + 1}`,
    });
  }
  return pages;
}

/** Serves `pages` from the mocked cache, keyed by cursor. */
function serve(pages: Map<string | undefined, ReplayPageSchemaData>): void {
  readReplayPage.mockImplementation(
    (_sessionId: string, cursor: string | undefined) => {
      const page = pages.get(cursor);
      return page
        ? Promise.resolve(page)
        : Promise.reject(new Error(`no page ${cursor}`));
    },
  );
}

function cursorsRead(): (string | undefined)[] {
  return readReplayPage.mock.calls.map((call) => call[1]);
}

async function opened(
  game: ScriptedGame,
  cuts: readonly number[] = [],
  header?: Header,
) {
  serve(pagesOf(game, cuts, header));
  history.replaceState(null, "", replayPath(game.header.sessionId));
  const store = replayStore();
  await store.init();
  return store;
}

beforeEach(() => {
  readReplayPage.mockReset();
  apiRequest.mockReset();
});

describe("replayStore", () => {
  it("backs to the Games tab for a session with no routine step", async () => {
    const store = await opened(playFiveOhOne(), []);

    expect(store.backHref).toBe("/statistics");
  });

  it("backs to the routine and step the session ran under", async () => {
    const game = playFiveOhOne();
    const store = await opened(game, [], {
      ...game.header,
      routineKey: "r 1",
      stepKey: "s/2",
    });

    expect(store.backHref).toBe(
      "/statistics?tab=routines&routine=r%201&step=s%2F2",
    );
  });

  it("backs to the Games tab before the header loads", () => {
    expect(replayStore().backHref).toBe("/statistics");
  });

  it("reads the session id and loads the header plus the first page", async () => {
    const game = playFiveOhOne();
    const store = await opened(game, [3, 5]);

    expect(store.sessionId).toBe(game.header.sessionId);
    expect(readReplayPage).toHaveBeenCalledTimes(1);
    expect(readReplayPage.mock.calls[0]![0]).toBe(game.header.sessionId);
    expect(cursorsRead()).toEqual([undefined]);
    expect(store.header).toEqual(game.header);
    expect(store.turns).toEqual(game.turns.slice(0, 3));
    expect(store.nextCursor).toBe("c1");
    expect(store.fold?.ok).toBe(true);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("sets NOT_FOUND without a session id and never fetches", async () => {
    history.replaceState(null, "", "/statistics/replay?session=");
    const store = replayStore();

    await store.init();

    expect(store.error).toBe("NOT_FOUND");
    expect(readReplayPage).not.toHaveBeenCalled();
  });

  it.each(["../../profile#", "not-a-session", "01900000-0000-7000-8000"])(
    "sets NOT_FOUND for a malformed session id %j and never fetches",
    async (sessionId) => {
      history.replaceState(null, "", replayPath(sessionId));
      const store = replayStore();

      await store.init();

      expect(store.error).toBe("NOT_FOUND");
      expect(store.sessionId).toBeNull();
      expect(readReplayPage).not.toHaveBeenCalled();
      expect(apiRequest).not.toHaveBeenCalled();
    },
  );

  it("appends each next page in order, refolds, and stops at nextCursor null", async () => {
    const game = playFiveOhOne();
    const store = await opened(game, [3, 5]);

    await store.loadNext();
    expect(store.turns).toEqual(game.turns.slice(0, 5));
    expect(store.nextCursor).toBe("c2");

    await store.loadNext();
    expect(store.turns).toEqual(game.turns);
    expect(store.nextCursor).toBeNull();
    expect(store.fold?.ok && store.fold.steps).toHaveLength(game.turns.length);

    await store.loadNext();
    expect(cursorsRead()).toEqual([undefined, "c1", "c2"]);
    expect(store.header).toEqual(game.header);
  });

  it("serializes page loads: two quick loadNext calls read each cursor once", async () => {
    const game = playFiveOhOne();
    const store = await opened(game, [3, 5]);

    await Promise.all([store.loadNext(), store.loadNext()]);

    expect(cursorsRead()).toEqual([undefined, "c1", "c2"]);
    expect(store.turns).toEqual(game.turns);
  });

  it("maps the route's 404 to NOT_FOUND", async () => {
    readReplayPage.mockImplementation(
      (_sessionId: string, _cursor: unknown, fetcher: () => Promise<unknown>) =>
        fetcher(),
    );
    apiRequest.mockResolvedValue({
      ok: false,
      requestId: "r",
      error: { code: "NOT_FOUND", message: "Not found", retryable: false },
    });
    history.replaceState(
      null,
      "",
      replayPath(playFiveOhOne().header.sessionId),
    );
    const store = replayStore();

    await store.init();

    expect(apiRequest.mock.calls[0]![0]).toContain(
      `/api/statistics/sessions/${playFiveOhOne().header.sessionId}/replay`,
    );
    expect(store.error).toBe("NOT_FOUND");
    expect(store.header).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("fetches page 2 and later with the previous page's nextCursor, through the real fetcher", async () => {
    const game = playFiveOhOne();
    const pages = pagesOf(game, [3, 5]);
    readReplayPage.mockImplementation(
      (_sessionId: string, _cursor: unknown, fetcher: () => Promise<unknown>) =>
        fetcher(),
    );
    apiRequest.mockImplementation((path: string) => {
      const cursor =
        new URL(path, "http://localhost").searchParams.get("cursor") ??
        undefined;
      const page = pages.get(cursor);
      return Promise.resolve(
        page
          ? { ok: true, requestId: "r", data: page }
          : {
              ok: false,
              requestId: "r",
              error: {
                code: "NOT_FOUND",
                message: "Not found",
                retryable: false,
              },
            },
      );
    });
    history.replaceState(null, "", replayPath(game.header.sessionId));
    const store = replayStore();

    await store.init();
    await store.loadNext();
    await store.loadNext();

    expect(
      apiRequest.mock.calls.map(([path]) =>
        new URL(path as string, "http://localhost").searchParams.get("cursor"),
      ),
    ).toEqual([null, "c1", "c2"]);
    expect(store.turns).toEqual(game.turns);
    expect(store.error).toBeNull();
  });

  it("sets FAILED on any other failure", async () => {
    readReplayPage.mockRejectedValue(new Error("offline"));
    history.replaceState(
      null,
      "",
      replayPath(playFiveOhOne().header.sessionId),
    );
    const store = replayStore();

    await store.init();

    expect(store.error).toBe("FAILED");
  });

  it("loads the first page on a retry after it failed", async () => {
    const game = playFiveOhOne();
    serve(pagesOf(game, [3]));
    readReplayPage.mockRejectedValueOnce(new Error("offline"));
    history.replaceState(null, "", replayPath(game.header.sessionId));
    const store = replayStore();

    await store.init();
    expect(store.error).toBe("FAILED");
    expect(store.header).toBeNull();

    await store.loadNext();

    expect(cursorsRead()).toEqual([undefined, undefined]);
    expect(store.error).toBeNull();
    expect(store.header).toEqual(game.header);
    expect(store.turns).toEqual(game.turns.slice(0, 3));
    expect(store.nextCursor).toBe("c1");
  });

  it("shows stored darts plus presenter cells for a folded turn", async () => {
    const store = await opened(playFiveOhOne());

    const view = store.turnView(0);

    expect(view.seat).toBe(PLAYER_ONE.displayName);
    expect(view.darts.map((dart) => dart.label)).toEqual(["T20", "1", "20"]);
    expect(view.total).toBe(81);
    expect(view.cells).toEqual([
      { kind: "value", label: "Remaining", value: "20" },
    ]);
    expect(store.turnView(1).seat).toBe(PLAYER_TWO.displayName);
    expect(store.derivedAvailable).toBe(true);
  });

  it("with a skipped fold, shows the stored darts and no cells", async () => {
    const game = playFiveOhOne();
    const store = await opened(game, [], {
      ...game.header,
      configuration: null,
    });

    expect(store.fold).toEqual({ ok: false, reason: "NO_SNAPSHOT" });
    expect(store.derivedAvailable).toBe(false);
    const view = store.turnView(0);
    expect(view.darts.map((dart) => dart.label)).toEqual(["T20", "1", "20"]);
    expect(view.total).toBe(81);
    expect(view.cells).toEqual([]);
    expect(store.sessionLine).toBeNull();
  });

  it("skips the cells of a turn whose presenter throws, and keeps every row", async () => {
    const game = playFiveOhOne();
    const store = await opened(game);
    const presenter = REPLAY_PRESENTERS["501"];
    const turn = presenter.turn.bind(presenter);
    const bad = store.fold?.ok ? store.fold.steps[1] : undefined;
    const spy = vi
      .spyOn(presenter, "turn")
      .mockImplementation((step, snapshot) => {
        if (step === bad) throw new Error("presenter bug");
        return turn(step, snapshot);
      });

    try {
      expect(bad).toBeDefined();
      expect(store.cellsOf(1)).toEqual([]);
      const rows = store.stageGroups.flatMap((group) => group.rows);
      expect(rows).toHaveLength(game.turns.length);
      expect(rows[1]!.cells).toEqual([]);
      expect(rows[1]!.total).toBe(game.turns[1]!.turnTotalScore);
      expect(rows[0]!.cells).toEqual([
        { kind: "value", label: "Remaining", value: "20" },
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it("treats an unknown game like a skipped fold", async () => {
    const game = playFiveOhOne();
    const store = await opened(game, [], {
      ...game.header,
      gameTypeKey: "DARTS_GOLF",
    });

    expect(store.derivedAvailable).toBe(false);
    expect(store.turnView(0).cells).toEqual([]);
    expect(store.sessionLine).toBeNull();
  });

  it("groups the loaded turns under their stage headings in play order", async () => {
    const store = await opened(playFiveOhOne(), [3]);

    expect(
      store.stageGroups.map((group) => ({
        heading: group.heading,
        turns: group.rows.map((row) => row.index),
      })),
    ).toEqual([{ heading: "Leg 1", turns: [0, 1, 2] }]);

    await store.loadNext();

    expect(
      store.stageGroups.map((group) => ({
        heading: group.heading,
        turns: group.rows.map((row) => row.index),
      })),
    ).toEqual([
      { heading: "Leg 1", turns: [0, 1, 2, 3, 4] },
      { heading: "Leg 2", turns: [5, 6] },
    ]);
  });

  it("hides the heading of a session's lone exercise block", async () => {
    const game = playBobs27();
    const store = await opened(game);

    expect(game.header.stages.map((stage) => stage.stageTypeKey)).toEqual([
      "EXERCISE_BLOCK",
    ]);
    expect(
      store.stageGroups.map((group) => ({
        heading: group.heading,
        turns: group.rows.map((row) => row.index),
      })),
    ).toEqual([{ heading: null, turns: [0, 1, 2] }]);
  });

  it("shows the session line only once every page is loaded", async () => {
    const store = await opened(playFiveOhOne(), [3]);

    expect(store.sessionLine).toBeNull();

    await store.loadNext();

    expect(store.sessionLine?.entries).toEqual([
      { participantId: PLAYER_ONE.participantId, label: "Leg 1", value: "Won" },
      { participantId: PLAYER_ONE.participantId, label: "Leg 2", value: "Won" },
    ]);
  });

  it("draws Bob's 27's score curve per seat once complete", async () => {
    const store = await opened(playBobs27(), [2]);

    expect(store.curveRows).toEqual([]);

    await store.loadNext();

    expect(store.curveRows).toEqual([
      {
        participantId: PLAYER_ONE.participantId,
        seat: PLAYER_ONE.displayName,
        points: [
          { visit: 1, score: 29, widthPercent: (29 / 37) * 100 },
          { visit: 2, score: 25, widthPercent: (25 / 37) * 100 },
          { visit: 3, score: 37, widthPercent: 100 },
        ],
      },
    ]);
  });

  it("marks the selected turn's located darts on the board, none for a turn-total-only turn", async () => {
    const game = playFiveOhOne();
    const quick = {
      ...game.turns[1]!,
      darts: [],
    };
    const store = await opened({
      ...game,
      turns: [game.turns[0]!, quick, ...game.turns.slice(2)],
    });

    expect(store.selectedMarkers).toEqual([]);

    store.select(0);
    expect(store.selectedMarkers.map((marker) => marker.sequence)).toEqual([
      1, 2, 3,
    ]);
    const first = store.selectedMarkers[0]!;
    const dart = game.turns[0]!.darts[0]!;
    expect(first.leftPercent).toBeCloseTo(
      ((dart.locationX! + 220) / 440) * 100,
    );
    expect(first.topPercent).toBeCloseTo(((dart.locationY! + 220) / 440) * 100);

    store.select(1);
    expect(store.selectedMarkers).toEqual([]);
  });
});
