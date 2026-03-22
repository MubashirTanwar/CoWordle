'use client';
import { useState, useEffect, useRef } from 'react';

// timeLimit  = remaining seconds (what to count down from)
// maxTime    = original total seconds (used to draw the arc proportion correctly)
export default function Timer({ timeLimit, maxTime, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const startRef = useRef(Date.now());
  const firedRef = useRef(false);
  const total = maxTime ?? timeLimit; // fallback: if no maxTime, arc starts full (new round)

  // Reset when a new round starts (timeLimit changes)
  useEffect(() => {
    setTimeLeft(timeLimit);
    startRef.current = Date.now();
    firedRef.current = false;
  }, [timeLimit]);

  // Always run the visual countdown — server handles actual expiry
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(interval);
        onExpire?.();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [timeLimit]);

  const pct = timeLeft / total; // arc relative to original total, not remaining
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const display = `${mins > 0 ? `${mins}:` : ''}${String(secs).padStart(2, '0')}`;

  const color =
    pct > 0.5 ? '#538d4e' :
    pct > 0.25 ? '#b59f3b' : '#e63946';

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
