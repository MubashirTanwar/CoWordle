'use client';
import { useState, useEffect, useRef } from 'react';

export default function ChatBubbles({ messages, onSend }) {
  const [bubbles, setBubbles] = useState([]);
  const prevLenRef = useRef(0);
  const [text, setText] = useState('');
  const [cooldown, setCooldown] = useState(false);

  // Detect new messages and spawn a bubble for each
  useEffect(() => {
    const newOnes = messages.slice(prevLenRef.current);
    prevLenRef.current = messages.length;

    newOnes.forEach((msg) => {
      const id = Date.now() + Math.random();
      setBubbles((prev) => [...prev, { ...msg, id, exiting: false }]);

      // Start fade-out
      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => b.id === id ? { ...b, exiting: true } : b));
      }, 3500);

      // Remove from DOM
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
      }, 4000);
    });
  }, [messages]);

  function send() {
    const msg = text.trim();
    if (!msg || cooldown) return;
    onSend(msg);
    setText('');
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
  }

  function onKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* Floating bubbles — fixed overlay, bottom-right */}
      <div className="fixed bottom-6 right-4 flex flex-col-reverse gap-2 z-40 pointer-events-none max-w-[260px]">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className={`rounded-2xl px-3 py-2 text-sm shadow-lg backdrop-blur-sm bg-black/70 border border-white/10 ${
              b.exiting ? 'chat-bubble-exit' : 'chat-bubble-enter'
            }`}
          >
            <span className="text-[#b59f3b] font-semibold">{b.playerName}: </span>
            <span className="text-[#d7dadc]">{b.text}</span>
          </div>
        ))}
      </div>

      {/* Compact send input */}
      <div className="flex w-full border border-[#3a3a3c] rounded bg-[#1a1a1b]">
        <input
          type="text"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Chat..."
          className="flex-1 bg-transparent text-white text-sm px-3 py-2 focus:outline-none placeholder:text-[#565758] min-w-0"
        />
        <button
          onClick={send}
          disabled={!text.trim() || cooldown}
          className="px-3 py-2 text-[#538d4e] hover:text-[#6aaf64] disabled:text-[#3a3a3c] transition-colors text-sm font-bold flex-shrink-0"
        >
          ↵
        </button>
      </div>
    </>
  );
}
