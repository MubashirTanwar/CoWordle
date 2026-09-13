'use client';
import type { PlayerResult } from '@shared/types';

interface RoundEndViewProps {
  roundNumber: number;
  word: string;
  results: PlayerResult[];
  isLastRound: boolean;
  totalRounds: number;
}

export default function RoundEndView({ roundNumber, word, results, isLastRound, totalRounds }: RoundEndViewProps) {
  const sorted = [...(results || [])].sort((a, b) => b.points - a.points);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 px-4">
      <div className="bg-[#1a1a1b] border border-[#3a3a3c] rounded-xl p-6 w-full max-w-sm animate-fade-in">
        <div className="text-center mb-6">
          <p className="text-xs text-[#818384] uppercase tracking-widest mb-1">
            Round {roundNumber} of {totalRounds} — Complete
          </p>
          <p className="text-[#818384] text-sm mt-1">
            The word was{' '}
            <span className="text-white font-bold tracking-widest">{word}</span>
          </p>
        </div>

        {/* Word tiles */}
        <div className="flex justify-center gap-1 mb-6">
          {word?.split('').map((l, i) => (
            <div
              key={i}
              className="w-10 h-10 flex items-center justify-center font-bold text-lg text-white rounded"
              style={{ backgroundColor: '#538d4e' }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="space-y-2">
          {sorted.map((result, i) => (
            <div
              key={result.playerId}
              className="flex items-center justify-between bg-[#121213] rounded p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-[#818384] w-5 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <div>
                  <p className="text-white text-sm font-medium">{result.playerName}</p>
                  {result.solved ? (
                    <p className="text-[10px] text-[#818384]">
                      {result.guesses?.length ?? '?'} tries • {result.timeTaken}s
                    </p>
                  ) : (
                    <p className="text-[10px] text-red-400">Did not finish</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{result.points}</p>
                <p className="text-[10px] text-[#818384]">pts</p>
              </div>
            </div>
          ))}
        </div>

        {!isLastRound && (
          <p className="text-center text-[#818384] text-xs mt-4 animate-pulse">
            Next round starting soon...
          </p>
        )}
      </div>
    </div>
  );
}
