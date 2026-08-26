'use client'
import BackButton from '@/app/components/BackButton';
import { useState, useMemo } from 'react';
import { playStepSound, playDiceSound } from '@/lib/sound';

type Player = 1 | 2;
type Orientation = 'h' | 'v';
interface Pos { row: number; col: number; }
interface Snapshot {
    pawns: Record<Player, Pos>;
    wallsH: string[];
    wallsV: string[];
    wallsRemaining: Record<Player, number>;
    currentPlayer: Player;
}

const BOARD_SIZE = 9;
const TOTAL_WALLS = 10;
const CELL = 44;
const GAP = 8;
const STEP = CELL + GAP;
const BOARD_PX = BOARD_SIZE * CELL + (BOARD_SIZE - 1) * GAP;
const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const GOAL_ROWS: Record<Player, number> = { 1: 0, 2: 8 };
const START_POS: Record<Player, Pos> = { 1: { row: 8, col: 4 }, 2: { row: 0, col: 4 } };
const PLAYER_META: Record<Player, { label: string; text: string; pawn: string; ring: string }> = {
    1: { label: 'Player 1', text: 'text-red-500', pawn: 'bg-red-500 border-red-700', ring: 'border-yellow-400' },
    2: { label: 'Player 2', text: 'text-blue-500', pawn: 'bg-blue-500 border-blue-700', ring: 'border-yellow-400' },
};

function key(r: number, c: number): string {
    return `${r}-${c}`;
}

