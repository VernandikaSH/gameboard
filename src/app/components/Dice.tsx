// Dice.tsx
import React, { useEffect, useRef, useState } from 'react';

interface DiceProps {
  value: number;
  onRoll: () => void;
  disabled: boolean;
}

// Must match the `.dice-cube` transition duration in globals.css.
const ROLL_ANIMATION_MS = 700;

// A standard die: opposite faces sum to 7. Each entry is the cube rotation
// (degrees) that brings that face to point at the viewer.
const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

// Which dots are lit on a 3x3 grid (row-major) for each face value.
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Face({ value, className }: { value: number; className: string }) {
  return (
    <div className={`dice-face ${className}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className={PIP_LAYOUT[value].includes(i) ? 'dice-pip' : ''} />
      ))}
    </div>
  );
}

// Advances a rotation axis forward (never backward) so it lands exactly on
// `targetMod360`, tumbling through `extraSpins` extra full turns on the way.
function nextAxisRotation(current: number, targetMod360: number, extraSpins: number) {
  const currentMod = ((current % 360) + 360) % 360;
  const forwardDiff = ((targetMod360 - currentMod) % 360 + 360) % 360;
  return current + forwardDiff + extraSpins * 360;
}

const Dice: React.FC<DiceProps> = ({ value, onRoll, disabled }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [rollSeq, setRollSeq] = useState(0);
  const [rotation, setRotation] = useState(FACE_ROTATION[1]);
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Skip animating on mount (the default rotation already matches the
  // default value), then tumble to the new face on every roll - including
  // when the rolled value repeats, since rollSeq changes every click even
  // when `value` doesn't.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const target = FACE_ROTATION[value] ?? FACE_ROTATION[1];
    const spinsX = 2 + Math.floor(Math.random() * 2);
    const spinsY = 2 + Math.floor(Math.random() * 2);
    setRotation(prev => ({
      x: nextAxisRotation(prev.x, target.x, spinsX),
      y: nextAxisRotation(prev.y, target.y, spinsY),
    }));
  }, [rollSeq, value]);

  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    };
  }, []);

  const handleRoll = () => {
    if (disabled || isRolling) return;

    setIsRolling(true);
    setRollSeq(s => s + 1);
    onRoll();

    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => {
      setIsRolling(false);
      rollTimeoutRef.current = null;
    }, ROLL_ANIMATION_MS);
  };

  return (
    <button
      onClick={handleRoll}
      disabled={disabled || isRolling}
      aria-label={`Dice showing ${value}`}
      className={`dice-scene w-16 h-16 ${disabled || isRolling ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="dice-cube" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
        <Face value={1} className="dice-face-front" />
        <Face value={6} className="dice-face-back" />
        <Face value={2} className="dice-face-right" />
        <Face value={5} className="dice-face-left" />
        <Face value={3} className="dice-face-top" />
        <Face value={4} className="dice-face-bottom" />
      </div>
    </button>
  );
};

export default Dice;
