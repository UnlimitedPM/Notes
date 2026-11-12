# Notes — réplique web de l'app Notes MIUI / HyperOS

PWA de notes et de tâches, look **AMOLED noir + accent ambre**, calquée sur l'application
Notes des Redmi/Xiaomi. Fonctionne sur Android, iPhone et ordinateur, hors ligne.

Réglages mesurés directement sur l'écran du téléphone (Redmi Note 11S, 1080×2400, densité 2.75).

## Écrans

| Écran | Détails |
| --- | --- |
| **Notes** | Recherche, chips de catégories, grille 2 colonnes, vignettes d'images, dates « 12:12 / Hier 18:51 / 6 Novembre » |
| **Tâches** | Liste de tâches autonome (séparée des notes), recherche, édition sur place, ajout rapide par panneau |
| **Note** | Lecture puis édition au toucher : annuler / rétablir / valider, texte + cases mélangés, croquis, note vocale, image |
| **Format** | Barre défilante (ordre du téléphone) : Surligner · H1 · H2 · H3 · Gras · Italique · Barré · Puces · Numérotation · Effacer, avec états actifs |
| **Sélection** | Appui long : sélection multiple, Tout sélectionner, Masquer / Épingler / Déplacer / Supprimer |
| **Dossiers** | Page dédiée (Tous, dossiers, Sans catégorie), compteurs, création, suppression |
| **Réglages** | Xiaomi Cloud, Style, Fonctionnalités rapides, Rappels, AUTRE (corbeille, notes masquées, thème, export / import JSON) — en-tête compact au défilement |
| **Corbeille** | Restauration et suppression définitive |

## Mécaniques fidèles

- **Cases à cocher dans le texte** : le bouton case transforme la ligne courante, on peut
  mélanger paragraphes et tâches. Entrée crée la sous-tâche suivante, un tap sur la case la coche.
- **Tâches séparées des notes** : l'onglet Tâches a sa propre liste, créée via le panneau
  « Appuyez sur Entrée pour créer des sous-tâches ». Une case ajoutée dans une note reste dans
  la note ; elle n'apparaît pas dans Tâches, et une tâche ne crée jamais de carte dans Notes.
  Les anciennes listes stockées comme notes sont migrées vers les tâches au premier lancement.
- **Formatage réversible** : chaque bouton s'active en ambre et se désactive au second appui,
  la sélection est préservée entre les appuis. Le surligneur agit aussi comme état de frappe :
  appuyer, écrire (le texte est surligné), réappuyer ou faire Entrée (la suite redevient normale).
  Même logique pour le barré.
- **Listes dans le texte** : puces (`•`) et liste numérotée (`1.`), conversion d'un type à l'autre
  en un tap, retour à une ligne normale en réappuyant sur le bouton ou via Entrée sur une puce vide.
- **Création rapide de tâche** : le + de l'onglet Tâches ouvre le panneau « Appuyez sur Entrée
  pour créer des sous-tâches » (rappel + Terminé) ; il ajoute des tâches, pas des notes.
  Entrée crée la tâche **et referme le panneau** : on ne reste pas en mode création.
