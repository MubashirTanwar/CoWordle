'use client';
import { useState, useEffect, useRef } from 'react';

export default function Timer({ timeLimit, onExpire, active }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const intervalRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setTimeLeft(timeLimit);
    startRef.current = Date.now();

    if (!active) return;

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(intervalRef.current);
        onExpire?.();
      }
    }, 250);

    return () => clearInterval(intervalRef.current);
  }, [timeLimit, active]);

  const pct = timeLeft / timeLimit;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const display = `${mins > 0 ? `${mins}:` : ''}${String(secs).padStart(2, '0')}`;

  const color =
    pct > 0.5 ? '#538d4e' :
    pct > 0.25 ? '#b59f3b' : '#e63946';

  // SVG circle
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div className="flex items-center gap-2">
      <svg width="52" height="52" className="-rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#3a3a3c" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.25s linear, stroke 0.5s' }}
        />
      </svg>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color, minWidth: '3ch' }}
      >
        {display}
      </span>
    </div>
  );
}
