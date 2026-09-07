import { analyzeSituation, suggestSizingFraction, potFractionToAmount } from '../coach/coachEngine.js';

// Per-level behavioural parameters. These are the knobs that make a
// "Debutant" a real calling station and an "Expert" play close to
// mathematically sound poker, all while sharing the exact same underlying
// equity/pot-odds computation (coachEngine.analyzeSituation).
export const LEVEL_PARAMS = {
  beginner: {
    raiseThreshold: 0.8, // needs a very strong hand to raise
    bluffFrequency: 0.02,
    optimismBonus: 0.12, // overrates their own hand
    noise: 0.16,
    positionAwareness: 0.1,
    callLooseness: 0.5, // will call even ~50% short of the equity pot odds require
    sizingConsistency: 0.15
  },
  intermediate: {
    raiseThreshold: 0.63,
    bluffFrequency: 0.1,
    optimismBonus: 0.03,
    noise: 0.07,
    positionAwareness: 0.55,
    callLooseness: 0.15,
    sizingConsistency: 0.6
  },
  expert: {
    raiseThreshold: 0.56,
    bluffFrequency: 0.12,
    optimismBonus: 0,
    noise: 0.02,
    positionAwareness: 1,
    callLooseness: 0,
    sizingConsistency: 1
  }
};

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Picks a bet/raise sizing fraction of pot, with sizing precision degrading
// for weaker levels (a beginner's bet sizing is inconsistent / arbitrary,
// an expert's is well calibrated to hand strength and street).
function pickSizingFraction({ params, equity, street, isBluff, rng }) {
  const clean = suggestSizingFraction({ equity, street, isBluff });
  const noiseSpread = (1 - params.sizingConsistency) * 0.7;
  const noisy = clean + (rng() - 0.5) * noiseSpread;
  return Math.max(0.2, Math.min(1.6, noisy));
}

// Decides one action for an AI player at the current decision point.
// `positionLoosenessValue` in [0,1]: 0 = first to act (early position),
// close to 1 = last to act (late position, e.g. button).
export function decideAction({
  level,
  personality = { aggression: 0 },
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
  rng = Math.random
}) {
  const params = LEVEL_PARAMS[level] || LEVEL_PARAMS.intermediate;
  const analysis = analyzeSituation({ holeCards, board, numOpponents, pot, toCall, rng });

  const aggression = personality.aggression || 0; // roughly -0.3..0.3

  let perceivedEquity = analysis.equity + params.optimismBonus;
  perceivedEquity = clamp01(perceivedEquity + (rng() - 0.5) * params.noise);

  const raiseThreshold = clamp01(
    params.raiseThreshold - positionLoosenessValue * params.positionAwareness * 0.14 - aggression * 0.1
  );
  const bluffFrequency = Math.max(0, params.bluffFrequency + aggression * 0.06);
  const callBar = analysis.requiredEquity * (1 - params.callLooseness);

  let action = 'fold';
  let raiseTo = null;
  let isBluff = false;

  const wantsToBluff = canRaise && rng() < bluffFrequency && analysis.equity < 0.35;

  if (perceivedEquity >= raiseThreshold && canRaise) {
    action = 'raise';
    const fraction = pickSizingFraction({ params, equity: perceivedEquity, street, isBluff: false, rng });
    raiseTo = clampInt(potFractionToAmount(fraction, pot, toCall), minRaiseTotal ?? 0, maxRaiseTotal ?? Infinity);
  } else if (wantsToBluff) {
    action = 'raise';
    isBluff = true;
    const fraction = pickSizingFraction({ params, equity: analysis.equity, street, isBluff: true, rng });
    raiseTo = clampInt(potFractionToAmount(fraction, pot, toCall), minRaiseTotal ?? 0, maxRaiseTotal ?? Infinity);
  } else if (canCheck) {
    action = 'check';
  } else if (toCall <= 0 || perceivedEquity >= callBar) {
    action = 'call';
  } else {
    action = 'fold';
  }

  // Safety net: raiseTo must always land within legal bounds if raising.
  if (action === 'raise') {
    if (raiseTo === null || Number.isNaN(raiseTo) || minRaiseTotal === undefined) {
      action = canCheck ? 'check' : toCall <= 0 ? 'check' : 'call';
    } else {
      raiseTo = clampInt(raiseTo, minRaiseTotal, maxRaiseTotal);
    }
  }

  return {
    action,
    raiseTo,
    isBluff,
    equity: analysis.equity,
    requiredEquity: analysis.requiredEquity,
    level
  };
}
