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
        impostorId: null,
        currentSpeakerIndex: -1,
        endDiscussionVotes: {},
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

  socket.on("voteEndDiscussion", roomCode => {
    const room = rooms[roomCode];
    if (!room) return;

    room.endDiscussionVotes[socket.id] = true;

    const voteCount = Object.keys(room.endDiscussionVotes).length;
    const neededVotes = Math.floor(room.players.length / 2) + 1;

    io.to(roomCode).emit("endDiscussionVoteCount", {
      votes: voteCount,
      needed: neededVotes
    });

    if (voteCount >= neededVotes) {
      startVoting(roomCode);
      room.endDiscussionVotes = {};
    }
  });

  socket.on("voteOut", ({ roomCode, votedForId }) => {
    const room = rooms[roomCode];
    if (!room || !room.votingActive) return;

    room.playerVotes[socket.id] = votedForId;

    io.to(roomCode).emit("voteUpdate", {
      votesCast: Object.keys(room.playerVotes).length,
      totalPlayers: room.players.length
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


server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});