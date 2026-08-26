// Pure geometry helpers for the jigsaw puzzle game: choosing a rows x cols
// grid for a target piece count, and generating SVG path outlines for each
// piece - either plain rectangles ("grid" style) or classic interlocking
// tabs/blanks ("classic" style).

export type PieceStyle = 'grid' | 'classic';

export interface GridDims {
    rows: number;
    cols: number;
}

export interface PiecePath {
    d: string;
    // Bounding box of the path, in the same coordinate space as cellW/cellH
    // (i.e. relative to the overall puzzle image), used to size and position
    // the per-piece canvas that the path gets clipped against.
    bboxX: number;
    bboxY: number;
    bboxW: number;
    bboxH: number;
}

type Point = [number, number];

// Picks the rows x cols pair whose product is exactly `count` and whose
// aspect ratio (cols/rows) is closest to the image's own aspect ratio, so
// pieces stay reasonably proportioned regardless of the source image shape.
export function bestGrid(count: number, aspect: number): GridDims {
    let best: GridDims = { rows: 1, cols: count };
    let bestScore = Infinity;
    const targetLog = Math.log(aspect);
    for (let rows = 1; rows <= count; rows++) {
        if (count % rows !== 0) continue;
        const cols = count / rows;
        const score = Math.abs(Math.log(cols / rows) - targetLog);
        if (score < bestScore) {
            bestScore = score;
            best = { rows, cols };
        }
    }
    return best;
}

// Catmull-Rom spline through `points`, converted to cubic bezier segments.
// Returns SVG "C x1 y1 x2 y2 x y" commands for points[1..].
function catmullRomToBezier(points: Point[]): string {
    let d = '';
    const get = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = get(i - 1);
        const p1 = get(i);
        const p2 = get(i + 1);
        const p3 = get(i + 2);
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
    }
    return d;
}

// One shared random seed per internal edge, so both neighboring pieces
// generate the exact same curve for their common boundary.
interface EdgeSeed {
    sign: 1 | -1;
    jitter: number[];
}

export interface EdgeSpecs {
    // h[r][c]: boundary between row r and row r+1, at column c.
    h: EdgeSeed[][];
    // v[r][c]: boundary between column c and column c+1, at row r.
    v: EdgeSeed[][];
}

function randomEdgeSeed(): EdgeSeed {
    return {
        sign: Math.random() < 0.5 ? 1 : -1,
        // Small per-keyframe jitter so tabs look organic rather than identical.
        jitter: Array.from({ length: 11 }, () => (Math.random() - 0.5) * 2),
    };
}

export function buildEdgeSpecs(rows: number, cols: number): EdgeSpecs {
    const h: EdgeSeed[][] = [];
    for (let r = 0; r < rows - 1; r++) {
        h.push(Array.from({ length: cols }, () => randomEdgeSeed()));
    }
    const v: EdgeSeed[][] = [];
    for (let r = 0; r < rows; r++) {
        v.push(Array.from({ length: cols - 1 }, () => randomEdgeSeed()));
    }
    return { h, v };
}

// Builds the 11-keyframe tab/blank outline for one edge, in absolute
// coordinates, going from p0 to p1 (a straight run in the source image).
// `axis` says which of p0/p1's coordinates is the varying one.
function edgePoints(p0: Point, p1: Point, axis: 'h' | 'v', seed: EdgeSeed, tabSize: number): Point[] {
    const length = axis === 'h' ? p1[0] - p0[0] : p1[1] - p0[1];
    const amp = seed.sign * tabSize;
    const jitterAmt = tabSize * 0.12;
    // Fractions of `length` for x, and multiples of `amp` for the
    // perpendicular offset - a neck leading into a bulb wider than the neck,
    // which is what makes it read as an actual interlocking tab rather than
    // a simple bump.
    const keyframes: [number, number][] = [
        [0.00, 0], [0.40, 0], [0.40, 0.30], [0.25, 0.55], [0.25, 0.85],
        [0.50, 1.10], [0.75, 0.85], [0.75, 0.55], [0.60, 0.30], [0.60, 0], [1.00, 0],
    ];
    return keyframes.map(([xf, yf], i) => {
        const jitter = seed.jitter[i] * jitterAmt;
        const along = xf * length + (i > 0 && i < keyframes.length - 1 ? jitter : 0);
        const perp = yf * amp + (i > 0 && i < keyframes.length - 1 ? jitter : 0);
        return axis === 'h'
            ? ([p0[0] + along, p0[1] + perp] as Point)
            : ([p0[0] + perp, p0[1] + along] as Point);
    });
}

