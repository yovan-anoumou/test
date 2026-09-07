import { getLegalActions, getTotalPot } from '../engine/hand.js';

// Extracts the plain-data "situation" for a given player at the current
// decision point, in the shape coachEngine.optimalRecommendation /
// ai/decision.js expect. Shared by the AI agent and the coach so both
// always reason about the exact same numbers.
export function deriveSituation(handState, playerId) {
  const legal = getLegalActions(handState, playerId);
  if (!legal) return null;

  const player = handState.players.find((p) => p.id === playerId);
  const numOpponents = handState.players.filter((p) => !p.folded && p.id !== playerId).length;
  const pot = getTotalPot(handState);

  const totalToAct = handState.toActQueue.length;
  const idx = handState.toActQueue.indexOf(playerId);
  const playersLeftAfter = Math.max(0, totalToAct - idx - 1);
  const positionLoosenessValue = totalToAct > 0 ? 1 - playersLeftAfter / totalToAct : 0.5;

  return {
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
    legal
  };
}
