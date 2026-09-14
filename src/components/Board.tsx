'use client';
import { useEffect, useRef } from 'react';
import { getTileColor } from '@shared/wordle';
import { MAX_GUESSES, WORD_LENGTH } from '@shared/types';
import type { LetterState, Variant, Word500Counts } from '@shared/types';
import type { BoardGuess, LetterMarks } from '@/lib/types';

interface BoardProps {
  guesses: BoardGuess[];
  currentGuess: string;
  shakeRow: number | null;
  revealRow: number | null;
  variant?: Variant;
  /** Word500 only: player-set letter colours. */
  marks?: LetterMarks;
  /** Word500 only: tap a submitted tile to cycle its letter's mark. */
  onTileClick?: (letter: string) => void;
}

export default function Board({ guesses, currentGuess, shakeRow, revealRow, variant = 'classic', marks, onTileClick }: BoardProps) {
  const isWord500 = variant === 'word500';
  const rows = [];

  for (let r = 0; r < MAX_GUESSES[variant]; r++) {
    const submittedGuess = guesses[r];
    const isCurrentRow = r === guesses.length;
    const submitted = !!submittedGuess && !submittedGuess.pending;

    rows.push(
      <Row
        key={r}
        letters={
          submittedGuess
            ? submittedGuess.word.split('')
            : isCurrentRow
            ? currentGuess.split('')
            : []
        }
        results={isWord500 ? undefined : submittedGuess?.result}
        marks={isWord500 && submitted ? marks : undefined}
        counts={isWord500 ? (submitted ? submittedGuess.counts ?? null : null) : undefined}
        isRevealing={revealRow === r && !submittedGuess?.pending}
        isShaking={shakeRow === r}
        submitted={submitted}
        onTileClick={isWord500 && submitted ? onTileClick : undefined}
      />
    );
  }

  return (
    // Board fills available width up to 350px (Word500: wider for the count boxes); tiles scale via flex
    <div className={`flex flex-col gap-[5px] w-full mx-auto px-2 ${isWord500 ? 'max-w-[480px]' : 'max-w-[350px]'}`}>
      {rows}
    </div>
  );
}

interface RowProps {
  letters: string[];
  results?: LetterState[];
  marks?: LetterMarks;
  /** undefined = classic (no column), null = word500 row without feedback yet */
  counts?: Word500Counts | null;
  isRevealing: boolean;
  isShaking: boolean;
  submitted: boolean;
  onTileClick?: (letter: string) => void;
}

function Row({ letters, results, marks, counts, isRevealing, isShaking, submitted, onTileClick }: RowProps) {
  return (
    <div className={`flex gap-[5px] w-full items-center ${isShaking ? 'row-shake' : ''}`}>
      {Array.from({ length: WORD_LENGTH }).map((_, i) => {
        const letter = letters[i] || '';
        return (
          <Tile
            key={i}
            letter={letter}
            result={results?.[i] ?? marks?.[letter] ?? null}
            palette={marks ? WORD500_COLORS : undefined}
            isRevealing={isRevealing && !!results}
            delay={results ? i * 300 : 0}
            submitted={submitted}
            onClick={onTileClick && letter ? () => onTileClick(letter) : undefined}
          />
        );
      })}
      {counts !== undefined && <Counts counts={counts} />}
    </div>
  );
}

/** Word500 colours: "not in word" is red rather than gray. */
export const WORD500_COLORS: Record<LetterState, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#c0392b',
};

const COUNT_ORDER: (keyof Word500Counts)[] = ['correct', 'present', 'absent'];

// Three square count boxes beside the row (🟩 🟨 🟥), same size as the tiles
function Counts({ counts }: { counts: Word500Counts | null }) {
  return (
    <>
      <div className="w-1.5 flex-shrink-0" />
      {COUNT_ORDER.map((key) => (
        <div
          key={key}
          className="flex-1 aspect-square flex items-center justify-center text-xl sm:text-2xl font-bold text-white select-none"
          style={{
            backgroundColor: counts ? WORD500_COLORS[key] : 'transparent',
            border: counts ? '2px solid transparent' : '2px solid #3a3a3c',
          }}
        >
          {counts ? counts[key] : ''}
        </div>
      ))}
    </>
  );
}

interface TileProps {
  letter: string;
  result: LetterState | null;
  isRevealing: boolean;
  delay: number;
  submitted: boolean;
  /** Overrides the classic tile colours (Word500 marks). */
  palette?: Record<LetterState, string>;
  onClick?: () => void;
}

function Tile({ letter, result, isRevealing, delay, submitted, palette, onClick }: TileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const prevLetter = useRef('');

  useEffect(() => {
    if (letter && letter !== prevLetter.current && !submitted) {
      const el = tileRef.current;
      if (el) {
        el.classList.remove('tile-pop');
        void el.offsetWidth;
        el.classList.add('tile-pop');
        setTimeout(() => el.classList.remove('tile-pop'), 200);
      }
    }
    prevLetter.current = letter;
  }, [letter, submitted]);

  useEffect(() => {
    if (isRevealing && result) {
      const el = tileRef.current;
      if (el) {
        setTimeout(() => {
          el.classList.add('tile-flip');
          setTimeout(() => el.classList.remove('tile-flip'), 600);
        }, delay);
      }
    }
  }, [isRevealing, result, delay]);

  const bgColor = result ? (palette ? palette[result] : getTileColor(result)) : 'transparent';
  const borderStyle = result
    ? 'border-transparent'
    : letter
    ? 'border-[#565758]'
    : 'border-[#3a3a3c]';

  return (
    <div
      ref={tileRef}
      onClick={onClick}
      className={`flex-1 aspect-square flex items-center justify-center border-2 ${borderStyle} text-white text-xl sm:text-2xl font-bold uppercase select-none ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
      style={{
        backgroundColor: bgColor,
        transition: result ? `background-color 0.1s ease ${delay}ms` : undefined,
      }}
    >
      {letter}
    </div>
  );
}
