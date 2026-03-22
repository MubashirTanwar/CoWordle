'use client';
import { getKeyColor } from '@/lib/wordle';

const ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

export default function Keyboard({ guesses, onKey, disabled }) {
  const keyColors = {};
  for (const { word, result } of guesses) {
    if (!result) continue;
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const r = result[i];
      if (r === 'correct') { keyColors[letter] = 'correct'; }
      else if (r === 'present' && keyColors[letter] !== 'correct') { keyColors[letter] = 'present'; }
      else if (r === 'absent' && !keyColors[letter]) { keyColors[letter] = 'absent'; }
    }
  }

  function getKeyStyle(key) {
    const color = keyColors[key];
    switch (color) {
      case 'correct': return 'bg-[#538d4e] text-white';
      case 'present': return 'bg-[#b59f3b] text-white';
      case 'absent':  return 'bg-[#3a3a3c] text-white';
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
