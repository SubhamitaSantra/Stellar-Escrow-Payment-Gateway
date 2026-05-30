# Stellar Escrow Payment Gateway

The Stellar Escrow Payment Gateway is a secure, decentralized, two-party escrow payment application built on the Stellar Soroban smart contract network. It allows a buyer to deposit XLM into a trustless escrow contract. The funds remain securely locked inside the contract and can only be released to the seller once the buyer explicitly confirms delivery, or claimed by the seller if a customizable dispute timeout window has passed without the buyer raising a dispute. If the buyer is unsatisfied or a dispute arises before the timeout expires, the buyer can raise a dispute, which automatically triggers a refund to the buyer.

## Tech Stack

- **Smart Contract**: Rust & Soroban SDK (`v21.0.0`)
- **Frontend**: Next.js 14 (App Router)
- **Programming Languages**: TypeScript, Rust
- **Styling**: Tailwind CSS
- **Wallet Connection**: Freighter Browser Extension (`@stellar/freighter-api`)
- **Stellar Integration**: `@stellar/stellar-sdk`

---

## Prerequisites

To compile the smart contract, deploy it, and run the client dashboard, you will need:
- **Rust**: Installed via `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Wasm Target for Rust**: `rustup target add wasm32-unknown-unknown`
- **Stellar CLI**: `cargo install --locked stellar-cli --features opt`
- **Node.js**: Version 18 or higher (using Bun or NPM)
- **Freighter Wallet**: Browser extension installed from [freighter.app](https://freighter.app/)

---

## Project Structure

```text
/contracts
  ├── src/lib.rs            <-- Soroban Smart Contract source code (escrow state machine)
  └── Cargo.toml            <-- Cargo package configuration with Soroban SDK 21.0.0
/frontend
  ├── app
  │   ├── layout.tsx        <-- Next.js Root Layout with global dark theme CSS
  │   └── page.tsx          <-- Dashboard premium landing dashboard
  ├── components
  │   ├── WalletConnect.tsx <-- Premium Freighter connect and Friendbot funding panel
  │   └── MainFeature.tsx   <-- Escrow gateway actions (deposit, release, dispute details)
  ├── lib
  │   ├── stellar.ts        <-- Freighter integration, config settings, transaction submission
  │   └── contract.ts       <-- Client-side Soroban RPC methods (simulate & submit)
  ├── package.json          <-- Frontend package dependencies
  ├── tailwind.config.ts    <-- Visual design configuration
  └── .env.example          <-- Environment variables template
.env.example                <-- Root environment variables template
README.md                   <-- Full setup and documentation guide (this file)
```

---

## Step 1 — Build the Smart Contract

1. Navigate to the contract folder:
   ```bash
   cd contracts
   ```
2. Build the Rust contract to Wasm bytecode:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```
   **Output**: This compiles the contract and creates a `.wasm` file at `contracts/target/wasm32-unknown-unknown/release/stellar_escrow.wasm`.

---

## Step 2 — Set Up a Testnet Identity

To deploy the contract, you will need a funded Stellar Testnet account.

1. Generate a new keypair identity named `my-key`:
   ```bash
   stellar keys generate --global my-key --network testnet
   ```
2. Fetch the corresponding public key address:
   ```bash
   stellar keys address my-key
   ```
   *Note: Generating a key through Stellar CLI automatically funds the account with free testnet XLM via Friendbot.*

---

## Step 3 — Deploy Contract to Testnet

To deploy the compiled Wasm bytecode onto the Stellar Testnet:

1. Execute the deploy command inside the `contracts` directory:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/stellar_escrow.wasm \
     --source my-key \
     --network testnet
   ```
2. **Copy the returned Contract ID** (e.g. `CDLZFC...`). You will need to paste this into your environment variables in **Step 5**.

---

## Step 4 — Install Frontend Dependencies

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install the Next.js dependencies using Bun (or npm):
   ```bash
   bun install
   ```

---

## Step 5 — Configure Environment Variables

1. Copy the environment template to your local environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Open `frontend/.env.local` and paste your deployed Contract ID from **Step 3** into:
   ```env
   NEXT_PUBLIC_CONTRACT_ID=YOUR_DEPLOYED_CONTRACT_ID
   ```

---

## Step 6 — Run the Frontend

1. Start the Next.js development server:
   ```bash
   bun run dev
   ```
2. Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)

---

## Step 7 — Using the App

1. **Freighter Wallet Configuration**:
   - Unlock your Freighter wallet.
   - Change network settings to **Testnet** (Settings → Network → Testnet).
2. **Connect Wallet**:
   - Click the **Connect Freighter Wallet** button in the dashboard to connect.
   - Once connected, your truncated public address will be displayed.
3. **Fund Your Wallet**:
   - If you need testnet funds, click **Get Testnet XLM**. The dashboard will trigger Friendbot to mint 10,000 Testnet XLM to your address.
4. **Create an Escrow (Deposit)**:
   - Input the **Seller's Public Key**, the **Amount of XLM** to deposit, and a **Timeout Window (in seconds)**.
   - Click **Initialize & Deposit XLM**. Freighter will prompt you to authorize the transfer. Once approved, the funds are deposited into the Soroban contract.
5. **Release Funds**:
   - **As the Buyer**: Click **Confirm & Release** at any time. The contract will transfer the locked XLM directly to the seller's account.
   - **As the Seller**: If the buyer fails to confirm but hasn't disputed, wait for the timeout to hit `0s`. Then click **Claim Released Funds (Timeout Expired)** to withdraw the XLM.
6. **Dispute & Refund**:
   - **As the Buyer**: If you are unsatisfied or haven't received the delivery, click **Raise Dispute & Refund** *before* the countdown reaches `0s`. The contract will instantly refund the deposited XLM back to your wallet.

---

## Smart Contract Functions

| Function | Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `initialize` | **Write** | `buyer: Address`, `seller: Address`, `token: Address`, `amount: i128`, `timeout_duration: u64` | Initializes the escrow contract and locks the buyer's tokens inside the contract. |
| `release` | **Write** | `caller: Address` | Releases locked funds. Buyer can release at any time. Seller can only claim after the timeout expires. |
| `dispute` | **Write** | None | Called by the buyer within the timeout window. Immediately refunds locked tokens to the buyer. |
| `get_escrow` | **Read** | None | Returns the current state, addresses, amount, and lock parameters of the escrow. |

---

## Common Errors & Fixes

- **"Transaction simulation failed: Error(Value)"**
  - *Cause*: The contract has not been deployed yet, or the `NEXT_PUBLIC_CONTRACT_ID` in `frontend/.env.local` is incorrect.
  - *Fix*: Complete Steps 3 & 5, and restart your frontend dev server.
- **"Freighter wallet extension not detected"**
  - *Cause*: The Freighter extension is not installed or locked.
  - *Fix*: Install Freighter from [freighter.app](https://freighter.app/) and sign in.
- **"Account not found" or "Underfunded"**
  - *Cause*: Your active wallet address is new and holds 0 XLM.
  - *Fix*: Click **Get Testnet XLM** on the dashboard to fund it.
- **"wasm32 target not found"**
  - *Cause*: Your local Rust installation lacks the Wasm compilation target.
  - *Fix*: Run `rustup target add wasm32-unknown-unknown`.

---

## Testnet Resources

- **Stellar Testnet Explorer**: [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)
- **Stellar Lab (Manual Transactions)**: [lab.stellar.org](https://lab.stellar.org/)
- **Friendbot Endpoint**: `https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>`
