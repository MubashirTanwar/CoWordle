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
    if (!result) continue; // skip pending guesses
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
      case 'correct': return 'bg-[#538d4e] text-white border-transparent';
      case 'present': return 'bg-[#b59f3b] text-white border-transparent';
      case 'absent':  return 'bg-[#3a3a3c] text-white border-transparent';
      default:        return 'bg-[#818384] text-white border-transparent hover:bg-[#9a9b9c]';
    }
  }

  return (
    <div className="flex flex-col gap-[6px] items-center w-full max-w-[500px] select-none">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-[6px]">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === '⌫';
            return (
              <button
                key={key}
                onClick={() => !disabled && onKey(key)}
                disabled={disabled}
                className={`
                  flex items-center justify-center rounded font-bold text-sm uppercase
                  border-2 cursor-pointer transition-colors
                  ${isWide ? 'px-3 min-w-[65px] h-14 text-xs' : 'w-[43px] h-14'}
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
