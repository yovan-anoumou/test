import { optimalRecommendation } from './coachEngine.js';
import { actionLabel } from './liveCoach.js';

// Grades one recorded decision point against the mathematically sound
// play for that exact situation (same engine as the live coach and the
// expert AI - see coachEngine.js).
function gradeDecision(situation, actionTaken, rec) {
  const classify = (type) => {
    if (type === 'fold') return 'fold';
    if (type === 'raiseTo') return 'aggressive';
    return 'passive'; // check or call
  };
  const humanClass = classify(actionTaken.type);
  const optimalClass = rec.action === 'raise' ? 'aggressive' : rec.action === 'fold' ? 'fold' : 'passive';

  if (humanClass === optimalClass) {
    if (humanClass === 'aggressive' && rec.raiseTo && actionTaken.amount) {
      const ratio = actionTaken.amount / rec.raiseTo;
      if (ratio < 0.5 || ratio > 2) {
        return {
          verdict: 'discutable',
          reason: `Bon choix d'attaquer, mais la taille de mise (${actionTaken.amount}) s'ecarte beaucoup de la taille jugee optimale (environ ${rec.raiseTo}).`
        };
      }
    }
    return { verdict: 'bon', reason: rec.reasoning };
  }

  const severity = Math.abs(rec.equityEdge);
  const eqPct = Math.round(rec.equity * 100);
  const reqPct = Math.round(rec.requiredEquity * 100);
  if (severity > 0.12) {
    return {
      verdict: 'erreur',
      reason: `${actionLabel(rec.action)} aurait ete nettement plus rentable ici : equite estimee ${eqPct}% contre ${reqPct}% requis par la cote du pot.`
    };
  }
  return {
    verdict: 'discutable',
    reason: `${actionLabel(rec.action)} etait legerement meilleur ici (equite ${eqPct}% vs ${reqPct}% requis), mais l'ecart reste faible.`
  };
}

// decisionLog: array of { street, situation, actionTaken } captured live
// during the hand (see main.js) for the human player's own decisions.
// Returns a rue-by-rue breakdown with a verdict for each decision.
export function analyzeHand(decisionLog, { rng = Math.random } = {}) {
  return decisionLog.map((entry) => {
    const rec = optimalRecommendation({
      holeCards: entry.situation.holeCards,
      board: entry.situation.board,
      numOpponents: entry.situation.numOpponents,
      pot: entry.situation.pot,
      toCall: entry.situation.toCall,
      canCheck: entry.situation.canCheck,
      canRaise: entry.situation.canRaise,
      minRaiseTotal: entry.situation.minRaiseTotal,
      maxRaiseTotal: entry.situation.maxRaiseTotal,
      street: entry.street,
      positionLoosenessValue: entry.situation.positionLoosenessValue,
      rng
    });
    const grade = gradeDecision(entry.situation, entry.actionTaken, rec);
    return {
      street: entry.street,
      actionTaken: entry.actionTaken,
      recommended: rec,
      verdict: grade.verdict,
      reason: grade.reason,
      equity: rec.equity,
      requiredEquity: rec.requiredEquity,
      position: entry.situation.positionLoosenessValue
    };
  });
}
