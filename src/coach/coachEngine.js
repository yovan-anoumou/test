import { estimateEquity, requiredEquityToCall } from '../ai/equity.js';

// This module is the single source of truth for "what is the mathematically
// sound play here": equity via Monte Carlo simulation, compared to pot
// odds, adjusted for position and street. It is deliberately shared by:
//  - the AI "expert" level (near-optimal opponent play),
//  - the live coach overlay,
//  - the chatbot's situational answers,
//  - the post-hand analysis grader.
// Keeping one implementation guarantees the three coach modes never
// contradict each other for the same situation (spec section 6.4).

export const POSITION_LABELS = ['UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// Returns a 0 (very early) .. 1 (button) looseness multiplier: how much
// wider a range is justified purely by position, independent of skill.
export function positionLooseness(position, playersLeftToAct) {
  // position: index of seats still to act AFTER this player this street is
  // a decent proxy for "lateness" pre-flop; fewer players left = later position.
  const total = Math.max(playersLeftToAct.total, 1);
  const remaining = playersLeftToAct.after;
  return 1 - remaining / total; // 0 = first to act (tightest), ~1 = last to act (widest)
}

// Core, level-agnostic situational math: equity, pot odds, and the
// break-even comparison. Every consumer (AI, coach, chatbot) starts here.
export function analyzeSituation({ holeCards, board, numOpponents, pot, toCall, iterations, rng = Math.random }) {
  // More opponents = more work per Monte Carlo draw, so scale the sample
  // count down to keep decisions fast at full 9-max tables while staying
  // precise heads-up. Callers (e.g. tests) can still force an exact count.
  const sampleCount = iterations ?? Math.max(60, Math.round(500 / (numOpponents + 1)));
  const equity = estimateEquity({ holeCards, board, numOpponents, iterations: sampleCount, rng });
  const required = requiredEquityToCall(toCall, pot);
  const evOfCall = equity * (pot + toCall) - toCall;
  return {
    equity,
    requiredEquity: required,
    equityEdge: equity - required,
    evOfCall,
    profitableCall: toCall <= 0 || equity > required
  };
}

// Suggests a bet/raise size as a fraction of the pot depending on how
// strong the hand is and the street - stronger / more polarized hands bet
// bigger, medium-strength hands bet smaller for thinner value/protection.
export function suggestSizingFraction({ equity, street, isBluff }) {
  if (isBluff) {
    return street === 'river' ? 0.75 : 0.66;
  }
  if (equity > 0.82) return 0.75;
  if (equity > 0.65) return 0.6;
  if (equity > 0.5) return 0.45;
  return 0.33;
}

export function potFractionToAmount(fraction, pot, toCall) {
  // "Pot" for raise sizing purposes is the pot after a call is made.
  return Math.round((pot + toCall) * fraction) + toCall;
}

// The "optimal" recommendation used as ground truth by the coach and by
// the expert AI baseline (expert AI then layers a light personality
// variance on top of this, see ai/decision.js).
export function optimalRecommendation({
  holeCards,
  board,
  numOpponents,
  pot,
  toCall,
  canCheck,
  canRaise,
  minRaiseTotal,
  maxRaiseTotal,
  street,
  positionLoosenessValue = 0.5,
  bluffFrequency = 0.08,
  rng = Math.random
}) {
  const analysis = analyzeSituation({ holeCards, board, numOpponents, pot, toCall, rng });
  const raiseEquityThreshold = 0.58 - positionLoosenessValue * 0.12; // wider from late position

  let action = 'fold';
  let raiseTo = null;
  let isBluff = false;

  if (analysis.equity >= raiseEquityThreshold && canRaise) {
    action = 'raise';
    const fraction = suggestSizingFraction({ equity: analysis.equity, street, isBluff: false });
    raiseTo = clamp(potFractionToAmount(fraction, pot, toCall) , minRaiseTotal ?? 0, maxRaiseTotal ?? Infinity);
  } else if (canRaise && rng() < bluffFrequency && analysis.equity < 0.35) {
    action = 'raise';
    isBluff = true;
    const fraction = suggestSizingFraction({ equity: analysis.equity, street, isBluff: true });
    raiseTo = clamp(potFractionToAmount(fraction, pot, toCall), minRaiseTotal ?? 0, maxRaiseTotal ?? Infinity);
  } else if (canCheck) {
    action = 'check';
  } else if (analysis.profitableCall) {
    action = 'call';
  } else {
    action = 'fold';
  }

  return {
    action,
    raiseTo,
    isBluff,
    equity: analysis.equity,
    requiredEquity: analysis.requiredEquity,
    equityEdge: analysis.equityEdge,
    evOfCall: analysis.evOfCall,
    reasoning: buildReasoning({ action, analysis, street, isBluff })
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function buildReasoning({ action, analysis, street, isBluff }) {
  const eqPct = Math.round(analysis.equity * 100);
  const reqPct = Math.round(analysis.requiredEquity * 100);
  if (action === 'fold') {
    return `Equite estimee ${eqPct}% pour une cote du pot qui exige ${reqPct}% : suivre serait perdant sur la duree.`;
  }
  if (action === 'check') {
    return `Equite ${eqPct}%, pas de mise a payer : checker garde le pot sans risque ici.`;
  }
  if (action === 'call') {
    return `Equite ${eqPct}% superieure aux ${reqPct}% requis par la cote du pot : suivre est rentable.`;
  }
  if (action === 'raise' && isBluff) {
    return `Main faible (${eqPct}% d'equite) mais relance en bluff pour equilibrer la frequence de mise sur ${street}.`;
  }
  return `Equite forte (${eqPct}%) : relancer pour value et faire payer les mains plus faibles.`;
}
