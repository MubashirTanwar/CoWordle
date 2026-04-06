const Room = require('../models/Room');
const GameSession = require('../models/GameSession');
const { WORDS, VALID_WORDS_SET } = require('../data/words');

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getRandomWord() {
  if (process.env.DEBUG_WORD) return process.env.DEBUG_WORD.toUpperCase();
  return WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
}

function evaluateGuess(guess, answer) {
  const result = Array(5).fill('absent');
  const answerLetters = answer.split('');
  const guessLetters = guess.split('');
  const letterCount = {};

  // First pass: mark correct
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i] = 'correct';
    } else {
      letterCount[answerLetters[i]] = (letterCount[answerLetters[i]] || 0) + 1;
    }
  }

  // Second pass: mark present
  for (let i = 0; i < 5; i++) {
    if (result[i] !== 'correct' && letterCount[guessLetters[i]] > 0) {
      result[i] = 'present';
      letterCount[guessLetters[i]]--;
    }
  }

  return result;
}

function calculatePoints(triesUsed, timeTaken, timeLimit) {
  const base = 100;
  const timeBonus = Math.floor(Math.max(0, (timeLimit - timeTaken) / timeLimit) * 50);
  const triesBonus = (6 - triesUsed) * 10;
  return base + timeBonus + triesBonus;
}

// ─── In-memory game state ─────────────────────────────────────────────────────
// gameState[roomCode] = {
//   word, roundNumber, roundStartTime (ms), timeLimit (s),
//   players: { [playerId]: { guesses:[], finished, solved, timeTaken, points } },
//   timer: timeoutRef
// }
const gameState = {};

// ─── In-memory chat messages ──────────────────────────────────────────────────
// chatMessages[roomCode] = [{ playerName, text, timestamp }]  (capped at 100)
const chatMessages = {};

// ─── Round lifecycle ──────────────────────────────────────────────────────────

async function startRound(io, roomCode, roundNumber) {
  const room = await Room.findOne({ roomCode });
  const word = getRandomWord();
  const timeLimit = room.settings.timeLimit;

  // Init in-memory state
  const playerMap = {};
  room.players.filter((p) => p.isConnected).forEach((p) => {
    playerMap[p.playerId] = { guesses: [], finished: false, solved: false, timeTaken: null, points: 0 };
  });

  if (gameState[roomCode]) clearTimeout(gameState[roomCode].timer);
  gameState[roomCode] = {
    word,
    roundNumber,
    roundStartTime: Date.now(),
    timeLimit,
    players: playerMap,
    timer: null,
  };

  // Persist round stub to DB
  const session = await GameSession.findById(room.gameSessionId);
  session.rounds.push({ roundNumber, word, timeLimit, playerResults: [] });
  await session.save();

  // Notify clients (do NOT send word)
  io.to(roomCode).emit('game-started', {
    roundNumber,
    totalRounds: room.settings.rounds,
    timeLimit,
  });

  // Start timer
  gameState[roomCode].timer = setTimeout(() => endRound(io, roomCode), timeLimit * 1000);
}

async function endRound(io, roomCode) {
  const state = gameState[roomCode];
  if (!state) return;

  clearTimeout(state.timer);
  state.timer = null;

  const room = await Room.findOne({ roomCode });
  if (!room || room.status === 'finished') return;

  const session = await GameSession.findById(room.gameSessionId);
  const roundDoc = session.rounds.find((r) => r.roundNumber === state.roundNumber);

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

  const isLastRound = state.roundNumber >= room.settings.rounds;
  room.status = 'round-end';
  await room.save();

  io.to(roomCode).emit('round-ended', {
    roundNumber: state.roundNumber,
    word: state.word,
    results: roundDoc.playerResults,
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

async function updateRoomStatus(roomCode, status) {
  await Room.updateOne({ roomCode }, { status });
}

async function endGame(io, roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const session = await GameSession.findById(room.gameSessionId);
  const scoreMap = {};

  room.players.forEach((p) => {
    scoreMap[p.playerId] = { playerId: p.playerId, playerName: p.playerName, totalPoints: 0 };
  });

  for (const round of session.rounds) {
    for (const result of round.playerResults) {
      if (scoreMap[result.playerId]) {
        scoreMap[result.playerId].totalPoints += result.points;
      }
    }
  }

  const finalScores = Object.values(scoreMap).sort((a, b) => b.totalPoints - a.totalPoints);
  session.finalScores = finalScores;
  await session.save();

  room.status = 'finished';
  await room.save();

  io.to(roomCode).emit('game-ended', {
    finalScores,
    rounds: session.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      word: r.word,
      results: r.playerResults,
    })),
  });

  delete gameState[roomCode];
  delete chatMessages[roomCode];
}

// ─── Main socket handler ──────────────────────────────────────────────────────

