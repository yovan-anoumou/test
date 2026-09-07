import { createHand } from './hand.js';
import { createShuffledDeck } from './deck.js';

// Orchestrates a full game across many hands: seating, dealer button
// rotation, blind levels/progression, and elimination.
export class Table {
  constructor({ seats, smallBlind, bigBlind, blindIncreaseEveryHands = 0, blindIncreaseFactor = 1.5, rng = Math.random }) {
    // seats: [{ id, name, stack, isHuman, aiLevel, avatar }]
    this.seats = seats.map((s, i) => ({ ...s, seatIndex: i, eliminated: false }));
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.baseSmallBlind = smallBlind;
    this.baseBigBlind = bigBlind;
    this.blindIncreaseEveryHands = blindIncreaseEveryHands;
    this.blindIncreaseFactor = blindIncreaseFactor;
    this.rng = rng;
    this.handNumber = 0;
    this.dealerSeatIndex = 0;
    this.currentHand = null;
    this.handHistory = [];
  }

  activeSeats() {
    return this.seats.filter((s) => !s.eliminated && s.stack > 0);
  }

  isGameOver() {
    return this.activeSeats().length <= 1;
  }

  maybeAdvanceBlinds() {
    if (!this.blindIncreaseEveryHands) return;
    const level = Math.floor(this.handNumber / this.blindIncreaseEveryHands);
    if (level > 0) {
      const factor = Math.pow(this.blindIncreaseFactor, level);
      this.smallBlind = Math.max(1, Math.round((this.baseSmallBlind * factor) / 1) );
      this.bigBlind = Math.max(2, Math.round(this.baseBigBlind * factor));
      // keep SB roughly half of BB, rounded
      this.smallBlind = Math.max(1, Math.round(this.bigBlind / 2));
    }
  }

  startNextHand() {
    if (this.isGameOver()) throw new Error('Game is already over');
    this.handNumber += 1;
    this.maybeAdvanceBlinds();

    const active = this.activeSeats();
    // Advance dealer button to the next active seat (circularly over all
    // seats, active or not, so the rotation stays stable as players bust).
    this.dealerSeatIndex = nextActiveSeatIndex(this.seats, this.dealerSeatIndex);

    const dealerSeat = this.seats[this.dealerSeatIndex];
    const orderedActive = active.slice().sort((a, b) => a.seatIndex - b.seatIndex);
    const dealerIndexInHand = orderedActive.findIndex((s) => s.id === dealerSeat.id);

    const deck = createShuffledDeck(this.rng);
    this.currentHand = createHand({
      players: orderedActive.map((s) => ({ id: s.id, name: s.name, stack: s.stack })),
      dealerIndex: dealerIndexInHand,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      deck
    });
    return this.currentHand;
  }

  // Sync stacks back from a completed hand into the persistent seats, and
  // eliminate anyone at zero chips.
  settleHand() {
    const hand = this.currentHand;
    if (!hand || !hand.complete) throw new Error('No completed hand to settle');
    for (const hp of hand.players) {
      const seat = this.seats.find((s) => s.id === hp.id);
      seat.stack = hp.stack;
      if (seat.stack <= 0) seat.eliminated = true;
    }
    this.handHistory.push(hand);
    this.currentHand = null;
  }
}

function nextActiveSeatIndex(seats, fromIndex) {
  const n = seats.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (!seats[idx].eliminated && seats[idx].stack > 0) return idx;
  }
  return fromIndex;
}
