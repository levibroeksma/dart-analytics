import { describe, expect, it } from "vitest";
import { screenToBoard } from "@modules/game/board-input.module";

/**
 * A stand-in for an SVG whose viewBox maps 1 board millimetre to 2 screen
 * pixels, with the board centre at screen (400, 400).
 */
function fakeSvg(): SVGSVGElement {
  const matrix = {
    inverse: () => matrix,
    a: 0.5,
    b: 0,
    c: 0,
    d: 0.5,
    e: -200,
    f: -200,
  };

  const point = {
    x: 0,
    y: 0,
    matrixTransform: (m: typeof matrix) => ({
      x: point.x * m.a + point.y * m.c + m.e,
      y: point.x * m.b + point.y * m.d + m.f,
    }),
  };

  return {
    createSVGPoint: () => point,
    getScreenCTM: () => matrix,
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
