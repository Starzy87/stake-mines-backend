const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---- Simple in-memory session (prototype only) ----
let session = {
  activeGame: null,
  nonce: 0,
};

// ---- Helper: deterministic floats from seeds ----
function hmac256(key, message) {
  return crypto.createHmac("sha256", key).update(message).digest();
}

function floatsFromSeeds(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  let i = 0;

  while (floats.length < count) {
    const msg = `${clientSeed}:${nonce}:${i++}`;
    const sig = hmac256(serverSeed, msg);

    for (let j = 0; j < 8; j++) {
      if (floats.length >= count) break;
      const val =
        (sig[j * 4] << 24) |
        (sig[j * 4 + 1] << 16) |
        (sig[j * 4 + 2] << 8) |
        sig[j * 4 + 3];

      floats.push((val >>> 0) / 4294967296);
    }
  }

  return floats;
}

// ---- Routes ----
app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/bet", (req, res) => {
  const { bet, mines, mode, clientSeed } = req.body;

  if (bet === undefined || mines === undefined || !clientSeed) {
    return res.status(400).json({ error: "Missing bet/mines/clientSeed" });
  }

  // demo server seed + hash (later we'll do proper commitment/rotation)
  const serverSeed = crypto.randomBytes(32).toString("hex");
  const nextHash = crypto.createHash("sha256").update(serverSeed).digest("hex");

  session.nonce += 1;

  const floats = floatsFromSeeds(serverSeed, clientSeed, session.nonce, 60);

  const allTiles = Array.from({ length: 25 }, (_, i) => i);
  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---- Simple in-memory session (prototype only) ----
let session = {
  activeGame: null,
  nonce: 0,
};

// ---- Helper: deterministic floats from seeds ----
function hmac256(key, message) {
  return crypto.createHmac("sha256", key).update(message).digest();
}

function floatsFromSeeds(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  let i = 0;

  while (floats.length < count) {
    const msg = `${clientSeed}:${nonce}:${i++}`;
    const sig = hmac256(serverSeed, msg);

    for (let j = 0; j < 8; j++) {
      if (floats.length >= count) break;
      const val =
        (sig[j * 4] << 24) |
        (sig[j * 4 + 1] << 16) |
        (sig[j * 4 + 2] << 8) |
        sig[j * 4 + 3];

      floats.push((val >>> 0) / 4294967296);
    }
  }

  return floats;
}

// ---- Routes ----
app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/bet", (req, res) => {
  const { bet, mines, mode, clientSeed } = req.body;

  if (bet === undefined || mines === undefined || !clientSeed) {
    return res.status(400).json({ error: "Missing bet/mines/clientSeed" });
  }

  // demo server seed + hash (later we'll do proper commitment/rotation)
  const serverSeed = crypto.randomBytes(32).toString("hex");
  const nextHash = crypto.createHash("sha256").update(serverSeed).digest("hex");

  session.nonce += 1;

  const floats = floatsFromSeeds(serverSeed, clientSeed, session.nonce, 60);

  const allTiles = Array.from({ length: 25 }, (_, i) => i);
  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
  }

  const mineLocations = allTiles.slice(0, Number(mines));

  // multiplier ladder (same logic as your frontend)
  const houseEdge = 0.964;
  const maxMoves = 25 - Number(mines);
  const multis = [];
  let current = 1;

  for (let i = 0; i < maxMoves; i++) {
    const totalRem = 25 - i;
    const safeRem = (25 - Number(mines)) - i;
    if (safeRem <= 0) break;
    const prob = safeRem / totalRem;
    current = current / prob;
    multis.push(current * houseEdge);
  }

  session.activeGame = {
    bet: Number(bet),
    baseBet: Number(bet),
    mines: mineLocations,
    revealed: [],
    multiStack: multis,
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---- Simple in-memory session (prototype only) ----
let session = {
  activeGame: null,
  nonce: 0,
};

// ---- Helper: deterministic floats from seeds ----
function hmac256(key, message) {
  return crypto.createHmac("sha256", key).update(message).digest();
}

function floatsFromSeeds(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  let i = 0;

  while (floats.length < count) {
    const msg = `${clientSeed}:${nonce}:${i++}`;
    const sig = hmac256(serverSeed, msg);

    for (let j = 0; j < 8; j++) {
      if (floats.length >= count) break;
      const val =
        (sig[j * 4] << 24) |
        (sig[j * 4 + 1] << 16) |
 (sig[j * 4 + 2] << 8) |
        sig[j * 4 + 3];

      floats.push((val >>> 0) / 4294967296);
    }
  }

  return floats;
}

// ---- Routes ----
app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/bet", (req, res) => {
  const { bet, mines, mode, clientSeed } = req.body;
 if (bet === undefined || mines === undefined || !clientSeed) {
    return res.status(400).json({ error: "Missing bet/mines/clientSeed" });
  }

  // demo server seed + hash (later we'll do proper commitment/rotation)
  const serverSeed = crypto.randomBytes(32).toString("hex");
  const nextHash = crypto.createHash("sha256").update(serverSeed).digest("hex");

  session.nonce += 1;

  const floats = floatsFromSeeds(serverSeed, clientSeed, session.nonce, 60);

  const allTiles = Array.from({ length: 25 }, (_, i) => i);
  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
  }

  const mineLocations = allTiles.slice(0, Number(mines));

  // multiplier ladder (same logic as your frontend)
  const houseEdge = 0.964;
  const maxMoves = 25 - Number(mines);
  const multis = [];
  let current = 1;

  for (let i = 0; i < maxMoves; i++) {
    const totalRem = 25 - i;
    const safeRem = (25 - Number(mines)) - i;
    if (safeRem <= 0) break;
    const prob = safeRem / totalRem;
    current = current / prob;
    multis.push(current * houseEdge);
  }


  session.activeGame = {
    bet: Number(bet),
    baseBet: Number(bet),
    mines: mineLocations,
    revealed: [],
    multiStack: multis,
    currentWin: 0,
    isOver: false,
    serverSeed,
    nextHash,
    mode: mode || "normal",
  };

  return res.json({
    success: true,
    nonce: session.nonce,
    nextHash,
    multipliers: multis,
  });
});

app.post("/reveal", (req, res) => {
  const { index } = req.body;

  if (index === undefined) {
    return res.status(400).json({ error: "Missing index" });
  }

  const game = session.activeGame;
  if (!game || game.isOver) {
    return res.status(400).json({ error: "No active game" });
  }

  if (game.revealed.includes(index)) {
    return res.status(400).json({ error: "Tile already revealed" });
  }

  if (game.mines.includes(index)) {
    game.isOver = true;
    return res.json({ status: "BOMB", mineMap: game.mines });
  }

  game.revealed.push(index);
  const stepIndex = game.revealed.length - 1;
const payout = game.bet * game.multiStack[stepIndex];
  game.currentWin = payout;

  return res.json({
    status: "SAFE",
    payout,
    multiplier: payout / game.baseBet,
  });
});

app.post("/cashout", (req, res) => {
  const game = session.activeGame;
  if (!game || game.isOver) {
    return res.status(400).json({ error: "No active game" });
  }

  game.isOver = true;

  return res.json({
    success: true,
    winAmount: game.currentWin,
    finalMultiplier: game.currentWin / game.baseBet,
    mineMap: game.mines,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

