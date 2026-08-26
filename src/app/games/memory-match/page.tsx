'use client'
import BackButton from '@/app/components/BackButton';
import { useEffect, useRef, useState } from 'react';
import { playStepSound, playLadderSound, playSnakeSound } from '@/lib/sound';

type Phase = 'setup' | 'preparing' | 'playing' | 'finished';

interface Topic {
    id: string;
    name: string;
    src: string;
}

const TOPICS: Topic[] = [
    { id: 'animal', name: 'Animals', src: '/icons-memory/icons-animal.jpg' },
    { id: 'capital', name: 'Capitals', src: '/icons-memory/icons-capital.jpg' },
    { id: 'fruit-veggie', name: 'Fruits & Veggies', src: '/icons-memory/icons-fruit-veggie.jpg' },
];

const TILE_COUNTS = [10, 20, 32] as const;
const LAYOUTS: Record<number, { cols: number; rows: number }> = {
    10: { cols: 5, rows: 2 },
    20: { cols: 5, rows: 4 },
    32: { cols: 8, rows: 4 },
};
const SHEET_GRID = 4; // each sprite sheet is a 4x4 grid of 16 icons
const CARD_SIZE = 90;
const MISMATCH_DELAY_MS = 900;

interface Tile {
    id: number;
    iconIdx: number;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// The sprite sheets are hand/AI-generated collages: the 4x4 grid isn't
// perfectly uniform, so a naive width/4 crop leaves some icons noticeably
// off-center within their card. To correct for that, each cell is cropped
// with a bit of extra margin, then trimmed to the actual (non-background)
// icon content and re-centered - self-correcting regardless of exactly
// where that cell's true edges fall.
function sampleBackgroundColor(img: HTMLImageElement): [number, number, number] {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, 4, 4, 0, 0, 4, 4);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
}

// Finds the bounding box of every non-background pixel and re-centers the
// crop on it. A flood fill from the center was tried first to avoid picking
// up a sliver of a neighboring tile, but several icons use thin white/cream
// outline strokes that read as "background" and fence the fill into a tiny
// enclosed pocket (e.g. just inside an eye), collapsing the whole icon to a
// blown-up blob. A plain bounding box has no such connectivity requirement,
// so it's paired with a very small crop margin instead to avoid bleed.
function trimToContent(source: HTMLCanvasElement, bg: [number, number, number]): HTMLCanvasElement {
    const w = source.width;
    const h = source.height;
    const ctx = source.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, w, h);
    const [bgR, bgG, bgB] = bg;
    const threshold = 40 * 40;

    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const dr = data[i] - bgR, dg = data[i + 1] - bgG, db = data[i + 2] - bgB;
            if (dr * dr + dg * dg + db * db > threshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return source; // nothing found (shouldn't happen) - fall back as-is

    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;
    const size = Math.max(contentW, contentH) * 1.15; // a little breathing room
    const out = document.createElement('canvas');
    out.width = out.height = Math.ceil(size);
    const octx = out.getContext('2d')!;
    const dx = (out.width - contentW) / 2 - minX;
    const dy = (out.height - contentH) / 2 - minY;
    octx.drawImage(source, dx, dy);
    return out;
}