// Builds the outline for piece (r,c). For 'grid' style this is just its
// rectangle; for 'classic' style, shared edges use the matching entry from
// `edges` so neighboring pieces interlock exactly.
export function piecePath(
    row: number, col: number, rows: number, cols: number,
    cellW: number, cellH: number, style: PieceStyle, edges: EdgeSpecs | null
): PiecePath {
    const coreX = col * cellW;
    const coreY = row * cellH;
    const tabSize = Math.min(cellW, cellH) * 0.28;
    // The bump keyframes peak at 1.10x tabSize, plus up to 0.12x jitter, so
    // padding must clear ~1.22x tabSize or the tab tip gets clipped by the
    // piece canvas's own edge - which then can't fill the neighboring
    // piece's matching notch and shows up as a gap between pieces.
    const pad = style === 'classic' ? tabSize * 1.35 : 0;

    const bboxX = coreX - pad;
    const bboxY = coreY - pad;
    const bboxW = cellW + 2 * pad;
    const bboxH = cellH + 2 * pad;

    const TL: Point = [coreX, coreY];
    const TR: Point = [coreX + cellW, coreY];
    const BR: Point = [coreX + cellW, coreY + cellH];
    const BL: Point = [coreX, coreY + cellH];

    const localize = (p: Point): Point => [p[0] - bboxX, p[1] - bboxY];
    const L = localize(TL);

    let d = `M ${L[0]} ${L[1]}`;

    if (style === 'grid' || !edges) {
        d += ` L ${localize(TR)[0]} ${localize(TR)[1]}`;
        d += ` L ${localize(BR)[0]} ${localize(BR)[1]}`;
        d += ` L ${localize(BL)[0]} ${localize(BL)[1]}`;
        d += ' Z';
        return { d, bboxX, bboxY, bboxW, bboxH };
    }

    // Top: shared with row-1 (forward, L->R), or a straight border edge.
    const topSeed = row === 0 ? null : edges.h[row - 1][col];
    d += straightOrCurveLocalized(TL, TR, 'h', topSeed, tabSize, true, bboxX, bboxY);

    // Right: shared with col+1 (forward, T->B), or straight border edge.
    const rightSeed = col === cols - 1 ? null : edges.v[row][col];
    d += straightOrCurveLocalized(TR, BR, 'v', rightSeed, tabSize, true, bboxX, bboxY);

    // Bottom: shared with row+1, traversed backward (R->L).
    const bottomSeed = row === rows - 1 ? null : edges.h[row][col];
    d += straightOrCurveLocalized(BR, BL, 'h', bottomSeed, tabSize, false, bboxX, bboxY);

    // Left: shared with col-1, traversed backward (B->T).
    const leftSeed = col === 0 ? null : edges.v[row][col - 1];
    d += straightOrCurveLocalized(BL, TL, 'v', leftSeed, tabSize, false, bboxX, bboxY);

    d += ' Z';
    return { d, bboxX, bboxY, bboxW, bboxH };
}

// Same as straightOrCurve, but for a curve it re-derives the canonical
// (un-reversed) absolute endpoints from the edge's own natural direction
// before localizing, since bottom/left edges are walked back-to-front.
function straightOrCurveLocalized(
    from: Point, to: Point, axis: 'h' | 'v', seed: EdgeSeed | null, tabSize: number,
    forward: boolean, bboxX: number, bboxY: number
): string {
    const localize = (p: Point): Point => [p[0] - bboxX, p[1] - bboxY];
    if (!seed) {
        const t = localize(to);
        return ` L ${t[0]} ${t[1]}`;
    }
    // Canonical direction for the shared curve is always "from" the lower
    // row/col index toward the higher one, regardless of which side of the
    // piece is currently drawing it.
    const p0 = forward ? from : to;
    const p1 = forward ? to : from;
    let pts = edgePoints(p0, p1, axis, seed, tabSize);
    if (!forward) pts = [...pts].reverse();
    return catmullRomToBezier(pts.map(localize));
}
