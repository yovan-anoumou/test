import { AI_LEVELS, randomName, randomAvatar } from '../ai/personalities.js';

const DEFAULT_BET_PRESETS = [0.25, 0.33, 0.5, 0.66, 1, 1.5, 2, 'allin'];

function makeOpponent(rng, existingNames) {
  const name = randomName(rng, existingNames);
  return { name, avatar: randomAvatar(rng), level: 'intermediate' };
}

export function renderConfigScreen(root, { onStart, rng = Math.random } = {}) {
  const state = {
    numOpponents: 5,
    opponents: [],
    startingStack: 1000,
    smallBlind: 5,
    bigBlind: 10,
    blindsProgressive: true,
    blindIncreaseEveryHands: 10,
    blindIncreaseFactor: 1.5,
    betPresets: DEFAULT_BET_PRESETS.slice(),
    hideWinningHandIfEveryoneFolded: true
  };

  function ensureOpponentCount() {
    while (state.opponents.length < state.numOpponents) {
      state.opponents.push(makeOpponent(rng, state.opponents.map((o) => o.name)));
    }
    state.opponents.length = state.numOpponents;
  }
  ensureOpponentCount();

  function render() {
    root.innerHTML = `
      <div class="config-screen">
        <div class="config-card">
          <h1 class="config-title">Poker Trainer</h1>
          <p class="config-subtitle">Entrainement Texas Hold'em No Limit contre des IA. 100% gratuit, sans argent reel, sans compte.</p>

          <div class="config-section">
            <h3>Adversaires</h3>
            <div class="config-row">
              <label>Nombre d'IA (1-8)</label>
              <div class="stepper">
                <button data-action="dec-opponents" type="button">-</button>
                <span>${state.numOpponents}</span>
                <button data-action="inc-opponents" type="button">+</button>
              </div>
            </div>
            <div class="global-level-toggle">
              Appliquer a tous:
              <select id="global-level">
                <option value="">-</option>
                ${AI_LEVELS.map((l) => `<option value="${l.id}">${l.label}</option>`).join('')}
              </select>
            </div>
            <div class="opponent-list">
              ${state.opponents
                .map(
                  (o, i) => `
                <div class="opponent-row" data-index="${i}">
                  <span class="avatar">${o.avatar}</span>
                  <input type="text" data-field="name" value="${o.name}" maxlength="14" />
                  <select data-field="level">
                    ${AI_LEVELS.map((l) => `<option value="${l.id}" ${l.id === o.level ? 'selected' : ''}>${l.label}</option>`).join('')}
                  </select>
                </div>`
                )
                .join('')}
            </div>
          </div>

          <div class="config-section">
            <h3>Tapis et blindes</h3>
            <div class="config-row">
              <label>Tapis de depart</label>
              <input type="number" id="starting-stack" min="100" step="50" value="${state.startingStack}" />
            </div>
            <div class="config-row">
              <label>Petite blinde</label>
              <input type="number" id="small-blind" min="1" value="${state.smallBlind}" />
              <label style="min-width:auto">Grosse blinde</label>
              <input type="number" id="big-blind" min="2" value="${state.bigBlind}" />
            </div>
            <div class="config-row">
              <label>Blindes progressives</label>
              <input type="checkbox" id="blinds-progressive" ${state.blindsProgressive ? 'checked' : ''} />
            </div>
            <div class="config-row" id="blind-progression-row" style="${state.blindsProgressive ? '' : 'display:none'}">
              <label>Augmentation toutes les</label>
              <input type="number" id="blind-every" min="2" value="${state.blindIncreaseEveryHands}" />
              <label style="min-width:auto">mains, x</label>
              <input type="number" id="blind-factor" min="1.1" step="0.1" value="${state.blindIncreaseFactor}" />
            </div>
          </div>

          <div class="config-section">
            <h3>Tailles de mise predefinies (barre d'action)</h3>
            <div class="bet-preset-config">
              ${state.betPresets
                .map((p, i) =>
                  p === 'allin'
                    ? `<div><label>Tapis</label><input type="text" value="Tapis" disabled /></div>`
                    : `<div><label>Preset ${i + 1}</label><input type="number" step="0.05" min="0.1" data-preset-index="${i}" value="${p}" /></div>`
                )
                .join('')}
            </div>
          </div>

          <div class="config-section">
            <h3>Options</h3>
            <div class="config-row">
              <label>Cacher mes cartes gagnantes si tout le monde s'est couche</label>
              <input type="checkbox" id="hide-winning-hand" ${state.hideWinningHandIfEveryoneFolded ? 'checked' : ''} />
            </div>
          </div>

          <button class="start-btn" id="start-btn" type="button">Commencer la partie</button>
        </div>
      </div>
    `;
    wire();
  }

  function wire() {
    root.querySelector('[data-action="inc-opponents"]').addEventListener('click', () => {
      if (state.numOpponents < 8) {
        state.numOpponents += 1;
        ensureOpponentCount();
        render();
      }
    });
    root.querySelector('[data-action="dec-opponents"]').addEventListener('click', () => {
      if (state.numOpponents > 1) {
        state.numOpponents -= 1;
        ensureOpponentCount();
        render();
      }
    });

    root.querySelectorAll('.opponent-row').forEach((rowEl) => {
      const i = parseInt(rowEl.dataset.index, 10);
      rowEl.querySelector('[data-field="name"]').addEventListener('input', (e) => {
        state.opponents[i].name = e.target.value.trim() || `IA ${i + 1}`;
      });
      rowEl.querySelector('[data-field="level"]').addEventListener('change', (e) => {
        state.opponents[i].level = e.target.value;
      });
    });

    root.querySelector('#global-level').addEventListener('change', (e) => {
      if (!e.target.value) return;
      state.opponents.forEach((o) => (o.level = e.target.value));
      render();
    });

    root.querySelector('#starting-stack').addEventListener('input', (e) => {
      state.startingStack = parseInt(e.target.value, 10) || 1000;
    });
    root.querySelector('#small-blind').addEventListener('input', (e) => {
      state.smallBlind = parseInt(e.target.value, 10) || 1;
    });
    root.querySelector('#big-blind').addEventListener('input', (e) => {
      state.bigBlind = parseInt(e.target.value, 10) || 2;
    });
    root.querySelector('#blinds-progressive').addEventListener('change', (e) => {
      state.blindsProgressive = e.target.checked;
      root.querySelector('#blind-progression-row').style.display = state.blindsProgressive ? '' : 'none';
    });
    root.querySelector('#blind-every').addEventListener('input', (e) => {
      state.blindIncreaseEveryHands = parseInt(e.target.value, 10) || 10;
    });
    root.querySelector('#blind-factor').addEventListener('input', (e) => {
      state.blindIncreaseFactor = parseFloat(e.target.value) || 1.5;
    });
    root.querySelectorAll('[data-preset-index]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.presetIndex, 10);
        state.betPresets[idx] = parseFloat(e.target.value) || state.betPresets[idx];
      });
    });
    root.querySelector('#hide-winning-hand').addEventListener('change', (e) => {
      state.hideWinningHandIfEveryoneFolded = e.target.checked;
    });

    root.querySelector('#start-btn').addEventListener('click', () => {
      if (state.smallBlind >= state.bigBlind) {
        state.smallBlind = Math.max(1, Math.floor(state.bigBlind / 2));
      }
      onStart({ ...state, opponents: state.opponents.map((o) => ({ ...o })) });
    });
  }

  render();
}
