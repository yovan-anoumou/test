import { optimalRecommendation } from './coachEngine.js';
import { deriveSituation } from './situationContext.js';

// Read-only advice for the current decision point of a given (usually
// human) player - never applies anything, just tells you what the
// mathematically sound play is and why, using the exact same engine the
// AI "expert" level and the chatbot rely on.
export function getLiveAdvice(handState, playerId, { bluffFrequency = 0.08, rng = Math.random } = {}) {
  const situation = deriveSituation(handState, playerId);
  if (!situation) return null;

  const rec = optimalRecommendation({
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
    bluffFrequency,
    rng
  });

  return { ...rec, situation };
}

export function actionLabel(action) {
  switch (action) {
    case 'fold': return 'Se coucher';
    case 'check': return 'Parole';
    case 'call': return 'Suivre';
    case 'raise': return 'Relancer';
    default: return action;
  }
}
