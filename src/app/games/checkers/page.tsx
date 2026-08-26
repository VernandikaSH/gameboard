/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import BackButton from '@/app/components/BackButton';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { playStepSound, playSnakeSound, playLadderSound } from '@/lib/sound';

type PieceColor = 'red' | 'black';
type PieceType = 'normal' | 'king';
interface Piece {
    color: PieceColor;
    type: PieceType;
}
type Board = (Piece | null)[][];
type Position = [number, number];

// New type for game history entry
type GameHistoryEntry = {
    board: Board;
    currentPlayer: PieceColor;
};

const BOARD_SIZE = 8;

export default function CheckersGame() {
    const [board, setBoard] = useState<Board>(initializeBoard());
    const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<PieceColor>('red');
    const [gameStatus, setGameStatus] = useState<string>('Red player\'s turn');
    const [gameOver, setGameOver] = useState<boolean>(false);
    // Updated type for gameHistory
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
    const [movablePieces, setMovablePieces] = useState<Position[]>([]);


    function initializeBoard(): Board {
        const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { color: 'red', type: 'normal' };
                }
            }
        }

        for (let row = 5; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { color: 'black', type: 'normal' };
                }
            }
        }

        return board;
    }

    const getMovesForPiece = useCallback((currentBoard: Board, position: Position, playerColor: PieceColor): Position[] => {
        const [row, col] = position;
        const piece = currentBoard[row][col];
        if (!piece || piece.color !== playerColor) return [];

        const moves: Position[] = [];
        const captureMoves: Position[] = [];
        const directions = [];

        if (piece.type === 'normal') {
            directions.push(playerColor === 'red' ? 1 : -1);
        } else {
            directions.push(1, -1);
        }

        for (const direction of directions) {
            const newRow = row + direction;
            const jumpRow = row + 2 * direction;

            if (jumpRow >= 0 && jumpRow < BOARD_SIZE) {
                if (col > 1) {
                    const midRow = row + direction;
                    const midCol = col - 1;
                    const targetCol = col - 2;
                    const midPiece = currentBoard[midRow][midCol];
                    if (midPiece && midPiece.color !== piece.color && !currentBoard[jumpRow][targetCol]) {
                        captureMoves.push([jumpRow, targetCol]);
                    }
                }
                if (col < BOARD_SIZE - 2) {
                    const midRow = row + direction;
                    const midCol = col + 1;
                    const targetCol = col + 2;
                    const midPiece = currentBoard[midRow][midCol];
                    if (midPiece && midPiece.color !== piece.color && !currentBoard[jumpRow][targetCol]) {
                        captureMoves.push([jumpRow, targetCol]);
                    }
                }
            }
            if (captureMoves.length === 0 && newRow >= 0 && newRow < BOARD_SIZE) {
                if (col > 0 && !currentBoard[newRow][col - 1]) {
                    moves.push([newRow, col - 1]);
                }
                if (col < BOARD_SIZE - 1 && !currentBoard[newRow][col + 1]) {
                    moves.push([newRow, col + 1]);
                }
            }
        }
        return captureMoves.length > 0 ? captureMoves : moves;
    }, []);

    const getValidMoves = useCallback((position: Position): Position[] => {
        return getMovesForPiece(board, position, currentPlayer);
    }, [board, currentPlayer, getMovesForPiece]);

    const checkMandatoryCaptures = useCallback((): boolean => {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = board[row][col];
                if (piece && piece.color === currentPlayer) {
                    const moves = getMovesForPiece(board, [row, col], currentPlayer);
                    if (moves.some(([r, c]) => Math.abs(r - row) === 2)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }, [board, currentPlayer, getMovesForPiece]);

    const getMovablePiecesForCurrentPlayer = useCallback((): Position[] => {
        const movable: Position[] = [];
        const mandatoryCapturesExist = checkMandatoryCaptures();

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = board[row][col];
                if (piece && piece.color === currentPlayer) {
                    const moves = getMovesForPiece(board, [row, col], currentPlayer);

                    if (mandatoryCapturesExist) {
                        if (moves.some(([r, c]) => Math.abs(r - row) === 2)) {
                            movable.push([row, col]);
                        }
                    } else {
                        if (moves.length > 0) {
                            movable.push([row, col]);
                        }
                    }
                }
            }
        }
        return movable;
    }, [board, currentPlayer, getMovesForPiece, checkMandatoryCaptures]);


    useEffect(() => {
        setMovablePieces(getMovablePiecesForCurrentPlayer());
    }, [getMovablePiecesForCurrentPlayer]);


    const canCaptureAgain = useCallback((position: Position): boolean => {
        const moves = getValidMoves(position);
        return moves.some(([r, c]) => Math.abs(r - position[0]) === 2);
    }, [getValidMoves]);


    function movePiece(from: Position, to: Position) {
        setGameHistory([...gameHistory, { board: board.map(row => [...row]), currentPlayer: currentPlayer }]);

        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        const piece = board[fromRow][fromCol];
        if (!piece) return;

        const newBoard = [...board.map(row => [...row])];
        newBoard[toRow][toCol] = piece;
        newBoard[fromRow][fromCol] = null;

        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const isCapture = Math.abs(rowDiff) === 2;

        if (isCapture) {
            playSnakeSound();
            const capturedRow = fromRow + rowDiff / 2;
            const capturedCol = fromCol + colDiff / 2;
            newBoard[capturedRow][capturedCol] = null;

            const getCaptureMovesForTempBoard = (tempPosition: Position, tempBoard: Board, playerColor: PieceColor): Position[] => {
                const [r, c] = tempPosition;
                const tempPiece = tempBoard[r][c];
                if (!tempPiece || tempPiece.color !== playerColor) return [];

                const tempCaptureMoves: Position[] = [];
                const tempDirections = [];

                if (tempPiece.type === 'normal') {
                    tempDirections.push(playerColor === 'red' ? 1 : -1);
                } else {
                    tempDirections.push(1, -1);
                }

                for (const tempDirection of tempDirections) {
                    const tempJumpRow = r + 2 * tempDirection;

                    if (tempJumpRow >= 0 && tempJumpRow < BOARD_SIZE) {
                        if (c > 1) {
                            const tempMidPiece = tempBoard[r + tempDirection][c - 1];
                            if (tempMidPiece && tempMidPiece.color !== tempPiece.color && !tempBoard[tempJumpRow][c - 2]) {
                                tempCaptureMoves.push([tempJumpRow, c - 2]);
                            }
                        }
                        if (c < BOARD_SIZE - 2) {
                            const tempMidPiece = tempBoard[r + tempDirection][c + 1];
                            if (tempMidPiece && tempMidPiece.color !== tempPiece.color && !tempBoard[tempJumpRow][c + 2]) {
                                tempCaptureMoves.push([tempJumpRow, c + 2]);
                            }
                        }
                    }
                }
                return tempCaptureMoves;
            };

            // FIX IS HERE: Add `currentPlayer` as the third argument
            if (getCaptureMovesForTempBoard(to, newBoard, currentPlayer).length > 0) {
                setSelectedPiece(to);
                // FIX IS HERE: Add `currentPlayer` as the third argument
                setValidMoves(getCaptureMovesForTempBoard(to, newBoard, currentPlayer));
                setBoard(newBoard);
                return;
            }
        } else {
            playStepSound();
        }

        if (piece.type === 'normal' &&
            ((piece.color === 'red' && toRow === BOARD_SIZE - 1) ||
                (piece.color === 'black' && toRow === 0))) {
            newBoard[toRow][toCol] = { ...piece, type: 'king' };
            playLadderSound();
        }

        setBoard(newBoard);

        setSelectedPiece(null);
        setValidMoves([]);

        const nextPlayer = currentPlayer === 'red' ? 'black' : 'red';

        // FIXED: Check game over with the new board and next player
        const { isOver, winner } = checkGameOverWithBoard(newBoard, nextPlayer);
        if (isOver) {
            setGameStatus(`Game over! ${winner === 'red' ? 'Red' : 'Black'} player wins!`);
            setGameOver(true);
            return;
        }

        setCurrentPlayer(nextPlayer);
        setGameStatus(`${nextPlayer === 'red' ? 'Red' : 'Black'} player's turn`);
    }

    function undoMove() {
        if (gameHistory.length === 0 || gameOver) return;

        const lastState = gameHistory[gameHistory.length - 1];
        setBoard(lastState.board);
        setCurrentPlayer(lastState.currentPlayer);
        setGameHistory(gameHistory.slice(0, -1));

        setSelectedPiece(null);
        setValidMoves([]);
        setGameOver(false);
        setGameStatus(`${lastState.currentPlayer === 'red' ? 'Red' : 'Black'} player's turn`);
    }

    function handlePieceClick(position: Position) {
        if (gameOver) return;

        const [row, col] = position;
        const clickedPiece = board[row][col];

        if (!selectedPiece) {
            if (clickedPiece && clickedPiece.color === currentPlayer) {
                const mandatoryCapturesExist = checkMandatoryCaptures();
                const potentialMovesForClickedPiece = getValidMoves(position);

                if (mandatoryCapturesExist) {
                    const clickedPieceCanCapture = potentialMovesForClickedPiece.some(([r, c]) => Math.abs(r - row) === 2);
                    if (clickedPieceCanCapture) {
                        setSelectedPiece(position);
                        setValidMoves(potentialMovesForClickedPiece);
                    }
                } else {
                    if (potentialMovesForClickedPiece.length > 0) {
                        setSelectedPiece(position);
                        setValidMoves(potentialMovesForClickedPiece);
                    }
                }
            }
            return;
        }

        const [selectedRow, selectedCol] = selectedPiece;

        if (selectedRow === row && selectedCol === col) {
            setSelectedPiece(null);
            setValidMoves([]);
            return;
        }

        if (clickedPiece && clickedPiece.color === currentPlayer) {
            const mandatoryCapturesExist = checkMandatoryCaptures();
            const potentialMovesForNewPiece = getValidMoves(position);

            if (mandatoryCapturesExist) {
                const newClickedPieceCanCapture = potentialMovesForNewPiece.some(([r, c]) => Math.abs(r - row) === 2);
                if (newClickedPieceCanCapture) {
                    setSelectedPiece(position);
                    setValidMoves(potentialMovesForNewPiece);
                }
            } else {
                if (potentialMovesForNewPiece.length > 0) {
                    setSelectedPiece(position);
                    setValidMoves(potentialMovesForNewPiece);
                }
            }
            return;
        }

        const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
        if (isValidMove) {
            movePiece(selectedPiece, position);
        }
    }

    // FIXED: New helper function to check game over with specific board and player
    function checkGameOverWithBoard(checkBoard: Board, playerToCheck: PieceColor): { isOver: boolean; winner: PieceColor | null } {
        let redPieces = 0;
        let blackPieces = 0;

        // Count pieces
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = checkBoard[row][col];
                if (piece) {
                    if (piece.color === 'red') redPieces++;
                    else blackPieces++;
                }
            }
        }

        // Check if either player has no pieces left
        if (redPieces === 0) {
            return { isOver: true, winner: 'black' };
        }
        if (blackPieces === 0) {
            return { isOver: true, winner: 'red' };
        }

        // Check if the player to move has any legal moves
        const playerHasLegalMoves = checkPlayerHasLegalMoves(checkBoard, playerToCheck);

        if (!playerHasLegalMoves) {
            // Player has no legal moves, they lose
            return { isOver: true, winner: playerToCheck === 'red' ? 'black' : 'red' };
        }

        return { isOver: false, winner: null };
    }

    // FIXED: Helper function to check if a player has any legal moves
    function checkPlayerHasLegalMoves(checkBoard: Board, playerColor: PieceColor): boolean {
        // First, check if there are any mandatory captures
        const mandatoryCaptures = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = checkBoard[row][col];
                if (piece && piece.color === playerColor) {
                    const moves = getMovesForPiece(checkBoard, [row, col], playerColor);
                    const captureMoves = moves.filter(([r, c]) => Math.abs(r - row) === 2);
                    if (captureMoves.length > 0) {
                        mandatoryCaptures.push(...captureMoves);
                    }
                }
            }
        }

        // If there are mandatory captures, player has legal moves
        if (mandatoryCaptures.length > 0) {
            return true;
        }

        // If no mandatory captures, check for any regular moves
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = checkBoard[row][col];
                if (piece && piece.color === playerColor) {
                    const moves = getMovesForPiece(checkBoard, [row, col], playerColor);
                    if (moves.length > 0) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // FIXED: Updated checkGameOver function to use current board and current player
    function checkGameOver(): { isOver: boolean; winner: PieceColor | null } {
        return checkGameOverWithBoard(board, currentPlayer);
    }

    function startNewGame() {
        setBoard(initializeBoard());
        setCurrentPlayer('red');
        setGameStatus('Red player\'s turn');
        setSelectedPiece(null);
        setValidMoves([]);
        setGameOver(false);
        setGameHistory([]);
    }

    return (
        <div className="min-h-[100vh] flex flex-col items-center p-10 bg-gray-100">
            <BackButton variant='floating' />
            <h1 className="text-2xl font-bold mb-4">Checkers Game</h1>
            <div className={`mb-4 text-lg font-semibold ${currentPlayer === 'red' ? 'text-red-500' : 'text-gray-800'
                }`}>
                {gameStatus}
            </div>

            <div className="border-2 border-gray-800 shadow-lg/30">
                {board.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex">
                        {row.map((piece, colIndex) => {
                            const isDarkSquare = (rowIndex + colIndex) % 2 === 1;
                            const isSelected = selectedPiece &&
                                selectedPiece[0] === rowIndex &&
                                selectedPiece[1] === colIndex;
                            const isValidMove = validMoves.some(
                                ([r, c]) => r === rowIndex && c === colIndex
                            );

                            const shouldHighlightMovable = !gameOver &&
                                piece && piece.color === currentPlayer &&
                                movablePieces.some(([r, c]) => r === rowIndex && c === colIndex) &&
                                !(isSelected);

                            const shouldHighlightKing = !gameOver &&
                                piece && piece.color === currentPlayer &&
                                piece.type === 'king' &&
                                movablePieces.some(([r, c]) => r === rowIndex && c === colIndex) &&
                                !(isSelected);

                            return (
                                <div
                                    key={`${rowIndex}-${colIndex}`}
                                    className={`
                                        w-12 h-12 flex items-center justify-center
                                        ${isDarkSquare ? 'bg-gray-700' : 'bg-gray-200'}
                                        ${isSelected ? 'ring-2 ring-yellow-400' : ''}
                                        ${isValidMove ? 'bg-green-400 cursor-pointer' : ''}
                                    `}
                                    onClick={() => handlePieceClick([rowIndex, colIndex])}
                                >
                                    {piece && (
                                        <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center
                                        ${piece.color === 'red' ? 'bg-red-500' : 'bg-black'}
                                        cursor-pointer
                                        ${shouldHighlightKing ? 'ring-2 ring-emerald-300 ring-opacity-80' : ''}
                                        ${piece.type === 'king' && !shouldHighlightKing ? 'ring-2 ring-yellow-400' : ''}
                                        ${shouldHighlightMovable && piece.type === 'normal' ? 'ring-2 ring-blue-500' : ''}
                                        `}>
                                            {piece.type === 'king' && (
                                                <div className="text-white font-bold">
                                                    <Image
                                                        src={'/king_checkers.png'}
                                                        alt={`King Checkers `}
                                                        width={35}
                                                        height={35}
                                                        className="object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="flex gap-4 mt-4">
                <button
                    onClick={undoMove}
                    disabled={gameHistory.length === 0 || gameOver}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
                >
                    Undo
                </button>
                <button
                    onClick={startNewGame}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    New Game
                </button>
            </div>
        </div >
    );
}