import json
import os
import random
import hashlib
import hmac
import struct

NUM_ROUNDS = 100000
TARGET_RTP = 0.964
OUTPUT_DIR = "public/publish_files"
OUTPUT_FILE = f"{OUTPUT_DIR}/mines_events.jsonl"

def generate_floats(server_seed, client_seed, nonce, count):
    floats = []
    l = 0
    while len(floats) < count:
        msg = f"{client_seed}:{nonce}:{l}"
        h = hmac.new(server_seed.encode(), msg.encode(), hashlib.sha256).digest()
        for i in range(0, len(h), 4):
            if len(floats) >= count:
                break
            val = struct.unpack(">I", h[i:i+4])[0]
            floats.append(val / 4294967296)
        l += 1
    return floats

def get_mine_locations(server_seed, client_seed, nonce, num_mines):
    floats = generate_floats(server_seed, client_seed, nonce, 60)
    cards = list(range(25))
    for i in range(len(cards) - 1, 0, -1):
        rand_idx = int(floats[i] * (i + 1))
        cards[i], cards[rand_idx] = cards[rand_idx], cards[i]
    return sorted(cards[:num_mines])

def calculate_multiplier(mines, steps):
    mult = 1.0
    for i in range(steps):
        prob = ((25 - mines) - i) / (25 - i)
        mult *= (1 / prob)
    return mult * TARGET_RTP

def simulate_round(sim_id):
    server_seed = hashlib.sha256(os.urandom(32)).hexdigest()
    client_seed = "simulation"
    nonce = sim_id
    mines = 3
    
    mine_locs = get_mine_locations(server_seed, client_seed, nonce, mines)
    safe_locs = [i for i in range(25) if i not in mine_locs]
    
    max_safe = 25 - mines
    target_steps = random.choices(range(1, 9), weights=[30,25,20,12,7,3,2,1])[0]
    target_steps = min(target_steps, max_safe)
    
    hit_mine = False
    revealed = []
    for step in range(target_steps):
        if safe_locs[step] in mine_locs:
            hit_mine = True
            break
        revealed.append(safe_locs[step])
    
    payout = 0 if hit_mine else int(calculate_multiplier(mines, target_steps) * 100)
    
    return {
        "id": sim_id,
        "payoutMultiplier": payout,
        "events": [
            {"index": 0, "type": "roundStart", "mines": mines, "seedHash": server_seed[:64], "nonce": nonce},
            {"index": 1, "type": "revealSequence", "revealedSafe": revealed, "hitMineAt": safe_locs[len(revealed)] if hit_mine else None, "mineLocations": mine_locs},
            {"index": 2, "type": "setWin", "amount": payout},
            {"index": 3, "type": "finalWin", "amount": payout}
        ]
    }

if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating {NUM_ROUNDS} rounds...")
    
    total = 0
    with open(OUTPUT_FILE, "w") as f:
        for i in range(1, NUM_ROUNDS + 1):
            data = simulate_round(i)
            total += data['payoutMultiplier']
            f.write(json.dumps(data) + "\n")
            if i % 20000 == 0:
                print(f"  {i}... RTP: {(total/(i*100)):.2f}%")
    
    rtp = (total / (NUM_ROUNDS * 100))
    print(f"\nFinal RTP: {rtp:.2f}%")
    print("✅ PASSED" if 0.95 <= rtp <= 0.98 else "❌ FAILED")
