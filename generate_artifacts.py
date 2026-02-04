import json
import os
import random
import hashlib
import hmac
import struct

# --- COMPLIANCE CONFIGURATION ---
NUM_ROUNDS = 2_000_000 # Increased to 2M for smoother variance
TARGET_RTP = 0.964     # 96.4%
OUTPUT_DIR = "public/publish_files"
OUTPUT_FILE = f"{OUTPUT_DIR}/mines_events.jsonl"

def generate_floats(server_seed, client_seed, nonce, count):
    """
    Generates 'count' random floats using HMAC-SHA256.
    Matches server.js 'generateFloats' logic exactly.
    """
    floats = []
    l = 0
    while len(floats) < count:
        # Note the counter 'l' at the end of the message
        msg = f"{client_seed}:{nonce}:{l}"
        h = hmac.new(server_seed.encode(), msg.encode(), hashlib.sha256).digest()
        
        # Read 32-bit blocks (4 bytes)
        for i in range(0, len(h), 4):
            if len(floats) >= count:
                break
            # Convert 4 bytes to UInt32BE
            val = struct.unpack(">I", h[i:i+4])[0]
            floats.append(val / 4294967296)
        l += 1
    return floats

def get_mine_locations(server_seed, client_seed, nonce, num_mines):
    # 1. Generate enough floats for the shuffle (server uses 60, we need at least 25)
    floats = generate_floats(server_seed, client_seed, nonce, 60)
    
    # 2. Fisher-Yates Shuffle using those floats
    cards = list(range(25))
    for i in range(len(cards) - 1, 0, -1):
        # Matches server.js: const j = Math.floor(floats[i] * (i + 1));
        rand_idx = int(floats[i] * (i + 1))
        cards[i], cards[rand_idx] = cards[rand_idx], cards[i]
        
    # The first 'num_mines' items are the mine positions
    return set(cards[:num_mines])

def calculate_strict_multiplier(mines, steps_taken):
    """
    Standard RTP Formula: (1/Prob) * HouseEdge
    """
    multiplier = 1.0
    for i in range(steps_taken):
        tiles_remaining = 25 - i
        safe_remaining = (25 - mines) - i
        prob = safe_remaining / tiles_remaining
        multiplier = multiplier * (1 / prob)
    return multiplier * TARGET_RTP

def simulate_round(i):
    server_seed = hashlib.sha256(os.urandom(32)).hexdigest()
    client_seed = "audit_simulation"
    nonce = i
    
    # Random difficulty
    mines = random.randint(1, 24)
    
    # 1. Generate Real Board
    mine_locations = get_mine_locations(server_seed, client_seed, nonce, mines)
    
    # 2. Simulate Player Target
    max_safe = 25 - mines
    target_steps = random.randint(1, max_safe)
    
    # 3. Check Outcome
    # We simulate picking tiles 0, 1, 2...
    # Since the board is shuffled uniformly, this is mathematically valid.
    hit_mine = False
    for step in range(target_steps):
        if step in mine_locations:
            hit_mine = True
            break
            
    if not hit_mine:
        final_payout = calculate_strict_multiplier(mines, target_steps)
    else:
        final_payout = 0.0

    return {"payoutMultiplier": final_payout}

if __name__ == "__main__":
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    print(f"🔄 Generating {NUM_ROUNDS} compliant rounds (this may take 2-3 mins)...")
    
    with open(OUTPUT_FILE, "w") as f:
        for i in range(NUM_ROUNDS):
            data = simulate_round(i)
            f.write(json.dumps(data) + "\n")
            
            if i % 200_000 == 0:
                print(f"   ...{i} generated")
                
    print(f"✅ Generated {NUM_ROUNDS} outcomes.")