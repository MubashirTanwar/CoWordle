'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useToasts } from '@/components/Toast';
import Board from '@/components/Board';
import Keyboard from '@/components/Keyboard';
import Timer from '@/components/Timer';
import PlayerPanel from '@/components/PlayerPanel';
import LobbyView from '@/components/LobbyView';
import RoundEndView from '@/components/RoundEndView';
import GameEndView from '@/components/GameEndView';
import ToastContainer from '@/components/Toast';

// ─── Valid 5-letter words for client-side validation (basic) ─────────────────
// We trust the server for full validation; client just checks length + alpha
function isValidGuess(word) {
  return /^[A-Za-z]{5}$/.test(word);
}

export default function RoomPage() {
  const { roomCode } = useParams();
  const router = useRouter();
  const { toasts, addToast } = useToasts();

  // Identity
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');

  // Room/game state
  const [phase, setPhase] = useState('connecting'); // connecting | lobby | playing | round-end | game-end
  const [room, setRoom] = useState(null);
  const [roundInfo, setRoundInfo] = useState({ roundNumber: 1, totalRounds: 3, timeLimit: 120 });
  const [roundEndData, setRoundEndData] = useState(null);
  const [gameEndData, setGameEndData] = useState(null);

  // Wordle game state
  const [guesses, setGuesses] = useState([]); // [{word, result}]
  const [currentGuess, setCurrentGuess] = useState('');
  const [finished, setFinished] = useState(false);
  const [shakeRow, setShakeRow] = useState(null);
  const [revealRow, setRevealRow] = useState(null);
  const [finishedPlayers, setFinishedPlayers] = useState({});

  const socketRef = useRef(null);
  const finishedRef = useRef(false);

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = localStorage.getItem('cowordle_id');
    const name = localStorage.getItem('cowordle_name');
    if (!id || !name) { router.push('/'); return; }
    setPlayerId(id);
    setPlayerName(name);
  }, []);

  // ─── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerId) return;

    const socket = connectSocket();
    socketRef.current = socket;

    // ── Handlers ──
    socket.on('room-created', ({ room: r }) => {
      setRoom(r);
      setPhase('lobby');
    });

    socket.on('room-joined', ({ room: r }) => {
      setRoom(r);
      setPhase('lobby');
    });

    socket.on('player-joined', ({ players, playerName: name }) => {
      setRoom((prev) => prev ? { ...prev, players } : prev);
      addToast(`${name} joined the room`);
    });

    socket.on('player-left', ({ players, playerName: name }) => {
      setRoom((prev) => prev ? { ...prev, players } : prev);
      addToast(`${name} left`);
    });

    socket.on('settings-updated', ({ settings }) => {
      setRoom((prev) => prev ? { ...prev, settings } : prev);
      setRoundInfo((prev) => ({ ...prev, timeLimit: settings.timeLimit, totalRounds: settings.rounds }));
    });

    socket.on('game-started', ({ roundNumber, totalRounds, timeLimit }) => {
      setRoundInfo({ roundNumber, totalRounds, timeLimit });
      setGuesses([]);
      setCurrentGuess('');
      setFinished(false);
      finishedRef.current = false;
      setFinishedPlayers({});
      setRoundEndData(null);
      setPhase('playing');
      addToast(`Round ${roundNumber} of ${totalRounds} — GO!`);
    });

    socket.on('guess-result', ({ guess, result, isCorrect }) => {
      // Update the pending row (last guess) with the real result, then animate
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
    });

    socket.on('player-finished', ({ playerName: name, playerId: pid, solved, tries, timeTaken, points }) => {
      setFinishedPlayers((prev) => ({ ...prev, [pid]: { solved, tries, timeTaken, points } }));
      if (pid !== playerId) {
        if (solved) {
          addToast(`🟩 ${name} solved it in ${tries} ${tries === 1 ? 'try' : 'tries'}! (+${points})`);
        } else {
          addToast(`${name} couldn't get it this round`);
        }
      }
    });

    socket.on('round-ended', ({ roundNumber, word, results, isLastRound }) => {
      setRoundEndData({ roundNumber, word, results, isLastRound });
      setPhase('round-end');
    });

    socket.on('game-ended', ({ finalScores, rounds }) => {
      setGameEndData({ finalScores, rounds });
      setPhase('game-end');
    });

    socket.on('invalid-word', ({ guess }) => {
      // Remove the pending row, restore the word into currentGuess, shake
      setGuesses((prev) => prev.filter((g) => !g.pending));
      setCurrentGuess(guess);
      setGuesses((prev) => { setShakeRow(prev.length); return prev; });
      setTimeout(() => setShakeRow(null), 600);
      addToast('Not in word list');
    });

    socket.on('error', ({ message }) => {
      addToast(`⚠️ ${message}`);
    });

    // ── Sync room state ──
    // If we came from "create-room" on the home page, room-created already fired.
    // If the socket reconnected (e.g. page refresh), re-join to get the room state.
    // We check if socket already has room state via a quick ping — otherwise re-join.
    socket.emit('join-room', { roomCode, playerName: localStorage.getItem('cowordle_name') || playerName, playerId });

    return () => {
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('settings-updated');
      socket.off('game-started');
      socket.off('guess-result');
      socket.off('player-finished');
      socket.off('round-ended');
      socket.off('game-ended');
      socket.off('invalid-word');
      socket.off('error');
    };
  }, [playerId]);

  // ─── Keyboard handler ────────────────────────────────────────────────────────
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
      // Submit — immediately move word to a pending row and clear input
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

  // Physical keyboard
  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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

  // ─── Render ──────────────────────────────────────────────────────────────────
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
      <header className="border-b border-[#3a3a3c] flex items-center justify-between px-4 py-3">
        <button onClick={() => router.push('/')} className="text-[#818384] hover:text-white text-xl">←</button>
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-widest">CoWordle</h1>
          {phase === 'playing' && (
            <p className="text-[10px] text-[#818384] uppercase tracking-widest">
              Round {roundInfo.roundNumber}/{roundInfo.totalRounds} • {roomCode}
            </p>
          )}
          {phase === 'lobby' && (
            <p className="text-[10px] text-[#818384] uppercase tracking-widest">{roomCode}</p>
          )}
        </div>
        <div className="w-8" />
      </header>

      {/* Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Content */}
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
          <div className="flex flex-col lg:flex-row items-start justify-center gap-4 w-full max-w-4xl px-4 pt-4">
            {/* Game area */}
            <div className="flex flex-col items-center gap-4 flex-1">
              {/* Timer + status */}
              <div className="flex items-center gap-4">
                <Timer
                  timeLimit={roundInfo.timeLimit}
                  active={!finished}
                  onExpire={() => {}} // server handles expiry
                />
                {finished && (
                  <div className="text-[#818384] text-sm">
                    Waiting for other players...
                  </div>
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
            </div>

            {/* Player panel */}
            <div className="lg:pt-16">
              <PlayerPanel
                players={room?.players || []}
                finishedPlayers={finishedPlayers}
                currentPlayerId={playerId}
                roundNumber={roundInfo.roundNumber}
                totalRounds={roundInfo.totalRounds}
              />
            </div>
          </div>
        )}

        {(phase === 'round-end' || phase === 'game-end') && phase === 'round-end' && roundEndData && (
          <>
            {/* Show the board from last round underneath */}
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
