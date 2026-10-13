'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdminPlayer } from '@/lib/adminQueries';
import {
  Badge, Card, Distribution, Empty, ErrorBox, Loading, Stat, TableWrap, VariantBadge, fmtDate, num, pct, td, th, timeAgo,
} from '@/components/admin/ui';

export default function AdminPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const { data: p, isLoading, error } = useAdminPlayer(decodeURIComponent(playerId));

  if (isLoading) return <Loading />;
  if (error || !p) return <ErrorBox error={error} />;

  return (
    <div className="space-y-4">
      <Link href="/admin/players" className="text-xs text-[#818384] hover:text-white uppercase tracking-widest">← Players</Link>

      <div>
        <h1 className="text-2xl font-bold">{p.playerName}</h1>
        <p className="text-xs text-[#818384] mt-1 break-all">
          {p.playerId} · first seen {fmtDate(p.firstSeen, false)} · last seen {timeAgo(p.lastSeen)}
        </p>
        {p.names.length > 1 && (
          <p className="text-xs text-[#818384] mt-1">Also played as: {p.names.filter((n) => n !== p.playerName).join(', ')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Career points" value={num(p.totalPoints)} sub={`best game ${p.bestGameScore}`} />
        <Stat label="Wins" value={num(p.wins)} sub={`${p.games} games · ${p.games ? pct(p.wins / p.games) : '–'} win rate`} />
        <Stat label="Solve rate" value={p.rounds ? pct(p.solveRate) : '–'} sub={`${p.solved}/${p.rounds} rounds`} />
        <Stat label="Avg tries" value={num(p.avgTries)} sub={`avg ${num(p.avgSolveTime, 's')} · best ${num(p.fastestSolve, 's')}`} />
        <Stat label="Solo drills" value={num(p.soloGames)} sub={`${p.soloSolved} solved`} />
        <Stat label="Solo win rate" value={p.soloGames ? pct(p.soloSolved / p.soloGames) : '–'} />
        <Stat label="Best solo streak" value={num(p.bestSoloStreak)} />
        <Stat label="Rounds played" value={num(p.rounds)} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Guess distribution" className="md:col-span-1">
          {p.guessDistribution.some(Boolean) ? <Distribution counts={p.guessDistribution} /> : <Empty>No solves yet</Empty>}
        </Card>

        <Card title="Recent multiplayer games" className="md:col-span-2">
          {p.recentGames.length === 0 ? (
            <Empty>No multiplayer games</Empty>
          ) : (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#3a3a3c]">
                    <th className={th}>When</th>
                    <th className={th}>Room</th>
                    <th className={th}>Mode</th>
                    <th className={`${th} text-right`}>Place</th>
                    <th className={`${th} text-right`}>Points</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2b]">
                  {p.recentGames.map((g) => (
                    <tr key={g.id} className="hover:bg-[#222223]">
                      <td className={`${td} text-[#818384]`}>{fmtDate(g.createdAt)}</td>
                      <td className={`${td} font-bold tracking-widest`}>{g.roomCode}</td>
                      <td className={td}><VariantBadge variant={g.variant} hardMode={g.hardMode} /></td>
                      <td className={`${td} text-right tabular-nums`}>
                        {!g.finished ? <Badge>Abandoned</Badge> : `${g.rank === 1 && g.winner?.playerId === p.playerId ? '🏆 ' : ''}${g.rank}/${g.players.length}`}
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{g.points}</td>
                      <td className={`${td} text-right`}>
                        <Link href={`/admin/games/${g.id}`} className="text-[#538d4e] hover:text-[#6aaf64] text-xs font-bold uppercase tracking-widest">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card title="Recent solo drills">
        {p.recentSolo.length === 0 ? (
          <Empty>No solo drills</Empty>
        ) : (
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#3a3a3c]">
                  <th className={th}>When</th>
                  <th className={th}>Mode</th>
                  <th className={th}>Word</th>
                  <th className={th}>Result</th>
                  <th className={`${th} text-right`}>Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2b]">
                {p.recentSolo.map((s, i) => (
                  <tr key={i}>
                    <td className={`${td} text-[#818384]`}>{fmtDate(s.createdAt)}</td>
                    <td className={td}><VariantBadge variant={s.variant} hardMode={s.hardMode} /></td>
                    <td className={`${td} font-bold tracking-widest`}>{s.word.toUpperCase()}</td>
                    <td className={td}>{s.solved ? <span className="text-[#538d4e]">Solved in {s.tries}</span> : <span className="text-red-400">Missed</span>}</td>
                    <td className={`${td} text-right tabular-nums text-[#818384]`}>{num(s.durationSec, 's')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
