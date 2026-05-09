const socket = io();

let currentRoom = "";
let inRoom = false;

const startBtn = document.getElementById("startBtn");
const joinBtn = document.getElementById("joinBtn");
const lobby = document.getElementById("lobby");
const revealScreen = document.getElementById("revealScreen");
const roleScreen = document.getElementById("roleScreen");
const categoryScreen = document.getElementById("categoryScreen");
const wordScreen = document.getElementById("wordScreen");
const gameScreen = document.getElementById("gameScreen");
const votingScreen = document.getElementById("votingScreen");
const voteResultScreen = document.getElementById("voteResultScreen");
const voteSuspense = document.getElementById("voteSuspense");
const phaseDisplay = document.getElementById("phaseDisplay");
const lobbyMessage = document.getElementById("lobbyMessage");
const playerArea = document.getElementById("playerArea");
const discussionArea = document.getElementById("discussionArea");
const cluePanel = document.getElementById("cluePanel");
const clueSummary = document.getElementById("clueSummary");
const turnScreen = document.getElementById("turnScreen");
const turnDisplay = document.getElementById("turnDisplay");
const turnTimerEl = document.getElementById("turnTimer");
const turnInput = document.getElementById("turnInput");
const submitClueBtn = document.getElementById("submitClueBtn");
const turnClues = document.getElementById("turnClues");
const turnClueList = document.getElementById("turnClueList");
const gameRoleDisplay = document.getElementById("gameRoleDisplay");
const chatArea = document.getElementById("chatArea");
const roomPlayers = document.getElementById("roomPlayers");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const revealText = document.getElementById("revealText");
const revealSubtext = document.getElementById("revealSubtext");
const voteRevealMessage = document.getElementById("voteRevealMessage");
const voteResultsContent = document.getElementById("voteResultsContent");

let dotAnimationInterval = null;

lobby.classList.remove("hidden");
revealScreen.classList.add("hidden");
roleScreen.classList.add("hidden");
categoryScreen.classList.add("hidden");
wordScreen.classList.add("hidden");
gameScreen.classList.add("hidden");
votingScreen.classList.add("hidden");
voteResultScreen.classList.add("hidden");
roomPlayers.classList.add("hidden");
startBtn.style.display = "none";

let hasVoted = false;
let voteTimeRemaining = 12;
let playerRole = null;
let gameCategory = null;
let gameWord = null;

function startDotAnimation(element, baseText) {
  clearInterval(dotAnimationInterval);
  let dotCount = 0;
  element.textContent = baseText;
  dotAnimationInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    element.textContent = baseText + ".".repeat(dotCount);
  }, 600);
}

function stopDotAnimation() {
  clearInterval(dotAnimationInterval);
  dotAnimationInterval = null;
}

function crossfadeScreens(fromEl, toEl, duration = 450) {
  if (fromEl) {
    fromEl.classList.remove("fade-in");
    fromEl.classList.add("fade-out");
  }

  if (toEl) {
    toEl.classList.remove("hidden");
    toEl.classList.add("show");
    requestAnimationFrame(() => {
      toEl.classList.remove("fade-out");
      toEl.classList.add("fade-in");
    });
  }

  if (fromEl) {
    setTimeout(() => {
      fromEl.classList.add("hidden");
      fromEl.classList.remove("fade-out");
      fromEl.classList.remove("show");
    }, duration);
  }
}

joinBtn.onclick = () => {
  if (inRoom) {
    // Leave room

    socket.emit("leaveRoom", currentRoom);
    inRoom = false;
    currentRoom = "";
    joinBtn.textContent = "Join Room";
    roomPlayers.classList.add("hidden");
    document.getElementById("username").disabled = false;
    document.getElementById("roomCode").disabled = false;
    startBtn.style.display = "none";
    lobbyMessage.style.color = "rgba(79, 70, 229, 0.8)";
    lobbyMessage.textContent = "Enter a room code to create or join a room.";
  } else {
    // Join room
    const username = document.getElementById("username").value.trim();
    const roomCode = document.getElementById("roomCode").value.trim();
    lobbyMessage.style.color = "#ddddf0";

    if (!username || !roomCode) return;

    currentRoom = roomCode;

    socket.emit("joinRoom", {
      username,
      roomCode
    });
  }
};

document.getElementById("startBtn").onclick = () => {
  if (!currentRoom) return;

  socket.emit("startGame", currentRoom);
};

function sendChatMessage() {
  const message = chatInput.value.trim();
  const username = document.getElementById("username").value.trim();

  if (!message) return;

  socket.emit("chatMessage", {
    roomCode: currentRoom,
    username,
    message
  });

  chatInput.value = "";
}

