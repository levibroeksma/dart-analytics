import { describe, expect, it, vi } from "vitest";
import {
  boardInputData,
  magnifierAnchorStyle,
  magnifierBoardStyle,
  magnifierLabelStyle,
  magnifierRead,
  markersForTurns,
} from "@lib/game/board-input.data";
import type { BoardView } from "@lib/types";
import type { DartFact, DartObservation, TurnFact } from "@modules/types";

function fakeBoard(): SVGSVGElement {
  const matrix = {
    inverse: () => matrix,
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  };
  const point = {
    x: 0,
    y: 0,
    matrixTransform: () => ({ x: point.x, y: point.y }),
  };

  return {
    createSVGPoint: () => point,
    getScreenCTM: () => matrix,
  } as unknown as SVGSVGElement;
}

type Harness = ReturnType<typeof boardInputData> & {
  $refs: { board: SVGSVGElement };
  $store: {
    game: { turns: TurnFact[] };
    boardInput: { handedness: "LEFT" | "RIGHT" };
  };
};

function harness(
  onCommit: (observation: DartObservation) => void,
  turns: TurnFact[] = [],
  handedness: "LEFT" | "RIGHT" = "RIGHT",
): Harness {
  return Object.assign(boardInputData(onCommit), {
    $refs: { board: fakeBoard() },
    $store: { game: { turns }, boardInput: { handedness } },
  });
}

function dart(overrides: Partial<DartFact> = {}): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
    locationX: 0,
    locationY: -102,
    ...overrides,
  };
}

function turn(overrides: Partial<TurnFact> = {}): TurnFact {
  return {
    clientKey: "t1",
    stageClientKey: "block-1",
    sequence: 1,
    completedAt: null,
    totalScore: 60,
    darts: [dart()],
    ...overrides,
  };
}

