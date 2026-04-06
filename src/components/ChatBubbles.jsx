'use client';
import { useState, useEffect, useRef } from 'react';

export default function ChatBubbles({ messages, onSend }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  // null = not yet initialized; skip spawning bubbles for history loaded on mount/sync
  const prevLenRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (prevLenRef.current === null) {
      // First time messages arrive (sync/mount) — treat all as history, no bubbles
      prevLenRef.current = messages.length;
      return;
    }
    const newOnes = messages.slice(prevLenRef.current);
    prevLenRef.current = messages.length;

    newOnes.forEach((msg) => {
      const id = Date.now() + Math.random();
      setBubbles((prev) => [...prev, { ...msg, id, exiting: false }]);
      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => b.id === id ? { ...b, exiting: true } : b));
      }, 3500);
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
      }, 4000);
    });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <>
      {/* Floating message bubbles — above the FAB */}
      <div className="fixed bottom-20 right-4 flex flex-col-reverse gap-1.5 z-40 pointer-events-none max-w-[260px]">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className={`rounded-2xl px-3 py-2 text-sm shadow-lg bg-black/75 border border-white/10 backdrop-blur-sm ${
              b.exiting ? 'chat-bubble-exit' : 'chat-bubble-enter'
            }`}
          >
            <span className="text-[#b59f3b] font-semibold">{b.playerName}: </span>
            <span className="text-[#d7dadc]">{b.text}</span>
          </div>
        ))}
      </div>

      {/* FAB row — icon + slide-in input */}
      <div className="fixed bottom-5 right-4 z-50 flex items-center gap-2">
        {open && (
          <div className="flex items-center bg-[#1a1a1b] border border-[#3a3a3c] rounded-full shadow-xl overflow-hidden chat-bubble-enter">
            <input
              ref={inputRef}
              type="text"
              value={text}
              maxLength={200}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Say something..."
              className="bg-transparent text-white text-sm px-4 py-2.5 focus:outline-none placeholder:text-[#565758] w-48"
            />
            <button
              onClick={send}
              disabled={!text.trim() || cooldown}
              className="px-3 pr-4 py-2.5 text-[#538d4e] hover:text-[#6aaf64] disabled:text-[#3a3a3c] transition-colors text-base font-bold flex-shrink-0"
            >
              ↵
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="w-11 h-11 rounded-full bg-[#1a1a1b] border border-[#3a3a3c] hover:border-[#565758] flex items-center justify-center shadow-lg transition-colors text-xl flex-shrink-0"
          title={open ? 'Close chat' : 'Open chat'}
        >
          {open ? '✕' : '💬'}
        </button>
      </div>
    </>
  );
}