- **Sélection multiple** : appui long sur une carte, pastilles de sélection, actions en bas.
- **Croquis** : canevas avec 6 couleurs, gomme et 3 épaisseurs, inséré comme image dans la note.
- **Note vocale** : enregistrement via `MediaRecorder`, lecteur audio intégré à la note.
- **Médias supprimables** : en édition, une pastille rouge est posée sur chaque image /
  note vocale. Comme le lecteur audio natif avale les appuis, la suppression passe aussi par
  `⋮` → *Supprimer la note vocale N* (ou *l'image N*), qui reste toujours accessible.
- **Rappel** : 1 h / ce soir / demain / date libre ; cloche + heure sur la carte. Il sonne tant que
  l'app est ouverte (les rappels garantis app fermée viendront avec le serveur et le push).
- **Partage** : texte, image PNG de la note, ou export Markdown (`.md`).
- **Restauration** : export / import JSON complet (notes, dossiers, tâches).
- **Titre de secours** : sans titre, la première ligne du texte devient le titre de la carte.
- **Dates** : heure pour aujourd'hui, `Hier HH:MM`, sinon jour + mois capitalisé.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173 (exposé sur le réseau local)
npm run check      # types + lint Svelte
npm test           # 63 tests (vitest + jsdom + fake-indexeddb)
npm run build
npm run preview
```

`dist/` est statique. L'installation PWA exige HTTPS (sauf localhost).

## Serveur de synchronisation (optionnel)

`server/` contient l'API auto-hébergeable (Fastify + SQLite + OIDC Keycloak) qui
permettra de retrouver les mêmes notes sur plusieurs appareils :
notes en Markdown, pièces jointes en fichiers, pierres tombales pour les suppressions,
détection de conflits par `updatedAt`.

```bash
cd server
cp .env.example .env      # OIDC_ISSUER + OIDC_CLIENT_ID
npm install
npm run dev               # http://localhost:8080
npm test                  # 18 tests
```

Détails (routes, configuration Keycloak, Docker, sauvegardes) : `docs/SERVEUR.md`.
La PWA n'est pas encore branchée dessus : connexion OIDC, moteur de synchro et bascule
du stockage en Markdown restent à faire.

## Tests

```
tests/
  fixtures.ts            réexporte la base de test de src/lib/testFixtures.ts
  setup.ts               fake-indexeddb (IndexedDB en mémoire)
  markdown.test.ts       conversion HTML → Markdown
  tasks.test.ts          lecture / coche / édition des lignes de cases
  format-media.test.ts   dates, texte brut, suppression des images et audios
  store.test.ts          base de test : import, corbeille, tri, rappels, dossiers
```

La **base de test** (`src/lib/testFixtures.ts`) contient une note avec un exemplaire de
tout (titres, gras/italique/barré/surligné, puces, numéros, cases, image, audio, rappel),
une note épinglée, une masquée, une à la corbeille et une vide, plus 2 dossiers et 2 tâches.
Elle sert aux tests **et** au bouton « Charger la base de test » des Réglages (visible en
développement uniquement).

## iPhone

Safari → Partager → **Sur l'écran d'accueil**. Barre d'état noire, plein écran.

## Structure

```
src/
  App.svelte                   routes accueil / note / réglages / corbeille / dossiers
  app.css                      thèmes, couleurs, feuilles, toast
  lib/
    types.ts                   modèle (notes, dossiers, préférences, tâches)
    db.ts                      IndexedDB
    notes.svelte.ts            état global, migration, tâches, dossiers
    tasks.ts                   lecture/écriture des lignes de cases dans le HTML
    format.ts                  dates FR, texte brut
    confirm.svelte.ts          confirmation interne (pas de confirm() natif)
    toast.svelte.ts            messages éphémères
    components/
      HomeScreen.svelte        onglets, recherche, chips, sélection, panneau de tâche
      NoteCard.svelte          carte, vignette, pastille de sélection
      TaskCard.svelte          tâche éditable
      EditorScreen.svelte      lecture/édition, cases inline, barre de format
      SettingsScreen.svelte    réglages
      FoldersScreen.svelte     dossiers
      TrashScreen.svelte       corbeille
      TabBar.svelte            Notes / Tâches
      Sheet.svelte             feuille du bas
      ConfirmDialog.svelte     carte de confirmation flottante
      Icon.svelte              icônes SVG
```

## Données

IndexedDB `notes-app` / store `notes`. Préférences et dossiers : `localStorage`
(`notes:theme`, `notes:sort`, `notes:textSize`, `notes:layout`, `notes:quickNotes`,
`notes:reminders`, `notes:showHidden`, `notes:tasks`, `notes:folders`, `notes:seed`).

Les listes d'avant la v0.3 (`kind: checklist`) sont converties en lignes de cases HTML au
premier lancement, sans perte de texte ni d'état coché.

## Limites volontaires

- Vocal et dessin : boutons présents, message « bientôt ».
- Rappels : réglage stocké, notification non planifiée.
- Cloud : page explicative, synchronisation auto-hébergée à venir.
- « Masquer » cache la note, réaffichable via Réglages → Afficher les notes masquées.
