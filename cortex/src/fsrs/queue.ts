import type { CardRecord } from "../db/schema";
import type { SubtestId } from "../domain/modules";

/**
 * Ré-ordonne une liste de cartes pour éviter les blocs monothématiques
 * (principe d'interleaving) : round-robin entre sous-tests, en gardant
 * l'ordre d'échéance (due) à l'intérieur de chaque sous-test.
 */
export function interleaveBySubtest(cards: CardRecord[]): CardRecord[] {
  const bySubtest = new Map<SubtestId, CardRecord[]>();
  for (const card of cards) {
    const list = bySubtest.get(card.subtest) ?? [];
    list.push(card);
    bySubtest.set(card.subtest, list);
  }
  for (const list of bySubtest.values()) {
    list.sort((a, b) => a.due.localeCompare(b.due));
  }

  const subtests = Array.from(bySubtest.keys());
  const result: CardRecord[] = [];
  let remaining = cards.length;
  let i = 0;
  while (remaining > 0) {
    const subtest = subtests[i % subtests.length];
    const list = bySubtest.get(subtest)!;
    if (list.length > 0) {
      result.push(list.shift()!);
      remaining--;
    }
    i++;
  }
  return result;
}

/** Sélectionne, dans une liste de cartes déjà triées par échéance, les N premières par sous-test. */
export function takeBySubtest(
  cards: CardRecord[],
  subtest: SubtestId,
  limit: number,
): CardRecord[] {
  return cards.filter((c) => c.subtest === subtest).slice(0, limit);
}
