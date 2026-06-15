import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
app.use(express.json());

const PORT = 3000;

// IN-MEMORY DATABASE (Zero PII, stores only room, bed, avatar and active state)
interface PlayerSession {
  id: string; // room-bed, e.g., "102-B"
  room: string;
  bed: string;
  avatar: string;
  lastSeen: number;
  isStaff?: boolean;
  staffName?: string;
}

interface ChatMessage {
  id: string;
  senderId: string; // "102-B"
  senderLabel: string; // "Room 102 Bed B"
  senderAvatar: string;
  receiverId: string; // "103-A" or "all"
  text: string;
  timestamp: number;
}

interface GameInvite {
  id: string;
  senderId: string;
  senderLabel: string;
  senderAvatar: string;
  receiverId: string;
  gameType: "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee";
  status: "pending" | "accepted" | "declined";
  gameId: string;
}

interface GameSession {
  id: string;
  gameType: string;
  players: string[]; // IDs
  playerDetails: { [id: string]: { label: string; avatar: string } };
  state: any; // Game-specific board or game info
  lastUpdate: number;
}

let facilityPin: string | null = null; // Stored in-memory, first PIN entry sets it

interface Announcement {
  id: string;
  text: string;
  senderId: string;
  senderLabel: string;
  senderAvatar: string;
  target: string; // "all", "wing-1", "wing-2", "wing-3", or room number
  timestamp: number;
}

interface AnnouncementReport {
  id: string;
  announcementId: string;
  reportedBy: string;
  timestamp: number;
}

let announcements: Announcement[] = [];
let announcementReports: AnnouncementReport[] = [];

let activePlayers: { [id: string]: PlayerSession } = {};
let messages: ChatMessage[] = [];
let invites: GameInvite[] = [];
let games: { [id: string]: GameSession } = {};

// Clean up expired sessions (inactive for over 15 seconds)
setInterval(() => {
  const now = Date.now();
  const timeout = 15000;

  for (const id in activePlayers) {
    if (now - activePlayers[id].lastSeen > timeout) {
      console.log(`Player disconnected due to inactivity: ${id}`);
      delete activePlayers[id];

      // Cancel pending invites from or to this player
      invites = invites.filter(
        (inv) => inv.senderId !== id && inv.receiverId !== id
      );

      // Clean up games this player was in
      for (const gameId in games) {
        if (games[gameId].players.includes(id)) {
          // If in progress, we can end it or notify the opponent
          games[gameId].players = games[gameId].players.filter((p) => p !== id);
          if (games[gameId].players.length === 0) {
            delete games[gameId];
          } else {
            games[gameId].state.ended = true;
            games[gameId].state.statusMessage = "Opponent disconnected";
            games[gameId].lastUpdate = now;
          }
        }
      }
    }
  }
}, 5000);

// API ENDPOINTS

// 0. PIN Setup status check
app.get("/api/pin-status", (req, res) => {
  res.json({ facilityPinSet: !!facilityPin });
});

// Reset PIN
app.post("/api/pin-reset", (req, res) => {
  facilityPin = null;
  console.log("Facility PIN reset to null by client.");
  res.json({ success: true, facilityPinSet: false });
});

// 1. Join / Register
app.post("/api/register", (req, res) => {
  const { room, bed, avatar, pin, staffName } = req.body;
  if (!room || !bed || !avatar) {
    res.status(400).json({ error: "Room, Bed and Avatar are required" });
    return;
  }

  const cleanRoom = String(room).trim().substring(0, 10);
  const cleanBed = String(bed).trim().toUpperCase().substring(0, 5);
  const id = `${cleanRoom}-${cleanBed}`;

  const STAFF_AVATARS = ["👩‍⚕️", "🧑‍⚕️", "💼", "🥪"];
  const isStaffAvatar = STAFF_AVATARS.includes(avatar);

  let isStaff = false;
  if (isStaffAvatar) {
    if (!pin) {
      res.status(400).json({ error: "Facility PIN is required for staff registration." });
      return;
    }
    const cleanPin = String(pin).trim();
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      res.status(400).json({ error: "Facility PIN must be between 4 and 6 digits." });
      return;
    }

    if (!facilityPin) {
      facilityPin = cleanPin;
      isStaff = true;
      console.log(`Facility PIN initialized by ${staffName || id} to: ${facilityPin}`);
    } else if (facilityPin === cleanPin) {
      isStaff = true;
    } else {
      res.status(401).json({ error: "Incorrect Facility PIN! Please enter the correct PIN or choose a resident character." });
      return;
    }
  }

  activePlayers[id] = {
    id,
    room: cleanRoom,
    bed: cleanBed,
    avatar,
    lastSeen: Date.now(),
    isStaff,
    staffName: staffName ? String(staffName).trim() : undefined,
  };

  console.log(`Senior joined: ${id} as ${avatar} (isStaff: ${isStaff})`);
  res.json({ success: true, player: activePlayers[id] });
});

