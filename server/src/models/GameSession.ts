import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const guessSchema = new mongoose.Schema(
  {
    word: String,
    result: { type: [String], default: undefined }, // classic: 'correct' | 'present' | 'absent'
    counts: { type: { correct: Number, present: Number, absent: Number }, default: undefined }, // word500
  },
  { _id: false }
);

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

export type GameSessionDoc = HydratedDocument<InferSchemaType<typeof gameSessionSchema>>;

const GameSession = mongoose.model('GameSession', gameSessionSchema);
export default GameSession;
