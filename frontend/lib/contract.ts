import {
  Contract,
  rpc,
  TransactionBuilder,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  Horizon
} from '@stellar/stellar-sdk';
import { getNetworkConfig, signAndSubmitTransaction } from './stellar';

// Standard Native XLM contract ID on Stellar Testnet
export const NATIVE_TOKEN_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJSIZ275M2ZV2CCQXFS2V263E77WO7WC6';

/**
 * Interface representing the Escrow struct returned by the contract.
 */
export interface EscrowDetails {
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  state: number; // 1 = Deposited, 2 = Released, 3 = Disputed, 4 = Refunded
  timeout: bigint; // Unix timestamp in seconds
}

/**
 * Gets the deployed contract ID from environment variables.
 */
export function getContractId(): string {
  return process.env.NEXT_PUBLIC_CONTRACT_ID || '';
}

/**
 * Instantiates the Soroban RPC Server.
 */
function getSorobanServer(): rpc.Server {
  const { rpcUrl } = getNetworkConfig();
  return new rpc.Server(rpcUrl);
}

/**
 * Fetches the current state of the escrow.
 * Returns null if the escrow is not yet initialized or environment is unconfigured.
 */
export async function getEscrow(): Promise<EscrowDetails | null> {
  const contractId = getContractId();
  if (!contractId) {
    console.warn('getEscrow: NEXT_PUBLIC_CONTRACT_ID is not defined.');
    return null;
  }

  const { networkPassphrase } = getNetworkConfig();
  const rpcServer = getSorobanServer();

  const contract = new Contract(contractId);

  // We build a dummy transaction using a random/valid public key for simulation
  const dummyAccount = new Account('GAAAAAAAAAAAAAAAUGELAAAAAAALDAAAAAAAAAAAAAAAAAAAA4X2', '0');
  
  const tx = new TransactionBuilder(dummyAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(contract.call('get_escrow'))
    .setTimeout(30)
    .build();

  try {
    const simulation = await rpcServer.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(simulation)) {
      const result = simulation.result;
      if (!result || !result.retval) return null;
      
      const nativeValue = scValToNative(result.retval);
      if (!nativeValue) return null;
      
      // Parse Escrow struct.
      // scValToNative transforms Address into Address objects, let's stringify them.
      return {
        buyer: nativeValue.buyer.toString(),
        seller: nativeValue.seller.toString(),
        token: nativeValue.token.toString(),
        amount: BigInt(nativeValue.amount),
        state: Number(nativeValue.state),
        timeout: BigInt(nativeValue.timeout),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching escrow status:', error);
    return null;
  }
}

/**
 * Helper to build, simulate, and submit a Soroban write transaction.
 */
async function submitWriteTransaction(
  senderPublicKey: string,
  contractCallOp: xdr.Operation
): Promise<any> {
  const contractId = getContractId();
  if (!contractId) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ID is not configured in .env.local.');
  }

  const { networkPassphrase, horizonUrl } = getNetworkConfig();
  const rpcServer = getSorobanServer();
  const horizonServer = new Horizon.Server(horizonUrl);

  // 1. Fetch current sequence number of the sender account
  const account = await horizonServer.loadAccount(senderPublicKey);

  // 2. Build the initial transaction
  const tx = new TransactionBuilder(account, {
    fee: '100', // base fee, will be overridden by simulation
    networkPassphrase,
  })
    .addOperation(contractCallOp)
    .setTimeout(60)
    .build();

  // 3. Simulate transaction to calculate fees and footprints
  const simulation = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    console.error('Simulation details:', simulation);
    throw new Error(`Simulation failed: ${(simulation as any).error || 'unknown error'}`);
  }

  // 4. Assemble the final transaction with calculated footprints and fees
  const assembledTx = rpc.assembleTransaction(tx, simulation);

  // 5. Submit through Freighter signing pipeline
  const result = await signAndSubmitTransaction((assembledTx as any).toXDR());
  return result;
}

/**
 * Initializes the escrow contract and deposits funds from the buyer.
 */
export async function initializeEscrow(
  buyerPublicKey: string,
  sellerPublicKey: string,
  tokenAddress: string,
  amountStroops: bigint,
  timeoutSeconds: bigint
): Promise<any> {
  const contractId = getContractId();
  if (!contractId) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ID is not configured in .env.local.');
  }
  const contract = new Contract(contractId);

  const buyerScVal = Address.fromString(buyerPublicKey).toScVal();
  const sellerScVal = Address.fromString(sellerPublicKey).toScVal();
  const tokenScVal = Address.fromString(tokenAddress).toScVal();
  const amountScVal = nativeToScVal(amountStroops, { type: 'i128' });
  const timeoutScVal = nativeToScVal(timeoutSeconds, { type: 'u64' });

  const op = contract.call('initialize', buyerScVal, sellerScVal, tokenScVal, amountScVal, timeoutScVal);
  return submitWriteTransaction(buyerPublicKey, op);
}

/**
 * Confirms delivery and releases funds to the seller.
 * Can be called by the buyer at any time, or the seller after timeout.
 */
export async function releaseEscrow(callerPublicKey: string): Promise<any> {
  const contractId = getContractId();
  if (!contractId) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ID is not configured.');
  }
  const contract = new Contract(contractId);

  const callerScVal = Address.fromString(callerPublicKey).toScVal();
  const op = contract.call('release', callerScVal);
  return submitWriteTransaction(callerPublicKey, op);
}

/**
 * Disputes the escrow, returning funds to the buyer.
 * Can only be called by the buyer within the timeout window.
 */
export async function disputeEscrow(buyerPublicKey: string): Promise<any> {
  const contractId = getContractId();
  if (!contractId) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ID is not configured.');
  }
  const contract = new Contract(contractId);

  const op = contract.call('dispute');
  return submitWriteTransaction(buyerPublicKey, op);
}
