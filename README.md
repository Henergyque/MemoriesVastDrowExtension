Whiteboard infini en temps réel (desktop)

Fonctionnalités
- Canvas infini blanc (pan: clic droit, zoom: molette)
- Dessin temps réel entre utilisateurs
- Trois sessions fixes avec codes à 5 chiffres
- Limite 100 utilisateurs par session
- Panneau bas gauche transparent (liste des pseudos, palette, réglages)
- Tutoriel via icône “?”
- Zéro effacement (archive des traits)

Codes de session
- 28473
- 59016
- 73142

Lancer le projet
1) Installer les dépendances: npm install
2) Démarrer: npm start
3) Ouvrir localhost:3000

Utilisation rapide
- Saisir un pseudo et un code
- Dessiner: clic gauche + glisser
- Pan: clic droit + glisser
- Zoom: molette

Notes
- Les traits sont conservés en mémoire côté serveur.
- Si DATABASE_URL est défini, les traits sont stockés dans PostgreSQL (table strokes).
- Sinon, sauvegarde automatique toutes les 3 minutes dans data/strokes-<code>.json.

Maintenance
- MAINTENANCE_MODE=true pour activer la maintenance.
- MAINTENANCE_CODE=78913 pour autoriser un accès (bypass).
- MAINTENANCE_MESSAGE="Maintenance en cours" pour le message côté client.
- En maintenance, utilise pseudo admin + code 78913.
