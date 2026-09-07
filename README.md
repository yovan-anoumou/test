# Poker Trainer

Une table de poker Texas Hold'em No Limit pour s'entrainer seul contre des
IA, dans le navigateur. 100% gratuit, sans argent reel, sans mise, sans
compte. Le style visuel s'inspire du "look" generique d'une table de poker
en ligne moderne (feutre vert, bandeaux joueurs flottants, bouton donneur
dore, barre de mise rouge) mais n'utilise ni le nom ni le logo ni aucun
asset d'un produit commercial existant.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrez l'URL affichee (par defaut http://localhost:5173). Tout tourne
cote client - aucun backend n'est necessaire pour jouer.

Pour lancer les tests du moteur de jeu :

```bash
npm test
```

Pour un build de production statique :

```bash
npm run build
npm run preview
```

## Configurer le coach chatbot (optionnel)

Le coach chatbot fonctionne sans rien configurer (reponses generees
localement a partir du meme calcul d'equite/cotes du pot que le coach en
direct). Si vous voulez des reponses plus naturelles/ouvertes, vous pouvez
brancher un vrai LLM :

1. Ouvrez le panneau "Chat" pendant une partie.
2. Depliez "Configurer une API LLM (optionnel)".
3. Renseignez une Base URL compatible OpenAI (`/chat/completions`), votre
   cle API personnelle, et le nom du modele.
4. Cliquez "Enregistrer".

La cle est stockee uniquement dans le `localStorage` de votre navigateur,
n'est jamais integree au code, et n'est envoyee qu'a la base URL que vous
avez vous-meme configuree.

## Choix techniques

- **JS vanilla en modules ES + Vite**, pas de framework UI. Le projet est
  assez cadre par le moteur de jeu et son etat pour ne pas avoir besoin de
  React/Vue : moins de dependances, demarrage instantane, code plus facile
  a suivre de bout en bout pour ce cas d'usage.
- **Aucun backend requis.** Le moteur de jeu et les IA tournent entierement
  dans le navigateur. Le seul appel reseau optionnel est celui du chatbot
  vers une API LLM externe si vous en configurez une.
- **Coach chatbot** : integration directe depuis le navigateur vers un
  point de terminaison compatible OpenAI (`/chat/completions`), car cela ne
  demande aucun serveur intermediaire et fonctionne avec de nombreux
  fournisseurs (OpenAI, et tout service compatible). Un mode de secours
  base sur le meme moteur de calcul (equite + cotes du pot) prend le relais
  automatiquement si aucune cle n'est configuree ou si l'appel echoue -
  l'app reste utile 100% hors-ligne.
- **Moteur de jeu** isole dans `src/engine/` (deck, evaluateur de mains,
  side pots, machine a etats des encheres, orchestrateur multi-mains),
  independant de l'UI et des IA - il est directement teste par `npm test`.
- **IA adverses** (`src/ai/`) basees sur une estimation d'equite par
  simulation Monte Carlo (`src/ai/equity.js`) comparee aux cotes du pot,
  et non sur des regles fixes. Trois niveaux (Debutant/Intermediaire/
  Expert) obtenus en faisant varier des parametres de comportement
  (tolerance aux mauvaises cotes, frequence de bluff, precision du sizing,
  prise en compte de la position) sur ce meme calcul.
- **Coach** (`src/coach/`) partage volontairement le meme moteur de calcul
  (`coachEngine.js`) entre le coach en direct, le chatbot et l'analyse
  post-main, pour que les trois donnent toujours le meme avis sur une
  meme situation.

## Structure du projet

```
src/
  engine/     moteur de poker pur (regles, mises, side pots, mains)
  ai/         equite Monte Carlo, decision par niveau, personnalites
  coach/      moteur de coaching partage, coach direct, chatbot, analyse post-main
  ui/         rendu DOM (table, cartes SVG, config, animations, panneaux)
  main.js     orchestration de l'application (boucle de jeu)
tests/        tests du moteur (Vitest), incluant des simulations IA vs IA
```

## Tests

`npm test` execute :

- l'evaluateur de mains (toutes les categories, y compris la quinte
  basse As-2-3-4-5) ;
- le calcul des side pots (paliers multiples, joueurs couches) ;
- la machine a etats des encheres (relance minimale, tapis courts qui ne
  rouvrent pas les encheres, ordre d'action heads-up, distribution des
  pots a l'abattage) ;
- des simulations IA vs IA (30 mains, tables de 2 a 9 joueurs, tous
  niveaux d'IA melanges) qui verifient qu'aucun jeton n'est jamais perdu
  et qu'aucune main ne bloque.

## Fonctionnalites

- Regles completes du Texas Hold'em No Limit (2 a 9 joueurs, side pots,
  blindes progressives optionnelles, bouton donneur, heads-up correct).
- Ecran de configuration : nombre et niveau des IA (individuellement),
  tapis de depart, blindes et cadence de progression, noms/avatars,
  8 tailles de mise predefinies configurables.
- Table façon table de poker en ligne moderne : feutre vert en degrade,
  bandeaux joueurs flottants, bouton donneur, jeu de cartes SVG maison,
  halo sur le joueur actif, barre d'action avec bouton de mise minimum en
  un clic, saisie manuelle, 8 presets et curseur.
- IA a trois niveaux distincts bases sur une vraie equite Monte Carlo.
- Coach en direct (activable/desactivable), chatbot conversationnel,
  analyse post-main detaillee rue par rue.
- Reveal d'equite en temps reel lors d'un tapis, historique des actions,
  option pour cacher ses mains gagnantes si tout le monde s'est couche.