// 2. Heartbeat (keeps user active, retrieves system state updates)
app.post("/api/heartbeat", (req, res) => {
  const { playerId } = req.body;
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }

  const p = activePlayers[playerId];
  if (p) {
    p.lastSeen = Date.now();
  } else {
    // If player vanished, let client know they should re-register
    res.json({ error: "Session expired", registerRequired: true });
    return;
  }

  // Get active online friends (excluding self)
  const playersList = Object.values(activePlayers)
    .filter((player) => player.id !== playerId)
    .map((player) => ({
      id: player.id,
      label: player.isStaff 
        ? (player.staffName || `Staff ${player.avatar}`)
        : `Room ${player.room} - Bed ${player.bed}`,
      avatar: player.avatar,
    }));

  // Fetch relevant messages (either to "all" or specific to this room, or from this room)
  const playerMsgs = messages.filter(
    (m) =>
      m.receiverId === "all" ||
      m.receiverId === playerId ||
      m.senderId === playerId
  ).slice(-30); // limit to last 30 for performance

  // Fetch active game invites
  const playerInvites = invites.filter(
    (inv) => inv.senderId === playerId || inv.receiverId === playerId
  );

  // Fetch any active games this player is currently in
  const activeGames = Object.values(games).filter((g) =>
    g.players.includes(playerId)
  );

  // Match announcement targets: "all", wing specific ("wing-1", "wing-2", "wing-3"), or direct room number
  const matchTarget = (target: string, playerRoom: string) => {
    if (target === "all") return true;
    if (target === "wing-1" && playerRoom.startsWith("1")) return true;
    if (target === "wing-2" && playerRoom.startsWith("2")) return true;
    if (target === "wing-3" && playerRoom.startsWith("3")) return true;
    if (target === playerRoom) return true;
    return false;
  };

  const playerAnnouncements = announcements.filter((a) => matchTarget(a.target, p.room));

  // Generate audit logs and reports list only if the player is authenticated as Staff
  let staffLogs: any[] = [];
  let reportsList: any[] = [];
  if (p.isStaff) {
    staffLogs = announcements.map((a) => ({
      ...a,
      reportsCount: announcementReports.filter((r) => r.announcementId === a.id).length,
    }));
    reportsList = announcementReports;
  }

  // Fetch games of type bingo, uno, yahtzee, or checkers that are NOT finished and does NOT include sender
  const joinableGamesList = Object.values(games)
    .filter((g) => !g.players.includes(playerId) && !g.state?.ended)
    .map((g) => {
      const hostId = g.players[0] || "";
      return {
        id: g.id,
        gameType: g.gameType,
        hostName: g.playerDetails[hostId]?.label || `Room ${hostId.split("-")[0]}`,
        hostAvatar: g.playerDetails[hostId]?.avatar || "👤",
        playerCount: g.players.length,
      };
    });

  res.json({
    success: true,
    players: playersList,
    messages: playerMsgs,
    invites: playerInvites,
    activeGames,
    joinableGames: joinableGamesList,
    announcements: playerAnnouncements,
    staffLogs,
    reportsList,
    facilityPinSet: !!facilityPin,
  });
});

