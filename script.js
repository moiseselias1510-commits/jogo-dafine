const WIN_SCORE = 4;
const CARD_TIME = 10;

/*
  Troque os arquivos em assets/cards/ pelas suas imagens.
  Se alguma imagem não existir ainda, o jogo mostra um emoji no lugar.
*/
const CARD_LIBRARY = [
  { id: "bola", nome: "Bola", imagem: "assets/cards/bola.png", emoji: "⚽" },
  { id: "chuteira", nome: "Chuteira", imagem: "assets/cards/chuteira.png", emoji: "🥾" },
  { id: "trofeu", nome: "Troféu", imagem: "assets/cards/trofeu.png", emoji: "🏆" },
  { id: "luva", nome: "Luva", imagem: "assets/cards/luva.png", emoji: "🧤" },
  { id: "gol", nome: "Gol", imagem: "assets/cards/gol.png", emoji: "🥅" },
  { id: "bandeira", nome: "Bandeira", imagem: "assets/cards/bandeira.png", emoji: "🚩" },
  { id: "camisa", nome: "Camisa", imagem: "assets/cards/camisa.png", emoji: "👕" },
  { id: "cartao", nome: "Cartão", imagem: "assets/cards/cartao.png", emoji: "🟨" },
  { id: "estadio", nome: "Estádio", imagem: "assets/cards/estadio.png", emoji: "🏟️" },
  { id: "medalha", nome: "Medalha", imagem: "assets/cards/medalha.png", emoji: "🎖️" },
  { id: "apito", nome: "Apito", imagem: "assets/cards/apito.png", emoji: "📯" },
  { id: "tecnico", nome: "Técnico", imagem: "assets/cards/tecnico.png", emoji: "🧢" },
  { id: "torcida", nome: "Torcida", imagem: "assets/cards/torcida.png", emoji: "📣" },
  { id: "capitao", nome: "Capitão", imagem: "assets/cards/capitao.png", emoji: "👑" },
  { id: "campo", nome: "Campo", imagem: "assets/cards/campo.png", emoji: "🌱" }
];

const BACK_IMAGE = "assets/cards/costas.png";

const state = {
  mode: 2,
  pairCount: 10,
  players: [],
  currentPlayer: 0,
  deck: [],
  openedIndexes: [],
  allowedFlips: 2,
  locked: false,
  gameOver: false,
  timerInterval: null,
  timeLeft: CARD_TIME
};

const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const winnerModal = document.getElementById("winnerModal");

const modeButtons = document.querySelectorAll(".mode-btn");
const modeInput = document.getElementById("modeInput");
const playersInputs = document.getElementById("playersInputs");
const setupForm = document.getElementById("setupForm");

const currentPlayerName = document.getElementById("currentPlayerName");
const turnInfo = document.getElementById("turnInfo");
const timerValue = document.getElementById("timerValue");
const timerRing = document.getElementById("timerRing");
const playersBoard = document.getElementById("playersBoard");
const board = document.getElementById("board");
const messageBox = document.getElementById("messageBox");

const winnerTitle = document.getElementById("winnerTitle");
const winnerSubtitle = document.getElementById("winnerSubtitle");
const winnerStats = document.getElementById("winnerStats");
const playAgainBtn = document.getElementById("playAgainBtn");
const backToSetupBtn = document.getElementById("backToSetupBtn");

const audioManager = {
  ctx: null,

  ensure() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    return this.ctx;
  },

  playTone(type, startFreq, endFreq, duration = 0.2, volume = 0.05, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime + delay);
    osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + delay + duration);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.03);
  },

  playNoise(duration = 0.3, volume = 0.03) {
    const ctx = this.ensure();
    if (!ctx) return;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
  },

  flip() {
    this.playTone("triangle", 900, 650, 0.12, 0.03);
  },

  match() {
    this.playTone("sine", 520, 760, 0.15, 0.045);
    this.playTone("sine", 760, 940, 0.14, 0.04, 0.1);
  },

  bonus() {
    this.playTone("triangle", 650, 900, 0.12, 0.05);
    this.playTone("triangle", 900, 1200, 0.16, 0.05, 0.12);
  },

  timeout() {
    this.playTone("sawtooth", 520, 240, 0.35, 0.03);
  },

  win() {
    this.playTone("triangle", 700, 980, 0.18, 0.05);
    this.playTone("triangle", 980, 1260, 0.2, 0.05, 0.16);
    this.playTone("triangle", 1260, 1500, 0.22, 0.05, 0.38);
    this.playNoise(0.9, 0.04);
  }
};

