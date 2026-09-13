'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useHealth } from '@/lib/queries';

const LETTERS = ['W', 'A', 'K', 'E', 'S'];

/**
 * Blocks the app behind a loading screen until the backend answers /health.
 * Once it has answered, later failed pings never unmount the app mid-game —
 * the socket has its own reconnect handling.
 */
export default function BackendGate({ children }: { children: ReactNode }) {
  const { data, failureCount } = useHealth();
  const elapsed = useElapsedSeconds(!data);

  if (data) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#121213] flex flex-col items-center justify-center px-4 gap-6">
      <div className="flex gap-1.5">
        {LETTERS.map((l, i) => (
          <div
            key={i}
            className="w-12 h-12 flex items-center justify-center text-xl font-bold text-white rounded border-2 border-[#3a3a3c] animate-pulse"
            style={{
              animationDelay: `${i * 150}ms`,
              backgroundColor: i % 3 === 0 ? '#538d4e' : i % 3 === 1 ? '#b59f3b' : '#3a3a3c',
            }}
          >
            {l}
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="text-white text-sm font-bold uppercase tracking-widest">
          {failureCount === 0 ? 'Connecting…' : 'Waking up the server…'}
        </p>
        {elapsed >= 3 && (
          <p className="text-[#818384] text-xs mt-2 max-w-xs">
            The server naps when nobody&apos;s playing. First load can take up to a minute. ({elapsed}s)
          </p>
        )}
      </div>
    </div>
  );
}

function useElapsedSeconds(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return elapsed;
}