module.exports = function setupGameHandler(io) {
  io.on('connection', (socket) => {
    // ── Sync State (reconnect / refresh) ──
    socket.on('request-sync', async ({ roomCode, playerId }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

        // Re-attach socket
        const player = room.players.find((p) => p.playerId === playerId);
        if (player) {
          player.socketId = socket.id;
          player.isConnected = true;
          await room.save();
          socket.join(roomCode);
          // Notify others this player is back
          socket.to(roomCode).emit('player-joined', {
            players: room.toObject().players,
            playerName: player.playerName,
          });
        }

        // If room thinks it's playing but in-memory state is gone (server restart), reset to lobby
        if (room.status === 'playing' && !gameState[roomCode]) {
          room.status = 'lobby';
          await room.save();
        }

        const syncPayload = { room: room.toObject(), phase: room.status };

        if (room.status === 'playing' && gameState[roomCode]) {
          const state = gameState[roomCode];
          const elapsed = Math.floor((Date.now() - state.roundStartTime) / 1000);
          syncPayload.roundInfo = {
            roundNumber: state.roundNumber,
            totalRounds: room.settings.rounds,
            timeLimit: state.timeLimit,
            elapsed,
          };
          // Restore player (re-connect): clear disconnected flag, preserve existing guesses
          if (!state.players[playerId]) {
            state.players[playerId] = { guesses: [], finished: false, solved: false, timeTaken: null, points: 0 };
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
              finalScores: session.finalScores,
              rounds: session.rounds.map((r) => ({
                roundNumber: r.roundNumber,
                word: r.word,
                results: r.playerResults,
              })),
            };
          }
        }

        syncPayload.messages = chatMessages[roomCode] || [];
        socket.emit('sync-state', syncPayload);
      } catch (err) {
        console.error('request-sync error:', err);
        socket.emit('error', { message: 'Failed to sync state' });
      }
    });

    // ── Create Room ──
    socket.on('create-room', async ({ playerName, playerId, settings }) => {
      try {
        let roomCode;
        for (let i = 0; i < 10; i++) {
          const code = generateRoomCode();
          const exists = await Room.findOne({ roomCode: code });
          if (!exists) { roomCode = code; break; }
        }
        if (!roomCode) { socket.emit('error', { message: 'Failed to generate room code' }); return; }

        const room = new Room({
          roomCode,
          hostId: playerId,
          players: [{ socketId: socket.id, playerId, playerName, isHost: true, isConnected: true }],
          settings: { timeLimit: settings?.timeLimit || 120, rounds: settings?.rounds || 3 },
        });
        await room.save();

        socket.join(roomCode);
        socket.emit('room-created', { roomCode, room: room.toObject() });
      } catch (err) {
        console.error('create-room error:', err);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // ── Join Room ──
    socket.on('join-room', async ({ roomCode, playerName, playerId }) => {
      try {
        const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        // Allow reconnect if the player was already in the room; block new players during a game
        const wasInRoom = room.players.find((p) => p.playerId === playerId);
        if (room.status !== 'lobby' && !wasInRoom) {
          socket.emit('error', { message: 'Game already in progress' }); return;
        }

        const existing = room.players.find((p) => p.playerId === playerId);
        if (existing) {
          existing.socketId = socket.id;
          existing.isConnected = true;
        } else {
          room.players.push({ socketId: socket.id, playerId, playerName, isHost: false, isConnected: true });
        }
        await room.save();

        socket.join(roomCode.toUpperCase());
        socket.emit('room-joined', { room: room.toObject() });
        socket.to(roomCode.toUpperCase()).emit('player-joined', {
          players: room.toObject().players,
          playerName,
        });
      } catch (err) {
        console.error('join-room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── Update Settings ──
    socket.on('update-settings', async ({ roomCode, playerId, settings }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room || room.hostId !== playerId) return;
        room.settings = settings;
        await room.save();
        io.to(roomCode).emit('settings-updated', { settings });
      } catch (err) {
        console.error('update-settings error:', err);
      }
    });

    // ── Start Game ──
    socket.on('start-game', async ({ roomCode, playerId }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
        if (room.hostId !== playerId) { socket.emit('error', { message: 'Only host can start' }); return; }
        if (room.status !== 'lobby') { socket.emit('error', { message: 'Game already started' }); return; }

        const session = new GameSession({ roomCode, rounds: [], finalScores: [] });
        await session.save();

        room.gameSessionId = session._id;
        room.currentRound = 1;
        room.status = 'playing';
        await room.save();

        await startRound(io, roomCode, 1);
      } catch (err) {
        console.error('start-game error:', err);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    // ── Submit Guess ──
    socket.on('submit-guess', async ({ roomCode, playerId, guess }) => {
      try {
        const state = gameState[roomCode];
        if (!state) { socket.emit('error', { message: 'No active game' }); return; }

        // Re-add player if they reconnected mid-game and aren't in state yet
        if (!state.players[playerId]) {
          state.players[playerId] = { guesses: [], finished: false, solved: false, timeTaken: null, points: 0 };
        }
        const playerState = state.players[playerId];
        if (playerState.finished) return;

        const guessUpper = guess.toUpperCase();
        if (guessUpper.length !== 5) { socket.emit('error', { message: 'Guess must be 5 letters' }); return; }
        if (!VALID_WORDS_SET.has(guessUpper)) {
          socket.emit('invalid-word', { guess: guessUpper });
          return;
        }

        const result = evaluateGuess(guessUpper, state.word);
        const isCorrect = result.every((r) => r === 'correct');

        playerState.guesses.push({ word: guessUpper, result });

        socket.emit('guess-result', { guess: guessUpper, result, isCorrect });

        // Broadcast latest guess colors + try count to all OTHER players (no word revealed)
        socket.to(roomCode).emit('player-guessed', {
          playerId,
          result,
          tryNumber: playerState.guesses.length,
        });

        if (isCorrect || playerState.guesses.length >= 6) {
          playerState.finished = true;
          playerState.solved = isCorrect;

          if (isCorrect) {
            const timeTaken = Math.floor((Date.now() - state.roundStartTime) / 1000);
            playerState.timeTaken = timeTaken;
            playerState.points = calculatePoints(playerState.guesses.length, timeTaken, state.timeLimit);
          }

          const room = await Room.findOne({ roomCode });
          const player = room.players.find((p) => p.playerId === playerId);

          io.to(roomCode).emit('player-finished', {
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
            clearTimeout(state.timer);
            endRound(io, roomCode);
          }
        }
      } catch (err) {
        console.error('submit-guess error:', err);
        socket.emit('error', { message: 'Failed to process guess' });
      }
    });

    // ── Play Again ──
    socket.on('play-again', async ({ roomCode, playerId, settings }) => {
      try {
        const oldRoom = await Room.findOne({ roomCode });
        if (!oldRoom) { socket.emit('error', { message: 'Room not found' }); return; }

        // Generate new room code
        let newCode;
        for (let i = 0; i < 10; i++) {
          const code = generateRoomCode();
          const exists = await Room.findOne({ roomCode: code });
          if (!exists) { newCode = code; break; }
        }
        if (!newCode) { socket.emit('error', { message: 'Failed to generate room code' }); return; }

        // New room: requesting player becomes host, keep same settings
        const newSettings = settings || oldRoom.settings;
        const requestingPlayer = oldRoom.players.find((p) => p.playerId === playerId);
        const newRoom = new Room({
          roomCode: newCode,
          hostId: playerId,
          players: [{ socketId: socket.id, playerId, playerName: requestingPlayer?.playerName || 'Player', isHost: true, isConnected: true }],
          settings: { timeLimit: newSettings.timeLimit, rounds: newSettings.rounds },
        });
        await newRoom.save();

        // Broadcast redirect to everyone in the old room then send the initiator room-created
        socket.to(roomCode).emit('play-again-redirect', { roomCode: newCode });
        socket.join(newCode);
        socket.emit('play-again-redirect', { roomCode: newCode });
      } catch (err) {
        console.error('play-again error:', err);
        socket.emit('error', { message: 'Failed to create new room' });
      }
    });

    // ── Chat Message ──
    socket.on('send-message', ({ roomCode, playerName, text }) => {
      if (!roomCode || !playerName || !text?.trim()) return;
      const msg = { playerName, text: text.trim().slice(0, 200), timestamp: Date.now() };
      if (!chatMessages[roomCode]) chatMessages[roomCode] = [];
      chatMessages[roomCode].push(msg);
      if (chatMessages[roomCode].length > 100) chatMessages[roomCode].shift();
      io.to(roomCode).emit('message-received', msg);
    });

    // ── Emoji Reaction ──
    socket.on('send-emoji', ({ roomCode, playerName, emoji }) => {
      socket.to(roomCode).emit('emoji-reaction', { playerName, emoji });
    });

    // ── Disconnect ──
    socket.on('disconnect', async () => {
      try {
        const rooms = await Room.find({ 'players.socketId': socket.id, status: { $ne: 'finished' } });
        for (const room of rooms) {
          const player = room.players.find((p) => p.socketId === socket.id);
          if (!player) continue;
          player.isConnected = false;
          await room.save();

          io.to(room.roomCode).emit('player-left', {
            players: room.toObject().players,
            playerName: player.playerName,
          });

          // Mark as disconnected but keep guesses so they're restored on reconnect
          if (gameState[room.roomCode]?.players[player.playerId]) {
            gameState[room.roomCode].players[player.playerId].disconnected = true;
          }
          // End round early if all still-connected players are done
          if (gameState[room.roomCode]) {
            const connected = Object.values(gameState[room.roomCode].players).filter((p) => !p.disconnected);
            if (connected.length > 0 && connected.every((p) => p.finished)) {
              clearTimeout(gameState[room.roomCode].timer);
              endRound(io, room.roomCode);
            }
          }
        }
      } catch (err) {
        // Don't crash on transient network errors during disconnect
        if (
          err.name === 'MongoNetworkError' ||
          err.name === 'MongoServerSelectionError' ||
          err.code === 'ECONNRESET' ||
          err.code === 'ENOTFOUND'
        ) return;
        console.error('disconnect error:', err);
      }
    });
  });
};
