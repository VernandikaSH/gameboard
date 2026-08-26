// Ludo board geometry on a 15x15 grid (4 corner 6x6 yards + a cross-shaped
// path). The 56-cell shared ring and the 4 private home-stretch lanes below
// were derived and verified programmatically (every ring cell has exactly 2
// ring-neighbors, the loop closes, and it has clean 4-fold rotational
// symmetry) rather than hand-typed, to avoid an off-by-one path bug.

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export const COLOR_ORDER: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

export const BOARD_SIZE = 15;
export const CELL_SIZE = 32; // px

export const RING_LENGTH = 56;
export const LAST_SHARED_STEP = 54; // local step index of the last shared-ring cell
export const HOME_ENTRY_STEP = 55; // first home-stretch local step
export const FINISHED_STEP = 61; // token has reached home

export const RING_PATH: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

export const STARTS: Record<LudoColor, number> = { red: 0, green: 14, yellow: 28, blue: 42 };

// One extra safe cell per quadrant, in addition to every color's start square.
export const SAFE_RING_INDICES = new Set<number>([0, 8, 14, 22, 28, 36, 42, 50]);

export const HOME_STRETCH: Record<LudoColor, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

export const YARD_REGION: Record<LudoColor, { rowStart: number; colStart: number }> = {
  red: { rowStart: 0, colStart: 0 },
  green: { rowStart: 0, colStart: 9 },
  yellow: { rowStart: 9, colStart: 9 },
  blue: { rowStart: 9, colStart: 0 },
};

export const COLOR_CLASSES: Record<LudoColor, { solid: string; light: string; ring: string; text: string }> = {
  red: { solid: 'bg-red-500', light: 'bg-red-100', ring: 'ring-red-600', text: 'text-red-600' },
  green: { solid: 'bg-green-500', light: 'bg-green-100', ring: 'ring-green-600', text: 'text-green-600' },
  yellow: { solid: 'bg-yellow-400', light: 'bg-yellow-100', ring: 'ring-yellow-500', text: 'text-yellow-600' },
  blue: { solid: 'bg-blue-500', light: 'bg-blue-100', ring: 'ring-blue-600', text: 'text-blue-600' },
};

export type CellInfo =
  | { type: 'yard'; color: LudoColor }
  | { type: 'ring'; ringIndex: number; safe: boolean; startColor: LudoColor | null }
  | { type: 'home'; color: LudoColor }
  | { type: 'center' }
  | { type: 'blank' };

const CELL_INFO: CellInfo[][] = Array.from({ length: BOARD_SIZE }, () =>
  Array.from({ length: BOARD_SIZE }, () => ({ type: 'blank' }) as CellInfo)
);

for (const color of COLOR_ORDER) {
  const { rowStart, colStart } = YARD_REGION[color];
  for (let r = rowStart; r < rowStart + 6; r++) {
    for (let c = colStart; c < colStart + 6; c++) {
      CELL_INFO[r][c] = { type: 'yard', color };
    }
  }
}

const startColorByIndex: Record<number, LudoColor> = Object.fromEntries(
  COLOR_ORDER.map(color => [STARTS[color], color])
);

RING_PATH.forEach(([r, c], ringIndex) => {
  CELL_INFO[r][c] = {
    type: 'ring',
    ringIndex,
    safe: SAFE_RING_INDICES.has(ringIndex),
    startColor: startColorByIndex[ringIndex] ?? null,
  };
});

for (const color of COLOR_ORDER) {
  for (const [r, c] of HOME_STRETCH[color]) {
    CELL_INFO[r][c] = { type: 'home', color };
  }
}

CELL_INFO[7][7] = { type: 'center' };

export function getCellInfo(row: number, col: number): CellInfo {
  return CELL_INFO[row][col];
}

export function tokenKey(color: LudoColor, index: number): string {
  return `${color}-${index}`;
}

export function globalIndexForToken(color: LudoColor, localStep: number): number {
  return (STARTS[color] + localStep) % RING_LENGTH;
}

function cellCenter(row: number, col: number, cellSize: number) {
  return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
}

export function getRingCellCenter(ringIndex: number, cellSize: number) {
  const idx = ((ringIndex % RING_LENGTH) + RING_LENGTH) % RING_LENGTH;
  const [r, c] = RING_PATH[idx];
  return cellCenter(r, c, cellSize);
}

export function getHomeStretchCellCenter(color: LudoColor, stretchIndex: number, cellSize: number) {
  const [r, c] = HOME_STRETCH[color][stretchIndex];
  return cellCenter(r, c, cellSize);
}

export function getYardSlotCenter(color: LudoColor, slot: number, cellSize: number) {
  const { rowStart, colStart } = YARD_REGION[color];
  const localRow = 1.5 + Math.floor(slot / 2) * 3;
  const localCol = 1.5 + (slot % 2) * 3;
  return { x: (colStart + localCol) * cellSize, y: (rowStart + localRow) * cellSize };
}

// position: -1 = in yard, 0-54 = shared ring (local step), 55-60 = home
// stretch, 61 = finished.
export function getTokenPixelPosition(color: LudoColor, position: number, slot: number, cellSize: number) {
  if (position < 0) return getYardSlotCenter(color, slot, cellSize);
  if (position <= LAST_SHARED_STEP) return getRingCellCenter(globalIndexForToken(color, position), cellSize);
  if (position < FINISHED_STEP) return getHomeStretchCellCenter(color, position - HOME_ENTRY_STEP, cellSize);
  return cellCenter(7, 7, cellSize);
}
