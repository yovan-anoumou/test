import { describe, it, expect } from 'vitest';
import { makeCard } from '../src/engine/deck.js';
import { evaluateBestHand, compareScores, handCategoryName } from '../src/engine/handEvaluator.js';

function cards(spec) {
  // spec: "As Kd Qh Jc 10s" style strings, rank uses 2-10,J,Q,K,A
  const rankMap = { J: 11, Q: 12, K: 13, A: 14 };
  return spec.split(' ').map((tok) => {
    const suit = tok.slice(-1);
    const rankStr = tok.slice(0, -1);
    const rank = rankMap[rankStr] || parseInt(rankStr, 10);
    return makeCard(rank, suit);
  });
}

describe('evaluateBestHand categories', () => {
  it('detects a royal flush (straight flush ace high)', () => {
    const hand = cards('As Ks Qs Js 10s 2h 3d');
    const result = evaluateBestHand(hand);
    expect(handCategoryName(result.score)).toBe('Quinte flush');
    expect(result.score[1]).toBe(14);
  });

  it('detects the wheel straight (A-2-3-4-5)', () => {
    const hand = cards('As 2s 3d 4c 5h Kd Qd');
    const result = evaluateBestHand(hand);
    expect(handCategoryName(result.score)).toBe('Quinte');
    expect(result.score[1]).toBe(5);
  });

  it('detects a wheel straight flush', () => {
    const hand = cards('As 2s 3s 4s 5s Kd Qd');
    const result = evaluateBestHand(hand);
    expect(handCategoryName(result.score)).toBe('Quinte flush');
    expect(result.score[1]).toBe(5);
  });

  it('detects four of a kind with correct kicker', () => {
    const hand = cards('9s 9d 9h 9c Kd 2h 3d');
    const result = evaluateBestHand(hand);
    expect(handCategoryName(result.score)).toBe('Carre');
    expect(result.score).toEqual([7, 9, 13]);
  });

  it('detects a full house choosing the best trip+pair combo from 7 cards', () => {
    const hand = cards('Ks Kd Kh 9c 9d 2h 3d');
    const result = evaluateBestHand(hand);
    expect(result.score).toEqual([6, 13, 9]);
  });

  it('picks the best full house when two trips are available (uses second as pair)', () => {
    const hand = cards('Ks Kd Kh 9c 9d 9h 3d');
    const result = evaluateBestHand(hand);
    // Best full house: KKK 99, since trips>pairs preferred by rank first
    expect(result.score).toEqual([6, 13, 9]);
  });

  it('detects a flush using best 5 of the suited cards', () => {
    const hand = cards('2s 5s 9s Ks 7s 3d 4d');
    const result = evaluateBestHand(hand);
    expect(handCategoryName(result.score)).toBe('Couleur');
    expect(result.score.slice(1)).toEqual([13, 9, 7, 5, 2]);
  });

  it('detects a straight across 7 cards', () => {
    const hand = cards('7s 8d 9h 10c Js 2d 3d');
    const result = evaluateBestHand(hand);
    expect(handCategoryName(result.score)).toBe('Quinte');
    expect(result.score[1]).toBe(11);
  });

  it('detects three of a kind with correct kickers', () => {
    const hand = cards('7s 7d 7h Ks 2d 4c 9h');
    const result = evaluateBestHand(hand);
    expect(result.score).toEqual([3, 7, 13, 9]);
  });

  it('detects two pair, taking the best two pairs and a kicker', () => {
    const hand = cards('7s 7d Ks Kd 2c 4h 9h');
    const result = evaluateBestHand(hand);
    expect(result.score).toEqual([2, 13, 7, 9]);
  });

  it('detects one pair with best 3 kickers', () => {
    const hand = cards('7s 7d Ks 2d 4c 9h Jh');
    const result = evaluateBestHand(hand);
    expect(result.score).toEqual([1, 7, 13, 11, 9]);
  });

  it('detects high card with best 5 kickers', () => {
    const hand = cards('7s 2d Ks 4c 9h Jh 3d');
    const result = evaluateBestHand(hand);
    expect(result.score).toEqual([0, 13, 11, 9, 7, 4]);
  });

  it('correctly compares two hands and breaks ties by kicker', () => {
    const handA = cards('As Ad Kd 2c 3h 9s 4d'); // pair of aces, K kicker
    const handB = cards('As Ad Qd 2c 3h 9s 4d'); // pair of aces, Q kicker
    const a = evaluateBestHand(handA);
    const b = evaluateBestHand(handB);
    expect(compareScores(a.score, b.score)).toBeGreaterThan(0);
  });

  it('recognizes a split pot (identical scores)', () => {
    const handA = cards('2h 3h Ks Kd Qd Jd 9d');
    const handB = cards('2c 3c Ks Kd Qd Jd 9d');
    const a = evaluateBestHand(handA);
    const b = evaluateBestHand(handB);
    expect(compareScores(a.score, b.score)).toBe(0);
  });
});
