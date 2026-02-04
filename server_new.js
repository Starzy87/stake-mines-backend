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

const CONFIG = {
    currency: "USD",
    micros: 1000000,
    minBet: 100000,
    maxBet: 1000000000,
    stepBet: 100000,
    defaultBetLevel: 1000000,
    betLevels: [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000],
    jurisdiction: { country: "US", socialCasino: false, disabledFullscreen: false, disabledTurbo: false }
};

const sessions = {
    "test-session-123": {
        balance: 1000 * CONFIG.micros,
        activeRound: null,
        currency: "USD"
    }
};

let simulations = [];

function loadSimulations() {
    try {
        const zstPath = path.join(__dirname, 'public/publish_files/books_base.jsonl.zst');
        const jsonlData = execSync(`zstd -d -c "${zstPath}"`, { maxBuffer: 100 * 1024 * 1024 }).toString();
        simulations = jsonlData.trim().split('\n').map(line => JSON.parse(line));
        console.log(`✅ Loaded ${simulations.length} simulations`);
    } catch (error) {
        console.log('⚠️  Running without simulation files');
    }
}

loadSimulations();

app.post('/wallet/authenticate', (req, res) => {
    const { sessionID } = req.body;
    if (!sessionID) return res.status(400).json({ code: 'ERR_MISSING_PARAM', message: 'sessionID required' });
    
    if (!sessions[sessionID]) {
        sessions[sessionID] = { balance: 1000 * CONFIG.micros, activeRound: null, currency: "USD" };
    }
    
    const session = sessions[sessionID];
    
    res.json({
        balance: { amount: session.balance, currency: session.currency },
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

app.post('/wallet/balance', (req, res) => {
    const { sessionID } = req.body;
    const session = sessions[sessionID];
    if (!session) return res.status(400).json({ code: 'ERR_IS', message: 'Invalid session' });
    res.json({ balance: { amount: session.balance, currency: session.currency } });
});

app.post('/wallet/play', (req, res) => {
    const { sessionID, amount, mode = 'base' } = req.body;
    const session = sessions[sessionID];
    
    if (!session) return res.status(400).json({ code: 'ERR_IS', message: 'Invalid session' });
    if (amount < CONFIG.minBet || amount > CONFIG.maxBet) {
        return res.status(400).json({ code: 'ERR_BET_LIMITS', message: 'Invalid bet amount' });
    }
    if (session.balance < amount) {
        return res.status(400).json({ code: 'ERR_INSUFFICIENT_FUNDS', message: 'Insufficient balance' });
    }
    
    session.balance -= amount;
    
    let round;
    if (simulations.length > 0) {
        const randomIndex = Math.floor(Math.random() * simulations.length);
        round = JSON.parse(JSON.stringify(simulations[randomIndex]));
        round.roundId = `round-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        round.betAmount = amount;
    } else {
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
    
    session.activeRound = round;
    res.json({ balance: { amount: session.balance, currency: session.currency }, round: round });
});

app.post('/wallet/end-round', (req, res) => {
    const { sessionID } = req.body;
    const session = sessions[sessionID];
    
    if (!session) return res.status(400).json({ code: 'ERR_IS', message: 'Invalid session' });
    if (!session.activeRound) return res.status(400).json({ code: 'ERR_NO_ROUND', message: 'No active round' });
    
    const round = session.activeRound;
    const payout = round.payoutMultiplier;
    session.balance += payout;
    session.activeRound = null;
    
    res.json({ balance: { amount: session.balance, currency: session.currency } });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  STAKE RGS SERVER - PORT ${PORT}           ║`);
    console.log(`╚════════════════════════════════════════════╝`);
    console.log(`📁 Simulations: ${simulations.length}`);
    console.log(`🎮 URL: http://localhost:${PORT}/?rgs_url=http://localhost:${PORT}&sessionID=test-session-123\n`);
});
