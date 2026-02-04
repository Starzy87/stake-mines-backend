import json, os, random, hashlib

def gen(id):
    board = list(range(25))
    random.shuffle(board)
    mine_pos = sorted(board[:3])
    safe_pos = board[3:]
    
    # Random reveals weighted toward fewer reveals
    reveals = random.choices([0,1,2,3,4,5,6,7,8], weights=[35,30,20,10,3,1,0.5,0.3,0.2])[0]
    
    if reveals == 0:
        # Hit mine immediately
        mult_raw = 0
        hit_mine = mine_pos[0]
        revealed_safe = []
    else:
        # Calculate multiplier for this many reveals
        mult_raw = 1.0
        for i in range(reveals):
            prob = (22 - i) / (25 - i)
            mult_raw /= prob
        mult_raw *= 0.964  # House edge
        hit_mine = None
        revealed_safe = safe_pos[:reveals]
    
    # Store multiplier as payout for 1,000,000 micros ($1 bet)
    # This way: actualPayout = (betAmount / 1000000) * payoutMultiplier
    payout_for_one_dollar = int(mult_raw * 1_000_000)
    
    return {
        "id": id,
        "payoutMultiplier": payout_for_one_dollar,
        "events": [
            {"index":0, "type":"roundStart", "mines":3, "seedHash":hashlib.md5(str(id).encode()).hexdigest(), "nonce":id},
            {"index":1, "type":"revealSequence", "revealedSafe":revealed_safe, "hitMineAt":hit_mine, "mineLocations":mine_pos},
            {"index":2, "type":"setWin", "amount":payout_for_one_dollar},
            {"index":3, "type":"finalWin", "amount":payout_for_one_dollar}
        ]
    }

os.makedirs("public/publish_files", exist_ok=True)

print("Generating 100,000 simulations...")
with open("public/publish_files/books_base.jsonl", "w") as f:
    total_mult = 0
    for i in range(1, 100001):
        d = gen(i)
        total_mult += d['payoutMultiplier']
        f.write(json.dumps(d) + "\n")
        if i % 20000 == 0:
            avg_mult = total_mult / i / 1_000_000
            print(f"{i:,} done... Avg multiplier: {avg_mult:.4f}x (RTP: {avg_mult*100:.2f}%)")
    
    final_rtp = (total_mult / 100000 / 1_000_000) * 100
    print(f"\n✅ Final RTP: {final_rtp:.2f}%")

# Create CSV
print("Creating lookup table...")
with open("public/publish_files/lookUpTable_base_0.csv", "w") as csv:
    with open("public/publish_files/books_base.jsonl", "r") as jsonl:
        for line in jsonl:
            d = json.loads(line)
            csv.write(f"{d['id']},1,{d['payoutMultiplier']}\n")

print("✅ CSV created")

# Compress
print("Compressing...")
os.system("zstd -f public/publish_files/books_base.jsonl -o public/publish_files/books_base.jsonl.zst")
print("✅ Compressed to .zst")

print("\n🎉 DONE! Files ready in public/publish_files/")
