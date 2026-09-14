'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { connectSocket, type ClientSocket } from '@/lib/socket';
import { getPlayerId, getSavedName, saveName } from '@/lib/player';
import { cycleMark, type BoardGuess, type LetterMarks } from '@/lib/types';
import { useToasts } from '@/components/Toast';
import Board from '@/components/Board';
import Keyboard from '@/components/Keyboard';
import Timer from '@/components/Timer';
import PlayerPanel, { type FinishedInfo, type GuessInfo } from '@/components/PlayerPanel';
import LobbyView from '@/components/LobbyView';
import RoundEndView from '@/components/RoundEndView';
import GameEndView from '@/components/GameEndView';
import ToastContainer from '@/components/Toast';
import { FlyingEmojis, EmojiBar, useFlyingEmojis } from '@/components/EmojiReactions';
import ChatBubbles from '@/components/ChatBubbles';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { VARIANT_INFO } from '@/components/VariantPicker';
import { checkHardMode, getKeyStates } from '@shared/wordle';
import { MAX_GUESSES } from '@shared/types';
import type { ChatMessage, GameEndData, Room, RoomSettings, Variant } from '@shared/types';
import {
  Events,
  type EmojiReaction,
  type ErrorPayload,
  type GameStarted,
  type GuessResult,
  type InvalidWord,
  type PlayAgainRedirect,
  type PlayerFinished,
  type PlayerGuessed,
  type PlayersChanged,
  type RoomJoined,
  type RoundEnded,
  type SettingsUpdated,
  type SyncState,
} from '@shared/events';

type Phase = 'connecting' | 'lobby' | 'playing' | 'round-end' | 'game-end';
type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'connecting';

interface ClientRoundInfo {
  roundNumber: number;
  totalRounds: number;
  timeLimit: number;
  originalTimeLimit: number;
}

function isValidGuess(word: string) {
  return /^[A-Za-z]{5}$/.test(word);
}

