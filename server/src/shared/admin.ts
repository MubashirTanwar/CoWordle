// Admin panel API contract (Express ⇄ Next.js admin pages).
import type { Guess, Variant } from './types';

export interface DailyCount {
  date: string; // YYYY-MM-DD (UTC)
  games: number;
  solo: number;
}

export interface WordStat {
  word: string;
  attempts: number;
  solveRate: number; // 0–1
}

export interface AdminOverview {
  totals: {
    games: number;          // multiplayer games played to the end
    gamesStarted: number;   // includes abandoned ones
    rounds: number;
    players: number;        // unique player ids across multiplayer + solo
    guesses: number;
    soloGames: number;
  };
  last24h: { games: number; soloGames: number; players: number };
  last7d: { games: number; soloGames: number; players: number };
  live: { roomsPlaying: number; roomsInLobby: number };
  solveRate: number;        // 0–1, multiplayer player-rounds
  avgTries: number | null;  // solved player-rounds
  avgSolveTime: number | null; // seconds
  variants: { classic: number; word500: number };
  daily: DailyCount[];      // last 30 days
  hardestWords: WordStat[];
  easiestWords: WordStat[];
  topFirstGuesses: { word: string; count: number }[];
}

export interface GameListItem {
  id: string;
  roomCode: string;
  createdAt: string;
  variant: Variant;
  hardMode: boolean;
  roundsPlayed: number;
  finished: boolean;
  players: { playerId: string; playerName: string; totalPoints: number }[];
  winner: { playerId: string; playerName: string; totalPoints: number } | null;
}

export interface GameDetail extends GameListItem {
  rounds: {
    roundNumber: number;
    word: string;
    timeLimit: number;
    results: {
      playerId: string;
      playerName: string;
      guesses: Guess[];
      solved: boolean;
      timeTaken: number | null;
      points: number;
    }[];
  }[];
}

export type PlayerSort = 'points' | 'wins' | 'games' | 'solveRate' | 'avgTries' | 'recent';

export interface PlayerSummary {
  playerId: string;
  playerName: string;   // most recent name used
  names: string[];      // every name this id has used
  games: number;        // multiplayer games played to the end
  wins: number;
  totalPoints: number;
  rounds: number;
  solved: number;
  solveRate: number;    // 0–1
  avgTries: number | null;
  avgSolveTime: number | null;
  soloGames: number;
  soloSolved: number;
  lastSeen: string;
}

export interface PlayerDetail extends PlayerSummary {
  firstSeen: string;
  bestGameScore: number;
  fastestSolve: number | null;
  /** Solved rounds by number of tries (index 0 = 1 try). */
  guessDistribution: number[];
  bestSoloStreak: number;
  recentGames: (GameListItem & { rank: number; points: number })[];
  recentSolo: {
    createdAt: string;
    variant: Variant;
    hardMode: boolean;
    word: string;
    solved: boolean;
    tries: number;
    durationSec: number | null;
  }[];
}

export interface RecordEntry {
  label: string;
  value: string;
  playerId?: string;
  playerName?: string;
  gameId?: string;
  detail?: string;
  date?: string;
}

export interface AdminRecords {
  records: RecordEntry[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
