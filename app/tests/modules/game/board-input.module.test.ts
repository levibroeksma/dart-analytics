import { describe, expect, it } from "vitest";
import {
  MAGNIFIER_GAP,
  boardInput,
  magnifierPlacement,
  screenToBoard,
} from "@modules/game/board-input.module";
import type { DartObservation } from "@modules/types";

/**
 * A stand-in for an SVG whose viewBox maps 1 board millimetre to 2 screen
 * pixels, with the board centre at screen (400, 400). Returns the forward
 * (board→screen) CTM from getScreenCTM(), whose distinct inverse
 * (screen→board) must be applied to map pointers correctly. If the module
 * drops the .inverse() call, this test fails.
 */
function fakeSvg(): SVGSVGElement {
  const inverse = {
    a: 0.5,
    b: 0,
    c: 0,
    d: 0.5,
    e: -200,
    f: -200,
  };

  const forward = {
    inverse: () => inverse,
    a: 2,
    b: 0,
    c: 0,
    d: 2,
    e: 400,
    f: 400,
  };

  const point = {
    x: 0,
    y: 0,
    matrixTransform: (m: typeof inverse) => ({
      x: point.x * m.a + point.y * m.c + m.e,
      y: point.x * m.b + point.y * m.d + m.f,
    }),
  };

  return {
    createSVGPoint: () => point,
    getScreenCTM: () => forward,
  } as unknown as SVGSVGElement;
}

describe("screenToBoard", () => {
  it("maps the screen centre to the board origin", () => {
    const toBoard = screenToBoard(fakeSvg());
    expect(toBoard({ clientX: 400, clientY: 400 })).toEqual({ x: 0, y: 0 });
  });

  it("maps a point right of centre to positive x", () => {
    const toBoard = screenToBoard(fakeSvg());
    expect(toBoard({ clientX: 600, clientY: 400 })).toEqual({ x: 100, y: 0 });
  });

  it("maps a point above centre to negative y", () => {
    const toBoard = screenToBoard(fakeSvg());
    expect(toBoard({ clientX: 400, clientY: 200 })).toEqual({ x: 0, y: -100 });
  });

  it("returns null when the element has no screen CTM", () => {
    const detached = {
      createSVGPoint: () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 0, y: 0 }),
      }),
      getScreenCTM: () => null,
    } as unknown as SVGSVGElement;

    expect(screenToBoard(detached)({ clientX: 0, clientY: 0 })).toBeNull();
  });
});

