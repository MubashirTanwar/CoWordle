'use client';
import { useState } from 'react';

export default function LobbyView({ room, playerId, onStart, onSettingsChange }) {
  const isHost = room?.hostId === playerId;
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState(room?.settings || { timeLimit: 120, rounds: 3 });

  function copyCode() {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function updateSettings(newSettings) {
    setSettings(newSettings);
    onSettingsChange(newSettings);
  }

  const connectedPlayers = room?.players?.filter(p => p.isConnected !== false) || [];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-4">
      {/* Room Code */}
      <div className="w-full border border-[#3a3a3c] rounded-lg p-6 mb-6 text-center">
        <p className="text-xs text-[#818384] uppercase tracking-widest mb-2">Room Code</p>
        <button
          onClick={copyCode}
          className="text-4xl font-bold tracking-[0.3em] text-white hover:text-[#538d4e] transition-colors"
        >
          {room?.roomCode}
        </button>
        <p className="text-xs text-[#818384] mt-2">
          {copied ? '✓ Copied!' : 'Click to copy'}
        </p>
      </div>

      {/* Players */}
      <div className="w-full border border-[#3a3a3c] rounded-lg p-4 mb-6">
        <p className="text-xs text-[#818384] uppercase tracking-widest mb-3">
          Players ({connectedPlayers.length})
        </p>
        <div className="space-y-2">
          {connectedPlayers.map((player) => (
            <div key={player.playerId} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold">
                {player.playerName[0].toUpperCase()}
              </div>
              <span className="text-white text-sm">
                {player.playerName}
                {player.playerId === playerId && <span className="text-[#818384] ml-1">(you)</span>}
              </span>
              {player.isHost && <span className="text-[#b59f3b] text-xs ml-auto">HOST 👑</span>}
              <span className="w-2 h-2 rounded-full bg-[#538d4e] ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Settings (host only) */}
      {isHost && (
        <div className="w-full border border-[#3a3a3c] rounded-lg p-4 mb-6">
          <p className="text-xs text-[#818384] uppercase tracking-widest mb-4">Game Settings</p>

          <div className="mb-4">
            <label className="block text-xs text-[#818384] mb-2">
              Time per Round: <span className="text-white font-bold">{settings.timeLimit}s</span>
              <span className="text-[#818384] ml-1">({Math.floor(settings.timeLimit / 60) > 0 ? `${Math.floor(settings.timeLimit / 60)}m ` : ''}{settings.timeLimit % 60}s)</span>
            </label>
            <input
              type="range" min={30} max={300} step={15}
              value={settings.timeLimit}
              onChange={(e) => updateSettings({ ...settings, timeLimit: +e.target.value })}
              className="w-full accent-[#538d4e]"
            />
            <div className="flex justify-between text-[10px] text-[#818384] mt-1">
              <span>30s</span><span>5min</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#818384] mb-2">
              Rounds: <span className="text-white font-bold">{settings.rounds}</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5, 7, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => updateSettings({ ...settings, rounds: n })}
                  className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                    settings.rounds === n
                      ? 'bg-[#538d4e] text-white'
                      : 'bg-[#3a3a3c] text-[#818384] hover:bg-[#565758] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isHost && (
        <div className="w-full border border-[#3a3a3c] rounded-lg p-4 mb-6 text-center">
          <p className="text-xs text-[#818384] uppercase tracking-widest mb-1">Game Settings</p>
          <p className="text-white text-sm">
            {settings.timeLimit}s per round • {settings.rounds} rounds
          </p>
          <p className="text-[#818384] text-xs mt-2">Waiting for host to start...</p>
        </div>
      )}

      {/* Start button */}
      {isHost && (
        <button
          onClick={onStart}
          disabled={connectedPlayers.length < 1}
          className="w-full bg-[#538d4e] hover:bg-[#6aaf64] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
        >
          Start Game
        </button>
      )}
    </div>
  );
}
