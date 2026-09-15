import type { Guess, LetterState } from '@shared/types';

/** A guess on the board — `pending` while waiting for the server to evaluate it. */
export interface BoardGuess extends Guess {
  pending?: boolean;
}

/** Word500 marks the player sets by tapping tiles, keyed by tile (`row:col`). */
export type TileMarks = Record<string, LetterState>;

export const tileKey = (row: number, col: number) => `${row}:${col}`;

const MARK_CYCLE: (LetterState | undefined)[] = [undefined, 'absent', 'present', 'correct'];

export function cycleMark(marks: TileMarks, key: string): TileMarks {
  const next = MARK_CYCLE[(MARK_CYCLE.indexOf(marks[key]) + 1) % MARK_CYCLE.length];
  const { [key]: _, ...rest } = marks;
  return next ? { ...rest, [key]: next } : rest;
}

const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

/** Keyboard colour per letter: the strongest mark on any tile with that letter. */
export function marksToKeyStates(guesses: Guess[], marks: TileMarks): Record<string, LetterState> {
  const keyStates: Record<string, LetterState> = {};
  guesses.forEach(({ word }, row) => {
    word.split('').forEach((letter, col) => {
      const mark = marks[tileKey(row, col)];
      if (mark && (!keyStates[letter] || RANK[mark] > RANK[keyStates[letter]])) keyStates[letter] = mark;
    });
  });
  return keyStates;
}
