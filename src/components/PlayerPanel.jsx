'use client';

export default function PlayerPanel({ players, finishedPlayers, currentPlayerId, roundNumber, totalRounds }) {
  return (
    <div className="bg-[#1a1a1b] border border-[#3a3a3c] rounded-lg p-4 min-w-[180px]">
      <div className="text-xs text-[#818384] uppercase tracking-widest mb-3">
        Players • Round {roundNumber}/{totalRounds}
      </div>
      <div className="space-y-2">
        {players.filter(p => p.isConnected !== false).map((player) => {
          const finished = finishedPlayers[player.playerId];
          const isMe = player.playerId === currentPlayerId;
          return (
            <div
              key={player.playerId}
              className={`flex items-center justify-between gap-2 p-2 rounded ${
                isMe ? 'bg-[#2a2a2b]' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon finished={finished} />
                <span className={`text-sm truncate ${isMe ? 'text-white font-bold' : 'text-[#c0c0c0]'}`}>
                  {player.playerName}
                  {isMe && <span className="text-[#818384] font-normal ml-1">(you)</span>}
                  {player.isHost && <span className="text-[10px] text-[#b59f3b] ml-1">👑</span>}
                </span>
              </div>
              {finished && (
                <span className="text-xs text-[#818384] whitespace-nowrap">
                  {finished.points}pt
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusIcon({ finished }) {
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
