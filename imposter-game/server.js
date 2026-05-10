const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

io.on("connection", socket => {
  socket.on("joinRoom", ({ roomCode, username }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        word: "",
        category: "",
        impostorId: null,
        turnOrder: [],
        turnIndex: 0,
        turnClues: [],
        turnTakingActive: false,
        turnTimer: null,
        endDiscussionVotes: {},
        turnTakingVotes: {},
        votingActive: false,
        playerVotes: {},
        voteTimer: null
      };
    }

    const room = rooms[roomCode];

    // Check if this socket is already in the room
    if (room.players.some(p => p.id === socket.id)) {
      socket.emit("joinRoomError", { message: "You are already in this room" });
      return;
    }

    // Check if room is full (max 6 players)
    if (room.players.length >= 6) {
      socket.emit("joinRoomError", { message: "Room is full (max 6 players)" });
      return;
    }

    // Check if username already exists in room (case-insensitive)
    if (room.players.some(p => p.username.toLowerCase() === username.toLowerCase())) {
      socket.emit("joinRoomError", { message: "Username already taken in this room" });
      return;
    }

    socket.join(roomCode);

    room.players.push({
      id: socket.id,
      username
    });

    io.to(roomCode).emit("playerList", room.players);
  });

  socket.on("startGame", roomCode => {
    const room = rooms[roomCode];
    if (!room || room.players.length < 3) return;
    if (room.players[0].id !== socket.id) return;

    io.to(roomCode).emit("gameStarted");
    startRound(roomCode);
  });

  socket.on("chatMessage", ({ roomCode, username, message }) => {
    io.to(roomCode).emit("chatMessage", {
      username,
      message
    });
  });

  socket.on("readyForTurnTaking", roomCode => {
    const room = rooms[roomCode];
    if (!room || room.turnTakingActive) return;
    startTurnTaking(roomCode);
  });

  socket.on("submitClue", ({ roomCode, clue }) => {
    const room = rooms[roomCode];
    if (!room || !room.turnTakingActive) return;

    const currentPlayer = room.turnOrder[room.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    clearTimeout(room.turnTimer);
    const clueEntry = {
      playerId: socket.id,
      username: currentPlayer.username,
      clue: clue || "",
      skipped: false
    };
    room.turnClues.push(clueEntry);
    io.to(roomCode).emit("turnClue", clueEntry);

    room.turnIndex += 1;
    startNextTurn(roomCode);
  });

  socket.on("voteEndDiscussion", roomCode => {
    const room = rooms[roomCode];
    if (!room) return;

    room.endDiscussionVotes[socket.id] = true;

    const voteCount = Object.keys(room.endDiscussionVotes).length;
    const neededVotes = Math.floor(room.players.length / 2) + 1;
    const voter = room.players.find(p => p.id === socket.id);

    if (voter) {
      io.to(roomCode).emit("discussionVoteMessage", {
        type: "endDiscussion",
        text: `${voter.username} voted to end discussion. (${voteCount}/${neededVotes} votes)`,
        votes: voteCount,
        needed: neededVotes
      });
    }

    if (voteCount >= neededVotes) {
      startVoting(roomCode);
      room.endDiscussionVotes = {};
      room.turnTakingVotes = {};
    }
  });

  socket.on("voteTurnTaking", roomCode => {
    const room = rooms[roomCode];
    if (!room) return;

    room.turnTakingVotes[socket.id] = true;

    const voteCount = Object.keys(room.turnTakingVotes).length;
    const neededVotes = Math.floor(room.players.length / 2) + 1;
    const voter = room.players.find(p => p.id === socket.id);

    if (voter) {
      io.to(roomCode).emit("discussionVoteMessage", {
        type: "turnTaking",
        text: `${voter.username} voted to do additional turns. (${voteCount}/${neededVotes} votes)`,
        votes: voteCount,
        needed: neededVotes
      });
    }

    if (voteCount >= neededVotes) {
      room.endDiscussionVotes = {};
      room.turnTakingVotes = {};
      startTurnTaking(roomCode);
    }
  });

  socket.on("voteOut", ({ roomCode, votedForId }) => {
    const room = rooms[roomCode];
    if (!room || !room.votingActive) return;

    room.playerVotes[socket.id] = votedForId;

    const voteDetails = room.players.map(player => ({
      id: player.id,
      username: player.username,
      voters: []
    }));

    Object.entries(room.playerVotes).forEach(([voterId, targetId]) => {
      const voter = room.players.find(p => p.id === voterId);
      const entry = voteDetails.find(item => item.id === targetId);
      if (voter && entry) {
        entry.voters.push(voter.username);
      }
    });

    io.to(roomCode).emit("voteUpdate", {
      votesCast: Object.keys(room.playerVotes).length,
      totalPlayers: room.players.length,
      voteDetails
    });

    if (Object.keys(room.playerVotes).length === room.players.length) {
      endVoting(roomCode);
    }
  });

  socket.on("leaveRoom", roomCode => {
    const room = rooms[roomCode];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    io.to(roomCode).emit("playerList", room.players);
    socket.leave(roomCode);

    if (room.players.length === 0) {
      delete rooms[roomCode];
    }
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      rooms[roomCode].players =
        rooms[roomCode].players.filter(p => p.id !== socket.id);

      io.to(roomCode).emit("playerList", rooms[roomCode].players);
    }
  });
});