sendChatBtn.onclick = sendChatMessage;
chatInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendChatMessage();
  }
});

turnInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (!submitClueBtn.disabled) {
      submitClueBtn.click();
    }
  }
});

document.getElementById("endDiscussionBtn").onclick = () => {
  socket.emit("voteEndDiscussion", currentRoom);
};

socket.on("playerList", players => {
  const ul = document.getElementById("players");
  ul.innerHTML = "";

  players.forEach(player => {
    const li = document.createElement("li");
    li.textContent = player.username;
    ul.appendChild(li);
  });

  // Update lobby player list
  const lobbyPlayerList = document.getElementById("lobbyPlayerList");
  lobbyPlayerList.innerHTML = "";

  players.forEach(player => {
    const li = document.createElement("li");
    li.textContent = player.username;
    lobbyPlayerList.appendChild(li);
  });

  roomPlayers.classList.remove("hidden");

  // Check if current player is in the room
  const currentPlayerInRoom = players.some(p => p.id === socket.id);
  
  if (currentPlayerInRoom && !inRoom) {
    inRoom = true;
    joinBtn.textContent = "Leave";
    document.getElementById("username").disabled = true;
    document.getElementById("roomCode").disabled = true;
  }

  const isRoomCreator = players.length > 0 && players[0].id === socket.id;
  
  // Can only start if at least 3 players and max 6 players
  if (isRoomCreator && players.length >= 3) {
    startBtn.style.display = "inline-block";
  } else {
    startBtn.style.display = "none";
  }

  if (isRoomCreator) {
    if (players.length < 3) {
      lobbyMessage.textContent = `You're the room creator. Need ${3 - players.length} more player(s) to start.`;
    } else if (players.length >= 6) {
      lobbyMessage.textContent = "You're the room creator. Room is full. Ready to start!";
    } else {
      lobbyMessage.textContent = "You're the room creator. Start the game when ready.";
    }
  } else {
    if (players.length < 3) {
      lobbyMessage.textContent = `Waiting for players... (${players.length}/3)`;
    } else {
      lobbyMessage.textContent = "Waiting for the room creator to start the game.";
    }
  }
});

socket.on("joinRoomError", ({ message }) => {
  alert(message);
  inRoom = false;
  currentRoom = "";
  joinBtn.textContent = "Join Room";
  lobbyMessage.textContent = "Enter a room code to create or join a room.";
});

socket.on("gameStarted", () => {
  lobby.classList.add("hidden");
  gameScreen.classList.add("hidden");
  gameScreen.style.display = "none";

  playerArea.classList.add("hidden");
  chatArea.classList.add("hidden");

  revealText.textContent = "Game Starting";
  revealSubtext.textContent = "Preparing roles and secret word...";
  startDotAnimation(revealText, "Game Starting");

  revealScreen.classList.remove("hidden");
  revealScreen.classList.add("show", "fade-in");

  setTimeout(() => {
    stopDotAnimation();
    crossfadeScreens(revealScreen, roleScreen);
  }, 5000);
});

let currentTurnId = null;
let turnTimerInterval = null;

submitClueBtn.onclick = () => {
  const clue = turnInput.value.trim();
  if (!clue || !currentTurnId || currentTurnId !== socket.id) return;

  socket.emit("submitClue", {
    roomCode: currentRoom,
    clue
  });

  turnInput.value = "";
  submitClueBtn.disabled = true;
};

function updateTurnInput(active, placeholder) {
  turnScreen.classList.remove("hidden");
  turnInput.style.display = active ? "block" : "none";
  submitClueBtn.style.display = active ? "inline-block" : "none";
  turnInput.disabled = !active;
  submitClueBtn.disabled = !active;
  turnInput.placeholder = placeholder;
  turnInput.value = "";
  if (active) {
    turnInput.focus();
  }
}

