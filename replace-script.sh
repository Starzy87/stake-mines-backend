#!/bin/bash

# Backup
cp public/index.html public/index.html.backup

# Create a simple test HTML
cat > public/test.html << 'TESTHTML'
<!DOCTYPE html>
<html>
<head>
    <title>Stake API Test</title>
</head>
<body>
    <h1>Testing Stake Engine API</h1>
    <button onclick="testAPI()">Test Connection</button>
    <pre id="result"></pre>
    
    <script>
    async function testAPI() {
        try {
            const res = await fetch('http://localhost:3000/wallet/authenticate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionID: 'test-session-123' })
            });
            const data = await res.json();
            document.getElementById('result').innerText = JSON.stringify(data, null, 2);
        } catch (e) {
            document.getElementById('result').innerText = 'Error: ' + e.message;
        }
    }
    </script>
</body>
</html>
TESTHTML

echo "✅ Created test.html"
echo "Open http://localhost:3000/test.html in your browser"
