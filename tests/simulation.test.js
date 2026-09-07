import { describe, it, expect } from 'vitest';
import { Table } from '../src/engine/table.js';
import { applyAction } from '../src/engine/hand.js';
import { computeAIAction } from '../src/ai/agent.js';
import { randomPersonality } from '../src/ai/personalities.js';

// Deterministic seeded PRNG (mulberry32) so a failing simulation is
// reproducible instead of flaky.
function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEVELS = ['beginner', 'intermediate', 'expert'];

describe('IA vs IA simulation - no chip loss, no deadlock', () => {
  for (const tableSize of [2, 3, 4, 6, 9]) {
    it(`plays 30 hands on a ${tableSize}-player table without losing chips or stalling`, () => {
      const rng = mulberry32(1000 + tableSize);
      const startingStack = 1000;
      const seats = Array.from({ length: tableSize }, (_, i) => ({
        id: `p${i}`,
        name: `p${i}`,
        stack: startingStack
      }));

      const aiConfigs = {};
      seats.forEach((s, i) => {
        aiConfigs[s.id] = { level: LEVELS[i % LEVELS.length], personality: randomPersonality(rng) };
      });

      const table = new Table({ seats, smallBlind: 5, bigBlind: 10, rng });
      const totalChipsAtStart = seats.length * startingStack;

      let handsPlayed = 0;
      while (handsPlayed < 30 && !table.isGameOver()) {
        const hand = table.startNextHand();
        let steps = 0;
        while (!hand.complete) {
          steps += 1;
          if (steps > 500) {
            throw new Error(`Hand ${handsPlayed} stalled after 500 steps (table size ${tableSize})`);
          }
          const playerId = hand.toActQueue[0];
          expect(playerId, `no current actor but hand not complete (table size ${tableSize})`).toBeTruthy();
          const { action } = computeAIAction(hand, playerId, { ...aiConfigs[playerId], rng });
          applyAction(hand, playerId, action);
        }
        table.settleHand();

        const totalChipsNow = table.seats.reduce((s, seat) => s + seat.stack, 0);
        expect(totalChipsNow, `chip conservation broke on hand ${handsPlayed} (table size ${tableSize})`).toBe(totalChipsAtStart);

        handsPlayed += 1;
      }

      expect(handsPlayed).toBeGreaterThan(0);
    });
  }
});
