import './style.css';
import { Table } from './engine/table.js';
import { applyAction, getLegalActions, getTotalPot } from './engine/hand.js';
import { computeAIAction } from './ai/agent.js';
import { deriveSituation } from './coach/situationContext.js';
import { getLiveAdvice } from './coach/liveCoach.js';
import { analyzeHand } from './coach/postHandAnalysis.js';
import { CoachChat } from './coach/chatbot.js';
import { getApiConfig, setApiConfig } from './coach/apiConfigStore.js';
import { estimateEquity } from './ai/equity.js';
import { renderConfigScreen } from './ui/config.js';
import { TableView, fmtChips } from './ui/table.js';
import { animateBetsToPot, animatePotToWinners } from './ui/animations.js';
import { openHistoryDrawer, openChatDrawer, closeDrawers } from './ui/drawers.js';

const HUMAN_ID = 'human';
const app = document.getElementById('app');

const ACTION_LABELS = {
  fold: 'se couche',
  check: 'parole',
  call: 'suit',
  'small-blind': 'petite blinde',
  'big-blind': 'grosse blinde',
  raise: 'relance',
  'raise-allin-short': 'tapis'
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class App {
  constructor() {
    this.showConfig();
  }

  showConfig() {
    closeDrawers();
    renderConfigScreen(app, { onStart: (config) => this.startGame(config) });
  }

  startGame(config) {
    this.config = config;
    const seats = [
      { id: HUMAN_ID, name: 'Vous', avatar: '🧑', stack: config.startingStack },
      ...config.opponents.map((o, i) => ({
        id: `ai${i}`,
        name: o.name,
        avatar: o.avatar,
        stack: config.startingStack,
        level: o.level,
        personality: { aggression: (Math.random() - 0.5) * 0.5 }
      }))
    ];

    this.table = new Table({
      seats,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      blindIncreaseEveryHands: config.blindsProgressive ? config.blindIncreaseEveryHands : 0,
      blindIncreaseFactor: config.blindIncreaseFactor
    });

    this.hand = null;
    this.coachEnabled = true;
    this.decisionLog = [];
    this.lastActions = {};
    this.equities = null;
    this.overlay = null;
    this.chatMessages = [
      { role: 'coach', text: "Salut ! Je suis votre coach. Posez-moi une question a tout moment, meme pendant un coup." }
    ];
    this.chat = new CoachChat({ getApiConfig });

    app.innerHTML = '';
    this.view = new TableView(app, {
      onFold: () => this.humanAct({ type: 'fold' }),
      onCheck: () => this.humanAct({ type: 'check' }),
      onCall: () => this.humanAct({ type: 'call' }),
      onRaise: (amount) => this.humanAct({ type: 'raiseTo', amount }),
      onToggleCoach: () => {
        this.coachEnabled = !this.coachEnabled;
        this.render();
      },
      onToggleHistory: () => this.openHistory(),
      onToggleChat: () => this.openChat(),
      onCoachDetail: () => this.showCoachDetail(),
      onContinue: () => this.nextHand(),
      onShowAnalysis: () => this.showAnalysis(),
      onCloseOverlay: () => this.closeOverlayToResult(),
      onRestart: () => this.showConfig()
    });

    this.startHand();
  }

  startHand() {
    this.hand = this.table.startNextHand();
    this.decisionLog = [];
    this.lastActions = {};
    this.equities = null;
    this.overlay = null;
    this.boardLenAtLastAction = this.hand.board.length;
    this.render();
    this.step();
  }

  async step() {
    if (!this.hand || this.hand.complete) {
      await this.onHandComplete();
      return;
    }
    const currentId = this.hand.toActQueue[0];
    if (!currentId) return;

    if (currentId === HUMAN_ID) {
      this.render();
      return; // wait for the human to click an action button
    }

    await delay(550 + Math.random() * 500);
    if (!this.hand || this.hand.complete) return;

    const seat = this.table.seats.find((s) => s.id === currentId);
    const { action, decision } = computeAIAction(this.hand, currentId, {
      level: seat.level,
      personality: seat.personality
    });
    this.applyAndLog(currentId, action, decision);
    this.render();
    this.step();
  }

  humanAct(action) {
    if (!this.hand || this.hand.complete) return;
    if (this.hand.toActQueue[0] !== HUMAN_ID) return;
    const situation = deriveSituation(this.hand, HUMAN_ID);
    this.decisionLog.push({ street: this.hand.street, situation, actionTaken: action });
    this.applyAndLog(HUMAN_ID, action);
    this.render();
    this.step();
  }

  applyAndLog(playerId, action) {
    const seat = this.table.seats.find((s) => s.id === playerId);
    try {
      applyAction(this.hand, playerId, action);
    } catch (err) {
      console.error('Illegal action attempted', playerId, action, err);
      return;
    }
    const label = ACTION_LABELS[action.type === 'raiseTo' ? (this.hand.history[this.hand.history.length - 1]?.type || 'raise') : action.type] || action.type;
    this.lastActions = { [playerId]: label + (action.amount ? ` ${fmtChips(action.amount)}` : '') };
  }

  async onHandComplete() {
    if (!this.hand || !this.hand.complete || this.overlay) return;

    if (this.hand.board.length > this.boardLenAtLastAction && this.hand.results.showdown) {
      await this.revealRunout();
    }

    await animateBetsToPot(app);
    const winnerIds = [...new Set(this.hand.results.pots.flatMap((p) => p.winners.map((w) => w.id)))];
    await animatePotToWinners(app, winnerIds);

    const pots = this.hand.results.pots.map((pot) => ({
      amount: pot.amount,
      winners: pot.winners.map((w) => {
        const seat = this.table.seats.find((s) => s.id === w.id);
        return { name: seat.name, avatar: seat.avatar, amount: w.amount, category: w.category };
      })
    }));

    this.overlay = {
      type: 'hand-result',
      showdown: this.hand.results.showdown,
      pots,
      canShowAnalysis: this.decisionLog.length > 0
    };
    this.render();
  }

  async revealRunout() {
    const activeIds = this.hand.players.filter((p) => !p.folded).map((p) => p.id);
    if (activeIds.length < 2) return;
    const finalBoard = this.hand.board;
    let start = this.boardLenAtLastAction;
    if (start < 3) start = 0; // preflop all-in: reveal the flop as one block, then turn, then river
    for (let len = Math.max(start, 3); len <= finalBoard.length; len++) {
      const boardSoFar = finalBoard.slice(0, len);
      const equities = {};
      for (const id of activeIds) {
        const player = this.hand.players.find((p) => p.id === id);
        equities[id] = estimateEquity({
          holeCards: player.holeCards,
          board: boardSoFar,
          numOpponents: activeIds.length - 1,
          iterations: 300
        });
      }
      this.equities = equities;
      this.equityBoardOverride = boardSoFar;
      this.render();
      await delay(900);
    }
    this.equities = null;
    this.equityBoardOverride = null;
  }

  nextHand() {
    this.overlay = null;
    this.table.settleHand();
    if (this.table.isGameOver()) {
      const humanSeat = this.table.seats.find((s) => s.id === HUMAN_ID);
      const won = !humanSeat.eliminated && this.table.activeSeats().length === 1 && this.table.activeSeats()[0].id === HUMAN_ID;
      this.overlay = {
        type: 'game-over',
        won,
        message: won
          ? 'Vous avez elimine tous vos adversaires !'
          : humanSeat.eliminated
          ? 'Vous avez ete elimine. Retentez votre chance !'
          : 'La partie est terminee.'
      };
      this.hand = null;
      this.render();
      return;
    }
    this.startHand();
  }

  showAnalysis() {
    const entries = analyzeHand(this.decisionLog);
    this.overlay = { type: 'analysis', entries, _back: this.overlay };
    this.render();
  }

  closeOverlayToResult() {
    this.overlay = this.overlay?._back || null;
    this.render();
  }

  showCoachDetail() {
    const advice = getLiveAdvice(this.hand, HUMAN_ID);
    if (!advice) return;
    alert(
      `${advice.action.toUpperCase()}${advice.raiseTo ? ' a ' + fmtChips(advice.raiseTo) : ''}\n\n` +
        `Equite estimee: ${Math.round(advice.equity * 100)}%\n` +
        `Cote du pot exigee: ${Math.round(advice.requiredEquity * 100)}%\n\n` +
        advice.reasoning
    );
  }

  openHistory() {
    const entries = (this.hand?.history || []).map((h) => ({
      street: h.street,
      name: this.table.seats.find((s) => s.id === h.playerId)?.name || h.playerId,
      label: ACTION_LABELS[h.type] || h.type,
      amount: h.amount || null
    }));
    openHistoryDrawer(entries);
  }

  openChat() {
    this.chatUi = openChatDrawer({
      messages: this.chatMessages,
      onSend: async (text) => {
        const reply = await this.chat.ask(text, this.hand, HUMAN_ID);
        return reply;
      },
      apiConfig: getApiConfig(),
      onSaveApiConfig: (cfg) => {
        setApiConfig(cfg);
        this.chatMessages.push({ role: 'coach', text: 'Configuration enregistree.' });
        this.chatUi?.renderMessages();
      }
    });
  }

  buildSeatsViewModel() {
    const orderedTableSeats = this.table.seats;
    const humanIdx = orderedTableSeats.findIndex((s) => s.id === HUMAN_ID);
    const rotated = [];
    for (let i = 0; i < orderedTableSeats.length; i++) {
      rotated.push(orderedTableSeats[(humanIdx + i) % orderedTableSeats.length]);
    }

    return rotated.map((tableSeat) => {
      if (tableSeat.eliminated) {
        return { id: tableSeat.id, empty: true, sittingOut: true, name: tableSeat.name };
      }
      const handPlayer = this.hand ? this.hand.players.find((p) => p.id === tableSeat.id) : null;
      const isHuman = tableSeat.id === HUMAN_ID;
      const isActive = !!(this.hand && !this.hand.complete && this.hand.toActQueue[0] === tableSeat.id);

      let showCards = false;
      if (handPlayer) {
        if (isHuman) showCards = true;
        else if (this.hand.complete && this.hand.results?.showdown) showCards = true;
      }

      return {
        id: tableSeat.id,
        name: tableSeat.name,
        avatar: tableSeat.avatar,
        stack: handPlayer ? handPlayer.stack : tableSeat.stack,
        isHuman,
        isDealer: handPlayer ? handPlayer.isDealer : false,
        isActive,
        folded: handPlayer ? handPlayer.folded : false,
        betThisStreet: handPlayer ? handPlayer.contributedStreet : 0,
        holeCards: handPlayer ? handPlayer.holeCards : [],
        showCards,
        lastAction: this.lastActions[tableSeat.id] || null,
        equity: this.equities ? this.equities[tableSeat.id] : undefined
      };
    });
  }

  render() {
    if (!this.hand && !this.overlay) return;

    const humanTurn = !!(this.hand && !this.hand.complete && this.hand.toActQueue[0] === HUMAN_ID);
    let actionBar = null;
    if (humanTurn) {
      const legal = getLegalActions(this.hand, HUMAN_ID);
      actionBar = { ...legal, pot: getTotalPot(this.hand) };
    }

    const coachAdvice = this.coachEnabled && humanTurn ? getLiveAdvice(this.hand, HUMAN_ID) : null;

    const vm = {
      smallBlind: this.table.smallBlind,
      bigBlind: this.table.bigBlind,
      handNumber: this.table.handNumber,
      seats: this.buildSeatsViewModel(),
      board: this.equityBoardOverride || (this.hand ? this.hand.board : []),
      pot: this.hand ? getTotalPot(this.hand) : this.overlay?.type === 'hand-result' ? this.overlay.pots.reduce((s, p) => s + p.amount, 0) : 0,
      coachEnabled: this.coachEnabled,
      coachAdvice,
      actionBar,
      betPresets: this.config.betPresets,
      overlay: this.overlay
    };

    this.view.render(vm);
  }
}

new App();
