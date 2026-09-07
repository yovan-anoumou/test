const RANK_LABEL = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

const SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS = new Set(['h', 'd']);

// Renders a clean vector playing card face as an inline SVG string. No
// external assets - fully generic, drawn from scratch.
export function cardFaceSVG(card) {
  const label = RANK_LABEL[card.rank];
  const glyph = SUIT_GLYPH[card.suit];
  const color = RED_SUITS.has(card.suit) ? 'var(--card-red)' : 'var(--card-black)';
  return `
  <svg viewBox="0 0 100 140" class="pt-card-face" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label} ${glyph}">
    <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#fdfdfb" stroke="#d8d5cc" stroke-width="1.5"/>
    <text x="9" y="26" font-family="var(--font-tabular)" font-weight="700" font-size="22" fill="${color}">${label}</text>
    <text x="9" y="44" font-family="var(--font-sans)" font-size="18" fill="${color}">${glyph}</text>
    <text x="91" y="122" font-family="var(--font-tabular)" font-weight="700" font-size="22" fill="${color}" text-anchor="end" transform="rotate(180 91 122)" style="transform-origin:91px 122px">${label}</text>
    <text x="91" y="104" font-family="var(--font-sans)" font-size="18" fill="${color}" text-anchor="end" transform="rotate(180 91 104)" style="transform-origin:91px 104px">${glyph}</text>
    <text x="50" y="86" font-family="var(--font-sans)" font-size="46" fill="${color}" text-anchor="middle" opacity="0.9">${glyph}</text>
  </svg>`;
}

export function cardBackSVG() {
  return `
  <svg viewBox="0 0 100 140" class="pt-card-back" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="carte cachee">
    <defs>
      <pattern id="pt-back-pattern" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#0f4c5c"/>
        <rect width="6" height="12" fill="#125a6c"/>
      </pattern>
    </defs>
    <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="url(#pt-back-pattern)" stroke="#08313c" stroke-width="2"/>
    <rect x="10" y="10" width="80" height="120" rx="6" fill="none" stroke="#d9b45f" stroke-width="1.5" opacity="0.7"/>
  </svg>`;
}

// Builds a DOM node for a card (or its back) sized by CSS class `pt-card`.
export function renderCard(card, { faceDown = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'pt-card' + (faceDown ? ' is-back' : '');
  wrap.innerHTML = faceDown ? cardBackSVG() : cardFaceSVG(card);
  return wrap;
}