// 3. Send Message
app.post("/api/message", (req, res) => {
  const { senderId, receiverId, text } = req.body;
  if (!senderId || !receiverId || !text) {
    res.status(400).json({ error: "Missing sender, receiver, or text" });
    return;
  }

  const sender = activePlayers[senderId];
  if (!sender) {
    res.status(404).json({ error: "Sender session not found" });
    return;
  }

  const senderLabel = sender.isStaff 
    ? (sender.staffName || `Staff ${sender.avatar}`) 
    : `Room ${sender.room} (Bed ${sender.bed})`;

  const newMessage: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    senderId,
    senderLabel,
    senderAvatar: sender.avatar,
    receiverId,
    text: String(text).substring(0, 500),
    timestamp: Date.now(),
  };

  messages.push(newMessage);
  console.log(`Message from ${newMessage.senderLabel}: ${newMessage.text}`);

  // Keep messages array trimmed
  if (messages.length > 200) {
    messages = messages.slice(-200);
  }

  res.json({ success: true, message: newMessage });
});

// 3.5. Send Staff Announcement (Rate-limited, verified Staff only)
app.post("/api/announcement/send", (req, res) => {
  const { senderId, text, target } = req.body;
  if (!senderId || !text) {
    res.status(400).json({ error: "Missing senderId or text copy" });
    return;
  }

  const sender = activePlayers[senderId];
  if (!sender) {
    res.status(404).json({ error: "Staff session not found on server" });
    return;
  }

  if (!sender.isStaff) {
    res.status(403).json({ error: "Access denied. Only registered facility staff can broadcast announcements." });
    return;
  }

  const now = Date.now();
  // Rate limit check: wait at least 5 seconds between consecutive broadcasts from this sender
  const lastStaffAnnounce = announcements.filter((a) => a.senderId === senderId);
  if (lastStaffAnnounce.length > 0) {
    const lastTimestamp = lastStaffAnnounce[lastStaffAnnounce.length - 1].timestamp;
    if (now - lastTimestamp < 5000) {
      res.status(429).json({ error: "Rate limit exceeded. Please wait 5 seconds before sending another announcement." });
      return;
    }
  }

  const senderLabel = sender.staffName ? sender.staffName : `Staff ${sender.avatar}`;
  const newAnnouncement: Announcement = {
    id: `ann-${now}-${Math.random().toString(36).substr(2, 5)}`,
    text: String(text).trim().substring(0, 1000),
    senderId,
    senderLabel,
    senderAvatar: sender.avatar,
    target: target || "all",
    timestamp: now,
  };

  announcements.push(newAnnouncement);
  console.log(`[Staff Announcement Broadcast] ${senderLabel} to target "${target || "all"}": ${newAnnouncement.text}`);

  // Keep list tidy
  if (announcements.length > 100) {
    announcements = announcements.slice(-100);
  }

  res.json({ success: true, announcement: newAnnouncement });
});

// 3.6. Report Staff Announcement
app.post("/api/announcement/report", (req, res) => {
  const { announcementId, reportedBy } = req.body;
  if (!announcementId) {
    res.status(400).json({ error: "Missing announcementId" });
    return;
  }

  const report: AnnouncementReport = {
    id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    announcementId,
    reportedBy: reportedBy || "Resident",
    timestamp: Date.now(),
  };

  announcementReports.push(report);
  console.log(`[Announcement Reported] ${announcementId} was marked by ${reportedBy}`);
  res.json({ success: true });
});

// 4. Send Game Invite
app.post("/api/invite", (req, res) => {
  const { senderId, receiverId, gameType } = req.body;
  if (!senderId || !receiverId || !gameType) {
    res.status(400).json({ error: "Missing sender, receiver, or gameType" });
    return;
  }

  const sender = activePlayers[senderId];
  if (!sender) {
    res.status(404).json({ error: "Sender not online" });
    return;
  }

  // Remove existing pending invites between these two players to avoid duplicates
  invites = invites.filter(
    (inv) =>
      !(
        (inv.senderId === senderId && inv.receiverId === receiverId) ||
        (inv.senderId === receiverId && inv.receiverId === senderId)
      )
  );

  const newInvite: GameInvite = {
    id: `invite-${Date.now()}`,
    senderId,
    senderLabel: `Room ${sender.room} (Bed ${sender.bed})`,
    senderAvatar: sender.avatar,
    receiverId,
    gameType,
    status: "pending",
    gameId: `game-${Date.now()}`,
  };

  invites.push(newInvite);
  console.log(`Invite from ${newInvite.senderLabel} to play ${gameType}`);
  res.json({ success: true, invite: newInvite });
});

