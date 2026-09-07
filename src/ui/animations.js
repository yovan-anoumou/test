// Lightweight chip-movement animations. Not core gameplay (the engine
// state is already correct without them) - purely a visual touch so
// bets/pots feel like they physically move, per the Winamax-style spec.

function flyChip(fromRect, toRect, label) {
  return new Promise((resolve) => {
    const chip = document.createElement('div');
    chip.className = 'chip-icon';
    chip.style.position = 'fixed';
    chip.style.left = `${fromRect.left + fromRect.width / 2 - 8}px`;
    chip.style.top = `${fromRect.top + fromRect.height / 2 - 8}px`;
    chip.style.zIndex = '50';
    chip.style.transition = 'transform 480ms cubic-bezier(.3,.7,.4,1), opacity 480ms ease';
    chip.style.pointerEvents = 'none';
    document.body.appendChild(chip);

    const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);

    requestAnimationFrame(() => {
      chip.style.transform = `translate(${dx}px, ${dy}px)`;
      chip.style.opacity = '0.15';
    });

    setTimeout(() => {
      chip.remove();
      resolve();
    }, 500);
  });
}

export async function animateBetsToPot(rootEl) {
  const potEl = rootEl.querySelector('.pot-display');
  if (!potEl) return;
  const potRect = potEl.getBoundingClientRect();
  const bets = [...rootEl.querySelectorAll('.seat-bet')];
  if (!bets.length) return;
  await Promise.all(bets.map((betEl) => flyChip(betEl.getBoundingClientRect(), potRect, '')));
}

export async function animatePotToWinners(rootEl, winnerSeatIds) {
  const potEl = rootEl.querySelector('.pot-display');
  if (!potEl || !winnerSeatIds.length) return;
  const potRect = potEl.getBoundingClientRect();
  const targets = winnerSeatIds
    .map((id) => rootEl.querySelector(`.seat[data-seat-id="${CSS.escape(id)}"] .seat-plate`))
    .filter(Boolean);
  if (!targets.length) return;
  await Promise.all(targets.map((el) => flyChip(potRect, el.getBoundingClientRect(), '')));
}
