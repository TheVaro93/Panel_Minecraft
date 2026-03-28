# Minecraft Bedrock Admin Panel

Panel web moderne pour administrer un serveur Minecraft Bedrock en direct.

Ce projet connecte une interface web a la console BDS via WebSocket et permet de:

- visualiser les logs en temps reel
- suivre les joueurs connectes
- envoyer des commandes
- bannir, expulser ou tuer un joueur depuis l'interface

---

## Apercu

Le projet est compose de:

- un backend Node.js qui lance `bedrock_server.exe` avec `node-pty`
- un serveur HTTP qui sert l'interface web
- un serveur WebSocket pour l'authentification et les commandes en direct
- un frontend HTML/CSS/JS avec ecran de connexion et console live

---

## Fonctionnalites

- Authentification simple par mot de passe
- Console live (stream des logs BDS)
- Detection des connexions/deconnexions joueurs
- Liste des joueurs en ligne
- Actions admin rapides: `Kick`, `Ban`, `Kill`
- Envoi de commandes brutes (console)
- Message global (`say`) depuis la barre de commande

---

## Prerequis

- Windows
- Node.js 18+
- Un serveur Minecraft Bedrock fonctionnel (`bedrock_server.exe`)

---

## Installation

1. Cloner le depot:

```bash
git clone https://github.com/TheVaro93/Pannel_du_seigneur_Gras.git
cd Pannel_du_seigneur_Gras
```

2. Installer les dependances:

```bash
npm install
```

3. Configurer le backend dans `server.js`:

- `CONFIG.port`
- `CONFIG.password`
- `CONFIG.bdsPath`

Exemple:

```js
const CONFIG = {
	port: 3000,
	password: "change-moi",
	bdsPath: "C:\\Serveur_Minecraft\\Minecraft-Server\\bedrock_server.exe",
};
```

---

## Lancer le projet

Option A (recommandee)

```bash
node server.js
```

Puis ouvrir:

- `http://localhost:3000`

Option B

- Lancer `start.bat` pour demarrer le serveur Node puis ouvrir automatiquement le navigateur.

---

## Utilisation

1. Ouvrir le panel dans le navigateur.
2. Entrer le mot de passe admin.
3. Surveiller les logs et les joueurs en ligne.
4. Utiliser:
- la barre principale pour envoyer un message global (`say`)
- la commande brute pour executer n'importe quelle commande Bedrock
- les boutons d'action pour `Kick` / `Ban` / `Kill`

---

## Structure du projet

```text
.
|- index.html      # Interface web
|- style.css       # Styles
|- login.js        # Logique frontend utilisee par index.html
|- script.js       # Ancienne version (non chargee par index.html)
|- server.js       # Backend HTTP + WebSocket + lancement BDS
|- start.bat       # Script de demarrage Windows
|- package.json
|- LICENSE
|- README.md
```

---

## Securite

Le mot de passe est actuellement defini en dur dans `server.js`.

Pour un usage en production, il est conseille de:

- utiliser une variable d'environnement pour le mot de passe
- activer HTTPS + WSS
- limiter l'acces au panel via firewall/VPN
- journaliser les actions admin

---

## Depannage rapide

- Erreur `BDS introuvable`:
	verifier le chemin `CONFIG.bdsPath`.
- Echec de connexion:
	verifier que `node server.js` tourne bien et que le port n'est pas bloque.
- Pas de logs dans la console:
	verifier que BDS demarre correctement et que `bedrock_server.exe` est executable.

---

## Roadmap (idees)

- gestion des whitelist/permissions
- historique des commandes admin
- mode multi-serveurs
- stats en temps reel (TPS, joueurs, uptime)
- configuration via `.env`

---

## Licence

Ce projet est sous licence MIT.
Voir [LICENSE](LICENSE).