function startLocalTurnTimer(seconds) {
  clearInterval(turnTimerInterval);
  let remaining = seconds;
  turnTimerEl.textContent = `Time remaining: ${remaining}s`;

  turnTimerInterval = setInterval(() => {
    remaining -= 1;
    turnTimerEl.textContent = `Time remaining: ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(turnTimerInterval);
    }
  }, 1000);
}

socket.on("turnTakingStarted", ({ totalTurns }) => {
  phaseDisplay.textContent = "Turn-taking round";
  crossfadeScreens(gameScreen, turnScreen);
  turnScreen.classList.add("show");

  turnClues.classList.remove("hidden");
  chatArea.classList.add("hidden");
  discussionArea.classList.add("hidden");
  playerArea.classList.remove("hidden");
  turnClueList.innerHTML = "";
  clueSummary.innerHTML = "";
  updateTurnInput(false, `Waiting for the first player...`);
  turnDisplay.textContent = `Turn order set: ${totalTurns} players`;
});

socket.on("turnStart", ({ currentTurnId: turnId, currentTurnName, currentIndex, totalTurns }) => {
  currentTurnId = turnId;
  const isActive = socket.id === turnId;
  turnDisplay.textContent = isActive ? "It is your turn" : `${currentTurnName}'s turn right now`;
  updateTurnInput(isActive, isActive ? "Type one word describing the secret word..." : `Waiting for ${currentTurnName} to submit a clue...`);
  startLocalTurnTimer(12);

  if (!isActive) {
    submitClueBtn.disabled = true;
  }
});

socket.on("turnClue", ({ username, clue, skipped }) => {
  const li = document.createElement("li");
  if (skipped) {
    li.textContent = `${username} did not submit a word.`;
    li.style.opacity = "0.7";
  } else {
    li.textContent = `${username}: ${clue}`;
  }
  turnClueList.appendChild(li);
  clueSummary.appendChild(li.cloneNode(true));
  turnClues.classList.remove("hidden");
  cluePanel.classList.remove("hidden");
});

socket.on("turnTakingComplete", () => {
  // Clear any inline display styles and reset screens
  gameScreen.style.display = "";
  roleScreen.style.display = "none";
  categoryScreen.style.display = "none";
  wordScreen.style.display = "none";
  
  // Hide role/category/word screens
  roleScreen.classList.add("hidden");
  categoryScreen.classList.add("hidden");
  wordScreen.classList.add("hidden");
  
  phaseDisplay.textContent = "Discussion phase";
  crossfadeScreens(turnScreen, gameScreen);
  
  // Ensure gameScreen and discussion elements are properly displayed
  setTimeout(() => {
    gameScreen.classList.remove("hidden");
    discussionArea.classList.remove("hidden");
    cluePanel.classList.remove("hidden");
    chatArea.classList.remove("hidden");
    playerArea.classList.remove("hidden");
    gameRoleDisplay.style.display = "none";  // Hide role display during discussion
  }, 50);
  
  clearInterval(turnTimerInterval);
});

function revealGameDetails() {
  if (!gameScreen.classList.contains("hidden")) {
    playerArea.classList.remove("hidden");
    discussionArea.classList.add("hidden");
    cluePanel.classList.add("hidden");
    turnClues.classList.add("hidden");
    turnScreen.classList.add("hidden");

    if (playerRole === "impostor") {
      gameRoleDisplay.textContent = "You are the IMPOSTOR";
      gameRoleDisplay.style.color = "#fb7185";
    } else {
      gameRoleDisplay.textContent = `Category: ${gameCategory} | Word: ${gameWord}`;
      gameRoleDisplay.style.color = "#10b981";
    }
  }
}

socket.on("role", data => {
  playerRole = data.role;
  gameCategory = data.category;
  gameWord = data.word;

  const roleDisplay = document.getElementById("roleDisplay");
  const categoryDisplay = document.getElementById("categoryDisplay");
  const wordDisplay = document.getElementById("wordDisplay");

  if (data.role === "impostor") {
    roleDisplay.textContent = "You are the IMPOSTOR";
    roleDisplay.style.color = "#fb7185";
  } else {
    roleDisplay.textContent = "You are a DETECTIVE";
    roleDisplay.style.color = "#10b981";
  }

  categoryDisplay.textContent = data.category;
  if (data.role === "impostor") {
    wordDisplay.textContent = "???";
  } else {
    wordDisplay.textContent = data.word;
  }

  // Show "Game starting..." message first
  revealText.textContent = "Game Starting";
  revealSubtext.textContent = "";
  startDotAnimation(revealText, "Game Starting");
  revealScreen.classList.remove("hidden");
  revealScreen.classList.add("show", "fade-in");

  // After 5 seconds, show role screen
  setTimeout(() => {
    stopDotAnimation();
    crossfadeScreens(revealScreen, roleScreen);

    // Start the sequence after role is shown
    setTimeout(() => {
      crossfadeScreens(roleScreen, categoryScreen);

      // After category animation, show word
      setTimeout(() => {
        crossfadeScreens(categoryScreen, wordScreen);

        // After word animation, go to discussion
        setTimeout(() => {
          crossfadeScreens(wordScreen, gameScreen);
          phaseDisplay.textContent = "Preparing turn-taking...";
          revealGameDetails();
          socket.emit("readyForTurnTaking", currentRoom);
        }, 3000);
      }, 3000);
    }, 3000);
  }, 5000);
});

socket.on("chatMessage", data => {
  const chatBox = document.getElementById("chatBox");

  chatBox.innerHTML += `
    <div><strong>${data.username}:</strong> ${data.message}</div>
  `;

  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on("endDiscussionVoteCount", ({ votes, needed }) => {
  document.getElementById("voteStatus").textContent =
    `${votes}/${needed} votes to end discussion`;
});

socket.on("votingStarted", ({ players }) => {
  crossfadeScreens(gameScreen, votingScreen);

  hasVoted = false;
  voteTimeRemaining = 12;
  document.getElementById("totalPlayers").textContent = players.length;
  document.getElementById("votesCast").textContent = "0";
  voteSuspense.classList.add("hidden");

  const playerVoteButtons = document.getElementById("playerVoteButtons");
  playerVoteButtons.innerHTML = "";

  players.forEach(player => {
    const button = document.createElement("button");
    button.className = "voteButton";
    button.textContent = player.username;
    button.disabled = player.id === socket.id;
    button.onclick = () => voteForPlayer(player.id, button, player.username);
    playerVoteButtons.appendChild(button);
  });

  startVoteTimer();
});

socket.on("voteUpdate", ({ votesCast, totalPlayers }) => {
  document.getElementById("votesCast").textContent = votesCast;
});

socket.on("voteResults", ({ votedOut, isImpostor, impostor }) => {
  voteSuspense.textContent = "All votes are in. Counting results...";
  voteSuspense.classList.remove("hidden");
  voteSuspense.classList.add("visible");

  const playerVoteButtons = document.getElementById("playerVoteButtons");
  playerVoteButtons.querySelectorAll("button").forEach(btn => btn.disabled = true);

  setTimeout(() => {
    voteSuspense.classList.remove("visible");
    voteSuspense.classList.add("fade-out");
    votingScreen.classList.add("fade-out");

    setTimeout(() => {
      votingScreen.classList.add("hidden");
      votingScreen.classList.remove("show", "fade-out");
      voteSuspense.classList.add("hidden");
      voteSuspense.classList.remove("fade-out");

      voteResultsContent.classList.add("result-hidden");
      voteResultsContent.classList.remove("show");
      voteRevealMessage.style.opacity = "1";
      voteRevealMessage.textContent = "Revealing impostor";
      startDotAnimation(voteRevealMessage, "Revealing impostor");

      voteResultScreen.classList.remove("hidden");
      voteResultScreen.classList.add("show", "fade-hidden");

      requestAnimationFrame(() => {
        voteResultScreen.classList.remove("fade-hidden");
        voteResultScreen.classList.add("fade-visible");
      });

      setTimeout(() => {
        stopDotAnimation();
        voteRevealMessage.textContent = "Revealing impostor.";

        const votedOutDisplay = document.getElementById("votedOutDisplay");
        const impostorReveal = document.getElementById("impostorReveal");

        if (isImpostor) {
          votedOutDisplay.innerHTML = `
            <p>✓ <strong>${votedOut.username}</strong> was voted out.</p>
            <p style="color: #10b981; font-size: 1.3rem; margin-top: 0.5rem;">They WERE the impostor!</p>
          `;
        } else {
          votedOutDisplay.innerHTML = `
            <p>✗ <strong>${votedOut.username}</strong> was voted out.</p>
            <p style="color: #fb7185; font-size: 1.3rem; margin-top: 0.5rem;">They were NOT the impostor.</p>
          `;
        }

        impostorReveal.innerHTML = `
          <p>The actual impostor was:</p>
          <p style="color: #fbbf24; font-size: 2rem; margin-top: 0.5rem;"><strong>${impostor.username}</strong></p>
        `;

        voteResultsContent.classList.remove("result-hidden");
        voteResultsContent.classList.add("show");

        setTimeout(() => {
          voteResultScreen.classList.add("hidden");
          voteResultScreen.classList.remove("show", "fade-visible");
          location.reload();
        }, 5000);
      }, 5000);
    }, 650);
  }, 2500);
});

function voteForPlayer(playerId, button, username) {
  if (hasVoted) return;

  socket.emit("voteOut", {
    roomCode: currentRoom,
    votedForId: playerId
  });

  hasVoted = true;
  button.classList.add("voted");
  button.textContent = `${username} (voted)`;

  const allButtons = document.querySelectorAll(".voteButton");
  allButtons.forEach(btn => {
    btn.disabled = true;
  });
}

function startVoteTimer() {
  const timerElement = document.getElementById("voteTimer");
  let timeRemaining = 12;

  const timerInterval = setInterval(() => {
    timeRemaining--;
    timerElement.textContent = `Time remaining: ${timeRemaining}s`;

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}