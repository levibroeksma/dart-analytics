import type {
  BoardPointer,
  ScreenToBoard,
  Handedness,
  MagnifierPlacement,
} from "./types";

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

const MAGNIFIER_GAP = 16;

/**
 * Places the magnifier away from the throwing hand and clear of the viewport
 * edges. It sits above the pointer by default, because a fingertip covers what
 * is directly beneath it, and drops below only when there is no room above.
 */
export function magnifierPlacement(
  pointer: BoardPointer,
  viewport: { width: number; height: number },
  handedness: Handedness,
  size: number,
): MagnifierPlacement {
  const reach = size / 2 + MAGNIFIER_GAP;
  const preferLeft = handedness === "RIGHT";

  let offsetX = preferLeft ? -reach : reach;
  if (pointer.clientX + offsetX - size / 2 < 0) {
    offsetX = reach;
  } else if (pointer.clientX + offsetX + size / 2 > viewport.width) {
    offsetX = -reach;
  }

  let offsetY = -reach;
  if (pointer.clientY + offsetY - size / 2 < 0) {
    offsetY = reach;
  }

  return { offsetX, offsetY };
}
