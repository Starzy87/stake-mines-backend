/* ==============================================
   STAKE RGS COMPLIANT SERVER - WITH WALLET ENDPOINTS
   Reads from your pre-generated simulation files
============================================== */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const { execSync } = require('child_process');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// =================================================================
// CONFIGURATION
// =================================================================
const CONFIG = {
    currency: "USD",
    micros: 1000000,
    minBet: 100000,       // $0.10
    maxBet: 1000000000,   // $1,000.00
    stepBet: 100000,
    defaultBetLevel: 1000000,
    betLevels: [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000],
    jurisdiction: {
        country: "US",
        socialCasino: false,
        disabledFullscreen: false,
        disabledTurbo: false
    }
};

// Mock sessions
const sessions = {
    "test-session-123": {
        balance: 1000 * CONFIG.micros, // $1,000 starting balance
        activeRound: null,
        currency: "USD"
    }
};

// =================================================================
// LOAD SIMULATION FILES
// =================================================================
let simulations = [];
let lookupTable = [];

function loadSimulations() {
    try {
        // Decompress and load the .zst file
        const zstPath = path.join(__dirname, 'public/publish_files/books_base.jsonl.zst');
        const jsonlData = execSync(`zstd -d -c "${zstPath}"`, { maxBuffer: 100 * 1024 * 1024 }).toString();
        
        // Parse JSONL
        simulations = jsonlData.trim().split('\n').map(line => JSON.parse(line));
        
        console.log(`✅ Loaded ${simulations.length} simulations from books_base.jsonl.zst`);
        
        // Load CSV lookup table
        const csvPath = path.join(__dirname, 'public/publish_files/lookUpTable_base_0.csv');
        const csvData = fs.readFileSync(csvPath, 'utf8');
        
        lookupTable = csvData.trim().split('\n').map(line => {
            const [id, weight, payout] = line.split(',');
            return { id: parseInt(id), weight: parseInt(weight), payout: parseInt(payout) };
        });
        
        console.log(`✅ Loaded ${lookupTable.length} entries from lookup table`);
    } catch (error) {
        console.error('❌ Error loading simulation files:', error.message);
        console.log('⚠️  Running without simulation files - using mock data');
    }
}

// Load on startup
loadSimulations();

// =================================================================
// WALLET ENDPOINTS (STAKE RGS)
// =================================================================

// Authenticate
app.post('/wallet/authenticate', (req, res) => {
    const { sessionID } = req.body;
    
    if (!sessionID) {
        return res.status(400).json({ 
            code: 'ERR_MISSING_PARAM',
            message: 'sessionID required' 
        });
    }
    
    // Get or create session
    if (!sessions[sessionID]) {
        sessions[sessionID] = {
            balance: 1000 * CONFIG.micros,
            activeRound: null,
            currency: "USD"
        };
    }
    
    const session = sessions[sessionID];
    
    res.json({
        balance: {
            amount: session.balance,
            currency: session.currency
        },
        config: {
            minBet: CONFIG.minBet,
            maxBet: CONFIG.maxBet,
            stepBet: CONFIG.stepBet,
            defaultBetLevel: CONFIG.defaultBetLevel,
            betLevels: CONFIG.betLevels,
            jurisdiction: CONFIG.jurisdiction
        },
        round: session.activeRound || null
    });
});

// Get Balance
app.post('/wallet/balance', (req, res) => {
    const { sessionID } = req.body;
    
    const session = sessions[sessionID];
    if (!session) {
        return res.status(400).json({ 
            code: 'ERR_IS',
            message: 'Invalid session' 
        });
    }
    
    res.json({
        balance: {
            amount: session.balance,
            currency: session.currency
        }
    });
});

// Play (Start Round)
app.post('/wallet/play', (req, res) => {
    const { sessionID, amount, mode = 'base' } = req.body;
    
    const session = sessions[sessionID];
    if (!session) {
        return res.status(400).json({ 
            code: 'ERR_IS',
            message: 'Invalid session' 
        });
    }
    
    // Validate bet
    if (amount < CONFIG.minBet || amount > CONFIG.maxBet) {
        return res.status(400).json({
            code: 'ERR_BET_LIMITS',
            message: `Bet must be between ${CONFIG.minBet} and ${CONFIG.maxBet}`
        });
    }
    
    if (session.balance < amount) {
        return res.status(400).json({
            code: 'ERR_INSUFFICIENT_FUNDS',
            message: 'Insufficient balance'
        });
    }
    
    // Debit bet
    session.balance -= amount;
    
    // Pick a random simulation
    let round;
    if (simulations.length > 0) {
        const randomIndex = Math.floor(Math.random() * simulations.length);
        round = JSON.parse(JSON.stringify(simulations[randomIndex])); // Deep copy
        round.roundId = `round-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        round.betAmount = amount;
    } else {
        // Fallback mock round
        round = {
            id: Math.floor(Math.random() * 10000),
            roundId: `round-${Date.now()}`,
            betAmount: amount,
            payoutMultiplier: 0,
            events: [
                { index: 0, type: 'roundStart', mines: 3, seedHash: crypto.randomBytes(16).toString('hex'), nonce: 0 },
                { index: 1, type: 'revealSequence', revealedSafe: [], hitMineAt: 0, mineLocations: [0, 5, 10] },
                { index: 2, type: 'setWin', amount: 0 },
                { index: 3, type: 'finalWin', amount: 0 }
            ]
        };
    }
    
    // Store active round
    session.activeRound = round;
    
    res.json({
        balance: {
            amount: session.balance,
            currency: session.currency
        },
        round: round
    });
});

// End Round
app.post('/wallet/end-round', (req, res) => {
    const { sessionID } = req.body;
    
    const session = sessions[sessionID];
    if (!session) {
        return res.status(400).json({ 
            code: 'ERR_IS',
            message: 'Invalid session' 
        });
    }
    
    if (!session.activeRound) {
        return res.status(400).json({
            code: 'ERR_NO_ROUND',
            message: 'No active round'
        });
    }
    
    // Calculate payout
    const round = session.activeRound;
    const payout = round.payoutMultiplier; // Already in correct units from simulation
    
    // Credit winnings
    session.balance += payout;
    
    // Clear active round
    session.activeRound = null;
    
    res.json({
        balance: {
            amount: session.balance,
            currency: session.currency
        }
    });
});

// =================================================================
// START SERVER
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  STAKE RGS SERVER RUNNING ON PORT ${PORT}  ║`);
    console.log(`╚════════════════════════════════════════════╝\n`);
    console.log(`📁 Simulations: ${simulations.length}`);
    console.log(`🎮 Test URL: http://localhost:${PORT}/?rgs_url=http://localhost:${PORT}&sessionID=test-session-123\n`);
});
