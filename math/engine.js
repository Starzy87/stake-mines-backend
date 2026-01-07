// math/engine.js
// Stateless single-shot outcome generator for Stake-style "books" (Option A)
// Multiplier scaling (integer payouts required by Stake math books)
const MULT_SCALE = 100; // 1.00x => 100

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

// math/engine.js
// Loads Stake-style math artifacts (index.json + lookup CSV + books .jsonl.zst)
// and lets the server draw a single outcome (a "book") by weighted sampling.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

// Simple CSV parser: simulationId, weight, payoutMultiplier
function parseLookupCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const id = Number(parts[0]);
    const weight = BigInt(parts[1]);       // Stake wants uint64 style
    const payout = BigInt(parts[2]);       // integer payoutMultiplier
    if (!Number.isFinite(id)) continue;
    rows.push({ id, weight, payout });
  }
  return rows;
}

// Decompress .zst -> string using zstd CLI (you installed it)
function zstdDecompressToString(zstPath) {
  // -d: decompress, -c: to stdout
  return execSync(`zstd -d -c "${zstPath}"`, { maxBuffer: 1024 * 1024 * 200 }).toString("utf8");
}

// Parse jsonl into an array by id index
function parseBooksFromJsonl(jsonlText) {
  const lines = jsonlText.trim().split(/\r?\n/);
  const byId = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj && typeof obj.id === "number") byId.set(obj.id, obj);
  }
  return byId;
}

// Deterministic RNG from (serverHash + clientSeed + nonce) -> 0..1
function rngFloat(serverHashHex, clientSeed, nonce) {
  const input = `${serverHashHex}|${clientSeed}|${nonce}`;
  const h = crypto.createHash("sha256").update(input).digest();
  // Use first 8 bytes as uint64
  const x = h.readBigUInt64BE(0);
  // Convert to [0,1)
  const max = (1n << 64n);
  return Number(x) / Number(max);
}

function weightedPick(rows, u) {
  // rows weights are BigInt; u in [0,1)
  let total = 0n;
  for (const r of rows) total += r.weight;

  if (total <= 0n) throw new Error("Lookup table total weight is 0.");

  // target in [0, total-1]
  const target = BigInt(Math.floor(u * Number(total)));
  let acc = 0n;

  for (const r of rows) {
    acc += r.weight;
    if (target < acc) return r;
  }
  return rows[rows.length - 1];
}

class MathEngine {
  constructor({ publishDir }) {
    this.publishDir = publishDir;
    this.modes = {}; // name -> { cost, lookupRows, booksById }
  }

  load() {
    const indexPath = path.join(this.publishDir, "index.json");
    const idx = JSON.parse(readText(indexPath));

    if (!idx || !Array.isArray(idx.modes) || idx.modes.length === 0) {
      throw new Error("Invalid index.json (missing modes).");
    }

    for (const m of idx.modes) {
      const modeName = m.name;
      const lookupPath = path.join(this.publishDir, m.weights);
      const booksPath = path.join(this.publishDir, m.events);

      if (!fs.existsSync(lookupPath)) throw new Error(`Missing lookup: ${lookupPath}`);
      if (!fs.existsSync(booksPath)) throw new Error(`Missing books: ${booksPath}`);

      const lookupRows = parseLookupCSV(readText(lookupPath));
      const jsonl = booksPath.endsWith(".zst")
        ? zstdDecompressToString(booksPath)
        : readText(booksPath);

      const booksById = parseBooksFromJsonl(jsonl);

      this.modes[modeName] = {
        cost: Number(m.cost),
        lookupRows,
        booksById
      };
    }
  }

  draw({ modeName, serverHash, clientSeed, nonce }) {
    const mode = this.modes[modeName];
    if (!mode) throw new Error(`Unknown mode: ${modeName}`);

    const u = rngFloat(serverHash, clientSeed || "default", nonce || 0);
    const picked = weightedPick(mode.lookupRows, u);
    const book = mode.booksById.get(picked.id);

    if (!book) throw new Error(`Book id ${picked.id} not found in books file.`);
    // Stake requires payoutMultiplier matches CSV third column
    const payoutFromBook = BigInt(book.payoutMultiplier);
    if (payoutFromBook !== picked.payout) {
      throw new Error(`Mismatch payoutMultiplier for id=${picked.id} (book=${payoutFromBook} csv=${picked.payout})`);
    }

    return book;
  }
}

module.exports = { MathEngine };

