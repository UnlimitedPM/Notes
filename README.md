# Notes — réplique web de l'app Notes MIUI / HyperOS

PWA de notes et de tâches au look **AMOLED noir + accent ambre**, calquée sur l'application
Notes des Redmi/Xiaomi, utilisable aussi sur iPhone et sur ordinateur.

Données 100 % locales pour l'instant (IndexedDB), aucune requête réseau.

## Écrans

| Écran | Détails |
| --- | --- |
| **Notes** | Titre fin, grille à deux colonnes, cartes arrondies, FAB ambre, onglets Notes / Tâches |
| **Tâches** | Toutes les cases à cocher de toutes les listes, éditables sur place, terminées repliables |
| **Note (lecture)** | Grand titre, date + nombre de caractères, partage, style, menu |
| **Note (édition)** | Touchez le texte : annuler / rétablir / valider en haut, barre outil en bas (vocal, image, dessin, liste, texte) |
| **Réglages** | Cloud, taille du texte, tri, disposition, notes rapides, rappels, thème, corbeille, export |
| **Dossiers** | Création, filtre de l'accueil, déplacement des notes via l'appui long |

## Fonctionnalités

- Thème système / clair / sombre, avec noir pur en sombre.
- 8 couleurs de note (cartes et fond de l'éditeur teintés).
- Mise en forme : gras, italique, souligné, barré, surlignage, titres, listes, effacer.
- Notes texte ⇄ listes de cases à cocher, avec annuler/rétablir.
- Recherche tolérante aux accents et à la ponctuation (accents, tirets).
- Épinglage, duplication, corbeille avec restauration, tri, disposition grille/liste.
- Taille du texte réglable (petite, moyenne, grande).
- Insertion d'images (base64 dans la note).
- Export JSON de toutes les notes et dossiers.
- PWA hors ligne (service worker), installation iOS/Android.
- Écran d'accueil, paramètres, corbeille : esthétique reprise des captures fournies.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173 (accessible sur le réseau local)
```

```bash
npm run check      # svelte-check
npm run build      # dist/ + service worker
npm run preview
```

`dist/` est un site statique. Le service worker (installation PWA) exige HTTPS, sauf en
local.

## Installer sur iPhone

Safari → Partager → **Sur l'écran d'accueil**. L'app s'ouvre alors en plein écran avec la
barre d'état noire.

## Structure

```
src/
  App.svelte                    navigation accueil / note / réglages / corbeille
  app.css                       thèmes, couleurs de notes, feuilles, toast
  lib/
    types.ts                    modèle (notes, listes, dossiers, préférences)
    db.ts                       persistance IndexedDB
    notes.svelte.ts             état global (runes), tâches, dossiers, préférences
    format.ts                   dates françaises, texte brut, échappement
    toast.svelte.ts             notifications éphémères
    components/
      HomeScreen.svelte         onglets Notes/Tâches, grille, FAB, dossiers
      NoteCard.svelte           carte de note (appui long = actions)
      TaskCard.svelte           tâche éditable sur place
      EditorScreen.svelte       lecture + édition d'une note
      SettingsScreen.svelte     réglages fidèles à la capture
      TrashScreen.svelte        corbeille
      TabBar.svelte             barre Notes / Tâches
      Sheet.svelte              feuille modale
      Icon.svelte               icônes SVG maison
```

## Données

IndexedDB `notes-app` / store `notes`. Préférences et dossiers dans `localStorage`
(`notes:theme`, `notes:sort`, `notes:textSize`, `notes:layout`, `notes:quickNotes`,
`notes:reminders`, `notes:folders`, `notes:seed`).

Au premier lancement, cinq notes d'exemple sont créées (dont une liste « À faire » qui
alimente l'onglet Tâches). Elles peuvent être supprimées, le jeu d'exemple ne revient pas.

## À venir

- **Cloud auto-hébergé** : petite API (Node/Fastify ou FastAPI + SQLite), synchronisation
  par `updatedAt` puis journal de modifications, Docker + HTTPS.
- Notes vocales et dessin (boutons déjà présents, actuellement en « bientôt »).
- Rappels réels et notifications.
- Import JSON, verrouillage par empreinte.

## Limites connues

- Le vocal et le dessin sont des emplacements réservés.
- Pas de widgets ni de partage système avancé.
- L'appui long sur mobile déclenche aussi le menu contextuel du navigateur sur certains
  appareils, sans conséquence.
