# ⚡ Blitz Bingo: High-Stakes PvP Gaming on Linera

> **Project Status**: Phase 1 Complete (Dice Bingo Implemented)  
> **Backend**: Rust (Linera SDK)  
> **Frontend**: React + TypeScript + Vite  
> **Network**: Linera Conway Testnet

---

## 📖 Project Overview

**Blitz Bingo** is a decentralized, high-performance gaming platform built on the **Linera** blockchain. It leverages Linera's **micro-rollup** architecture to deliver near-instant finality and low-latency gameplay.

The project demonstrates:
1.  **Escrow & State Management**: Secure handling of wagers and game state persistence.
2.  **Verifiable Randomness**: On-chain RNG for fair gameplay.

---

## 🛠 Technology Stack

### Backend (Rust / Linera WASM)
*   **Linera SDK**: Core blockchain framework for micro-rollups.
*   **Rust**: Primary language for contract and service logic.
*   **GraphQL**: API layer for querying chain state and submitting mutations.
*   **Bincode/Serde**: Efficient serialization for cross-chain messages.
*   **Wasm32**: Compilation target for on-chain execution.

### Frontend (React / TypeScript)
*   **Vite**: Fast build tool and dev server.
*   **React 18**: UI library with Hooks pattern.
*   **Framer Motion**: Advanced animations and "Glassmorphism" UI effects.
*   **Tailwind CSS**: Utility-first styling for responsive design.
*   **GraphQL Request**: Lightweight client for Linera service interaction.

---

## 🏗 Architecture & Design

### Micro-Rollup Pattern
Blitz Bingo runs as a persistent **Application** on the Linera network.
*   **Application Chain**: The "Server" chain that holds global state (active matches, high scores, escrow).
*   **User Chains**: Each player operates on their own micro-chain, sending cross-chain messages to the Application Chain to perform actions (Bet, Move, Join).

### Data Flow
1.  **Queries (Reads)**: Frontend directly queries the local Linera Service (`localhost:8080`) which syncs state from the Application Chain.
2.  **Mutations (Writes)**: Single-chain operations (immediate execution).

---

## 🚀 Features Implemented

### Phase 1: Dice Bingo (Single Player)
*   **Mechanic**: Roll 5 dice to match numbers on a Bingo card.
*   **Economy**: Pay entry fee, pay per roll, win multipliers (up to 10x).
*   **Safety**: Optimistic UI with polling-based transaction verification.
*   **Components**: 
    *   `BingoCard.tsx`: Grid visualization with win line highlighting.
    *   `DiceShaker.tsx`: 3D-style dice animation.
    *   `AssetFaucets.tsx`: Token management and minting interface.
    *   `WinModal.tsx`: Victory celebration and prize claiming.
    *   `QuickBetChips.tsx`: Rapid betting controls.
    *   `GameStats.tsx`: Live session tracking.

---

## 📂 Project Structure

### `/blitz-bingo` (Backend)

| File | Purpose |
|------|---------|
| `src/lib.rs` | **Type Definitions**. `Operation` enum. Defines the shared protocol. |
| `src/contract.rs` | **Business Logic**. Handles game state, escrow locking, and verifiable randomness. |
| `src/service.rs` | **API Layer**. Exposes GraphQL queries (`currentCard`, `lastRoll`) and mutations. |
| `src/state.rs` | **Persistence**. `BlitzBingoState` struct using `MapView` for scalable storage. |

### `/blitz-bingo-frontend` (Frontend)

| Directory/File | Purpose |
|----------------|---------|
| `src/components/` | **UI Components**. |
| `src/hooks/useGame.ts` | **Game Hook**. Manages GraphQL polling and optimistic UI updates. |
| `src/hooks/useLinera.ts` | **Core Hook**. Wallet connection and logic. |
| `src/App.tsx` | **Router**. Tab navigation and global Layout. |

---



---

## 📥 Setup & Deployment

### 1. Build Contracts
```bash
cd blitz-bingo
cargo build --release --target wasm32-unknown-unknown
```

### 2. Deploy to Testnet
```bash
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera publish-and-create \
  target/wasm32-unknown-unknown/release/blitz_bingo_contract.wasm \
  target/wasm32-unknown-unknown/release/blitz_bingo_service.wasm \
  --json-argument 'null'
```
*   Save the resulting **Application ID**.

### 3. Run Frontend
```bash
cd blitz-bingo-frontend
# Update .env or use UI settings to set App ID & Chain ID
npm run dev
```

---

## 🔮 Future Roadmap (Phase 3)
*   **Tournaments**: Bracket-style elimination with pot accumulation.
