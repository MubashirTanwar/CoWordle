'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Board from '@/components/Board';
import Keyboard from '@/components/Keyboard';
import ToastContainer, { useToasts } from '@/components/Toast';
import VariantPicker, { VARIANT_INFO } from '@/components/VariantPicker';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { useNewSoloGame, useSoloGuess } from '@/lib/queries';
import { cycleMark, type BoardGuess, type LetterMarks } from '@/lib/types';
import { checkHardMode, getKeyStates } from '@shared/wordle';
import type { Variant } from '@shared/types';
import type { SoloGame } from '@shared/api';

// ─── Drill stats (per variant, kept in localStorage) ──────────────────────────

interface DrillStats {
  played: number;
  solved: number;
  streak: number;
  bestStreak: number;
  totalTries: number; // across solved games, for the average
}

const EMPTY_STATS: DrillStats = { played: 0, solved: 0, streak: 0, bestStreak: 0, totalTries: 0 };
const statsKey = (v: Variant) => `cowordle_solo_stats_${v}`;
const PREFS_KEY = 'cowordle_solo_prefs';

function loadStats(v: Variant): DrillStats {
  try {
    return { ...EMPTY_STATS, ...JSON.parse(localStorage.getItem(statsKey(v)) ?? '{}') };
  } catch {
    return EMPTY_STATS;
  }
}

function recordResult(v: Variant, solved: boolean, tries: number): DrillStats {
  const s = loadStats(v);
  const streak = solved ? s.streak + 1 : 0;
  const next: DrillStats = {
    played: s.played + 1,
    solved: s.solved + (solved ? 1 : 0),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    totalTries: s.totalTries + (solved ? tries : 0),
  };
  localStorage.setItem(statsKey(v), JSON.stringify(next));
  return next;
}

interface Outcome {
  solved: boolean;
  answer: string;
  tries: number;
}

