'use client';
import { useEffect, useState } from 'react';
import { useAdminPlayers } from '@/lib/adminQueries';
import {
  Card, Empty, ErrorBox, Loading, Pagination, PlayerLink, SearchInput, TableWrap, num, pct, td, th, timeAgo,
} from '@/components/admin/ui';
import type { PlayerSort } from '@shared/admin';

const SORTS: { key: PlayerSort; label: string }[] = [
  { key: 'points', label: 'Points' },
  { key: 'wins', label: 'Wins' },
  { key: 'games', label: 'Games' },
  { key: 'solveRate', label: 'Solve rate' },
  { key: 'avgTries', label: 'Avg tries' },
  { key: 'recent', label: 'Recent' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function AdminPlayersPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<PlayerSort>('points');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = useAdminPlayers({ page, q, sort });
  const rankOffset = data ? (data.page - 1) * data.pageSize : 0;

  return (
    <Card title="Top players">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or player id…" />
        <div className="flex gap-1 overflow-x-auto">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSort(s.key); setPage(1); }}
              className={`px-2.5 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                sort === s.key ? 'bg-[#538d4e] text-white' : 'bg-[#3a3a3c] text-[#818384] hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {(sort === 'solveRate' || sort === 'avgTries') && (
        <p className="text-[11px] text-[#818384] mb-2">Only players with 5+ multiplayer rounds are ranked here.</p>
      )}

      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorBox error={error} />
      ) : data.items.length === 0 ? (
        <Empty>No players yet</Empty>
      ) : (
        <>
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#3a3a3c]">
                  <th className={th}>#</th>
                  <th className={th}>Player</th>
                  <th className={`${th} text-right`}>Points</th>
                  <th className={`${th} text-right`}>Wins</th>
                  <th className={`${th} text-right`}>Games</th>
                  <th className={`${th} text-right`}>Solve rate</th>
                  <th className={`${th} text-right`}>Avg tries</th>
                  <th className={`${th} text-right`}>Avg time</th>
                  <th className={`${th} text-right`}>Solo</th>
                  <th className={th}>Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2b]">
                {data.items.map((p, i) => {
                  const rank = rankOffset + i;
                  return (
                    <tr key={p.playerId} className="hover:bg-[#222223]">
                      <td className={`${td} text-[#818384] tabular-nums`}>{MEDALS[rank] ?? rank + 1}</td>
                      <td className={td}>
                        <PlayerLink playerId={p.playerId} name={p.playerName} />
                        {p.names.length > 1 && <span className="text-[10px] text-[#818384] ml-1.5">+{p.names.length - 1} names</span>}
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{num(p.totalPoints)}</td>
                      <td className={`${td} text-right tabular-nums`}>{p.wins}</td>
                      <td className={`${td} text-right tabular-nums`}>{p.games}</td>
                      <td className={`${td} text-right tabular-nums`}>{p.rounds ? pct(p.solveRate) : '–'}</td>
                      <td className={`${td} text-right tabular-nums`}>{num(p.avgTries)}</td>
                      <td className={`${td} text-right tabular-nums`}>{num(p.avgSolveTime, 's')}</td>
                      <td className={`${td} text-right tabular-nums text-[#818384]`}>{p.soloGames ? `${p.soloSolved}/${p.soloGames}` : '–'}</td>
                      <td className={`${td} text-[#818384]`}>{timeAgo(p.lastSeen)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
