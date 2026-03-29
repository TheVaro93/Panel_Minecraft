let ws = null;
let players = [];
let currentAction = null;

function showLoginError(text) {
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = text;
  errorEl.style.display = "block";
}

function login() {
  const passwordInput = document.getElementById("password-input");
  const password = passwordInput.value.trim();
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
      document.body.classList.add("logged-in");
      setStatus(true, "Connecte");
    } else {
      document.body.classList.remove("logged-in");
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

  if (players.length === 0) {
    list.innerHTML = '<div id="no-players">Aucun joueur connecte</div>';
    return;
  }

  list.innerHTML = players
    .map((name) => {
      const safeName = escapeHtml(name);
      const nameJson = JSON.stringify(name);
      return `
        <div class="player-card">
          <span class="player-name">${safeName}</span>
          <div class="player-actions">
            <button class="btn-kick" onclick='sendAction("kick", ${nameJson})'>Kick</button>
            <button class="btn-ban" onclick='sendAction("ban", ${nameJson})'>Ban</button>
            <button class="btn-kill" onclick='sendAction("kill", ${nameJson})'>Kill</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function sendAction(action, player) {
  if (!ws) return;

  const prompts = {
    kick: `Expulser ${player} ?`,
    ban: `Bannir definitivement ${player} ?`,
    kill: `Tuer ${player} ?`
  };

  if (!confirm(prompts[action] || `Confirmer ${action} sur ${player} ?`)) return;

  let command = "";
  if (action === "ban") {
    command = `/ban "${player}"`;
    players = players.filter((p) => p !== player);
    renderPlayers();
  } else if (action === "kick") {
    command = `/kick "${player}"`;
  } else if (action === "kill") {
    command = `/kill "${player}"`;
  } else {
    return;
  }

  ws.send(JSON.stringify({ type: "command", command }));

  const line = document.createElement("div");
  line.className = "log-line warn";
  line.textContent = `> ${command}`;
  document.getElementById("console").appendChild(line);
  document.getElementById("console").scrollTop = 99999;
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
    modalList.innerHTML = "<p>Aucun joueur connecte</p>";
  } else {
    modalList.innerHTML = players
      .map((name) => {
        const safeName = escapeHtml(name);
        const nameJson = JSON.stringify(name);
        return `<button class="player-select-btn" onclick='executeAction("${action}", ${nameJson})'>${safeName}</button>`;
      })
      .join("");
  }

  modal.style.display = "flex";
}

function closePlayerModal() {
  document.getElementById("player-modal").style.display = "none";
  currentAction = null;
}

function executeAction(action, playerName) {
  closePlayerModal();
  sendAction(action, playerName);
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

function setStatus(online, text) {
  document.getElementById("status-dot").className = online ? "online" : "";
  document.getElementById("status-text").textContent = text;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
