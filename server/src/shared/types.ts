// Domain types shared by the Express/Socket.io server and the Next.js client.
// Keep this file dependency-free — the client imports it directly.

export const VARIANTS = ['classic', 'word500'] as const;
export type Variant = (typeof VARIANTS)[number];

export type LetterState = 'correct' | 'present' | 'absent';

/** Word500 feedback: how many letters are green / yellow / gray, but not which ones. */
export interface Word500Counts {
  correct: number;
  present: number;
  absent: number;
}

/** A single evaluated guess. Classic exposes per-letter `result`, Word500 only `counts`. */
export interface Guess {
  word: string;
  result?: LetterState[];
  counts?: Word500Counts;
}

export interface RoomSettings {
  timeLimit: number;
  rounds: number;
  hardMode: boolean;
  variant: Variant;
}

export type RoomStatus = 'lobby' | 'playing' | 'round-end' | 'finished';

export interface Player {
  socketId?: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface Room {
  roomCode: string;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  status: RoomStatus;
  currentRound: number;
  gameSessionId?: string;
}

export interface PlayerResult {
  playerId: string;
  playerName: string;
  guesses: Guess[];
  solved: boolean;
  timeTaken: number | null;
  points: number;
}

export interface FinalScore {
  playerId: string;
  playerName: string;
  totalPoints: number;
}

export interface RoundSummary {
  roundNumber: number;
  word: string;
  results: PlayerResult[];
}

export interface GameEndData {
  finalScores: FinalScore[];
  rounds: RoundSummary[];
}

export interface ChatMessage {
  playerName: string;
  text: string;
  timestamp: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  timeLimit: 120,
  rounds: 3,
  hardMode: false,
  variant: 'classic',
};

export const MAX_GUESSES: Record<Variant, number> = {
  classic: 6,
  word500: 8,
};

export const WORD_LENGTH = 5;
