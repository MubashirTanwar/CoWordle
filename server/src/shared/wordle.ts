import { MAX_GUESSES, WORD_LENGTH } from './types';
import type { Guess, LetterState, Variant, Word500Counts } from './types';

/**
 * Evaluate a guess against the answer.
 * Returns array of 5: 'correct' | 'present' | 'absent'
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(WORD_LENGTH).fill('absent');
  const answerLetters = answer.toUpperCase().split('');
  const guessLetters = guess.toUpperCase().split('');
  const letterCount: Record<string, number> = {};

  // First pass: correct positions
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i] = 'correct';
    } else {
      letterCount[answerLetters[i]] = (letterCount[answerLetters[i]] || 0) + 1;
    }
  }

  // Second pass: present (wrong position)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] !== 'correct' && letterCount[guessLetters[i]] > 0) {
      result[i] = 'present';
      letterCount[guessLetters[i]]--;
    }
  }

  return result;
}

export function toCounts(result: LetterState[]): Word500Counts {
  return {
    correct: result.filter((r) => r === 'correct').length,
    present: result.filter((r) => r === 'present').length,
    absent: result.filter((r) => r === 'absent').length,
  };
}

/** Build the guess payload a player is allowed to see for the given variant. */
export function buildGuess(word: string, answer: string, variant: Variant): Guess & { isCorrect: boolean } {
  const result = evaluateGuess(word, answer);
  const isCorrect = result.every((r) => r === 'correct');
  return variant === 'word500'
    ? { word, counts: toCounts(result), isCorrect }
    : { word, result, isCorrect };
}

/** Hard mode: revealed hints must be reused. Returns an error message or null. */
export function checkHardMode(guess: string, prevGuesses: Guess[]): string | null {
  for (const { word, result } of prevGuesses) {
    if (!result) continue;
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === 'correct' && guess[i] !== word[i]) {
        const ord = ['1st', '2nd', '3rd', '4th', '5th'][i];
        return `${ord} letter must be ${word[i]}`;
      }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === 'present' && !guess.includes(word[i])) {
        return `Guess must contain ${word[i]}`;
      }
    }
  }
  return null;
}

export function calculatePoints(triesUsed: number, timeTaken: number, timeLimit: number, variant: Variant = 'classic'): number {
  const base = 100;
  const timeBonus = Math.floor(Math.max(0, (timeLimit - timeTaken) / timeLimit) * 50);
  // Scaled so a first-try solve is +50 regardless of how many tries the variant allows
  const maxGuesses = MAX_GUESSES[variant];
  const triesBonus = Math.round(((maxGuesses - triesUsed) / (maxGuesses - 1)) * 50);
  return base + timeBonus + triesBonus;
}

export function getTileColor(state: LetterState | null | undefined): string {
  switch (state) {
    case 'correct': return '#538d4e';
    case 'present': return '#b59f3b';
    case 'absent':  return '#3a3a3c';
    default:        return 'transparent';
  }
}

/** Best known state per letter across classic guesses (used for keyboard colouring). */
export function getKeyStates(guesses: Guess[]): Record<string, LetterState> {
  const keyStates: Record<string, LetterState> = {};
  for (const { word, result } of guesses) {
    if (!result) continue;
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const r = result[i];
      if (r === 'correct') keyStates[letter] = 'correct';
      else if (r === 'present' && keyStates[letter] !== 'correct') keyStates[letter] = 'present';
      else if (r === 'absent' && !keyStates[letter]) keyStates[letter] = 'absent';
    }
  }
  return keyStates;
}
