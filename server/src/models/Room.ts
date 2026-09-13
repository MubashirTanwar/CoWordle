import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { VARIANTS } from '../shared/types';

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
      variant: { type: String, enum: VARIANTS, default: 'classic' },
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

export type RoomDoc = HydratedDocument<InferSchemaType<typeof roomSchema>>;

const Room = mongoose.model('Room', roomSchema);
export default Room;
