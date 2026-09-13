import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/events';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InterServerEvents {}

export interface SocketData {
  playerId?: string;
  playerName?: string;
}

// Type-safe Socket / Server
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** Runtime validation helper: returns the parsed payload, or null if it doesn't match the schema. */
export function parsePayload<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
