import type { z } from 'zod';
import Room, { type RoomDoc } from '../models/Room';
import GameSession from '../models/GameSession';
import { getRandomWord, VALID_WORDS_SET } from '../lib/words';
import { buildGuess, calculatePoints, checkHardMode } from '../shared/wordle';
import { DEFAULT_SETTINGS, MAX_GUESSES } from '../shared/types';
import type {
  ChatMessage,
  FinalScore,
  Guess,
  Player,
  PlayerResult,
  Room as RoomDTO,
  RoomSettings,
  RoomStatus,
  RoundSummary,
  Variant,
} from '../shared/types';
import {
  CreateRoomSchema,
  Events,
  JoinRoomSchema,
  PlayAgainSchema,
  RequestSyncSchema,
  SendEmojiSchema,
  SendMessageSchema,
  StartGameSchema,
  SubmitGuessSchema,
  UpdateSettingsSchema,
  type ClientEvent,
  type SyncState,
} from '../shared/events';
import { parsePayload, type TypedServer, type TypedSocket } from './types';

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueRoomCode(): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const code = generateRoomCode();
    const exists = await Room.findOne({ roomCode: code });
    if (!exists) return code;
  }
  return null;
}

/** Word500 has no positional hints, so hard mode only applies to classic. */
function normalizeSettings(settings: Partial<RoomSettings> | undefined, base: RoomSettings = DEFAULT_SETTINGS): RoomSettings {
  const merged = { ...base, ...settings };
  return { ...merged, hardMode: merged.variant === 'classic' && merged.hardMode };
}

function settingsOf(room: RoomDoc): RoomSettings {
  return normalizeSettings({
    timeLimit: room.settings?.timeLimit ?? DEFAULT_SETTINGS.timeLimit,
    rounds: room.settings?.rounds ?? DEFAULT_SETTINGS.rounds,
    hardMode: room.settings?.hardMode ?? false,
    variant: (room.settings?.variant as Variant | undefined) ?? 'classic',
  });
}

function toPlayer(p: RoomDoc['players'][number]): Player {
  return {
    socketId: p.socketId ?? undefined,
    playerId: p.playerId,
    playerName: p.playerName,
    isHost: p.isHost ?? false,
    isConnected: p.isConnected ?? true,
  };
}

function toRoom(room: RoomDoc): RoomDTO {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    players: room.players.map(toPlayer),
    settings: settingsOf(room),
    status: room.status as RoomStatus,
    currentRound: room.currentRound ?? 0,
    gameSessionId: room.gameSessionId?.toString(),
  };
}

function toPlayerResult(r: {
  playerId?: string | null;
  playerName?: string | null;
  guesses: { word?: string | null; result?: string[] | null; counts?: { correct?: number | null; present?: number | null; absent?: number | null } | null }[];
  solved?: boolean | null;
  timeTaken?: number | null;
  points?: number | null;
}): PlayerResult {
  return {
    playerId: r.playerId ?? '',
    playerName: r.playerName ?? '',
    guesses: r.guesses.map((g) => ({
      word: g.word ?? '',
      ...(g.result?.length ? { result: g.result as Guess['result'] } : {}),
      ...(g.counts ? { counts: { correct: g.counts.correct ?? 0, present: g.counts.present ?? 0, absent: g.counts.absent ?? 0 } } : {}),
    })),
    solved: r.solved ?? false,
    timeTaken: r.timeTaken ?? null,
    points: r.points ?? 0,
  };
}

type SessionRound = { roundNumber?: number | null; word?: string | null; playerResults: Parameters<typeof toPlayerResult>[0][] };

function toRoundSummary(r: SessionRound): RoundSummary {
  return {
    roundNumber: r.roundNumber ?? 0,
    word: r.word ?? '',
    results: r.playerResults.map(toPlayerResult),
  };
}

// ─── In-memory game state ─────────────────────────────────────────────────────

interface PlayerRoundState {
  guesses: Guess[];
  finished: boolean;
  solved: boolean;
  timeTaken: number | null;
  points: number;
  disconnected?: boolean;
}

interface RoundState {
  word: string;
  roundNumber: number;
  roundStartTime: number; // ms
  timeLimit: number; // s
  variant: Variant;
  hardMode: boolean;
  players: Record<string, PlayerRoundState>;
  timer: NodeJS.Timeout | null;
}

const gameState: Record<string, RoundState> = {};