describe("magnifierPlacement", () => {
  const viewport = { width: 400, height: 800 };
  const size = 120;

  it("sits left of the pointer for a right-handed player", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 400 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetX).toBeLessThan(0);
  });

  it("sits right of the pointer for a left-handed player", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 400 },
      viewport,
      "LEFT",
      size,
    );
    expect(placement.offsetX).toBeGreaterThan(0);
  });

  it("flips inward when it would overflow the left edge", () => {
    const placement = magnifierPlacement(
      { clientX: 10, clientY: 400 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetX).toBeGreaterThan(0);
  });

  it("flips inward when it would overflow the right edge", () => {
    const placement = magnifierPlacement(
      { clientX: 390, clientY: 400 },
      viewport,
      "LEFT",
      size,
    );
    expect(placement.offsetX).toBeLessThan(0);
  });

  it("sits above the pointer so the finger never covers it", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 400 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetY).toBeLessThan(0);
  });

  it("drops below the pointer near the top edge", () => {
    const placement = magnifierPlacement(
      { clientX: 200, clientY: 10 },
      viewport,
      "RIGHT",
      size,
    );
    expect(placement.offsetY).toBeGreaterThan(0);
  });

  function magnifierBox(
    pointer: { clientX: number; clientY: number },
    placement: { offsetX: number; offsetY: number },
    boxSize: number,
  ) {
    return {
      left: pointer.clientX + placement.offsetX - boxSize / 2,
      right: pointer.clientX + placement.offsetX + boxSize / 2,
      top: pointer.clientY + placement.offsetY - boxSize / 2,
      bottom: pointer.clientY + placement.offsetY + boxSize / 2,
    };
  }

  it("keeps the magnifier box inside the viewport for a centre-of-screen press", () => {
    const pointer = { clientX: 200, clientY: 400 };
    const placement = magnifierPlacement(pointer, viewport, "RIGHT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
  });

  it("keeps the magnifier box inside the viewport near the left edge", () => {
    const pointer = { clientX: 10, clientY: 400 };
    const placement = magnifierPlacement(pointer, viewport, "RIGHT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
  });

  it("keeps the magnifier box inside the viewport near the right edge", () => {
    const pointer = { clientX: 390, clientY: 400 };
    const placement = magnifierPlacement(pointer, viewport, "LEFT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
  });

  it("keeps the magnifier box inside the viewport near the top edge", () => {
    const pointer = { clientX: 200, clientY: 10 };
    const placement = magnifierPlacement(pointer, viewport, "RIGHT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
  });

  it("keeps the magnifier box inside the viewport near the bottom edge", () => {
    const pointer = { clientX: 200, clientY: 790 };
    const placement = magnifierPlacement(pointer, viewport, "RIGHT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
  });

  it("pins the magnifier to the viewport's left edge when the viewport is narrower than the magnifier", () => {
    const pointer = { clientX: 25, clientY: 400 };
    const narrowViewport = { width: 50, height: 800 };
    const placement = magnifierPlacement(
      pointer,
      narrowViewport,
      "RIGHT",
      size,
    );
    const box = magnifierBox(pointer, placement, size);
    expect(box.left).toBe(0);
  });

  it("pins the magnifier to the viewport's top edge when the viewport is shorter than the magnifier", () => {
    const pointer = { clientX: 200, clientY: 25 };
    const shortViewport = { width: 400, height: 50 };
    const placement = magnifierPlacement(pointer, shortViewport, "RIGHT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(box.top).toBe(0);
  });

  it("clears the fingertip by at least MAGNIFIER_GAP on both axes", () => {
    const pointer = { clientX: 200, clientY: 400 };
    const placement = magnifierPlacement(pointer, viewport, "RIGHT", size);
    const box = magnifierBox(pointer, placement, size);
    expect(pointer.clientX - box.right).toBeGreaterThanOrEqual(MAGNIFIER_GAP);
    expect(pointer.clientY - box.bottom).toBeGreaterThanOrEqual(MAGNIFIER_GAP);
  });
});

function controller(onCommit: (observation: DartObservation) => void) {
  return boardInput({
    toBoard: (pointer) => ({ x: pointer.clientX, y: pointer.clientY }),
    onCommit,
    handedness: "RIGHT",
    viewport: { width: 400, height: 800 },
    magnifierSize: 120,
  });
}

describe("boardInput", () => {
  it("activates on press and previews what is under the pointer", () => {
    const input = controller(() => {});
    input.press({ clientX: 0, clientY: -102 });

    expect(input.active).toBe(true);
    expect(input.preview).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
      score: 60,
    });
  });

  it("commits nothing until release", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    expect(commits).toHaveLength(0);

    input.release();
    expect(commits).toHaveLength(1);
  });

  it("commits the position the pointer was dragged to, not where it started", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    input.move({ clientX: 0, clientY: -166 });
    input.release();

    expect(commits[0]).toEqual({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
  });

  it("commits a press that never moved", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    input.release();

    expect(commits[0]!.hitZoneKey).toBe("TREBLE");
  });

  it("goes inactive after release", () => {
    const input = controller(() => {});
    input.press({ clientX: 0, clientY: -102 });
    input.release();

    expect(input.active).toBe(false);
    expect(input.preview).toBeNull();
  });

  it("commits nothing when cancelled", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -102 });
    input.cancel();
    input.release();

    expect(commits).toHaveLength(0);
    expect(input.active).toBe(false);
  });

  it("commits a surround tap as a miss with real coordinates", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.press({ clientX: 0, clientY: -190 });
    input.release();

    expect(commits[0]).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: -190,
    });
  });

  it("commits an unseen dart with no coordinates", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.commitUnseen();

    expect(commits[0]).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
  });

  it("exposes a magnifier placement while active", () => {
    const input = controller(() => {});
    input.press({ clientX: 200, clientY: 400 });

    expect(input.placement).not.toBeNull();
    expect(input.placement!.offsetX).toBeLessThan(0);
  });

  it("ignores a release that follows no press", () => {
    const commits: DartObservation[] = [];
    const input = controller((observation) => commits.push(observation));

    input.release();

    expect(commits).toHaveLength(0);
  });
});
