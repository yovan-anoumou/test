const NAME_POOL = [
  'Lea', 'Max', 'Nora', 'Theo', 'Ines', 'Sacha', 'Zoe', 'Adam',
  'Mia', 'Nino', 'Alex', 'Jade', 'Rico', 'Suzy', 'Karl', 'Vic'
];

const AVATAR_POOL = ['🐺', '🦊', '🐯', '🦁', '🐸', '🐼', '🦉', '🐳', '🦅', '🐙', '🐲', '🐨'];

export function randomName(rng = Math.random, excluded = []) {
  const pool = NAME_POOL.filter((n) => !excluded.includes(n));
  const source = pool.length > 0 ? pool : NAME_POOL;
  return source[Math.floor(rng() * source.length)];
}

export function randomAvatar(rng = Math.random) {
  return AVATAR_POOL[Math.floor(rng() * AVATAR_POOL.length)];
}

// Aggression variance: a small per-bot personality trait in roughly
// [-0.3, 0.3] so bots of the same level are not perfect clones. Positive =
// more aggressive (raises/bluffs a bit more, calls a bit less passively),
// negative = more passive/tight.
export function randomPersonality(rng = Math.random) {
  const aggression = (rng() - 0.5) * 0.6;
  return { aggression };
}

export const AI_LEVELS = [
  { id: 'beginner', label: 'Debutant' },
  { id: 'intermediate', label: 'Intermediaire' },
  { id: 'expert', label: 'Expert / Pro' }
];
