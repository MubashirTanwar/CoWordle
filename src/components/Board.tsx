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
    // Board fills available width up to 350px; tiles scale via flex
    <div className={`flex flex-col gap-[5px] w-full mx-auto px-2 ${isWord500 ? 'max-w-[400px]' : 'max-w-[350px]'}`}>
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

function Counts({ counts }: { counts: Word500Counts | null }) {
  const cells: [keyof Word500Counts, string][] = [
    ['correct', '#538d4e'],
    ['present', '#b59f3b'],
    ['absent', '#a33a3a'],
  ];
  return (
    <div className="flex flex-col gap-[2px] w-9 flex-shrink-0 ml-1">
      {cells.map(([key, color]) => (
        <div
          key={key}
          className="h-[15px] sm:h-[17px] rounded-sm flex items-center justify-center text-[11px] font-bold text-white"
          style={{ backgroundColor: counts ? color : '#1a1a1b', opacity: counts && counts[key] === 0 ? 0.35 : 1 }}
        >
          {counts ? counts[key] : ''}
        </div>
      ))}
    </div>
  );
}

interface TileProps {
  letter: string;
  result: LetterState | null;
  isRevealing: boolean;
  delay: number;
  submitted: boolean;
  onClick?: () => void;
}

function Tile({ letter, result, isRevealing, delay, submitted, onClick }: TileProps) {
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

  const bgColor = result ? getTileColor(result) : 'transparent';
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
