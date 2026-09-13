import type { Guess, Variant } from './types';

// REST response envelope shared by the Express routes and the client `api` helper.

export type ApiResponseStatus = 'success' | 'error';

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface ApiResponseMeta {
  timestamp: string;
  pagination?: PaginationInfo;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> =
  | { status: 'success'; data: T; errors: null; meta: ApiResponseMeta }
  | { status: 'error'; data: null; errors: ApiErrorBody[]; meta: ApiResponseMeta };

export interface HealthStatus {
  ok: true;
  uptime: number;
  db: 'connected';
}

// ─── Solo drill ───────────────────────────────────────────────────────────────

export interface SoloNewGameBody {
  variant: Variant;
  hardMode: boolean;
}

export interface SoloGame {
  gameId: string;
  variant: Variant;
  hardMode: boolean;
  maxGuesses: number;
}

export interface SoloGuessBody {
  guess: string;
}

export interface SoloGuessResponse {
  guess: Guess;
  isCorrect: boolean;
  finished: boolean;
  tries: number;
  /** Revealed only once the game is over. */
  answer?: string;
}
