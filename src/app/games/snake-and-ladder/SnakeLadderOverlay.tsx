import React from 'react';
import { getCellCenter } from './boardLayout';

interface SnakeLadderOverlayProps {
  snakes: [number, number][];
  ladders: [number, number][];
  cellSize: number;
  boardSize: number;
}

const RAIL_COLOR = '#b45309';
const RUNG_COLOR = '#f59e0b';
const SNAKE_COLORS = ['#dc2626', '#16a34a', '#0891b2', '#7c3aed'];

function Ladder({ bottom, top, cellSize }: { bottom: number; top: number; cellSize: number }) {
  const p1 = getCellCenter(bottom, cellSize);
  const p2 = getCellCenter(top, cellSize);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector, used to offset the two rails from the centerline.
  const px = -dy / length;
  const py = dx / length;
  const railHalfWidth = cellSize * 0.16;

  const rungCount = Math.max(2, Math.round(length / (cellSize * 0.45)));
  const rungs = Array.from({ length: rungCount + 1 }, (_, i) => {
    const t = i / rungCount;
    const cx = p1.x + dx * t;
    const cy = p1.y + dy * t;
    return {
      x1: cx + px * railHalfWidth,
      y1: cy + py * railHalfWidth,
      x2: cx - px * railHalfWidth,
      y2: cy - py * railHalfWidth,
    };
  });

  return (
    <g>
      <line
        x1={p1.x + px * railHalfWidth} y1={p1.y + py * railHalfWidth}
        x2={p2.x + px * railHalfWidth} y2={p2.y + py * railHalfWidth}
        stroke={RAIL_COLOR} strokeWidth={4} strokeLinecap="round"
      />
      <line
        x1={p1.x - px * railHalfWidth} y1={p1.y - py * railHalfWidth}
        x2={p2.x - px * railHalfWidth} y2={p2.y - py * railHalfWidth}
        stroke={RAIL_COLOR} strokeWidth={4} strokeLinecap="round"
      />
      {rungs.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={RUNG_COLOR} strokeWidth={3} strokeLinecap="round" />
      ))}
    </g>
  );
}

function Snake({ head, tail, cellSize, colorIndex }: { head: number; tail: number; cellSize: number; colorIndex: number }) {
  const p1 = getCellCenter(head, cellSize); // head = higher number, where the snake bites
  const p2 = getCellCenter(tail, cellSize); // tail = where the player ends up
  const color = SNAKE_COLORS[colorIndex % SNAKE_COLORS.length];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  const wave = Math.min(cellSize * 0.6, length * 0.3);

  const q1 = { x: p1.x + dx * 0.33 + px * wave, y: p1.y + dy * 0.33 + py * wave };
  const q2 = { x: p1.x + dx * 0.66 - px * wave, y: p1.y + dy * 0.66 - py * wave };
  const path = `M ${p1.x} ${p1.y} C ${q1.x} ${q1.y}, ${q2.x} ${q2.y}, ${p2.x} ${p2.y}`;

  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth={cellSize * 0.22} strokeLinecap="round" opacity={0.9} />
      <circle cx={p1.x} cy={p1.y} r={cellSize * 0.17} fill={color} stroke="#1f2937" strokeWidth={1.5} />
      <circle cx={p1.x - cellSize * 0.06} cy={p1.y - cellSize * 0.05} r={cellSize * 0.035} fill="white" />
      <circle cx={p1.x - cellSize * 0.06} cy={p1.y - cellSize * 0.05} r={cellSize * 0.015} fill="black" />
      <circle cx={p1.x + cellSize * 0.06} cy={p1.y - cellSize * 0.05} r={cellSize * 0.035} fill="white" />
      <circle cx={p1.x + cellSize * 0.06} cy={p1.y - cellSize * 0.05} r={cellSize * 0.015} fill="black" />
    </g>
  );
}

export default function SnakeLadderOverlay({ snakes, ladders, cellSize, boardSize }: SnakeLadderOverlayProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={cellSize * boardSize}
      height={cellSize * boardSize}
      style={{ zIndex: 10 }}
    >
      {ladders.map(([bottom, top]) => (
        <Ladder key={`ladder-${bottom}-${top}`} bottom={bottom} top={top} cellSize={cellSize} />
      ))}
      {snakes.map(([head, tail], i) => (
        <Snake key={`snake-${head}-${tail}`} head={head} tail={tail} cellSize={cellSize} colorIndex={i} />
      ))}
    </svg>
  );
}
