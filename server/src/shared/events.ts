import { z } from 'zod';
import { VARIANTS } from './types';
import type {
  ChatMessage,
  GameEndData,
  Guess,
  LetterState,
  Player,
  PlayerResult,
  Room,
  RoomSettings,
  RoomStatus,
  Variant,
  Word500Counts,
} from './types';

export enum Events {
  // Built-in
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',

  // Client → Server
  REQUEST_SYNC = 'request-sync',
  CREATE_ROOM = 'create-room',
  JOIN_ROOM = 'join-room',
  UPDATE_SETTINGS = 'update-settings',
  START_GAME = 'start-game',
  SUBMIT_GUESS = 'submit-guess',
  PLAY_AGAIN = 'play-again',
  SEND_MESSAGE = 'send-message',
  SEND_EMOJI = 'send-emoji',

  // Server → Client
  SYNC_STATE = 'sync-state',
  ROOM_CREATED = 'room-created',
  ROOM_JOINED = 'room-joined',
  PLAYER_JOINED = 'player-joined',
  PLAYER_LEFT = 'player-left',
  SETTINGS_UPDATED = 'settings-updated',
  GAME_STARTED = 'game-started',
  GUESS_RESULT = 'guess-result',
  INVALID_WORD = 'invalid-word',
  PLAYER_GUESSED = 'player-guessed',
  PLAYER_FINISHED = 'player-finished',
  ROUND_ENDED = 'round-ended',
  GAME_ENDED = 'game-ended',
  MESSAGE_RECEIVED = 'message-received',
  EMOJI_REACTION = 'emoji-reaction',
  PLAY_AGAIN_REDIRECT = 'play-again-redirect',
  ERROR = 'error',
}

// ─── Client → Server schemas (validated at runtime on the server) ─────────────

const RoomCode = z.string().trim().min(1).max(12).transform((s) => s.toUpperCase());
const PlayerId = z.string().min(1).max(64);
const PlayerName = z.string().trim().min(1).max(16);

export const RoomSettingsSchema = z.object({
  timeLimit: z.number().int().min(30).max(300).default(120),
  rounds: z.number().int().min(1).max(10).default(3),
  hardMode: z.boolean().default(false),
  variant: z.enum(VARIANTS).default('classic'),
});

export const RequestSyncSchema = z.object({ roomCode: RoomCode, playerId: PlayerId });
export const CreateRoomSchema = z.object({
  playerName: PlayerName,
  playerId: PlayerId,
  settings: RoomSettingsSchema.partial().optional(),
});
export const JoinRoomSchema = z.object({ roomCode: RoomCode, playerName: PlayerName, playerId: PlayerId });
export const UpdateSettingsSchema = z.object({ roomCode: RoomCode, playerId: PlayerId, settings: RoomSettingsSchema });
export const StartGameSchema = z.object({ roomCode: RoomCode, playerId: PlayerId });
export const SubmitGuessSchema = z.object({ roomCode: RoomCode, playerId: PlayerId, guess: z.string().trim() });
export const PlayAgainSchema = z.object({
  roomCode: RoomCode,
  playerId: PlayerId,
  settings: RoomSettingsSchema.partial().optional(),
});
export const SendMessageSchema = z.object({ roomCode: RoomCode, playerName: PlayerName, text: z.string().trim().min(1) });
export const SendEmojiSchema = z.object({ roomCode: RoomCode, playerName: PlayerName, emoji: z.string().min(1).max(16) });

// Infer Zod types (input = what the client sends, before defaults/transforms)
export type RequestSync = z.input<typeof RequestSyncSchema>;
export type CreateRoom = z.input<typeof CreateRoomSchema>;
export type JoinRoom = z.input<typeof JoinRoomSchema>;
export type UpdateSettings = z.input<typeof UpdateSettingsSchema>;
export type StartGame = z.input<typeof StartGameSchema>;
export type SubmitGuess = z.input<typeof SubmitGuessSchema>;
export type PlayAgain = z.input<typeof PlayAgainSchema>;
export type SendMessage = z.input<typeof SendMessageSchema>;
export type SendEmoji = z.input<typeof SendEmojiSchema>;

// ─── Server → Client payloads ─────────────────────────────────────────────────

export interface RoundInfo {
  roundNumber: number;
  totalRounds: number;
  timeLimit: number;
  elapsed: number;
  hardMode: boolean;
  variant: Variant;
}

export interface SyncState {
  room: Room;
  phase: RoomStatus;
  roundInfo?: RoundInfo;
  guesses?: Guess[];
  finished?: boolean;
  gameEndData?: GameEndData;
  messages: ChatMessage[];
}

export interface RoomCreated { roomCode: string; room: Room }
export interface RoomJoined { room: Room }
export interface PlayersChanged { players: Player[]; playerName: string }
export interface SettingsUpdated { settings: RoomSettings }

export interface GameStarted {
  roundNumber: number;
  totalRounds: number;
  timeLimit: number;
  hardMode: boolean;
  variant: Variant;
}

export interface GuessResult {
  guess: string;
  result?: LetterState[];
  counts?: Word500Counts;
  isCorrect: boolean;
}

export interface InvalidWord { guess: string; message: string }

export interface PlayerGuessed {
  playerId: string;
  tryNumber: number;
  result?: LetterState[];
  counts?: Word500Counts;
}

