"""
PRODUCTION-GRADE MINES GAME LOGIC
For Stake Engine Submission
"""

import random
import hashlib
from typing import Dict, List, Any

class MinesGame:
    def __init__(self):
        self.house_edge = 0.964
        self.reveal_weights = {
            1: 25, 2: 20, 3: 15, 4: 10, 5: 8,
            6: 6, 7: 4, 8: 3, 9: 2, 10: 2, 11: 1, 12: 1
        }
    
    def play(self, user_input: Dict[str, Any], simulation_id: int = 0) -> Dict[str, Any]:
        mines_count = user_input.get("mines", 3)
        
        # Generate board
        board = list(range(25))
        random.shuffle(board)
        mine_positions = sorted(board[:mines_count])
        safe_positions = board[mines_count:]
        
        # Determine reveals
        max_reveals = 25 - mines_count
        reveal_count = self._get_reveal_count(max_reveals)
        
        # Simulate gameplay
        events = []
        revealed_safe = []
        current_multiplier = 1.0
        base_bet = 100
        
        events.append({
            "index": 0,
            "type": "roundStart",
            "mines": mines_count,
            "seedHash": self._generate_hash(simulation_id),
            "nonce": simulation_id
        })
        
        # Progressive reveals
        reveal_details = []
        for step in range(reveal_count):
            tile_index = safe_positions[step]
            revealed_safe.append(tile_index)
            
            remaining_tiles = 25 - step
            remaining_safe = max_reveals - step
            probability = remaining_safe / remaining_tiles
            step_multiplier = (1.0 / probability) * self.house_edge
            
            current_multiplier *= step_multiplier
            current_payout = int(base_bet * current_multiplier)
            
            reveal_details.append({
                "step": step,
                "tileIndex": tile_index,
                "multiplier": round(current_multiplier, 6),
                "payout": current_payout
            })
        
        # Determine outcome
        hit_mine = False
        hit_mine_tile = None
        
        if reveal_count < max_reveals and random.random() < 0.2:
            hit_mine = True
            hit_mine_tile = random.choice(mine_positions)
            final_payout = 0
        else:
            final_payout = int(base_bet * current_multiplier)
        
        # Compile events
        reveal_sequence = {
            "index": 1,
            "type": "revealSequence",
            "revealedSafe": revealed_safe,
            "hitMineAt": hit_mine_tile,
            "mineLocations": mine_positions,
            "revealDetails": reveal_details
        }
        
        final_events = [
            events[0],
            reveal_sequence,
            {"index": 2, "type": "setWin", "amount": final_payout},
            {"index": 3, "type": "finalWin", "amount": final_payout}
        ]
        
        return {
            "id": simulation_id,
            "payoutMultiplier": final_payout,
            "events": final_events,
            "mines": mine_positions,
            "safe": safe_positions,
            "revealCount": reveal_count,
            "hitMine": hit_mine
        }
    
    def _get_reveal_count(self, max_reveals: int) -> int:
        available_weights = {k: v for k, v in self.reveal_weights.items() if k <= max_reveals}
        if not available_weights:
            return 1
        counts = list(available_weights.keys())
        weights = list(available_weights.values())
        return random.choices(counts, weights=weights)[0]
    
    def _generate_hash(self, simulation_id: int) -> str:
        seed = f"mines_simulation_{simulation_id}_{random.random()}"
        return hashlib.sha256(seed.encode()).hexdigest()

# Test
if __name__ == "__main__":
    print("Testing Mines Game Logic...")
    game = MinesGame()
    
    # Test single round
    result = game.play({"mines": 3}, simulation_id=1)
    print(f"Round ID: {result['id']}")
    print(f"Revealed: {result['revealCount']} tiles")
    print(f"Payout: {result['payoutMultiplier']}")
    
    # Test RTP with 10k rounds
    print("\nGenerating 10,000 test rounds...")
    total_payout = 0
    for i in range(1, 10001):
        r = game.play({"mines": 3}, simulation_id=i)
        total_payout += r["payoutMultiplier"]
    
    rtp = total_payout / (10000 * 100)
    print(f"Observed RTP: {rtp:.4%}")
    print(f"Target RTP: 96.40%")
    
    if 0.95 <= rtp <= 0.98:
        print("✅ RTP CHECK PASSED!")
    else:
        print("❌ RTP CHECK FAILED!")
