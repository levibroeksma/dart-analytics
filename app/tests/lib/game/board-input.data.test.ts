import { describe, expect, it, vi } from "vitest";
import { boardInputData } from "@lib/game/board-input.data";
import type { DartObservation } from "@modules/types";

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
};

function harness(onCommit: (observation: DartObservation) => void): Harness {
  return Object.assign(boardInputData(onCommit), {
    $refs: { board: fakeBoard() },
  });
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
});
