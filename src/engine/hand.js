import { createShuffledDeck } from './deck.js';
import { evaluateBestHand, compareScores, handCategoryName } from './handEvaluator.js';
import { computeSidePots, splitPot } from './sidePots.js';

// One hand (deal) of Texas Hold'em No Limit, played to completion via
// repeated calls to applyAction(). UI-agnostic: works the same whether the
// action comes from a human click or an AI decision.
//
// `players` must be an array of { id, name, stack } for the players seated
// in this hand, already in fixed table seat order (circular). Eliminated /
// sat-out players should not be included.
export function createHand({ players, dealerIndex, smallBlind, bigBlind, deck }) {
  if (players.length < 2) throw new Error('A hand requires at least 2 players');

  const n = players.length;
  const state = {
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      stack: p.stack,
      holeCards: [],
      folded: false,
      allIn: false,
      contributedTotal: 0,
      contributedStreet: 0,
      isDealer: false,
      isSB: false,
      isBB: false
    })),
    dealerIndex,
    smallBlind,
    bigBlind,
    board: [],
    deck: deck ? deck.slice() : createShuffledDeck(),
    street: 'preflop',
    currentBet: 0,
    minRaiseAmount: bigBlind,
    toActQueue: [],
    canRaiseSet: new Set(),
    history: [],
    complete: false,
    results: null
  };

  state.players[dealerIndex].isDealer = true;

  const sbIndex = n === 2 ? dealerIndex : (dealerIndex + 1) % n;
  const bbIndex = n === 2 ? (dealerIndex + 1) % n : (dealerIndex + 2) % n;
  state.players[sbIndex].isSB = true;
  state.players[bbIndex].isBB = true;

  postBlind(state, sbIndex, smallBlind, 'small-blind');
  postBlind(state, bbIndex, bigBlind, 'big-blind');
  state.currentBet = state.players[bbIndex].contributedStreet;

  // Deal hole cards, two rounds starting left of the dealer.
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < n; i++) {
      const idx = (dealerIndex + 1 + i) % n;
      state.players[idx].holeCards.push(state.deck.shift());
    }
  }

  const firstToActIndex = n === 2 ? sbIndex : (bbIndex + 1) % n;
  buildStreetQueues(state, firstToActIndex);
  maybeCloseBettingForRestOfHand(state);

  return state;
}

function postBlind(state, seatIndex, amount, label) {
  const player = state.players[seatIndex];
  const actual = Math.min(amount, player.stack);
  player.stack -= actual;
  player.contributedStreet += actual;
  player.contributedTotal += actual;
  if (player.stack === 0) player.allIn = true;
  state.history.push({ street: 'preflop', playerId: player.id, type: label, amount: actual });
}

function activePlayers(state) {
  return state.players.filter((p) => !p.folded);
}

function actablePlayers(state) {
  return state.players.filter((p) => !p.folded && !p.allIn);
}

function seatIndexOf(state, playerId) {
  return state.players.findIndex((p) => p.id === playerId);
}

function buildStreetQueues(state, startIndex) {
  const n = state.players.length;
  const queue = [];
  for (let i = 0; i < n; i++) {
    const idx = (startIndex + i) % n;
    const p = state.players[idx];
    if (!p.folded && !p.allIn) queue.push(p.id);
  }
  state.toActQueue = queue;
  state.canRaiseSet = new Set(queue);
}

export function getTotalPot(state) {
  return state.players.reduce((sum, p) => sum + p.contributedTotal, 0);
}

export function getLegalActions(state, playerId) {
  if (state.complete) return null;
  if (state.toActQueue[0] !== playerId) return null;
  const player = state.players.find((p) => p.id === playerId);
  const toCall = state.currentBet - player.contributedStreet;
  const callAmount = Math.max(0, Math.min(toCall, player.stack));
  const canCheck = toCall <= 0;
  const canCall = toCall > 0 && player.stack > 0;
  const canRaise = state.canRaiseSet.has(playerId) && player.stack > callAmount;
  const minRaiseTotal = state.currentBet + state.minRaiseAmount;
  const maxRaiseTotal = player.contributedStreet + player.stack;

  return {
    playerId,
    toCall: callAmount,
    canFold: true,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTotal: Math.min(minRaiseTotal, maxRaiseTotal),
    maxRaiseTotal,
    isOpenBet: state.currentBet === 0
  };
}

