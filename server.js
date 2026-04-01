// ============================================================
// server.js — Backend du Panel Minecraft BDS
// ============================================================
// Ce fichier fait 3 choses :
//   1. Lance BDS.exe comme un processus enfant (node-pty)
//   2. Crée un serveur WebSocket pour parler avec le navigateur
//   3. Gère l'authentification par mot de passe
// ============================================================

const http = require("http");        // Module HTTP natif de Node.js
const fs = require("fs");            // Pour lire des fichiers (index.html)
const path = require("path");        // Pour gérer les chemins de fichiers
const { WebSocketServer } = require("ws");   // Bibliothèque WebSocket
const pty = require("node-pty");     // Pour lancer BDS comme un vrai terminal
require("dotenv").config();          // Charge les variables d'environnement depuis .env

// ============================================================
// CONFIGURATION — Variables d'environnement + valeurs par défaut
// ============================================================
const DEFAULT_CONFIG = {
  port: 3000,
  password: "admin$$",
  bdsPath: "C:\\Serveur_Minecraft\\Minecraft-Server\\bedrock_server.exe",
};

const CONFIG = {
  port: Number(process.env.PORT || DEFAULT_CONFIG.port),
  password: process.env.PANEL_PASSWORD || DEFAULT_CONFIG.password,
  bdsPath: process.env.BDS_PATH || DEFAULT_CONFIG.bdsPath,
};

if (!CONFIG.password) {
  console.error("[Panel] Variable manquante: PANEL_PASSWORD");
  process.exit(1);
}

if (!CONFIG.bdsPath) {
  console.error("[Panel] Variable manquante: BDS_PATH");
  process.exit(1);
}

if (!Number.isInteger(CONFIG.port) || CONFIG.port < 1 || CONFIG.port > 65535) {
  console.error("[Panel] PORT invalide: utilise un entier entre 1 et 65535");
  process.exit(1);
}
// ============================================================
// SERVEUR HTTP — Sert le fichier index.html quand on visite
//               http://localhost:3000 dans le navigateur
// ============================================================
const httpServer = http.createServer((req, res) => {
  const reqPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
  }[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Fichier introuvable");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

// ============================================================
// LANCEMENT DE BDS — On démarre BDS.exe comme un terminal
// node-pty simule un vrai terminal (stdin/stdout)
// ============================================================
let bdsPty = null; // On stocke le processus BDS ici
let playerListInterval = null;

function stripAnsiAndControls(input) {
  return String(input || "")
    // ANSI CSI sequences.
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // Single-char ANSI sequences.
    .replace(/\u001b[@-_]/g, "")
    // Other non-printable controls except new lines and tabs.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function clearPlayerListInterval() {
  if (playerListInterval) {
    clearInterval(playerListInterval);
    playerListInterval = null;
  }
}

function startPlayerListPolling() {
  if (playerListInterval) return;
  playerListInterval = setInterval(() => {
    requestPlayerList();
  }, 5000);
}

function requestPlayerList() {
  if (!bdsPty) return;
  // Bedrock accepte la commande sans slash en console.
  bdsPty.write("list\r");
}

function extractPlayersFromListResponse(data) {
  const cleaned = stripAnsiAndControls(data);
  if (!cleaned || !/players online/i.test(cleaned)) {
    return null;
  }

  const line = cleaned
    .split(/\r?\n/)
    .map((chunk) => chunk.trim())
    .find((chunk) => /players online/i.test(chunk));

  if (!line) return null;

  const match = line.match(/players online:\s*(.*)$/i);
  if (!match) return null;

  const rawNames = (match[1] || "").trim();
  if (!rawNames) return [];

  return rawNames
    .split(",")
    .map((name) => stripAnsiAndControls(name).trim())
    .filter(Boolean);
}

function broadcastPlayerList(players) {
  const message = JSON.stringify({ type: "playerList", players });
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

function startBDS() {
  console.log("[Panel] Démarrage de BDS...");

  if (!fs.existsSync(CONFIG.bdsPath)) {
    const message = `[Panel] BDS introuvable: ${CONFIG.bdsPath}`;
    console.error(message);
    broadcastLog(`\n${message}\n`);
    return;
  }

  try {
    // pty.spawn = lancer un programme comme si c'était dans un terminal
    bdsPty = pty.spawn(CONFIG.bdsPath, [], {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: path.dirname(CONFIG.bdsPath), // Le dossier où se trouve BDS.exe
      env: process.env,
    });
  } catch (error) {
    const message = `[Panel] Erreur au demarrage BDS: ${error.message}`;
    console.error(message);
    broadcastLog(`\n${message}\n`);
    bdsPty = null;
    return;
  }

  // Quand BDS écrit quelque chose dans sa console → on le stocke
  bdsPty.onData((data) => {
    const cleanedData = stripAnsiAndControls(data);
    if (cleanedData.trim()) {
      broadcastLog(cleanedData); // On envoie à tous les navigateurs connectés
    }

    const players = extractPlayersFromListResponse(cleanedData);
    if (players) {
      broadcastPlayerList(players);
    }
  });

  // Si BDS s'arrête (crash ou stop)
  bdsPty.onExit(({ exitCode }) => {
    console.log(`[Panel] BDS s'est arrêté (code ${exitCode})`);
    broadcastLog(`\n[Panel] BDS arrêté (code ${exitCode})\n`);
    clearPlayerListInterval();
    broadcastPlayerList([]);
    bdsPty = null;
  });

  requestPlayerList();
  startPlayerListPolling();
}

// ============================================================
// WEBSOCKET — Communication temps réel entre Node.js et
//             le navigateur. Comme un chat en direct.
// ============================================================
const wss = new WebSocketServer({ server: httpServer });

wss.on("error", (error) => {
  // Evite un crash si le serveur HTTP remonte EADDRINUSE.
  if (error && error.code === "EADDRINUSE") {
    return;
  }

  console.error(`[Panel] Erreur WebSocket: ${error.message}`);
});

// Liste des connexions authentifiées
const clients = new Set();

// Envoyer un message à TOUS les navigateurs connectés
function broadcastLog(text) {
  const message = JSON.stringify({ type: "log", text });
  clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN (connecté)
      client.send(message);
    }
  });
}

