// server.js (CommonJS) — minimal working API for your Mines-style frontend
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// -------------------- Helpers --------------------
function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSha256(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest();
}

// Generates deterministic floats in [0,1) using HMAC-SHA256 like your frontend
function generateFloats(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  let i = 0;

  while (floats.length < count) {
    const message = `${clientSeed}:${nonce}:${i++}`;
    const sig = hmacSha256(serverSeed, message); // Buffer(32)

    // split into 8 x 4 bytes => 8 uint32
    for (let j = 0; j < 8; j++) {
      if (floats.length >= count) break;
      const val = sig.readUInt32BE(j * 4); // 0..2^32-1
      floats.push(val / 4294967296); // 2^32
    }
  }
  return floats;
}

function shuffleWithFloats(arr, floats, offset = 0) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const r = floats[offset + i]; // use floats deterministically
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -------------------- In-memory session (demo) --------------------
const session = {
  balance: 5000.0,
  nonce: 0,
  serverSeed: null,
  nextServerSeed: null,
  nextServerHash: null,
  activeGame: null,
};

// Create first nextServerSeed/hash on boot
function initSeeds() {
  session.nextServerSeed = crypto.randomBytes(32).toString("hex");
  session.nextServerHash = sha256Hex(session.nextServerSeed);
}
initSeeds();

// -------------------- Routes --------------------
app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  // Render hits / sometimes; this prevents "Cannot GET /"
  res.send("Backend is running. Use /ping, /bet, /reveal, /cashout");
});

// Start a new bet/game
app.post("/bet", (req, res) => {
  try {
    const { bet, mines, mode, clientSeed } = req.body || {};

    const betNum = Number(bet);
    const minesNum = Number(mines);
    const modeStr = String(mode || "normal");
    const clientSeedStr = String(clientSeed || "");

    if (!Number.isFinite(betNum) || betNum <= 0) {
      return res.status(400).json({ error: "Invalid bet" });
    }
    if (!Number.isInteger(minesNum) || minesNum < 1 || minesNum > 24) {
      return res.status(400).json({ error: "Invalid mines" });
    }
    if (!clientSeedStr) {
      return res.status(400).json({ error: "Invalid clientSeed" });
    }

    // cost multiplier (keep same as your UI)
    let costMult = 1;
    if (modeStr === "boost10") costMult = 10;
    if (modeStr === "boost75") costMult = 75;

    const totalCost = betNum * costMult;
    if (totalCost > session.balance) {
      return res.status(400).json({ error: "Insufficient Funds" });
    }

    // advance seeds / nonce
    if (!session.serverSeed) session.serverSeed = session.nextServerSeed;
    else session.serverSeed = session.nextServerSeed;

    session.nonce += 1;

    // prepare next seed/hash
    session.nextServerSeed = crypto.randomBytes(32).toString("hex");
    session.nextServerHash = sha256Hex(session.nextServerSeed);

    // charge balance
    session.balance -= totalCost;

    // generate floats and mine locations
    const floats = generateFloats(session.serverSeed, clientSeedStr, session.nonce, 80);

    const allTiles = Array.from({ length: 25 }, (_, i) => i);
    const shuffled = shuffleWithFloats(allTiles, floats, 0);
    const mineLocations = shuffled.slice(0, minesNum);

    // multipliers (same concept as your frontend)
    const houseEdge = 0.964; // RTP 96.4%
    const maxMoves = 25 - minesNum;
    const multis = [];
    let current = 1;

    for (let i = 0; i < maxMoves; i++) {
      const totalRem = 25 - i;
      const safeRem = (25 - minesNum) - i;
      if (safeRem <= 0) break;
      const prob = safeRem / totalRem;
      current = current / prob;
      multis.push(current * houseEdge);
    }

    session.activeGame = {
      bet: totalCost,
      baseBet: betNum,
      mines: mineLocations,
      revealed: [],
      multiStack: multis,
      currentWin: 0,
      isOver: false,
      mode: modeStr,
      clientSeed: clientSeedStr,
    };

    return res.json({
      success: true,
      newBalance: session.balance,
      nonce: session.nonce,
      nextHash: session.nextServerHash,
      multipliers: multis,
      // helpful for debugging connectivity; remove later for production:
      mineLocations,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
});

// Reveal a tile
app.post("/reveal", (req, res) => {
  const { index } = req.body || {};
  const idx = Number(index);

  const game = session.activeGame;
  if (!game || game.isOver) return res.status(400).json({ error: "No active game" });
  if (!Number.isInteger(idx) || idx < 0 || idx > 24) return res.status(400).json({ error: "Invalid index" });
  if (game.revealed.includes(idx)) return res.status(400).json({ error: "Already revealed" });

  if (game.mines.includes(idx)) {
    game.isOver = true;
    return res.json({ status: "BOMB", mineMap: game.mines });
  }

  game.revealed.push(idx);
  const stepIndex = game.revealed.length - 1;

  let payout = game.bet * (game.multiStack[stepIndex] || 0);
  // cap example (same idea as your frontend)
  const cap = game.bet * 5000000;
  if (payout > cap) payout = cap;

  game.currentWin = payout;

  return res.json({
    status: "SAFE",
    payout,
    multiplier: payout / game.baseBet,
    step: stepIndex,
  });
});

// Cash out
app.post("/cashout", (req, res) => {
  const game = session.activeGame;
  if (!game || game.isOver) return res.status(400).json({ error: "No active game" });

  session.balance += game.currentWin;
  game.isOver = true;

  return res.json({
    success: true,
    winAmount: game.currentWin,
    finalMultiplier: game.currentWin / game.baseBet,
    newBalance: session.balance,
    mineMap: game.mines,
  });
});

// -------------------- Start --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