export interface PlayerFinished {
  playerName: string;
  playerId: string;
  solved: boolean;
  tries: number;
  timeTaken: number | null;
  points: number;
}

export interface RoundEnded {
  roundNumber: number;
  word: string;
  results: PlayerResult[];
  isLastRound: boolean;
}

export interface EmojiReaction { playerName: string; emoji: string }
export interface PlayAgainRedirect { roomCode: string }
export interface ErrorPayload { message: string }

// Map events to their payload types
export interface SocketEvent {
  [Events.REQUEST_SYNC]: RequestSync;
  [Events.CREATE_ROOM]: CreateRoom;
  [Events.JOIN_ROOM]: JoinRoom;
  [Events.UPDATE_SETTINGS]: UpdateSettings;
  [Events.START_GAME]: StartGame;
  [Events.SUBMIT_GUESS]: SubmitGuess;
  [Events.PLAY_AGAIN]: PlayAgain;
  [Events.SEND_MESSAGE]: SendMessage;
  [Events.SEND_EMOJI]: SendEmoji;

  [Events.SYNC_STATE]: SyncState;
  [Events.ROOM_CREATED]: RoomCreated;
  [Events.ROOM_JOINED]: RoomJoined;
  [Events.PLAYER_JOINED]: PlayersChanged;
  [Events.PLAYER_LEFT]: PlayersChanged;
  [Events.SETTINGS_UPDATED]: SettingsUpdated;
  [Events.GAME_STARTED]: GameStarted;
  [Events.GUESS_RESULT]: GuessResult;
  [Events.INVALID_WORD]: InvalidWord;
  [Events.PLAYER_GUESSED]: PlayerGuessed;
  [Events.PLAYER_FINISHED]: PlayerFinished;
  [Events.ROUND_ENDED]: RoundEnded;
  [Events.GAME_ENDED]: GameEndData;
  [Events.MESSAGE_RECEIVED]: ChatMessage;
  [Events.EMOJI_REACTION]: EmojiReaction;
  [Events.PLAY_AGAIN_REDIRECT]: PlayAgainRedirect;
  [Events.ERROR]: ErrorPayload;
}

// Type parameters for socket.io's Server / Socket generics
export interface ClientToServerEvents {
  [Events.REQUEST_SYNC]: (data: SocketEvent[Events.REQUEST_SYNC]) => void;
  [Events.CREATE_ROOM]: (data: SocketEvent[Events.CREATE_ROOM]) => void;
  [Events.JOIN_ROOM]: (data: SocketEvent[Events.JOIN_ROOM]) => void;
  [Events.UPDATE_SETTINGS]: (data: SocketEvent[Events.UPDATE_SETTINGS]) => void;
  [Events.START_GAME]: (data: SocketEvent[Events.START_GAME]) => void;
  [Events.SUBMIT_GUESS]: (data: SocketEvent[Events.SUBMIT_GUESS]) => void;
  [Events.PLAY_AGAIN]: (data: SocketEvent[Events.PLAY_AGAIN]) => void;
  [Events.SEND_MESSAGE]: (data: SocketEvent[Events.SEND_MESSAGE]) => void;
  [Events.SEND_EMOJI]: (data: SocketEvent[Events.SEND_EMOJI]) => void;
}

export interface ServerToClientEvents {
  [Events.SYNC_STATE]: (data: SocketEvent[Events.SYNC_STATE]) => void;
  [Events.ROOM_CREATED]: (data: SocketEvent[Events.ROOM_CREATED]) => void;
  [Events.ROOM_JOINED]: (data: SocketEvent[Events.ROOM_JOINED]) => void;
  [Events.PLAYER_JOINED]: (data: SocketEvent[Events.PLAYER_JOINED]) => void;
  [Events.PLAYER_LEFT]: (data: SocketEvent[Events.PLAYER_LEFT]) => void;
  [Events.SETTINGS_UPDATED]: (data: SocketEvent[Events.SETTINGS_UPDATED]) => void;
  [Events.GAME_STARTED]: (data: SocketEvent[Events.GAME_STARTED]) => void;
  [Events.GUESS_RESULT]: (data: SocketEvent[Events.GUESS_RESULT]) => void;
  [Events.INVALID_WORD]: (data: SocketEvent[Events.INVALID_WORD]) => void;
  [Events.PLAYER_GUESSED]: (data: SocketEvent[Events.PLAYER_GUESSED]) => void;
  [Events.PLAYER_FINISHED]: (data: SocketEvent[Events.PLAYER_FINISHED]) => void;
  [Events.ROUND_ENDED]: (data: SocketEvent[Events.ROUND_ENDED]) => void;
  [Events.GAME_ENDED]: (data: SocketEvent[Events.GAME_ENDED]) => void;
  [Events.MESSAGE_RECEIVED]: (data: SocketEvent[Events.MESSAGE_RECEIVED]) => void;
  [Events.EMOJI_REACTION]: (data: SocketEvent[Events.EMOJI_REACTION]) => void;
  [Events.PLAY_AGAIN_REDIRECT]: (data: SocketEvent[Events.PLAY_AGAIN_REDIRECT]) => void;
  [Events.ERROR]: (data: SocketEvent[Events.ERROR]) => void;
}

export type ClientEvent = keyof ClientToServerEvents;
export type ServerEvent = keyof ServerToClientEvents;
