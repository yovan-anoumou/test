import { deriveSituation } from '../coach/situationContext.js';
import { decideAction } from './decision.js';

// Bridges the poker engine (hand.js) with the AI decision logic
// (decision.js): reads the current legal actions and situation off the
// hand state, asks the AI brain for a decision, and turns that decision
// back into an engine-shaped action ({ type, amount? }).
export function computeAIAction(handState, playerId, { level, personality, rng = Math.random } = {}) {
  const situation = deriveSituation(handState, playerId);
  if (!situation) return null;

  const decision = decideAction({
    level,
    personality,
    holeCards: situation.holeCards,
    board: situation.board,
    numOpponents: situation.numOpponents,
    pot: situation.pot,
    toCall: situation.toCall,
    canCheck: situation.canCheck,
    canRaise: situation.canRaise,
    minRaiseTotal: situation.minRaiseTotal,
    maxRaiseTotal: situation.maxRaiseTotal,
    street: situation.street,
    positionLoosenessValue: situation.positionLoosenessValue,
    rng
  });

  return { action: engineAction(decision, situation.legal), decision };
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
