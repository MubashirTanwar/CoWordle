import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { fail, ok } from '../lib/response';
import { getRandomWord, VALID_WORDS_SET } from '../lib/words';
import { buildGuess, checkHardMode } from '../shared/wordle';
import { MAX_GUESSES, VARIANTS } from '../shared/types';
import type { Guess, Variant } from '../shared/types';
import type { SoloGame, SoloGuessResponse } from '../shared/api';

// ─── In-memory solo games ─────────────────────────────────────────────────────
// Solo drills are throwaway practice, so they live in memory only. A server
// restart drops them and the client simply starts a fresh word.

interface SoloState {
  word: string;
  variant: Variant;
  hardMode: boolean;
  guesses: Guess[];
  finished: boolean;
  touchedAt: number;
}

const SOLO_TTL_MS = 2 * 60 * 60 * 1000;
const games = new Map<string, SoloState>();

setInterval(() => {
  const cutoff = Date.now() - SOLO_TTL_MS;
  for (const [id, game] of games) if (game.touchedAt < cutoff) games.delete(id);
}, 10 * 60 * 1000).unref();

const NewGameSchema = z.object({
  variant: z.enum(VARIANTS).default('classic'),
  hardMode: z.boolean().default(false),
});
const GuessSchema = z.object({ guess: z.string().trim() });

const router = Router();

router.post('/', (req, res) => {
  const parsed = NewGameSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, 'BAD_REQUEST', 'Invalid game options');

  const { variant } = parsed.data;
  const hardMode = variant === 'classic' && parsed.data.hardMode;
  const gameId = randomUUID();
  games.set(gameId, { word: getRandomWord(), variant, hardMode, guesses: [], finished: false, touchedAt: Date.now() });

  return ok<SoloGame>(res, { gameId, variant, hardMode, maxGuesses: MAX_GUESSES[variant] }, 201);
});

router.post('/:gameId/guess', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return fail(res, 404, 'GAME_NOT_FOUND', 'This game expired — starting a new word');
  if (game.finished) return fail(res, 409, 'GAME_FINISHED', 'This game is already over');

  const parsed = GuessSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, 'BAD_REQUEST', 'Invalid guess');

  const guess = parsed.data.guess.toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) return fail(res, 422, 'INVALID_GUESS', 'Guess must be 5 letters');
  if (!VALID_WORDS_SET.has(guess)) return fail(res, 422, 'NOT_IN_WORD_LIST', 'Not in word list');
  if (game.hardMode) {
    const err = checkHardMode(guess, game.guesses);
    if (err) return fail(res, 422, 'HARD_MODE', err);
  }

  const { isCorrect, ...evaluated } = buildGuess(guess, game.word, game.variant);
  game.guesses.push(evaluated);
  game.touchedAt = Date.now();
  game.finished = isCorrect || game.guesses.length >= MAX_GUESSES[game.variant];

  return ok<SoloGuessResponse>(res, {
    guess: evaluated,
    isCorrect,
    finished: game.finished,
    tries: game.guesses.length,
    ...(game.finished ? { answer: game.word } : {}),
  });
});

export default router;