function init() {
  renderPlayerInputs(2);
  bindEvents();
  updateTimerUI(CARD_TIME);
}

function bindEvents() {
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = Number(btn.dataset.mode);
      setMode(mode);
    });
  });

  setupForm.addEventListener("submit", startGameFromForm);
  playAgainBtn.addEventListener("click", restartSamePlayers);
  backToSetupBtn.addEventListener("click", goToSetup);

  document.addEventListener("click", () => {
    audioManager.ensure();
  }, { once: true });
}

function setMode(mode) {
  state.mode = mode;
  modeInput.value = String(mode);

  modeButtons.forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.mode) === mode);
  });

  renderPlayerInputs(mode);
}

function renderPlayerInputs(mode) {
  const total = mode === 2 ? 2 : 4;
  playersInputs.innerHTML = "";

  for (let i = 1; i <= total; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "input-group";
    wrapper.innerHTML = `
      <label for="player${i}">Nome do jogador ${i}</label>
      <input id="player${i}" type="text" maxlength="18" placeholder="Jogador ${i}" />
    `;
    playersInputs.appendChild(wrapper);
  }
}

function startGameFromForm(event) {
  event.preventDefault();

  const mode = Number(modeInput.value);
  const total = mode === 2 ? 2 : 4;

  const names = [];
  for (let i = 1; i <= total; i++) {
    const input = document.getElementById(`player${i}`);
    const value = input.value.trim();
    names.push(value || `Jogador ${i}`);
  }

  createNewMatch(mode, names);
}

function createNewMatch(mode, names) {
  stopTimer();

  state.mode = mode;
  state.pairCount = mode === 2 ? 10 : 15;
  state.currentPlayer = 0;
  state.allowedFlips = 2;
  state.openedIndexes = [];
  state.locked = false;
  state.gameOver = false;
  state.timeLeft = CARD_TIME;

  state.players = names.map(name => ({
    name,
    score: 0,
    hitStreak: 0,
    missStreak: 0,
    maxHitStreak: 0,
    matches: 0,
    bonusPoints: 0,
    skipNextTurn: false
  }));

  state.deck = createDeck(state.pairCount);

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  winnerModal.classList.add("hidden");

  renderPlayers();
  buildBoard();
  updateCurrentTurnUI();
  setMessage(`Partida iniciada! ${state.players[state.currentPlayer].name}, sua vez.`);
  startTurnTimer();
}

function restartSamePlayers() {
  if (!state.players.length) return;

  const names = state.players.map(player => player.name);
  const mode = state.mode;

  winnerModal.classList.add("hidden");
  createNewMatch(mode, names);
}

function goToSetup() {
  stopTimer();
  state.gameOver = true;
  winnerModal.classList.add("hidden");
  gameScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
}

function createDeck(pairCount) {
  const selected = CARD_LIBRARY.slice(0, pairCount);

  const doubled = [...selected, ...selected].map((item, index) => ({
    uid: `${item.id}-${index}`,
    pairId: item.id,
    nome: item.nome,
    imagem: item.imagem,
    emoji: item.emoji,
    opened: false,
    matched: false
  }));

  return shuffle(doubled);
}

function shuffle(array) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[randomIndex]] = [arr[randomIndex], arr[i]];
  }

  return arr;
}

function renderPlayers() {
  playersBoard.innerHTML = "";

  state.players.forEach((player, index) => {
    const card = document.createElement("div");
    card.className = "player-card";

    if (index === state.currentPlayer && !state.gameOver) {
      card.classList.add("active");
    }

    if (player.skipNextTurn) {
      card.classList.add("skip");
    }

    const balls = Array.from({ length: WIN_SCORE }, (_, i) => {
      return `<span class="football ${i < player.score ? "" : "empty"}">⚽</span>`;
    }).join("");

    card.innerHTML = `
      ${player.skipNextTurn ? `<div class="skip-tag">Pula vez</div>` : ""}
      <div class="player-name">${player.name}</div>
      <div class="score-row">${balls}</div>
    `;

    playersBoard.appendChild(card);
  });
}

