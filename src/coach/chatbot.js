import { getLiveAdvice, actionLabel } from './liveCoach.js';

// Conversational coach. Two backends:
//  1. An external LLM (OpenAI-compatible /chat/completions endpoint) when
//     the user configured an API key in Options - the request is sent
//     directly from the browser (no backend needed), with the current
//     game state folded into the system prompt so answers stay grounded
//     in the actual hand being played.
//  2. A local, rule-based fallback built on the exact same equity/pot-odds
//     engine as the live coach, used automatically when no key is set or
//     the API call fails (offline-friendly, no external dependency).
//
// The API key is supplied by the user (Options screen), kept only in
// localStorage, sent only to the base URL the user configured, and never
// hardcoded here.

const GLOSSARY = [
  {
    match: /3.?bet/i,
    answer:
      "Un 3-bet est la deuxieme relance d'un tour d'encheres (le premier bet/la premiere mise compte pour 1, la relance qui suit est le \"2-bet\", et la relance de cette relance est le \"3-bet\"). En pratique on l'utilise surtout pour designer une relance apres une ouverture, typiquement pre-flop."
  },
  {
    match: /position (tardive|late)|jouer en position/i,
    answer:
      "En position tardive (bouton, cut-off), vous agissez apres la plupart des adversaires : vous avez plus d'information avant de decider, donc vous pouvez elargir votre selection de mains et bluffer plus souvent qu'en position precoce."
  },
  {
    match: /cote du pot|pot odds/i,
    answer:
      "La cote du pot compare ce que vous devez miser a ce que vous pouvez gagner : montant a suivre / (pot + montant a suivre). Si votre equite estimee (chances de gagner) est superieure a ce ratio, suivre est rentable sur la duree."
  },
  {
    match: /equit[ée]/i,
    answer:
      "L'equite est la probabilite estimee que votre main gagne le coup si toutes les cartes restantes etaient revelees, calculee ici par simulation Monte Carlo (des milliers de tirages aleatoires des cartes inconnues)."
  },
  {
    match: /bluff/i,
    answer:
      "Bluffer consiste a miser/relancer avec une main faible pour faire coucher de meilleures mains. Un joueur expert le fait a une frequence calculee pour rester imprevisible (equilibre value/bluff), jamais au hasard."
  }
];

function buildGameContextText(situation) {
  if (!situation) return "Aucune main n'est en cours actuellement.";
  const holeStr = situation.holeCards.map((c) => `${c.rank}${c.suit}`).join(' ');
  const boardStr = situation.board.length ? situation.board.map((c) => `${c.rank}${c.suit}`).join(' ') : '(pas encore de board)';
  return [
    `Rue actuelle: ${situation.street}`,
    `Mes cartes: ${holeStr}`,
    `Board: ${boardStr}`,
    `Pot: ${situation.pot}`,
    `Montant a suivre: ${situation.toCall}`,
    `Adversaires encore en jeu: ${situation.numOpponents}`
  ].join('\n');
}

export class CoachChat {
  constructor({ getApiConfig }) {
    this.getApiConfig = getApiConfig; // () => { apiKey, baseUrl, model } | null
  }

  async ask(userMessage, handState, playerId) {
    const advice = handState ? getLiveAdvice(handState, playerId) : null;
    const apiConfig = this.getApiConfig ? this.getApiConfig() : null;

    if (apiConfig && apiConfig.apiKey) {
      try {
        return await this.askLLM(userMessage, advice, apiConfig);
      } catch (err) {
        return `${this.askFallback(userMessage, advice)}\n\n(Info: l'appel a l'API a echoue - ${err.message} - reponse generee localement a la place.)`;
      }
    }
    return this.askFallback(userMessage, advice);
  }

  async askLLM(userMessage, advice, apiConfig) {
    const systemPrompt = [
      "Tu es un coach de poker Texas Hold'em, concis, pedagogue, en francais.",
      'Voici le contexte reel de la main en cours (utilise-le pour repondre precisement):',
      buildGameContextText(advice ? advice.situation : null),
      advice
        ? `Recommandation calculee par le moteur: ${actionLabel(advice.action)} (equite ${Math.round(advice.equity * 100)}%, cote du pot exigeant ${Math.round(advice.requiredEquity * 100)}%). Raison: ${advice.reasoning}`
        : ''
    ].join('\n');

    const res = await fetch(`${apiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 350,
        temperature: 0.4
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('reponse vide');
    return content;
  }

  askFallback(userMessage, advice) {
    for (const entry of GLOSSARY) {
      if (entry.match.test(userMessage)) return entry.answer;
    }

    if (!advice) {
      return "Il n'y a pas de decision en cours pour ce coup. Posez-moi une question de strategie generale, ou attendez que ce soit votre tour !";
    }

    const eqPct = Math.round(advice.equity * 100);
    const reqPct = Math.round(advice.requiredEquity * 100);

    if (/pourquoi/i.test(userMessage)) {
      return `${advice.reasoning} (equite estimee: ${eqPct}%, cote du pot exigeant ${reqPct}%.)`;
    }
    if (/cote|odds/i.test(userMessage)) {
      return `Il faut ${advice.situation.toCall} de jetons pour suivre un pot de ${advice.situation.pot}. Cote du pot: vous avez besoin d'au moins ${reqPct}% d'equite pour que suivre soit rentable. Votre equite estimee ici est ${eqPct}%.`;
    }
    if (/quoi faire|que faire|je fais quoi|conseil/i.test(userMessage)) {
      return `Je recommande: ${actionLabel(advice.action)}${advice.raiseTo ? ` (vers ${advice.raiseTo})` : ''}. ${advice.reasoning}`;
    }

    return `D'apres le calcul (equite ${eqPct}% vs ${reqPct}% requis), l'action recommandee est: ${actionLabel(advice.action)}${advice.raiseTo ? ` a ${advice.raiseTo}` : ''}. ${advice.reasoning}`;
  }
}
