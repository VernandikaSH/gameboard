# Gameboard

A collection of classic board and puzzle games built with Next.js, playable in the browser.

## Games

- Chess
- Checkers
- Connect 4
- Ludo
- Mancala
- Memory Match
- Othello
- Quoridor
- Shut the Box
- Snake and Ladder
- Jigsaw Puzzle

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Tech Stack

- [Next.js](https://nextjs.org)
- React
- TypeScript
- Tailwind CSS
- [chess.js](https://github.com/jhlywa/chess.js) and [react-chessboard](https://github.com/Clariity/react-chessboard) for the chess game

## Project Structure

- `src/app/games/` — each game lives in its own folder with its own page
- `src/app/components/` — shared UI components (dice, player pieces, modals, etc.)
- `src/lib/` — shared logic (audio, settings, sound)
