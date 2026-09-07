import { createDeck } from '../engine/deck.js';
import { evaluateBestHand, compareScores } from '../engine/handEvaluator.js';

function sampleWithoutReplacement(arr, k, rng) {
  const a = arr.slice();
  const n = a.length;
  const limit = Math.min(k, n);
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng() * (n - i));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.slice(0, limit);
}

// Monte Carlo equity estimation: what fraction of the pot my hand expects
// to win against `numOpponents` random hands, given the current board.
// This is the real calculation every AI decision and every coach
// recommendation is built on (no hardcoded "if pair then call" rules).
export function estimateEquity({ holeCards, board = [], numOpponents, iterations = 600, rng = Math.random, deadCards = [] }) {
  if (numOpponents <= 0) return 1;
  const usedIds = new Set([...holeCards, ...board, ...deadCards].map((c) => c.id));
  const remainingDeck = createDeck().filter((c) => !usedIds.has(c.id));
  const missingBoard = 5 - board.length;
  const cardsNeededPerIteration = missingBoard + numOpponents * 2;

  if (remainingDeck.length < cardsNeededPerIteration) {
    iterations = Math.max(50, Math.floor(iterations / 4));
  }

  let equitySum = 0;

  for (let i = 0; i < iterations; i++) {
    const sample = sampleWithoutReplacement(remainingDeck, cardsNeededPerIteration, rng);
    const fullBoard = [...board, ...sample.slice(0, missingBoard)];

    const myScore = evaluateBestHand([...holeCards, ...fullBoard]).score;
    let bestScore = myScore;
    let winners = 1; // start assuming I'm the unique best; adjusted below

    const allScores = [myScore];
    for (let o = 0; o < numOpponents; o++) {
      const h1 = sample[missingBoard + o * 2];
      const h2 = sample[missingBoard + o * 2 + 1];
      const oppScore = evaluateBestHand([h1, h2, ...fullBoard]).score;
      allScores.push(oppScore);
    }

    bestScore = allScores.reduce((best, s) => (compareScores(s, best) > 0 ? s : best), allScores[0]);
    winners = allScores.filter((s) => compareScores(s, bestScore) === 0).length;
    const iAmWinner = compareScores(myScore, bestScore) === 0;

    if (iAmWinner) equitySum += 1 / winners;
  }

  return equitySum / iterations;
}

// How much equity is required to profitably call a bet of `toCall` into a
// pot of `potBeforeCall` (not counting the call itself).
export function requiredEquityToCall(toCall, potBeforeCall) {
  if (toCall <= 0) return 0;
  return toCall / (potBeforeCall + toCall);
}
