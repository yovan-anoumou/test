import { renderCard, cardBackSVG } from './cards.js';

function seatPositions(n) {
  const positions = [];
  for (let i = 0; i < n; i++) {
    const angleDeg = 90 + i * (360 / n);
    const rad = (angleDeg * Math.PI) / 180;
    const rx = 43;
    const ry = 39;
    positions.push({ x: 50 + rx * Math.cos(rad), y: 50 + ry * Math.sin(rad) });
  }
  return positions;
}

export function fmtChips(n) {
  return Math.round(n).toLocaleString('fr-FR');
}

function actionVerb(type) {
  switch (type) {
    case 'fold': return 'Couche';
    case 'check': return 'Parole';
    case 'call': return 'Suivi';
    case 'call-blind':
    case 'small-blind': return 'BF';
    case 'big-blind': return 'BB';
    case 'raise': return 'Relance';
    case 'raise-allin-short': return 'Tapis';
    default: return type;
  }
}

export class TableView {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.betAmount = null;
    this.root.innerHTML = `
      <div class="table-screen">
        <div class="top-bar">
          <span class="blinds-info"></span>
          <span class="hand-number"></span>
          <div class="top-bar-buttons">
            <button data-action="toggle-coach" type="button">Coach</button>
            <button data-action="toggle-history" type="button">Historique</button>
            <button data-action="toggle-chat" type="button">Chat</button>
          </div>
        </div>
        <div class="table-area">
          <div class="felt-outer">
            <div class="felt"></div>
            <div class="felt-center">
              <div class="board-cards"></div>
              <div class="pot-display"></div>
            </div>
            <div class="seats-layer"></div>
          </div>
        </div>
        <div class="coach-banner-slot"></div>
        <div class="action-bar">
          <div class="bet-controls" style="display:none">
            <div class="bet-presets"></div>
          </div>
          <div class="bet-slider-row" style="display:none">
            <input type="range" class="bet-slider" min="0" max="0" value="0" step="1" />
            <input type="number" class="bet-amount-input" />
          </div>
          <div class="action-buttons">
            <button class="btn-fold" data-action="fold" type="button">Se coucher</button>
            <button class="btn-check" data-action="check" type="button">Parole</button>
            <button class="btn-call" data-action="call" type="button">Suivre</button>
            <button class="btn-raise" data-action="raise-min" type="button">Relancer</button>
          </div>
        </div>
      </div>
      <div class="overlay-slot"></div>
    `;
    this._wireStatic();
  }

  _wireStatic() {
    const q = (sel) => this.root.querySelector(sel);
    q('[data-action="toggle-coach"]').addEventListener('click', () => this.callbacks.onToggleCoach());
    q('[data-action="toggle-history"]').addEventListener('click', () => this.callbacks.onToggleHistory());
    q('[data-action="toggle-chat"]').addEventListener('click', () => this.callbacks.onToggleChat());
    q('[data-action="fold"]').addEventListener('click', () => this.callbacks.onFold());
    q('[data-action="check"]').addEventListener('click', () => this.callbacks.onCheck());
    q('[data-action="call"]').addEventListener('click', () => this.callbacks.onCall());
    q('[data-action="raise-min"]').addEventListener('click', () => {
      if (this._minRaiseTotal != null) this.callbacks.onRaise(this._minRaiseTotal);
    });
    const slider = q('.bet-slider');
    const amountInput = q('.bet-amount-input');
    slider.addEventListener('input', () => {
      this.betAmount = parseInt(slider.value, 10);
      amountInput.value = this.betAmount;
    });
    amountInput.addEventListener('input', () => {
      const v = parseInt(amountInput.value, 10);
      if (!Number.isNaN(v)) {
        this.betAmount = v;
        slider.value = Math.max(slider.min, Math.min(slider.max, v));
      }
    });
  }

  render(vm) {
    const q = (sel) => this.root.querySelector(sel);
    q('.blinds-info').textContent = `Blindes ${fmtChips(vm.smallBlind)}/${fmtChips(vm.bigBlind)}`;
    q('.hand-number').textContent = `Main #${vm.handNumber}`;
    q('[data-action="toggle-coach"]').classList.toggle('active', vm.coachEnabled);

    this._renderBoardAndPot(vm);
    this._renderSeats(vm);
    this._renderCoachBanner(vm);
    this._renderActionBar(vm);
    this._renderOverlay(vm);
  }

  _renderBoardAndPot(vm) {
    const boardEl = this.root.querySelector('.board-cards');
    boardEl.innerHTML = '';
    for (const card of vm.board) {
      boardEl.appendChild(renderCard(card));
    }
    const potEl = this.root.querySelector('.pot-display');
    potEl.innerHTML = `<span class="chip-icon"></span> Pot: ${fmtChips(vm.pot)}`;
  }

  _renderSeats(vm) {
    const layer = this.root.querySelector('.seats-layer');
    layer.innerHTML = '';
    const positions = seatPositions(vm.seats.length);
    vm.seats.forEach((seat, i) => {
      const pos = positions[i];
      const el = document.createElement('div');
      el.className = 'seat';
      el.dataset.seatId = seat.id || '';
      if (seat.empty) el.classList.add('is-empty');
      if (seat.folded) el.classList.add('is-folded');
      if (seat.sittingOut) el.classList.add('is-sitting-out');
      if (seat.isActive) el.classList.add('is-active');
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;

      if (seat.empty) {
        el.innerHTML = `<div class="seat-plate"><div class="seat-name">Place libre</div></div>`;
        layer.appendChild(el);
        return;
      }

      const cardsEl = document.createElement('div');
      cardsEl.className = 'seat-cards';
      if (seat.holeCards && seat.holeCards.length) {
        for (const c of seat.holeCards) {
          cardsEl.appendChild(renderCard(c, { faceDown: !seat.showCards }));
        }
      }
      el.appendChild(cardsEl);

      const plate = document.createElement('div');
      plate.className = 'seat-plate';
      plate.innerHTML = `
        <div class="seat-name"><span class="avatar">${seat.avatar || ''}</span>${escapeHtml(seat.name)}</div>
        <div class="seat-stack">${fmtChips(seat.stack)}</div>
        ${seat.isDealer ? '<div class="dealer-chip">D</div>' : ''}
        ${seat.lastAction ? `<div class="action-log-bubble">${escapeHtml(seat.lastAction)}</div>` : ''}
      `;
      el.appendChild(plate);

      if (seat.betThisStreet > 0) {
        const bet = document.createElement('div');
        bet.className = 'seat-bet';
        bet.innerHTML = `<span class="chip-icon small"></span>${fmtChips(seat.betThisStreet)}`;
        el.appendChild(bet);
      }

      if (typeof seat.equity === 'number') {
        const eqWrap = document.createElement('div');
        eqWrap.style.width = '100%';
        eqWrap.innerHTML = `
          <div class="equity-bar"><div class="equity-bar-fill" style="width:${Math.round(seat.equity * 100)}%"></div></div>
          <div class="equity-label">${Math.round(seat.equity * 100)}%</div>
        `;
        el.appendChild(eqWrap);
      }

      layer.appendChild(el);
    });
  }

  _renderCoachBanner(vm) {
    const slot = this.root.querySelector('.coach-banner-slot');
    if (!vm.coachEnabled || !vm.coachAdvice) {
      slot.innerHTML = '';
      return;
    }
    const a = vm.coachAdvice;
    const label = { fold: 'Se coucher', check: 'Parole', call: 'Suivre', raise: 'Relancer' }[a.action] || a.action;
    slot.innerHTML = `
      <div class="coach-banner">
        <span class="coach-icon">🎓</span>
        <span><b>${label}${a.raiseTo ? ` a ${fmtChips(a.raiseTo)}` : ''}</b> — ${escapeHtml(a.reasoning)}</span>
        <button class="coach-detail-btn" data-action="coach-detail" type="button">Details</button>
      </div>
    `;
    slot.querySelector('[data-action="coach-detail"]').addEventListener('click', () => this.callbacks.onCoachDetail?.());
  }

  _renderActionBar(vm) {
    const bar = this.root.querySelector('.action-bar');
    const q = (sel) => this.root.querySelector(sel);
    const ab = vm.actionBar;

    if (!ab) {
      bar.classList.add('is-disabled');
      q('.bet-controls').style.display = 'none';
      q('.bet-slider-row').style.display = 'none';
      q('[data-action="check"]').style.display = '';
      q('[data-action="call"]').style.display = 'none';
      q('[data-action="fold"]').disabled = true;
      q('[data-action="check"]').disabled = true;
      q('[data-action="raise-min"]').disabled = true;
      return;
    }
    bar.classList.remove('is-disabled');

    q('[data-action="fold"]').disabled = !ab.canFold;
    const checkBtn = q('[data-action="check"]');
    const callBtn = q('[data-action="call"]');
    checkBtn.style.display = ab.canCheck ? '' : 'none';
    checkBtn.disabled = !ab.canCheck;
    callBtn.style.display = ab.canCheck ? 'none' : '';
    callBtn.disabled = !ab.canCall;
    callBtn.textContent = ab.canCall ? `Suivre ${fmtChips(ab.callAmount)}` : 'Suivre';

    const raiseBtn = q('[data-action="raise-min"]');
    raiseBtn.disabled = !ab.canRaise;
    this._minRaiseTotal = ab.minRaiseTotal;
    raiseBtn.textContent = ab.canRaise ? `Relancer ${fmtChips(ab.minRaiseTotal)}` : 'Relancer';

    const betControls = q('.bet-controls');
    const sliderRow = q('.bet-slider-row');
    if (ab.canRaise) {
      betControls.style.display = '';
      sliderRow.style.display = 'flex';
      const presetsEl = q('.bet-presets');
      presetsEl.innerHTML = '';
      for (const preset of vm.betPresets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        if (preset === 'allin') {
          btn.textContent = 'Tapis';
          btn.addEventListener('click', () => this.callbacks.onRaise(ab.maxRaiseTotal));
        } else {
          const amount = Math.max(ab.minRaiseTotal, Math.min(ab.maxRaiseTotal, Math.round((vm.pot + ab.callAmount) * preset) + ab.callAmount));
          btn.textContent = `${Math.round(preset * 100)}% pot`;
          btn.addEventListener('click', () => this.callbacks.onRaise(amount));
        }
        presetsEl.appendChild(btn);
      }
      const slider = q('.bet-slider');
      const amountInput = q('.bet-amount-input');
      slider.min = ab.minRaiseTotal;
      slider.max = ab.maxRaiseTotal;
      if (this.betAmount == null || this.betAmount < ab.minRaiseTotal || this.betAmount > ab.maxRaiseTotal) {
        this.betAmount = ab.minRaiseTotal;
      }
      slider.value = this.betAmount;
      amountInput.value = this.betAmount;
      amountInput.min = ab.minRaiseTotal;
      amountInput.max = ab.maxRaiseTotal;
      raiseBtn.textContent = `Relancer ${fmtChips(ab.minRaiseTotal)} (min)`;

      // The slider/manual amount needs its own "confirm" affordance, since
      // the main red button is reserved for the one-click minimum raise.
      let confirmBtn = sliderRow.querySelector('.confirm-raise-btn');
      if (!confirmBtn) {
        confirmBtn = document.createElement('button');
        confirmBtn.className = 'confirm-raise-btn';
        confirmBtn.type = 'button';
        confirmBtn.style.cssText = 'background:var(--red-action);color:#fff;border-radius:8px;padding:6px 12px;font-weight:800;';
        sliderRow.appendChild(confirmBtn);
      }
      confirmBtn.textContent = 'OK';
      confirmBtn.onclick = () => this.callbacks.onRaise(this.betAmount);
    } else {
      betControls.style.display = 'none';
      sliderRow.style.display = 'none';
    }
  }

  _renderOverlay(vm) {
    const slot = this.root.querySelector('.overlay-slot');
    if (!vm.overlay) {
      slot.innerHTML = '';
      return;
    }
    if (vm.overlay.type === 'hand-result') {
      slot.innerHTML = this._handResultHTML(vm.overlay);
      slot.querySelector('[data-action="continue"]').addEventListener('click', () => this.callbacks.onContinue());
      const analysisBtn = slot.querySelector('[data-action="show-analysis"]');
      if (analysisBtn) analysisBtn.addEventListener('click', () => this.callbacks.onShowAnalysis());
    } else if (vm.overlay.type === 'analysis') {
      slot.innerHTML = this._analysisHTML(vm.overlay);
      slot.querySelector('[data-action="close-analysis"]').addEventListener('click', () => this.callbacks.onCloseOverlay());
    } else if (vm.overlay.type === 'game-over') {
      slot.innerHTML = `
        <div class="game-over-screen">
          <h1>${vm.overlay.won ? 'Victoire !' : 'Partie terminee'}</h1>
          <p>${escapeHtml(vm.overlay.message)}</p>
          <button data-action="restart" type="button">Nouvelle partie</button>
        </div>
      `;
      slot.querySelector('[data-action="restart"]').addEventListener('click', () => this.callbacks.onRestart());
    }
  }

  _handResultHTML(overlay) {
    const winnersHTML = overlay.pots
      .map(
        (pot, i) => `
        <div class="pot-line">Pot ${overlay.pots.length > 1 ? i + 1 : ''} : ${fmtChips(pot.amount)} jetons</div>
        ${pot.winners
          .map(
            (w) => `<div class="result-winner-row"><span class="avatar">${w.avatar || ''}</span><b>${escapeHtml(w.name)}</b> gagne ${fmtChips(w.amount)}${w.category ? ` (${w.category})` : ''}</div>`
          )
          .join('')}
      `
      )
      .join('');
    return `
      <div class="result-overlay">
        <div class="result-card">
          <h2>${overlay.showdown ? 'Abattage' : 'Coup termine'}</h2>
          ${winnersHTML}
          <div class="result-actions">
            ${overlay.canShowAnalysis ? '<button class="secondary" data-action="show-analysis" type="button">Analyser mes decisions</button>' : ''}
            <button data-action="continue" type="button">Main suivante</button>
          </div>
        </div>
      </div>
    `;
  }

  _analysisHTML(overlay) {
    if (!overlay.entries.length) {
      return `
        <div class="result-overlay">
          <div class="result-card">
            <h2>Analyse post-main</h2>
            <p>Vous n'avez pris aucune decision a analyser sur ce coup (ex: pas de cartes distribuees, ou main entierement passive gratuite).</p>
            <div class="result-actions"><button data-action="close-analysis" type="button">Fermer</button></div>
          </div>
        </div>
      `;
    }
    const rows = overlay.entries
      .map(
        (e) => `
        <div class="analysis-entry">
          <span class="verdict ${e.verdict === 'bon' ? 'good' : e.verdict === 'erreur' ? 'mistake' : 'debatable'}">${
            e.verdict === 'bon' ? 'BON CHOIX' : e.verdict === 'erreur' ? 'ERREUR' : 'DISCUTABLE'
          }</span>
          <div><b>${e.street.toUpperCase()}</b> — vous avez fait: ${e.actionTaken.type}${e.actionTaken.amount ? ` (${fmtChips(e.actionTaken.amount)})` : ''}</div>
          <div>${escapeHtml(e.reason)}</div>
        </div>
      `
      )
      .join('');
    return `
      <div class="result-overlay">
        <div class="result-card">
          <h2>Analyse post-main</h2>
          ${rows}
          <div class="result-actions"><button data-action="close-analysis" type="button">Fermer</button></div>
        </div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
