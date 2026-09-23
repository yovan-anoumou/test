# Format des fiches mémo

Une fiche est un objet JSON. Chaque fichier `public/fiches/*.json` contient un
**tableau** de fiches. Les fichiers chargés sont ceux listés dans
`FICHE_DOMAINS[...].files` (voir `src/domain/fiches/types.ts`) — ajouter un
fichier sans le déclarer là ne le chargera pas.

Valide toujours après modification :

```bash
npm run validate:fiches
```

## Champs

| Champ | Type | Obligatoire | Rôle |
|---|---|---|---|
| `id` | `string` (minuscules, chiffres, tirets) | oui | Identifiant stable. **Ne jamais le renommer** : il sert d'URL (`#/fiche/<id>`), de cible de `related`, et de clé de la progression de lecture. |
| `domain` | l'un des 8 domaines | oui | `calcul`, `logique`, `vitesse`, `anglais`, `vocabulaire`, `comprehension`, `culture-generale`, `methode`. |
| `category` | `string` | oui | Sous-catégorie affichée comme regroupement dans la liste du domaine (ex. `Pourcentages`). |
| `title` | `string` | oui | Titre court de la notion. |
| `tagline` | `string` | oui | Le **« à retenir »** : une phrase qu'on doit pouvoir redire de mémoire. |
| `level` | `fondamental` \| `intermediaire` \| `avance` | oui | Niveau, sert de filtre. |
| `readMinutes` | `number` (1–20) | oui | Temps de lecture estimé. |
| `tags` | `string[]` | oui | **Le lien avec les QCM.** Doivent reprendre les tags réels de la banque de questions. |
| `related` | `string[]` | oui (peut être vide, mais 2 à 6 c'est mieux) | Ids d'autres fiches à relier (« À relier avec »). |
| `subtests` | `SubtestId[]` | non | Sous-tests concernés, pour cibler un entraînement. |
| `updatedAt` | `AAAA-MM-JJ` | **oui dès qu'un contenu peut vieillir** | Date de vérification (chiffre, dirigeant, composition d'une institution, actualité…). |
| `blocks` | `FicheBlock[]` | oui | Le corps de la fiche, dans l'ordre d'affichage. |

### Les tags : pourquoi ils comptent

Les boutons **Me tester / Question rapide / Question difficile** d'une fiche
tirent dans les questions dont au moins un tag est aussi un tag de la fiche. La
maîtrise affichée sur la fiche est calculée sur ces mêmes questions. Un tag
inventé casse donc les deux : `npm run validate:fiches` avertit pour toute fiche
dont aucun tag n'existe dans `public/questions/*.json`.

Pour lister les tags disponibles :

```bash
node -e "const fs=require('fs');const t=new Set();for(const f of fs.readdirSync('public/questions').filter(f=>f.endsWith('.json')))for(const q of JSON.parse(fs.readFileSync('public/questions/'+f,'utf8')))q.tags.forEach(x=>t.add(x));console.log([...t].sort().join('\n'))"
```

## Blocs disponibles

```jsonc
{ "type": "rule",     "title": "Explication", "body": "…" }
{ "type": "keyfacts", "title": "Les 3 cas",   "items": ["…", "…"] }
{ "type": "example",  "title": "Exemple",     "prompt": "Énoncé…", "reveal": "Solution détaillée…" }
{ "type": "mnemonic", "title": "Astuce",      "body": "…" }
{ "type": "warning",  "body": "Le piège classique : …" }
{ "type": "table",    "title": "Comparatif",  "headers": ["A", "B"], "rows": [["…", "…"]] }
{ "type": "diagram",  "kind": "series-method" }   // ou reasoning-types, percent-chain
{ "type": "quote",    "body": "…" }
{ "type": "quiz",     "question": "…", "answer": "…", "hint": "…" }  // hint optionnel
```

- `example` masque `reveal` derrière « Voir la solution » : l'utilisateur doit
  tenter avant de lire.
- `quiz` masque `answer` derrière « Voir la réponse » et propose une
  auto-évaluation (« J'avais juste » / « J'avais faux ») qui alimente la
  maîtrise de la fiche.
- Les `rows` d'un `table` doivent toutes avoir autant de cellules que `headers`.

## Structure attendue d'une fiche

Une fiche utile suit cette trame (les titres des blocs `rule` la matérialisent) :

1. **À retenir** → le champ `tagline`.
2. **Explication** → un ou deux blocs `rule`.
3. **Exemple** → un bloc `example` (ou `table` / `keyfacts` quand c'est une liste).
4. **Piège classique** → un bloc `warning`.
5. **Astuce** → un bloc `mnemonic`.
6. **À relier avec** → le champ `related`.
7. **Mini-question** → un bloc `quiz`, en dernier.
8. **Niveau** → le champ `level`.

## Règles de contenu

- **Ne rien inventer.** Une règle fausse est pire que pas de fiche : elle
  s'apprend et se retient. En cas de doute, ne pas écrire la fiche.
- **Dater ce qui vieillit.** Tout chiffre, classement, dirigeant ou composition
  d'institution → `updatedAt`, et formuler de façon à ce que le vieillissement
  soit visible (« au 1er janvier 2026… ») plutôt que masqué.
- **Séparer le stable de l'actualité.** Les mécanismes (ce qu'est l'inflation,
  comment fonctionne la BCE) vont dans les domaines de fond ; les chiffres
  conjoncturels sont soit évités, soit explicitement datés.
- **Qualité avant quantité.** Une fiche qui n'apporte rien de plus qu'une autre
  ne doit pas exister : mieux vaut enrichir l'existante.
