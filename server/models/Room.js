const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  socketId: String,
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  isConnected: { type: Boolean, default: true },
});

const roomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, unique: true },
    hostId: { type: String, required: true },
    players: [playerSchema],
    settings: {
      timeLimit: { type: Number, default: 120 },
      rounds: { type: Number, default: 3 },
      hardMode: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['lobby', 'playing', 'round-end', 'finished'],
      default: 'lobby',
    },
    currentRound: { type: Number, default: 0 },
    gameSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
