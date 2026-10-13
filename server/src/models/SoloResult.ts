import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';
import { VARIANTS } from '../shared/types';

// One finished Solo Drill game. Only written when the game ends.
const soloResultSchema = new mongoose.Schema(
  {
    playerId: { type: String, index: true },
    playerName: String,
    variant: { type: String, enum: VARIANTS, default: 'classic' },
    hardMode: { type: Boolean, default: false },
    word: String,
    guesses: [
      {
        _id: false,
        word: String,
        result: { type: [String], default: undefined },
        counts: { type: { correct: Number, present: Number, absent: Number }, default: undefined },
      },
    ],
    solved: Boolean,
    tries: Number,
    durationMs: Number,
  },
  { timestamps: true }
);

soloResultSchema.index({ createdAt: -1 });

export type SoloResultDoc = HydratedDocument<InferSchemaType<typeof soloResultSchema>>;

const SoloResult = mongoose.model('SoloResult', soloResultSchema);
export default SoloResult;
