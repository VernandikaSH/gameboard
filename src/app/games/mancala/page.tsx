'use client'
import BackButton from '@/app/components/BackButton';
import { useRef, useState } from 'react';
import { playStepSound, playLadderSound } from '@/lib/sound';

// Board is a circular array of 14 slots in sowing order:
// 0-5   Player 1 pits
// 6     Player 1 store
// 7-12  Player 2 pits
// 13    Player 2 store
const STARTING_STONES = 4;
const P1_PITS = [0, 1, 2, 3, 4, 5];
const P2_PITS = [7, 8, 9, 10, 11, 12];
const P1_STORE = 6;
const P2_STORE = 13;

const FLIGHT_MS = 170;
const GOLDEN_ANGLE = 137.50776;
// [fill, shadow] pairs so each bead reads as a small glossy marble.
const BEAD_COLORS: [string, string][] = [
    ['#ef4444', '#7f1d1d'],
    ['#3b82f6', '#1e3a8a'],
    ['#22c55e', '#14532d'],
    ['#eab308', '#713f12'],
    ['#a855f7', '#4c1d95'],
    ['#f97316', '#7c2d12'],
    ['#06b6d4', '#164e63'],
    ['#ec4899', '#831843'],
];

type Player = 1 | 2;
type Winner = Player | 'tie' | null;
interface TravelingBead {
    x: number;
    y: number;
    colorIdx: number;
}

function initialBoard(): number[] {
    const board = Array(14).fill(0);
    for (const i of [...P1_PITS, ...P2_PITS]) board[i] = STARTING_STONES;
    return board;
}

