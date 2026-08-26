// app/games/snake-and-ladder/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Board from './Board';
import Dice from '@/app/components/Dice';
import PlayerSelectionModal from '@/app/components/PlayerSelectionModal';
import BackButton from '@/app/components/BackButton';
import { playDiceSound, playStepSound, playLadderSound, playSnakeSound } from '@/lib/sound';
import { SLIDE_TRANSITION_MS } from './boardLayout';

export default function SnakeAndLadderGame() {
  const [numPlayers, setNumPlayers] = useState<number | null>(null);
  const [players, setPlayers] = useState<{ id: number; position: number; color: string; currentAnimationPosition: number }[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [winner, setWinner] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  // Index of the player currently sliding along a snake/ladder (null the rest of the time).
  // While set, Board gives that player's piece a slower transition so it visibly
  // slides to its destination instead of jumping there.
  const [slidingPlayer, setSlidingPlayer] = useState<number | null>(null);

  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const snakes = useMemo(() => [[17, 7], [33, 5], [54, 34], [62, 19], [98, 79]] as [number, number][], []);
  const ladders = useMemo(() => [[5, 66], [7, 14], [9, 31], [20, 38], [28, 84], [40, 59], [51, 67], [63, 81], [71, 91]] as [number, number][], []);

  const playerColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];

  const startGame = (selectedPlayers: number) => {
    setNumPlayers(selectedPlayers);
    const newPlayers = Array.from({ length: selectedPlayers }, (_, i) => ({
      id: i + 1,
      position: 1,
      color: playerColors[i],
      currentAnimationPosition: 1,
    }));
    setPlayers(newPlayers);
  };

  // Advances the current player's piece one square toward its target.
  // Must stay pure (return new objects, never mutate) - React Strict Mode
  // double-invokes state updaters, and mutating shared player objects here
  // previously caused each tick to apply twice (piece moving 2 squares per
  // step, or twice the dice value).
  const animateStep = useCallback(() => {
    setPlayers(prevPlayers =>
      prevPlayers.map((player, index) => {
        if (index !== currentPlayer) return player;

        const currentPos = player.currentAnimationPosition;
        const targetPos = player.position;
        if (currentPos === targetPos) return player;

        const nextPos = targetPos > currentPos ? currentPos + 1 : currentPos - 1;
        return { ...player, currentAnimationPosition: nextPos };
      })
    );
  }, [currentPlayer]);

  useEffect(() => {
    if (!isAnimating || slidingPlayer !== null) return;

    const player = players[currentPlayer];
    const willStep = !!player && player.currentAnimationPosition !== player.position;

    animationTimeoutRef.current = setTimeout(() => {
      if (willStep) playStepSound();
      animateStep();
    }, 300);

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isAnimating, animateStep, players, currentPlayer, slidingPlayer]);

  // Once the current player's piece has visually reached its target square,
  // apply snakes/ladders, check for a winner, and hand off the turn. This is
  // kept separate from animateStep's setPlayers updater because updater
  // functions must be pure - triggering other setState calls from inside one
  // gets those calls double-invoked under Strict Mode too.
  useEffect(() => {
    if (!isAnimating || slidingPlayer !== null) return;

    const player = players[currentPlayer];
    if (!player || player.currentAnimationPosition !== player.position) return;

    let finalPosition = player.position;
    const snake = snakes.find(([head]) => head === finalPosition);
    if (snake) finalPosition = snake[1];
    const ladder = ladders.find(([bottom]) => bottom === finalPosition);
    if (ladder) finalPosition = ladder[1];

    if (finalPosition !== player.position) {
      // Slide smoothly along the snake/ladder instead of teleporting: apply
      // the position now (Board's CSS transition animates the visible move),
      // and hold the turn until that slide has had time to finish.
      (snake ? playSnakeSound : playLadderSound)();
      setSlidingPlayer(currentPlayer);
      setPlayers(prevPlayers =>
        prevPlayers.map((p, index) =>
          index === currentPlayer ? { ...p, position: finalPosition, currentAnimationPosition: finalPosition } : p
        )
      );

      slideTimeoutRef.current = setTimeout(() => {
        setSlidingPlayer(null);
        setIsAnimating(false);
        if (finalPosition === 100) {
          setWinner(currentPlayer);
        } else {
          setCurrentPlayer(prev => (prev + 1) % players.length);
        }
      }, SLIDE_TRANSITION_MS);
      return;
    }

    setIsAnimating(false);
    if (finalPosition === 100) {
      setWinner(currentPlayer);
    } else {
      setCurrentPlayer(prev => (prev + 1) % players.length);
    }
  }, [players, isAnimating, currentPlayer, snakes, ladders, slidingPlayer]);

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    };
  }, []);

  const rollDice = () => {
    if (winner !== null || isAnimating) return;

    playDiceSound();

    const value = Math.floor(Math.random() * 6) + 1;
    setDiceValue(value);

    setIsAnimating(true);

    // Calculate the new target position but don't apply snakes/ladders yet
    setPlayers(prevPlayers =>
      prevPlayers.map((player, index) => {
        if (index !== currentPlayer) return player;

        let newPosition = player.position + value;

        // Handle bouncing back if going over 100
        if (newPosition > 100) {
          newPosition = 100 - (newPosition - 100);
        }

        return { ...player, position: newPosition };
      })
    );
  };

  const resetGame = () => {
    setNumPlayers(null);
    setPlayers([]);
    setCurrentPlayer(0);
    setDiceValue(1);
    setWinner(null);
    setIsAnimating(false);
    setSlidingPlayer(null);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-gray-100">
      <BackButton variant='floating' />
      <h1 className="text-3xl font-bold mb-6">Snake and Ladder</h1>

      {/* Conditionally render the PlayerSelectionModal */}
      {!numPlayers && (
        <PlayerSelectionModal onSelectPlayers={startGame} />
      )}

      {/* Main game UI (will only show if numPlayers is not null) */}
      {numPlayers && (
        <>
          <div className="mb-4">
            <Dice value={diceValue} onRoll={rollDice} disabled={winner !== null || isAnimating} />
          </div>

          <div className="mb-4">
            {winner !== null ? (
              <div className="text-xl font-bold text-green-600">
                Player {winner + 1} wins!
              </div>
            ) : (
              <div className="text-lg">
                Current turn: <span className={`font-bold ${playerColors[currentPlayer]}`}>
                  Player {currentPlayer + 1}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-4 mb-4">
            {players.map((player, index) => (
              <div key={player.id} className="flex items-center">
                <div className={`w-4 h-4 rounded-full ${player.color} mr-2`}></div>
                <span className={`${currentPlayer === index && !isAnimating ? 'font-bold' : ''}`}>
                  Player {player.id} {player.position === 100 ? '🏆' : ''}
                </span>
              </div>
            ))}
          </div>

          <Board
            players={players}
            snakes={snakes}
            ladders={ladders}
            currentPlayer={currentPlayer}
            slidingPlayer={slidingPlayer}
          />

          <button
            onClick={resetGame}
            className="mt-6 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            {winner !== null ? 'Play Again' : 'Reset Game'}
          </button>
        </>
      )}
    </div>
  );
}