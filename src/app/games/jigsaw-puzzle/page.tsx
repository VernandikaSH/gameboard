'use client'
import BackButton from '@/app/components/BackButton';
import { useEffect, useRef, useState } from 'react';
import { playStepSound, playLadderSound } from '@/lib/sound';
import { bestGrid, buildEdgeSpecs, piecePath, EdgeSpecs, PieceStyle } from '@/lib/jigsawGeometry';

type Phase = 'setup' | 'preparing' | 'playing' | 'finished';

const TEMPLATES = [
    { id: 'sunset-lake', name: 'Sunset Lake', src: '/puzzle-templates/sunset-lake.svg' },
    { id: 'space-nebula', name: 'Space Nebula', src: '/puzzle-templates/space-nebula.svg' },
    { id: 'geometric-abstract', name: 'Geometric Abstract', src: '/puzzle-templates/geometric-abstract.svg' },
];

const PIECE_COUNTS = [10, 20, 50, 100];
const WORKING_MAX = 900;
const TRAY_GAP = 40;

interface PieceState {
    id: number;
    correctX: number;
    correctY: number;
    width: number;
    height: number;
    imgSrc: string;
    x: number;
    y: number;
    placed: boolean;
}

interface DragInfo {
    id: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    lastX: number;
    lastY: number;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function JigsawPuzzleGame() {
    const [phase, setPhase] = useState<Phase>('setup');
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [pieceCount, setPieceCount] = useState(20);
    const [pieceStyle, setPieceStyle] = useState<PieceStyle>('classic');

    const [pieces, setPieces] = useState<PieceState[]>([]);
    const [boardW, setBoardW] = useState(0);
    const [boardH, setBoardH] = useState(0);
    const [trayH, setTrayH] = useState(0);
    const [snapTolerance, setSnapTolerance] = useState(30);
    const [placedCount, setPlacedCount] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const objectUrlRef = useRef<string | null>(null);
    const pieceRefs = useRef<Map<number, HTMLImageElement>>(new Map());
    const dragRef = useRef<DragInfo | null>(null);
    const startTimeRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    function chooseTemplate(src: string) {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setImageSrc(src);
    }

    function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        setImageSrc(url);
    }

    function startPuzzle() {
        if (!imageSrc) return;
        setPhase('preparing');

        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, WORKING_MAX / Math.max(img.naturalWidth, img.naturalHeight));
            const W = Math.round(img.naturalWidth * scale);
            const H = Math.round(img.naturalHeight * scale);

            const source = document.createElement('canvas');
            source.width = W;
            source.height = H;
            const sctx = source.getContext('2d')!;
            sctx.drawImage(img, 0, 0, W, H);

            const { rows, cols } = bestGrid(pieceCount, W / H);
            const cellW = W / cols;
            const cellH = H / rows;
            const edges: EdgeSpecs | null = pieceStyle === 'classic' ? buildEdgeSpecs(rows, cols) : null;

            const trayWidth = W;
            const trayHeight = Math.max(300, Math.round(H * 0.9));
            const newPieces: PieceState[] = [];

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const path = piecePath(r, c, rows, cols, cellW, cellH, pieceStyle, edges);
                    const pw = Math.ceil(path.bboxW);
                    const ph = Math.ceil(path.bboxH);

                    const pieceCanvas = document.createElement('canvas');
                    pieceCanvas.width = pw;
                    pieceCanvas.height = ph;
                    const pctx = pieceCanvas.getContext('2d')!;
                    const p2d = new Path2D(path.d);
                    pctx.save();
                    pctx.clip(p2d);
                    pctx.drawImage(source, -path.bboxX, -path.bboxY);
                    pctx.restore();

                    // canvas clip() antialiases the boundary, so each piece's
                    // edge fades to partial transparency right where it meets
                    // its neighbor - two half-transparent edges over the page
                    // background show up as a hairline gap. Re-stroke the
                    // (unclipped) boundary with the same image content,
                    // straddling the seam, so both sides stay fully opaque.
                    const pattern = pctx.createPattern(source, 'no-repeat')!;
                    pattern.setTransform(new DOMMatrix().translate(-path.bboxX, -path.bboxY));
                    pctx.strokeStyle = pattern;
                    pctx.lineWidth = 3;
                    pctx.stroke(p2d);

                    pctx.lineWidth = 1.5;
                    pctx.strokeStyle = 'rgba(0,0,0,0.35)';
                    pctx.stroke(p2d);