function startVoting(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.votingActive = true;
  room.playerVotes = {};

  io.to(roomCode).emit("votingStarted", {
    players: room.players
  });

  io.to(roomCode).emit("voteUpdate", {
    votesCast: 0,
    totalPlayers: room.players.length,
    voteDetails: room.players.map(player => ({
      id: player.id,
      username: player.username,
      voters: []
    }))
  });

  room.voteTimer = setTimeout(() => {
    endVoting(roomCode);
  }, 12000);
}

function endVoting(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.votingActive = false;
  clearTimeout(room.voteTimer);

  const voteCounts = {};
  room.players.forEach(player => {
    voteCounts[player.id] = 0;
  });

  Object.values(room.playerVotes).forEach(votedForId => {
    if (voteCounts[votedForId] !== undefined) {
      voteCounts[votedForId]++;
    }
  });

  const maxVotes = Math.max(...Object.values(voteCounts));
  const votedOutCandidates = Object.keys(voteCounts).filter(
    id => voteCounts[id] === maxVotes
  );

  const votedOutId = votedOutCandidates[
    Math.floor(Math.random() * votedOutCandidates.length)
  ];

  const votedOutPlayer = room.players.find(p => p.id === votedOutId);
  const isImpostor = votedOutId === room.impostorId;
  const impostorPlayer = room.players.find(p => p.id === room.impostorId);

  io.to(roomCode).emit("voteResults", {
    votedOut: votedOutPlayer,
    isImpostor,
    impostor: impostorPlayer,
    voteCounts
  });

  room.playerVotes = {};
}

function startRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length < 2) return;

  const categories = [
    { category: "Food", words: ["Pizza", "Burger", "Pasta", "Sushi", "Cake"] },
    { category: "Animals", words: ["Dragon", "Lion", "Eagle", "Shark", "Panda"] },
    { category: "Technology", words: ["Rocket", "Laptop", "Phone", "Robot", "Drone"] },
    { category: "Places", words: ["Beach", "Mountain", "Castle", "Forest", "City"] },
    { category: "Objects", words: ["Guitar", "Clock", "Book", "Car", "Key"] }
  ];

  const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
  const selectedWord = selectedCategory.words[Math.floor(Math.random() * selectedCategory.words.length)];

  room.category = selectedCategory.category;
  room.word = selectedWord;
  room.turnOrder = shuffle(room.players.slice());
  room.turnIndex = 0;
  room.turnClues = [];
  room.turnTakingActive = false;
  clearTimeout(room.turnTimer);
  room.turnTimer = null;

  const impostor =
    room.players[Math.floor(Math.random() * room.players.length)];

  room.impostorId = impostor.id;

  room.players.forEach(player => {
    if (player.id === room.impostorId) {
      io.to(player.id).emit("role", {
        role: "impostor",
        category: room.category,
        word: room.word
      });
    } else {
      io.to(player.id).emit("role", {
        role: "detective",
        category: room.category,
        word: room.word
      });
    }
  });

  room.currentSpeakerIndex = -1;
}

function startTurnTaking(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.turnTakingActive || room.players.length === 0) return;

  room.turnTakingActive = true;
  room.turnOrder = shuffle(room.players.slice());
  room.turnIndex = 0;
  room.turnClues = [];

  io.to(roomCode).emit("turnTakingStarted", {
    totalTurns: room.turnOrder.length
  });

  startNextTurn(roomCode);
}

function startNextTurn(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.turnTakingActive) return;

  if (room.turnIndex >= room.turnOrder.length) {
    endTurnTaking(roomCode);
    return;
  }

  const currentPlayer = room.turnOrder[room.turnIndex];
  if (!currentPlayer) {
    room.turnIndex += 1;
    startNextTurn(roomCode);
    return;
  }

  io.to(roomCode).emit("turnStart", {
    currentTurnId: currentPlayer.id,
    currentTurnName: currentPlayer.username,
    currentIndex: room.turnIndex + 1,
    totalTurns: room.turnOrder.length
  });

  clearTimeout(room.turnTimer);
  room.turnTimer = setTimeout(() => {
    const skippedEntry = {
      playerId: currentPlayer.id,
      username: currentPlayer.username,
      clue: "",
      skipped: true
    };
    room.turnClues.push(skippedEntry);
    io.to(roomCode).emit("turnClue", skippedEntry);
    room.turnIndex += 1;
    startNextTurn(roomCode);
  }, 12000);
}

function endTurnTaking(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.turnTakingActive = false;
  clearTimeout(room.turnTimer);
  room.turnTimer = null;

  io.to(roomCode).emit("turnTakingComplete");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});