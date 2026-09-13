import { WORDS } from '../data/words';

export { VALID_WORDS_SET } from '../data/words';

export function getRandomWord(): string {
  if (process.env.DEBUG_WORD) return process.env.DEBUG_WORD.toUpperCase();
  return WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
}
