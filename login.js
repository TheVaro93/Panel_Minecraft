let ws = null;
let players = [];
let currentAction = null;

function showLoginError(text) {
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = text;
  errorEl.style.display = "block";
}

function login() {
  const password = document.getElementById("password-input").value;
  if (!password) return;

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${window.location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", password }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    setStatus(false, "Deconnecte");
  };

  ws.onerror = () => {
    setStatus(false, "Erreur de connexion");
    showLoginError("Connexion impossible au serveur");
  };
}

document.getElementById("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

function handleMessage(msg) {
  if (msg.type === "auth") {
    if (msg.success) {
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app").style.display = "flex";
      setStatus(true, "Connecte");
    } else {
      showLoginError("Mot de passe incorrect");
    }
    return;
  }

  if (msg.type === "log") {
    appendLog(msg.text);
    parsePlayerEvents(msg.text);
    return;
  }

  if (msg.type === "playerList") {
    players = Array.isArray(msg.players) ? msg.players : [];
    renderPlayers();

    const modal = document.getElementById("player-modal");
    if (modal && modal.style.display === "flex" && currentAction) {
      openPlayerSelect(currentAction);
    }
  }
}

function appendLog(text) {
  const consoleEl = document.getElementById("console");
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = text;

  if (text.includes("WARN")) line.classList.add("warn");
  else if (text.includes("ERROR")) line.classList.add("error");
  else if (text.includes("Player connected") || text.includes("joined")) line.classList.add("join");
  else if (text.includes("Player disconnected") || text.includes("left")) line.classList.add("leave");

  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearConsole() {
  document.getElementById("console").innerHTML = "";
}

function parsePlayerEvents(text) {
  const joinMatch = text.match(/Player connected:\s*([^,\n]+)/);
  if (joinMatch) {
    const name = joinMatch[1].trim();
    if (!players.includes(name)) {
      players.push(name);
      renderPlayers();
    }
  }

  const leaveMatch = text.match(/Player disconnected:\s*([^,\n]+)/);
  if (leaveMatch) {
    const name = leaveMatch[1].trim();
    players = players.filter((p) => p !== name);
    renderPlayers();
  }
}

function renderPlayers() {
  const list = document.getElementById("player-list");
  const plainList = document.getElementById("playerList");

  if (players.length === 0) {
    list.innerHTML = '<div id="no-players">Aucun joueur connecte</div>';
    if (plainList) plainList.innerHTML = "";
    return;
  }

  list.innerHTML = players.map((name) => `
    <div class="player-card">
      <span class="player-name">${name}</span>
      <div class="player-actions">
        <button class="btn-kick" onclick="openPlayerSelect('kick', '${name}')">Kick</button>
        <button class="btn-ban" onclick="openPlayerSelect('ban', '${name}')">Ban</button>
      </div>
    </div>
  `).join("");

  if (plainList) {
    plainList.innerHTML = players
      .map((name) => `<li>${name}</li>`)
      .join("");
  }
}

function openPlayerSelect(action, playerName = null) {
  if (playerName) {
    executeAction(action, playerName);
    return;
  }

  currentAction = action;
  const modal = document.getElementById("player-modal");
  const titles = { ban: "Bannir", kick: "Expulser", kill: "Tuer" };
  document.getElementById("modal-title").textContent = `${titles[action]} quel joueur ?`;
  
  const modalList = document.getElementById("modal-player-list");
  if (players.length === 0) {
    modalList.innerHTML = '<p>Aucun joueur connecté</p>';
  } else {
    modalList.innerHTML = players.map((name) => `
      <button class="player-select-btn" onclick="executeAction('${action}', '${name}')">${name}</button>
    `).join("");
  }
  modal.style.display = "flex";
}

function closePlayerModal() {
  document.getElementById("player-modal").style.display = "none";
  currentAction = null;
}

function executeAction(action, playerName) {
  closePlayerModal();
  
  if (action === "ban") {
    if (!confirm(`Bannir définitivement ${playerName} ?`)) return;
    ws.send(JSON.stringify({ type: "ban", player: playerName }));
    players = players.filter((p) => p !== playerName);
    renderPlayers();
  } else if (action === "kick") {
    if (!confirm(`Expulser ${playerName} ?`)) return;
    ws.send(JSON.stringify({ type: "kick", player: playerName, reason: "Kicked by admin" }));
  } else if (action === "kill") {
    if (!confirm(`Tuer ${playerName} ?`)) return;
    ws.send(JSON.stringify({ type: "command", command: `/kill "${playerName}"` }));
  }
}

function sendCommand() {
  const input = document.getElementById("cmd-input");
  const message = input.value.trim();
  if (!message || !ws) return;

  const command = `say ${message}`;

  ws.send(JSON.stringify({ type: "command", command }));

  const line = document.createElement("div");
  line.className = "log-line join";
  line.textContent = `> ${command}`;
  document.getElementById("console").appendChild(line);
  document.getElementById("console").scrollTop = 99999;

  input.value = "";
}

function sendRawCommand() {
  const input = document.getElementById("raw-cmd-input");
  const command = input.value.trim();
  if (!command || !ws) return;

  ws.send(JSON.stringify({ type: "raw_command", command }));

  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `> ${command}`;
  document.getElementById("console").appendChild(line);
  document.getElementById("console").scrollTop = 99999;
  input.value = "";
}

function kickPlayer() {
  openPlayerSelect("kick");
}

function banPlayer() {
  openPlayerSelect("ban");
}

function killPlayer() {
  openPlayerSelect("kill");
}

function setStatus(online, text) {
  document.getElementById("status-dot").className = online ? "online" : "";
  document.getElementById("status-text").textContent = text;
}