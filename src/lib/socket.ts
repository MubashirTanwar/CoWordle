'use client';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';

/** Client-side typed socket: listens to server events, emits client events. */
export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

declare global {
  interface Window {
    __cowordleSocket?: ClientSocket | null;
  }
}

let socket: ClientSocket | null = null;

export function getSocket(): ClientSocket {
  // Reuse socket across HMR cycles to prevent duplicate connections
  if (!socket && typeof window !== 'undefined' && window.__cowordleSocket) {
    socket = window.__cowordleSocket;
  }

  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    if (typeof window !== 'undefined') {
      window.__cowordleSocket = socket;
    }
  }

  return socket;
}

export function connectSocket(): ClientSocket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    if (typeof window !== 'undefined') {
      window.__cowordleSocket = null;
    }
  }
}
