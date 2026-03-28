let ws = null;
let players = [];

function login() {
  const password = document.getElementById("password-input").value;
  if (!password) return;

  ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", password }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    setStatus(false, "Déconnecté");
  };

  ws.onerror = () => {
    setStatus(false, "Erreur de connexion");
  };
}

document.getElementById("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

function handleMessage(msg) {
  if (msg.type === "auth") {
    if (msg.success) {
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app").style.display = "block";
      setStatus(true, "Connecté");
    } else {
      document.getElementById("login-error").style.display = "block";
    }
    return;
  }

  if (msg.type === "log") {
    appendLog(msg.text);
    parsePlayerEvents(msg.text);
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
    list.innerHTML = '<div id="no-players">Aucun joueur connecté</div>';
    return;
  }

  list.innerHTML = players.map((name) => `
    <div class="player-card">
      <span class="player-name">🎮 ${name}</span>
      <div class="player-actions">
        <button class="btn-kick" onclick="sendAction('kick', '${name}')">Kick</button>
        <button class="btn-ban" onclick="sendAction('ban', '${name}')">Ban</button>
        <button class="btn-kill" onclick="sendAction('kill', '${name}')">Kill</button>
      </div>
    </div>
  `).join("");
}

function sendCommand() {
  const input = document.getElementById("cmd-input");
  const command = input.value.trim();
  if (!command || !ws) return;

  ws.send(JSON.stringify({ type: "command", command }));

  const line = document.createElement("div");
  line.className = "log-line join";
  line.textContent = `> ${command}`;
  document.getElementById("console").appendChild(line);
  document.getElementById("console").scrollTop = 99999;

  input.value = "";
}

function sendAction(action, player) {
  if (!ws) {
    alert("Non connecté au serveur");
    return;
  }

  // Confirmation avant action
  const confirmMessages = {
    kick: `Kick ${player} du serveur ?`,
    ban: `Bannir définitivement ${player} ?`,
    kill: `Tuer ${player} ?`
  };

  if (!confirm(confirmMessages[action])) return;

  let command = "";
  switch (action) {
    case "kick":
      command = `/kick ${player}`;
      break;
    case "ban":
      command = `/ban ${player}`;
      break;
    case "kill":
      command = `/kill ${player}`;
      break;
  }

  ws.send(JSON.stringify({
    type: "command",
    command: command
  }));

  // Log l'action
  const line = document.createElement("div");
  line.className = "log-line warn";
  line.textContent = `> ${command}`;
  document.getElementById("console").appendChild(line);
  document.getElementById("console").scrollTop = 99999;
}

function setStatus(online, text) {
  document.getElementById("status-dot").className = online ? "online" : "";
  document.getElementById("status-text").textContent = text;
}
