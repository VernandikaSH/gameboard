"use client";

import { useState } from 'react';
import Board, { LudoToken } from './Board';
import Dice from '@/app/components/Dice';
import PlayerSelectionModal from '@/app/components/PlayerSelectionModal';
import BackButton from '@/app/components/BackButton';
import { playDiceSound, playStepSound, playSnakeSound, playLadderSound } from '@/lib/sound';
import {
  COLOR_ORDER,
  COLOR_CLASSES,
  LudoColor,
  SAFE_RING_INDICES,
  LAST_SHARED_STEP,
  FINISHED_STEP,
  globalIndexForToken,
  tokenKey,
} from './boardLayout';

const TOKENS_PER_PLAYER = 4;
const STEP_ANIMATION_MS = 250; // per-hop duration; keep >= Board.tsx's token transition (200ms)

function createTokens(colors: LudoColor[]): LudoToken[] {
  const tokens: LudoToken[] = [];
  for (const color of colors) {
    for (let i = 0; i < TOKENS_PER_PLAYER; i++) {
      tokens.push({ color, index: i, position: -1 });
    }
  }
  return tokens;
}

function label(color: LudoColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function computeMovableTokens(color: LudoColor, roll: number, tokens: LudoToken[]): LudoToken[] {
  return tokens
    .filter(t => t.color === color)
    .filter(t => {
      if (t.position === -1) return roll === 6;
      if (t.position === FINISHED_STEP) return false;
      return t.position + roll <= FINISHED_STEP;
    });
}

export default function LudoGame() {
  const [numPlayers, setNumPlayers] = useState<number | null>(null);
  const [colors, setColors] = useState<LudoColor[]>([]);
  const [tokens, setTokens] = useState<LudoToken[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [movableKeys, setMovableKeys] = useState<Set<string>>(new Set());
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [winner, setWinner] = useState<LudoColor | null>(null);

  const currentColor = colors[currentPlayerIndex];

  const startGame = (n: number) => {
    const chosen = COLOR_ORDER.slice(0, n);
    setColors(chosen);
    setNumPlayers(n);
    setTokens(createTokens(chosen));
    setCurrentPlayerIndex(0);
    setDiceValue(1);
    setMovableKeys(new Set());
    setAwaitingChoice(false);
    setIsBusy(false);
    setWinner(null);
    setStatusMessage(`${label(chosen[0])}'s turn`);
  };

  const resetGame = () => {
    setNumPlayers(null);
    setColors([]);
    setTokens([]);
    setCurrentPlayerIndex(0);
    setDiceValue(1);
    setMovableKeys(new Set());
    setAwaitingChoice(false);
    setIsBusy(false);
    setWinner(null);
    setStatusMessage('');
  };

  const goToNextPlayer = (fromIndex: number, fromColors: LudoColor[]) => {
    const nextIndex = (fromIndex + 1) % fromColors.length;
    setCurrentPlayerIndex(nextIndex);
    setStatusMessage(`${label(fromColors[nextIndex])}'s turn`);
  };

  // Applies capture/finish/turn-advance once a token has arrived at its final
  // square. `snapshot` is the OTHER tokens' positions from before this move
  // started (they can't have changed mid-walk, since only one token moves
  // per turn), used for capture and win detection.
  const resolveLanding = (token: LudoToken, roll: number, finalPosition: number, snapshot: LudoToken[]) => {
    let capturedKeys: string[] = [];
    if (finalPosition <= LAST_SHARED_STEP) {
      const globalIdx = globalIndexForToken(token.color, finalPosition);
      if (!SAFE_RING_INDICES.has(globalIdx)) {
        capturedKeys = snapshot
          .filter(t => t.color !== token.color && t.position >= 0 && t.position <= LAST_SHARED_STEP)
          .filter(t => globalIndexForToken(t.color, t.position) === globalIdx)
          .map(t => tokenKey(t.color, t.index));
      }
    }
    const finished = finalPosition === FINISHED_STEP;
    const captured = capturedKeys.length > 0;

    if (captured) {
      setTokens(prev => prev.map(t => (capturedKeys.includes(tokenKey(t.color, t.index)) ? { ...t, position: -1 } : t)));
    }

    if (finished) playLadderSound();
    else if (captured) playSnakeSound();
    else playStepSound();

    const hasWon =
      finished &&
      snapshot
        .filter(t => t.color === token.color && t.index !== token.index)
        .every(t => t.position === FINISHED_STEP);

    if (hasWon) {
      setWinner(token.color);
      setStatusMessage(`${label(token.color)} wins!`);
      return;
    }

    if (roll === 6 || captured || finished) {
      setStatusMessage(`${label(token.color)} goes again`);
      setIsBusy(false);
    } else {
      goToNextPlayer(currentPlayerIndex, colors);
      setIsBusy(false);
    }
  };

  // Walks the token forward one square at a time (matching each cell it
  // actually passes through) instead of jumping straight to the final
  // square, so the piece visibly hops across the board like a real move.
  const animateAndMove = (token: LudoToken, roll: number, snapshot: LudoToken[]) => {
    const startPosition = token.position;
    const finalPosition = startPosition === -1 ? 0 : startPosition + roll;
    const steps = startPosition === -1
      ? [0]
      : Array.from({ length: finalPosition - startPosition }, (_, i) => startPosition + i + 1);

    setIsBusy(true);
    setMovableKeys(new Set());
    setAwaitingChoice(false);

    const stepAt = (i: number) => {
      const stepPosition = steps[i];
      const isLastStep = i === steps.length - 1;

      setTokens(prev =>
        prev.map(t => (t.color === token.color && t.index === token.index ? { ...t, position: stepPosition } : t))
      );

      if (isLastStep) {
        resolveLanding(token, roll, finalPosition, snapshot);
      } else {
        playStepSound();
        setTimeout(() => stepAt(i + 1), STEP_ANIMATION_MS);
      }
    };

    stepAt(0);
  };

  const rollDice = () => {
    if (winner || isBusy || awaitingChoice) return;

    playDiceSound();
    const value = Math.floor(Math.random() * 6) + 1;
    setDiceValue(value);
    setIsBusy(true);

    const movable = computeMovableTokens(currentColor, value, tokens);

    if (movable.length === 0) {
      setStatusMessage(`${label(currentColor)} rolled ${value} - no valid moves`);
      setTimeout(() => {
        goToNextPlayer(currentPlayerIndex, colors);
        setIsBusy(false);
      }, 900);
      return;
    }

    if (movable.length === 1) {
      const snapshot = tokens;
      setTimeout(() => {
        animateAndMove(movable[0], value, snapshot);
      }, 300);
      return;
    }

    setMovableKeys(new Set(movable.map(t => tokenKey(t.color, t.index))));
    setAwaitingChoice(true);
    setStatusMessage(`${label(currentColor)} rolled ${value} - choose a piece to move`);
    setIsBusy(false);
  };

  const onTokenClick = (color: LudoColor, index: number) => {
    if (winner || isBusy || color !== currentColor) return;
    const key = tokenKey(color, index);
    if (!movableKeys.has(key)) return;
    const token = tokens.find(t => t.color === color && t.index === index);
    if (!token) return;
    animateAndMove(token, diceValue, tokens);
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-gray-100">
      <BackButton variant="floating" />
      <h1 className="text-3xl font-bold mb-4">Ludo</h1>

      {!numPlayers && <PlayerSelectionModal onSelectPlayers={startGame} />}

      {numPlayers && (
        <>
          <div className="flex items-center gap-6 mb-4">
            <Dice value={diceValue} onRoll={rollDice} disabled={!!winner || isBusy || awaitingChoice} />
            <div className="text-lg">
              {winner ? (
                <span className={`font-bold ${COLOR_CLASSES[winner].text}`}>{statusMessage}</span>
              ) : (
                <span>
                  Current turn:{' '}
                  <span className={`font-bold ${COLOR_CLASSES[currentColor].text}`}>{label(currentColor)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600 min-h-5">{!winner && statusMessage}</div>

          <div className="flex gap-4 mb-4 flex-wrap justify-center">
            {colors.map(color => {
              const home = tokens.filter(t => t.color === color && t.position === FINISHED_STEP).length;
              return (
                <div key={color} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${COLOR_CLASSES[color].solid}`}></div>
                  <span className={color === currentColor && !winner ? 'font-bold' : ''}>
                    {label(color)}: {home}/4 home
                  </span>
                </div>
              );
            })}
          </div>

          <Board tokens={tokens} movableKeys={movableKeys} onTokenClick={onTokenClick} />

          <button
            onClick={resetGame}
            className="mt-6 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            {winner ? 'Play Again' : 'Reset Game'}
          </button>
        </>
      )}
    </div>
  );
}
