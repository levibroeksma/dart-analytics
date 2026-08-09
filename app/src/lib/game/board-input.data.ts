import {
  boardInput,
  boardPxPerMm,
  screenToBoard,
} from "@modules/game/board-input.module";
import type { BoardInputController, DartObservation } from "@modules/types";

type BoardInputDataContext = {
  input: BoardInputController | null;
  pointerX: number;
  pointerY: number;
  $refs: { board: SVGSVGElement };
  onPointerDown(this: BoardInputDataContext, event: PointerEvent): void;
  onPointerMove(this: BoardInputDataContext, event: PointerEvent): void;
  onPointerUp(this: BoardInputDataContext): void;
  onPointerCancel(this: BoardInputDataContext): void;
  recordUnseen(this: BoardInputDataContext): void;
};

/**
 * Builds a fresh controller bound to the board SVG, reading the viewport at
 * the moment it is called rather than once for the page's whole lifetime —
 * the board is `w-full`, so both its displayed scale (`pxPerMm`) and the
 * magnifier's clamp bounds depend on the current viewport, and only a value
 * read now can reflect a resize or rotation since the last gesture.
 */
function freshController(
  board: SVGSVGElement,
  onCommit: (observation: DartObservation) => void,
): BoardInputController {
  return boardInput({
    toBoard: screenToBoard(board),
    pxPerMm: () => boardPxPerMm(board),
    onCommit,
    viewport: {
      width: globalThis.innerWidth ?? 0,
      height: globalThis.innerHeight ?? 0,
    },
  });
}

/**
 * Bridges pointer events on the board SVG to the pure input controller.
 * A new controller is built on every press (see `freshController`), so a
 * viewport resize or rotation between gestures is picked up on the next
 * one; the controller then persists for the rest of that single gesture, so
 * move/release/cancel keep acting on the same instance press started.
 */
export function boardInputData(
  onCommit: (observation: DartObservation) => void,
) {
  return {
    input: null as BoardInputController | null,
    pointerX: 0,
    pointerY: 0,

    onPointerDown(this: BoardInputDataContext, event: PointerEvent) {
      event.preventDefault();
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      const controller = freshController(this.$refs.board, onCommit);
      this.input = controller;
      controller.press(event);
    },

    onPointerMove(this: BoardInputDataContext, event: PointerEvent) {
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.input?.move(event);
    },

    onPointerUp(this: BoardInputDataContext) {
      this.input?.release();
    },

    onPointerCancel(this: BoardInputDataContext) {
      this.input?.cancel();
    },

    recordUnseen(this: BoardInputDataContext) {
      const controller =
        this.input ?? freshController(this.$refs.board, onCommit);
      this.input = controller;
      controller.commitUnseen();
    },
  };
}
