import { isConnected, getAddress, signTransaction } from '@stellar/freighter-api';
import { Horizon, TransactionBuilder } from '@stellar/stellar-sdk';

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
}

/**
 * Returns the Stellar Testnet network configuration.
 */
export function getNetworkConfig(): NetworkConfig {
  return {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  };
}

/**
 * Connects Freighter and returns the public key of the active account.
 * Throws an error if Freighter is not installed or the user rejects connection.
 */
export async function getFreighterPublicKey(): Promise<string> {
  const connectionResult = await isConnected();
  if (!connectionResult || !connectionResult.isConnected) {
    throw new Error('Freighter wallet extension not detected. Please install Freighter from freighter.app.');
  }

  try {
    const addressResult = await getAddress();
    if (!addressResult || !addressResult.address) {
      if (addressResult && (addressResult as any).error) {
        throw new Error((addressResult as any).error);
      }
      throw new Error('No accounts found. Please unlock your Freighter wallet.');
    }
    return addressResult.address;
  } catch (error: any) {
    throw new Error(error.message || 'Freighter connection rejected.');
  }
}

/**
 * Hits the Stellar Friendbot API to fund a Testnet account.
 * Returns true if successful, false otherwise.
 */
export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const url = `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`;
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    console.error('Friendbot error:', error);
    return false;
  }
}

/**
 * Signs a transaction XDR with Freighter and submits it to the Stellar Testnet Horizon.
 * Returns the transaction submission result from Horizon.
 */
export async function signAndSubmitTransaction(xdr: string): Promise<any> {
  const { horizonUrl, networkPassphrase } = getNetworkConfig();
  const server = new Horizon.Server(horizonUrl);

  // 1. Sign the transaction envelope XDR with Freighter
  let signedXdr: string;
  try {
    const signResult = await signTransaction(xdr, {
      networkPassphrase,
    });
    if (!signResult || !signResult.signedTxXdr) {
      if (signResult && (signResult as any).error) {
        throw new Error((signResult as any).error);
      }
      throw new Error('Failed to sign transaction.');
    }
    signedXdr = signResult.signedTxXdr;
  } catch (error: any) {
    throw new Error(error.message || 'Transaction signing declined by Freighter user.');
  }

  // 2. Submit the signed transaction to the Horizon server
  try {
    const transactionObject = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    const response = await server.submitTransaction(transactionObject);
    return response;
  } catch (error: any) {
    console.error('Horizon transaction submission error:', error);
    const horizonErrorMsg = error.response?.data?.extras?.result_codes?.transaction || '';
    throw new Error(
      `Transaction submission failed.${horizonErrorMsg ? ` Code: ${horizonErrorMsg}` : ''}`
    );
  }
}
