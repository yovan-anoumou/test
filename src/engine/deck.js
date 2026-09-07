export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const SUITS = ['s', 'h', 'd', 'c'];

export const RANK_LABEL = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

export function cardId(rank, suit) {
  return `${rank}${suit}`;
}

export function makeCard(rank, suit) {
  return { rank, suit, id: cardId(rank, suit) };
}

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(rank, suit));
    }
  }
  return deck;
}

// Fisher-Yates shuffle. Accepts an injectable RNG for deterministic tests.
export function shuffle(deck, rng = Math.random) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createShuffledDeck(rng = Math.random) {
  return shuffle(createDeck(), rng);
}

export function cardLabel(card) {
  return `${RANK_LABEL[card.rank]}${card.suit}`;
}

// Remove specific cards (by id) from a deck - useful when the AI needs to
// simulate against "unseen" cards only.
export function removeCards(deck, cardsToRemove) {
  const ids = new Set(cardsToRemove.map((c) => c.id));
  return deck.filter((c) => !ids.has(c.id));
}