function opposite(i: number): number {
    return 12 - i;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Scatters `count` beads inside an ellipse using a phyllotaxis (sunflower)
// spiral, so piles look organic and packed rather than gridded, and stay
// stable (a bead never jumps position) as more stones are added.
function BeadPile({ count, size, elliptical }: { count: number; size: number; elliptical?: boolean }) {
    if (count <= 0) return null;
    const beadSize = count <= 6 ? 15 : count <= 12 ? 12 : count <= 20 ? 10 : 8;
    const rx = (elliptical ? size * 0.32 : size / 2) - beadSize / 2 - 2;
    const ry = (elliptical ? size * 0.62 : size / 2) - beadSize / 2 - 2;
    return (
        <>
            {Array.from({ length: count }).map((_, i) => {
                const r = Math.sqrt((i + 0.5) / count);
                const theta = (i * GOLDEN_ANGLE * Math.PI) / 180;
                const x = r * rx * Math.cos(theta);
                const y = r * ry * Math.sin(theta);
                const [fill, shadow] = BEAD_COLORS[i % BEAD_COLORS.length];
                return (
                    <div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: beadSize,
                            height: beadSize,
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: 'translate(-50%, -50%)',
                            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), ${fill} 55%, ${shadow} 100%)`,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                        }}
                    />
                );
            })}
        </>
    );
}

export default function MancalaGame() {
    const [board, setBoard] = useState<number[]>(initialBoard());
    const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<Winner>(null);
    const [message, setMessage] = useState("Player 1's turn");
    const [isAnimating, setIsAnimating] = useState(false);
    const [history, setHistory] = useState<{ board: number[]; currentPlayer: Player }[]>([]);
    const [travelingBead, setTravelingBead] = useState<TravelingBead | null>(null);
    const [flashPits, setFlashPits] = useState<number[]>([]);

    const boardRef = useRef<HTMLDivElement>(null);
    const slotRefs = useRef<Map<number, HTMLElement>>(new Map());

    function isOwnPit(i: number, player: Player): boolean {
        return player === 1 ? P1_PITS.includes(i) : P2_PITS.includes(i);
    }

    function registerSlot(index: number) {
        return (el: HTMLElement | null) => {
            if (el) slotRefs.current.set(index, el);
            else slotRefs.current.delete(index);
        };
    }

    // Flies a single bead from `fromIdx` to `toIdx` across the board overlay,
    // landing at the moment the pile at `toIdx` actually grows.
    async function flyBead(fromIdx: number, toIdx: number, colorIdx: number) {
        const boardEl = boardRef.current;
        const fromEl = slotRefs.current.get(fromIdx);
        const toEl = slotRefs.current.get(toIdx);
        if (!boardEl || !fromEl || !toEl) return;

        const boardRect = boardEl.getBoundingClientRect();
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const fx = fromRect.left + fromRect.width / 2 - boardRect.left;
        const fy = fromRect.top + fromRect.height / 2 - boardRect.top;
        const tx = toRect.left + toRect.width / 2 - boardRect.left;
        const ty = toRect.top + toRect.height / 2 - boardRect.top;

        setTravelingBead({ x: fx, y: fy, colorIdx });
        await sleep(16); // let the start position paint before transitioning
        setTravelingBead(b => (b ? { ...b, x: tx, y: ty } : b));
        await sleep(FLIGHT_MS);
    }

    async function sowFrom(startIdx: number) {
        if (gameOver || isAnimating) return;
        const player = currentPlayer;
        if (!isOwnPit(startIdx, player) || board[startIdx] === 0) return;

        setHistory(h => [...h, { board: [...board], currentPlayer }]);
        setIsAnimating(true);

        const working = [...board];
        const stones = working[startIdx];
        working[startIdx] = 0;
        setBoard([...working]);

        const opponentStore = player === 1 ? P2_STORE : P1_STORE;
        const settleMs = stones > 15 ? 20 : stones > 8 ? 60 : 110;
        let idx = startIdx;
        for (let s = 0; s < stones; s++) {
            idx = (idx + 1) % 14;
            if (idx === opponentStore) idx = (idx + 1) % 14;
            const colorIdx = working[idx];
            await flyBead(startIdx, idx, colorIdx);
            working[idx] += 1;
            setBoard([...working]);
            setTravelingBead(null);
            playStepSound();
            await sleep(settleMs);
        }

        const ownRow = player === 1 ? P1_PITS : P2_PITS;
        const ownStore = player === 1 ? P1_STORE : P2_STORE;
        let statusMsg = '';
        const extraTurn = idx === ownStore;

        if (!extraTurn && ownRow.includes(idx) && working[idx] === 1) {
            const opp = opposite(idx);
            if (working[opp] > 0) {
                const captured = working[idx] + working[opp];
                working[idx] = 0;
                working[opp] = 0;
                working[ownStore] += captured;
                setBoard([...working]);
                playLadderSound();
                statusMsg = `Player ${player} captured ${captured} stones! `;
                setFlashPits([idx, opp]);
                setTimeout(() => setFlashPits([]), 700);
            }
        }

        const p1Empty = P1_PITS.every(i => working[i] === 0);
        const p2Empty = P2_PITS.every(i => working[i] === 0);

        if (p1Empty || p2Empty) {
            if (p1Empty && !p2Empty) {
                const sum = P2_PITS.reduce((a, i) => a + working[i], 0);
                for (const i of P2_PITS) working[i] = 0;
                working[P2_STORE] += sum;
            } else if (p2Empty && !p1Empty) {
                const sum = P1_PITS.reduce((a, i) => a + working[i], 0);
                for (const i of P1_PITS) working[i] = 0;
                working[P1_STORE] += sum;
            }
            setBoard([...working]);
            const p1Total = working[P1_STORE];
            const p2Total = working[P2_STORE];
            const finalWinner: Winner = p1Total === p2Total ? 'tie' : p1Total > p2Total ? 1 : 2;
            setWinner(finalWinner);
            setGameOver(true);
            setMessage(
                finalWinner === 'tie'
                    ? `It's a tie, ${p1Total} stones each!`
                    : `Player ${finalWinner} wins with ${finalWinner === 1 ? p1Total : p2Total} stones!`
            );
            playLadderSound();
        } else if (extraTurn) {
            setMessage(`Player ${player} landed in their store - go again!`);
        } else {
            const nextPlayer: Player = player === 1 ? 2 : 1;
            setCurrentPlayer(nextPlayer);
            setMessage(`${statusMsg}Player ${nextPlayer}'s turn`);
        }

        setIsAnimating(false);
    }

    function undo() {
        if (history.length === 0 || isAnimating) return;
        const last = history[history.length - 1];
        setBoard(last.board);
        setCurrentPlayer(last.currentPlayer);
        setGameOver(false);
        setWinner(null);
        setMessage(`Player ${last.currentPlayer}'s turn`);
        setHistory(h => h.slice(0, -1));
    }

    function newGame() {
        setBoard(initialBoard());
        setCurrentPlayer(1);
        setGameOver(false);
        setWinner(null);
        setMessage("Player 1's turn");
        setIsAnimating(false);
        setHistory([]);
        setTravelingBead(null);
        setFlashPits([]);
    }

    function Pit({ index }: { index: number }) {
        const stones = board[index];
        const clickable = !gameOver && !isAnimating && isOwnPit(index, currentPlayer) && stones > 0;
        const flashing = flashPits.includes(index);
        return (
            <button
                ref={registerSlot(index)}
                onClick={() => sowFrom(index)}
                disabled={!clickable}
                className={`relative w-16 h-16 rounded-full border-2 overflow-hidden transition-shadow
                    ${isOwnPit(index, 1) ? 'border-amber-800' : 'border-orange-800'}
                    ${clickable ? 'hover:ring-4 hover:ring-green-400 cursor-pointer' : 'cursor-default'}
                    ${flashing ? 'ring-4 ring-yellow-300' : ''}
                `}
                style={{
                    background: isOwnPit(index, 1)
                        ? 'radial-gradient(circle at 50% 35%, #a97a4a, #7a4d22 75%, #5c3714 100%)'
                        : 'radial-gradient(circle at 50% 35%, #c98a52, #8a4f1e 75%, #642f0e 100%)',
                    boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5)',
                }}
            >
                <BeadPile count={stones} size={64} />
                <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white/90 bg-black/30 rounded px-1 leading-tight">
                    {stones}
                </span>
            </button>
        );
    }

    function Store({ index, label, player }: { index: number; label: string; player: Player }) {
        const isWinner = gameOver && winner === player;
        const count = board[index];
        return (
            <div
                ref={registerSlot(index)}
                className={`relative w-20 h-40 rounded-3xl border-4 flex flex-col items-center justify-center text-white shadow-lg transition-colors overflow-hidden
                    ${isWinner ? 'border-green-400 ring-4 ring-green-300' : 'border-amber-950'}`}
                style={{ background: 'radial-gradient(circle at 50% 30%, #7a4d22, #4a2c11 80%)' }}
            >
                <BeadPile count={Math.min(count, 24)} size={76} elliptical />
                <div className="relative z-10 flex flex-col items-center bg-black/30 rounded-lg px-2 py-1">
                    <span className="text-xs opacity-80">{label}</span>
                    <span className="text-2xl font-bold">{count}</span>
                </div>
                {isWinner && <span className="relative z-10 text-xs mt-1">🏆</span>}
            </div>
        );
    }

    return (
        <div className="min-h-[100vh] flex flex-col items-center p-10 bg-gray-100">
            <BackButton variant="floating" />
            <h1 className="text-2xl font-bold mb-2">Mancala</h1>
            <div className={`mb-4 text-lg font-semibold text-center max-w-md ${currentPlayer === 1 ? 'text-amber-700' : 'text-orange-700'}`}>
                {message}
            </div>

            <div ref={boardRef} className="relative flex items-stretch gap-3 p-4 rounded-xl bg-amber-700 border-4 border-amber-950 shadow-lg">
                <Store index={P2_STORE} label="Player 2" player={2} />

                <div className="grid grid-cols-6 gap-3">
                    {[...P2_PITS].reverse().map(i => (
                        <Pit key={i} index={i} />
                    ))}
                    {P1_PITS.map(i => (
                        <Pit key={i} index={i} />
                    ))}
                </div>

                <Store index={P1_STORE} label="Player 1" player={1} />

                {travelingBead && (
                    <div
                        className="absolute rounded-full pointer-events-none z-50"
                        style={{
                            width: 16,
                            height: 16,
                            left: travelingBead.x,
                            top: travelingBead.y,
                            transform: 'translate(-50%, -50%)',
                            transition: `left ${FLIGHT_MS}ms linear, top ${FLIGHT_MS}ms linear`,
                            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), ${BEAD_COLORS[travelingBead.colorIdx % BEAD_COLORS.length][0]} 55%, ${BEAD_COLORS[travelingBead.colorIdx % BEAD_COLORS.length][1]} 100%)`,
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                        }}
                    />
                )}
            </div>

            <div className="flex gap-4 mt-6">
                <button
                    onClick={undo}
                    disabled={history.length === 0 || isAnimating}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
                >
                    Undo
                </button>
                <button
                    onClick={newGame}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    New Game
                </button>
            </div>

            <p className="mt-6 max-w-md text-center text-sm text-gray-600">
                Pick one of your pits to sow its stones counter-clockwise, one per pit, skipping your opponent&apos;s store.
                Land your last stone in your own store for another turn, or in an empty pit on your side to capture
                everything opposite it. Most stones in your store when a side runs empty wins.
            </p>
        </div>
    );
}
