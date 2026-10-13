'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdminGame } from '@/lib/adminQueries';
import { Badge, Card, ErrorBox, GuessRow, Loading, PlayerLink, VariantBadge, fmtDate } from '@/components/admin/ui';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function AdminGamePage() {
  const { id } = useParams<{ id: string }>();
  const { data: game, isLoading, error } = useAdminGame(id);

  if (isLoading) return <Loading />;
  if (error || !game) return <ErrorBox error={error} />;

  return (
    <div className="space-y-4">
      <Link href="/admin/games" className="text-xs text-[#818384] hover:text-white uppercase tracking-widest">← History</Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-[0.2em]">{game.roomCode}</h1>
        <VariantBadge variant={game.variant} hardMode={game.hardMode} />
        {!game.finished && <Badge>Abandoned</Badge>}
        <span className="text-sm text-[#818384]">{fmtDate(game.createdAt)} · {game.roundsPlayed} rounds</span>
      </div>

      <Card title="Final standings">
        <div className="divide-y divide-[#2a2a2b]">
          {game.players.map((p, i) => (
            <div key={p.playerId} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
                <PlayerLink playerId={p.playerId} name={p.playerName} />
              </div>
              <span className="font-bold tabular-nums">{p.totalPoints} <span className="text-[10px] text-[#818384] font-normal">pts</span></span>
            </div>
          ))}
        </div>
      </Card>

      {game.rounds.map((r) => (
        <Card
          key={r.roundNumber}
          title={`Round ${r.roundNumber}`}
          action={
            <span className="flex gap-[2px]">
              {r.word.split('').map((l, i) => (
                <span key={i} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white rounded-sm bg-[#538d4e]">{l}</span>
              ))}
            </span>
          }
        >
          {r.results.length === 0 ? (
            <p className="text-sm text-[#818384]">No results recorded</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {r.results.map((res) => (
                <div key={res.playerId} className="bg-[#121213] rounded p-3">
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <PlayerLink playerId={res.playerId} name={res.playerName} />
                    <span className={`font-bold tabular-nums ${res.points ? 'text-[#538d4e]' : 'text-[#818384]'}`}>+{res.points}</span>
                  </div>
                  <div className="space-y-[2px]">
                    {res.guesses.map((g, i) => <GuessRow key={i} guess={g} />)}
                  </div>
                  <p className="text-[11px] mt-2 text-[#818384]">
                    {res.solved ? `Solved in ${res.guesses.length} · ${res.timeTaken ?? '?'}s` : <span className="text-red-400">Did not finish</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
