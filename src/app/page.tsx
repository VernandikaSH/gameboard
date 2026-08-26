import Link from 'next/link';
import { Game } from '@/types';
import Image from 'next/image';

// Mock data for games
const games: Game[] = [
  {
    id: 1,
    title: 'Chess',
    description: 'Classic strategy game for two players',
    minPlayers: 2,
    maxPlayers: 2,
    imageUrl: '/game-thumbnail/chess.jpeg',
    slug: 'chess'
  },
  {
    id: 2,
    title: 'Checkers',
    description: 'Simple yet strategic board game',
    minPlayers: 2,
    maxPlayers: 2,
    imageUrl: '/game-thumbnail/checkers.jpeg',
    slug: 'checkers'
  },
  // {
  //   id: 3,
  //   title: 'Monopoly',
  //   description: 'Classic property trading game',
  //   minPlayers: 2,
  //   maxPlayers: 4,
  //   imageUrl: '/game-thumbnail/monopoly.jpeg',
  //   slug: 'monopoly'
  // },
  // {
  //   id: 4,
  //   title: 'Scrabble',
  //   description: 'Word building game with letter tiles',
  //   minPlayers: 2,
  //   maxPlayers: 4,
  //   imageUrl: '/game-thumbnail/scrabble.jpeg',
  //   slug: 'scrabble'
  // },
  {
    id: 5,
    title: 'Connect 4',
    description: 'Tik Tak Toe like game in which the players drops disks to get a 4 in a row',
    minPlayers: 2,
    maxPlayers: 2,
    imageUrl: '/game-thumbnail/connect4.jpeg',
    slug: 'connect4'
  },
  {
    id: 6,
    title: 'Othello',
    description: 'A strategy board game for two players',
    minPlayers: 2,
    maxPlayers: 2,
    imageUrl: '/game-thumbnail/othello.jpeg',
    slug: 'othello'
  },
  {
    id: 7,
    title: 'Snake and Ladder',
    description: 'A simple race game based on sheer luck',
    minPlayers: 2,
    maxPlayers: 4,
    imageUrl: '/game-thumbnail/snake-and-ladder.jpg',
    slug: 'snake-and-ladder'
  },
  {
    id: 8,
    title: 'Ludo',
    description: 'Race all four of your tokens home before your opponents',
    minPlayers: 2,
    maxPlayers: 4,
    imageUrl: '/game-thumbnail/ludo.jpg',
    slug: 'ludo'
  },
  {
    id: 9,
    title: 'Quoridor',
    description: 'Race your pawn to the far side while placing walls to block your opponent',
    minPlayers: 2,
    maxPlayers: 2,
    imageUrl: '/game-thumbnail/quoridor.jpg',
    slug: 'quoridor'
  },
  {
    id: 10,
    title: 'Shut the Box',
    description: 'Roll the dice and flip down tiles to score as low as possible',
    minPlayers: 1,
    maxPlayers: 4,
    imageUrl: '/game-thumbnail/shut_the_box.jpg',
    slug: 'shut-the-box'
  },
  {
    id: 11,
    title: 'Jigsaw Puzzle',
    description: 'Upload your own photo or pick a template, then piece it back together',
    minPlayers: 1,
    maxPlayers: 1,
    imageUrl: '/game-thumbnail/jigsaw-puzzle.svg',
    slug: 'jigsaw-puzzle'
  },
  {
    id: 12,
    title: 'Memory Match',
    description: 'Flip tiles to find matching pairs - pick a topic and how many tiles to play with',
    minPlayers: 1,
    maxPlayers: 1,
    imageUrl: '/game-thumbnail/memory-match.svg',
    slug: 'memory-match'
  },
  {
    id: 13,
    title: 'Mancala',
    description: 'Sow stones around the board and capture your opponent\'s to fill your store',
    minPlayers: 2,
    maxPlayers: 2,
    imageUrl: '/game-thumbnail/mancala.svg',
    slug: 'mancala'
  },
];

export default function Home() {
  return (
    <main className="min-h-screen p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-[#dfdfdf]">Board Game Collection</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="game-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 h-90 flex flex-col"
            >
              <div className="h-48 relative">
                <Image
                  src={game.imageUrl}
                  alt={`${game.title} cover image`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 120x0px) 50vw, 33vw"
                />
              </div>
              <div className="p-4 grow-1 flex flex-col justify-between">
                <h2 className="text-xl font-semibold mb-2 text-slate-800">{game.title}</h2>
                <p className="text-gray-600 mb-3">{game.description}</p>
                <p className="text-sm text-gray-500">
                  Players: {game.minPlayers}{game.maxPlayers !== game.minPlayers ? `-${game.maxPlayers}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}