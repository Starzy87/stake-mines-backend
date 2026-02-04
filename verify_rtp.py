import json
import os

FILE_PATH = "public/publish_files/mines_events.jsonl"

def verify():
    print("🔍 Verifying RTP...")
    
    if not os.path.exists(FILE_PATH):
        print(f"❌ Error: {FILE_PATH} not found. Run the generator first.")
        return

    total_multiplier_sum = 0.0
    count = 0
    
    try:
        with open(FILE_PATH, 'r') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    total_multiplier_sum += data['payoutMultiplier']
                    count += 1
                except:
                    continue
    except FileNotFoundError:
        print(f"❌ Error: Could not read {FILE_PATH}")
        return
            
    if count == 0:
        print("❌ Error: File is empty.")
        return

    rtp = (total_multiplier_sum / count) * 100
    
    print("-" * 30)
    print(f"Total Rounds: {count}")
    print(f"Calculated RTP: {rtp:.4f}%")
    print("-" * 30)
    
    if 95.0 <= rtp <= 98.0:
        print("✅ COMPLIANCE STATUS: PASSED")
    else:
        print(f"❌ COMPLIANCE STATUS: FAILED (Got {rtp:.2f}%)")

if __name__ == "__main__":
    verify()
