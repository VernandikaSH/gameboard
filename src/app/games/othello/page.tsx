/* eslint-disable @typescript-eslint/no-unused-vars */
'use client' 

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image'; // Assuming Image component is available
import BackButton from '@/app/components/BackButton';
import { playDiceSound, playStepSound } from '@/lib/sound';

type Player = 'black' | 'white';
type Board = (Player | null)[][];
type Position = [number, number];

const BOARD_SIZE = 8;
// How long one piece's turn-over animation takes - must match the
// othello-flip keyframe duration in globals.css.
const FLIP_DURATION_MS = 400;
// Extra delay per ring of distance from the placed piece, so flips ripple
// outward instead of all happening at once.
const FLIP_STAGGER_MS = 60;

export default function OthelloGame() {
    const [board, setBoard] = useState<Board>(initializeBoard());
    const [currentPlayer, setCurrentPlayer] = useState<Player>('black'); 
    const [validMoves, setValidMoves] = useState<Position[]>([]); 
    const [gameStatus, setGameStatus] = useState<string>('Black player\'s turn');
    const [score, setScore] = useState<{ black: number; white: number }>({ black: 2, white: 2 }); //
    const [gameOver, setGameOver] = useState<boolean>(false);
    // Cells currently mid turn-over animation, mapped to their ripple delay (ms).
    const [flippingCells, setFlippingCells] = useState<Map<string, number>>(new Map());
    const [isFlipping, setIsFlipping] = useState<boolean>(false);
    const flipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    function initializeBoard(): Board {
        const newBoard: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

        newBoard[3][3] = 'white';
        newBoard[3][4] = 'black';
        newBoard[4][3] = 'black';
        newBoard[4][4] = 'white';

        return newBoard;
    }

    const getFlippedPieces = useCallback((currentBoard: Board, r: number, c: number, player: Player): Position[] => {
        if (currentBoard[r][c] !== null) {
            return [];
        }

        const opponent = player === 'black' ? 'white' : 'black';
        const flippedPieces: Position[] = [];

        const directions = [
            [-1, -1], [-1, 0], [-1, 1], // Top-left, Top, Top-right
            [0, -1], /* Current */ [0, 1],   // Left, Right
            [1, -1], [1, 0], [1, 1]    // Bottom-left, Bottom, Bottom-right
        ];

        for (const [dr, dc] of directions) {
            let x = r + dr;
            let y = c + dc;
            const currentDirectionFlipped: Position[] = [];

            while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
                const currentCell = currentBoard[x][y];

                if (currentCell === null) {
                    break;
                } else if (currentCell === opponent) {
                    currentDirectionFlipped.push([x, y]);
                } else { 
                    if (currentDirectionFlipped.length > 0) {
                        flippedPieces.push(...currentDirectionFlipped);
                    }
                    break;
                }

                x += dr;
                y += dc;
            }
        }
        return flippedPieces;
    }, []);

    const getAllValidMoves = useCallback((player: Player, currentBoard: Board): Position[] => {
        const moves: Position[] = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (currentBoard[r][c] === null) {
                    const flipped = getFlippedPieces(currentBoard, r, c, player);
                    if (flipped.length > 0) {
                        moves.push([r, c]);
                    }
                }
            }
        }
        return moves;
    }, [getFlippedPieces]);

    const calculateScore = useCallback((): { black: number; white: number } => {
        let black = 0;
        let white = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === 'black') {
                    black++;
                } else if (board[r][c] === 'white') {
                    white++;
                }
            }
        }
        return { black, white };
    }, [board]); // Depends on the current board state

    const checkGameOver = useCallback((): boolean => {
        const blackMoves = getAllValidMoves('black', board);
        const whiteMoves = getAllValidMoves('white', board);

        return blackMoves.length === 0 && whiteMoves.length === 0;
    }, [board, getAllValidMoves]); // Depends on board and getAllValidMoves

    useEffect(() => {
        if (gameOver) {
            return; // If game is already over, do nothing
        }

        const currentMoves = getAllValidMoves(currentPlayer, board);
        setValidMoves(currentMoves);

        // --- START OF MODIFIED LOGIC ---
        // Calculate score immediately before checking game over to get the very latest count
        const currentCalculatedScore = calculateScore();
        setScore(currentCalculatedScore); // Ensure the score state is always up-to-date with the board

        // Check if game is truly over (no moves for either player)
        if (checkGameOver()) {
            setGameOver(true);
            // Use the already calculated final score
            let winnerMessage = '';
            if (currentCalculatedScore.black > currentCalculatedScore.white) {
                winnerMessage = 'Black wins!';
            } else if (currentCalculatedScore.white > currentCalculatedScore.black) {
                winnerMessage = 'White wins!';
            } else {
                winnerMessage = 'It\'s a draw!';
            }
            setGameStatus(`Game Over! ${winnerMessage} Final Score: Black ${currentCalculatedScore.black} - White ${currentCalculatedScore.white}`);
            return;
        }

        // If current player has no moves, automatically pass the turn
        if (currentMoves.length === 0) {
            const nextPlayer = currentPlayer === 'black' ? 'white' : 'black';
            const nextPlayerMoves = getAllValidMoves(nextPlayer, board);

            if (nextPlayerMoves.length > 0) {
                // Only current player has no moves, pass turn
                setGameStatus(`${currentPlayer}'s turn. No valid moves. Passing turn to ${nextPlayer}...`);
                setTimeout(() => {
                    setCurrentPlayer(nextPlayer);
                    setGameStatus(`${nextPlayer}'s turn`); // Update status for the next player
                }, 1500); // Delay to show "passing turn" message
            } else {
                // Neither player has moves, game is over (this path is a fallback, main check is above)
                setGameOver(true);
                // Use the already calculated final score
                let winnerMessage = '';
                if (currentCalculatedScore.black > currentCalculatedScore.white) {
                    winnerMessage = 'Black wins!';
                } else if (currentCalculatedScore.white > currentCalculatedScore.black) {
                    winnerMessage = 'White wins!';
                } else {
                    winnerMessage = 'It\'s a draw!';
                }
                setGameStatus(`Game Over! ${winnerMessage} Final Score: Black ${currentCalculatedScore.black} - White ${currentCalculatedScore.white}`);
            }
        } else {
            setGameStatus(`${currentPlayer}'s turn.`);
        }
        // --- END OF MODIFIED LOGIC ---

        // Removed setScore(calculateScore()) from here, as it's now updated at the start of the effect.
    }, [board, currentPlayer, getAllValidMoves, checkGameOver, calculateScore, gameOver]);


    const handleCellClick = (row: number, col: number) => {
        if (gameOver || isFlipping || board[row][col] !== null) {
            return; // Do nothing if game is over, pieces are still turning over, or the cell is occupied
        }

        const isValid = validMoves.some(move => move[0] === row && move[1] === col);

        if (isValid) {
            makeMove(row, col);
        } else {
            setGameStatus(`Invalid move for ${currentPlayer}. Please select a highlighted square.`);
            setTimeout(() => {
                setGameStatus(`${currentPlayer}'s turn.`);
            }, 1500);
        }
    };

    const makeMove = (row: number, col: number) => {
        const newBoard = board.map(r => [...r]);
        const piecesToFlip = getFlippedPieces(newBoard, row, col, currentPlayer);

        if (piecesToFlip.length === 0) {
            console.warn("Attempted to make a move with no pieces to flip. This shouldn't happen.");
            return;
        }

        newBoard[row][col] = currentPlayer;

        piecesToFlip.forEach(([r, c]) => {
            newBoard[r][c] = currentPlayer;
        });

        // Placing the new disc reuses the existing "drop" tick sound; each
        // flipped piece ripples outward from it and gets its own tick timed
        // to when its turn-over animation actually happens.
        playDiceSound();
        const delays = new Map<string, number>();
        let maxDelay = 0;
        piecesToFlip.forEach(([r, c]) => {
            const distance = Math.max(Math.abs(r - row), Math.abs(c - col));
            const delay = distance * FLIP_STAGGER_MS;
            delays.set(`${r},${c}`, delay);
            maxDelay = Math.max(maxDelay, delay);
            setTimeout(() => playStepSound(), delay);
        });
        setFlippingCells(delays);
        setIsFlipping(true);

        setBoard(newBoard);

        const nextPlayer = currentPlayer === 'black' ? 'white' : 'black';
        setCurrentPlayer(nextPlayer);

        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
            setFlippingCells(new Map());
            setIsFlipping(false);
        }, maxDelay + FLIP_DURATION_MS);
    };

    useEffect(() => {
        return () => {
            if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        };
    }, []);

    const startNewGame = () => {
        setBoard(initializeBoard());
        setCurrentPlayer('black');
        setGameStatus('Black player\'s turn');
        setScore({ black: 2, white: 2 });
        setValidMoves([]);
        setGameOver(false);
        setFlippingCells(new Map());
        setIsFlipping(false);
        if (flipTimeoutRef.current) {
            clearTimeout(flipTimeoutRef.current);
            flipTimeoutRef.current = null;
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 font-inter">
            <BackButton variant='floating' />
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Othello</h1>

            <div className="mb-4 text-xl font-semibold text-gray-700">
                {gameStatus}
            </div>

            <div className="flex justify-around w-full max-w-md mb-6">
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-black border-2 border-gray-400 mb-1"></div>
                    <span className="text-lg font-medium text-gray-800">Black: {score.black}</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-400 mb-1"></div>
                    <span className="text-lg font-medium text-gray-800">White: {score.white}</span>
                </div>
            </div>

            <div className="grid grid-cols-8 border-4 border-gray-800 shadow-xl rounded-lg overflow-hidden">
                {board.map((row, rowIndex) => (
                    row.map((piece, colIndex) => {
                        const isDarkSquare = (rowIndex + colIndex) % 2 === 0;
                        const isMovable = !isFlipping && validMoves.some(move => move[0] === rowIndex && move[1] === colIndex);

                        return (
                            <div
                                key={`${rowIndex}-${colIndex}`}
                                className={`
                                    relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16
                                    flex items-center justify-center
                                    ${isDarkSquare ? 'bg-green-700' : 'bg-green-600'}
                                    ${isMovable && !gameOver ? 'cursor-pointer' : ''}
                                `}
                                onClick={() => handleCellClick(rowIndex, colIndex)}
                            >
                                {piece && (() => {
                                    const flipDelay = flippingCells.get(`${rowIndex},${colIndex}`);
                                    if (flipDelay === undefined) {
                                        return (
                                            <div className={`
                                                w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-400
                                                ${piece === 'black' ? 'bg-black' : 'bg-white'}
                                                transition-transform duration-300 ease-out
                                                ${gameOver ? '' : 'hover:scale-110'}
                                            `}></div>
                                        );
                                    }

                                    // Mid-flip: the piece just turned from the opposite color to
                                    // this one, so animate a 3D turn-over revealing the new face.
                                    const previousPiece: Player = piece === 'black' ? 'white' : 'black';
                                    return (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12" style={{ perspective: '300px' }}>
                                            <div className="othello-flip-inner" style={{ animationDelay: `${flipDelay}ms` }}>
                                                <div className={`othello-flip-face border-2 border-gray-400 ${previousPiece === 'black' ? 'bg-black' : 'bg-white'}`}></div>
                                                <div className={`othello-flip-face othello-flip-face-back border-2 border-gray-400 ${piece === 'black' ? 'bg-black' : 'bg-white'}`}></div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                {isMovable && !gameOver && (
                                    <div className="absolute w-4 h-4 rounded-full bg-blue-300/50"></div>
                                )}
                            </div>
                        );
                    })
                ))}
            </div>

            <div className="mt-8 flex space-x-4">
                <button
                    onClick={startNewGame}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 ease-in-out transform hover:scale-105"
                >
                    New Game
                </button>
            </div>
        </div>
    );
}