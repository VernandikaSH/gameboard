'use client';

import Link from 'next/link';
import { FiSettings } from 'react-icons/fi';

export default function SettingsButton() {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className="fixed top-4 right-4 bg-gray-800 p-2 rounded-full shadow-lg z-50 text-white text-xl hover:bg-gray-300 hover:text-gray-800 transition-colors"
    >
      <FiSettings className="w-8 h-8" />
    </Link>
  );
}
