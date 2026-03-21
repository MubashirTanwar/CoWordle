'use client';
import { useEffect, useRef } from 'react';
import { getTileColor } from '@/lib/wordle';

const ROWS = 6;
const COLS = 5;

export default function Board({ guesses, currentGuess, shakeRow, revealRow }) {
  const rows = [];

  for (let r = 0; r < ROWS; r++) {
    const submittedGuess = guesses[r];
    const isCurrentRow = r === guesses.length;
    const isShaking = shakeRow === r;

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
        results={submittedGuess?.result || []}
        isRevealing={revealRow === r && !submittedGuess?.pending}
        isShaking={isShaking}
        submitted={!!submittedGuess && !submittedGuess.pending}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[5px] p-2">
      {rows}
    </div>
  );
}

function Row({ letters, results, isRevealing, isShaking, submitted }) {
  return (
    <div className={`flex gap-[5px] ${isShaking ? 'row-shake' : ''}`}>
      {Array.from({ length: COLS }).map((_, i) => (
        <Tile
          key={i}
          letter={letters[i] || ''}
          result={results[i] || null}
          isRevealing={isRevealing}
          delay={i * 300}
          submitted={submitted}
        />
      ))}
    </div>
  );
}

function Tile({ letter, result, isRevealing, delay, submitted }) {
  const tileRef = useRef(null);
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
      className={`w-14 h-14 flex items-center justify-center border-2 ${borderStyle} text-white text-2xl font-bold uppercase select-none`}
      style={{
        backgroundColor: bgColor,
        transition: result ? `background-color 0.1s ease ${delay}ms` : undefined,
      }}
    >
      {letter}
    </div>
  );
}
