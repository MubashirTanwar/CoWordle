'use client';
import type { LetterState, Player, Word500Counts } from '@shared/types';

export interface FinishedInfo {
  solved: boolean;
  tries: number;
  points: number;
}

export interface GuessInfo {
  tryNumber: number;
  result?: LetterState[];
  counts?: Word500Counts;
}

interface PlayerPanelProps {
  players: Player[];
  finishedPlayers: Record<string, FinishedInfo>;
  playerGuesses: Record<string, GuessInfo>;
  currentPlayerId: string | null;
  roundNumber: number;
  totalRounds: number;
  maxGuesses: number;
}

export default function PlayerPanel({ players, finishedPlayers, playerGuesses, currentPlayerId, roundNumber, totalRounds, maxGuesses }: PlayerPanelProps) {
  return (
    <div className="bg-[#1a1a1b] border border-[#3a3a3c] rounded-lg p-4 min-w-[200px]">
      <div className="text-xs text-[#818384] uppercase tracking-widest mb-3">
        Players · Round {roundNumber}/{totalRounds}
      </div>
      <div className="space-y-3">
        {players.filter(p => p.isConnected !== false).map((player) => {
          const finished = finishedPlayers[player.playerId];
          const guessInfo = playerGuesses?.[player.playerId];
          const isMe = player.playerId === currentPlayerId;
          return (
            <div
              key={player.playerId}
              className={`p-2 rounded ${isMe ? 'bg-[#2a2a2b]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusIcon finished={finished} />
                  <span className={`text-sm truncate ${isMe ? 'text-white font-bold' : 'text-[#c0c0c0]'}`}>
                    {player.playerName}
                    {isMe && <span className="text-[#818384] font-normal ml-1 text-xs">(you)</span>}
                    {player.isHost && <span className="text-[10px] text-[#b59f3b] ml-1">👑</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {finished ? (
                    <span className="text-xs font-bold text-[#818384]">{finished.points}pt</span>
                  ) : guessInfo ? (
                    <span className="text-[10px] text-[#818384]">{guessInfo.tryNumber}/{maxGuesses}</span>
                  ) : null}
                </div>
              </div>

              {/* Latest guess color dots — only visible to other players */}
              {!isMe && !finished && guessInfo?.result && (
                <div className="flex gap-[3px] mt-1.5 ml-7">
                  {guessInfo.result.map((r, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor:
                          r === 'correct' ? '#538d4e' :
                          r === 'present' ? '#b59f3b' : '#3a3a3c',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Word500: only the counts are shared */}
              {!isMe && !finished && guessInfo?.counts && (
                <div className="flex gap-1 mt-1.5 ml-7 text-[10px] font-bold">
                  <span className="px-1.5 rounded-sm bg-[#538d4e]">{guessInfo.counts.correct}</span>
                  <span className="px-1.5 rounded-sm bg-[#b59f3b]">{guessInfo.counts.present}</span>
                  <span className="px-1.5 rounded-sm bg-[#c0392b]">{guessInfo.counts.absent}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusIcon({ finished }: { finished?: FinishedInfo }) {
  if (!finished) {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-[#565758] flex-shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[#565758] animate-pulse" />
      </div>
    );
  }
  if (finished.solved) {
    return (
      <div className="w-5 h-5 rounded-full bg-[#538d4e] flex-shrink-0 flex items-center justify-center">
        <span className="text-[10px] text-white">✓</span>
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-[#3a3a3c] flex-shrink-0 flex items-center justify-center">
      <span className="text-[10px] text-white">✗</span>
    </div>
  );
}
