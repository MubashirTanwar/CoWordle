import type { Guess, LetterState } from '@shared/types';

/** A guess on the board — `pending` while waiting for the server to evaluate it. */
export interface BoardGuess extends Guess {
  pending?: boolean;
}

/** Word500 letter marks the player sets by tapping tiles. */
export type LetterMarks = Record<string, LetterState>;

const MARK_CYCLE: (LetterState | undefined)[] = [undefined, 'absent', 'present', 'correct'];

export function cycleMark(marks: LetterMarks, letter: string): LetterMarks {
  const next = MARK_CYCLE[(MARK_CYCLE.indexOf(marks[letter]) + 1) % MARK_CYCLE.length];
  const { [letter]: _, ...rest } = marks;
  return next ? { ...rest, [letter]: next } : rest;
}
