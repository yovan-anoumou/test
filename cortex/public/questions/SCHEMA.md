# Format des questions

Chaque fichier `*.json` dans ce dossier contient un **tableau JSON** de
questions. Chaque question suit exactement ce schéma :

```json
{
  "id": "tage-calcul-046",
  "module": "tage2",
  "subtest": "calcul",
  "difficulty": 3,
  "type": "mcq",
  "passage": null,
  "statement": "Un article coûte 80€ après une réduction de 20%. Quel était son prix initial ?",
  "choices": ["96€", "100€", "104€", "112€"],
  "correctIndex": 1,
  "explanation": {
    "why_correct": "80€ correspond à 80% du prix initial (100% - 20%). Prix initial = 80 / 0,8 = 100€.",
    "why_others_wrong": [
      "Erreur classique : ajouter 20% de 80€ au lieu de diviser par 0,8.",
      "",
      "Erreur d'arrondi ou de calcul intermédiaire incorrect.",
      "Confusion entre une réduction de 20% et une majoration de 40%."
    ],
    "method": "Face à une réduction de x%, le prix final = prix initial × (1 - x/100). Toujours diviser, jamais multiplier par (1+x%), pour remonter au prix initial."
  },
  "targetTimeSeconds": 90,
  "tags": ["pourcentages", "prix"]
}
```

## Champs

| Champ | Type | Description |
|---|---|---|
| `id` | `string` | Identifiant unique, kebab-case. Doit être unique **dans toute l'app**, pas seulement dans le fichier (utilise un préfixe propre à ton fichier, ex. `mon-ajout-001`). |
| `module` | `string` | Un de : `tage2`, `anglais`, `culture-generale`, `raisonnement`, `calcul-mental`. |
| `subtest` | `string` | Un de : `lexiphrase`, `calcul`, `logique-verbale-numerique`, `paratexte`, `logique-spatiale`, `vocabulaire`, `grammaire`, `comprehension`, `culture-generale`, `raisonnement`, `calcul-mental`. |
| `difficulty` | `number` | Entier de 1 (très facile) à 5 (très difficile). |
| `type` | `string` | Toujours `"mcq"` pour l'instant (choix multiple). |
| `passage` | `string \| null` | Texte de contexte partagé par plusieurs questions (compréhension de texte, paratexte). `null` sinon. |
| `statement` | `string` | L'énoncé de la question. Les retours à la ligne (`\n`) sont supportés et affichés. |
| `choices` | `string[]` | Les options de réponse (4 recommandé). |
| `correctIndex` | `number` | Index (0-based) de la bonne réponse dans `choices`. |
| `explanation.why_correct` | `string` | Pourquoi la bonne réponse est correcte. |
| `explanation.why_others_wrong` | `string[]` | **Même longueur que `choices`**. Une explication précise pour chaque mauvaise réponse (pourquoi ce piège est faux), chaîne vide `""` à l'index de la bonne réponse. |
| `explanation.method` | `string` | L'astuce/méthode pour résoudre ce type de question rapidement. |
| `targetTimeSeconds` | `number` | Temps cible en secondes pour répondre (affiché comme chronomètre pendant la session). |
| `tags` | `string[]` | Étiquettes libres pour affiner les statistiques (ex. `["pourcentages", "prix"]`). |

## Ajouter tes propres questions

1. Crée un fichier `.json` contenant un tableau de questions suivant ce
   schéma (tu peux copier un fichier existant comme modèle).
2. Vérifie-le avec `npm run validate:questions` (le script scanne tous les
   fichiers de ce dossier, y compris les tiens si tu les ajoutes ici).
3. Deux façons de les intégrer à l'app :
   - **Ajout permanent au fichier existant du sous-test** : ouvre le fichier
     `.json` correspondant (ex. `tage-calcul.json` pour ajouter des questions
     de calcul) et ajoute tes objets au tableau. Relance `npm run dev` ou
     `npm run build` : Vite sert le dossier `public/` tel quel, aucune autre
     modification n'est nécessaire.
   - **Import depuis l'app, sans toucher au code** : va dans
     *Réglages → Questions personnalisées → Importer un fichier de
     questions*, et sélectionne ton fichier `.json`. Les questions sont
     stockées séparément (dans le navigateur), fusionnées avec la banque
     livrée, et une carte de révision (FSRS) est créée automatiquement pour
     chacune. C'est la méthode la plus simple si tu ne veux pas toucher au
     dépôt de code.

Créer un **nouveau** sous-test (au-delà des 11 existants) demande en plus une
petite modification de `src/domain/modules.ts` (ajouter l'entrée dans
`SUBTESTS`) — plus avancé, à faire uniquement si tu veux une vraie nouvelle
catégorie plutôt que d'enrichir une catégorie existante.

Les questions importées depuis l'app ne touchent jamais aux fichiers de ce
dossier — elles sont sauvegardées à part, et incluses dans l'export/import
de données depuis Réglages (indirectement : la sauvegarde exporte les cartes
et l'historique, pas les questions elles-mêmes — garde donc aussi une copie
de tes fichiers `.json` ajoutés).
