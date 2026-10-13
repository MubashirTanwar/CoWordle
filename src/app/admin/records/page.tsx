'use client';
import Link from 'next/link';
import { useAdminRecords } from '@/lib/adminQueries';
import { Empty, ErrorBox, Loading, PlayerLink, fmtDate } from '@/components/admin/ui';

export default function AdminRecordsPage() {
  const { data, isLoading, error } = useAdminRecords();

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  if (data.records.length === 0) return <Empty>No records yet. Play some games!</Empty>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.records.map((r) => (
        <div key={r.label} className="bg-[#1a1a1b] border border-[#3a3a3c] rounded-lg p-4 flex flex-col gap-1">
          <p className="text-[10px] text-[#818384] uppercase tracking-widest">{r.label}</p>
          <p className="text-3xl font-bold text-[#b59f3b] tabular-nums">{r.value}</p>
          {r.playerName && (
            <p className="text-sm">
              <PlayerLink playerId={r.playerId} name={r.playerName} />
            </p>
          )}
          <p className="text-[11px] text-[#818384] mt-auto pt-1">
            {[r.detail, r.date && fmtDate(r.date, false)].filter(Boolean).join(' · ')}
            {r.gameId && (
              <>
                {' · '}
                <Link href={`/admin/games/${r.gameId}`} className="text-[#538d4e] hover:text-[#6aaf64]">game →</Link>
              </>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
