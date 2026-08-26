export const BOARD_SIZE = 10;

// How long a piece takes to visually slide down a snake or up a ladder.
// page.tsx waits this long before resuming the game after the slide starts,
// so it must match the transition duration Board.tsx applies to the piece.
export const SLIDE_TRANSITION_MS = 700;

// Mirrors the boustrophedon cell numbering built by Board.tsx: decade 9 (cells
// 91-100) is left-to-right, and each decade below alternates direction.
export function getCellCenter(cellNumber: number, cellSize: number) {
  const decade = Math.floor((cellNumber - 1) / 10); // 0 for cells 1-10, ... 9 for 91-100
  const col = (cellNumber - 1) % 10;
  const isLeftToRight = decade % 2 === 1;

  const visualCol = isLeftToRight ? col : BOARD_SIZE - 1 - col;
  const x = visualCol * cellSize + cellSize / 2;
  const y = (BOARD_SIZE - 1 - decade) * cellSize + cellSize / 2;

  return { x, y };
}
