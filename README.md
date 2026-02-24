# Memories — Notre Tableau Partagé

Whiteboard infini en temps réel pour **2 personnes**.
Dessine sur ton iPhone, appuie sur Envoyer → le dessin apparaît en fond d'écran de verrouillage sur le téléphone de l'autre.

## Fonctionnalités

- Canvas infini (pan 2 doigts, pinch-to-zoom, molette desktop)
- Dessin fluide au doigt optimisé tactile iOS
- Limité à **2 utilisateurs** par session (privé)
- Bouton **Envoyer** 📩 : capture le canvas et l'envoie à l'autre
- **Notification** quand l'autre reçoit le dessin (navigateur + Pushcut)
- **Raccourci iOS** automatique : met le dessin en fond d'écran de verrouillage
- PWA : ajouter sur l'écran d'accueil iOS pour une expérience native
- Dark mode automatique pour l'interface

## Codes de session

- `28473`
- `59016`
- `73142`

## Lancer le projet

```bash
npm install
npm start
# → http://localhost:3000
```

## Utilisation sur iPhone

1. Ouvrir l'URL du serveur dans Safari
2. Tap **Partager** → **Sur l'écran d'accueil** (PWA)
3. Entrer ton pseudo + code secret
4. Dessiner avec le doigt, pan 2 doigts, pinch zoom
5. Tap **📩** pour envoyer le dessin

## Configuration des Webhooks (Notifications Push → Fond d'écran)

### 1. Installer Pushcut sur les 2 iPhones

- Télécharger [Pushcut](https://apps.apple.com/app/pushcut/id1450936447) sur l'App Store
- Créer un compte sur chaque téléphone
- Créer une notification nommée **"NouveauDessin"** sur chaque téléphone
- Copier les Webhook URLs

### 2. Configurer les variables d'environnement du serveur

```bash
# Webhook URL Pushcut pour la personne A (appelé quand B envoie)
PUSHCUT_WEBHOOK_A=https://api.pushcut.io/CLEF_A/notifications/NouveauDessin

# Webhook URL Pushcut pour la personne B (appelé quand A envoie)
PUSHCUT_WEBHOOK_B=https://api.pushcut.io/CLEF_B/notifications/NouveauDessin

# URL publique du serveur (pour que Pushcut puisse télécharger l'image)
PUBLIC_URL=https://ton-serveur.onrender.com
```

### 3. Créer le Raccourci iOS (Shortcuts)

Sur **chaque iPhone**, créer ce raccourci :

1. **Ouvrir l'app Raccourcis**
2. **Nouveau raccourci** nommé "Fond d'écran Memories"
3. Ajouter l'action : **Obtenir le contenu de l'URL**
   - URL : `https://ton-serveur.com/api/latest-drawing/28473`
   - Méthode : GET
4. Ajouter l'action : **Définir le fond d'écran**
   - Écran : Écran de verrouillage
   - Image : résultat de l'étape précédente

### 4. Automatiser via Pushcut

Dans Pushcut, configurer la notification "NouveauDessin" :

- Action : **Exécuter le raccourci** → "Fond d'écran Memories"
- Cocher **Exécuter automatiquement** (nécessite Pushcut Automation Server ou l'app en arrière-plan)

## Déploiement (Render)

1. Créer un compte sur [render.com](https://render.com)
2. Nouveau → Web Service → lier le dépôt Git
3. Build Command : `npm install`
4. Start Command : `npm start`
5. Ajouter les variables d'environnement (PUSHCUT_WEBHOOK_A, PUSHCUT_WEBHOOK_B, PUBLIC_URL)

## Architecture technique

- **Serveur** : Node.js + Express + Socket.io
- **Client** : Vanilla JS + Canvas API + Pointer Events
- **PWA** : Service Worker + Web App Manifest
- **Notifications** : Pushcut webhooks → iOS Shortcuts
- **Stockage** : JSON local (ou PostgreSQL si `DATABASE_URL` est défini)

## Notes

- Les traits sont conservés en mémoire côté serveur
- Si `DATABASE_URL` est défini, les traits sont stockés dans PostgreSQL
- Sinon, sauvegarde automatique toutes les 3 minutes dans `data/strokes-<code>.json`
- Les dessins envoyés sont sauvegardés dans `data/drawings/latest-<code>.png`

## Maintenance

```bash
MAINTENANCE_MODE=true
MAINTENANCE_CODE=78913
MAINTENANCE_MESSAGE="Maintenance en cours"
```
En maintenance, utiliser pseudo `admin` + code `78913`.

---

> Projet maintenu avec ❤️ par Henergyque
> 
<!-- v2 -->
