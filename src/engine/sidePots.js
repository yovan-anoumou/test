// Computes main pot + side pots from a list of contributions.
// contributions: [{ id, contributed, folded }]
// Returns: [{ amount, eligibleIds: [id, ...] }]
//
// Standard "levels" algorithm: every distinct contribution amount among
// players who put chips in defines a payout level. At each level we collect
// the chips contributed by everyone up to that level (folded players'
// chips included, since they don't disappear), and the players still
// eligible to win that pot are those who are not folded and contributed
// at least that level.
export function computeSidePots(contributions) {
  const withChips = contributions.filter((c) => c.contributed > 0);
  if (withChips.length === 0) return [];

  const levels = [...new Set(withChips.map((c) => c.contributed))].sort((a, b) => a - b);

  const pots = [];
  let prevLevel = 0;
  for (const level of levels) {
    let amount = 0;
    const eligibleIds = [];
    for (const c of withChips) {
      const slice = Math.min(c.contributed, level) - prevLevel;
      if (slice > 0) amount += slice;
      if (!c.folded && c.contributed >= level) eligibleIds.push(c.id);
    }
    if (amount > 0 && eligibleIds.length > 0) {
      pots.push({ amount, eligibleIds });
    }
    prevLevel = level;
  }

  // Merge consecutive pots that share the exact same eligible set, purely
  // cosmetic (fewer "pot 1 / pot 2" entries shown when unnecessary) but
  // keeps the payout math identical.
  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && sameSet(last.eligibleIds, pot.eligibleIds)) {
      last.amount += pot.amount;
    } else {
      merged.push({ amount: pot.amount, eligibleIds: pot.eligibleIds.slice() });
    }
  }
  return merged;
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((x) => setA.has(x));
}

// Distributes a single pot amount among winners (best-hand players among
// eligibleIds), splitting evenly. When the pot doesn't divide evenly, the
// leftover chips go to the players closest to the left of the dealer
// button first (standard casino rule), one chip at a time.
//
// winnerIds must already be ordered starting from the first winner to
// receive an odd chip (i.e. seating order starting left of the button).
export function splitPot(amount, winnerIds) {
  const share = Math.floor(amount / winnerIds.length);
  let remainder = amount - share * winnerIds.length;
  const payouts = {};
  for (const id of winnerIds) {
    payouts[id] = share;
  }
  let i = 0;
  while (remainder > 0) {
    const id = winnerIds[i % winnerIds.length];
    payouts[id] += 1;
    remainder -= 1;
    i += 1;
  }
  return payouts;
}
