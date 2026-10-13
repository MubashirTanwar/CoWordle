'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTileColor } from '@shared/wordle';
import type { Guess, Variant } from '@shared/types';
import { WORD500_COLORS } from '@/components/Board';

// ─── Formatting ───────────────────────────────────────────────────────────────

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const num = (n: number | null | undefined, suffix = '') => (n == null ? '–' : `${n.toLocaleString()}${suffix}`);

export function fmtDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ─── Layout pieces ────────────────────────────────────────────────────────────

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-[#1a1a1b] border border-[#3a3a3c] rounded-lg ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#3a3a3c]">
          <h2 className="text-[11px] text-[#818384] uppercase tracking-widest">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-[#1a1a1b] border border-[#3a3a3c] rounded-lg px-4 py-3 min-w-0">
      <p className="text-[10px] text-[#818384] uppercase tracking-widest truncate">{label}</p>
      <p className="text-2xl font-bold text-white mt-1 tabular-nums truncate">{value}</p>
      {sub && <p className="text-[11px] text-[#818384] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="text-[#818384] text-sm animate-pulse uppercase tracking-widest py-16 text-center">{label}</div>;
}

export function ErrorBox({ error }: { error: Error | null }) {
  return (
    <div className="bg-red-900/30 border border-red-700 rounded px-4 py-3 text-red-300 text-sm">
      {error?.message ?? 'Something went wrong'}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[#818384] text-sm text-center py-8">{children}</p>;
}

export function Badge({ children, color = '#3a3a3c' }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white whitespace-nowrap" style={{ backgroundColor: color }}>
      {children}
    </span>
  );
}

export function VariantBadge({ variant, hardMode }: { variant: Variant; hardMode?: boolean }) {
  return (
    <span className="inline-flex gap-1">
      <Badge color={variant === 'word500' ? '#538d4e' : '#3a3a3c'}>{variant === 'word500' ? 'Word500' : 'Classic'}</Badge>
      {hardMode && <Badge color="#b59f3b">Hard</Badge>}
    </span>
  );
}

export function PlayerLink({ playerId, name }: { playerId?: string; name?: string }) {
  if (!playerId) return <span className="text-white">{name || 'Anonymous'}</span>;
  return (
    <Link href={`/admin/players/${encodeURIComponent(playerId)}`} className="text-white hover:text-[#6aaf64] underline-offset-2 hover:underline">
      {name || 'Anonymous'}
    </Link>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-xs text-[#818384] pt-3">
      <span>
        {total === 0 ? 'No results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded bg-[#3a3a3c] text-white disabled:opacity-30 hover:bg-[#565758]"
        >
          ←
        </button>
        <span className="px-1 py-1.5 tabular-nums">{page} / {pages}</span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 rounded bg-[#3a3a3c] text-white disabled:opacity-30 hover:bg-[#565758]"
        >
          →
        </button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-[#121213] border border-[#3a3a3c] rounded text-white text-sm px-3 py-2 w-full sm:w-64 focus:outline-none focus:border-[#565758] placeholder:text-[#565758]"
    />
  );
}

/** Horizontal scroll wrapper so wide tables never push the page sideways on phones. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto -mx-4 px-4">{children}</div>;
}

export const th = 'text-left text-[10px] text-[#818384] uppercase tracking-widest font-normal py-2 pr-4 whitespace-nowrap';
export const td = 'py-2.5 pr-4 text-sm whitespace-nowrap';

// ─── Charts ───────────────────────────────────────────────────────────────────

/** Stacked daily bars: multiplayer (green) + solo (yellow). */
export function DailyChart({ data }: { data: { date: string; games: number; solo: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.games + d.solo));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-36">
        {data.map((d) => {
          const total = d.games + d.solo;
          return (
            <div key={d.date} className="flex-1 h-full flex flex-col justify-end group relative min-w-0" title={`${d.date}: ${d.games} multiplayer, ${d.solo} solo`}>
              <div style={{ height: `${(d.solo / max) * 100}%` }} className="bg-[#b59f3b] rounded-t-sm" />
              <div style={{ height: `${(d.games / max) * 100}%` }} className={`bg-[#538d4e] ${d.solo ? '' : 'rounded-t-sm'}`} />
              {total === 0 && <div className="h-px bg-[#3a3a3c]" />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[#818384] mt-2">
        <span>{data[0] && fmtDate(data[0].date, false)}</span>
        <span className="flex gap-3">
          <span><span className="inline-block w-2 h-2 bg-[#538d4e] rounded-sm mr-1" />Multiplayer</span>
          <span><span className="inline-block w-2 h-2 bg-[#b59f3b] rounded-sm mr-1" />Solo</span>
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** Wordle-style guess distribution. */
export function Distribution({ counts }: { counts: number[] }) {
  const last = Math.max(6, counts.reduce((acc, n, i) => (n > 0 ? i + 1 : acc), 0));
  const rows = counts.slice(0, last);
  const max = Math.max(1, ...rows);
  return (
    <div className="space-y-1">
      {rows.map((n, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-3 text-[#818384] tabular-nums">{i + 1}</span>
          <div className="flex-1">
            <div
              className="bg-[#538d4e] text-white font-bold text-right px-1.5 py-0.5 rounded-sm tabular-nums min-w-[1.5rem]"
              style={{ width: `${Math.max(6, (n / max) * 100)}%`, backgroundColor: n ? '#538d4e' : '#3a3a3c' }}
            >
              {n}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Guess rendering ──────────────────────────────────────────────────────────

/** A compact row of guesses: classic shows coloured tiles, Word500 the 🟩🟨🟥 counts. */
export function GuessRow({ guess }: { guess: Guess }) {
  return (
    <div className="flex items-center gap-[2px]">
      {guess.word.split('').map((l, i) => (
        <span
          key={i}
          className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white rounded-sm border border-[#3a3a3c]"
          style={{ backgroundColor: guess.result ? getTileColor(guess.result[i]) : 'transparent', borderColor: guess.result ? 'transparent' : undefined }}
        >
          {l}
        </span>
      ))}
      {guess.counts && (
        <span className="flex gap-[2px] ml-1">
          {(['correct', 'present', 'absent'] as const).map((k) => (
            <span key={k} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white rounded-sm" style={{ backgroundColor: WORD500_COLORS[k] }}>
              {guess.counts![k]}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
