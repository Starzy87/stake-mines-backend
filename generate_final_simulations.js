const fs = require('fs');
const crypto = require('crypto');

function generateBook(id) {
  const mines = 3;
  const board = [...Array(25).keys()];
  
  // Shuffle
  for(let i=24; i>0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  
  const minePos = board.slice(0,3).sort((a,b)=>a-b);
  const safePos = board.slice(3);
  
  // Reveal 1-8 tiles (weighted toward fewer)
  const revealWeights = [0.3, 0.25, 0.2, 0.12, 0.07, 0.03, 0.02, 0.01];
  let r = Math.random();
  let reveals = 1;
  for(let i=0; i<8; i++) {
    r -= revealWeights[i];
    if(r <= 0) { reveals = i+1; break; }
  }
  
  const revealed = [];
  let mult = 1.0;
  let hitMine = null;
  
  for(let i=0; i<Math.min(reveals, 22); i++) {
    const tile = safePos[i];
    if(minePos.includes(tile)) {
      hitMine = tile;
      break;
    }
    revealed.push(tile);
    const prob = (22-i)/(25-i);
    mult *= (1/prob) * 0.964;
  }
  
  // 35% chance hit mine if didn't already
  if(!hitMine && revealed.length < 22 && Math.random() < 0.35) {
    hitMine = minePos[Math.floor(Math.random()*3)];
  }
  
  const payout = hitMine ? 0 : Math.floor(mult * 100);
  
  return {
    id,
    payoutMultiplier: payout,
    events: [
      {index:0, type:"roundStart", mines:3, seedHash:crypto.randomBytes(32).toString('hex'), nonce:id},
      {index:1, type:"revealSequence", revealedSafe:revealed, hitMineAt:hitMine, mineLocations:minePos},
      {index:2, type:"setWin", amount:payout},
      {index:3, type:"finalWin", amount:payout}
    ]
  };
}

console.log('🚀 Generating 100,000 simulations...');
const stream = fs.createWriteStream('books_base_100k.jsonl');
let totalPayout = 0;

for(let i=1; i<=100000; i++) {
  const book = generateBook(i);
  totalPayout += book.payoutMultiplier;
  stream.write(JSON.stringify(book) + '\n');
  if(i % 10000 === 0) console.log(`  ${i}... RTP so far: ${(totalPayout/(i*100)).toFixed(2)}%`);
}
stream.end();

const finalRTP = (totalPayout / (100000 * 100)) * 100;
console.log(`\n✅ DONE!`);
console.log(`   Final RTP: ${finalRTP.toFixed(2)}%`);
console.log(`   Target: 96.40%`);
console.log(`\nNext: zstd books_base_100k.jsonl`);
