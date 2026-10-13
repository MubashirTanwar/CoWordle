'use client';
import { useAdminOverview } from '@/lib/adminQueries';
import { Card, DailyChart, Empty, ErrorBox, Loading, Stat, num, pct } from '@/components/admin/ui';
import type { WordStat } from '@shared/admin';

function WordTable({ words }: { words: WordStat[] }) {
  if (!words.length) return <Empty>Not enough data yet (3+ attempts per word)</Empty>;
  return (
    <div className="space-y-1.5">
      {words.map((w) => (
        <div key={w.word} className="flex items-center gap-3 text-sm">
          <span className="font-bold tracking-widest w-16">{w.word}</span>
          <div className="flex-1 h-2 bg-[#3a3a3c] rounded-full overflow-hidden">
            <div className="h-full bg-[#538d4e]" style={{ width: pct(w.solveRate) }} />
          </div>
          <span className="w-10 text-right tabular-nums text-white">{pct(w.solveRate)}</span>
          <span className="w-14 text-right tabular-nums text-[#818384] text-xs">{w.attempts} tries</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading, error } = useAdminOverview();

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;

  const { totals, last24h, last7d, live, variants } = data;
  const variantTotal = variants.classic + variants.word500;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Games played" value={num(totals.games)} sub={`${num(totals.gamesStarted - totals.games)} abandoned`} />
        <Stat label="Players" value={num(totals.players)} sub={`${num(last7d.players)} this week`} />
        <Stat label="Solo drills" value={num(totals.soloGames)} sub={`${num(last7d.soloGames)} this week`} />
        <Stat label="Live now" value={num(live.roomsPlaying)} sub={`rooms playing · ${live.roomsInLobby} in lobby`} />
        <Stat label="Rounds" value={num(totals.rounds)} sub={`${num(totals.guesses)} guesses`} />
        <Stat label="Solve rate" value={pct(data.solveRate)} sub="multiplayer rounds" />
        <Stat label="Avg tries" value={num(data.avgTries)} sub="when solved" />
        <Stat label="Avg solve time" value={num(data.avgSolveTime, 's')} sub="multiplayer" />
      </div>

      <Card title="Last 30 days">
        <DailyChart data={data.daily} />
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Last 24 hours">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[#818384]">Games</dt><dd className="font-bold tabular-nums">{last24h.games}</dd></div>
            <div className="flex justify-between"><dt className="text-[#818384]">Solo drills</dt><dd className="font-bold tabular-nums">{last24h.soloGames}</dd></div>
            <div className="flex justify-between"><dt className="text-[#818384]">Active players</dt><dd className="font-bold tabular-nums">{last24h.players}</dd></div>
          </dl>
        </Card>
        <Card title="Last 7 days">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[#818384]">Games</dt><dd className="font-bold tabular-nums">{last7d.games}</dd></div>
            <div className="flex justify-between"><dt className="text-[#818384]">Solo drills</dt><dd className="font-bold tabular-nums">{last7d.soloGames}</dd></div>
            <div className="flex justify-between"><dt className="text-[#818384]">Active players</dt><dd className="font-bold tabular-nums">{last7d.players}</dd></div>
          </dl>
        </Card>
        <Card title="Modes (multiplayer)">
          {variantTotal === 0 ? (
            <Empty>No games yet</Empty>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 rounded-full overflow-hidden bg-[#3a3a3c]">
                <div className="bg-[#818384]" style={{ width: pct(variants.classic / variantTotal) }} />
                <div className="bg-[#538d4e]" style={{ width: pct(variants.word500 / variantTotal) }} />
              </div>
              <div className="flex justify-between text-sm">
                <span><span className="inline-block w-2 h-2 rounded-sm bg-[#818384] mr-1.5" />Classic <b className="tabular-nums">{variants.classic}</b></span>
                <span><span className="inline-block w-2 h-2 rounded-sm bg-[#538d4e] mr-1.5" />Word500 <b className="tabular-nums">{variants.word500}</b></span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Hardest words">
          <WordTable words={data.hardestWords} />
        </Card>
        <Card title="Easiest words">
          <WordTable words={data.easiestWords} />
        </Card>
        <Card title="Favourite openers">
          {data.topFirstGuesses.length === 0 ? (
            <Empty>No guesses yet</Empty>
          ) : (
            <ol className="space-y-1.5">
              {data.topFirstGuesses.map((g, i) => (
                <li key={g.word} className="flex items-center gap-3 text-sm">
                  <span className="text-[#818384] w-4 tabular-nums">{i + 1}.</span>
                  <span className="font-bold tracking-widest flex-1">{g.word}</span>
                  <span className="tabular-nums text-[#818384]">{g.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
