'use client';

import BackButton from '@/app/components/BackButton';
import { useSettings } from '@/lib/SettingsContext';
import { playStepSound } from '@/lib/sound';

function VolumeSlider({
  id,
  label,
  value,
  onChange,
  onRelease,
  accentClassName,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
  accentClassName: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label htmlFor={id} className="font-medium text-gray-700">
          {label}
        </label>
        <span className="text-gray-500 tabular-nums">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseUp={onRelease}
        onTouchEnd={onRelease}
        className={`w-full ${accentClassName}`}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { soundVolume, musicVolume, setSoundVolume, setMusicVolume } = useSettings();

  return (
    <div className="min-h-screen flex flex-col items-center p-8 bg-gray-100">
      <BackButton variant="floating" />
      <h1 className="text-3xl font-bold mt-4 mb-8 text-gray-900">Settings</h1>

      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md space-y-8">
        <VolumeSlider
          id="sound-volume"
          label="Sound Effects"
          value={soundVolume}
          onChange={setSoundVolume}
          onRelease={playStepSound}
          accentClassName="accent-blue-600"
        />
        <VolumeSlider
          id="music-volume"
          label="Background Music"
          value={musicVolume}
          onChange={setMusicVolume}
          accentClassName="accent-purple-600"
        />
      </div>

      <p className="text-sm text-gray-500 mt-6 max-w-md text-center">
        These levels apply everywhere on the site and are remembered on this device.
      </p>
    </div>
  );
}