export function applyAction(state, playerId, action) {
  if (state.complete) throw new Error('Hand already complete');
  if (state.toActQueue[0] !== playerId) {
    throw new Error(`It is not ${playerId}'s turn to act`);
  }
  const legal = getLegalActions(state, playerId);
  const player = state.players.find((p) => p.id === playerId);
  const street = state.street;

  if (action.type === 'fold') {
    player.folded = true;
    state.toActQueue.shift();
    state.canRaiseSet.delete(playerId);
    state.history.push({ street, playerId, type: 'fold', amount: 0 });
    if (checkFoldWin(state)) return state;
    advanceIfStreetDone(state);
    return state;
  }

  if (action.type === 'check') {
    if (!legal.canCheck) throw new Error('Cannot check, a bet is pending');
    state.toActQueue.shift();
    state.history.push({ street, playerId, type: 'check', amount: 0 });
    advanceIfStreetDone(state);
    return state;
  }

  if (action.type === 'call') {
    const amount = legal.callAmount;
    player.stack -= amount;
    player.contributedStreet += amount;
    player.contributedTotal += amount;
    if (player.stack === 0) player.allIn = true;
    state.toActQueue.shift();
    state.history.push({ street, playerId, type: 'call', amount });
    advanceIfStreetDone(state);
    return state;
  }

  if (action.type === 'raiseTo') {
    if (!legal.canRaise) throw new Error('Raise not allowed for this player right now');
    const amount = action.amount;
    if (amount <= state.currentBet) throw new Error('Raise amount must exceed the current bet');
    if (amount > legal.maxRaiseTotal) throw new Error('Raise amount exceeds player stack');
    const increment = amount - state.currentBet;
    const isAllIn = amount === legal.maxRaiseTotal;
    if (increment < state.minRaiseAmount && !isAllIn) {
      throw new Error('Raise amount is below the minimum raise size');
    }

    const chipsIn = amount - player.contributedStreet;
    player.stack -= chipsIn;
    player.contributedStreet = amount;
    player.contributedTotal += chipsIn;
    if (player.stack === 0) player.allIn = true;

    const isFullRaise = increment >= state.minRaiseAmount;

    state.toActQueue.shift();

    if (isFullRaise) {
      state.currentBet = amount;
      state.minRaiseAmount = increment;
      const idx = seatIndexOf(state, playerId);
      buildStreetQueues(state, (idx + 1) % state.players.length);
      // buildStreetQueues rebuilds canRaiseSet to everyone actable, which is
      // correct: a full raise reopens the action for all other players.
      // It also puts the raiser back in (wrapping around the table), which
      // must not translate into asking them to act again immediately -
      // only once someone else has responded.
      state.toActQueue = state.toActQueue.filter((id) => id !== playerId);
    } else {
      // Short all-in raise: bumps currentBet but does not reopen raising
      // rights for players who already acted this street.
      state.currentBet = amount;
      const idx = seatIndexOf(state, playerId);
      const n = state.players.length;
      const alreadyQueued = new Set(state.toActQueue);
      const additional = [];
      for (let i = 1; i <= n; i++) {
        const p = state.players[(idx + i) % n];
        if (p.id === playerId || p.folded || p.allIn) continue;
        if (!alreadyQueued.has(p.id)) {
          additional.push(p.id);
          state.canRaiseSet.delete(p.id);
        }
      }
      state.toActQueue.push(...additional);
    }

    state.history.push({ street, playerId, type: isFullRaise ? 'raise' : 'raise-allin-short', amount: chipsIn, raiseTo: amount });

    if (checkFoldWin(state)) return state;
    advanceIfStreetDone(state);
    return state;
  }

  throw new Error(`Unknown action type: ${action.type}`);
}

function checkFoldWin(state) {
  const remaining = activePlayers(state);
  if (remaining.length === 1) {
    finishHandNoShowdown(state, remaining[0]);
    return true;
  }
  return false;
}

function advanceIfStreetDone(state) {
  if (state.toActQueue.length > 0) return;
  goToNextStreet(state);
}

