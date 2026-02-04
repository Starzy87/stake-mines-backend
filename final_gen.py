import json, os, random, hashlib

def gen(id):
    board = list(range(25))
    random.shuffle(board)
    mine_pos = sorted(board[:3])
    safe_pos = board[3:]
    
    reveals = random.choices([1,2,3,4,5,6,7,8], weights=[30,25,20,12,7,3,2,1])[0]
    
    # Calculate TRUE expected multiplier
    mult = 1.0
    for i in range(reveals):
        mult *= ((25-i) / (22-i))  # Inverse of probability
    
    # Apply house edge to FINAL multiplier
    mult *= 0.964
    
    return {
        "id": id,
        "payoutMultiplier": int(round(mult * 100, 0)),
        "events": [
            {"index":0, "type":"roundStart", "mines":3, "seedHash":hashlib.md5(str(id).encode()).hexdigest(), "nonce":id},
            {"index":1, "type":"revealSequence", "revealedSafe":safe_pos[:reveals], "hitMineAt":None, "mineLocations":mine_pos},
            {"index":2, "type":"setWin", "amount":int(round(mult*100,0))},
            {"index":3, "type":"finalWin", "amount":int(round(mult*100,0))}
        ]
    }

os.makedirs("public/publish_files", exist_ok=True)
with open("public/publish_files/mines_events.jsonl", "w") as f:
    total = 0
    for i in range(1, 100001):
        d = gen(i)
        total += d['payoutMultiplier']
        f.write(json.dumps(d) + "\n")
        if i % 20000 == 0:
            print(f"{i}... RTP: {total/i:.2f}%")
    print(f"\nFinal: {total/100000:.2f}%")
