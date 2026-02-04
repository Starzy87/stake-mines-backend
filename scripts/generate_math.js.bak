// scripts/generate_math.js
// Generates Stake Engine publish files: index.json, lookup table CSV, books_base.jsonl (+ optional zst via CLI)

const fs = require("fs");
const path = require("path");
const { generateBook } = require("../math/engine");

const OUT_DIR = path.join(__dirname, "..", "publish_files");
const MODE_NAME = "base";
const COST = 1.0;

// Quick dev run (increase later to 100k+)
const NUM_SIMS = 2000;

// Seeds for deterministic generation (replace later with real workflow)
const SERVER_SEED = "ServerSeed_FOR_TEST_ONLY";
const CLIENT_SEED = "ClientSeed_FOR_TEST_ONLY";
const MINES = 3;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  ensureDir(OUT_DIR);

  const booksJsonlPath = path.join(OUT_DIR, `books_${MODE_NAME}.jsonl`);
  const lookupCsvPath = path.join(OUT_DIR, `lookUpTable_${MODE_NAME}_0.csv`);
  const indexJsonPath = path.join(OUT_DIR, `index.json`);

  // Write index.json
  const indexJson = {
    modes: [
      {
        name: MODE_NAME,
        cost: COST,
        events: `books_${MODE_NAME}.jsonl.zst`,
        weights: `lookUpTable_${MODE_NAME}_0.csv`,
      },
    ],
  };
  fs.writeFileSync(indexJsonPath, JSON.stringify(indexJson, null, 2));

  // Write books + lookup
  const booksStream = fs.createWriteStream(booksJsonlPath, { flags: "w" });
  const lookupStream = fs.createWriteStream(lookupCsvPath, { flags: "w" });

  for (let i = 1; i <= NUM_SIMS; i++) {
    const book = generateBook({
      id: i,
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonce: 0,
      mines: MINES,
    });

    // JSONL line (one JSON per line)
    booksStream.write(JSON.stringify(book) + "\n");

    // Lookup CSV: simulation id, weight/prob, payoutMultiplier (uint-ish)
    // Stake docs say "uint64 values". We'll keep integers here.
    lookupStream.write(`${i},1,${book.payoutMultiplier}\n`);
  }

  booksStream.end();
  lookupStream.end();

  console.log(`✅ Wrote:\n- ${indexJsonPath}\n- ${lookupCsvPath}\n- ${booksJsonlPath}`);
  console.log(`Next: compress JSONL to .zst (Step 4).`);
}

main();

