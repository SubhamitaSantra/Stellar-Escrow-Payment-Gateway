'use client';

import React, { useState } from 'react';
import { getFreighterPublicKey, fundWithFriendbot } from '../lib/stellar';
import { Shield, CheckCircle2, AlertCircle, Coins, LogOut, ArrowRight, Loader2 } from 'lucide-react';

interface WalletConnectProps {
  publicKey: string | null;
  setPublicKey: (key: string | null) => void;
}

export default function WalletConnect({ publicKey, setPublicKey }: WalletConnectProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [funding, setFunding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const key = await getFreighterPublicKey();
      setPublicKey(key);
      setInfo('Wallet connected successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to connect Freighter wallet.');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setError(null);
    setInfo('Wallet disconnected.');
  };

  const requestTestnetFunds = async () => {
    if (!publicKey) return;
    setFunding(true);
    setError(null);
    setInfo(null);
    try {
      const success = await fundWithFriendbot(publicKey);
      if (success) {
        setInfo('Successfully funded 10,000 Testnet XLM via Friendbot! Refresh your wallet balance.');
      } else {
        throw new Error('Friendbot funding request rejected. Try again later.');
      }
    } catch (err: any) {
      setError(err.message || 'Friendbot error occurred.');
    } finally {
      setFunding(false);
    }
  };

  const truncateKey = (key: string) => {
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
  };

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between p-5 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-2xl gap-4 transition-all hover:border-white/10 shadow-2xl">
      {/* Wallet info */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
          <Shield className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-neutral-400 uppercase">Stellar Network Status</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs text-neutral-400 font-medium">Stellar Testnet Only</span>
          </div>
        </div>
      </div>

      {/* Connection panel */}
      <div className="flex flex-wrap items-center gap-3">
        {publicKey ? (
          <>
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-neutral-200 text-sm font-mono tracking-wide">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              {truncateKey(publicKey)}
            </div>

            <button
              onClick={requestTestnetFunds}
              disabled={funding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-40 transition-all duration-300 transform hover:scale-[1.02]"
            >
              {funding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Coins className="w-4 h-4" />
              )}
              {funding ? 'Funding account...' : 'Get Testnet XLM'}
            </button>

            <button
              onClick={disconnectWallet}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/10 hover:bg-red-500/5 text-red-400 transition-all text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </>
        ) : (
          <button
            onClick={connectWallet}
            disabled={loading}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold tracking-wide transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            <span>{loading ? 'Connecting Wallet...' : 'Connect Freighter Wallet'}</span>
            <ArrowRight className="w-4 h-4 opacity-75" />
          </button>
        )}
      </div>

      {/* Messages banner */}
      {(error || info) && (
        <div className="w-full md:absolute md:top-24 md:left-0 md:px-8 mt-2 z-50">
          {error && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}
          {info && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-sm animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="font-medium">{info}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
