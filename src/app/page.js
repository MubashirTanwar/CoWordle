'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '@/components/ui/switch';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [settings, setSettings] = useState({ timeLimit: 120, rounds: 3, hardMode: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load saved name
    const saved = localStorage.getItem('cowordle_name');
    if (saved) setPlayerName(saved);
  }, []);

  function getPlayerId() {
    let id = localStorage.getItem('cowordle_id');
    if (!id) { id = uuidv4(); localStorage.setItem('cowordle_id', id); }
    return id;
  }

  function handleCreate() {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    setMode('create');
    setError('');
  }

  function handleJoin() {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    setMode('join');
    setError('');
  }

  function submitCreate() {
    if (!playerName.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    localStorage.setItem('cowordle_name', playerName.trim());

    const playerId = getPlayerId();
    const socket = connectSocket();

    socket.once('room-created', ({ roomCode: code }) => {
      setLoading(false);
      router.push(`/room/${code}`);
    });

    socket.once('error', ({ message }) => {
      setLoading(false);
      setError(message);
    });

    socket.emit('create-room', {
      playerName: playerName.trim(),
      playerId,
      settings,
    });
  }

  function submitJoin() {
    if (!playerName.trim()) { setError('Enter your name'); return; }
    if (!roomCode.trim()) { setError('Enter room code'); return; }
    setLoading(true);
    setError('');
    localStorage.setItem('cowordle_name', playerName.trim());

    const playerId = getPlayerId();
    const socket = connectSocket();
    const code = roomCode.trim().toUpperCase();

    socket.once('room-joined', () => {
      setLoading(false);
      router.push(`/room/${code}`);
    });

    socket.once('error', ({ message }) => {
      setLoading(false);
      setError(message);
    });

    socket.emit('join-room', { roomCode: code, playerName: playerName.trim(), playerId });
  }

  return (
    <div className="min-h-screen bg-[#121213] flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="w-full max-w-sm mb-8">
        <div className="border-b border-[#3a3a3c] pb-4 mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-widest uppercase text-white">CoWordle</h1>
          <p className="text-[#818384] text-sm mt-1">Multiplayer Wordle</p>
        </div>

        {/* Name Input */}
        <div className="mb-4">
          <label className="block text-[#818384] text-xs uppercase tracking-widest mb-2">Your Name</label>
          <input
            type="text"
            maxLength={16}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !mode && handleCreate()}
            placeholder="Enter your name..."
            className="w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded text-white px-4 py-3 text-center text-lg uppercase tracking-widest focus:outline-none focus:border-[#565758] placeholder:normal-case placeholder:tracking-normal"
          />
        </div>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Main Buttons */}
        {!mode && (
          <div className="space-y-3">
            <button
              onClick={handleCreate}
              className="w-full bg-[#538d4e] hover:bg-[#6aaf64] text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={handleJoin}
              className="w-full bg-[#818384] hover:bg-[#9a9b9c] text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
            >
              Join Room
            </button>
          </div>
        )}

        {/* Create Room Form */}
        {mode === 'create' && (
          <div className="space-y-4">
            <div className="bg-[#1a1a1b] border border-[#3a3a3c] rounded p-4 space-y-4">
              <h3 className="text-xs uppercase tracking-widest text-[#818384]">Room Settings</h3>

              <div>
                <label className="block text-xs text-[#818384] mb-2">
                  Time per Round: <span className="text-white font-bold">{settings.timeLimit}s</span>
                </label>
                <input
                  type="range" min={30} max={300} step={15}
                  value={settings.timeLimit}
                  onChange={(e) => setSettings(s => ({ ...s, timeLimit: +e.target.value }))}
                  className="w-full accent-[#538d4e]"
                />
                <div className="flex justify-between text-[10px] text-[#818384] mt-1">
                  <span>30s</span><span>300s</span>
                </div>
              </div>

              <div className="mb-1">
                <label className="block text-xs text-[#818384] mb-2">
                  Rounds: <span className="text-white font-bold">{settings.rounds}</span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 5, 7, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setSettings(s => ({ ...s, rounds: n }))}
                      className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                        settings.rounds === n
                          ? 'bg-[#538d4e] text-white'
                          : 'bg-[#3a3a3c] text-[#818384] hover:bg-[#565758]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#3a3a3c]">
                <div>
                  <p className="text-xs text-white font-bold">Hard Mode</p>
                  <p className="text-[10px] text-[#818384] mt-0.5">Revealed hints must be used in future guesses</p>
                </div>
                <Switch
                  checked={settings.hardMode}
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, hardMode: checked }))}
                />
              </div>
            </div>

            <button
              onClick={submitCreate}
              disabled={loading}
              className="w-full bg-[#538d4e] hover:bg-[#6aaf64] disabled:opacity-50 text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button
              onClick={() => { setMode(null); setError(''); }}
              className="w-full bg-transparent border border-[#3a3a3c] hover:border-[#565758] text-[#818384] hover:text-white font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* Join Room Form */}
        {mode === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[#818384] text-xs uppercase tracking-widest mb-2">Room Code</label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && submitJoin()}
                placeholder="XXXXXX"
                className="w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded text-white px-4 py-3 text-center text-2xl uppercase tracking-[0.5em] focus:outline-none focus:border-[#565758] placeholder:text-[#3a3a3c]"
              />
            </div>

            <button
              onClick={submitJoin}
              disabled={loading}
              className="w-full bg-[#538d4e] hover:bg-[#6aaf64] disabled:opacity-50 text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
            <button
              onClick={() => { setMode(null); setRoomCode(''); setError(''); }}
              className="w-full bg-transparent border border-[#3a3a3c] hover:border-[#565758] text-[#818384] hover:text-white font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>

      {/* Footer tiles decoration */}
      <div className="flex gap-1 opacity-20">
        {['C','O','W','O','R','D','L','E'].map((l, i) => (
          <div
            key={i}
            className="w-8 h-8 flex items-center justify-center text-xs font-bold border border-[#3a3a3c] rounded"
            style={{ backgroundColor: i % 3 === 0 ? '#538d4e' : i % 3 === 1 ? '#b59f3b' : '#3a3a3c' }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