export default function SoloPage() {
  const router = useRouter();
  const { toasts, addToast } = useToasts();

  const [variant, setVariant] = useState<Variant>('classic');
  const [hardMode, setHardMode] = useState(false);
  const [game, setGame] = useState<SoloGame | null>(null);
  const [guesses, setGuesses] = useState<BoardGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [marks, setMarks] = useState<LetterMarks>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stats, setStats] = useState<DrillStats>(EMPTY_STATS);

  const newGame = useNewSoloGame();
  const guessMutation = useSoloGuess(game?.gameId);
  const startedRef = useRef(false);

  const activeVariant = game?.variant ?? variant;

  const shake = useCallback((row: number, message: string) => {
    setShakeRow(row);
    setTimeout(() => setShakeRow(null), 600);
    addToast(message);
  }, [addToast]);

  const startGame = useCallback((v: Variant, hm: boolean) => {
    newGame.mutate(
      { variant: v, hardMode: v === 'classic' && hm },
      {
        onSuccess: (g) => {
          setGame(g);
          setGuesses([]);
          setCurrentGuess('');
          setMarks({});
          setOutcome(null);
          setRevealRow(null);
          setStats(loadStats(g.variant));
        },
        onError: (err) => addToast(err.message),
      },
    );
  }, [newGame, addToast]);

  // Restore last-used options and deal the first word
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let v: Variant = 'classic';
    let hm = false;
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
      if (prefs.variant === 'word500' || prefs.variant === 'classic') v = prefs.variant;
      hm = !!prefs.hardMode;
    } catch { /* ignore */ }
    setVariant(v);
    setHardMode(hm);
    startGame(v, hm);
  }, [startGame]);

  function changeOptions(v: Variant, hm: boolean) {
    const nextHm = v === 'classic' && hm;
    setVariant(v);
    setHardMode(nextHm);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ variant: v, hardMode: nextHm }));
    startGame(v, nextHm);
  }

  const handleKey = useCallback((key: string) => {
    if (!game || outcome || guessMutation.isPending) return;

    if (key === '⌫' || key === 'Backspace') {
      setCurrentGuess((prev) => prev.slice(0, -1));
      return;
    }

    if (key === 'ENTER' || key === 'Enter') {
      const row = guesses.length;
      if (currentGuess.length !== 5) return shake(row, 'Not enough letters');
      if (game.hardMode) {
        const err = checkHardMode(currentGuess, guesses);
        if (err) return shake(row, err);
      }

      const word = currentGuess;
      setGuesses((g) => [...g, { word, pending: true }]);
      setCurrentGuess('');

      guessMutation.mutate(
        { guess: word },
        {
          onSuccess: (res) => {
            setGuesses((g) => [...g.filter((x) => !x.pending), res.guess]);
            setRevealRow(row);
            if (res.finished) {
              setOutcome({ solved: res.isCorrect, answer: res.answer ?? '', tries: res.tries });
              setStats(recordResult(game.variant, res.isCorrect, res.tries));
              addToast(res.isCorrect ? '🎉 Solved!' : `The word was ${res.answer}`);
            }
          },
          onError: (err) => {
            setGuesses((g) => g.filter((x) => !x.pending));
            if (err instanceof ApiError && err.status === 404) {
              addToast(err.message);
              startGame(game.variant, game.hardMode);
              return;
            }
            setCurrentGuess(word);
            shake(row, err.message);
          },
        },
      );
      return;
    }

    if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => (prev.length < 5 ? prev + key.toUpperCase() : prev));
    }
  }, [game, outcome, guessMutation, guesses, currentGuess, shake, addToast, startGame]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter' || e.key === 'Backspace') e.preventDefault();
      // Enter after a finished game deals the next word
      if (outcome && e.key === 'Enter') { startGame(activeVariant, hardMode); return; }
      handleKey(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey, outcome, startGame, activeVariant, hardMode]);

  const keyStates = useMemo(
    () => (activeVariant === 'word500' ? marks : getKeyStates(guesses)),
    [activeVariant, marks, guesses],
  );
  const toggleMark = useCallback((letter: string) => setMarks((m) => cycleMark(m, letter)), []);

  const avgTries = stats.solved ? (stats.totalTries / stats.solved).toFixed(1) : '–';
  const winPct = stats.played ? Math.round((stats.solved / stats.played) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#121213] flex flex-col">
      <header className="border-b border-[#3a3a3c] flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={() => router.push('/')} className="text-[#818384] hover:text-white text-xl w-8">←</button>
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-widest">Solo Drill</h1>
          <p className="text-[10px] text-[#818384] uppercase tracking-widest">
            {VARIANT_INFO[activeVariant].label}{game?.hardMode ? ' · Hard' : ''}
          </p>
        </div>
        <div className="w-8" />
      </header>

      <ToastContainer toasts={toasts} />

      <main className="flex-1 flex flex-col items-center px-2 pt-4 gap-3 w-full max-w-md mx-auto">
        {/* Options */}
        <div className="w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded p-3 space-y-3">
          <VariantPicker value={variant} onChange={(v) => changeOptions(v, hardMode)} />
          <div className={`flex items-center justify-between ${variant === 'word500' ? 'opacity-40' : ''}`}>
            <p className="text-xs text-white font-bold">Hard Mode</p>
            <Switch
              checked={hardMode}
              disabled={variant === 'word500'}
              onCheckedChange={(checked) => changeOptions(variant, checked)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="w-full grid grid-cols-4 gap-2 text-center">
          {[
            ['Played', stats.played],
            ['Win %', winPct],
            ['Streak', stats.streak],
            ['Avg tries', avgTries],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#1a1a1b] border border-[#3a3a3c] rounded py-2">
              <p className="text-white font-bold text-lg leading-none">{value}</p>
              <p className="text-[9px] text-[#818384] uppercase tracking-widest mt-1">{label}</p>
            </div>
          ))}
        </div>

        {!game ? (
          <div className="text-[#818384] text-sm animate-pulse uppercase tracking-widest py-16">Dealing a word…</div>
        ) : (
          <>
            <Board
              guesses={guesses}
              currentGuess={outcome ? '' : currentGuess}
              shakeRow={shakeRow}
              revealRow={revealRow}
              variant={game.variant}
              marks={marks}
              onTileClick={toggleMark}
            />

            {game.variant === 'word500' && !outcome && (
              <p className="text-[10px] text-[#818384] -mt-1">Tap a letter on the board to mark it ⬛ → 🟨 → 🟩</p>
            )}

            {outcome && (
              <div className="w-full flex flex-col items-center gap-2 animate-fade-in">
                <p className="text-sm text-[#818384]">
                  {outcome.solved ? `Solved in ${outcome.tries}! ` : 'Out of tries. '}
                  The word was <span className="text-white font-bold tracking-widest">{outcome.answer}</span>
                </p>
                <button
                  onClick={() => startGame(game.variant, game.hardMode)}
                  disabled={newGame.isPending}
                  className="w-full bg-[#538d4e] hover:bg-[#6aaf64] disabled:opacity-50 text-white font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors"
                >
                  Next Word ↵
                </button>
              </div>
            )}

            <Keyboard keyStates={keyStates} onKey={handleKey} disabled={!!outcome} />
          </>
        )}
      </main>
    </div>
  );
}