function maybeCloseBettingForRestOfHand(state) {
  // If fewer than two players can still act (others are all-in), no more
  // betting is possible; run the board out to showdown.
  while (!state.complete && state.toActQueue.length <= 1) {
    if (activePlayers(state).length === 1) {
      finishHandNoShowdown(state, activePlayers(state)[0]);
      return;
    }
    if (state.street === 'river') {
      goToShowdown(state);
      return;
    }
    dealNextStreetCards(state);
    resetStreetBetting(state);
  }
}

function goToNextStreet(state) {
  if (state.street === 'river') {
    goToShowdown(state);
    return;
  }
  dealNextStreetCards(state);
  resetStreetBetting(state);
  maybeCloseBettingForRestOfHand(state);
}

function dealNextStreetCards(state) {
  if (state.street === 'preflop') {
    state.board.push(state.deck.shift(), state.deck.shift(), state.deck.shift());
    state.street = 'flop';
  } else if (state.street === 'flop') {
    state.board.push(state.deck.shift());
    state.street = 'turn';
  } else if (state.street === 'turn') {
    state.board.push(state.deck.shift());
    state.street = 'river';
  }
}

function resetStreetBetting(state) {
  for (const p of state.players) {
    p.contributedStreet = 0;
  }
  state.currentBet = 0;
  state.minRaiseAmount = state.bigBlind;
  const n = state.players.length;
  const dealerIdx = state.dealerIndex;
  let startIndex = (dealerIdx + 1) % n;
  buildStreetQueues(state, startIndex);
}

function finishHandNoShowdown(state, winner) {
  const contributions = state.players.map((p) => ({
    id: p.id,
    contributed: p.contributedTotal,
    folded: p.folded
  }));
  const pots = computeSidePots(contributions);
  const potResults = [];
  for (const pot of pots) {
    const payouts = splitPot(pot.amount, pot.eligibleIds);
    for (const [id, amount] of Object.entries(payouts)) {
      const p = state.players.find((pl) => pl.id === id);
      p.stack += amount;
    }
    potResults.push({ amount: pot.amount, eligibleIds: pot.eligibleIds, winners: Object.entries(payouts).map(([id, amount]) => ({ id, amount })) });
  }
  state.complete = true;
  state.toActQueue = [];
  state.results = {
    showdown: false,
    pots: potResults,
    winnerId: winner.id
  };
}

function goToShowdown(state) {
  const contributions = state.players.map((p) => ({
    id: p.id,
    contributed: p.contributedTotal,
    folded: p.folded
  }));
  const pots = computeSidePots(contributions);

  const bestHandByPlayer = new Map();
  for (const p of activePlayers(state)) {
    const evalResult = evaluateBestHand([...p.holeCards, ...state.board]);
    bestHandByPlayer.set(p.id, evalResult);
  }

  const n = state.players.length;
  const orderStartingLeftOfButton = [];
  for (let i = 1; i <= n; i++) {
    orderStartingLeftOfButton.push(state.players[(state.dealerIndex + i) % n].id);
  }

  const potResults = [];
  for (const pot of pots) {
    let bestScore = null;
    let winners = [];
    for (const id of pot.eligibleIds) {
      const result = bestHandByPlayer.get(id);
      if (!bestScore || compareScores(result.score, bestScore) > 0) {
        bestScore = result.score;
        winners = [id];
      } else if (compareScores(result.score, bestScore) === 0) {
        winners.push(id);
      }
    }
    const orderedWinners = orderStartingLeftOfButton.filter((id) => winners.includes(id));
    const payouts = splitPot(pot.amount, orderedWinners);
    for (const [id, amount] of Object.entries(payouts)) {
      const p = state.players.find((pl) => pl.id === id);
      p.stack += amount;
    }
    potResults.push({
      amount: pot.amount,
      eligibleIds: pot.eligibleIds,
      winners: Object.entries(payouts).map(([id, amount]) => ({
        id,
        amount,
        category: handCategoryName(bestHandByPlayer.get(id).score),
        cards: bestHandByPlayer.get(id).cards
      }))
    });
  }

  state.complete = true;
  state.street = 'showdown';
  state.toActQueue = [];
  state.results = {
    showdown: true,
    pots: potResults,
    hands: [...bestHandByPlayer.entries()].map(([id, r]) => ({
      id,
      score: r.score,
      category: handCategoryName(r.score),
      cards: r.cards
    }))
  };
}

export function getCurrentActor(state) {
  return state.toActQueue[0] || null;
}
