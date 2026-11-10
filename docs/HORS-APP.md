# Notes — ce qui manque encore

> Note hors application (document de travail).
> Audit fait le 10/11/2026 en comparant l'app MIUI Notes du téléphone (Redmi Note 11S,
> MIUI 14 / Android 13) avec notre PWA, écran par écran.

---

## 1. Audit express : MIUI vs nous

| Écran / fonction | MIUI (relevé sur le téléphone) | Nous | État |
| --- | --- | --- | --- |
| Liste des notes | titre, recherche, chips, grille 2 colonnes, vignettes | identique | ✅ |
| Carte | fond `#242424`, titre gras, 3 lignes d'aperçu, date, note colorée claire | identique | ✅ |
| Menu d'une note (`⋮`) | Rappel, Masquer, Placer sur l'écran d'accueil, Déplacer vers, Supprimer | Épingler, Dossier, Dupliquer, Supprimer | ⚠️ partiel |
| Partage | texte / image / Markdown | texte / image / Markdown | ✅ |
| Éditeur | voix, image, croquis, case, barre T | identique | ⚠️ voix + croquis factices |
| Barre T | surligneur, H1-H3, B, I, croix (+ nos puces, numéros, barré, effacer) | identique + 4 outils | ✅ |
| Cases à cocher dans le texte | oui | oui | ✅ |
| Tâches | onglet séparé, ajout rapide, terminées | identique + **recherche** (bonus) | ✅ |
| Dossiers | Tous / dossiers / Sans catégorie + compteurs + **corbeille** dans l'en-tête | identique, mais corbeille dans Réglages | ⚠️ |
| Sélection multiple | « 1 élément sélectionné », pastilles rondes, 4 actions | identique | ✅ |
| Notes masquées | via « Masquer » | bascule d'affichage dans Réglages | ⚠️ |
| Réglages | Cloud (2), Style (3), Notes rapides (2), Rappels (1), Confidentialité | identique + Corbeille, Masquées, Thème, Export | ✅ |
| Taille du texte | Petite / Moyenne / Grande | identique | ✅ |
| Tri | date de création / date de modification | + tri par titre | ✅ |
| Disposition | grille / liste | identique | ✅ |
| Rappel dans une note | oui (date + heure) | ❌ | 🔨 interne |
| Croquis / dessin | vrai canevas (note « Dessins ») | toast « bientôt » | 🔨 interne |
| Note vocale | vrai enregistreur | toast « bientôt » | 🔨 interne + serveur |
| Placer sur l'écran d'accueil | raccourci système | ❌ | 🌍 externe |
| Notes rapides (panneau latéral, URL copiées) | natif MIUI | ❌ | 🌍 externe |
| Xiaomi Cloud | synchro cloud | ❌ | 🌍 externe |

**Corrigé pendant cet audit** : la version affichée dans Réglages était figée à `0.3.0`
(elle vient maintenant de `package.json`), et l'app demande au navigateur de ne plus
évincer ses données (`navigator.storage.persist()`).

---

## 2. Manques sans cause externe (à coder, rien ne bloque)

1. **Croquis** : canevas + `PointerEvent`, gomme, couleurs, export PNG stocké comme image.
2. **Note vocale** : `MediaRecorder`, lecteur intégré, durée, suppression.
3. **Rappel dans une note** : date + heure, affichage d'un badge, annulation.
4. **Corbeille depuis l'écran Dossiers** (comme MIUI) au lieu des Réglages seulement.
5. **Import JSON** : l'export existe, l'import n'existe pas (restauration complète).
6. **Fusion des doublons de code** : `kind: 'checklist'` (ancien modèle) encore dans les types.

---

## 3. Manques d'origine **externe** (le cœur de cette note)

### 3.1 Synchronisation entre appareils — nécessite un serveur
Une PWA est un client : elle ne peut pas être son propre serveur. Sans backend, les
notes restent dans l'IndexedDB d'un seul navigateur (et peuvent être évincées).

Ce qu'il faut construire :

- **API** : `GET /v1/notes?since=<timestamp>`, `PUT /v1/notes/:id` (idempotent),
  `DELETE /v1/notes/:id` (tombstone), `POST /v1/attachments`, `GET /v1/attachments/:hash`.
- **Authentification** : soit un simple **token d'appareil** (mono-utilisateur,
  auto-hébergé, le plus simple), soit comptes + `argon2` + JWT en cookie `HttpOnly`.
- **Résolution de conflits** : `updatedAt` + `rev` par note ; « dernier qui écrit gagne »
  et copie « (conflit) » si deux appareils ont divergé. Les suppressions restent en
  tombstone 30 jours pour ne pas ressusciter une note.
- **File d'attente hors-ligne** : outbox dans IndexedDB, rejeu avec backoff exponentiel,
  marqueur `syncedAt` par note.
- **Temps réel** : SSE (`Last-Event-ID`) ou WebSocket pour voir la note changer ailleurs.
- **Pièces jointes** : sortir les images/audios du HTML (aujourd'hui en `data:` URL, ce qui
  gonfle chaque note) → stockage objet, URL stable, cache.
- **Sauvegardes** : dump SQLite quotidien + rétention, sinon un disque perdu = tout perdu.

Impact côté app : `notes.svelte.ts` devient « local + distant », `saveNotes()` alimente
l'outbox, et l'écran Réglages gagne un état (« Synchronisé / 3 en attente / Hors ligne »).

