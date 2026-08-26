import React from 'react';
import {
  BOARD_SIZE,
  CELL_SIZE,
  COLOR_CLASSES,
  COLOR_ORDER,
  LudoColor,
  YARD_REGION,
  getCellInfo,
  getTokenPixelPosition,
  tokenKey,
} from './boardLayout';

export interface LudoToken {
  color: LudoColor;
  index: number;
  position: number; // -1 yard, 0-54 shared, 55-60 home stretch, 61 finished
}

interface BoardProps {
  tokens: LudoToken[];
  movableKeys: Set<string>;
  onTokenClick: (color: LudoColor, index: number) => void;
}

export default function Board({ tokens, movableKeys, onTokenClick }: BoardProps) {
  const boardPx = BOARD_SIZE * CELL_SIZE;

  const crossCells: React.ReactNode[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const info = getCellInfo(r, c);
      if (info.type === 'yard' || info.type === 'blank') continue;

      let bgClass = 'bg-white';
      let extra = '';
      if (info.type === 'ring') {
        if (info.startColor) {
          bgClass = COLOR_CLASSES[info.startColor].solid;
        } else if (info.safe) {
          bgClass = 'bg-gray-200';
        }
      } else if (info.type === 'home') {
        bgClass = COLOR_CLASSES[info.color].light;
      } else if (info.type === 'center') {
        bgClass = 'bg-gray-300';
      }
      if (info.type === 'ring' && info.safe) {
        extra = 'flex items-center justify-center';
      }

      crossCells.push(
        <div
          key={`${r}-${c}`}
          className={`absolute border border-gray-200 ${bgClass} ${extra}`}
          style={{ left: c * CELL_SIZE, top: r * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
        >
          {info.type === 'ring' && info.safe && (
            <span className="text-[10px] text-gray-500 select-none">★</span>
          )}
        </div>
      );
    }
  }

  const yardBlocks = COLOR_ORDER.map(color => {
    const { rowStart, colStart } = YARD_REGION[color];
    return (
      <div
        key={color}
        className={`absolute rounded-lg ${COLOR_CLASSES[color].solid} p-2`}
        style={{
          left: colStart * CELL_SIZE,
          top: rowStart * CELL_SIZE,
          width: 6 * CELL_SIZE,
          height: 6 * CELL_SIZE,
        }}
      >
        <div className="w-full h-full bg-white rounded-md" />
      </div>
    );
  });

  // Group tokens sharing the exact same pixel spot so we can fan them out slightly.
  const grouped = new Map<string, LudoToken[]>();
  for (const token of tokens) {
    const pos = getTokenPixelPosition(token.color, token.position, token.index, CELL_SIZE);
    const spotKey = token.position < 0 ? tokenKey(token.color, token.index) : `${Math.round(pos.x)},${Math.round(pos.y)}`;
    if (!grouped.has(spotKey)) grouped.set(spotKey, []);
    grouped.get(spotKey)!.push(token);
  }

  const tokenNodes: React.ReactNode[] = [];
  grouped.forEach(group => {
    group.forEach((token, i) => {
      const pos = getTokenPixelPosition(token.color, token.position, token.index, CELL_SIZE);
      const spread = group.length > 1 ? 6 : 0;
      const angle = (i / Math.max(group.length, 1)) * Math.PI * 2;
      const offsetX = group.length > 1 ? Math.cos(angle) * spread : 0;
      const offsetY = group.length > 1 ? Math.sin(angle) * spread : 0;
      const key = tokenKey(token.color, token.index);
      const isMovable = movableKeys.has(key);

      tokenNodes.push(
        <div
          key={key}
          onClick={() => isMovable && onTokenClick(token.color, token.index)}
          className={`absolute w-4 h-4 rounded-full border-2 border-white shadow ${COLOR_CLASSES[token.color].solid}
            ${isMovable ? 'ring-2 ring-offset-1 ring-black cursor-pointer animate-pulse' : ''}
            ${token.position === 61 ? 'opacity-70' : ''}
          `}
          style={{
            left: pos.x + offsetX,
            top: pos.y + offsetY,
            transform: 'translate(-50%, -50%)',
            transition: 'left 200ms ease, top 200ms ease',
            zIndex: 20,
          }}
        />
      );
    });
  });

  return (
    <div
      className="relative border-4 border-gray-800 rounded-lg shadow-lg bg-gray-50"
      style={{ width: boardPx, height: boardPx }}
    >
      {crossCells}
      {yardBlocks}
      {tokenNodes}
    </div>
  );
}
