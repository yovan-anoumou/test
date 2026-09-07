// Standard 5-of-7 Texas Hold'em hand evaluator.
// A hand's strength is represented as a comparable array:
// [category, tiebreak1, tiebreak2, ...] where higher category wins,
// and ties within a category are broken by comparing tiebreak values
// left-to-right (both descending order).
//
// Categories (higher is better):
// 8 straight flush, 7 four of a kind, 6 full house, 5 flush,
// 4 straight, 3 three of a kind, 2 two pair, 1 one pair, 0 high card

export const HAND_CATEGORY_NAMES = [
  'Carte haute',
  'Paire',
  'Double paire',
  'Brelan',
  'Quinte',
  'Couleur',
  'Full',
  'Carre',
  'Quinte flush'
];

function combinations(arr, k) {
  const results = [];
  const combo = [];
  function recurse(start) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      recurse(i + 1);
      combo.pop();
    }
  }
  recurse(0);
  return results;
}

function countBy(cards, key) {
  const map = new Map();
  for (const c of cards) {
    map.set(c[key], (map.get(c[key]) || 0) + 1);
  }
  return map;
}

// Evaluate exactly 5 cards. Returns a comparable score array.
export function evaluate5(cards) {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const rankCounts = countBy(cards, 'rank');
  const suitCounts = countBy(cards, 'suit');

  const isFlush = [...suitCounts.values()].some((n) => n === 5);

  // Straight detection, handling wheel (A-2-3-4-5).
  const uniqueRanksDesc = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueRanksDesc.length >= 5) {
    // Wheel check: A,5,4,3,2
    const hasWheel = [14, 5, 4, 3, 2].every((r) => uniqueRanksDesc.includes(r));
    for (let i = 0; i <= uniqueRanksDesc.length - 5; i++) {
      const window = uniqueRanksDesc.slice(i, i + 5);
      if (window[0] - window[4] === 4) {
        straightHigh = window[0];
        break;
      }
    }
    if (straightHigh === null && hasWheel) {
      straightHigh = 5; // wheel plays as a 5-high straight
    }
  }

  if (straightHigh !== null && isFlush) {
    // Must confirm the straight is made of same-suit cards for a straight flush.
    for (const [suit, count] of suitCounts) {
      if (count >= 5) {
        const suited = cards.filter((c) => c.suit === suit);
        const suitedUnique = [...new Set(suited.map((c) => c.rank))].sort((a, b) => b - a);
        const hasWheelSuited = [14, 5, 4, 3, 2].every((r) => suitedUnique.includes(r));
        let sfHigh = null;
        for (let i = 0; i <= suitedUnique.length - 5; i++) {
          const window = suitedUnique.slice(i, i + 5);
          if (window[0] - window[4] === 4) {
            sfHigh = window[0];
            break;
          }
        }
        if (sfHigh === null && hasWheelSuited) sfHigh = 5;
        if (sfHigh !== null) {
          return [8, sfHigh];
        }
      }
    }
  }

  const groups = [...rankCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
    return b[0] - a[0]; // then by rank desc
  });

  if (groups[0][1] === 4) {
    const quadRank = groups[0][0];
    const kicker = Math.max(...ranks.filter((r) => r !== quadRank));
    return [7, quadRank, kicker];
  }

  if (groups[0][1] === 3 && groups[1] && groups[1][1] >= 2) {
    return [6, groups[0][0], groups[1][0]];
  }

  if (isFlush) {
    return [5, ...ranks.slice(0, 5)];
  }

  if (straightHigh !== null) {
    return [4, straightHigh];
  }

  if (groups[0][1] === 3) {
    const kickers = ranks.filter((r) => r !== groups[0][0]).slice(0, 2);
    return [3, groups[0][0], ...kickers];
  }

  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) {
    const pairRanks = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = Math.max(...ranks.filter((r) => r !== pairRanks[0] && r !== pairRanks[1]));
    return [2, pairRanks[0], pairRanks[1], kicker];
  }

  if (groups[0][1] === 2) {
    const kickers = ranks.filter((r) => r !== groups[0][0]).slice(0, 3);
    return [1, groups[0][0], ...kickers];
  }

  return [0, ...ranks.slice(0, 5)];
}

export function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Evaluate the best 5-card hand out of 5, 6 or 7 cards.
export function evaluateBestHand(cards) {
  if (cards.length < 5) throw new Error('At least 5 cards are required to evaluate a hand');
  if (cards.length === 5) {
    return { score: evaluate5(cards), cards };
  }
  const combos = combinations(cards, 5);
  let best = null;
  for (const combo of combos) {
    const score = evaluate5(combo);
    if (!best || compareScores(score, best.score) > 0) {
      best = { score, cards: combo };
    }
  }
  return best;
}

export function handCategoryName(score) {
  return HAND_CATEGORY_NAMES[score[0]];
}

// Compare two players' best hands. Returns >0 if a wins, <0 if b wins, 0 tie.
export function compareHands(cardsA, cardsB) {
  const a = evaluateBestHand(cardsA);
  const b = evaluateBestHand(cardsB);
  return compareScores(a.score, b.score);
}
