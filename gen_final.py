import json, os, random, hashlib

def gen(id):
    mines = 3
    board = list(range(25))
    random.shuffle(board)
    mine_pos = sorted(board[:3])
    safe_pos = board[3:]
    
    reveals = random.choices([1,2,3,4,5,6,7,8], weights=[30,25,20,12,7,3,2,1])[0]
    mult = 1.0
    for i in range(reveals):
        mult *= (1 / ((22-i)/(25-i))) * 0.964
    
    # 3.6% mine hit
    if random.random() < 0.036:
        mult = 0
    
    return {
        "id": id,
        "payoutMultiplier": int(mult * 100),
        "events": [
            {"index":0, "type":"roundStart", "mines":3, "seedHash":hashlib.md5(str(id).encode()).hexdigest(), "nonce":id},
            {"index":1, "type":"revealSequence", "revealedSafe":safe_pos[:reveals], "hitMineAt":None, "mineLocations":mine_pos},
            {"index":2, "type":"setWin", "amount":int(mult*100)},
            {"index":3, "type":"finalWin", "amount":int(mult*100)}
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
