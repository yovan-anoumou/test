# CORTEX

**App en ligne : https://yovan-anoumou.github.io/test/** (ouvre ce lien sur
ton téléphone et ajoute-le à l'écran d'accueil pour l'installer en PWA).

Application web d'entraînement cognitif ciblé pour préparer le **TAGE 2 /
TAGE MAGE**, l'anglais (format TOEIC), la culture générale et le
raisonnement — en vue d'une admission en L3 IAE puis en master (SKEMA).

Ce n'est pas un jeu de brain-training : chaque exercice entraîne une
compétence réellement testée, avec trois méthodes validées par la
recherche :

- **Retrieval practice** — toujours un test, jamais une relecture passive.
- **Répétition espacée (FSRS)** — chaque question revient au moment optimal
  pour ta mémoire (modèle Difficulté / Stabilité / Récupérabilité), via
  [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs).
- **Interleaving** — les matières sont mélangées dans chaque session, jamais
  en blocs par thème.

En complément des QCM, l'onglet **Fiches mémo** propose des fiches de
référence (règles, exemples à révéler, astuces, pièges classiques, petits
diagrammes) pour découvrir ou consolider les bases avant de s'entraîner —
lecture active plutôt que passive, avec un renvoi direct vers une session de
QCM à la fin de chaque fiche. Contenu dans `src/domain/fiches/`.

## Le coach : diagnostic → plan → adaptation

- **Test de niveau** (`src/domain/diagnostic.ts`) — 24 questions réparties sur
  les 6 domaines, avec une difficulté qui monte après chaque réussite et
  redescend après chaque erreur. Précision et vitesse sont mesurées
  séparément : 80 % en prenant son temps ne vaut pas 80 % au rythme du
  concours.
- **Analyse** (`src/domain/skill-analysis.ts`) — maîtrise par domaine
  (précision pondérée par la difficulté + score de vitesse sur les réponses
  justes), niveau estimé, indice de confiance, points faibles au niveau des
  *tags* des questions, et type d'erreur déduit du distracteur choisi.
- **Plan personnalisé** (`src/domain/plan.ts`) — le temps hebdomadaire est
  réparti selon `déficit de maîtrise × importance du domaine pour l'objectif`,
  puis découpé en blocs quotidiens (dont un temps de révision des erreurs).
  Aucun domaine n'est abandonné : les acquis s'entretiennent.
- **Adaptation** (`src/services/planService.ts`) — le plan se réajuste tout
  seul dès qu'assez de nouvelles réponses ont été enregistrées : un domaine qui
  progresse laisse la place à celui qui bloque, avec un historique des
  ajustements consultable dans l'onglet Plan.
- **Mode apprentissage** — sans chrono pénalisant, avec indice, correction
  détaillée, lien vers la fiche mémo correspondante, et une question du même
  type enchaînée automatiquement après une erreur (erreur → explication →
  question similaire → nouvel essai).

L'app est 100% locale : aucune donnée ne quitte ton appareil, aucun
backend, aucun compte. Elle est installable en PWA et fonctionne hors ligne.

## Lancer l'app

Prérequis : Node.js 20+.

```bash
npm install
npm run dev       # serveur de développement (http://localhost:5173)
```

Pour une build de production (celle qui sera réellement installée en PWA) :

```bash
npm run build      # build dans dist/
npm run preview    # sert la build de production localement
```

Sur mobile, ouvre l'URL dans le navigateur puis utilise « Ajouter à l'écran
d'accueil » (Safari/Chrome) pour l'installer comme une app native. Une fois
installée, elle fonctionne sans connexion.

### Autres commandes utiles

```bash
npm run test                # tests unitaires (vitest) : moteur FSRS,
                             # session-builder, difficulté adaptative,
                             # estimation de score
npm run validate:questions  # valide toutes les banques de questions
                             # (public/questions/*.json) contre le schéma
npm run generate:icons      # régénère les icônes PWA (public/icons/)
```

## Architecture

```
src/
  db/            IndexedDB (idb) : schéma, repositories, seed des cartes
  fsrs/          Wrapper autour de ts-fsrs (notation, file de révision)
  domain/        Logique métier pure : compétences (6 domaines ↔ 11 sous-tests),
                 construction de session (interleaving), difficulté adaptative,
                 analyse des compétences, diagnostic, plan d'entraînement,
                 scoring, estimation de score TAGE 2, test blanc, fiches mémo
  services/      Orchestration (chargement et adaptation du plan)
  features/      Écrans (home, session, diagnostic, plan, mock-exam, dashboard,
                 historique, réglages, onboarding, fiches mémo)
  components/    UI partagée (navigation, timer, heatmap, graphique, barre de
                 maîtrise, icônes, diagrammes des fiches mémo)
public/
  questions/     Banque de questions (JSON), voir SCHEMA.md
  icons/         Icônes PWA
```

La banque de questions livrée contient **350 questions** réparties sur 11
sous-tests, chacune avec une correction complète (pourquoi la bonne réponse
est bonne, pourquoi chaque distracteur est faux, et une méthode/astuce pour
répondre vite).

## Ajouter tes propres questions

Voir [`public/questions/SCHEMA.md`](public/questions/SCHEMA.md) pour le
format exact et les deux façons de les ajouter (fichier JSON dans le dépôt,
ou import direct depuis l'app dans *Réglages*).

## Sauvegarder mes données

Toutes tes données (progression FSRS, historique de réponses, sessions,
tests blancs) sont stockées uniquement dans le navigateur (IndexedDB) —
rien n'est envoyé nulle part.

Pour ne rien perdre (changement d'appareil, réinstallation, nettoyage du
navigateur) : va dans **Réglages → Sauvegarde des données → Exporter mes
données**. Ça télécharge un fichier `cortex-backup-AAAA-MM-JJ.json`.

Pour restaurer : **Réglages → Restaurer une sauvegarde**, sélectionne le
fichier exporté. ⚠️ Ça remplace intégralement les données actuelles.

Pense à exporter régulièrement une sauvegarde, surtout avant de désinstaller
l'app ou de vider les données du navigateur.

## Stack technique

- [Preact](https://preactjs.com/) + [@preact/signals](https://preactjs.com/guide/v10/signals/) — UI légère, sans backend
- [idb](https://github.com/jakearchibald/idb) — wrapper IndexedDB
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — algorithme de répétition espacée FSRS
- [Vite](https://vite.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — build, manifest, service worker
- [Vitest](https://vitest.dev/) — tests unitaires de la logique métier
