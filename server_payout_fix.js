// Find and replace this section in your server.js:

app.post('/wallet/end-round', (req, res) => {
    const { sessionID } = req.body;
    
    const session = sessions[sessionID];
    if (!session) {
        return res.status(400).json({ 
            code: 'ERR_IS',
            message: 'Invalid session' 
        });
    }
    
    if (!session.activeRound) {
        return res.status(400).json({
            code: 'ERR_NO_ROUND',
            message: 'No active round'
        });
    }
    
    // Calculate payout - FIXED VERSION
    const round = session.activeRound;
    // payoutMultiplier is for a $1 bet, scale it by actual bet amount
    const betAmountInDollars = round.betAmount / 1000000;
    const payout = Math.floor(betAmountInDollars * round.payoutMultiplier);
    
    // Credit winnings
    session.balance += payout;
    
    // Clear active round
    session.activeRound = null;
    
    res.json({
        balance: {
            amount: session.balance,
            currency: session.currency
        }
    });
});