function inBounds(r: number, c: number): boolean {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

// Whether a pawn can step directly from `from` to an orthogonally adjacent `to`,
// i.e. no wall sits across that edge. Ignores whether `to` is occupied.
function canStep(from: Pos, to: Pos, wallsH: Set<string>, wallsV: Set<string>): boolean {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    if (dr === 0 && dc === 1) {
        return !wallsV.has(key(from.row - 1, from.col)) && !wallsV.has(key(from.row, from.col));
    }
    if (dr === 0 && dc === -1) {
        const c = from.col - 1;
        return !wallsV.has(key(from.row - 1, c)) && !wallsV.has(key(from.row, c));
    }
    if (dc === 0 && dr === 1) {
        return !wallsH.has(key(from.row, from.col - 1)) && !wallsH.has(key(from.row, from.col));
    }
    if (dc === 0 && dr === -1) {
        const r = from.row - 1;
        return !wallsH.has(key(r, from.col - 1)) && !wallsH.has(key(r, from.col));
    }
    return false;
}

function getValidMoves(pos: Pos, oppPos: Pos, wallsH: Set<string>, wallsV: Set<string>): Pos[] {
    const moves: Pos[] = [];
    for (const [dr, dc] of DIRS) {
        const next = { row: pos.row + dr, col: pos.col + dc };
        if (!inBounds(next.row, next.col) || !canStep(pos, next, wallsH, wallsV)) continue;

        if (next.row === oppPos.row && next.col === oppPos.col) {
            const jump = { row: next.row + dr, col: next.col + dc };
            if (inBounds(jump.row, jump.col) && canStep(next, jump, wallsH, wallsV)) {
                moves.push(jump);
            } else {
                const perp: [number, number][] = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
                for (const [pdr, pdc] of perp) {
                    const diag = { row: next.row + pdr, col: next.col + pdc };
                    if (inBounds(diag.row, diag.col) && canStep(next, diag, wallsH, wallsV)) {
                        moves.push(diag);
                    }
                }
            }
        } else {
            moves.push(next);
        }
    }
    return moves;
}

function hasPath(start: Pos, goalRow: number, wallsH: Set<string>, wallsV: Set<string>): boolean {
    const visited = new Set<string>([key(start.row, start.col)]);
    const queue: Pos[] = [start];
    for (let i = 0; i < queue.length; i++) {
        const cur = queue[i];
        if (cur.row === goalRow) return true;
        for (const [dr, dc] of DIRS) {
            const next = { row: cur.row + dr, col: cur.col + dc };
            if (!inBounds(next.row, next.col)) continue;
            const k = key(next.row, next.col);
            if (visited.has(k) || !canStep(cur, next, wallsH, wallsV)) continue;
            visited.add(k);
            queue.push(next);
        }
    }
    return false;
}

function isWallSlotFree(orientation: Orientation, r: number, c: number, wallsH: Set<string>, wallsV: Set<string>): boolean {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    if (orientation === 'h') {
        if (wallsH.has(key(r, c)) || wallsV.has(key(r, c))) return false;
        if (c > 0 && wallsH.has(key(r, c - 1))) return false;
        if (c < 7 && wallsH.has(key(r, c + 1))) return false;
    } else {
        if (wallsV.has(key(r, c)) || wallsH.has(key(r, c))) return false;
        if (r > 0 && wallsV.has(key(r - 1, c))) return false;
        if (r < 7 && wallsV.has(key(r + 1, c))) return false;
    }
    return true;
}

function canPlaceWall(
    orientation: Orientation, r: number, c: number,
    wallsH: Set<string>, wallsV: Set<string>,
    pawns: Record<Player, Pos>
): boolean {
    if (!isWallSlotFree(orientation, r, c, wallsH, wallsV)) return false;
    const newH = new Set(wallsH);
    const newV = new Set(wallsV);
    if (orientation === 'h') newH.add(key(r, c)); else newV.add(key(r, c));
    return hasPath(pawns[1], GOAL_ROWS[1], newH, newV) && hasPath(pawns[2], GOAL_ROWS[2], newH, newV);
}

export default function QuoridorGame() {
    const [pawns, setPawns] = useState<Record<Player, Pos>>({ 1: { ...START_POS[1] }, 2: { ...START_POS[2] } });
    const [wallsH, setWallsH] = useState<Set<string>>(new Set());
    const [wallsV, setWallsV] = useState<Set<string>>(new Set());
    const [wallsRemaining, setWallsRemaining] = useState<Record<Player, number>>({ 1: TOTAL_WALLS, 2: TOTAL_WALLS });
    const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
    const [winner, setWinner] = useState<Player | null>(null);
    const [history, setHistory] = useState<Snapshot[]>([]);
    const [hoverWall, setHoverWall] = useState<{ orientation: Orientation; r: number; c: number } | null>(null);

    const opponent: Player = currentPlayer === 1 ? 2 : 1;

    const validMoves = useMemo(() => {
        if (winner) return [];
        return getValidMoves(pawns[currentPlayer], pawns[opponent], wallsH, wallsV);
    }, [pawns, currentPlayer, opponent, wallsH, wallsV, winner]);

    function pushHistory() {
        setHistory(h => [...h, {
            pawns: { 1: { ...pawns[1] }, 2: { ...pawns[2] } },
            wallsH: Array.from(wallsH),
            wallsV: Array.from(wallsV),
            wallsRemaining: { ...wallsRemaining },
            currentPlayer,
        }]);
    }

    function handleCellClick(r: number, c: number) {
        if (winner || !validMoves.some(m => m.row === r && m.col === c)) return;

        pushHistory();
        playStepSound();
        setPawns(prev => ({ ...prev, [currentPlayer]: { row: r, col: c } }));

        if (r === GOAL_ROWS[currentPlayer]) {
            setWinner(currentPlayer);
        } else {
            setCurrentPlayer(opponent);
        }
    }

    function handleWallClick(orientation: Orientation, r: number, c: number) {
        if (winner || wallsRemaining[currentPlayer] <= 0) return;
        if (!canPlaceWall(orientation, r, c, wallsH, wallsV, pawns)) return;

        pushHistory();
        playDiceSound();
        if (orientation === 'h') {
            setWallsH(prev => new Set(prev).add(key(r, c)));
        } else {
            setWallsV(prev => new Set(prev).add(key(r, c)));
        }
        setWallsRemaining(prev => ({ ...prev, [currentPlayer]: prev[currentPlayer] - 1 }));
        setCurrentPlayer(opponent);
    }

    function undo() {
        if (history.length === 0) return;
        const last = history[history.length - 1];
        setPawns(last.pawns);
        setWallsH(new Set(last.wallsH));
        setWallsV(new Set(last.wallsV));
        setWallsRemaining(last.wallsRemaining);
        setCurrentPlayer(last.currentPlayer);
        setWinner(null);
        setHistory(h => h.slice(0, -1));
    }

    function newGame() {
        setPawns({ 1: { ...START_POS[1] }, 2: { ...START_POS[2] } });
        setWallsH(new Set());
        setWallsV(new Set());
        setWallsRemaining({ 1: TOTAL_WALLS, 2: TOTAL_WALLS });
        setCurrentPlayer(1);
        setWinner(null);
        setHistory([]);
    }

    return (
        <div className="min-h-[100vh] flex flex-col items-center p-10 bg-gray-100">
            <BackButton variant="floating" />
            <h1 className="text-2xl font-bold mb-2">Quoridor</h1>
            <div className={`mb-1 text-lg font-semibold ${winner ? PLAYER_META[winner].text : PLAYER_META[currentPlayer].text}`}>
                {winner ? `${PLAYER_META[winner].label} wins!` : `${PLAYER_META[currentPlayer].label}'s turn`}
            </div>
            <div className="flex gap-6 mb-4 text-sm text-gray-700">
                <span className={currentPlayer === 1 && !winner ? 'font-bold text-red-500' : ''}>Player 1 walls: {wallsRemaining[1]}</span>
                <span className={currentPlayer === 2 && !winner ? 'font-bold text-blue-500' : ''}>Player 2 walls: {wallsRemaining[2]}</span>
            </div>

            <div className="relative bg-amber-100 border-2 border-gray-800 shadow-lg/30" style={{ width: BOARD_PX, height: BOARD_PX }}>
                {Array.from({ length: BOARD_SIZE }).map((_, r) =>
                    Array.from({ length: BOARD_SIZE }).map((_, c) => {
                        const isMove = validMoves.some(m => m.row === r && m.col === c);
                        return (
                            <div
                                key={`cell-${r}-${c}`}
                                className={`absolute rounded-sm ${(r + c) % 2 === 0 ? 'bg-amber-50' : 'bg-amber-200'} ${isMove ? 'ring-4 ring-green-400 cursor-pointer' : ''}`}
                                style={{ left: c * STEP, top: r * STEP, width: CELL, height: CELL }}
                                onClick={() => handleCellClick(r, c)}
                            >
                                {(pawns[1].row === r && pawns[1].col === c) || (pawns[2].row === r && pawns[2].col === c) ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {(() => {
                                            const p: Player = pawns[1].row === r && pawns[1].col === c ? 1 : 2;
                                            const isActive = currentPlayer === p && !winner;
                                            return (
                                                <div className={`w-8 h-8 rounded-full border-2 ${PLAYER_META[p].pawn} ${isActive ? PLAYER_META[p].ring : ''}`} />
                                            );
                                        })()}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })
                )}

                {Array.from({ length: 8 }).map((_, r) =>
                    Array.from({ length: 8 }).map((_, c) => {
                        const placed = wallsH.has(key(r, c));
                        const isHover = hoverWall?.orientation === 'h' && hoverWall.r === r && hoverWall.c === c;
                        const legal = !placed && !winner && wallsRemaining[currentPlayer] > 0 && canPlaceWall('h', r, c, wallsH, wallsV, pawns);
                        return (
                            <div
                                key={`h-${r}-${c}`}
                                className={`absolute rounded-sm transition-colors ${placed ? 'bg-yellow-800' : isHover ? (legal ? 'bg-green-400' : 'bg-red-400') : 'bg-transparent hover:bg-gray-400/40'}`}
                                style={{ left: c * STEP, top: r * STEP + CELL, width: 2 * CELL + GAP, height: GAP, cursor: placed ? 'default' : legal ? 'pointer' : 'not-allowed' }}
                                onMouseEnter={() => setHoverWall({ orientation: 'h', r, c })}
                                onMouseLeave={() => setHoverWall(null)}
                                onClick={() => legal && handleWallClick('h', r, c)}
                            />
                        );
                    })
                )}

                {Array.from({ length: 8 }).map((_, r) =>
                    Array.from({ length: 8 }).map((_, c) => {
                        const placed = wallsV.has(key(r, c));
                        const isHover = hoverWall?.orientation === 'v' && hoverWall.r === r && hoverWall.c === c;
                        const legal = !placed && !winner && wallsRemaining[currentPlayer] > 0 && canPlaceWall('v', r, c, wallsH, wallsV, pawns);
                        return (
                            <div
                                key={`v-${r}-${c}`}
                                className={`absolute rounded-sm transition-colors ${placed ? 'bg-yellow-800' : isHover ? (legal ? 'bg-green-400' : 'bg-red-400') : 'bg-transparent hover:bg-gray-400/40'}`}
                                style={{ left: c * STEP + CELL, top: r * STEP, width: GAP, height: 2 * CELL + GAP, cursor: placed ? 'default' : legal ? 'pointer' : 'not-allowed' }}
                                onMouseEnter={() => setHoverWall({ orientation: 'v', r, c })}
                                onMouseLeave={() => setHoverWall(null)}
                                onClick={() => legal && handleWallClick('v', r, c)}
                            />
                        );
                    })
                )}
            </div>

            <div className="flex gap-4 mt-4">
                <button
                    onClick={undo}
                    disabled={history.length === 0}
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

            <p className="mt-4 max-w-md text-center text-sm text-gray-600">
                Click a highlighted square to move your pawn, or click a gap between cells to place a wall.
                Reach the opposite edge of the board to win — but a wall can never fully block either player&apos;s path.
            </p>
        </div>
    );
}
