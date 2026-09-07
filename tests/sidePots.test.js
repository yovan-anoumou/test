import { describe, it, expect } from 'vitest';
import { computeSidePots, splitPot } from '../src/engine/sidePots.js';

describe('computeSidePots', () => {
  it('returns a single pot when everyone contributed equally', () => {
    const pots = computeSidePots([
      { id: 'a', contributed: 100, folded: false },
      { id: 'b', contributed: 100, folded: false },
      { id: 'c', contributed: 100, folded: false }
    ]);
    expect(pots).toEqual([{ amount: 300, eligibleIds: ['a', 'b', 'c'] }]);
  });

  it('creates a main pot and a side pot for one short all-in', () => {
    // a all-in for 50, b and c put in 100 each
    const pots = computeSidePots([
      { id: 'a', contributed: 50, folded: false },
      { id: 'b', contributed: 100, folded: false },
      { id: 'c', contributed: 100, folded: false }
    ]);
    expect(pots).toEqual([
      { amount: 150, eligibleIds: ['a', 'b', 'c'] }, // 50*3
      { amount: 100, eligibleIds: ['b', 'c'] } // remaining 50 each from b and c
    ]);
  });

  it('handles multiple all-in levels producing several side pots', () => {
    const pots = computeSidePots([
      { id: 'a', contributed: 20, folded: false },
      { id: 'b', contributed: 50, folded: false },
      { id: 'c', contributed: 100, folded: false },
      { id: 'd', contributed: 100, folded: false }
    ]);
    // level 20: 20*4=80 eligible all
    // level 50: (50-20)*3=90 eligible b,c,d
    // level 100: (100-50)*2=100 eligible c,d
    expect(pots).toEqual([
      { amount: 80, eligibleIds: ['a', 'b', 'c', 'd'] },
      { amount: 90, eligibleIds: ['b', 'c', 'd'] },
      { amount: 100, eligibleIds: ['c', 'd'] }
    ]);
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(20 + 50 + 100 + 100);
  });

  it('excludes folded players from eligibility but keeps their chips in the pot', () => {
    const pots = computeSidePots([
      { id: 'a', contributed: 100, folded: true },
      { id: 'b', contributed: 100, folded: false },
      { id: 'c', contributed: 100, folded: false }
    ]);
    expect(pots).toEqual([{ amount: 300, eligibleIds: ['b', 'c'] }]);
  });

  it('keeps a folded player contribution in the pot even though they cannot win it', () => {
    // c called a small bet for 10 then folded to a bigger raise; a and b
    // both went on to contribute 40 each. c's 10 chips are dead money.
    const pots = computeSidePots([
      { id: 'a', contributed: 40, folded: false },
      { id: 'b', contributed: 40, folded: false },
      { id: 'c', contributed: 10, folded: true }
    ]);
    expect(pots).toEqual([{ amount: 90, eligibleIds: ['a', 'b'] }]);
  });

  it('returns nothing when nobody contributed', () => {
    expect(computeSidePots([])).toEqual([]);
  });
});

describe('splitPot', () => {
  it('splits evenly with no remainder', () => {
    expect(splitPot(100, ['a', 'b'])).toEqual({ a: 50, b: 50 });
  });

  it('gives the odd chip(s) to winners starting left of the button, in order', () => {
    // 100 among 3 winners -> 33,33,33 + 1 leftover to first in order
    const payouts = splitPot(100, ['a', 'b', 'c']);
    expect(payouts.a).toBe(34);
    expect(payouts.b).toBe(33);
    expect(payouts.c).toBe(33);
    expect(payouts.a + payouts.b + payouts.c).toBe(100);
  });

  it('gives a single winner the whole pot', () => {
    expect(splitPot(777, ['a'])).toEqual({ a: 777 });
  });
});
