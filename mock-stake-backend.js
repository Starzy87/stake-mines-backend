/* ==============================================
   MOCK STAKE ENGINE BACKEND
   Purpose: Mimics Stake's API for frontend testing
   
   This lets you test Stake integration WITHOUT
   building the full Python Math SDK yet.
   
   Endpoints:
   - POST /wallet/authenticate
   - POST /wallet/balance  
   - POST /wallet/play
   - POST /wallet/end-round
   - POST /bet/event (optional)
============================================== */

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// =================================================================
// MOCK DATABASE
// =================================================================

const sessions = {
    "test-session-123": {
        balance: 5000 * 1000000, // $5,000 in micros
        currency: "USD",
        activeRound: null,
        roundHistory: []
    }
};

const getSession = (sessionID) => {
    if (!sessions[sessionID]) {
        sessions[sessionID] = {
            balance: 5000 * 1000000,
            currency: "USD",
            activeRound: null,
            roundHistory: []
        };
    }
    return sessions[sessionID];
};

// =================================================================
// GAME SIMULATION LOGIC
// =================================================================

function generateMinesRound(amount, mode, mineCount) {
    /*
    Generates a COMPLETE pre-determined Mines round
    
    Returns:
    {
        id: <roundId>,
        events: [<event>, ...],
        payoutMultiplier: <micros>
    }
    */
    
    const roundId = `round-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const events = [];
    
    // Determine cost multiplier
    let costMultiplier = 1;
    if (mode === "boost10") costMultiplier = 10;
    if (mode === "boost75") costMultiplier = 75;
    
    // 1. Setup Event
    const minePositions = generateMinePositions(mineCount);
    const boosterTiles = (mode !== "normal") ? generateBoosterTiles(minePositions, mode) : {};
    
    events.push({
        type: "MINE_SETUP",
        mineCount: mineCount,
        totalTiles: 25,
        betMode: mode,
        boostedTiles: Object.keys(boosterTiles).map(k => parseInt(k))
    });
    
    // 2. Determine how many tiles player will reveal
    const maxSafe = 25 - mineCount;
    const revealCount = determineRevealCount(maxSafe);
    
    // 3. Simulate reveals
    const safeTiles = [];
    for (let i = 0; i < 25; i++) {
        if (!minePositions.includes(i)) safeTiles.push(i);
    }
    
    // Shuffle safe tiles
    for (let i = safeTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [safeTiles[i], safeTiles[j]] = [safeTiles[j], safeTiles[i]];
    }
    
    let currentMultiplier = 1.0;
    const houseEdge = 0.964;
    let hitMine = false;
    let revealedCount = 0;
    
    for (let step = 0; step < revealCount; step++) {
        const tileIndex = safeTiles[step];
        
        // Calculate multiplier for this step
        const remainingTiles = 25 - step;
        const remainingSafe = maxSafe - step;
        const probability = remainingSafe / remainingTiles;
        const stepMultiplier = (1.0 / probability) * houseEdge;
        
        currentMultiplier *= stepMultiplier;
        
        // Check if this tile has a booster
        const isBooster = boosterTiles[tileIndex] !== undefined;
        let boosterMult = null;
        
        if (isBooster) {
            boosterMult = boosterTiles[tileIndex];
            currentMultiplier *= boosterMult;
        }
        
        const payoutMicros = Math.floor(amount * costMultiplier * currentMultiplier);
        
        events.push({
            type: "TILE_REVEAL",
            tileIndex: tileIndex,
            result: "SAFE",
            currentMultiplier: Math.round(currentMultiplier * 1000000) / 1000000,
            accumulatedPayout: payoutMicros,
            isBooster: isBooster,
            boosterMultiplier: boosterMult
        });
        
        revealedCount++;
    }
    
    // 4. Determine ending
    // 20% chance to hit mine on next click (if didn't reveal all safe tiles)
    if (revealedCount < maxSafe && Math.random() < 0.2) {
        // Hit a mine
        const mineTile = minePositions[Math.floor(Math.random() * minePositions.length)];
        
        events.push({
            type: "TILE_REVEAL",
            tileIndex: mineTile,
            result: "MINE",
            currentMultiplier: 0,
            accumulatedPayout: 0
        });
        
        events.push({
            type: "GAME_OVER",
            reason: "HIT_MINE",
            mineLocations: minePositions,
            finalPayout: 0
        });
        
        return {
            id: roundId,
            events: events,
            payoutMultiplier: 0,
            mineMap: minePositions,
            specialMap: boosterTiles
        };
    } else {
        // Cashed out successfully
        const finalPayout = Math.floor(amount * costMultiplier * currentMultiplier);
        
        events.push({
            type: "CASHOUT",
            finalPayout: finalPayout,
            finalMultiplier: Math.round(currentMultiplier * 1000000) / 1000000,
            revealedTiles: revealedCount
        });
        
        events.push({
            type: "GAME_OVER",
            reason: "CASHOUT",
            mineLocations: minePositions,
            finalPayout: finalPayout
        });
        
        return {
            id: roundId,
            events: events,
            payoutMultiplier: Math.floor(currentMultiplier * 1000000),
            finalPayout: finalPayout,
            mineMap: minePositions,
            specialMap: boosterTiles
        };
    }
}

function generateMinePositions(count) {
    const positions = [];
    while (positions.length < count) {
        const pos = Math.floor(Math.random() * 25);
        if (!positions.includes(pos)) positions.push(pos);
    }
    return positions.sort((a, b) => a - b);
}

function generateBoosterTiles(minePositions, mode) {
    const safeTiles = [];
    for (let i = 0; i < 25; i++) {
        if (!minePositions.includes(i)) safeTiles.push(i);
    }
    
    // Select 3 random safe tiles for boosters
    const boosterCount = Math.min(3, safeTiles.length);
    const boosters = {};
    
    for (let i = 0; i < boosterCount; i++) {
        const randomIndex = Math.floor(Math.random() * safeTiles.length);
        const tileIndex = safeTiles.splice(randomIndex, 1)[0];
        
        // Determine multiplier based on mode
        let mult = 1.5;
        const rand = Math.random();
        
        if (mode === "boost10") {
            if (rand < 0.01) mult = 10.0;
            else if (rand < 0.10) mult = 5.0;
            else if (rand < 0.40) mult = 3.0;
            else mult = 1.5;
        } else if (mode === "boost75") {
            if (rand < 0.05) mult = 50.0;
            else if (rand < 0.20) mult = 25.0;
            else if (rand < 0.50) mult = 10.0;
            else mult = 3.0;
        }
        
        boosters[tileIndex] = mult;
    }
    
    return boosters;
}

function determineRevealCount(maxSafe) {
    // Weighted random - most players cash out early
    const weights = [
        0.30, // 1 tile
        0.20, // 2 tiles
        0.15, // 3 tiles
        0.10, // 4 tiles
        0.08, // 5 tiles
        0.05, // 6 tiles
        0.04, // 7 tiles
        0.03, // 8 tiles
        0.02, // 9 tiles
        0.01, // 10 tiles
        0.01, // 11 tiles
        0.01  // 12+ tiles (evenly distributed)
    ];
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < Math.min(weights.length, maxSafe); i++) {
        cumulative += weights[i];
        if (rand < cumulative) {
            return i + 1;
        }
    }
    
    return Math.min(12, maxSafe);
}

// =================================================================
// STAKE ENGINE API ENDPOINTS
// =================================================================

// 1. AUTHENTICATE
app.post("/wallet/authenticate", (req, res) => {
    const { sessionID } = req.body;
    
    if (!sessionID) {
        return res.status(400).json({
            success: false,
            code: "ERR_VAL",
            message: "Missing sessionID"
        });
    }
    
    const user = getSession(sessionID);
    
    const response = {
        balance: {
            amount: user.balance,
            currency: user.currency
        },
        config: {
            minBet: 100000,        // $0.10
            maxBet: 1000000000,    // $1,000
            stepBet: 100000,       // $0.10
            defaultBetLevel: 1000000, // $1.00
            betLevels: [
                100000,   // $0.10
                200000,   // $0.20
                500000,   // $0.50
                1000000,  // $1.00
                5000000,  // $5.00
                10000000, // $10.00
                50000000, // $50.00
                100000000 // $100.00
            ],
            jurisdiction: {
                country: "CW",
                socialCasino: false,
                disabledFullscreen: false,
                disabledTurbo: false
            }
        }
    };
    
    // Include active round if exists
    if (user.activeRound) {
        response.round = user.activeRound;
    }
    
    return res.json(response);
});

// 2. BALANCE
app.post("/wallet/balance", (req, res) => {
    const { sessionID } = req.body;
    
    if (!sessionID) {
        return res.status(400).json({
            success: false,
            code: "ERR_VAL",
            message: "Missing sessionID"
        });
    }
    
    const user = getSession(sessionID);
    
    return res.json({
        balance: {
            amount: user.balance,
            currency: user.currency
        }
    });
});

// 3. PLAY (Place Bet)
app.post("/wallet/play", (req, res) => {
    const { sessionID, amount, mode } = req.body;
    
    if (!sessionID) {
        return res.status(400).json({
            success: false,
            code: "ERR_VAL",
            message: "Missing sessionID"
        });
    }
    
    if (!amount || typeof amount !== "number") {
        return res.status(400).json({
            success: false,
            code: "ERR_VAL",
            message: "Invalid amount"
        });
    }
    
    const user = getSession(sessionID);
    
    // Determine cost multiplier
    let costMultiplier = 1;
    const betMode = mode || "normal";
    if (betMode === "boost10") costMultiplier = 10;
    if (betMode === "boost75") costMultiplier = 75;
    
    const totalCost = amount * costMultiplier;
    
    // Check balance
    if (totalCost > user.balance) {
        return res.status(400).json({
            success: false,
            code: "ERR_IPB",
            message: "Insufficient Player Balance",
            balance: {
                amount: user.balance,
                currency: user.currency
            }
        });
    }
    
    // Debit balance
    user.balance -= totalCost;
    
    // Generate round (default to 5 mines for boosters, 3 for normal)
    const mineCount = (betMode !== "normal") ? 5 : 3;
    const round = generateMinesRound(amount, betMode, mineCount);
    
    // Store active round
    user.activeRound = round;
    
    return res.json({
        balance: {
            amount: user.balance,
            currency: user.currency
        },
        round: round
    });
});

// 4. END ROUND (Cashout)
app.post("/wallet/end-round", (req, res) => {
    const { sessionID } = req.body;
    
    if (!sessionID) {
        return res.status(400).json({
            success: false,
            code: "ERR_VAL",
            message: "Missing sessionID"
        });
    }
    
    const user = getSession(sessionID);
    
    if (!user.activeRound) {
        return res.status(400).json({
            success: false,
            code: "ERR_VAL",
            message: "No active round"
        });
    }
    
    // Credit payout
    const payout = user.activeRound.finalPayout || 0;
    user.balance += payout;
    
    // Clear active round
    user.roundHistory.push(user.activeRound);
    user.activeRound = null;
    
    return res.json({
        balance: {
            amount: user.balance,
            currency: user.currency
        }
    });
});

// 5. EVENT (Optional - track player actions)
app.post("/bet/event", (req, res) => {
    const { sessionID, event } = req.body;
    
    // Just acknowledge
    return res.json({
        event: event
    });
});

// =================================================================
// LEGACY COMPATIBILITY (for your current frontend)
// =================================================================

// Keep /api/init for backwards compatibility
app.get("/api/init", (req, res) => {
    const sessionID = req.query.sessionID || "test-session-123";
    const user = getSession(sessionID);
    
    return res.json({
        balance: user.balance,
        currency: user.currency,
        jurisdiction: {
            country: "CW",
            disabledTurbo: false,
            socialCasino: false
        },
        config: {
            minBet: 100000,
            maxBet: 1000000000
        },
        hash: "mock-hash-" + Date.now(),
        nonce: 0,
        activeGame: null
    });
});

// =================================================================
// START SERVER
// =================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   MOCK STAKE ENGINE BACKEND RUNNING ON PORT ${PORT}        ║
╚═══════════════════════════════════════════════════════════╝

Available Endpoints:
  POST /wallet/authenticate  → Validate session & get config
  POST /wallet/balance       → Get current balance
  POST /wallet/play          → Place bet (returns full round)
  POST /wallet/end-round     → Cash out (credit payout)
  POST /bet/event            → Track player action
  
  GET  /api/init             → Legacy compatibility

Test it:
  curl -X POST http://localhost:${PORT}/wallet/authenticate \\
    -H "Content-Type: application/json" \\
    -d '{"sessionID":"test-session-123"}'

Default Session: test-session-123
Default Balance: $5,000.00
    `);
});

