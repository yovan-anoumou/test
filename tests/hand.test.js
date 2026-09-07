import { describe, it, expect } from 'vitest';
import { makeCard, createDeck } from '../src/engine/deck.js';
import {
  createHand,
  applyAction,
  getLegalActions,
  getCurrentActor,
  getTotalPot
} from '../src/engine/hand.js';

function players(ids, stack = 1000) {
  return ids.map((id) => ({ id, name: id, stack }));
}

// Builds a deck where the given cards are dealt first (hole cards round
// robin, then flop/turn/river), padded with the rest of a standard deck so
// there's always enough cards to finish a hand.
function fixedDeck(orderedCards) {
  const used = new Set(orderedCards.map((c) => c.id));
  const rest = createDeck().filter((c) => !used.has(c.id));
  return [...orderedCards, ...rest];
}

describe('createHand - table order and blinds', () => {
  it('3 players: SB/BB/UTG posted correctly, UTG acts first preflop', () => {
    const state = createHand({
      players: players(['a', 'b', 'c']),
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    expect(state.players[1].isSB).toBe(true);
    expect(state.players[2].isBB).toBe(true);
    expect(state.players[1].contributedStreet).toBe(5);
    expect(state.players[2].contributedStreet).toBe(10);
    expect(getCurrentActor(state)).toBe('a'); // dealer/UTG acts first in 3-handed preflop
  });

  it('heads-up: dealer posts SB and acts first preflop, last postflop', () => {
    const state = createHand({
      players: players(['a', 'b']),
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    expect(state.players[0].isSB).toBe(true);
    expect(state.players[0].isDealer).toBe(true);
    expect(state.players[1].isBB).toBe(true);
    expect(getCurrentActor(state)).toBe('a');

    applyAction(state, 'a', { type: 'call' });
    applyAction(state, 'b', { type: 'check' });
    expect(state.street).toBe('flop');
    // postflop heads-up: BB (non-dealer) acts first
    expect(getCurrentActor(state)).toBe('b');
  });
});

describe('betting rules', () => {
  it('rejects a raise below the minimum raise size', () => {
    const state = createHand({
      players: players(['a', 'b', 'c']),
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    // currentBet=10, minRaiseAmount=10 -> min raise total = 20
    expect(() => applyAction(state, 'a', { type: 'raiseTo', amount: 15 })).toThrow();
  });

  it('accepts a legal full raise and reopens action for everyone else', () => {
    const state = createHand({
      players: players(['a', 'b', 'c']),
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    applyAction(state, 'a', { type: 'raiseTo', amount: 30 }); // full raise (+20 >= 10)
    expect(state.currentBet).toBe(30);
    expect(state.minRaiseAmount).toBe(20);
    expect(getCurrentActor(state)).toBe('b');
    const legalB = getLegalActions(state, 'b');
    expect(legalB.canRaise).toBe(true);
    expect(legalB.minRaiseTotal).toBe(50);
  });

  it('a short all-in raise does not reopen raising rights for players who already acted', () => {
    const state = createHand({
      players: [
        { id: 'a', name: 'a', stack: 1000 },
        { id: 'b', name: 'b', stack: 1000 },
        { id: 'c', name: 'c', stack: 15 } // will go all-in short
      ],
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    // preflop order 3-handed: a (UTG) acts first, then b, then c is BB (already posted 10)
    applyAction(state, 'a', { type: 'call' }); // calls 10
    applyAction(state, 'b', { type: 'call' }); // calls 10
    // c is BB with only 15 total stack (5 more available after posting 10), goes all-in raising to 15 (+5, less than minRaise 10)
    applyAction(state, 'c', { type: 'raiseTo', amount: 15 });
    expect(state.players.find((p) => p.id === 'c').allIn).toBe(true);
    expect(state.currentBet).toBe(15);
    // a and b already acted, must act again but cannot raise (only call/fold)
    expect(getCurrentActor(state)).toBe('a');
    const legalA = getLegalActions(state, 'a');
    expect(legalA.canRaise).toBe(false);
    expect(legalA.canCall).toBe(true);
    expect(legalA.callAmount).toBe(5);
    applyAction(state, 'a', { type: 'call' });
    const legalB = getLegalActions(state, 'b');
    expect(legalB.canRaise).toBe(false);
    applyAction(state, 'b', { type: 'call' });
    expect(state.street).toBe('flop');
  });

  it('does not ask the sole remaining actable player to act again after their own raise', () => {
    // a and b go all-in early, c is the only player who can still act and
    // raises further: nobody left can respond, so betting must close
    // instead of looping c back to themselves.
    const state = createHand({
      players: [
        { id: 'a', name: 'a', stack: 50 },
        { id: 'b', name: 'b', stack: 50 },
        { id: 'c', name: 'c', stack: 1000 }
      ],
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    applyAction(state, 'a', { type: 'raiseTo', amount: 50 }); // all-in
    applyAction(state, 'b', { type: 'call' }); // also all-in (stack exhausted matching the raise)
    applyAction(state, 'c', { type: 'raiseTo', amount: 200 }); // c is now the only actable player
    expect(state.complete).toBe(true);
    expect(state.results.showdown).toBe(true);
    expect(state.board.length).toBe(5);
    const totalStacks = state.players.reduce((s, p) => s + p.stack, 0);
    expect(totalStacks).toBe(50 + 50 + 1000);
  });

  it('ends the hand immediately when all but one player folds, without revealing cards', () => {
    const state = createHand({
      players: players(['a', 'b', 'c']),
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    applyAction(state, 'a', { type: 'fold' });
    applyAction(state, 'b', { type: 'fold' });
    expect(state.complete).toBe(true);
    expect(state.results.showdown).toBe(false);
    expect(state.results.winnerId).toBe('c');
    const totalStacks = state.players.reduce((s, p) => s + p.stack, 0);
    expect(totalStacks).toBe(3000); // no chips lost
  });

  it('runs the board out automatically once all remaining players are all-in', () => {
    const state = createHand({
      players: [
        { id: 'a', name: 'a', stack: 50 },
        { id: 'b', name: 'b', stack: 50 },
        { id: 'c', name: 'c', stack: 50 }
      ],
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    applyAction(state, 'a', { type: 'raiseTo', amount: 50 }); // all-in
    applyAction(state, 'b', { type: 'call' }); // also all-in (stack exhausted)
    applyAction(state, 'c', { type: 'call' }); // also all-in
    expect(state.complete).toBe(true);
    expect(state.results.showdown).toBe(true);
    expect(state.board.length).toBe(5);
  });

  it('runs the remaining streets automatically once only one player can still act', () => {
    const state = createHand({
      players: [
        { id: 'a', name: 'a', stack: 50 },
        { id: 'b', name: 'b', stack: 50 },
        { id: 'c', name: 'c', stack: 1000 }
      ],
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    applyAction(state, 'a', { type: 'raiseTo', amount: 50 }); // all-in
    applyAction(state, 'b', { type: 'call' }); // also all-in
    applyAction(state, 'c', { type: 'call' }); // c has chips left but nobody left to bet against
    expect(state.complete).toBe(true);
    expect(state.results.showdown).toBe(true);
    expect(state.board.length).toBe(5);
  });
});

describe('showdown payouts', () => {
  it('awards the correct side pots to the correct winners', () => {
    // a all-in for 50 with a strong hand, b and c go further with weaker hands
    const a1 = makeCard(14, 's');
    const a2 = makeCard(14, 'h'); // AA -> trips with the ace on board
    const b1 = makeCard(2, 'd');
    const b2 = makeCard(3, 'd');
    const c1 = makeCard(7, 'c');
    const c2 = makeCard(8, 'c');
    const board = [makeCard(14, 'd'), makeCard(9, 'h'), makeCard(2, 's'), makeCard(5, 'h'), makeCard(13, 'd')];
    // hole cards are dealt round-robin starting left of the dealer (seat
    // index dealerIndex+1): with dealerIndex=0 (a) that's b, c, a, b, c, a.
    const deck = fixedDeck([b1, c1, a1, b2, c2, a2, ...board]);

    const state = createHand({
      players: [
        { id: 'a', name: 'a', stack: 50 },
        { id: 'b', name: 'b', stack: 1000 },
        { id: 'c', name: 'c', stack: 1000 }
      ],
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck
    });

    applyAction(state, 'a', { type: 'raiseTo', amount: 50 }); // all-in for 50
    applyAction(state, 'b', { type: 'call' });
    applyAction(state, 'c', { type: 'call' });
    // a is all-in and out of actions; b and c still have chips and keep
    // checking it down through flop, turn and river.
    expect(state.street).toBe('flop');
    applyAction(state, 'b', { type: 'check' });
    applyAction(state, 'c', { type: 'check' });
    expect(state.street).toBe('turn');
    applyAction(state, 'b', { type: 'check' });
    applyAction(state, 'c', { type: 'check' });
    expect(state.street).toBe('river');
    applyAction(state, 'b', { type: 'check' });
    applyAction(state, 'c', { type: 'check' });

    expect(state.complete).toBe(true);
    expect(state.results.showdown).toBe(true);
    // a wins the (only) pot with trip aces (AA + A on board = trips), main pot = 150
    const pot = state.results.pots[0];
    expect(pot.amount).toBe(150);
    expect(pot.winners.map((w) => w.id)).toEqual(['a']);
    expect(pot.winners[0].amount).toBe(150);

    const totalStacks = state.players.reduce((s, p) => s + p.stack, 0);
    expect(totalStacks).toBe(50 + 1000 + 1000);
  });
});

describe('pot accounting', () => {
  it('getTotalPot reflects all contributions at any point in the hand', () => {
    const state = createHand({
      players: players(['a', 'b', 'c']),
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: fixedDeck([])
    });
    expect(getTotalPot(state)).toBe(15); // blinds only
    applyAction(state, 'a', { type: 'call' });
    expect(getTotalPot(state)).toBe(25);
  });
});
