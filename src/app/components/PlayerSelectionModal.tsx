// app/components/PlayerSelectionModal.tsx
import React from 'react';

interface PlayerSelectionModalProps {
  onSelectPlayers: (num: number) => void;
}

const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({ onSelectPlayers }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">Select Number of Players</h2>
        <div className="flex flex-col gap-4">
          {[2, 3, 4].map(num => (
            <button
              key={num}
              onClick={() => onSelectPlayers(num)}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg font-medium"
            >
              {num} Players
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlayerSelectionModal;