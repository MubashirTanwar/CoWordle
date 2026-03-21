/**
 * Evaluate a guess against the answer.
 * Returns array of 5: 'correct' | 'present' | 'absent'
 */
export function evaluateGuess(guess, answer) {
  const result = Array(5).fill('absent');
  const answerLetters = answer.toUpperCase().split('');
  const guessLetters = guess.toUpperCase().split('');
  const letterCount = {};

  // First pass: correct positions
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i] = 'correct';
    } else {
      letterCount[answerLetters[i]] = (letterCount[answerLetters[i]] || 0) + 1;
    }
  }

  // Second pass: present (wrong position)
  for (let i = 0; i < 5; i++) {
    if (result[i] !== 'correct' && letterCount[guessLetters[i]] > 0) {
      result[i] = 'present';
      letterCount[guessLetters[i]]--;
    }
  }

  return result;
}

export function getTileColor(state) {
  switch (state) {
    case 'correct': return '#538d4e';
    case 'present': return '#b59f3b';
    case 'absent':  return '#3a3a3c';
    default:        return 'transparent';
  }
}

export function getKeyColor(letter, guesses) {
  let best = null;
  for (const { word, result } of guesses) {
    for (let i = 0; i < word.length; i++) {
      if (word[i] === letter) {
        if (result[i] === 'correct') return 'correct';
        if (result[i] === 'present' && best !== 'correct') best = 'present';
        if (result[i] === 'absent' && !best) best = 'absent';
      }
    }
  }
  return best;
}
