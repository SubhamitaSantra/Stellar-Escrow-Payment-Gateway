# Stellar Escrow Gateway Frontend

This folder contains the Next.js 14 premium dashboard frontend for the **Stellar Escrow Payment Gateway**, communicating with the Soroban smart contract network using `@stellar/stellar-sdk` and Freighter wallet.

## Deployed Contract Address
* **Contract ID**: `CCKBEDV7QM7U7D2OSWZJXWMZEQ4KEZQSHSB6VJS52CYEKM5ZI6YPCKS3`
* **Testnet Explorer**: [https://stellar.expert/explorer/testnet/contract/CCKBEDV7QM7U7D2OSWZJXWMZEQ4KEZQSHSB6VJS52CYEKM5ZI6YPCKS3](https://stellar.expert/explorer/testnet/contract/CCKBEDV7QM7U7D2OSWZJXWMZEQ4KEZQSHSB6VJS52CYEKM5ZI6YPCKS3)

## Getting Started

### 1. Setup Environment
Ensure that you have created `frontend/.env.local` containing:
```env
NEXT_PUBLIC_CONTRACT_ID=CCKBEDV7QM7U7D2OSWZJXWMZEQ4KEZQSHSB6VJS52CYEKM5ZI6YPCKS3
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

### 2. Run the Development Server
From the `frontend` directory, execute:
```bash
bun run dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
Verify that the production compilation passes successfully:
```bash
bun run build
# or
npm run build
```
