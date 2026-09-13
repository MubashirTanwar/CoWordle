'use client';
import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import type { ChatMessage } from '@shared/types';

interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export default function Chat({ messages, onSend }: ChatProps) {
  const [text, setText] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    const msg = text.trim();
    if (!msg || cooldown) return;
    onSend(msg);
    setText('');
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Prevent game keyboard handler from intercepting chat input
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded" style={{ height: '220px' }}>
      <div className="px-3 py-2 border-b border-[#3a3a3c] text-xs text-[#818384] uppercase tracking-widest flex-shrink-0">
        Chat
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1 min-h-0">
        {messages.length === 0 && (
          <p className="text-[#565758] text-center text-xs mt-6">No messages yet</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="text-sm leading-snug break-words">
            <span className="text-[#b59f3b] font-semibold">{msg.playerName}: </span>
            <span className="text-[#d7dadc]">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex border-t border-[#3a3a3c] flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Send a message..."
          className="flex-1 bg-transparent text-white text-sm px-3 py-2 focus:outline-none placeholder:text-[#565758] min-w-0"
        />
        <button
          onClick={send}
          disabled={!text.trim() || cooldown}
          className="px-3 py-2 text-[#538d4e] hover:text-[#6aaf64] disabled:text-[#3a3a3c] transition-colors text-sm font-bold flex-shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
