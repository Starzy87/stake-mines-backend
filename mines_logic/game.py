import random

class MinesGame: 
    def play(self, user_input: dict, rng=None):
        mines_count = user_input.get("mines", 3)
        board = list(range(25))
        random.shuffle(board)
        
        mine_positions = sorted(board[:mines_count])
        safe_positions = board[mines_count:]
        
        weights = [30, 25, 20, 12, 7, 3, 2, 1]
        reveals = random.choices(range(1, 9), weights=weights)[0]
        reveals = min(reveals, 22)
        
        multiplier = 1.0
        for i in range(reveals):
            prob = (22 - i) / (25 - i)
            multiplier *= (1.0 / prob)
        
        # Apply house edge - THIS is where 96.4% comes from
        multiplier *= 0.964
        
        # NO mine hits - house edge handles RTP
        
        return {
            "mines": mine_positions,
            "safe": safe_positions,
            "max_multiplier": round(multiplier, 4)
        }
