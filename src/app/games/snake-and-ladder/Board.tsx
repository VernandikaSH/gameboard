import React from 'react';
import PlayerPiece from '../../components/PlayerPiece';
import SnakeLadderOverlay from './SnakeLadderOverlay';
import { BOARD_SIZE, SLIDE_TRANSITION_MS, getCellCenter } from './boardLayout';

interface PlayerData {
  id: number;
  position: number;
  color: string;
  currentAnimationPosition: number;
}

interface BoardProps {
  players: PlayerData[];
  snakes: [number, number][];
  ladders: [number, number][];
  currentPlayer: number;
  slidingPlayer: number | null; // index of the player currently sliding along a snake/ladder, if any
}

const CELL_SIZE = 48; // px, matches the w-12 h-12 cell classes below
const STEP_TRANSITION_MS = 260; // normal one-cell hop

// Pixel offsets from a cell's center, used to fan out multiple pieces sharing one square.
const STACK_OFFSETS: [number, number][][] = [
  [[0, 0]],
  [[-9, 0], [9, 0]],
  [[-9, -8], [9, -8], [0, 9]],
  [[-9, -9], [9, -9], [-9, 9], [9, 9]],
];

function getStackOffset(numInCell: number, indexInCell: number): [number, number] {
  const offsets = STACK_OFFSETS[Math.min(numInCell, 4) - 1];
  return offsets[Math.min(indexInCell, offsets.length - 1)];
}

const Board: React.FC<BoardProps> = ({ players, snakes, ladders, currentPlayer, slidingPlayer }) => {
  const cells = [];
  let isRightToLeft = false;

  for (let row = 9; row >= 0; row--) {
    const rowCells = [];
    const start = row * 10 + 1;
    const end = (row + 1) * 10;

    for (let col = 0; col < 10; col++) {
      const cellNumber = isRightToLeft ? end - col : start + col;

      rowCells.push(
        <div
          key={cellNumber}
          className={`w-12 h-12 border border-gray-300 flex items-center justify-center relative
            ${row % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
        >
          <span className="text-xs">{cellNumber}</span>
        </div>
      );
    }

    cells.push(
      <div key={row} className="flex">
        {rowCells}
      </div>
    );
    isRightToLeft = !isRightToLeft;
  }

  // Group players by their current cell so pieces sharing a square fan out.
  const playersInCell: { [key: number]: PlayerData[] } = {};
  players.forEach(player => {
    if (!playersInCell[player.currentAnimationPosition]) {
      playersInCell[player.currentAnimationPosition] = [];
    }
    playersInCell[player.currentAnimationPosition].push(player);
  });

  return (
    <div
      className="relative border-4 border-gray-800 rounded-lg overflow-hidden shadow-lg"
      style={{ width: CELL_SIZE * 10, height: CELL_SIZE * 10 }}
    >
      {cells}

      {/* Snake/ladder overlay: shows exactly where each one leads */}
      <SnakeLadderOverlay snakes={snakes} ladders={ladders} cellSize={CELL_SIZE} boardSize={BOARD_SIZE} />

      {/* Player pieces, positioned in pixel space (via CSS transition on left/top)
          so a move - including diagonally along a snake or ladder - slides
          smoothly instead of teleporting. */}
      {players.map((player, index) => {
        const cellPlayers = playersInCell[player.currentAnimationPosition];
        const indexInCell = cellPlayers.indexOf(player);
        const [offsetX, offsetY] = getStackOffset(cellPlayers.length, indexInCell);
        const center = getCellCenter(player.currentAnimationPosition, CELL_SIZE);

        return (
          <PlayerPiece
            key={player.id}
            color={player.color}
            isCurrent={currentPlayer === index}
            x={center.x + offsetX}
            y={center.y + offsetY}
            transitionMs={slidingPlayer === index ? SLIDE_TRANSITION_MS : STEP_TRANSITION_MS}
          />
        );
      })}
    </div>
  );
};

export default Board;
