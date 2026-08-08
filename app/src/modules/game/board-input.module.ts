import type { BoardPointer, BoardCoordinate, ScreenToBoard } from "./types";

/**
 * Builds a converter from viewport pixels to board millimetres for one SVG
 * element. The SVG's viewBox is authored in millimetres, so its inverse screen
 * CTM is the whole transform — no scale factor is tracked by hand, and the
 * conversion stays correct when the board is resized, scrolled or zoomed.
 *
 * Returns null for a pointer when the element is detached and has no screen
 * CTM, which happens if a page teardown races a pointer event.
 */
export function screenToBoard(svg: SVGSVGElement): ScreenToBoard {
  return (pointer) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const point = svg.createSVGPoint();
    point.x = pointer.clientX;
    point.y = pointer.clientY;

    const board = point.matrixTransform(matrix.inverse());
    return { x: board.x, y: board.y };
  };
}
