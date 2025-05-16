# MEGAETH 2048 Game

A port of the 2048 game for the MEGAETH blockchain, inspired by the Monad 2048 implementation. This repository contains both the smart contracts and the frontend code.

## Project Overview

This is an implementation of the classic 2048 puzzle game running fully on-chain using MEGAETH's fast block times. Every move is validated and stored on the blockchain, allowing for a decentralized gaming experience.

## Current Issue

I'm encountering an **"exceeds block gas limit"** error when trying to interact with the deployed contracts from the frontend. Specifically, the error occurs when attempting to initialize a game or make moves.

```
Error in init transaction: Error: exceeds block gas limit
    at sendRawTransactionAndConfirm (useTransactions.tsx:159:23)
    at async initializeGameTransaction (useTransactions.tsx:320:9)
```

Despite trying various gas settings, including:
- Gas limit: 300,000 (for startGame) / 200,000 (for play moves)
- maxFeePerGas: 0.05 Gwei
- maxPriorityFeePerGas: 0.01 Gwei

The transactions continue to fail with this error.

## Contract Deployments

The smart contracts have been deployed to MEGAETH Testnet at these addresses:

- **Board Library**: 0x8E389b11408e11951719d55E627A68b516276D07
- **MEGAETH2048 Game**: 0xd235C7Bb0E76D78405168d6458CB2A6bF9249576

## Smart Contracts

This implementation consists of two main contracts:

1. **MEGAETH2048**: Main game contract that handles game state and player interactions
2. **Board Library**: Utility library for board manipulation and game logic

The contracts use bit manipulation for efficient storage and gas optimization.

## Setup Instructions

### Smart Contracts (Development)

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Deploy to MEGAETH testnet
npx hardhat run scripts/deploy.ts --network megaeth
```

### Frontend

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Required Environment Variables

Create a `.env` file with the following variables:

```
PRIVATE_KEY=your_private_key_here
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
```

## Original Inspiration

This implementation is based on the Monad 2048 project, adapted for the MEGAETH blockchain. The original contracts and Frontend were modified to work with MEGAETH's network parameters.

## License

MIT