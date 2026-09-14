'use client';
import type { LetterState, Variant } from '@shared/types';

const ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

interface KeyboardProps {
  /** Colour per letter — classic: derived from guesses, Word500: the player's own marks. */
  keyStates: Record<string, LetterState>;
  onKey: (key: string) => void;
  disabled?: boolean;
  variant?: Variant;
}

export default function Keyboard({ keyStates, onKey, disabled, variant = 'classic' }: KeyboardProps) {
  function getKeyStyle(key: string) {
    switch (keyStates[key]) {
      case 'correct': return 'bg-[#538d4e] text-white';
      case 'present': return 'bg-[#b59f3b] text-white';
      // Word500 marks "not in word" in red, matching the board
      case 'absent':  return variant === 'word500' ? 'bg-[#c0392b] text-white' : 'bg-[#3a3a3c] text-white';
      default:        return 'bg-[#818384] text-white hover:bg-[#9a9b9c]';
    }
  }

  return (
    // w-full ensures keyboard never exceeds screen; px-1 gives slight breathing room
    <div className="flex flex-col gap-[5px] items-center w-full px-1 select-none">
      {ROWS.map((row, ri) => (
        // Each row fills full width, keys grow to fill evenly
        <div key={ri} className="flex gap-[5px] w-full">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === '⌫';
            return (
              <button
                key={key}
                type="button"
                onClick={() => !disabled && onKey(key)}
                disabled={disabled}
                style={{ flex: isWide ? 1.5 : 1 }}
                className={`
                  min-w-0 h-14 flex items-center justify-center rounded
                  font-bold text-xs uppercase cursor-pointer transition-colors
                  ${getKeyStyle(key)}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
