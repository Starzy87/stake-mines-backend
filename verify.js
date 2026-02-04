const crypto = require('crypto');

// -----------------------------------------
// INPUT YOUR DATA FROM A FINISHED GAME HERE
// -----------------------------------------
const SERVER_SEED = "353b764b412d6b75a0e3fed81ac0cf6f7bcc548755d307f39b87e4c83e0a12e";
const CLIENT_SEED = "ClientSeed_123";
const NONCE = 79; // The nonce number of the round
const MINES_COUNT = 3; 
// -----------------------------------------

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

const floats = generateFloats(SERVER_SEED, CLIENT_SEED, NONCE, 100);

// SHUFFLE
const allTiles = Array.from({length: 25}, (_, i) => i);
for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i] * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
}

const mines = allTiles.slice(0, MINES_COUNT);
console.log("------------------------------------------------");
console.log("👮 CASINO AUDIT REPORT");
console.log("------------------------------------------------");
console.log(`Server Seed: ${SERVER_SEED}`);
console.log(`Client Seed: ${CLIENT_SEED}`);
console.log(`Nonce:       ${NONCE}`);
console.log("------------------------------------------------");
console.log("💣 CALCULATED MINE LOCATIONS:", mines.sort((a,b)=>a-b));
console.log("------------------------------------------------");