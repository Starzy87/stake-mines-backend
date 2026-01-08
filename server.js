/* ==============================================
   THE BRAIN: SERVER-SIDE GAME ENGINE (server.js)
   Strictly Compliant with Stake Math & RNG
============================================== */
const express = require('express');
const crypto = require('crypto');
const cors = require('cors'); // Allow frontend to connect
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// --- MEMORY DATABASE (Replace with Redis for Production) ---
const db = {
    balance: 5000.00,
    serverSeed: null,
    nextServerSeed: null,
    nextServerHash: null,
    nonce: 0,
    activeGame: null // Stores state for crash recovery
};

// --- CRYPTOGRAPHIC FUNCTIONS (STAKE STANDARD) ---
const generateSeed = () => crypto.randomBytes(32).toString('hex');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// STRICT 4-BYTE FLOAT GENERATION (RFC Compliant)
const generateFloats = (serverSeed, clientSeed, nonce, count) => {
    const floats = [];
    let i = 0;
    while(floats.length < count) {
        const hmac = crypto.createHmac('sha256', serverSeed);
        hmac.update(`${clientSeed}:${nonce}:${i++}`); // Cursor increment
        const buffer = hmac.digest();
        
        // Extract 4-byte chunks (32 bits)
        for(let j=0; j < buffer.length / 4; j++) {
            if(floats.length >= count) break;
            // Read 4 bytes as Unsigned 32-bit Integer (Big Endian)
            const val = buffer.readUInt32BE(j * 4);
            // Divide by 2^32 to get uniform float [0, 1)
            floats.push(val / 4294967296);
        }
    }
    return floats;
};

// --- INITIALIZE SEEDS ---
db.nextServerSeed = generateSeed();
db.nextServerHash = sha256(db.nextServerSeed);

// --- API ENDPOINTS ---

// 1. INIT (HANDLES PAGE REFRESH RECOVERY)
app.get('/api/init', (req, res) => {
    const response = { 
        balance: db.balance, 
        hash: db.nextServerHash,
        activeGame: null
    };

    // Recover state if game exists
    if(db.activeGame && !db.activeGame.isOver) {
        response.activeGame = {
            bet: db.activeGame.baseBet,
            mines: db.activeGame.mines.length,
            revealed: db.activeGame.revealed, // Indices only
            currentWin: db.activeGame.currentWin,
            multipliers: db.activeGame.multiStack
        };
    }
    res.json(response);
});

// 2. PLACE BET
app.post('/api/bet', (req, res) => {
    const { amount, mines, clientSeed, mode, autoPattern } = req.body;
    
    if(db.activeGame && !db.activeGame.isOver) return res.status(400).json({error: "Game in progress"});
    
    let costMult = 1;
    if(mode === 'boost10') costMult = 10;
    if(mode === 'boost75') costMult = 75;
    
    const totalCost = amount * costMult;
    if(totalCost > db.balance) return res.status(400).json({error: "Insufficient funds"});

    // ROTATE SEEDS
    if(!db.serverSeed) db.serverSeed = db.nextServerSeed; 
    else db.serverSeed = db.nextServerSeed;
    
    db.nonce++;
    db.nextServerSeed = generateSeed();
    db.nextServerHash = sha256(db.nextServerSeed);
    
    db.balance -= totalCost;

    // GENERATE FLOATS & SHUFFLE
    const floats = generateFloats(db.serverSeed, clientSeed, db.nonce, 60);
    
    const allTiles = Array.from({length: 25}, (_, i) => i);
    for (let i = allTiles.length - 1; i > 0; i--) {
        const j = Math.floor(floats[i] * (i + 1));
        [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
    }
    const mineLocations = allTiles.slice(0, mines);

    // BOOSTER PLACEMENT
    let specialItems = {};
    if(mode !== 'normal') {
        const safeTiles = allTiles.slice(mines);
        for (let i = safeTiles.length - 1; i > 0; i--) {
            const j = Math.floor(floats[i+25] * (i + 1));
            [safeTiles[i], safeTiles[j]] = [safeTiles[j], safeTiles[i]];
        }
        const boostedTiles = safeTiles.slice(0, 3);
        
        boostedTiles.forEach((idx, i) => {
            const r = floats[i + 30];
            if (mode === 'boost10') {
                let mult = 1.5;
                if(r > 0.6) mult = 3; if(r > 0.9) mult = 5; if(r > 0.99) mult = 10;
                specialItems[idx] = { type: 'GOLD_GEM', mult: mult };
            } else {
                let mult = 3;
                if(r > 0.5) mult = 10; if(r > 0.8) mult = 25; if(r > 0.95) mult = 50;
                specialItems[idx] = { type: 'NOVA_STAR', mult: mult };
            }
        });
    }

    // CALCULATE MULTIPLIERS (3.6% HOUSE EDGE)
    const maxMoves = 25 - mines;
    let multis = [], current = 1, houseEdge = 0.964;
    for(let i=0; i<maxMoves; i++) {
        let totalRem = 25 - i;
        let safeRem = (25 - mines) - i;
        let prob = safeRem / totalRem;
        current = current / prob;
        multis.push(current * houseEdge);
    }

    db.activeGame = {
        bet: totalCost,
        baseBet: amount,
        mines: mineLocations,
        specialItems: specialItems,
        revealed: [],
        multiStack: multis,
        currentWin: 0,
        isOver: false
    };

    res.json({
        balance: db.balance,
        nextHash: db.nextServerHash,
        nonce: db.nonce,
        newBalance: db.balance // Return new balance immediately
    });
});

// 3. REVEAL TILE
app.post('/api/reveal', (req, res) => {
    const { index } = req.body;
    const game = db.activeGame;
    
    if(!game || game.isOver) return res.status(400).json({error: "No active game"});
    if(game.revealed.includes(index)) return res.status(400).json({error: "Tile already revealed"});

    if(game.mines.includes(index)) {
        game.isOver = true;
        // RETURN ALL DATA FOR GHOST REVEAL
        return res.json({ 
            status: "BOMB", 
            mineMap: game.mines, 
            specialMap: game.specialItems 
        });
    }

    // SAFE HIT
    game.revealed.push(index);
    const stepIndex = game.revealed.length - 1;
    let currentPayout = game.bet * game.multiStack[stepIndex];
    
    let specialData = null;
    if(game.specialItems[index]) {
        specialData = game.specialItems[index];
        // Apply Booster Multiplier
        currentPayout = currentPayout * specialData.mult;
    }
    
    // Cap Win
    if(currentPayout > game.bet * 5000000) currentPayout = game.bet * 5000000;
    game.currentWin = currentPayout;

    res.json({ 
        status: "SAFE", 
        payout: currentPayout, 
        multiplier: currentPayout / game.baseBet,
        step: stepIndex, // For UI highlight
        special: specialData 
    });
});

// 4. CASH OUT
app.post('/api/cashout', (req, res) => {
    const game = db.activeGame;
    if(!game || game.isOver) return res.status(400).json({error: "No active game"});

    db.balance += game.currentWin;
    game.isOver = true;

    res.json({
        success: true,
        winAmount: game.currentWin,
        balance: db.balance,
        finalMultiplier: game.currentWin / game.baseBet,
        mineMap: game.mines,
        specialMap: game.specialItems
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Strict Stake Math Engine Running on Port ${PORT}`);
});