const mongoose = require('mongoose');

const guessSchema = new mongoose.Schema({
  word: String,
  result: [String], // 'correct' | 'present' | 'absent'
});

const playerResultSchema = new mongoose.Schema({
  playerId: String,
  playerName: String,
  guesses: [guessSchema],
  solved: { type: Boolean, default: false },
  timeTaken: { type: Number, default: null }, // seconds, null = DNF
  points: { type: Number, default: 0 },
});

const roundSchema = new mongoose.Schema({
  roundNumber: Number,
  word: String,
  timeLimit: Number,
  playerResults: [playerResultSchema],
});

const gameSessionSchema = new mongoose.Schema(
  {
    roomCode: String,
    rounds: [roundSchema],
    finalScores: [
      {
        playerId: String,
        playerName: String,
        totalPoints: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameSession', gameSessionSchema);
