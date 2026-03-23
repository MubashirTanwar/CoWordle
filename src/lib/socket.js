'use client';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
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
      withCredentials: true,
    });

    if (typeof window !== 'undefined') {
      window.__cowordleSocket = socket;
    }
  }

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    if (typeof window !== 'undefined') {
      window.__cowordleSocket = null;
    }
  }
}
