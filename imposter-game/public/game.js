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
const chatArea = document.getElementById("chatArea");
const roomPlayers = document.getElementById("roomPlayers");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

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
  revealScreen.classList.remove("hidden");
  revealScreen.classList.add("show");

  playerArea.classList.add("hidden");
  chatArea.classList.add("hidden");

  setTimeout(() => {
    revealScreen.classList.add("hidden");
    revealScreen.classList.remove("show");
    // Wait for role event to show role screen
  }, 2000);
});

function revealGameDetails() {
  if (!gameScreen.classList.contains("hidden")) {
    playerArea.classList.remove("hidden");
    chatArea.classList.remove("hidden");

    const roleDisplay = document.getElementById("roleDisplay");
    if (playerRole === "impostor") {
      roleDisplay.textContent = "You are the IMPOSTOR";
      roleDisplay.style.color = "#fb7185";
    } else {
      roleDisplay.textContent = `Category: ${gameCategory} | Word: ${gameWord}`;
      roleDisplay.style.color = "#10b981";
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

  // Show role screen
  roleScreen.classList.remove("hidden");
  roleScreen.classList.add("show");

  // Start the sequence after role is shown
  setTimeout(() => {
    roleScreen.classList.add("hidden");
    roleScreen.classList.remove("show");
    categoryScreen.classList.remove("hidden");
    categoryScreen.classList.add("show");

    // After category animation, show word
    setTimeout(() => {
      categoryScreen.classList.add("hidden");
      categoryScreen.classList.remove("show");
      wordScreen.classList.remove("hidden");
      wordScreen.classList.add("show");

      // After word animation, go to discussion
      setTimeout(() => {
        wordScreen.classList.add("hidden");
        wordScreen.classList.remove("show");
        phaseDisplay.textContent = "Discuss about the word...";
        gameScreen.classList.remove("hidden");
        gameScreen.style.display = "block";
        revealGameDetails();
      }, 3000);
    }, 3000);
  }, 3000);
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
  gameScreen.classList.add("hidden");
  votingScreen.classList.remove("hidden");
  votingScreen.classList.add("show");

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

      voteResultScreen.classList.remove("hidden");
      voteResultScreen.classList.add("show", "fade-hidden");

      requestAnimationFrame(() => {
        voteResultScreen.classList.remove("fade-hidden");
        voteResultScreen.classList.add("fade-visible");
      });

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

      setTimeout(() => {
        voteResultScreen.classList.remove("fade-in");
      }, 600);

      setTimeout(() => {
        voteResultScreen.classList.add("hidden");
        voteResultScreen.classList.remove("show");
        location.reload();
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