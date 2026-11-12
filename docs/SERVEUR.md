# Serveur de synchronisation (auto-hébergeable)

Fastify + SQLite + OIDC (Keycloak). Il ne sert que l'API : la PWA reste un fichier
statique. Objectif : **les mêmes notes sur plusieurs appareils**, sans dépendre d'un
service tiers.

## Ce qui existe aujourd'hui

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/health` | sonde de vie (sans jeton) |
| `GET` | `/v1/me` | identité issue du jeton |
| `GET` | `/v1/notes?since=<curseur>&limit=200` | notes modifiées depuis le curseur, **tombstones comprises** |
| `PUT` | `/v1/notes/:id` | écriture idempotente ; `409 { conflict, note }` si le serveur est plus récent |
| `DELETE` | `/v1/notes/:id` | pierre tombale (les autres appareils la voient passer) |
| `GET` | `/v1/folders?since=…` | dossiers |
| `PUT` | `/v1/folders/:id` | création / renommage |
| `DELETE` | `/v1/folders/:id` | pierre tombale |
| `POST` | `/v1/attachments` | corps binaire, dédupliqué par SHA-256 → `{ hash, url }` |
| `GET` | `/v1/attachments/:hash` | sert l'image / la note vocale |

- **Isolation** : tout est indexé par `user_id` (le `sub` du jeton). Deux comptes ne
  voient jamais les notes de l'autre, et une pièce jointe n'est servie qu'à son
  propriétaire.
- **Conflits** : `updatedAt` (horloge client) arbitre ; le serveur renvoie `409` avec
  sa version pour que le client crée une copie « (conflit) » au lieu d'écraser.
- **Suppression** : jamais de `DELETE` physique immédiat → une note supprimée sur un
  appareil disparaît aussi sur les autres.
- **Rapidité** : SQLite en WAL, requêtes préparées, index sur `(user_id, server_updated_at)`.
- **Fiabilité** : écritures atomiques pour les pièces jointes (fichier temporaire + rename),
  arrêt propre sur SIGINT/SIGTERM, `busy_timeout` pour éviter les verrous bloquants.

Tests : `cd server && npm test` (18 tests, faux jeton, aucune dépendance à Keycloak).

## Keycloak

1. Console Keycloak → **Clients** → *Create client*
   - Client type : **OpenID Connect**
   - Client ID : `notes-pwa` (ou ce que tu veux → `OIDC_CLIENT_ID`)
   - Capability : **public** (pas de secret : c'est une SPA, on utilise **PKCE**)
2. Onglet **Settings**
   - *Valid redirect URIs* : `https://notes.example.com/*` (+ `http://localhost:5173/*` pour le dev)
   - *Web origins* : `https://notes.example.com` (+ `http://localhost:5173`)
3. Récupère l'**issuer** : `https://sso.example.com/realms/<realm>` → `OIDC_ISSUER`.

Le serveur valide la signature via le JWKS de Keycloak (`/protocol/openid-connect/certs`,
mis en cache), puis `iss`, puis `aud` si `OIDC_AUDIENCE` est défini — sinon il vérifie
`azp === OIDC_CLIENT_ID` (comportement Keycloak pour un client public).

## Lancer

```bash
cd server
cp .env.example .env      # renseigne OIDC_ISSUER et OIDC_CLIENT_ID
npm install
npm run dev               # http://localhost:8080
```

Vérification rapide :

```bash
curl localhost:8080/health
curl -H "Authorization: Bearer <jeton>" localhost:8080/v1/notes
```

Avec Docker (depuis la racine du dépôt) :

```bash
# .env à la racine avec OIDC_ISSUER / OIDC_CLIENT_ID / CORS_ORIGIN
docker compose up -d --build
```

Les données vivent dans le volume `notes-data` (`notes.db` + `attachments/`).

## Sauvegarde

SQLite en mode WAL : **copier `notes.db` ne suffit pas**. Utilise :

```bash
sqlite3 data/notes.db ".backup 'backup-$(date +%F).db'"
tar czf attachments-$(date +%F).tgz data/attachments
```

Un cron quotidien + rétention suffit. Sans ça, un disque perdu = tout perdu.

## Ce qui reste à brancher côté PWA

1. ✅ **Connexion OIDC** (Authorization Code + PKCE) : Réglages → Synchronisation.
   Jetons en localStorage, rafraîchissement automatique avant expiration.
2. ✅ **Moteur de synchro** : file d'attente IndexedDB (`outbox`), push `PUT`/`DELETE`,
   pull `?since=` avec curseur persisté, rejeu, indicateur « Synchronisé / n en attente /
   Hors ligne / Erreur », conflits conservés en copie « (conflit) ».
3. ✅ **Markdown dans les données** : chaque note garde son `md` (recalculé à chaque
   enregistrement) ; c'est lui qui part au serveur, celui qui est exporté, et celui qui
   est re-rendu en HTML à l'arrivée. Aller-retour couvert par des tests
   (`html → md → html → md` stable, notes vocales comprises).

Reste à faire (incréments suivants) :

- **Pièces jointes en fichiers** : les images/audios sont encore en `data:` dans le
  Markdown. L'API `POST /v1/attachments` est prête ; il faut, à l'envoi, extraire les
  `data:` URL, les téléverser et réécrire le Markdown avec `/v1/attachments/<hash>`.
- **Dossiers et tâches** : les notes synchronisent leur `folderId`, mais les dossiers et
  les tâches restent locaux (localStorage). L'API dossiers existe déjà.
- **Suppression serveur** : « Supprimer les notes dans le cloud » n'est pas encore câblé.