// 5. Respond to Game Invite
app.post("/api/invite/respond", (req, res) => {
  const { inviteId, status } = req.body;
  if (!inviteId || !status) {
    res.status(400).json({ error: "Missing inviteId or status" });
    return;
  }

  const invite = invites.find((inv) => inv.id === inviteId);
  if (!invite) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  invite.status = status;

  if (status === "accepted") {
    const p1 = activePlayers[invite.senderId];
    const p2 = activePlayers[invite.receiverId];

    if (!p1 || !p2) {
      invite.status = "declined";
      res.status(400).json({ error: "One of the players went offline." });
      return;
    }

    // Initialize game session state
    let initialGameState: any = {
      turn: invite.senderId,
      statusMessage: "Game started! Red plays first.",
      ended: false,
    };

    // Game Specific Defaults
    if (invite.gameType === "bingo") {
      initialGameState = {
        calledNumbers: [],
        started: true,
        callerActive: true, // Auto caller active
        winner: null,
      };
    } else if (invite.gameType === "checkers") {
      // 8x8 checkers board representation
      // r = red, b = black, R = red king, B = black king, e = empty
      const initialBoard = [
        ["e", "b", "e", "b", "e", "b", "e", "b"],
        ["b", "e", "b", "e", "b", "e", "b", "e"],
        ["e", "b", "e", "b", "e", "b", "e", "b"],
        ["e", "e", "e", "e", "e", "e", "e", "e"],
        ["e", "e", "e", "e", "e", "e", "e", "e"],
        ["r", "e", "r", "e", "r", "e", "r", "e"],
        ["e", "r", "e", "r", "e", "r", "e", "r"],
        ["r", "e", "r", "e", "r", "e", "r", "e"],
      ];
      initialGameState = {
        board: initialBoard,
        turn: invite.senderId, // Player 1 is Red
        colorMap: {
          [invite.senderId]: "red",
          [invite.receiverId]: "black",
        },
        ended: false,
        winner: null,
      };
    } else if (invite.gameType === "uno") {
      initialGameState = {
        deckCount: 40,
        discardPile: [{ color: "red", value: "5" }],
        playerHands: {
          [invite.senderId]: [
            { color: "red", value: "3" },
            { color: "blue", value: "Skip" },
            { color: "yellow", value: "7" },
            { color: "green", value: "Draw 2" },
            { color: "wild", value: "Wild" },
          ],
          [invite.receiverId]: [
            { color: "green", value: "2" },
            { color: "red", value: "8" },
            { color: "blue", value: "Reverse" },
            { color: "yellow", value: "4" },
            { color: "wild", value: "Wild" },
          ],
        },
        turn: invite.senderId,
        ended: false,
        winner: null,
      };
    } else if (invite.gameType === "yahtzee") {
      initialGameState = {
        dice: [1, 1, 1, 1, 1],
        held: [false, false, false, false, false],
        rollCount: 0,
        scores: {
          [invite.senderId]: {},
          [invite.receiverId]: {},
        },
        turn: invite.senderId,
        ended: false,
        winner: null,
      };
    }

    games[invite.gameId] = {
      id: invite.gameId,
      gameType: invite.gameType,
      players: [invite.senderId, invite.receiverId],
      playerDetails: {
        [invite.senderId]: {
          label: `Room ${p1.room} (Bed ${p1.bed})`,
          avatar: p1.avatar,
        },
        [invite.receiverId]: {
          label: `Room ${p2.room} (Bed ${p2.bed})`,
          avatar: p2.avatar,
        },
      },
      state: initialGameState,
      lastUpdate: Date.now(),
    };

    console.log(`Game created! ${invite.gameType} (${invite.gameId})`);
  }

  // Remove the invite once responded
  invites = invites.filter((inv) => inv.id !== inviteId);

  res.json({ success: true, gameId: invite.gameId });
});

