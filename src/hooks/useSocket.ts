'use client';
import { useCallback, useEffect, useRef } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';

type Handlers = Partial<ServerToClientEvents>;

/** Subscribe to typed server events for the lifetime of the component. */
export function useSocket(handlers: Handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = connectSocket();
    const events = Object.keys(handlersRef.current) as (keyof ServerToClientEvents)[];

    const wrapped = events.map((event) => {
      const listener = (...args: unknown[]) => {
        (handlersRef.current[event] as ((...a: unknown[]) => void) | undefined)?.(...args);
      };
      socket.on(event, listener as never);
      return [event, listener] as const;
    });

    return () => {
      wrapped.forEach(([event, listener]) => socket.off(event, listener as never));
    };
  }, []);

  const emit = useCallback(<E extends keyof ClientToServerEvents>(event: E, ...args: Parameters<ClientToServerEvents[E]>) => {
    getSocket().emit(event, ...args);
  }, []);

  return { emit };
}
