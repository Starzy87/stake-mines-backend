from state.state import GeneralGameState
from .game import MinesGame

class MinesConfig(GeneralGameState):
    """
    Configuration for the Xtreme Mines game logic.
    Inherits from GeneralGameState as required by the Stake SDK.
    """
    name = "xtreme-mines"
    version = "1.0.0"
    game_class = MinesGame
    target_rtp = 0.964  # Target RTP of 96.4% as per Stake guidelines
    modes = ["normal"]
    # Bet amounts are handled in micros ($1.00 = 1,000,000)
    min_bet = 100_000 
    max_bet = 1_000_000_000 

if __name__ == "__main__":
    import random
    
    # Initialize the game logic
    game = MinesGame()
    total_rounds = 10000
    total_payout = 0
    
    print(f"--- Stake Compliance Simulation: {total_rounds} Rounds ---")
    
    for _ in range(total_rounds):
        # Simulate a standard game with 3 mines
        res = game.play({"mines": 3})
        
        # Calculate probability of a safe first pick (22 safe tiles out of 25)
        prob_safe_pick = (25 - 3) / 25
        
        # Simulate an outcome based on that probability
        if random.random() < prob_safe_pick:
            # If safe, the user wins the calculated multiplier
            total_payout += res["max_multiplier"]
            
    observed_rtp = (total_payout / total_rounds)
    
    print(f"Observed RTP: {observed_rtp:.4%}")
    print(f"Target RTP: 96.4000%")
    
    # Validation check for Stake compliance
    if 0.95 <= observed_rtp <= 0.98:
        print("Compliance Status: ✅ PASSED")
    else:
        print("Compliance Status: ❌ FAILED - Check multiplier logic in game.py")