// ─── Connection status dot (top-right debug indicator) ────────────────────────
function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const styles: Record<ConnectionStatus, string> = {
    connected:    'bg-green-500',
    reconnecting: 'bg-yellow-400 animate-pulse',
    disconnected: 'bg-red-500',
    connecting:   'bg-yellow-400 animate-pulse',
  };
  const labels: Record<ConnectionStatus, string> = {
    connected:    'Connected',
    reconnecting: 'Reconnecting…',
    disconnected: 'Disconnected',
    connecting:   'Connecting…',
  };
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${styles[status] ?? 'bg-gray-500'}`}
      title={labels[status] ?? status}
    />
  );
}

// ─── Name Prompt (shown when visiting a share link with no saved name) ─────────
function NamePrompt({ roomCode, onJoin }: { roomCode: string; onJoin: (name: string) => void }) {
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
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const { toasts, addToast } = useToasts();
  const { emojis, addEmoji } = useFlyingEmojis();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const [phase, setPhase] = useState<Phase>('connecting');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roundInfo, setRoundInfo] = useState<ClientRoundInfo>({ roundNumber: 1, totalRounds: 3, timeLimit: 120, originalTimeLimit: 120 });
  const [roundEndData, setRoundEndData] = useState<RoundEnded | null>(null);
  const [gameEndData, setGameEndData] = useState<GameEndData | null>(null);

  const [hardMode, setHardMode] = useState(false);
  const hardModeRef = useRef(false);
  const [variant, setVariant] = useState<Variant>('classic');
  const variantRef = useRef<Variant>('classic');

  const [guesses, setGuesses] = useState<BoardGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [finished, setFinished] = useState(false);
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [marks, setMarks] = useState<LetterMarks>({});
  const [finishedPlayers, setFinishedPlayers] = useState<Record<string, FinishedInfo>>({});
  const [playerGuesses, setPlayerGuesses] = useState<Record<string, GuessInfo>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const socketRef = useRef<ClientSocket | null>(null);
  const phaseRef = useRef<Phase>('connecting');
  phaseRef.current = phase;
  const finishedRef = useRef(false);
  const playerNameRef = useRef('');
  const playerIdRef = useRef<string | null>(null);

  function applyVariant(v: Variant) {
    setVariant(v);
    variantRef.current = v;
  }

  function applyHardMode(hm: boolean) {
    setHardMode(hm);
    hardModeRef.current = hm;
  }

  // ─── Identity init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = getPlayerId();
    setPlayerId(id);
    playerIdRef.current = id;

    const savedName = getSavedName();
    if (savedName) {
      setPlayerName(savedName);
      playerNameRef.current = savedName;
    } else {
      setShowNamePrompt(true);
    }
  }, []);

  function handleNameSubmit(name: string) {
    saveName(name);
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

    // ── Connection lifecycle handlers ──
    const onConnect = () => {
      setConnectionStatus('connected');
      // Re-sync on every (re)connect to restore full game state
      socket.emit(Events.REQUEST_SYNC, { roomCode, playerId });
    };

    const onDisconnect = (reason: string) => {
      // 'io client disconnect' = intentional (e.g. navigating away)
      // anything else = unexpected drop → will auto-reconnect
      setConnectionStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
    };

    const onConnectError = () => {
      setConnectionStatus('reconnecting');
    };

    // ── Game event handlers ──
    const onRoomJoined = ({ room: r }: RoomJoined) => {
      setRoom(r);
      applyVariant(r.settings.variant);
      applyHardMode(r.settings.hardMode);
      setPhase('lobby');
    };

    const onMessageReceived = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onSyncState = ({ room: r, phase: serverPhase, roundInfo: ri, guesses: g, finished: fin, gameEndData: ged, messages: msgs }: SyncState) => {
      if (msgs) setMessages(msgs);
      // If we're not in the room's player list, join first (e.g. share link visitor)
      const amInRoom = r.players?.some((p) => p.playerId === playerId);
      if (!amInRoom) {
        socket.emit(Events.JOIN_ROOM, { roomCode, playerName: name, playerId });
        return; // wait for room-joined response
      }

      setRoom(r);
      applyHardMode(r.settings?.hardMode || false);
      applyVariant(r.settings?.variant || 'classic');
      if (serverPhase === 'lobby') {
        setPhase('lobby');
      } else if (serverPhase === 'playing') {
        if (ri) {
          setRoundInfo({ roundNumber: ri.roundNumber, totalRounds: ri.totalRounds, timeLimit: ri.timeLimit - ri.elapsed, originalTimeLimit: ri.timeLimit });
          applyHardMode(ri.hardMode);
          applyVariant(ri.variant);
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

    const onPlayerJoined = ({ players, playerName: pname }: PlayersChanged) => {
      setRoom((prev) => prev ? { ...prev, players } : prev);
      if (pname !== name) addToast(`${pname} joined the room`);
    };

    const onPlayerLeft = ({ players, playerName: pname }: PlayersChanged) => {
      setRoom((prev) => prev ? { ...prev, players } : prev);
      addToast(`${pname} left`);
    };

    const onSettingsUpdated = ({ settings }: SettingsUpdated) => {
      setRoom((prev) => prev ? { ...prev, settings } : prev);
      applyHardMode(settings.hardMode);
      applyVariant(settings.variant);
    };

    const onPlayerGuessed = ({ playerId: pid, result, counts, tryNumber }: PlayerGuessed) => {
      setPlayerGuesses((prev) => ({ ...prev, [pid]: { result, counts, tryNumber } }));
    };

    const onEmojiReaction = ({ emoji, playerName: pname }: EmojiReaction) => {
      addEmoji(emoji, pname);
    };

    const onGameStarted = ({ roundNumber, totalRounds, timeLimit, hardMode: hm, variant: v }: GameStarted) => {
      applyHardMode(hm);
      applyVariant(v);
      setRoundInfo({ roundNumber, totalRounds, timeLimit, originalTimeLimit: timeLimit });
      setGuesses([]);
      setMarks({});
      setCurrentGuess('');
      setFinished(false);
      finishedRef.current = false;
      setPlayerGuesses({});
      setFinishedPlayers({});
      setRoundEndData(null);
      setPhase('playing');
      addToast(`Round ${roundNumber} of ${totalRounds} — GO!`);
    };

    const onGuessResult = ({ guess, result, counts, isCorrect }: GuessResult) => {
      setGuesses((prev) => {
        const newGuesses = [...prev];
        const lastIdx = newGuesses.length - 1;
        if (lastIdx >= 0 && newGuesses[lastIdx].pending) {
          newGuesses[lastIdx] = { word: guess, result, counts, pending: false };
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
          if (prev.length >= MAX_GUESSES[variantRef.current]) {
            setFinished(true);
            finishedRef.current = true;
          }
          return prev;
        });
      }
    };

    const onPlayerFinished = ({ playerName: pname, playerId: pid, solved, tries, points }: PlayerFinished) => {
      setFinishedPlayers((prev) => ({ ...prev, [pid]: { solved, tries, points } }));
      if (pid !== playerId) {
        if (solved) addToast(`🟩 ${pname} solved it in ${tries} ${tries === 1 ? 'try' : 'tries'}! (+${points})`);
        else addToast(`${pname} couldn't get it this round`);
      }
    };

    const onRoundEnded = (data: RoundEnded) => {
      setRoundEndData(data);
      setPhase('round-end');
    };

    const onGameEnded = ({ finalScores, rounds }: GameEndData) => {
      setGameEndData({ finalScores, rounds });
      setPhase('game-end');
    };

    const onInvalidWord = ({ guess, message }: InvalidWord) => {
      setGuesses((prev) => prev.filter((g) => !g.pending));
      setCurrentGuess(guess);
      setGuesses((prev) => { setShakeRow(prev.length); return prev; });
      setTimeout(() => setShakeRow(null), 600);
      addToast(message);
    };

    const onError = ({ message }: ErrorPayload) => {
      // If we haven't joined yet, show a blocking error screen instead of a toast
      if (phaseRef.current === 'connecting' || !socketRef.current?.connected) {
        setJoinError(message);
      } else {
        addToast(`⚠️ ${message}`);
      }
    };

    const onPlayAgainRedirect = ({ roomCode: newCode }: PlayAgainRedirect) => {
      router.push(`/room/${newCode}`);
    };

    // Register all handlers
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(Events.ROOM_CREATED, onRoomJoined);
    socket.on(Events.ROOM_JOINED, onRoomJoined);
    socket.on(Events.SYNC_STATE, onSyncState);
    socket.on(Events.PLAYER_JOINED, onPlayerJoined);
    socket.on(Events.PLAYER_LEFT, onPlayerLeft);
    socket.on(Events.SETTINGS_UPDATED, onSettingsUpdated);
    socket.on(Events.PLAYER_GUESSED, onPlayerGuessed);
    socket.on(Events.EMOJI_REACTION, onEmojiReaction);
    socket.on(Events.GAME_STARTED, onGameStarted);
    socket.on(Events.GUESS_RESULT, onGuessResult);
    socket.on(Events.PLAYER_FINISHED, onPlayerFinished);
    socket.on(Events.ROUND_ENDED, onRoundEnded);
    socket.on(Events.GAME_ENDED, onGameEnded);
    socket.on(Events.INVALID_WORD, onInvalidWord);
    socket.on(Events.ERROR, onError);
    socket.on(Events.MESSAGE_RECEIVED, onMessageReceived);
    socket.on(Events.PLAY_AGAIN_REDIRECT, onPlayAgainRedirect);

    // If already connected (e.g. HMR or re-mount), sync immediately
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(Events.ROOM_CREATED, onRoomJoined);
      socket.off(Events.ROOM_JOINED, onRoomJoined);
      socket.off(Events.SYNC_STATE, onSyncState);
      socket.off(Events.PLAYER_JOINED, onPlayerJoined);
      socket.off(Events.PLAYER_LEFT, onPlayerLeft);
      socket.off(Events.SETTINGS_UPDATED, onSettingsUpdated);
      socket.off(Events.PLAYER_GUESSED, onPlayerGuessed);
      socket.off(Events.EMOJI_REACTION, onEmojiReaction);
      socket.off(Events.GAME_STARTED, onGameStarted);
      socket.off(Events.GUESS_RESULT, onGuessResult);
      socket.off(Events.PLAYER_FINISHED, onPlayerFinished);
      socket.off(Events.ROUND_ENDED, onRoundEnded);
      socket.off(Events.GAME_ENDED, onGameEnded);
      socket.off(Events.INVALID_WORD, onInvalidWord);
      socket.off(Events.ERROR, onError);
      socket.off(Events.MESSAGE_RECEIVED, onMessageReceived);
      socket.off(Events.PLAY_AGAIN_REDIRECT, onPlayAgainRedirect);
    };
  }, [playerId, showNamePrompt]);

  // ─── Keyboard handler ─────────────────────────────────────────────────────────
  const handleKey = useCallback((key: string) => {
    if (finishedRef.current || phase !== 'playing' || !playerId) return;

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
      if (hardModeRef.current) {
        const err = checkHardMode(currentGuess, guesses.filter((g) => !g.pending));
        if (err) {
          setShakeRow(guesses.length);
          setTimeout(() => setShakeRow(null), 600);
          addToast(err);
          return;
        }
      }
      const word = currentGuess;
      socketRef.current?.emit(Events.SUBMIT_GUESS, { roomCode, playerId, guess: word });
      setGuesses((g) => [...g, { word, pending: true }]);
      setCurrentGuess('');
      return;
    }

    if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => (prev.length < 5 ? prev + key.toUpperCase() : prev));
    }
  }, [phase, guesses, currentGuess, roomCode, playerId, addToast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Don't intercept typing in chat or other inputs
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      // Prevent Enter from scrolling/submitting forms and Backspace from navigating back
      if (e.key === 'Enter' || e.key === 'Backspace') e.preventDefault();
      handleKey(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  function handleStart() {
    if (!playerId) return;
    socketRef.current?.emit(Events.START_GAME, { roomCode, playerId });
  }

  function handleSettingsChange(settings: RoomSettings) {
    if (!playerId) return;
    socketRef.current?.emit(Events.UPDATE_SETTINGS, { roomCode, playerId, settings });
  }

  function sendMessage(text: string) {
    socketRef.current?.emit(Events.SEND_MESSAGE, { roomCode, playerName, text });
  }

  function handlePlayAgain() {
    if (!playerId) return;
    socketRef.current?.emit(Events.PLAY_AGAIN, { roomCode, playerId, settings: room?.settings });
  }

  // Word500: player colours letters themselves by tapping tiles
  const keyStates = useMemo(() => (variant === 'word500' ? marks : getKeyStates(guesses)), [variant, marks, guesses]);
  const toggleMark = useCallback((letter: string) => setMarks((m) => cycleMark(m, letter)), []);

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

  if (joinError) {
    return (
      <div className="min-h-screen bg-[#121213] flex flex-col items-center justify-center px-4 gap-4">
        <div className="text-5xl">🔒</div>
        <p className="text-white font-bold text-lg uppercase tracking-widest">Game In Progress</p>
        <p className="text-[#818384] text-sm text-center">{joinError}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-2 bg-[#538d4e] hover:bg-[#6aaf64] text-white font-bold py-3 px-8 rounded text-sm uppercase tracking-widest transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
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
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-lg font-bold uppercase tracking-widest">CoWordle</h1>
            {variant === 'word500' && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[10px] font-bold text-[#538d4e] border border-[#538d4e] rounded px-1.5 py-0.5 leading-tight hover:bg-[#538d4e]/10 transition-colors">
                    {VARIANT_INFO.word500.label}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#538d4e] mb-2">Word500</p>
                  <ul className="text-xs text-[#818384] space-y-1.5">
                    <li>Each guess only tells you <span className="text-white">how many</span> letters are:</li>
                    <li className="flex gap-2"><span className="text-[#538d4e] font-bold">■</span>right letter, right spot</li>
                    <li className="flex gap-2"><span className="text-[#b59f3b] font-bold">■</span>right letter, wrong spot</li>
                    <li className="flex gap-2"><span className="text-[#c0392b] font-bold">■</span>not in the word</li>
                    <li>Tap letters on the board to keep your own notes. You get {MAX_GUESSES.word500} tries.</li>
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            {hardMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[10px] font-bold text-[#b59f3b] border border-[#b59f3b] rounded px-1.5 py-0.5 leading-tight hover:bg-[#b59f3b]/10 transition-colors">
                    ?
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#b59f3b] mb-2">Hard Mode</p>
                  <ul className="text-xs text-[#818384] space-y-1.5">
                    <li className="flex gap-2">
                      <span className="text-[#538d4e] font-bold">■</span>
                      Green letters must stay in the same position
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#b59f3b] font-bold">■</span>
                      Yellow letters must be used somewhere in the guess
                    </li>
                  </ul>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <button
            onClick={copyShareLink}
            className="text-[10px] text-[#818384] hover:text-white uppercase tracking-widest transition-colors"
          >
            {copied ? '✓ Link copied!' : `${roomCode} · Share`}
          </button>
        </div>
        {/* Status dot + reload button */}
        <div className="flex items-center gap-2">
          <ConnectionDot status={connectionStatus} />
          <button
            onClick={() => window.location.reload()}
            className="text-[#818384] hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-[#3a3a3c] transition-colors"
            title="Reload page"
          >
            ↻
          </button>
        </div>
      </header>

      <ToastContainer toasts={toasts} />
      <FlyingEmojis emojis={emojis} />
      <ChatBubbles messages={messages} onSend={sendMessage} />

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
                  maxTime={roundInfo.originalTimeLimit}
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
                variant={variant}
                marks={marks}
                onTileClick={toggleMark}
              />

              {variant === 'word500' && !finished && (
                <p className="text-[10px] text-[#818384] -mt-1">Tap a letter on the board to mark it 🟥 → 🟨 → 🟩</p>
              )}

              <Keyboard
                keyStates={keyStates}
                onKey={handleKey}
                disabled={finished}
                variant={variant}
              />

              {/* Emoji bar */}
              <div className="w-full border-t border-[#3a3a3c] pt-3 mt-1">
                <EmojiBar onSend={(emoji) => {
                  socketRef.current?.emit(Events.SEND_EMOJI, { roomCode, playerName, emoji });
                  addEmoji(emoji, playerName);
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
                maxGuesses={MAX_GUESSES[variant]}
              />
            </div>
          </div>
        )}

        {phase === 'round-end' && roundEndData && (
          <>
            <div className="flex flex-col items-center gap-4 pt-4 opacity-30 pointer-events-none">
              <Board guesses={guesses} currentGuess="" shakeRow={null} revealRow={null} variant={variant} marks={marks} />
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
              onPlayAgain={handlePlayAgain}
            />
          </div>
        )}
      </main>
    </div>
  );
}