function sliceSheet(img: HTMLImageElement): string[] {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const cellW = W / SHEET_GRID;
    const cellH = H / SHEET_GRID;
    // Kept small: adjacent tiles in these sheets sit only a few pixels
    // apart, so much more than this would risk pulling a neighboring tile's
    // own color into this icon's bounding box below.
    const pad = Math.min(cellW, cellH) * 0.025;
    const bg = sampleBackgroundColor(img);
    const outSize = 300;
    const icons: string[] = [];

    for (let r = 0; r < SHEET_GRID; r++) {
        for (let c = 0; c < SHEET_GRID; c++) {
            const sx = Math.max(0, c * cellW - pad);
            const sy = Math.max(0, r * cellH - pad);
            const sw = Math.min(cellW + pad * 2, W - sx);
            const sh = Math.min(cellH + pad * 2, H - sy);

            const rough = document.createElement('canvas');
            rough.width = Math.round(sw);
            rough.height = Math.round(sh);
            rough.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, rough.width, rough.height);

            const trimmed = trimToContent(rough, bg);

            const canvas = document.createElement('canvas');
            canvas.width = outSize;
            canvas.height = outSize;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(trimmed, 0, 0, outSize, outSize);
            icons.push(canvas.toDataURL('image/png'));
        }
    }
    return icons;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MemoryMatchGame() {
    const [phase, setPhase] = useState<Phase>('setup');
    const [topic, setTopic] = useState<Topic>(TOPICS[0]);
    const [tileCount, setTileCount] = useState<number>(20);

    const [icons, setIcons] = useState<string[]>([]);
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<Set<number>>(new Set());
    const [locked, setLocked] = useState(false);
    const [moves, setMoves] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    const startTimeRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mismatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mismatchTimeoutRef.current) clearTimeout(mismatchTimeoutRef.current);
        };
    }, []);

    function startGame() {
        setPhase('preparing');
        const img = new Image();
        img.onload = () => {
            const sliced = sliceSheet(img);
            const pairsNeeded = tileCount / 2;
            const chosenIcons = shuffle(Array.from({ length: sliced.length }, (_, i) => i)).slice(0, pairsNeeded);
            const newTiles: Tile[] = shuffle(
                chosenIcons.flatMap(iconIdx => [{ iconIdx }, { iconIdx }])
            ).map((t, id) => ({ id, iconIdx: t.iconIdx }));

            setIcons(sliced);
            setTiles(newTiles);
            setFlipped([]);
            setMatched(new Set());
            setLocked(false);
            setMoves(0);
            setElapsed(0);
            startTimeRef.current = Date.now();
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
            setPhase('playing');
        };
        img.src = topic.src;
    }

    function newGame() {
        if (timerRef.current) clearInterval(timerRef.current);
        if (mismatchTimeoutRef.current) clearTimeout(mismatchTimeoutRef.current);
        setPhase('setup');
    }

    function handleTileClick(idx: number) {
        if (locked || phase !== 'playing' || flipped.includes(idx) || matched.has(idx) || flipped.length >= 2) return;

        playStepSound();
        const nextFlipped = [...flipped, idx];
        setFlipped(nextFlipped);

        if (nextFlipped.length === 2) {
            setMoves(m => m + 1);
            const [a, b] = nextFlipped;
            if (tiles[a].iconIdx === tiles[b].iconIdx) {
                playLadderSound();
                const nextMatched = new Set(matched);
                nextMatched.add(a);
                nextMatched.add(b);
                setMatched(nextMatched);
                setFlipped([]);
                if (nextMatched.size === tiles.length) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setPhase('finished');
                }
            } else {
                setLocked(true);
                playSnakeSound();
                mismatchTimeoutRef.current = setTimeout(() => {
                    setFlipped([]);
                    setLocked(false);
                }, MISMATCH_DELAY_MS);
            }
        }
    }

    const layout = LAYOUTS[tileCount];

    return (
        <div className="min-h-[100vh] flex flex-col items-center p-10 bg-gray-100">
            <BackButton variant="floating" />
            <h1 className="text-2xl font-bold mb-4">Memory Match</h1>

            {phase === 'setup' && (
                <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
                    <div className="w-full">
                        <h2 className="font-semibold text-gray-700 mb-2">1. Choose a topic</h2>
                        <div className="grid grid-cols-3 gap-3">
                            {TOPICS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTopic(t)}
                                    className={`rounded-lg overflow-hidden border-4 transition-colors ${topic.id === t.id ? 'border-blue-500' : 'border-transparent hover:border-blue-200'}`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={t.src} alt={t.name} className="w-full h-24 object-cover bg-white" />
                                    <div className="text-xs text-center py-1 bg-white text-gray-700">{t.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full">
                        <h2 className="font-semibold text-gray-700 mb-2">2. Number of tiles</h2>
                        <div className="flex gap-3">
                            {TILE_COUNTS.map(n => (
                                <button
                                    key={n}
                                    onClick={() => setTileCount(n)}
                                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${tileCount === n ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={startGame}
                        className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
                    >
                        Start Game
                    </button>
                </div>
            )}

            {phase === 'preparing' && (
                <div className="mt-16 text-gray-600">Shuffling tiles...</div>
            )}

            {(phase === 'playing' || phase === 'finished') && (
                <>
                    <div className="flex items-center gap-6 mb-4 text-gray-700">
                        <span className="font-semibold">Moves: {moves}</span>
                        <span>{formatTime(elapsed)}</span>
                        <button onClick={newGame} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                            New Game
                        </button>
                    </div>

                    <div
                        className="grid"
                        style={{
                            gridTemplateColumns: `repeat(${layout.cols}, ${CARD_SIZE}px)`,
                            gap: 10,
                        }}
                    >
                        {tiles.map((tile, idx) => {
                            const faceUp = flipped.includes(idx) || matched.has(idx);
                            const isMatched = matched.has(idx);
                            return (
                                <button
                                    key={tile.id}
                                    onClick={() => handleTileClick(idx)}
                                    style={{ width: CARD_SIZE, height: CARD_SIZE, perspective: 600 }}
                                    className="cursor-pointer"
                                >
                                    <div
                                        style={{
                                            position: 'relative',
                                            width: '100%',
                                            height: '100%',
                                            transformStyle: 'preserve-3d',
                                            transition: 'transform 350ms',
                                            transform: faceUp ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                                            }}
                                        >
                                            <span className="text-white text-2xl font-bold opacity-60">?</span>
                                        </div>
                                        <div
                                            style={{
                                                position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                                transform: 'rotateY(180deg)', borderRadius: 10, overflow: 'hidden',
                                                border: isMatched ? '3px solid #22c55e' : '1px solid #e5e7eb',
                                            }}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={icons[tile.iconIdx]} alt="" className="w-full h-full object-cover" draggable={false} />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'finished' && (
                        <div className="flex flex-col items-center gap-4 mt-8">
                            <div className="text-xl font-bold text-green-600">
                                🎉 Solved in {moves} moves and {formatTime(elapsed)}!
                            </div>
                            <button onClick={newGame} className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                Play Again
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
