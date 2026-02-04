/* ==============================================
   XTREME MINES - STABLE MATH CERTIFICATION
   Configuration: 3 Mines (Standard)
   Strategy: Random 1-5 Picks (Low Variance)
   Objective: Prove 96.4% RTP Stability
============================================== */

const crypto = require('crypto');
const fs = require('fs');

// --- AUDIT CONFIGURATION ---
const SIMULATION_ROUNDS = 10000000; 
const BET_AMOUNT = 1000000;         // 1.00 USD
const HOUSE_EDGE_PERCENT = 0.964;   // 96.4% Return to Player
const TEST_MINES = 3;               // Standard Difficulty
const MAX_PICKS = 5;                // Limit depth to ensure convergence

// --- METRICS ---
let stats = {
    totalWagered: 0,
    totalWon: 0,
    wins: 0,
    losses: 0,
    rtp: 0
};

console.log(`🚀 STARTING STABLE AUDIT: ${SIMULATION_ROUNDS.toLocaleString()} Rounds`);
console.log(`⚙️ Config: ${TEST_MINES} Mines | 1-${MAX_PICKS} Picks Strategy`);
console.log("---------------------------------------------------");

// --- CORE RNG (RFC Compliant) ---
const generateFloats = (serverSeed, clientSeed, nonce, count) => {
    const floats = [];
    let i = 0;
    while(floats.length < count) {
        const hmac = crypto.createHmac('sha256', serverSeed);
        hmac.update(`${clientSeed}:${nonce}:${i++}`);
        const buffer = hmac.digest();
        for(let j=0; j < buffer.length / 4; j++) {
            if(floats.length >= count) break;
            const val = buffer.readUInt32BE(j * 4);
            floats.push(val / 4294967296);
        }
    }
    return floats;
};

// --- SIMULATION LOOP ---
const SERVER_SEED = crypto.randomBytes(32).toString('hex');
const CLIENT_SEED = "STABLE_AUDIT_2024";

for (let i = 0; i < SIMULATION_ROUNDS; i++) {
    const nonce = i;
    
    // 1. Setup Board
    const floats = generateFloats(SERVER_SEED, CLIENT_SEED, nonce, 60);
    const allTiles = Array.from({length: 25}, (_, x) => x);
    
    // Fisher-Yates Shuffle
    for (let k = allTiles.length - 1; k > 0; k--) {
        const j = Math.floor(floats[k] * (k + 1));
        [allTiles[k], allTiles[j]] = [allTiles[j], allTiles[k]];
    }
    
    // First 'n' tiles are mines
    const mineLocations = new Set(allTiles.slice(0, TEST_MINES));
    
    // 2. Play Round
    stats.totalWagered += BET_AMOUNT;
    
    // Determine how many tiles this "player" wants to click (1 to MAX_PICKS)
    // We use the NEXT float in the sequence to determine this decision fairly
    const decisionFloat = floats[50]; // Use a float far down the list
    const targetPicks = Math.floor(decisionFloat * MAX_PICKS) + 1;
    
    let isBust = false;
    let rawProbability = 1;
    
    // Pick Pool (Simulates user clicking different tiles)
    let pickPool = Array.from({length: 25}, (_, x) => x);
    
    for (let p = 0; p < targetPicks; p++) {
        // Use floats to pick a random tile
        const pickFloat = floats[26 + p]; // Use reserved float section
        const pickIndex = Math.floor(pickFloat * pickPool.length);
        const tileIdx = pickPool[pickIndex];
        pickPool.splice(pickIndex, 1);
        
        if (mineLocations.has(tileIdx)) {
            isBust = true;
            break;
        } else {
            // Update Probability (Odds of picking Safe vs Total)
            // Prob = SafeRemaining / TotalRemaining
            const safeRem = (25 - TEST_MINES) - p;
            const totalRem = 25 - p;
            rawProbability = rawProbability * (safeRem / totalRem);
        }
    }
    
    // 3. Payout Calculation
    if (isBust) {
        stats.losses++;
    } else {
        stats.wins++;
        
        // Fair Multiplier = 1 / Probability
        let fairMulti = 1 / rawProbability;
        
        // Apply House Edge (Tax)
        let finalMulti = fairMulti * HOUSE_EDGE_PERCENT;
        
        // Calculate Win (Floor to integer for Micros currency)
        const winAmount = Math.floor(BET_AMOUNT * finalMulti);
        stats.totalWon += winAmount;
    }
    
    // 4. Progress Report
    if (i % 1000000 === 0 && i > 0) {
        const currentRTP = (stats.totalWon / stats.totalWagered) * 100;
        console.log(`[${i / 1000000}M] RTP: ${currentRTP.toFixed(4)}%`);
    }
}

// --- FINAL REPORT ---
stats.rtp = (stats.totalWon / stats.totalWagered) * 100;

console.log("---------------------------------------------------");
console.log("✅ CERTIFICATION COMPLETE");
console.log("---------------------------------------------------");
console.log(`Total Rounds:    ${SIMULATION_ROUNDS.toLocaleString()}`);
console.log(`Total Wagered:   $${(stats.totalWagered / 1000000).toLocaleString()}`);
console.log(`Total Won:       $${(stats.totalWon / 1000000).toLocaleString()}`);
console.log(`Win Rate:        ${((stats.wins / SIMULATION_ROUNDS) * 100).toFixed(2)}%`);
console.log("---------------------------------------------------");
console.log(`🔥 FINAL RTP:    ${stats.rtp.toFixed(4)}%`);
console.log(`TARGET RTP:      ${(HOUSE_EDGE_PERCENT * 100).toFixed(2)}%`);
console.log("---------------------------------------------------");

const certificate = {
    game: "Xtreme Mines",
    audit_type: "Standard Variance",
    rounds: SIMULATION_ROUNDS,
    config: { mines: TEST_MINES, strategy: `1-${MAX_PICKS} picks` },
    rtp: stats.rtp.toFixed(4) + "%",
    timestamp: new Date().toISOString()
};

fs.writeFileSync('math_certificate.json', JSON.stringify(certificate, null, 2));
console.log("📄 Certificate saved to math_certificate.json");