// 6. Push Game Move/Action
app.post("/api/game/action", (req, res) => {
  const { gameId, playerId, state } = req.body;
  if (!gameId || !playerId || !state) {
    res.status(400).json({ error: "Missing gameId, playerId, or state" });
    return;
  }

  const game = games[gameId];
  if (!game) {
    res.status(404).json({ error: "Game session not found" });
    return;
  }

  // Verify player is in game
  if (!game.players.includes(playerId)) {
    res.status(403).json({ error: "Unauthorized game player" });
    return;
  }

  // Update State
  if (game.gameType === "bingo") {
    // If the game already has a winner and the incoming state resets the game (winner is null)
    const isReset = state.winner === null;

    if (isReset) {
      // Allow complete reset of the game state
      game.state = state;
    } else {
      // Merge calledNumbers arrays to include union of all called numbers so far
      const currentCalled = Array.isArray(game.state?.calledNumbers) ? game.state.calledNumbers : [];
      const incomingCalled = Array.isArray(state?.calledNumbers) ? state.calledNumbers : [];
      
      // Union called numbers
      const mergedCalled = Array.from(new Set([...currentCalled, ...incomingCalled])).sort((a, b) => a - b);
      state.calledNumbers = mergedCalled;

      // Handle winner / ended protection
      if (game.state?.winner) {
        state.winner = game.state.winner;
        state.winnerName = game.state.winnerName;
        state.statusMessage = game.state.statusMessage;
        state.ended = true;
      }
      game.state = state;
    }
  } else {
    game.state = state;
  }
  
  game.lastUpdate = Date.now();

  res.json({ success: true, state: game.state });
});

// 7. Leave Game
app.post("/api/game/leave", (req, res) => {
  const { gameId, playerId } = req.body;
  if (!gameId || !playerId) {
    res.status(400).json({ error: "Missing gameId or playerId" });
    return;
  }

  const game = games[gameId];
  if (game) {
    console.log(`Player ${playerId} is leaving game ${gameId}`);
    game.players = game.players.filter((p) => p !== playerId);
    if (game.players.length === 0) {
      delete games[gameId];
    } else {
      game.state.ended = true;
      game.state.statusMessage = "Opponent left the game.";
      game.lastUpdate = Date.now();
    }
  }

  res.json({ success: true });
});

// 8. Create/Host Public Group Game Lobby
app.post("/api/game/create", (req, res) => {
  const { playerId, gameType } = req.body;
  if (!playerId || !gameType) {
    res.status(400).json({ error: "Missing playerId or gameType" });
    return;
  }

  const p = activePlayers[playerId];
  if (!p) {
    res.status(404).json({ error: "Player not online" });
    return;
  }

  const gameId = `game-${gameType}-${Date.now()}`;

  // Initialize game session state
  let initialGameState: any = {
    turn: playerId,
    statusMessage: `Group game started by Room ${p.room}!`,
    ended: false,
  };

  if (gameType === "bingo") {
    initialGameState = {
      calledNumbers: [],
      started: true,
      callerActive: true,
      winner: null,
      winnerName: null,
      statusMessage: "Multiplayer Bingo starting! Bring your luck!",
    };
  } else if (gameType === "checkers") {
    const initialBoard = [
      ["e", "b", "e", "b", "e", "b", "e", "b"],
      ["b", "e", "b", "e", "b", "e", "b", "e"],
      ["e", "b", "e", "b", "e", "b", "e", "b"],
      ["e", "e", "e", "e", "e", "e", "e", "e"],
      ["e", "e", "e", "e", "e", "e", "e", "e"],
      ["r", "e", "r", "e", "r", "e", "r", "e"],
      ["e", "r", "e", "r", "e", "r", "e", "r"],
      ["r", "e", "r", "e", "r", "e", "r", "e"],
    ];
    initialGameState = {
      board: initialBoard,
      turn: playerId,
      colorMap: {
        [playerId]: "red"
      },
      ended: false,
      winner: null,
      statusMessage: "Checkers match setup in progress!",
    };
  } else if (gameType === "uno") {
    initialGameState = {
      deckCount: 40,
      discardPile: [{ color: "red", value: "5" }],
      playerHands: {
        [playerId]: [
          { color: "red", value: "3" },
          { color: "blue", value: "Skip" },
          { color: "yellow", value: "7" },
          { color: "green", value: "Draw 2" },
          { color: "wild", value: "Wild" },
        ],
      },
      turn: playerId,
      ended: false,
      winner: null,
      statusMessage: "Uno lobby started! Play card matching color/number.",
    };
  } else if (gameType === "yahtzee") {
    const blankCard: any = {};
    const categoriesId = ["ones", "twos", "threes", "fours", "fives", "sixes", "threeOfAKind", "fourOfAKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"];
    categoriesId.forEach((catId) => {
      blankCard[catId] = null;
    });

    initialGameState = {
      dice: [1, 1, 1, 1, 1],
      held: [false, false, false, false, false],
      rollCount: 0,
      scores: {
        [playerId]: blankCard,
      },
      turn: playerId,
      ended: false,
      winner: null,
      statusMessage: "Yahtzee game started! Take your turn to roll dice.",
    };
  }

  games[gameId] = {
    id: gameId,
    gameType,
    players: [playerId],
    playerDetails: {
      [playerId]: {
        label: `Room ${p.room} (Bed ${p.bed})`,
        avatar: p.avatar,
      },
    },
    state: initialGameState,
    lastUpdate: Date.now(),
  };

  console.log(`Hosted group lobby created: ${gameType} (${gameId}) by ${playerId}`);
  res.json({ success: true, gameId });
});

