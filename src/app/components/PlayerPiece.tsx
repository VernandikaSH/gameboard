import React from 'react';

interface PlayerPieceProps {
  color: string;
  isCurrent: boolean;
  x: number; // pixel center within the board overlay
  y: number; // pixel center within the board overlay
  transitionMs: number; // how long the left/top move should take to animate
}

const PlayerPiece: React.FC<PlayerPieceProps> = ({ color, isCurrent, x, y, transitionMs }) => {
  return (
    <div
      className={`absolute w-4 h-4 rounded-full ${color} border-2 ${isCurrent ? ' border-black' : 'border-none'}`}
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        transition: `left ${transitionMs}ms ease, top ${transitionMs}ms ease`,
        zIndex: 20
      }}
    ></div>
  );
};

export default PlayerPiece;
