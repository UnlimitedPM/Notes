# Notes — réplique web de l'app Notes MIUI / HyperOS

Application de notes et de listes en PWA, pensée pour remplacer l'application **Notes** des
téléphones Redmi/Xiaomi tout en fonctionnant aussi sur iPhone (et sur ordinateur).

- Interface sombre/clair automatique, sans framework UI externe.
- Données **100 % locales** (IndexedDB) : rien ne quitte l'appareil pour l'instant.
- Installable sur l'écran d'accueil iOS/Android (mode plein écran).

## Fonctionnalités

- Accueil en grille à deux colonnes, notes épinglées en premier.
- Recherche instantanée (insensible aux accents et à la ponctuation : « wifi » trouve « Wi-Fi »).
- Notes texte avec mise en forme (gras, italique, souligné, barré, surlignage, titres, listes).
- Listes de cases à cocher (ajout avec Entrée, suppression avec Retour arrière, coche animée).
- Conversion note ⇄ liste en un appui.
- 8 couleurs de note, épinglage, duplication, corbeille avec restauration.
- Tri par modification, création ou titre.
- Insertion d'images (stockées dans la note).
- Sauvegarde automatique (debounce 250 ms), y compris en quittant l'écran.
- Mode hors ligne complet via service worker (PWA).
- Thème système / clair / sombre.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

Le serveur écoute sur le réseau local (`host: true`) : ouvrez l'adresse affichée depuis le
téléphone pour tester sur l'appareil.

## Compiler

```bash
npm run check      # svelte-check
npm run build      # génère dist/ + service worker
npm run preview    # sert dist/ localement
```

`dist/` est un site statique : n'importe quel hébergeur (Nginx, Caddy, GitHub Pages, Vercel…)
fonctionne. Le service worker exige **HTTPS** (ou localhost) pour activer l'installation PWA.

## Installer sur iPhone

1. Ouvrir l'application dans **Safari** (obligatoire pour l'installation iOS).
2. Bouton Partager → **Sur l'écran d'accueil**.
3. L'application s'ouvre ensuite en plein écran, sans barre d'adresse.

## Structure

```
src/
  App.svelte                 navigation (accueil / éditeur / corbeille)
  app.css                    thèmes, couleurs de notes, feuilles du bas
  lib/
    types.ts                 modèle de données
    db.ts                    persistance IndexedDB
    notes.svelte.ts          état global (runes Svelte 5), recherche, seed
    format.ts                dates FR, texte brut, échappement HTML
    components/
      HomeScreen.svelte      grille, recherche, menus
      NoteCard.svelte        carte de note + appui long
      EditorScreen.svelte    éditeur texte / liste, mise en forme, couleurs
      TrashScreen.svelte     corbeille
      Sheet.svelte           feuille modale réutilisable
      Icon.svelte            icônes SVG intégrées
```

## Données

Tout est stocké dans IndexedDB (`notes-app` / store `notes`), plus deux préférences dans
`localStorage` (`notes:theme`, `notes:sort`). Aucune requête réseau n'est effectuée.

Au premier lancement, quelques notes d'exemple sont créées (dont une note d'accueil) : elles
peuvent être supprimées, elles ne reviendront pas.

## Prochaines étapes (cloud auto-hébergé)

Le modèle est déjà prêt pour la synchronisation :

1. Petit serveur (Node/Fastify ou FastAPI) exposant `GET /notes?since=` et `POST /notes`.
2. Base SQLite ou PostgreSQL, un utilisateur = un espace.
3. Stratégie simple : `updatedAt` + résolution dernier-écrit-gagne, ou journal de deltas.
4. Authentification par jeton, déploiement Docker + HTTPS.
5. L'app reste fonctionnelle hors ligne et pousse les changements en différé.

## Limitations connues

- Pas encore de dossiers, d'étiquettes visibles, de rappels ni de dessin manuscrit.
- Le presse-papiers riche (collage depuis Word) dépend du navigateur.
- Pas de verrouillage par empreinte (à faire côté serveur/appareil).
