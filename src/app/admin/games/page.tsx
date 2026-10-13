'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminGames } from '@/lib/adminQueries';
import {
  Badge, Card, Empty, ErrorBox, Loading, Pagination, PlayerLink, SearchInput, TableWrap, VariantBadge, fmtDate, td, th,
} from '@/components/admin/ui';

type Status = '' | 'finished' | 'abandoned';

export default function AdminGamesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('');

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error, isFetching } = useAdminGames({ page, q, status });

  return (
    <Card
      title={<>Game history {isFetching && !isLoading && <span className="normal-case tracking-normal">· updating…</span>}</>}
      action={
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as Status); setPage(1); }}
          className="bg-[#121213] border border-[#3a3a3c] rounded text-white text-xs px-2 py-1"
        >
          <option value="">All</option>
          <option value="finished">Finished</option>
          <option value="abandoned">Abandoned</option>
        </select>
      }
    >
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search room code or player…" />
      </div>
      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorBox error={error} />
      ) : data.items.length === 0 ? (
        <Empty>No games found</Empty>
      ) : (
        <>
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#3a3a3c]">
                  <th className={th}>When</th>
                  <th className={th}>Room</th>
                  <th className={th}>Mode</th>
                  <th className={th}>Rounds</th>
                  <th className={th}>Players</th>
                  <th className={th}>Winner</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2b]">
                {data.items.map((g) => (
                  <tr key={g.id} className="hover:bg-[#222223]">
                    <td className={`${td} text-[#818384]`}>{fmtDate(g.createdAt)}</td>
                    <td className={`${td} font-bold tracking-widest`}>{g.roomCode}</td>
                    <td className={td}><VariantBadge variant={g.variant} hardMode={g.hardMode} /></td>
                    <td className={`${td} tabular-nums`}>{g.roundsPlayed}</td>
                    <td className={`${td} text-[#c0c0c0] max-w-[16rem] truncate`} title={g.players.map((p) => p.playerName).join(', ')}>
                      {g.players.length} · {g.players.slice(0, 3).map((p) => p.playerName).join(', ')}{g.players.length > 3 ? '…' : ''}
                    </td>
                    <td className={td}>
                      {!g.finished ? (
                        <Badge>Abandoned</Badge>
                      ) : g.winner ? (
                        <>🏆 <PlayerLink playerId={g.winner.playerId} name={g.winner.playerName} /> <span className="text-[#818384] tabular-nums">{g.winner.totalPoints}</span></>
                      ) : (
                        <span className="text-[#818384]">{g.players.length > 1 ? 'Tie' : 'Solo room'}</span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      <Link href={`/admin/games/${g.id}`} className="text-[#538d4e] hover:text-[#6aaf64] text-xs font-bold uppercase tracking-widest">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
