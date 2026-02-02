# FlashPort Deployment Guide - Conway Testnet

## Prerequisites

1. **Linera CLI installed** (v0.15.x)
2. **Rust toolchain** (1.86.0+)
3. **wasm32-unknown-unknown target**

```bash
rustup target add wasm32-unknown-unknown
```

---

## Step 1: Build Wasm Binaries

```bash
cd /home/baba/linera2/Game/flashport
cargo build --release --target wasm32-unknown-unknown
```

This creates:
- `target/wasm32-unknown-unknown/release/flashport_contract.wasm`
- `target/wasm32-unknown-unknown/release/flashport_service.wasm`

---

## Step 2: Initialize Linera Wallet

```bash
# Initialize wallet for Conway Testnet
linera wallet init --faucet https://faucet.testnet-conway.linera.net
```

This will:
- Create a new wallet
- Connect to Conway Testnet
- Request initial chain and tokens from faucet

---

## Step 3: Check Your Chain

```bash
# See your chain ID and balance
linera wallet show

# Get more test tokens if needed
linera wallet request --faucet https://faucet.testnet-conway.linera.net
```

---

## Step 4: Deploy FlashPort Application

```bash
cd /home/baba/linera2/Game/flashport

# Publish bytecode and create application instance
linera publish-and-create \
  target/wasm32-unknown-unknown/release/flashport_contract.wasm \
  target/wasm32-unknown-unknown/release/flashport_service.wasm \
  --json-argument 'null'
```

**Save the Application ID!** It looks like:
```
e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000
```

---

## Step 5: Start Local Node Service

```bash
# Start the node service (keeps running)
linera service --port 8080
```

Your application GraphQL endpoint will be at:
```
http://localhost:8080/chains/<YOUR_CHAIN_ID>/applications/<APP_ID>
```

---

## Step 6: Configure Frontend

Update `/home/baba/linera2/Game/flashport-frontend/.env`:

```env
VITE_LINERA_NODE_URL=https://testnet-conway.linera.net
VITE_LINERA_FAUCET_URL=https://faucet.testnet-conway.linera.net
VITE_FLASHPORT_APP_ID=<YOUR_APPLICATION_ID>
```

---

## Step 7: Run Frontend

```bash
cd /home/baba/linera2/Game/flashport-frontend
npm run dev
```

Open http://localhost:5173

---

## Testing the Game

1. **Connect Wallet**: Click "Connect Wallet" - MetaMask will prompt
2. **Set Application ID**: Paste your deployed app ID
3. **Get Test Tokens**: Click "Get Test LINERA" 
4. **Deposit**: Your balance will show deposited LINERA
5. **Start Session**: Creates a 1-hour session
6. **New Game**: Pays 5 LINERA, gets bingo card
7. **Roll Dice**: Pays 0.1 LINERA per roll
8. **Win**: Get 10 LINERA (2x entry fee)

---

## Troubleshooting

### "Cross-Origin Isolated" Error
The Linera WASM client requires special headers. Vite dev server is configured, but for production deploy you need:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### "Chain sync failed"
Click "Disconnect" to reset the local IndexedDB and reconnect.

### "Insufficient balance"
Request more tokens from faucet via the "Get Test LINERA" button.

---

## Production Deployment

For Vercel/Netlify, add a `vercel.json` or `_headers` file:

**vercel.json**:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

**Netlify _headers**:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```
