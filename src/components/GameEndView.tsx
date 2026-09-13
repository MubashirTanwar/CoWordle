'use client';
import { useRouter } from 'next/navigation';
import type { FinalScore, RoundSummary } from '@shared/types';

interface GameEndViewProps {
  finalScores: FinalScore[];
  rounds: RoundSummary[];
  playerId: string | null;
  onPlayAgain: () => void;
}

export default function GameEndView({ finalScores, rounds, playerId, onPlayAgain }: GameEndViewProps) {
  const router = useRouter();
  const myScore = finalScores?.find(s => s.playerId === playerId);
  const myRank = (finalScores?.findIndex(s => s.playerId === playerId) ?? -1) + 1;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-1">
          Game Over
        </h2>
        {myRank === 1 ? (
          <p className="text-[#b59f3b] text-sm">🏆 You won!</p>
        ) : myScore ? (
          <p className="text-[#818384] text-sm">You finished #{myRank}</p>
        ) : null}
      </div>

      {/* Leaderboard */}
      <div className="w-full border border-[#3a3a3c] rounded-lg overflow-hidden mb-6">
        <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#3a3a3c]">
          <p className="text-xs text-[#818384] uppercase tracking-widest">Final Scores</p>
        </div>
        <div className="divide-y divide-[#3a3a3c]">
          {finalScores?.map((score, i) => {
            const isMe = score.playerId === playerId;
            return (
              <div
                key={score.playerId}
                className={`flex items-center justify-between px-4 py-3 ${
                  isMe ? 'bg-[#1e2a1e]' : 'bg-[#121213]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-6 text-center">
                    {medals[i] || `${i + 1}.`}
                  </span>
                  <div>
                    <p className={`font-bold text-sm ${isMe ? 'text-white' : 'text-[#c0c0c0]'}`}>
                      {score.playerName}
                      {isMe && <span className="text-[#818384] font-normal ml-1">(you)</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg">{score.totalPoints}</p>
                  <p className="text-[10px] text-[#818384]">points</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Round breakdown */}
      <div className="w-full border border-[#3a3a3c] rounded-lg overflow-hidden mb-6">
        <div className="bg-[#1a1a1b] px-4 py-2 border-b border-[#3a3a3c]">
          <p className="text-xs text-[#818384] uppercase tracking-widest">Round Breakdown</p>
        </div>
        {rounds?.map((round) => {
          const roundSorted = [...(round.results || [])].sort((a, b) => b.points - a.points);
          return (
            <div key={round.roundNumber} className="px-4 py-3 border-b border-[#3a3a3c] last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#818384] uppercase tracking-widest">
                  Round {round.roundNumber}
                </span>
                <div className="flex gap-1">
                  {round.word?.split('').map((l, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white rounded"
                      style={{ backgroundColor: '#538d4e' }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                {roundSorted.map((result, i) => {
                  const isMeResult = result.playerId === playerId;
                  return (
                    <div key={result.playerId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[#818384] w-4">{i + 1}.</span>
                        <span className={isMeResult ? 'text-white font-bold' : 'text-[#818384]'}>
                          {result.playerName}
                        </span>
                        {result.solved ? (
                          <span className="text-[#818384]">
                            {result.guesses?.length}↓ {result.timeTaken}s
                          </span>
                        ) : (
                          <span className="text-red-400">DNF</span>
                        )}
                      </div>
                      <span className={`font-bold ${result.points > 0 ? 'text-[#538d4e]' : 'text-[#818384]'}`}>
                        +{result.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="w-full flex flex-col gap-2">
        <button
          onClick={onPlayAgain}
          className="w-full bg-[#538d4e] hover:bg-[#6aaf64] text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
        >
          Play Again
        </button>
        <button
          onClick={() => router.push('/')}
          className="w-full bg-transparent border border-[#3a3a3c] hover:border-[#565758] text-[#818384] hover:text-white font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors"
        >
          Home
        </button>
      </div>
    </div>
  );
}