// Quand un navigateur se connecte au WebSocket
wss.on("connection", (ws) => {
  console.log("[Panel] Nouveau client connecté");
  let authenticated = false; // Par défaut, pas encore authentifié

  // Quand on reçoit un message du navigateur
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw); // Les messages sont en JSON
    } catch {
      return; // Message invalide, on ignore
    }

    // --- CAS 1 : Authentification ---
    if (msg.type === "auth") {
      if (msg.password === CONFIG.password) {
        authenticated = true;
        clients.add(ws);
        ws.send(JSON.stringify({ type: "auth", success: true }));
        console.log("[Panel] Client authentifié");

        // Si BDS tourne pas encore, on le lance
        if (!bdsPty) startBDS();
        requestPlayerList();
      } else {
        ws.send(JSON.stringify({ type: "auth", success: false }));
        console.log("[Panel] Mauvais mot de passe");
      }
      return;
    }

    // Les actions suivantes nécessitent d'être authentifié
    if (!authenticated) return;

    // --- CAS 2 : Envoyer une commande à BDS ---
    if (msg.type === "command" && bdsPty) {
      // En console Bedrock, les commandes se tapent sans '/'.
      let command = msg.command.trim();
      if (command.startsWith("/")) {
        command = command.slice(1);
      }
      if (!command) return;
      bdsPty.write(command + "\r"); // \r = Entrée
    }

    // --- CAS 2B : Envoyer une commande brute telle qu'écrite ---
    if (msg.type === "raw_command" && bdsPty) {
      const command = String(msg.command || "").trim();
      if (!command) return;
      bdsPty.write(command + "\r");
    }

    // --- CAS 3 : Kick un joueur ---
    if (msg.type === "kick" && bdsPty) {
      bdsPty.write(`/kick "${msg.player}"\r`);
    }

    // --- CAS 4 : Ban un joueur ---
    if (msg.type === "ban" && bdsPty) {
      bdsPty.write(`/ban "${msg.player}"\r`);
    }
  });

  // Quand le navigateur se déconnecte
  ws.on("close", () => {
    clients.delete(ws);
    console.log("[Panel] Client déconnecté");
  });
});
// ============================================================
// DÉMARRAGE — On lance le serveur HTTP sur le port 3000
// ============================================================
let currentPort = CONFIG.port;

httpServer.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    if (currentPort >= 65535) {
      console.error("[Panel] Aucun port disponible entre la valeur de depart et 65535.");
      process.exit(1);
    }

    currentPort += 1;
    console.warn(`[Panel] Port occupe, tentative sur ${currentPort}...`);
    setTimeout(() => {
      httpServer.listen(currentPort);
    }, 150);
    return;
  }

  console.error(`[Panel] Erreur serveur HTTP: ${error.message}`);
  process.exit(1);
});

httpServer.listen(currentPort, () => {
  console.log(`[Panel] App disponible sur http://localhost:${currentPort}`);
  if (!process.env.PANEL_PASSWORD) {
    console.log(`[Panel] Mot de passe par défaut: ${CONFIG.password}`);
  }
  console.log("[Panel] --- Comment changer le mot de passe : ---");
  console.log("[Panel] 1) Ouvrir server.js");
  console.log(`[Panel] 2) Modifier DEFAULT_CONFIG.password (actuel: ${CONFIG.password})`);
  console.log("[Panel] 3) Ou definir PANEL_PASSWORD dans .env");
  console.log("[Panel] 4) Relancer le panel");
});