import { getLegalActions, getTotalPot } from '../engine/hand.js';
import { decideAction } from './decision.js';

// Bridges the poker engine (hand.js) with the AI decision logic
// (decision.js): reads the current legal actions and situation off the
// hand state, asks the AI brain for a decision, and turns that decision
// back into an engine-shaped action ({ type, amount? }).
export function computeAIAction(handState, playerId, { level, personality, rng = Math.random } = {}) {
  const legal = getLegalActions(handState, playerId);
  if (!legal) return null;

  const player = handState.players.find((p) => p.id === playerId);
  const numOpponents = handState.players.filter((p) => !p.folded && p.id !== playerId).length;
  const pot = getTotalPot(handState);

  const totalToAct = handState.toActQueue.length;
  const idx = handState.toActQueue.indexOf(playerId);
  const playersLeftAfter = Math.max(0, totalToAct - idx - 1);
  const positionLoosenessValue = totalToAct > 0 ? 1 - playersLeftAfter / totalToAct : 0.5;

  const decision = decideAction({
    level,
    personality,
    holeCards: player.holeCards,
    board: handState.board,
    numOpponents,
    pot,
    toCall: legal.callAmount,
    canCheck: legal.canCheck,
    canRaise: legal.canRaise,
    minRaiseTotal: legal.minRaiseTotal,
    maxRaiseTotal: legal.maxRaiseTotal,
    street: handState.street,
    positionLoosenessValue,
    rng
  });

  return { action: engineAction(decision, legal), decision };
}

function engineAction(decision, legal) {
  switch (decision.action) {
    case 'raise':
      return { type: 'raiseTo', amount: decision.raiseTo };
    case 'call':
      return { type: 'call' };
    case 'check':
      return { type: 'check' };
    default:
      return legal.canCheck ? { type: 'check' } : { type: 'fold' };
  }
}