// 9. Join Group Game Lobby In-Progress
app.post("/api/game/join", (req, res) => {
  const { gameId, playerId } = req.body;
  if (!gameId || !playerId) {
    res.status(400).json({ error: "Missing gameId or playerId" });
    return;
  }

  const game = games[gameId];
  if (!game) {
    res.status(404).json({ error: "Game session not found" });
    return;
  }

  const p = activePlayers[playerId];
  if (!p) {
    res.status(404).json({ error: "Player not online" });
    return;
  }

  // Already joined, return success
  if (game.players.includes(playerId)) {
    res.json({ success: true, gameId });
    return;
  }

  // Register player in session
  game.players.push(playerId);
  game.playerDetails[playerId] = {
    label: `Room ${p.room} (Bed ${p.bed})`,
    avatar: p.avatar,
  };

  // Adjust game stats for joining player
  if (game.gameType === "uno") {
    if (!game.state.playerHands) {
      game.state.playerHands = {};
    }
    // Give player a starter hand of 5 cards
    game.state.playerHands[playerId] = [
      { color: "green", value: "4" },
      { color: "blue", value: "7" },
      { color: "red", value: "Skip" },
      { color: "yellow", value: "8" },
      { color: "wild", value: "Wild" },
    ];
    game.state.statusMessage = `Room ${p.room} has joined the Uno round!`;
  } else if (game.gameType === "yahtzee") {
    if (!game.state.scores) {
      game.state.scores = {};
    }
    const blankCard: any = {};
    const categoriesId = ["ones", "twos", "threes", "fours", "fives", "sixes", "threeOfAKind", "fourOfAKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"];
    categoriesId.forEach((catId) => {
      blankCard[catId] = null;
    });
    game.state.scores[playerId] = blankCard;
    game.state.statusMessage = `Room ${p.room} joined! Take turns rolling the dice!`;
  } else if (game.gameType === "checkers") {
    const isRedOccupied = Object.values(game.state.colorMap || {}).includes("red");
    const chosenColor = isRedOccupied ? "black" : "red";
    if (!game.state.colorMap) {
      game.state.colorMap = {};
    }
    game.state.colorMap[playerId] = chosenColor;
    game.state.statusMessage = `Room ${p.room} joined Checkers as ${chosenColor}!`;
  } else if (game.gameType === "bingo") {
    game.state.statusMessage = `Room ${p.room} joined our Bingo hall!`;
  }

  game.lastUpdate = Date.now();
  console.log(`Player ${p.room} joined game ${gameId}`);
  res.json({ success: true, gameId });
});

// VITE MIDDLEWARE SETUP
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from modern Vite build output folder `dist`
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
