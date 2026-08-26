/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';
import { useState, useMemo } from 'react';
import { Chess, Move, Square as ChessSquare } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import BackButton from '@/app/components/BackButton';
import { playStepSound, playSnakeSound, playLadderSound } from '@/lib/sound';

type CustomSquareStyles = Record<string, React.CSSProperties | undefined>;

export default function ChessPage() {
  const [gameHistory, setGameHistory] = useState<Chess[]>([new Chess()]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [moveFrom, setMoveFrom] = useState<ChessSquare | null>(null);
  const [validMoves, setValidMoves] = useState<ChessSquare[]>([]);
  const [rightClickedSquares, setRightClickedSquares] = useState<CustomSquareStyles>({});
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Current game state
  const currentGame = gameHistory[currentMoveIndex];

  function makeAMove(move: {
    from: ChessSquare;
    to: ChessSquare;
    promotion?: string;
  }): Move | null {
    try {
      const newGame = new Chess(currentGame.fen());
      const result = newGame.move(move);

      if (result) {
        // Reuse the existing library sounds: a capture gets the "something
        // removed" sound, a promotion (or checkmate) gets the achievement
        // chime, everything else gets a plain move tick.
        if (result.captured) {
          playSnakeSound();
        } else {
          playStepSound();
        }
        if (result.promotion || newGame.isCheckmate()) {
          playLadderSound();
        }

        // If we're not at the end of history, we need to truncate
        const isAtCurrentEnd = currentMoveIndex === gameHistory.length - 1;

        setGameHistory(prev =>
          isAtCurrentEnd
            ? [...prev, newGame]
            : [...prev.slice(0, currentMoveIndex + 1), newGame]
        );

        setCurrentMoveIndex(prev => prev + 1);

        // Update move history - truncate if not at end
        setMoveHistory(prev =>
          isAtCurrentEnd
            ? [...prev, result.san]
            : [...prev.slice(0, currentMoveIndex), result.san]
        );
      }

      return result;
    } catch (error) {
      return null;
    }
  }

  function onDrop(sourceSquare: ChessSquare, targetSquare: ChessSquare, piece: string): boolean {
    // Clear move indicators first
    setMoveFrom(null);
    setValidMoves([]);

    // Check if this is a promotion move
    const movingPiece = currentGame.get(sourceSquare);
    const isPromotion = movingPiece?.type === 'p' &&
      ((movingPiece.color === 'w' && targetSquare[1] === '8') ||
        (movingPiece.color === 'b' && targetSquare[1] === '1'));

    // If promotion, the piece parameter will contain the promoted piece type (q, r, b, n)
    if (isPromotion) {
      const promotionPiece = piece[1].toLowerCase() as 'q' | 'r' | 'b' | 'n';
      const move = makeAMove({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotionPiece
      });
      return move !== null;
    }

    // Regular move
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare
    });
    return move !== null;
  }


  function onSquareClick(square: ChessSquare): void {
    const piece = currentGame.get(square);

    // If clicking on a piece of the current player's color
    if (piece && piece.color === currentGame.turn()) {
      setMoveFrom(square);
      // Calculate ALL valid moves for this piece (including captures and promotions)
      const moves = currentGame.moves({
        square,
        verbose: true
      }).map(move => move.to);
      setValidMoves(moves);
      return;
    }

    // If we have a selected piece and click on a valid move square
    if (moveFrom && validMoves.includes(square)) {
      const isPromotion = currentGame.get(moveFrom)?.type === 'p' &&
        ((currentGame.get(moveFrom)?.color === 'w' && square[1] === '8') ||
          (currentGame.get(moveFrom)?.color === 'b' && square[1] === '1'));

      const move = makeAMove({
        from: moveFrom,
        to: square,
        promotion: isPromotion ? 'q' : undefined // Default to queen promotion
      });

      if (move) {
        setMoveFrom(null);
        setValidMoves([]);
      }
      return;
    }

    // If clicking elsewhere, clear selection
    setMoveFrom(null);
    setValidMoves([]);
  }

  function onSquareRightClick(square: ChessSquare): void {
    setRightClickedSquares(prev => {
      const newStyles = { ...prev };
      if (newStyles[square]) {
        delete newStyles[square]; // Remove the square if it exists
      } else {
        newStyles[square] = {
          background: 'rgba(255, 255, 0, 0.4)',
          borderRadius: '50%'
        };
      }
      return newStyles;
    });
  }

  const customSquareStyles: CustomSquareStyles = {
    ...(moveFrom ? {
      [moveFrom]: {
        background: 'rgba(255, 255, 0, 0.4)'
      }
    } : {}),
    ...rightClickedSquares,
    ...validMoves.reduce((styles, move) => {
      const targetPiece = currentGame.get(move);
      styles[move] = {
        background: targetPiece
          ? 'radial-gradient(circle, rgba(255,0,0,.5) 25%, transparent 25%)' // Red for captures
          : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)', // Black dot for empty squares
        borderRadius: '50%',
      };
      return styles;
    }, {} as CustomSquareStyles)
  };
  const captureIndicators = useMemo(() => {
    // Use a Set to filter out duplicate squares
    const uniqueValidMoves = [...new Set(validMoves)];

    return uniqueValidMoves.map(move => {
      const targetPiece = currentGame.get(move);
      if (!targetPiece) return null;

      const file = move.charCodeAt(0) - 97;
      const rank = 8 - parseInt(move[1]);

      return (
        <div
          key={`${move}-capture`}  // Add suffix to ensure uniqueness
          className="absolute w-[4.25%] h-[4.25%] rounded-full bg-red-500/90 pointer-events-none"
          style={{
            left: `${file * 12.5 + 4.125}%`,
            top: `${rank * 12.5 + 4.125}%`,
            zIndex: 10
          }}
        />
      );
    });
  }, [validMoves, currentGame]);

  function resetGame(): void {
    setGameHistory([new Chess()]);
    setCurrentMoveIndex(0);
    setMoveFrom(null);
    setValidMoves([]);
    setRightClickedSquares({});
    setMoveHistory([]);
  }

  function undoMove(): void {
    if (currentMoveIndex > 0) {
      setCurrentMoveIndex(prev => prev - 1);
      setMoveFrom(null);
      setValidMoves([]);
      // Remove the last move from history
      setMoveHistory(prev => prev.slice(0, -1));
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-10">
      <BackButton variant='floating' />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Chess</h1>
          <p className="text-gray-600">
            {currentGame.turn() === 'w' ? "White's turn" : "Black's turn"}
            {currentGame.isCheck() && ' - Check!'}
            {currentGame.isCheckmate() && ' - Checkmate!'}
            {currentGame.isDraw() && ' - Draw!'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-4 inline-block">
              <div className="relative">
                <Chessboard
                  position={currentGame.fen()}
                  onPieceDrop={onDrop}
                  onSquareClick={onSquareClick}
                  onSquareRightClick={onSquareRightClick}
                  customSquareStyles={customSquareStyles}
                  boardWidth={550}
                />
                {captureIndicators}

              </div>
            </div>

            <div className="mt-4 flex gap-4">
              <button
                onClick={resetGame}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                New Game
              </button>
              <button
                onClick={undoMove}
                className={`px-4 py-2 rounded ${currentMoveIndex === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                disabled={currentMoveIndex === 0}
              >
                Undo Move
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Game Status</h2>
              <div className="space-y-2">
                <p><strong>Turn:</strong> {currentGame.turn() === 'w' ? 'White' : 'Black'}</p>
                {currentGame.isCheck() && <p className="text-red-600">Check!</p>}
                {currentGame.isCheckmate() && <p className="text-red-600 font-bold">Checkmate!</p>}
                {currentGame.isDraw() && <p className="text-gray-600 font-bold">Draw!</p>}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Move History</h2>
              <div className="h-64 overflow-y-auto border rounded p-2">
                {moveHistory.length === 0 ? (
                  <p className="text-gray-500 italic">No moves yet</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <p>White</p>
                    <p>Black</p>
                    {moveHistory.map((move, i) => (
                      <div key={i} className={i % 2 === 0 ? 'font-medium' : ''}>
                        {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''} {move}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}