// ─── In-memory chat messages (capped at 100 per room) ─────────────────────────
const chatMessages: Record<string, ChatMessage[]> = {};

function freshPlayerState(): PlayerRoundState {
  return { guesses: [], finished: false, solved: false, timeTaken: null, points: 0 };
}

// ─── Round lifecycle ──────────────────────────────────────────────────────────

async function startRound(io: TypedServer, roomCode: string, roundNumber: number): Promise<void> {
  const room = await Room.findOne({ roomCode });
  if (!room) return;
  const word = getRandomWord();
  const { timeLimit, rounds, hardMode, variant } = settingsOf(room);

  // Init in-memory state
  const playerMap: Record<string, PlayerRoundState> = {};
  room.players.filter((p) => p.isConnected).forEach((p) => {
    playerMap[p.playerId] = freshPlayerState();
  });

  const existing = gameState[roomCode];
  if (existing?.timer) clearTimeout(existing.timer);
  gameState[roomCode] = {
    word,
    roundNumber,
    roundStartTime: Date.now(),
    timeLimit,
    variant,
    hardMode,
    players: playerMap,
    timer: null,
  };

  // Persist round stub to DB
  const session = await GameSession.findById(room.gameSessionId);
  if (session) {
    session.rounds.push({ roundNumber, word, timeLimit, playerResults: [] });
    await session.save();
  }

  // Notify clients (do NOT send word)
  io.to(roomCode).emit(Events.GAME_STARTED, { roundNumber, totalRounds: rounds, timeLimit, hardMode, variant });

  // Start timer
  gameState[roomCode].timer = setTimeout(() => endRound(io, roomCode), timeLimit * 1000);
}

async function endRound(io: TypedServer, roomCode: string): Promise<void> {
  const state = gameState[roomCode];
  if (!state) return;

  if (state.timer) clearTimeout(state.timer);
  state.timer = null;

  const room = await Room.findOne({ roomCode });
  if (!room || room.status === 'finished') return;

  const session = await GameSession.findById(room.gameSessionId);
  const roundDoc = session?.rounds.find((r) => r.roundNumber === state.roundNumber);
  if (!session || !roundDoc) return;

  // Persist all player results
  for (const [playerId, pState] of Object.entries(state.players)) {
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) continue;
    const existing = roundDoc.playerResults.find((r) => r.playerId === playerId);
    if (!existing) {
      roundDoc.playerResults.push({
        playerId,
        playerName: player.playerName,
        guesses: pState.guesses,
        solved: pState.solved,
        timeTaken: pState.timeTaken,
        points: pState.points,
      });
    }
  }
  await session.save();

  const isLastRound = state.roundNumber >= settingsOf(room).rounds;
  room.status = 'round-end';
  await room.save();

  io.to(roomCode).emit(Events.ROUND_ENDED, {
    roundNumber: state.roundNumber,
    word: state.word,
    results: roundDoc.playerResults.map(toPlayerResult),
    isLastRound,
  });

  if (isLastRound) {
    setTimeout(() => endGame(io, roomCode), 3000);
  } else {
    setTimeout(() => {
      startRound(io, roomCode, state.roundNumber + 1);
      updateRoomStatus(roomCode, 'playing');
    }, 6000);
  }
}

async function updateRoomStatus(roomCode: string, status: RoomStatus): Promise<void> {
  await Room.updateOne({ roomCode }, { status });
}

async function endGame(io: TypedServer, roomCode: string): Promise<void> {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const session = await GameSession.findById(room.gameSessionId);
  if (!session) return;
  const scoreMap: Record<string, FinalScore> = {};

  room.players.forEach((p) => {
    scoreMap[p.playerId] = { playerId: p.playerId, playerName: p.playerName, totalPoints: 0 };
  });

  for (const round of session.rounds) {
    for (const result of round.playerResults) {
      if (result.playerId && scoreMap[result.playerId]) {
        scoreMap[result.playerId].totalPoints += result.points ?? 0;
      }
    }
  }

  const finalScores = Object.values(scoreMap).sort((a, b) => b.totalPoints - a.totalPoints);
  session.set('finalScores', finalScores);
  await session.save();

  room.status = 'finished';
  await room.save();

  io.to(roomCode).emit(Events.GAME_ENDED, {
    finalScores,
    rounds: session.rounds.map(toRoundSummary),
  });

  delete gameState[roomCode];
  delete chatMessages[roomCode];
}

