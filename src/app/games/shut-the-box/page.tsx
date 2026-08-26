'use client'
import BackButton from '@/app/components/BackButton';
import Dice from '@/app/components/Dice';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playStepSound, playDiceSound, playSnakeSound, playLadderSound } from '@/lib/sound';

const NUM_TILES = 12;
const MAX_PLAYERS = 4;
// Keep in sync with the tile-flip animation-duration in globals.css.
const TILE_FLIP_DURATION_MS = 500;

type Phase = 'setup' | 'playing' | 'finished';

// True if some subset of `nums` adds up exactly to `target`.
function hasSubsetSum(nums: number[], target: number): boolean {
    const n = nums.length;
    for (let mask = 1; mask < (1 << n); mask++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) sum += nums[i];
        }
        if (sum === target) return true;
    }
    return false;
}

function openTileNumbers(tilesOpen: boolean[]): number[] {
    return tilesOpen.map((open, i) => (open ? i + 1 : null)).filter((n): n is number => n !== null);
}

export default function ShutTheBoxGame() {
    const [phase, setPhase] = useState<Phase>('setup');
    const [numPlayers, setNumPlayers] = useState(1);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [scores, setScores] = useState<(number | null)[]>([]);
    const [boxShutBy, setBoxShutBy] = useState<number | null>(null);

    const [tilesOpen, setTilesOpen] = useState<boolean[]>(Array(NUM_TILES).fill(true));
    const [dice, setDice] = useState<[number, number] | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [awaitingSelection, setAwaitingSelection] = useState(false);
    const [message, setMessage] = useState('');
    const [flippingTiles, setFlippingTiles] = useState<Set<number>>(new Set());
    const [isAnimating, setIsAnimating] = useState(false);
    const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        };
    }, []);

    const diceSum = dice ? dice[0] + dice[1] : 0;
    const selectedSum = useMemo(
        () => Array.from(selected).reduce((a, b) => a + b, 0),
        [selected]
    );

    function resetTurnState() {
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        setTilesOpen(Array(NUM_TILES).fill(true));
        setDice(null);
        setSelected(new Set());
        setAwaitingSelection(false);
        setFlippingTiles(new Set());
        setIsAnimating(false);
    }

    function startGame(n: number) {
        setNumPlayers(n);
        setScores(Array(n).fill(null));
        setCurrentPlayerIndex(0);
        setBoxShutBy(null);
        resetTurnState();
        setMessage(`Player 1: roll the dice`);
        setPhase('playing');
    }

    function newGame() {
        setPhase('setup');
    }

    function advanceToPlayerOrFinish(nextScores: (number | null)[]) {
        const nextIndex = currentPlayerIndex + 1;
        if (nextIndex < numPlayers) {
            setCurrentPlayerIndex(nextIndex);
            resetTurnState();
            setMessage(`Player ${nextIndex + 1}: roll the dice`);
        } else {
            setScores(nextScores);
            setPhase('finished');
        }
    }

    function rollDice() {
        if (phase !== 'playing' || awaitingSelection || isAnimating) return;

        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        playDiceSound();
        setDice([d1, d2]);
        const sum = d1 + d2;
        const openNums = openTileNumbers(tilesOpen);

        if (!hasSubsetSum(openNums, sum)) {
            const finalScore = openNums.reduce((a, b) => a + b, 0);
            playSnakeSound();
            setMessage(`Player ${currentPlayerIndex + 1} rolled ${sum} — no tiles add up to that. Bust! Score: ${finalScore}`);
            const nextScores = [...scores];
            nextScores[currentPlayerIndex] = finalScore;
            setScores(nextScores);
            setAwaitingSelection(false);
            setTimeout(() => advanceToPlayerOrFinish(nextScores), 1400);
        } else {
            setSelected(new Set());
            setAwaitingSelection(true);
            setMessage(`Rolled ${sum} — select open tiles that add up to ${sum}`);
        }
    }

    function toggleTile(n: number) {
        if (!awaitingSelection || isAnimating || !tilesOpen[n - 1]) return;
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(n)) next.delete(n); else next.add(n);
            return next;
        });
    }

    function confirmShut() {
        if (!awaitingSelection || isAnimating || selectedSum !== diceSum) return;

        playStepSound();
        const shutNumbers = new Set(selected);
        const newTilesOpen = tilesOpen.map((open, i) => (shutNumbers.has(i + 1) ? false : open));
        setTilesOpen(newTilesOpen);
        setFlippingTiles(shutNumbers);
        setIsAnimating(true);
        setSelected(new Set());
        setAwaitingSelection(false);
        setDice(null);

        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
            setFlippingTiles(new Set());
            setIsAnimating(false);
            if (newTilesOpen.every(open => !open)) {
                playLadderSound();
                const nextScores = [...scores];
                nextScores[currentPlayerIndex] = 0;
                setScores(nextScores);
                setBoxShutBy(currentPlayerIndex);
                setMessage(`Player ${currentPlayerIndex + 1} shut the box!`);
                setPhase('finished');
            } else {
                setMessage(`Nice! Roll again.`);
            }
        }, TILE_FLIP_DURATION_MS);
    }

    const bestScore = phase === 'finished' && boxShutBy === null
        ? Math.min(...(scores.filter((s): s is number => s !== null)))
        : null;
    const winners = bestScore !== null ? scores.map((s, i) => (s === bestScore ? i : -1)).filter(i => i >= 0) : [];

    return (
        <div className="min-h-[100vh] flex flex-col items-center p-10 bg-gray-100">
            <BackButton variant="floating" />
            <h1 className="text-2xl font-bold mb-4">Shut the Box</h1>

            {phase === 'setup' && (
                <div className="flex flex-col items-center gap-6 mt-8">
                    <p className="max-w-md text-center text-gray-600">
                        Roll two dice and flip down open tiles whose numbers add up to your roll.
                        Keep rolling until you can&apos;t make a move — your score is the sum of the tiles
                        still open. Lowest score wins, and shutting every tile is an instant win.
                    </p>
                    <div className="flex flex-col gap-3 w-64">
                        {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map(n => (
                            <button
                                key={n}
                                onClick={() => startGame(n)}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg font-medium"
                            >
                                {n} Player{n > 1 ? 's' : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {phase === 'playing' && (
                <>
                    <div className="mb-1 text-lg font-semibold text-blue-600">
                        Player {currentPlayerIndex + 1}&apos;s turn
                    </div>

                    {numPlayers > 1 && (
                        <div className="flex gap-4 mb-4 text-sm text-gray-700">
                            {scores.map((s, i) => (
                                <span key={i} className={i === currentPlayerIndex ? 'font-bold text-blue-600' : ''}>
                                    Player {i + 1}: {s === null ? '—' : s}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-4 mb-4">
                        <Dice value={dice ? dice[0] : 1} onRoll={rollDice} disabled={awaitingSelection || isAnimating || phase !== 'playing'} />
                        <Dice value={dice ? dice[1] : 1} onRoll={rollDice} disabled={awaitingSelection || isAnimating || phase !== 'playing'} />
                    </div>

                    <div className="mb-4 text-center text-gray-700 min-h-6">{message}</div>

                    <div className="p-4 rounded-lg bg-gradient-to-b from-amber-700 to-amber-800 border-4 border-amber-950 shadow-lg mb-4">
                        <div className="flex gap-2">
                            {tilesOpen.map((open, i) => {
                                const n = i + 1;
                                const isSelected = selected.has(n);
                                const isFlipping = flippingTiles.has(n);
                                return (
                                    <div key={n} className="tile-flip-scene w-12 h-16 rounded-md bg-amber-900/60 shadow-inner">
                                        {isFlipping ? (
                                            <div className="tile-flip-inner">
                                                <div className="tile-flip-face bg-white border-2 border-blue-400 text-blue-700 flex items-center justify-center text-xl font-bold">
                                                    {n}
                                                </div>
                                                <div className="tile-flip-face tile-flip-face-back bg-gray-800 border-2 border-gray-900 text-gray-600 flex items-center justify-center text-xl font-bold">
                                                    {n}
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => toggleTile(n)}
                                                disabled={!open || !awaitingSelection || isAnimating}
                                                className={`w-full h-full rounded-md text-xl font-bold border-2 transition-colors ${!open
                                                    ? 'bg-gray-800 border-gray-900 text-gray-600 cursor-default'
                                                    : isSelected
                                                        ? 'bg-green-400 border-green-600 text-white cursor-pointer'
                                                        : awaitingSelection
                                                            ? 'bg-white border-blue-400 text-blue-700 hover:bg-blue-50 cursor-pointer'
                                                            : 'bg-white border-gray-300 text-gray-800 cursor-default'
                                                    }`}
                                            >
                                                {n}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {awaitingSelection && (
                        <div className="flex items-center gap-4 mb-4">
                            <span className={`font-semibold ${selectedSum === diceSum ? 'text-green-600' : selectedSum > diceSum ? 'text-red-500' : 'text-gray-600'}`}>
                                Selected: {selectedSum} / {diceSum}
                            </span>
                            <button
                                onClick={confirmShut}
                                disabled={selectedSum !== diceSum}
                                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                            >
                                Shut Tiles
                            </button>
                        </div>
                    )}

                    <button
                        onClick={newGame}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mt-2"
                    >
                        New Game
                    </button>
                </>
            )}

            {phase === 'finished' && (
                <div className="flex flex-col items-center gap-4 mt-8">
                    {boxShutBy !== null ? (
                        <div className="text-xl font-bold text-green-600">
                            🎉 Player {boxShutBy + 1} shut the box and wins instantly!
                        </div>
                    ) : numPlayers === 1 ? (
                        <div className="text-xl font-bold text-blue-600">
                            {scores[0] === 0 ? "You shut the box!" : `Final score: ${scores[0]}`}
                        </div>
                    ) : (
                        <div className="text-xl font-bold text-blue-600">
                            {winners.length > 1
                                ? `It's a tie between Player ${winners.map(i => i + 1).join(' & ')} with a score of ${bestScore}!`
                                : `Player ${winners[0] + 1} wins with a score of ${bestScore}!`}
                        </div>
                    )}

                    {numPlayers > 1 && (
                        <div className="flex gap-4 text-gray-700">
                            {scores.map((s, i) => (
                                <span key={i} className={winners.includes(i) || boxShutBy === i ? 'font-bold text-green-600' : ''}>
                                    Player {i + 1}: {s === null ? '—' : s}
                                </span>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={newGame}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Play Again
                    </button>
                </div>
            )}
        </div>
    );
}
