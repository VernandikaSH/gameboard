"use client";

import BackButton from '@/app/components/BackButton';
import { useState, useEffect } from 'react';
import { playDiceSound, playLadderSound } from '@/lib/sound';

type Player = 'red' | 'yellow';
type Board = (Player | null)[][];

// Move checkWin and checkDraw outside the component
const checkWin = (board: Board, row: number, col: number, player: Player): boolean => {
  const directions = [
    [0, 1],    // horizontal
    [1, 0],    // vertical
    [1, 1],    // diagonal down-right
    [1, -1]    // diagonal down-left
  ];

  for (const [dx, dy] of directions) {
    let count = 1;

    // Check in positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dx * i;
      const c = col + dy * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) break;
      count++;
    }

    // Check in negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dx * i;
      const c = col - dy * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) break;
      count++;
    }

    if (count >= 4) return true;
  }
  return false;
};

const checkDraw = (board: Board): boolean => {
  return board.every(row => row.every(cell => cell !== null));
};


export default function ConnectFourGame() {
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>('red');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [droppingPiece, setDroppingPiece] = useState<{ row: number; col: number; player: Player } | null>(null);
  const [dropOffset, setDropOffset] = useState<number>(0); // New state for controlling the drop animation

  // Initialize empty board
  function createEmptyBoard(): Board {
    return Array(6).fill(null).map(() => Array(7).fill(null));
  }

  // Handle column selection
  const handleColumnSelect = (col: number) => {
    if (gameOver || winner || droppingPiece) return;

    for (let row = 5; row >= 0; row--) {
      if (!board[row][col]) {
        playDiceSound(); // reuse the existing "drop" sound for the disc falling
        // Set the droppingPiece data
        setDroppingPiece({ row, col, player: currentPlayer });
        // Immediately set the initial offset (far above)
        // This value needs to be large enough to start completely off-screen above the board.
        // A good estimate is the entire height of the board plus some extra.
        const initialOffset = (row + 1) * (50 + 5 * 2); // (row * cell_height) + padding + arbitrary extra
        setDropOffset(initialOffset);
        return;
      }
    }
  };

  // Effect to manage the animation and then update the board
  useEffect(() => {
    if (droppingPiece) {
      // Step 1: Force a reflow/re-render to apply the initial 'transform' (dropOffset)
      // before transitioning. Using requestAnimationFrame is a reliable way to do this.
      requestAnimationFrame(() => {
        setDropOffset(0); // Set to 0 to trigger the smooth transition down
      });

      // Step 2: After the animation duration, update the board state
      const animationDurationMs = 300;
      const timer = setTimeout(() => {
        const { row, col, player } = droppingPiece;
        const newBoard = [...board];
        newBoard[row] = [...newBoard[row]];
        newBoard[row][col] = player;
        setBoard(newBoard);
        setDroppingPiece(null); // Clear dropping piece after animation
        setDropOffset(0); // Reset offset for next drop

        // Check for winner
        if (checkWin(newBoard, row, col, player)) {
          playLadderSound(); // reuse the existing achievement chime for a win
          setWinner(player);
          setGameOver(true);
          return;
        }

        // Check for draw
        if (checkDraw(newBoard)) {
          setGameOver(true);
          return;
        }

        // Switch player
        setCurrentPlayer(currentPlayer === 'red' ? 'yellow' : 'red');
      }, animationDurationMs);

      return () => {
        clearTimeout(timer);
        // Ensure dropOffset is reset if component unmounts or state changes rapidly
        setDropOffset(0);
      };
    }
  }, [droppingPiece, board, currentPlayer]);

  // Reset game
  const resetGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer('red');
    setWinner(null);
    setGameOver(false);
    setDroppingPiece(null);
    setDropOffset(0); // Also reset drop offset on game reset
  };

  // Get the next available row in a column
  const getNextAvailableRow = (col: number): number | null => {
    for (let row = 5; row >= 0; row--) {
      if (!board[row][col]) return row;
    }
    return null;
  };

  // Determine the color class for the hovered piece
  const getHoveredPieceColorClass = () => {
    return currentPlayer === 'red' ? 'bg-red-500' : 'bg-yellow-400';
  };

  return (
    <div className="flex flex-col items-center p-8 font-sans bg-gray-100 min-h-screen">
      <BackButton variant='floating' />
      <h1 className="text-3xl font-bold mb-4">Connect Four</h1>

      {/* Game status display */}
      <div className="my-4 text-lg font-bold min-h-8">
        {winner ? (
          <div className="px-4 py-2 rounded bg-white shadow">
            Player <span style={{ color: winner === 'red' ? '#ef4444' : '#facc15' }}>{winner}</span> wins!
          </div>
        ) : gameOver ? (
          <div className="px-4 py-2 rounded bg-white shadow">It&apos;s a draw!</div>
        ) : (
          <div className="px-4 py-2 rounded bg-white shadow">
            Current turn: <span style={{ color: currentPlayer === 'red' ? '#ef4444' : '#facc15' }}>{currentPlayer}</span>
          </div>
        )}
      </div>

      {/* Main game container */}
      <div className="relative mt-16 shadow-xl rounded-lg">
        {/* Column selector */}
        <div className="absolute -top-[60px] left-0 right-0 flex justify-center px-4 py-2 rounded-t-lg bg-red-400">
          {Array(7).fill(null).map((_, colIndex) => (
            <div
              key={colIndex}
              className="w-[50px] h-[50px] mx-[5px] cursor-pointer flex justify-center items-center bg-gray-200 rounded-full border-2 border-dashed border-gray-800"
              onClick={() => handleColumnSelect(colIndex)}
              onMouseEnter={() => setHoveredColumn(colIndex)}
              onMouseLeave={() => setHoveredColumn(null)}
            >
              {hoveredColumn === colIndex && getNextAvailableRow(colIndex) !== null && !droppingPiece && (
                <div className={`pt-4 w-[40px] h-[40px] rounded-full ${getHoveredPieceColorClass()} opacity-70`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Game board */}
        <div className="flex flex-col bg-blue-600 p-4 rounded-lg shadow-lg">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => (
                <div
                  key={colIndex}
                  className="w-[50px] h-[50px] m-[5px] bg-white rounded-full flex justify-center items-center"
                >
                  {/* Render actual placed pieces */}
                  {cell && (
                    <div
                      className={`w-[40px] h-[40px] rounded-full ${cell === 'red' ? 'bg-red-500' : 'bg-yellow-400'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Animating dropping piece */}
          {droppingPiece && (
            <div
              className={`absolute w-[40px] h-[40px] rounded-full
                ${droppingPiece.player === 'red' ? 'bg-red-500' : 'bg-yellow-400'}
                transition-transform ease-out duration-300`}
              style={{
                // Calculate horizontal position
                left: `${20 + (droppingPiece.col * 50) + (droppingPiece.col * 10) + 5}px`,
                // Calculate vertical position relative to the top of the board container
                // This is the *final* 'top' position for the piece.
                top: `${16 + (droppingPiece.row * 50) + (droppingPiece.row * 10) + 5}px`,
                // Apply the transform to control the animation.
                // It starts at -dropOffset (high up) and transitions to 0 (its 'top' position).
                transform: `translateY(-${dropOffset}px)`,
              }}
            ></div>
          )}
        </div>
      </div>

      <button
        onClick={resetGame}
        className="mt-6 px-4 py-2 text-white bg-blue-600 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-blue-700 shadow"
      >
        Reset Game
      </button>
    </div>
  );
}