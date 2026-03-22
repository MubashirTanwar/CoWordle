'use client';
import { useState, useCallback, useRef } from 'react';

const EMOJIS = ['🔥', '😂', '👏', '🤯', '😭', '💀', '🎉', '👀', '😤', '🫡', '💪', '🥶'];
const EMOJI_COOLDOWN_MS = 10000;

// ─── Flying emoji overlay ─────────────────────────────────────────────────────
export function FlyingEmojis({ emojis }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {emojis.map((e) => (
        <FlyingEmoji key={e.id} emoji={e.emoji} x={e.x} />
      ))}
    </div>
  );
}

function FlyingEmoji({ emoji, x }) {
  return (
    <div
      className="absolute bottom-0 text-4xl select-none animate-fly"
      style={{ left: `${x}%`, animationDuration: `${2.5 + Math.random() * 1.5}s` }}
    >
      {emoji}
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

  const addEmoji = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    const x = 5 + Math.random() * 85; // 5–90% horizontal
    setEmojis((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 4500);
  }, []);

  return { emojis, addEmoji };
}
