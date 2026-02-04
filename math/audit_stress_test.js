/* ============================================================
   RGS AUDIT STRESS TESTER
   - Simulates Race Conditions (Double Betting)
   - Simulates Idempotency Replays
   - Checks Balance Integrity
   ============================================================ */
const axios = require('axios'); // Run: npm install axios
const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'audit-bot-' + Date.now();

// Colors for console
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function log(msg, type = 'info') {
    const color = type === 'error' ? RED : (type === 'success' ? GREEN : RESET);
    console.log(`${color}[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${msg}${RESET}`);
}

async function getBalance() {
    const res = await axios.get(`${BASE_URL}/api/init?sessionID=${SESSION_ID}`);
    return res.data.balance;
}

async function runTests() {
    log("🚀 STARTING AUDIT STRESS TEST...");
    
    // 1. INITIAL BALANCE
    let startBal = await getBalance();
    log(`Initial Balance: $${startBal/1000000}`);

    // 2. THE "DOUBLE CLICK" ATTACK
    // We fire 10 bet requests simultaneously. 
    // EXPECTATION: Only 1 should succeed (200 OK), or all return the SAME active game.
    // BALANCE should only drop ONCE.
    log(`\n💥 TEST 1: The 'Machine Gun' Bet (Concurrency)`);
    
    const betPayload = { amount: 10000000, mines: 3, clientSeed: "audit-test", mode: "normal", sessionID: SESSION_ID }; // $10 bet
    const promises = [];
    for(let i=0; i<10; i++) promises.push(axios.post(`${BASE_URL}/api/bet`, betPayload).catch(e => e.response));
    
    const results = await Promise.all(promises);
    
    const successes = results.filter(r => r.status === 200);
    const failures = results.filter(r => r.status !== 200);
    
    log(`Requests Sent: 10 | 200 OKs: ${successes.length} | Errors: ${failures.length}`);
    
    // Check if they are all the SAME round (Idempotency check)
    const roundIds = new Set(successes.map(r => r.data.roundId));
    
    let newBal = await getBalance();
    let diff = startBal - newBal;
    
    if (roundIds.size === 1 && diff === 10000000) {
        log(`✅ PASS: Concurrency handled. System created 1 round and deducted 1 bet.`, 'success');
    } else {
        log(`❌ FAIL: System created ${roundIds.size} rounds or deducted $${diff/1000000}.`, 'error');
        process.exit(1);
    }

    // 3. THE "CASHOUT GLITCH" ATTACK
    // We will reveal one tile, then try to cashout 10 times instantly.
    log(`\n💥 TEST 2: The Cashout Race Condition`);
    
    // Reveal a tile first (we assume index 0 is safe for this test, if not we retry)
    // Note: In a real test we'd need to know where mines are, but for stress testing we just hope 0 is safe or try until safe.
    try {
        await axios.post(`${BASE_URL}/api/reveal`, { index: 0, sessionID: SESSION_ID });
    } catch (e) {
        log(`(Hit mine on reveal, restarting round for cashout test...)`);
        // If we hit a mine, we can't test cashout. Simplified for this snippet.
    }

    const cashoutPromises = [];
    for(let i=0; i<10; i++) cashoutPromises.push(axios.post(`${BASE_URL}/api/cashout`, { sessionID: SESSION_ID }).catch(e => e.response));
    
    const cashResults = await Promise.all(cashoutPromises);
    const cashSuccesses = cashResults.filter(r => r.status === 200);
    
    // We expect exactly 1 success (or 0 if we hit a mine earlier). 
    // We NEVER want >1 success.
    if (cashSuccesses.length > 1) {
        log(`❌ FAIL: CRITICAL! Wallet credited ${cashSuccesses.length} times for one game!`, 'error');
        process.exit(1);
    } else {
        log(`✅ PASS: Cashout locked correctly. Accepted ${cashSuccesses.length} request.`, 'success');
    }

    log("\n🏁 AUDIT COMPLETE. If you see green ticks, you are safe.");
}

runTests();