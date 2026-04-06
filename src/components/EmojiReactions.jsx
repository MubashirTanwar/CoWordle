'use client';
import { useState, useCallback, useRef } from 'react';

const EMOJIS = ['🔥', '😂', '👏', '🤯', '😭', '💀', '🎉', '👀', '😤', '🫡', '💪', '🥶', '👎', '😿', '🛑', '🤡', '💩', '😪', '🫠', '🤦', '😬', '🙅'];
const EMOJI_COOLDOWN_MS = 5000;

// ─── Flying emoji overlay ─────────────────────────────────────────────────────
export function FlyingEmojis({ emojis }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {emojis.map((e) => (
        <FlyingEmoji key={e.id} emoji={e.emoji} x={e.x} duration={e.duration} name={e.name} />
      ))}
    </div>
  );
}

function FlyingEmoji({ emoji, x, duration, name }) {
  return (
    <div
      className="absolute bottom-0 flex flex-col items-center gap-0.5 select-none animate-fly"
      style={{ left: `${x}%`, animationDuration: `${duration}s` }}
    >
      <span className="text-4xl">{emoji}</span>
      {name && (
        <span className="text-[11px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight">
          {name}
        </span>
      )}
    </div>
  );
}

// ─── Emoji picker bar ─────────────────────────────────────────────────────────
export function EmojiBar({ onSend }) {
  const lastSentRef = useRef(0);
  const [cooldown, setCooldown] = useState(false);

  function handleSend(emoji) {
    const now = Date.now();
    if (now - lastSentRef.current < EMOJI_COOLDOWN_MS) return;
    lastSentRef.current = now;
    onSend(emoji);
    setCooldown(true);
    setTimeout(() => setCooldown(false), EMOJI_COOLDOWN_MS);
  }

  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleSend(emoji)}
          disabled={cooldown}
          className="text-xl w-9 h-9 flex items-center justify-center rounded hover:bg-[#3a3a3c] transition-colors active:scale-125 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── Hook to manage flying emojis ─────────────────────────────────────────────
export function useFlyingEmojis() {
  const [emojis, setEmojis] = useState([]);

  const addEmoji = useCallback((emoji, name = '') => {
    const id = Date.now() + Math.random();
    const x = 5 + Math.random() * 85; // 5–90% horizontal
    const duration = 2.5 + Math.random() * 1.5;
    setEmojis((prev) => [...prev, { id, emoji, x, duration, name }]);
    setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 4500);
  }, []);

  return { emojis, addEmoji };
}