### 3.2 Rappels et notifications — nécessite Web Push + ordonnanceur
Le web ne peut pas réveiller une app fermée. Il faut :

- clés **VAPID**, abonnement `PushManager.subscribe`, endpoint stocké côté serveur ;
- un **service worker** qui gère `push` et `notificationclick` (ouvrir la bonne note) ;
- un **ordonnanceur** (cron) qui envoie la notification à l'heure dite, avec fuseau horaire ;
- « Rappels de haute priorité » (sonner malgré le mode silencieux) : **impossible en web**,
  c'est un réglage système Android.

Limite : sur **iOS**, le push n'existe que pour une PWA **installée** (iOS 16.4+), et il
n'y a pas de rappel garanti si l'app est fermée depuis longtemps.

### 3.3 Notes vocales / dessins — stockage externe nécessaire
L'enregistrement (`MediaRecorder`) et le dessin (`canvas`) sont faisables dans le
navigateur, mais un blob lourd ne survit pas à un nettoyage de données : il faut
l'envoyer au serveur (3.1). iOS n'enregistre qu'en `mp4/aac`, pas en `webm`.
Transcription automatique = service externe (Whisper) ou serveur puissant.

### 3.4 Recevoir un partage depuis une autre app — Web Share Target
C'est l'équivalent web de « Notes rapides » : `share_target` dans le manifeste +
gestionnaire dans le service worker pour recevoir texte / URL / image.
**Android + Chrome uniquement** (PWA installée), rien sur iOS ni sur desktop.

### 3.5 Panneau latéral MIUI et « extraits de rappels » — natif, sans équivalent
Le raccourci de bord et la surveillance du presse-papier sont des privilèges système.
Au mieux : raccourcis PWA (`shortcuts` du manifeste) et partage entrant (3.4).
Lire le presse-papier sans geste de l'utilisateur est interdit par les navigateurs.

### 3.6 Chiffrement / verrouillage biométrique — partiellement externe
`WebAuthn` peut verrouiller l'interface et redemander l'empreinte, mais une vraie
protection des données suppose un chiffrement dont la clé ne vit pas sur l'appareil
(sinon on ne protège que l'affichage).

### 3.7 Hébergement, mises à jour, sauvegardes — externalité d'exploitation
Il faut quelque part qui serve le `dist/` en HTTPS avec un certificat valide (obligatoire
pour le service worker, le partage et le presse-papier), plus une CI qui publie, plus
des sauvegardes du serveur.

---

## 4. Nouveaux outils à ajouter au projet

### 4.1 Client (dans le projet actuel)
| Outil | Rôle |
| --- | --- |
| `idb` | wrapper IndexedDB propre (files d'attente, migrations de schéma) |
| `minisearch` | recherche locale instantanée quand on dépasse ~1 000 notes |
| `jszip` | export/import complet `.zip` (notes + images + audio) |
| `msw` | simuler l'API de synchro dans les tests et en dev |
| `@playwright/test` | tests de bout en bout, dont clavier virtuel / viewport 393×872 |
| `vitest` + `@testing-library/svelte` | tests unitaires (markdown, tri, conflits) |
| `prettier` + `eslint` (+ `eslint-plugin-svelte`) | style et erreurs courantes |
| `lighthouse-ci` | seuil PWA / performance à chaque PR |
| `jspdf` *(optionnel)* | export PDF propre, si demandé |

### 4.2 Serveur (nouveau dossier `server/`)
| Outil | Rôle |
| --- | --- |
| `hono` (ou `fastify`) | API HTTP légère, TypeScript, déployable partout |
| `better-sqlite3` | base locale, un seul fichier à sauvegarder |
| `drizzle-orm` + `drizzle-kit` | schéma typé + migrations versionnées |
| `zod` | validation des payloads entrants |
| `jose` + `argon2` | JWT / hash des mots de passe (si comptes) |
| `web-push` | envoi des notifications VAPID |
| `node-cron` (ou `bullmq` + `redis` si volume) | ordonnanceur des rappels |
| `sharp` | redimensionner/compresser les images reçues |
| `pino` | logs structurés |
| `caddy` (Docker) | HTTPS automatique en frontal |
| `minio` (Docker) ou dossier + `rclone` | stockage des pièces jointes |

### 4.3 Exploitation
| Outil | Rôle |
| --- | --- |
| `docker-compose.yml` | api + caddy + minio en une commande |
| `GitHub Actions` | build, tests, publication du `dist/` |
| `Uptime Kuma` | supervision (API, certificat, sauvegardes) |
| `restic` / `sqlite3 .backup` | sauvegarde quotidienne chiffrée |
| `.env.example` + `docs/INSTALL.md` | installation reproductible |

### 4.4 Plus tard, si le web ne suffit plus
| Outil | Pourquoi |
| --- | --- |
| `@capacitor/core` + `@capacitor/local-notifications`, `@capacitor/share` | rappels fiables, partage entrant iOS, micro |
| ou `Tauri 2` (mobile) | même base Svelte, binaire natif, plus léger |

---

## 5. Ordre conseillé

1. Finir les manques internes (croquis, vocal, rappel, import JSON, corbeille dans Dossiers).
2. Poser le **serveur de synchro** (3.1) : c'est le socle de tout le reste.
3. Brancher **push + rappels** (3.2).
4. Déplacer images/audio vers le stockage de pièces jointes (3.1 + 3.3).
5. Ajouter le **partage entrant** et les raccourcis PWA (3.4).
6. Industrialiser : CI, HTTPS, sauvegardes, supervision (3.7).