// ─── Typed + validated event registration ─────────────────────────────────────

function on<E extends ClientEvent, S extends z.ZodTypeAny>(
  socket: TypedSocket,
  event: E,
  schema: S,
  handler: (data: z.output<S>) => void | Promise<void>,
): void {
  const listener = (raw: unknown) => {
    const data = parsePayload(schema, raw);
    if (!data) {
      socket.emit(Events.ERROR, { message: 'Invalid request' });
      return;
    }
    void handler(data);
  };
  // The payload is validated at runtime above, so the listener accepts `unknown`
  // instead of the declared ClientToServerEvents[E] argument type.
  socket.on(event, listener as never);
}

// ─── Main socket handler ──────────────────────────────────────────────────────

export default function setupGameHandler(io: TypedServer): void {
  io.on(Events.CONNECTION, (socket: TypedSocket) => {
    // ── Sync State (reconnect / refresh) ──
    on(socket, Events.REQUEST_SYNC, RequestSyncSchema, async ({ roomCode, playerId }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) { socket.emit(Events.ERROR, { message: 'Room not found' }); return; }

        // Re-attach socket
        const player = room.players.find((p) => p.playerId === playerId);
        if (player) {
          player.socketId = socket.id;
          player.isConnected = true;
          await room.save();
          socket.join(roomCode);
          // Notify others this player is back
          socket.to(roomCode).emit(Events.PLAYER_JOINED, {
            players: room.players.map(toPlayer),
            playerName: player.playerName,
          });
        }

        // If room thinks it's playing but in-memory state is gone (server restart), reset to lobby
        if (room.status === 'playing' && !gameState[roomCode]) {
          room.status = 'lobby';
          await room.save();
        }

        const syncPayload: SyncState = {
          room: toRoom(room),
          phase: room.status as RoomStatus,
          messages: chatMessages[roomCode] || [],
        };

        const state = gameState[roomCode];
        if (room.status === 'playing' && state) {
          const elapsed = Math.floor((Date.now() - state.roundStartTime) / 1000);
          syncPayload.roundInfo = {
            roundNumber: state.roundNumber,
            totalRounds: settingsOf(room).rounds,
            timeLimit: state.timeLimit,
            elapsed,
            hardMode: state.hardMode,
            variant: state.variant,
          };
          // Restore player (re-connect): clear disconnected flag, preserve existing guesses
          if (!state.players[playerId]) {
            state.players[playerId] = freshPlayerState();
          } else {
            state.players[playerId].disconnected = false;
          }
          const pState = state.players[playerId];
          syncPayload.guesses = pState.guesses;
          syncPayload.finished = pState.finished;
        }

        if (room.status === 'finished' && room.gameSessionId) {
          const session = await GameSession.findById(room.gameSessionId);
          if (session) {
            syncPayload.gameEndData = {
              finalScores: session.finalScores.map((s) => ({
                playerId: s.playerId ?? '',
                playerName: s.playerName ?? '',
                totalPoints: s.totalPoints ?? 0,
              })),
              rounds: session.rounds.map(toRoundSummary),
            };
          }
        }

        socket.emit(Events.SYNC_STATE, syncPayload);
      } catch (err) {
        console.error('request-sync error:', err);
        socket.emit(Events.ERROR, { message: 'Failed to sync state' });
      }
    });

    // ── Create Room ──
    on(socket, Events.CREATE_ROOM, CreateRoomSchema, async ({ playerName, playerId, settings }) => {
      try {
        const roomCode = await generateUniqueRoomCode();
        if (!roomCode) { socket.emit(Events.ERROR, { message: 'Failed to generate room code' }); return; }

        const room = new Room({
          roomCode,
          hostId: playerId,
          players: [{ socketId: socket.id, playerId, playerName, isHost: true, isConnected: true }],
          settings: normalizeSettings(settings),
        });
        await room.save();

        socket.join(roomCode);
        socket.emit(Events.ROOM_CREATED, { roomCode, room: toRoom(room) });
      } catch (err) {
        console.error('create-room error:', err);
        socket.emit(Events.ERROR, { message: 'Failed to create room' });
      }
    });

    // ── Join Room ──
    on(socket, Events.JOIN_ROOM, JoinRoomSchema, async ({ roomCode, playerName, playerId }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) { socket.emit(Events.ERROR, { message: 'Room not found' }); return; }
        // Allow reconnect if the player was already in the room; block new players during a game
        const existing = room.players.find((p) => p.playerId === playerId);
        if (room.status !== 'lobby' && !existing) {
          socket.emit(Events.ERROR, { message: 'Game already in progress' }); return;
        }

        if (existing) {
          existing.socketId = socket.id;
          existing.isConnected = true;
        } else {
          room.players.push({ socketId: socket.id, playerId, playerName, isHost: false, isConnected: true });
        }
        await room.save();

        socket.join(roomCode);
        socket.emit(Events.ROOM_JOINED, { room: toRoom(room) });
        socket.to(roomCode).emit(Events.PLAYER_JOINED, {
          players: room.players.map(toPlayer),
          playerName,
        });
      } catch (err) {
        console.error('join-room error:', err);
        socket.emit(Events.ERROR, { message: 'Failed to join room' });
      }
    });

    // ── Update Settings ──
    on(socket, Events.UPDATE_SETTINGS, UpdateSettingsSchema, async ({ roomCode, playerId, settings }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room || room.hostId !== playerId || room.status !== 'lobby') return;
        const next = normalizeSettings(settings);
        room.set('settings', next);
        await room.save();
        io.to(roomCode).emit(Events.SETTINGS_UPDATED, { settings: next });
      } catch (err) {
        console.error('update-settings error:', err);
      }
    });

    // ── Start Game ──
    on(socket, Events.START_GAME, StartGameSchema, async ({ roomCode, playerId }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) { socket.emit(Events.ERROR, { message: 'Room not found' }); return; }
        if (room.hostId !== playerId) { socket.emit(Events.ERROR, { message: 'Only host can start' }); return; }
        if (room.status !== 'lobby') { socket.emit(Events.ERROR, { message: 'Game already started' }); return; }

        const session = new GameSession({ roomCode, rounds: [], finalScores: [] });
        await session.save();

        room.gameSessionId = session._id;
        room.currentRound = 1;
        room.status = 'playing';
        await room.save();

        await startRound(io, roomCode, 1);
      } catch (err) {
        console.error('start-game error:', err);
        socket.emit(Events.ERROR, { message: 'Failed to start game' });
      }
    });

    // ── Submit Guess ──
    on(socket, Events.SUBMIT_GUESS, SubmitGuessSchema, async ({ roomCode, playerId, guess }) => {
      try {
        const state = gameState[roomCode];
        if (!state) { socket.emit(Events.ERROR, { message: 'No active game' }); return; }

        // Re-add player if they reconnected mid-game and aren't in state yet
        if (!state.players[playerId]) state.players[playerId] = freshPlayerState();
        const playerState = state.players[playerId];
        if (playerState.finished) return;

        const guessUpper = guess.toUpperCase();
        if (!/^[A-Z]{5}$/.test(guessUpper)) { socket.emit(Events.ERROR, { message: 'Guess must be 5 letters' }); return; }
        if (!VALID_WORDS_SET.has(guessUpper)) {
          socket.emit(Events.INVALID_WORD, { guess: guessUpper, message: 'Not in word list' });
          return;
        }
        if (state.hardMode) {
          const err = checkHardMode(guessUpper, playerState.guesses);
          if (err) { socket.emit(Events.INVALID_WORD, { guess: guessUpper, message: err }); return; }
        }

        const { isCorrect, ...evaluated } = buildGuess(guessUpper, state.word, state.variant);
        playerState.guesses.push(evaluated);

        socket.emit(Events.GUESS_RESULT, { guess: guessUpper, result: evaluated.result, counts: evaluated.counts, isCorrect });

        // Broadcast latest feedback + try count to all OTHER players (no word revealed)
        socket.to(roomCode).emit(Events.PLAYER_GUESSED, {
          playerId,
          result: evaluated.result,
          counts: evaluated.counts,
          tryNumber: playerState.guesses.length,
        });

        if (isCorrect || playerState.guesses.length >= MAX_GUESSES[state.variant]) {
          playerState.finished = true;
          playerState.solved = isCorrect;

          if (isCorrect) {
            const timeTaken = Math.floor((Date.now() - state.roundStartTime) / 1000);
            playerState.timeTaken = timeTaken;
            playerState.points = calculatePoints(playerState.guesses.length, timeTaken, state.timeLimit, state.variant);
          }

          const room = await Room.findOne({ roomCode });
          const player = room?.players.find((p) => p.playerId === playerId);

          io.to(roomCode).emit(Events.PLAYER_FINISHED, {
            playerName: player?.playerName || 'Unknown',
            playerId,
            solved: playerState.solved,
            tries: playerState.guesses.length,
            timeTaken: playerState.timeTaken,
            points: playerState.points,
          });

          // Check if all connected players finished
          const activePlayers = Object.values(state.players).filter((p) => !p.disconnected);
          const allDone = activePlayers.length > 0 && activePlayers.every((p) => p.finished);
          if (allDone) {
            if (state.timer) clearTimeout(state.timer);
            endRound(io, roomCode);
          }
        }
      } catch (err) {
        console.error('submit-guess error:', err);
        socket.emit(Events.ERROR, { message: 'Failed to process guess' });
      }
    });

    // ── Play Again ──
    on(socket, Events.PLAY_AGAIN, PlayAgainSchema, async ({ roomCode, playerId, settings }) => {
      try {
        const oldRoom = await Room.findOne({ roomCode });
        if (!oldRoom) { socket.emit(Events.ERROR, { message: 'Room not found' }); return; }

        const newCode = await generateUniqueRoomCode();
        if (!newCode) { socket.emit(Events.ERROR, { message: 'Failed to generate room code' }); return; }

        // New room: requesting player becomes host, keep same settings
        const requestingPlayer = oldRoom.players.find((p) => p.playerId === playerId);
        const newRoom = new Room({
          roomCode: newCode,
          hostId: playerId,
          players: [{ socketId: socket.id, playerId, playerName: requestingPlayer?.playerName || 'Player', isHost: true, isConnected: true }],
          settings: normalizeSettings(settings, settingsOf(oldRoom)),
        });
        await newRoom.save();

        // Broadcast redirect to everyone in the old room, then the initiator
        socket.to(roomCode).emit(Events.PLAY_AGAIN_REDIRECT, { roomCode: newCode });
        socket.join(newCode);
        socket.emit(Events.PLAY_AGAIN_REDIRECT, { roomCode: newCode });
      } catch (err) {
        console.error('play-again error:', err);
        socket.emit(Events.ERROR, { message: 'Failed to create new room' });
      }
    });

    // ── Chat Message ──
    on(socket, Events.SEND_MESSAGE, SendMessageSchema, ({ roomCode, playerName, text }) => {
      const msg: ChatMessage = { playerName, text: text.slice(0, 200), timestamp: Date.now() };
      if (!chatMessages[roomCode]) chatMessages[roomCode] = [];
      chatMessages[roomCode].push(msg);
      if (chatMessages[roomCode].length > 100) chatMessages[roomCode].shift();
      io.to(roomCode).emit(Events.MESSAGE_RECEIVED, msg);
    });

    // ── Emoji Reaction ──
    on(socket, Events.SEND_EMOJI, SendEmojiSchema, ({ roomCode, playerName, emoji }) => {
      socket.to(roomCode).emit(Events.EMOJI_REACTION, { playerName, emoji });
    });

    // ── Disconnect ──
    socket.on(Events.DISCONNECT, async () => {
      try {
        const rooms = await Room.find({ 'players.socketId': socket.id, status: { $ne: 'finished' } });
        for (const room of rooms) {
          const player = room.players.find((p) => p.socketId === socket.id);
          if (!player) continue;
          player.isConnected = false;
          await room.save();

          io.to(room.roomCode).emit(Events.PLAYER_LEFT, {
            players: room.players.map(toPlayer),
            playerName: player.playerName,
          });

          const state = gameState[room.roomCode];
          // Mark as disconnected but keep guesses so they're restored on reconnect
          if (state?.players[player.playerId]) {
            state.players[player.playerId].disconnected = true;
          }
          // End round early if all still-connected players are done
          if (state) {
            const connected = Object.values(state.players).filter((p) => !p.disconnected);
            if (connected.length > 0 && connected.every((p) => p.finished)) {
              if (state.timer) clearTimeout(state.timer);
              endRound(io, room.roomCode);
            }
          }
        }
      } catch (err) {
        // Don't crash on transient network errors during disconnect
        const e = err as { name?: string; code?: string };
        if (
          e.name === 'MongoNetworkError' ||
          e.name === 'MongoServerSelectionError' ||
          e.code === 'ECONNRESET' ||
          e.code === 'ENOTFOUND'
        ) return;
        console.error('disconnect error:', err);
      }
    });
  });
}