describe("boardInputData", () => {
  it("commits an observation on pointer up", () => {
    const commits: DartObservation[] = [];
    const data = harness((observation) => commits.push(observation));

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    data.onPointerUp();

    expect(commits).toHaveLength(1);
    expect(commits[0]!.hitZoneKey).toBe("TREBLE");
  });

  it("tracks the pointer position for the magnifier", () => {
    const data = harness(() => {});

    data.onPointerDown({
      clientX: 12,
      clientY: -34,
      preventDefault: vi.fn(),
    } as never);

    expect(data.pointerX).toBe(12);
    expect(data.pointerY).toBe(-34);
  });

  it("tracks the pointer position on move even before any press", () => {
    const data = harness(() => {});

    data.onPointerMove({ clientX: 5, clientY: 9 } as never);

    expect(data.pointerX).toBe(5);
    expect(data.pointerY).toBe(9);
  });

  it("commits the position dragged to, not the press position", () => {
    const commits: DartObservation[] = [];
    const data = harness((observation) => commits.push(observation));

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    data.onPointerMove({ clientX: 0, clientY: -166 } as never);
    data.onPointerUp();

    expect(commits[0]).toEqual({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
  });

  it("commits nothing on pointer cancel", () => {
    const commits: DartObservation[] = [];
    const data = harness((observation) => commits.push(observation));

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    data.onPointerCancel();
    data.onPointerUp();

    expect(commits).toHaveLength(0);
  });

  it("does nothing when pointer move/up/cancel arrive with no press", () => {
    const commits: DartObservation[] = [];
    const data = harness((observation) => commits.push(observation));

    expect(() => data.onPointerUp()).not.toThrow();
    expect(() => data.onPointerCancel()).not.toThrow();
    expect(commits).toHaveLength(0);
  });

  it("records an unseen dart with no coordinates", () => {
    const commits: DartObservation[] = [];
    const data = harness((observation) => commits.push(observation));

    data.recordUnseen();

    expect(commits[0]).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
  });

  it("prevents the default pointerdown action so the browser never starts its own drag/scroll", () => {
    const data = harness(() => {});
    const preventDefault = vi.fn();

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault,
    } as never);

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  /**
   * The controller keeps its state in closure variables published through
   * getters, which Alpine's reactivity cannot observe. Binding the view at the
   * controller therefore renders the press position and never updates again:
   * the magnifier appears, then sits frozen for the whole drag. `board` is a
   * plain snapshot re-copied after every controller call, which is what makes
   * the readings change in a way Alpine can see.
   *
   * Reading `board.point` twice and comparing is the part that matters: if
   * `syncBoard` ever hands out the controller itself (or anything else live),
   * both reads return the same object and the two assertions cannot both hold.
   */
  it("refreshes the view snapshot on move, so the magnifier does not freeze at the press position", () => {
    const data = harness(() => {});

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    const atPress = data.board.point;
    const previewAtPress = data.board.preview;

    data.onPointerMove({ clientX: 0, clientY: -166 } as never);
    const atMove = data.board.point;

    expect(atPress).toEqual({ x: 0, y: -102 });
    expect(atMove).toEqual({ x: 0, y: -166 });
    expect(previewAtPress?.zoneKey).toBe("TREBLE");
    expect(data.board.preview?.zoneKey).toBe("DOUBLE");
    expect(data.board).not.toBe(data.input);
  });

  it("marks the view active on press and idle again on release", () => {
    const data = harness(() => {});

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    expect(data.board.active).toBe(true);

    data.onPointerUp();
    expect(data.board.active).toBe(false);
    expect(data.board.point).toBeNull();
  });

  it("publishes the magnifier size and scale the controller clamps against", () => {
    const data = harness(() => {});

    data.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);

    expect(data.board.magnifierSize).toBe(data.input!.magnifierSize);
    expect(data.board.pxPerMm).toBe(data.input!.pxPerMm);
  });

  it("re-reads the viewport on every press instead of caching it from the first one", () => {
    const data = harness(() => {});
    const originalWidth = globalThis.innerWidth;
    const originalHeight = globalThis.innerHeight;

    try {
      Object.defineProperty(globalThis, "innerWidth", {
        configurable: true,
        value: 400,
      });
      Object.defineProperty(globalThis, "innerHeight", {
        configurable: true,
        value: 100,
      });

      data.onPointerDown({
        clientX: 200,
        clientY: 50,
        preventDefault: vi.fn(),
      } as never);
      const shortPlacement = data.input!.placement;
      data.onPointerUp();

      expect(shortPlacement).toEqual({ offsetX: -76, offsetY: 10 });

      Object.defineProperty(globalThis, "innerHeight", {
        configurable: true,
        value: 1000,
      });

      data.onPointerDown({
        clientX: 200,
        clientY: 50,
        preventDefault: vi.fn(),
      } as never);
      const tallPlacement = data.input!.placement;
      data.onPointerUp();

      expect(tallPlacement).toEqual({ offsetX: -76, offsetY: 76 });
      expect(shortPlacement).not.toEqual(tallPlacement);
    } finally {
      Object.defineProperty(globalThis, "innerWidth", {
        configurable: true,
        value: originalWidth,
      });
      Object.defineProperty(globalThis, "innerHeight", {
        configurable: true,
        value: originalHeight,
      });
    }
  });

  it("reads handedness from the boardInput store to choose which side the magnifier opens on", () => {
    const originalWidth = globalThis.innerWidth;
    const originalHeight = globalThis.innerHeight;

    try {
      Object.defineProperty(globalThis, "innerWidth", {
        configurable: true,
        value: 400,
      });
      Object.defineProperty(globalThis, "innerHeight", {
        configurable: true,
        value: 1000,
      });

      const right = harness(() => {}, [], "RIGHT");
      right.onPointerDown({
        clientX: 200,
        clientY: 500,
        preventDefault: vi.fn(),
      } as never);
      expect(right.input!.placement).toEqual({ offsetX: -76, offsetY: -76 });

      const left = harness(() => {}, [], "LEFT");
      left.onPointerDown({
        clientX: 200,
        clientY: 500,
        preventDefault: vi.fn(),
      } as never);
      expect(left.input!.placement).toEqual({ offsetX: 76, offsetY: -76 });
    } finally {
      Object.defineProperty(globalThis, "innerWidth", {
        configurable: true,
        value: originalWidth,
      });
      Object.defineProperty(globalThis, "innerHeight", {
        configurable: true,
        value: originalHeight,
      });
    }
  });

  it("exposes the current visit's markers from the store", () => {
    const data = harness(() => {}, [turn()]);

    expect(data.visitMarkers()).toEqual([
      { sequence: 1, leftPercent: 50, topPercent: (118 / 440) * 100 },
    ]);
  });
});

describe("magnifier styles", () => {
  const idle: BoardView = {
    active: false,
    point: null,
    preview: null,
    placement: null,
    magnifierSize: 0,
    pxPerMm: 1,
  };

  it("anchors the magnifier at the pointer plus the clamped placement offset", () => {
    expect(
      magnifierAnchorStyle(
        { ...idle, placement: { offsetX: -76, offsetY: -76 } },
        200,
        300,
      ),
    ).toBe("left: 124px; top: 224px");
  });

  /**
   * `board` is idle for the whole time between page load and the first press,
   * so every helper must render something valid then — an expression that
   * dereferenced `placement` or `point` unguarded would throw inside Alpine's
   * evaluator and leave the binding unset.
   */
  it("anchors at the bare pointer while no press has placed it yet", () => {
    expect(magnifierAnchorStyle(idle, 10, 20)).toBe("left: 10px; top: 20px");
  });

  it("slides the pressed point under the crosshair at the board's live scale", () => {
    expect(
      magnifierBoardStyle({ ...idle, point: { x: 12, y: -34 }, pxPerMm: 1.4 }),
    ).toBe(
      "transform: scale(calc(var(--mag-zoom) * 1.4)) translate(-12px, 34px)",
    );
  });

  it("keeps the zoom factor a CSS custom property rather than an Alpine value", () => {
    expect(magnifierBoardStyle(idle)).toContain("var(--mag-zoom)");
  });

  it("centres the untranslated board while idle", () => {
    expect(magnifierBoardStyle(idle)).toContain("translate(0px, 0px)");
  });

  /**
   * The circle is centred on the anchor origin, so its top edge sits at
   * `-magnifierSize / 2`; the label prints `gap` px above that. The view
   * pairs this with a `-translate-y-full` class so the computed `top` lands
   * under the label's own bottom edge, not its top.
   */
  it("prints above the circle's top edge, gap-adjusted", () => {
    expect(magnifierLabelStyle({ ...idle, magnifierSize: 120 })).toBe(
      "top: -68px",
    );
  });

  it("stays snug to the anchor origin before a press sets a real size", () => {
    expect(magnifierLabelStyle(idle)).toBe("top: -8px");
  });

  it("prints the resolved zone, target and score", () => {
    expect(
      magnifierRead({
        ...idle,
        preview: { zoneKey: "TREBLE", targetNumber: 20, score: 60 },
      }),
    ).toBe("TREBLE 20 · 60");
  });

  it("prints no target for a zone that has none", () => {
    expect(
      magnifierRead({
        ...idle,
        preview: { zoneKey: "MISS", targetNumber: null, score: 0 },
      }),
    ).toBe("MISS  · 0");
  });

  it("prints nothing before the first press", () => {
    expect(magnifierRead(idle)).toBe("");
  });
});

describe("markersForTurns", () => {
  it("has nothing to draw before the first dart", () => {
    expect(markersForTurns([])).toEqual([]);
  });

  it("places a dart's marker as a percentage of the board's own box", () => {
    const markers = markersForTurns([
      turn({ darts: [dart({ locationX: 220, locationY: -220 })] }),
    ]);

    expect(markers).toEqual([{ sequence: 1, leftPercent: 100, topPercent: 0 }]);
  });

  it("puts a dart in the bullseye at the centre", () => {
    const markers = markersForTurns([
      turn({ darts: [dart({ locationX: 0, locationY: 0 })] }),
    ]);

    expect(markers).toEqual([{ sequence: 1, leftPercent: 50, topPercent: 50 }]);
  });

  it("draws every dart of the visit so far", () => {
    const markers = markersForTurns([
      turn({
        darts: [
          dart({ sequence: 1 }),
          dart({ sequence: 2, locationX: 0, locationY: -166 }),
        ],
      }),
    ]);

    expect(markers.map((marker) => marker.sequence)).toEqual([1, 2]);
  });

  /**
   * A visit closes the instant its third dart lands, so markers keyed on an
   * OPEN visit would vanish at exactly the moment the player wants to look at
   * the grouping. Reading the last turn keeps them until the next visit's
   * first dart replaces them.
   */
  it("keeps a completed visit's markers until the next visit opens", () => {
    const completed = turn({
      completedAt: "2026-08-09T12:00:00.000Z",
      darts: [dart({ sequence: 1 }), dart({ sequence: 2 })],
    });

    expect(markersForTurns([completed])).toHaveLength(2);
  });

  it("replaces them with the next visit's darts once it opens", () => {
    const completed = turn({
      clientKey: "t1",
      completedAt: "2026-08-09T12:00:00.000Z",
      darts: [dart({ sequence: 1 }), dart({ sequence: 2 })],
    });
    const opened = turn({
      clientKey: "t2",
      sequence: 2,
      darts: [dart({ sequence: 1, locationX: 0, locationY: -166 })],
    });

    expect(markersForTurns([completed, opened])).toEqual([
      { sequence: 1, leftPercent: 50, topPercent: (54 / 440) * 100 },
    ]);
  });

  it("skips an unseen dart, which has no position to draw", () => {
    const markers = markersForTurns([
      turn({
        darts: [
          dart({ sequence: 1 }),
          dart({
            sequence: 2,
            hitTargetNumber: null,
            hitZoneKey: "MISS",
            score: 0,
            locationX: null,
            locationY: null,
          }),
        ],
      }),
    ]);

    expect(markers.map((marker) => marker.sequence)).toEqual([1]);
  });

  it("draws nothing for a keypad visit, which has no darts at all", () => {
    expect(markersForTurns([turn({ darts: [] })])).toEqual([]);
  });
});