function buildBoard() {
  board.innerHTML = "";
  board.className = `board ${state.mode === 2 ? "mode-2" : "mode-4"}`;

  state.deck.forEach((card, index) => {
    const button = document.createElement("button");
    button.className = "memory-card";
    button.type = "button";
    button.dataset.index = index;

    button.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <div class="back-wrap">
            <img
              class="card-back-image"
              src="${BACK_IMAGE}"
              alt="Verso da carta"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="back-fallback">⚽</div>
          </div>
        </div>

        <div class="card-face card-front">
          <div class="card-art">
            <img
              class="card-image"
              src="${card.imagem}"
              alt="${card.nome}"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="card-fallback">${card.emoji}</div>
          </div>
        </div>
      </div>
    `;

    button.addEventListener("click", () => handleCardClick(index));
    board.appendChild(button);
  });

  updateBoardUI();
}

function updateBoardUI() {
  const buttons = board.querySelectorAll(".memory-card");

  buttons.forEach((button, index) => {
    const card = state.deck[index];
    button.classList.toggle("flipped", card.opened);
    button.classList.toggle("matched", card.matched);
    button.disabled = card.matched || state.gameOver;
  });
}

function updateCurrentTurnUI() {
  const player = state.players[state.currentPlayer];
  currentPlayerName.textContent = player.name;
  turnInfo.textContent = state.allowedFlips === 3 ? "Vire 3 cartas" : "Vire 2 cartas";
  renderPlayers();
}

function setMessage(text) {
  messageBox.textContent = text;
}

function startTurnTimer() {
  stopTimer();
  state.timeLeft = CARD_TIME;
  updateTimerUI(state.timeLeft);

  state.timerInterval = setInterval(() => {
    state.timeLeft -= 1;
    updateTimerUI(state.timeLeft);

    if (state.timeLeft <= 0) {
      stopTimer();
      handleTimerExpired();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function resetTimerForNextPick() {
  stopTimer();
  state.timeLeft = CARD_TIME;
  updateTimerUI(state.timeLeft);
  startTurnTimer();
}

function updateTimerUI(seconds) {
  timerValue.textContent = seconds;

  const percentage = Math.max(0, seconds / CARD_TIME);
  const degrees = percentage * 360;
  const color = seconds <= 3 ? "#ff6f6f" : seconds <= 6 ? "#ffd54f" : "#35db7e";

  timerRing.style.background = `conic-gradient(${color} ${degrees}deg, rgba(255,255,255,0.08) 0deg)`;
}

function handleCardClick(index) {
  if (state.locked || state.gameOver) return;

  const card = state.deck[index];

  if (card.matched || card.opened) return;
  if (state.openedIndexes.length >= state.allowedFlips) return;

  audioManager.flip();

  card.opened = true;
  state.openedIndexes.push(index);
  updateBoardUI();

  if (state.openedIndexes.length < state.allowedFlips) {
    const faltam = state.allowedFlips - state.openedIndexes.length;
    setMessage(`${state.players[state.currentPlayer].name}, vire mais ${faltam} carta${faltam > 1 ? "s" : ""}.`);
    resetTimerForNextPick();
    return;
  }

  state.locked = true;
  stopTimer();

  setTimeout(resolveTurn, 600);
}

function resolveTurn() {
  if (state.allowedFlips === 2) {
    const [a, b] = state.openedIndexes;
    const isMatch = state.deck[a].pairId === state.deck[b].pairId;

    if (isMatch) {
      handleSuccess([a, b], []);
    } else {
      handleFailure(state.openedIndexes);
    }
    return;
  }

  const pair = findPairInThree(state.openedIndexes);

  if (pair) {
    const extra = state.openedIndexes.filter(index => !pair.includes(index));
    handleSuccess(pair, extra);
  } else {
    handleFailure(state.openedIndexes);
  }
}

function findPairInThree(indexes) {
  const seen = {};

  for (const index of indexes) {
    const id = state.deck[index].pairId;

    if (seen[id] !== undefined) {
      return [seen[id], index];
    }

    seen[id] = index;
  }

  return null;
}

function handleSuccess(pairIndexes, extraIndexes) {
  const player = state.players[state.currentPlayer];

  pairIndexes.forEach(index => {
    state.deck[index].matched = true;
    state.deck[index].opened = true;
  });

  extraIndexes.forEach(index => {
    state.deck[index].opened = false;
  });

  player.matches += 1;
  player.hitStreak += 1;
  player.maxHitStreak = Math.max(player.maxHitStreak, player.hitStreak);
  player.missStreak = 0;

  let gainedPoints = 1;
  let message = `${player.name} acertou um par!`;
  audioManager.match();

  if (player.hitStreak % 2 === 0) {
    gainedPoints += 1;
    player.bonusPoints += 1;
    message += " Ganhou +1 bola bônus!";
    audioManager.bonus();
  }

  player.score = Math.min(WIN_SCORE, player.score + gainedPoints);

  state.allowedFlips = player.hitStreak >= 3 ? 3 : 2;

  if (state.allowedFlips === 3 && player.score < WIN_SCORE) {
    message += " Agora pode virar 3 cartas.";
  }

  state.openedIndexes = [];
  state.locked = false;
  updateBoardUI();
  renderPlayers();
  updateCurrentTurnUI();

  if (player.score >= WIN_SCORE) {
    endGame(player);
    return;
  }

  setMessage(message);
  startTurnTimer();
}

function handleFailure(indexes) {
  const player = state.players[state.currentPlayer];
  player.hitStreak = 0;
  player.missStreak += 1;
  state.allowedFlips = 2;

  let message = `${player.name} não encontrou par.`;

  if (player.missStreak >= 3) {
    player.skipNextTurn = true;
    player.missStreak = 0;
    message += " Vai perder a próxima vez.";
  }

  setTimeout(() => {
    indexes.forEach(index => {
      if (!state.deck[index].matched) {
        state.deck[index].opened = false;
      }
    });

    state.openedIndexes = [];
    state.locked = false;

    updateBoardUI();
    renderPlayers();
    passTurn(message);
  }, 420);
}

function handleTimerExpired() {
  if (state.gameOver) return;

  audioManager.timeout();

  const player = state.players[state.currentPlayer];
  player.hitStreak = 0;
  player.missStreak += 1;
  state.allowedFlips = 2;

  if (player.missStreak >= 3) {
    player.skipNextTurn = true;
    player.missStreak = 0;
  }

  state.openedIndexes.forEach(index => {
    if (!state.deck[index].matched) {
      state.deck[index].opened = false;
    }
  });

  state.openedIndexes = [];
  state.locked = false;

  updateBoardUI();
  renderPlayers();

  let text = `${player.name} ficou sem tempo.`;
  if (player.skipNextTurn) {
    text += " Vai perder a próxima vez.";
  }

  passTurn(text);
}

function passTurn(baseMessage = "") {
  stopTimer();

  let skippedNames = [];
  let nextIndex = state.currentPlayer;

  for (let i = 0; i < state.players.length; i++) {
    nextIndex = (nextIndex + 1) % state.players.length;

    if (state.players[nextIndex].skipNextTurn) {
      skippedNames.push(state.players[nextIndex].name);
      state.players[nextIndex].skipNextTurn = false;
      continue;
    }

    state.currentPlayer = nextIndex;
    state.allowedFlips = state.players[nextIndex].hitStreak >= 3 ? 3 : 2;
    updateCurrentTurnUI();

    let fullMessage = baseMessage ? `${baseMessage} ` : "";

    if (skippedNames.length) {
      fullMessage += `${skippedNames.join(", ")} perdeu${skippedNames.length > 1 ? "ram" : ""} a vez. `;
    }

    fullMessage += `Agora é a vez de ${state.players[nextIndex].name}.`;

    setMessage(fullMessage.trim());
    startTurnTimer();
    return;
  }

  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  state.allowedFlips = 2;
  updateCurrentTurnUI();
  setMessage("Próxima rodada iniciada.");
  startTurnTimer();
}

function endGame(winner) {
  state.gameOver = true;
  stopTimer();
  audioManager.win();

  winnerTitle.textContent = `${winner.name} venceu!`;
  winnerSubtitle.textContent = `${winner.name} chegou a ${WIN_SCORE} bolas e conquistou a partida.`;

  winnerStats.innerHTML = state.players.map(player => `
    <div class="winner-line">
      <strong>${player.name}</strong>
      <span>Pares ${player.matches} • bônus ${player.bonusPoints} • melhor sequência ${player.maxHitStreak}</span>
    </div>
  `).join("");

  winnerModal.classList.remove("hidden");
}

init();
