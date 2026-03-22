'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { v4 as uuidv4 } from 'uuid';
import { useToasts } from '@/components/Toast';
import Board from '@/components/Board';
import Keyboard from '@/components/Keyboard';
import Timer from '@/components/Timer';
import PlayerPanel from '@/components/PlayerPanel';
import LobbyView from '@/components/LobbyView';
import RoundEndView from '@/components/RoundEndView';
import GameEndView from '@/components/GameEndView';
import ToastContainer from '@/components/Toast';
import { FlyingEmojis, EmojiBar, useFlyingEmojis } from '@/components/EmojiReactions';

function isValidGuess(word) {
  return /^[A-Za-z]{5}$/.test(word);
}

// ─── Name Prompt (shown when visiting a share link with no saved name) ─────────
function NamePrompt({ roomCode, onJoin }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  function submit() {
    if (!name.trim()) return;
    setLoading(true);
    onJoin(name.trim());
  }

  return (
    <div className="min-h-screen bg-[#121213] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="border-b border-[#3a3a3c] pb-4 mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-widest uppercase">CoWordle</h1>
          <p className="text-[#818384] text-sm mt-1">You're joining room <span className="text-white font-bold tracking-widest">{roomCode}</span></p>
        </div>
        <div className="mb-4">
          <label className="block text-[#818384] text-xs uppercase tracking-widest mb-2">Your Name</label>
          <input
            type="text"
            maxLength={16}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Enter your name..."
            className="w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded text-white px-4 py-3 text-center text-lg uppercase tracking-widest focus:outline-none focus:border-[#565758] placeholder:normal-case placeholder:tracking-normal"
          />
        </div>
        <button
          onClick={submit}
          disabled={loading || !name.trim()}
          className="w-full bg-[#538d4e] hover:bg-[#6aaf64] disabled:opacity-50 text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
        >
          {loading ? 'Joining...' : 'Join Game'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Room Page ────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { roomCode } = useParams();
  const router = useRouter();
  const { toasts, addToast } = useToasts();
  const { emojis, addEmoji } = useFlyingEmojis();

  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const [phase, setPhase] = useState('connecting');
  const [room, setRoom] = useState(null);
  const [roundInfo, setRoundInfo] = useState({ roundNumber: 1, totalRounds: 3, timeLimit: 120 });
  const [roundEndData, setRoundEndData] = useState(null);
  const [gameEndData, setGameEndData] = useState(null);

  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [finished, setFinished] = useState(false);
  const [shakeRow, setShakeRow] = useState(null);
  const [revealRow, setRevealRow] = useState(null);
  const [finishedPlayers, setFinishedPlayers] = useState({});
  const [playerGuesses, setPlayerGuesses] = useState({}); // { [playerId]: { result, tryNumber } }

  const socketRef = useRef(null);
  const finishedRef = useRef(false);
  const playerNameRef = useRef('');

  // ─── Identity init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let id = localStorage.getItem('cowordle_id');
    if (!id) { id = uuidv4(); localStorage.setItem('cowordle_id', id); }
    setPlayerId(id);

    const savedName = localStorage.getItem('cowordle_name');
    if (savedName) {
      setPlayerName(savedName);
      playerNameRef.current = savedName;
    } else {
      setShowNamePrompt(true);
    }
  }, []);

  function handleNameSubmit(name) {
    localStorage.setItem('cowordle_name', name);
    setPlayerName(name);
    playerNameRef.current = name;
    setShowNamePrompt(false);
  }

  // ─── Socket setup (runs once playerId + name are ready) ──────────────────────
  useEffect(() => {
    if (!playerId || showNamePrompt) return;
    const name = playerNameRef.current || playerName;
    if (!name) return;

    const socket = connectSocket();
    socketRef.current = socket;

    // Named handlers so we can cleanly remove exactly these listeners
    const onRoomCreated = ({ room: r }) => {
      setRoom(r);
      setPhase('lobby');
    };

    const onRoomJoined = ({ room: r }) => {
      setRoom(r);
      setPhase('lobby');
    };

    const onSyncState = ({ room: r, phase: serverPhase, roundInfo: ri, guesses: g, finished: fin, gameEndData: ged }) => {
      // If we're not in the room's player list, join first (e.g. share link visitor)
      const amInRoom = r.players?.some((p) => p.playerId === playerId);
      if (!amInRoom) {
        socket.emit('join-room', { roomCode, playerName: name, playerId });
        return; // wait for room-joined response
      }

      setRoom(r);
      if (serverPhase === 'lobby') {
        setPhase('lobby');
      } else if (serverPhase === 'playing') {
        if (ri) {
          setRoundInfo({ roundNumber: ri.roundNumber, totalRounds: ri.totalRounds, timeLimit: ri.timeLimit - ri.elapsed });
        }
        setGuesses(g || []);
        setFinished(fin || false);
        finishedRef.current = fin || false;
        setPhase('playing');
      } else if (serverPhase === 'round-end') {
        setPhase('round-end');
      } else if (serverPhase === 'finished') {
        if (ged) setGameEndData(ged);
        setPhase('game-end');
      }
    };

    const onPlayerJoined = ({ players, playerName: pname }) => {
      setRoom((prev) => prev ? { ...prev, players } : prev);
      if (pname !== name) addToast(`${pname} joined the room`);
    };

    const onPlayerLeft = ({ players, playerName: pname }) => {
      setRoom((prev) => prev ? { ...prev, players } : prev);
      addToast(`${pname} left`);
    };

    const onSettingsUpdated = ({ settings }) => {
      setRoom((prev) => prev ? { ...prev, settings } : prev);
    };

    const onPlayerGuessed = ({ playerId: pid, result, tryNumber }) => {
      setPlayerGuesses((prev) => ({ ...prev, [pid]: { result, tryNumber } }));
    };

    const onEmojiReaction = ({ emoji }) => {
      addEmoji(emoji);
      // No toast — just the flying emoji
    };

    const onGameStarted = ({ roundNumber, totalRounds, timeLimit }) => {
      setRoundInfo({ roundNumber, totalRounds, timeLimit });
      setGuesses([]);
      setCurrentGuess('');
      setFinished(false);
      finishedRef.current = false;
      setPlayerGuesses({});
      setFinishedPlayers({});
      setRoundEndData(null);
      setPhase('playing');
      addToast(`Round ${roundNumber} of ${totalRounds} — GO!`);
    };

    const onGuessResult = ({ guess, result, isCorrect }) => {
      setGuesses((prev) => {
        const newGuesses = [...prev];
        const lastIdx = newGuesses.length - 1;
        if (lastIdx >= 0 && newGuesses[lastIdx].pending) {
          newGuesses[lastIdx] = { word: guess, result, pending: false };
        }
        setRevealRow(lastIdx);
        return newGuesses;
      });

      if (isCorrect) {
        setFinished(true);
        finishedRef.current = true;
        addToast('🎉 You solved it!');
      } else {
        setGuesses((prev) => {
          if (prev.length >= 6) {
            setFinished(true);
            finishedRef.current = true;
          }
          return prev;
        });
      }
    };

    const onPlayerFinished = ({ playerName: pname, playerId: pid, solved, tries, points }) => {
      setFinishedPlayers((prev) => ({ ...prev, [pid]: { solved, tries, points } }));
      if (pid !== playerId) {
        if (solved) addToast(`🟩 ${pname} solved it in ${tries} ${tries === 1 ? 'try' : 'tries'}! (+${points})`);
        else addToast(`${pname} couldn't get it this round`);
      }
    };

    const onRoundEnded = ({ roundNumber, word, results, isLastRound }) => {
      setRoundEndData({ roundNumber, word, results, isLastRound });
      setPhase('round-end');
    };

    const onGameEnded = ({ finalScores, rounds }) => {
      setGameEndData({ finalScores, rounds });
      setPhase('game-end');
    };

    const onInvalidWord = ({ guess }) => {
      setGuesses((prev) => prev.filter((g) => !g.pending));
      setCurrentGuess(guess);
      setGuesses((prev) => { setShakeRow(prev.length); return prev; });
      setTimeout(() => setShakeRow(null), 600);
      addToast('Not in word list');
    };

    const onError = ({ message }) => {
      addToast(`⚠️ ${message}`);
    };

    socket.on('room-created', onRoomCreated);
    socket.on('room-joined', onRoomJoined);
    socket.on('sync-state', onSyncState);
    socket.on('player-joined', onPlayerJoined);
    socket.on('player-left', onPlayerLeft);
    socket.on('settings-updated', onSettingsUpdated);
    socket.on('player-guessed', onPlayerGuessed);
    socket.on('emoji-reaction', onEmojiReaction);
    socket.on('game-started', onGameStarted);
    socket.on('guess-result', onGuessResult);
    socket.on('player-finished', onPlayerFinished);
    socket.on('round-ended', onRoundEnded);
    socket.on('game-ended', onGameEnded);
    socket.on('invalid-word', onInvalidWord);
    socket.on('error', onError);

    // ── Connect: always sync first; onSyncState will join-room if player not in room ──
    socket.emit('request-sync', { roomCode, playerId });

    return () => {
      socket.off('room-created', onRoomCreated);
      socket.off('room-joined', onRoomJoined);
      socket.off('sync-state', onSyncState);
      socket.off('player-joined', onPlayerJoined);
      socket.off('player-left', onPlayerLeft);
      socket.off('settings-updated', onSettingsUpdated);
      socket.off('player-guessed', onPlayerGuessed);
      socket.off('emoji-reaction', onEmojiReaction);
      socket.off('game-started', onGameStarted);
      socket.off('guess-result', onGuessResult);
      socket.off('player-finished', onPlayerFinished);
      socket.off('round-ended', onRoundEnded);
      socket.off('game-ended', onGameEnded);
      socket.off('invalid-word', onInvalidWord);
      socket.off('error', onError);
    };
  }, [playerId, showNamePrompt]);

  // ─── Keyboard handler ─────────────────────────────────────────────────────────
  const handleKey = useCallback((key) => {
    if (finishedRef.current || phase !== 'playing') return;

    if (key === '⌫' || key === 'Backspace') {
      setCurrentGuess((prev) => prev.slice(0, -1));
      return;
    }

    if (key === 'ENTER' || key === 'Enter') {
      if (currentGuess.length !== 5) {
        setShakeRow(guesses.length);
        setTimeout(() => setShakeRow(null), 600);
        addToast('Not enough letters');
        return;
      }
      if (!isValidGuess(currentGuess)) {
        setShakeRow(guesses.length);
        setTimeout(() => setShakeRow(null), 600);
        addToast('Letters only');
        return;
      }
      const word = currentGuess;
      socketRef.current?.emit('submit-guess', { roomCode, playerId, guess: word });
      setGuesses((g) => [...g, { word, result: null, pending: true }]);
      setCurrentGuess('');
      return;
    }

    if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => (prev.length < 5 ? prev + key.toUpperCase() : prev));
    }
  }, [phase, guesses.length, currentGuess, roomCode, playerId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Prevent Enter from scrolling/submitting forms and Backspace from navigating back
      if (e.key === 'Enter' || e.key === 'Backspace') e.preventDefault();
      handleKey(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  function handleStart() {
    socketRef.current?.emit('start-game', { roomCode, playerId });
  }

  function handleSettingsChange(settings) {
    socketRef.current?.emit('update-settings', { roomCode, playerId, settings });
  }

  // ─── Share link ───────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  function copyShareLink() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomCode}` : '';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (showNamePrompt) {
    return <NamePrompt roomCode={roomCode} onJoin={handleNameSubmit} />;
  }

  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-[#121213] flex items-center justify-center">
        <div className="text-[#818384] text-sm animate-pulse uppercase tracking-widest">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121213] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#3a3a3c] flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={() => router.push('/')} className="text-[#818384] hover:text-white text-xl w-8">←</button>
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-widest">CoWordle</h1>
          <button
            onClick={copyShareLink}
            className="text-[10px] text-[#818384] hover:text-white uppercase tracking-widest transition-colors"
          >
            {copied ? '✓ Link copied!' : `${roomCode} · Share`}
          </button>
        </div>
        <div className="w-8" />
      </header>

      <ToastContainer toasts={toasts} />
      <FlyingEmojis emojis={emojis} />

      <main className="flex-1 flex flex-col items-center overflow-auto">
        {phase === 'lobby' && (
          <div className="w-full pt-6">
            <LobbyView
              room={room}
              playerId={playerId}
              onStart={handleStart}
              onSettingsChange={handleSettingsChange}
            />
          </div>
        )}

        {phase === 'playing' && (
          <div className="flex flex-col lg:flex-row items-start justify-center gap-4 w-full max-w-4xl px-2 pt-4">
            <div className="flex flex-col items-center gap-3 w-full lg:max-w-sm">
              <div className="flex items-center gap-4">
                <Timer
                  timeLimit={roundInfo.timeLimit}
                  onExpire={() => {}}
                />
                {finished && (
                  <div className="text-[#818384] text-sm">Waiting for others...</div>
                )}
              </div>

              <Board
                guesses={guesses}
                currentGuess={finished ? '' : currentGuess}
                shakeRow={shakeRow}
                revealRow={revealRow}
              />

              <Keyboard
                guesses={guesses}
                onKey={handleKey}
                disabled={finished}
              />

              {/* Emoji bar */}
              <div className="w-full border-t border-[#3a3a3c] pt-3 mt-1">
                <EmojiBar onSend={(emoji) => {
                  socketRef.current?.emit('send-emoji', { roomCode, playerName, emoji });
                  addEmoji(emoji);
                }} />
              </div>
            </div>

            <div className="lg:pt-16 w-full lg:w-auto">
              <PlayerPanel
                players={room?.players || []}
                finishedPlayers={finishedPlayers}
                playerGuesses={playerGuesses}
                currentPlayerId={playerId}
                roundNumber={roundInfo.roundNumber}
                totalRounds={roundInfo.totalRounds}
              />
            </div>
          </div>
        )}

        {phase === 'round-end' && roundEndData && (
          <>
            <div className="flex flex-col items-center gap-4 pt-4 opacity-30 pointer-events-none">
              <Board guesses={guesses} currentGuess="" shakeRow={null} revealRow={null} />
            </div>
            <RoundEndView
              roundNumber={roundEndData.roundNumber}
              word={roundEndData.word}
              results={roundEndData.results}
              isLastRound={roundEndData.isLastRound}
              totalRounds={roundInfo.totalRounds}
            />
          </>
        )}

        {phase === 'game-end' && gameEndData && (
          <div className="w-full pt-4">
            <GameEndView
              finalScores={gameEndData.finalScores}
              rounds={gameEndData.rounds}
              playerId={playerId}
            />
          </div>
        )}
      </main>
    </div>
  );
}
