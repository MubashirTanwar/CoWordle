'use client';
import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';

export function useSocket(handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = connectSocket();

    const wrappedHandlers = {};
    const events = Object.keys(handlersRef.current);

    events.forEach((event) => {
      wrappedHandlers[event] = (...args) => {
        handlersRef.current[event]?.(...args);
      };
      socket.on(event, wrappedHandlers[event]);
    });

    return () => {
      events.forEach((event) => {
        socket.off(event, wrappedHandlers[event]);
      });
    };
  }, []);

  const emit = useCallback((event, data) => {
    const socket = getSocket();
    socket.emit(event, data);
  }, []);

  return { emit };
}