                    newPieces.push({
                        id: r * cols + c,
                        correctX: path.bboxX,
                        correctY: path.bboxY,
                        width: pw,
                        height: ph,
                        imgSrc: pieceCanvas.toDataURL('image/png'),
                        x: Math.random() * Math.max(1, trayWidth - pw),
                        y: H + TRAY_GAP + Math.random() * Math.max(1, trayHeight - ph),
                        placed: false,
                    });
                }
            }

            setBoardW(W);
            setBoardH(H);
            setTrayH(trayHeight);
            setSnapTolerance(Math.min(cellW, cellH) * 0.35);
            setPieces(newPieces);
            setPlacedCount(0);
            setElapsed(0);
            startTimeRef.current = Date.now();
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
            setPhase('playing');
        };
        img.src = imageSrc;
    }

    function newPuzzle() {
        if (timerRef.current) clearInterval(timerRef.current);
        pieceRefs.current.clear();
        setPieces([]);
        setPhase('setup');
    }

    function handlePointerDown(e: React.PointerEvent, piece: PieceState) {
        if (piece.placed || phase !== 'playing') return;
        e.preventDefault();
        dragRef.current = {
            id: piece.id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            origX: piece.x,
            origY: piece.y,
            lastX: piece.x,
            lastY: piece.y,
        };
        const el = pieceRefs.current.get(piece.id);
        if (el) el.style.zIndex = '1000';
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    }

    function handlePointerMove(e: PointerEvent) {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        const newX = drag.origX + dx;
        const newY = drag.origY + dy;
        drag.lastX = newX;
        drag.lastY = newY;
        const el = pieceRefs.current.get(drag.id);
        if (el) {
            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        }
    }

    function handlePointerUp() {
        const drag = dragRef.current;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        if (!drag) return;
        dragRef.current = null;

        setPieces(prev => prev.map(p => {
            if (p.id !== drag.id) return p;
            const dist = Math.hypot(drag.lastX - p.correctX, drag.lastY - p.correctY);
            if (dist <= snapTolerance) {
                playStepSound();
                return { ...p, x: p.correctX, y: p.correctY, placed: true };
            }
            return { ...p, x: drag.lastX, y: drag.lastY };
        }));

        const el = pieceRefs.current.get(drag.id);
        if (el) el.style.zIndex = '10';
    }

    useEffect(() => {
        if (phase !== 'playing') return;
        const placed = pieces.filter(p => p.placed).length;
        setPlacedCount(placed);
        if (pieces.length > 0 && placed === pieces.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            playLadderSound();
            setPhase('finished');
        }
    }, [pieces, phase]);

    return (
        <div className="min-h-[100vh] flex flex-col items-center p-10 bg-gray-100">
            <BackButton variant="floating" />
            <h1 className="text-2xl font-bold mb-4">Jigsaw Puzzle</h1>

            {phase === 'setup' && (
                <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
                    <div className="w-full">
                        <h2 className="font-semibold text-gray-700 mb-2">1. Choose an image</h2>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            {TEMPLATES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => chooseTemplate(t.src)}
                                    className={`rounded-lg overflow-hidden border-4 transition-colors ${imageSrc === t.src ? 'border-blue-500' : 'border-transparent hover:border-blue-200'}`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={t.src} alt={t.name} className="w-full h-24 object-cover bg-white" />
                                    <div className="text-xs text-center py-1 bg-white text-gray-700">{t.name}</div>
                                </button>
                            ))}
                        </div>
                        <label className="block">
                            <span className="sr-only">Upload an image</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 file:cursor-pointer cursor-pointer"
                            />
                        </label>
                    </div>

                    <div className="w-full">
                        <h2 className="font-semibold text-gray-700 mb-2">2. Number of pieces</h2>
                        <div className="flex gap-3">
                            {PIECE_COUNTS.map(n => (
                                <button
                                    key={n}
                                    onClick={() => setPieceCount(n)}
                                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${pieceCount === n ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-full">
                        <h2 className="font-semibold text-gray-700 mb-2">3. Piece style</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPieceStyle('grid')}
                                className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${pieceStyle === 'grid' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'}`}
                            >
                                Simple Grid
                            </button>
                            <button
                                onClick={() => setPieceStyle('classic')}
                                className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${pieceStyle === 'classic' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'}`}
                            >
                                Classic Interlocking
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={startPuzzle}
                        disabled={!imageSrc}
                        className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Start Puzzle
                    </button>
                </div>
            )}

            {phase === 'preparing' && (
                <div className="mt-16 text-gray-600">Preparing puzzle...</div>
            )}

            {phase === 'playing' && (
                <>
                    <div className="flex items-center gap-6 mb-4 text-gray-700">
                        <span className="font-semibold">{placedCount} / {pieces.length} placed</span>
                        <span>{formatTime(elapsed)}</span>
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                            <input type="checkbox" checked={showPreview} onChange={e => setShowPreview(e.target.checked)} />
                            Show preview
                        </label>
                        <button onClick={newPuzzle} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                            New Puzzle
                        </button>
                    </div>

                    <div className="relative" style={{ width: boardW, height: boardH + TRAY_GAP + trayH }}>
                        <div
                            className="absolute border-4 border-dashed border-gray-400 bg-white"
                            style={{ left: 0, top: 0, width: boardW, height: boardH }}
                        >
                            {showPreview && imageSrc && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imageSrc} alt="Puzzle preview" className="w-full h-full object-cover opacity-25 pointer-events-none" />
                            )}
                        </div>

                        {pieces.map(p => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={p.id}
                                ref={el => { if (el) pieceRefs.current.set(p.id, el); else pieceRefs.current.delete(p.id); }}
                                src={p.imgSrc}
                                alt=""
                                draggable={false}
                                onPointerDown={e => handlePointerDown(e, p)}
                                className="absolute select-none"
                                style={{
                                    left: p.x,
                                    top: p.y,
                                    width: p.width,
                                    height: p.height,
                                    zIndex: p.placed ? 1 : 10,
                                    cursor: p.placed ? 'default' : 'grab',
                                    filter: p.placed ? 'none' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
                                    touchAction: 'none',
                                }}
                            />
                        ))}
                    </div>
                </>
            )}

            {phase === 'finished' && (
                <div className="flex flex-col items-center gap-4 mt-8">
                    <div className="text-xl font-bold text-green-600">🎉 Puzzle complete in {formatTime(elapsed)}!</div>
                    {imageSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageSrc} alt="Completed puzzle" className="max-w-lg rounded-lg shadow-lg border-4 border-white" />
                    )}
                    <button onClick={newPuzzle} className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Play Again
                    </button>
                </div>
            )}
        </div>
    );
}
