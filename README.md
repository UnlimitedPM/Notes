# Notes — réplique web de l'app Notes MIUI / HyperOS

PWA de notes et de tâches, look **AMOLED noir + accent ambre**, calquée sur l'application
Notes des Redmi/Xiaomi. Fonctionne sur Android, iPhone et ordinateur, hors ligne.

Réglages mesurés directement sur l'écran du téléphone (Redmi Note 11S, 1080×2400, densité 2.75).

## Écrans

| Écran | Détails |
| --- | --- |
| **Notes** | Recherche, chips de catégories, grille 2 colonnes, vignettes d'images, dates « 12:12 / Hier 18:51 / 6 Novembre » |
| **Tâches** | Liste de tâches autonome (séparée des notes), édition sur place, ajout rapide par panneau |
| **Note** | Lecture puis édition au toucher : annuler / rétablir / valider, texte + cases mélangés |
| **Format** | Barre défilante (ordre du téléphone) : Surligner · H1 · H2 · H3 · Gras · Italique · Barré · Puces · Numérotation · Effacer, avec états actifs |
| **Sélection** | Appui long : sélection multiple, Tout sélectionner, Masquer / Épingler / Déplacer / Supprimer |
| **Dossiers** | Page dédiée (Tous, dossiers, Sans catégorie), compteurs, création, suppression |
| **Réglages** | Xiaomi Cloud, Style, Fonctionnalités rapides, Rappels, AUTRE — en-tête compact au défilement |
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
- **Sélection multiple** : appui long sur une carte, pastilles de sélection, actions en bas.
- **Titre de secours** : sans titre, la première ligne du texte devient le titre de la carte.
- **Dates** : heure pour aujourd'hui, `Hier HH:MM`, sinon jour + mois capitalisé.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173 (exposé sur le réseau local)
npm run check
npm run build
npm run preview
```

`dist/` est statique. L'installation PWA exige HTTPS (sauf localhost).

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
