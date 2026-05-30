'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  initializeEscrow,
  releaseEscrow,
  disputeEscrow,
  getEscrow,
  NATIVE_TOKEN_ADDRESS,
  EscrowDetails
} from '../lib/contract';
import {
  Clock,
  AlertTriangle,
  RefreshCw,
  Wallet,
  FileCheck2,
  Lock,
  Hourglass,
  Scale,
  DollarSign,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

interface MainFeatureProps {
  publicKey: string | null;
}

export default function MainFeature({ publicKey }: MainFeatureProps) {
  // Escrow details
  const [escrow, setEscrow] = useState<EscrowDetails | null>(null);
  const [contractId, setContractId] = useState<string>('');
  
  // Loading states
  const [fetching, setFetching] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states (for initialization)
  const [sellerInput, setSellerInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [timeoutInput, setTimeoutInput] = useState<string>('300'); // default 5 minutes (300 seconds)

  // Status and Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Countdown time
  const [timeLeft, setTimeLeft] = useState<bigint>(0n);

  // 1. Fetch Escrow status
  const refreshEscrowStatus = useCallback(async (silent = false) => {
    const cid = process.env.NEXT_PUBLIC_CONTRACT_ID || '';
    setContractId(cid);
    
    if (!cid) {
      return;
    }

    if (!silent) setFetching(true);
    setErrorMsg(null);
    try {
      const data = await getEscrow();
      setEscrow(data);
      if (data) {
        setSuccessMsg(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error fetching escrow status. Verify contract deployment.');
    } finally {
      if (!silent) setFetching(false);
    }
  }, []);

  // 2. Poll escrow on load
  useEffect(() => {
    refreshEscrowStatus();
  }, [refreshEscrowStatus]);

  // 3. Keep countdown timer updated
  useEffect(() => {
    if (!escrow || escrow.state !== 1) return; // Only count down when state is Deposited
    
    const calculateTimeLeft = () => {
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const diff = escrow.timeout - currentTimestamp;
      setTimeLeft(diff > 0n ? diff : 0n);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [escrow]);

  // 4. Create and Deposit Escrow
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      setErrorMsg('Please connect and unlock your Freighter wallet first.');
      return;
    }
    if (!sellerInput || !amountInput || !timeoutInput) {
      setErrorMsg('All fields are required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1 XLM = 10,000,000 stroops
      const amountXlm = parseFloat(amountInput);
      if (isNaN(amountXlm) || amountXlm <= 0) {
        throw new Error('Please enter a valid amount greater than 0.');
      }
      const amountStroops = BigInt(Math.floor(amountXlm * 10_000_000));

      const durationSeconds = BigInt(timeoutInput);
      if (durationSeconds <= 0n) {
        throw new Error('Dispute window must be greater than 0 seconds.');
      }

      await initializeEscrow(
        publicKey,
        sellerInput.trim(),
        NATIVE_TOKEN_ADDRESS,
        amountStroops,
        durationSeconds
      );

      setSuccessMsg('Escrow created successfully! XLM deposited into the Soroban contract.');
      await refreshEscrowStatus();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Escrow initialization failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Confirm Delivery (Release funds)
  const handleRelease = async () => {
    if (!publicKey) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await releaseEscrow(publicKey);
      setSuccessMsg('Escrow completed! Funds successfully released to the seller.');
      await refreshEscrowStatus();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to release escrow funds.');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Raise Dispute (Refund funds)
  const handleDispute = async () => {
    if (!publicKey) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await disputeEscrow(publicKey);
      setSuccessMsg('Dispute raised! Funds successfully refunded back to the buyer.');
      await refreshEscrowStatus();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to raise dispute.');
    } finally {
      setSubmitting(false);
    }
  };

  // Utility to convert stroops back to XLM string
  const formatStroopsToXlm = (stroops: bigint) => {
    return (Number(stroops) / 10_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 7
    });
  };

  // Utility to format countdown string
  const formatTimeLeft = (seconds: bigint) => {
    if (seconds <= 0n) return 'Expired';
    const h = seconds / 3600n;
    const m = (seconds % 3600n) / 60n;
    const s = seconds % 60n;
    
    const parts = [];
    if (h > 0n) parts.push(`${h}h`);
    if (m > 0n || h > 0n) parts.push(`${m}m`);
    parts.push(`${s}s`);
    
    return parts.join(' ');
  };

  // Get state name and visual classes
  const getStateMeta = (stateNum: number | undefined) => {
    switch (stateNum) {
      case 1:
        return {
          label: 'Holding Funds (Deposited)',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          desc: 'XLM is locked in escrow. Awaiting buyer delivery confirmation.'
        };
      case 2:
        return {
          label: 'Released (Completed)',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          desc: 'Escrow closed. Funds successfully released to the seller.'
        };
      case 3:
        return {
          label: 'Disputed',
          color: 'text-red-400 bg-red-500/10 border-red-500/20',
          desc: 'Escrow disputed by the buyer.'
        };
      case 4:
        return {
          label: 'Refunded (Closed)',
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          desc: 'Escrow closed. Funds returned to the buyer.'
        };
      default:
        return {
          label: 'Unknown State',
          color: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20',
          desc: 'State is undefined.'
        };
    }
  };

  const stateMeta = getStateMeta(escrow?.state);

  return (
    <div className="w-full flex flex-col gap-6 max-w-4xl mx-auto">
      {/* 1. Missing Contract ID Banner */}
      {!contractId && (
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-sm animate-in fade-in duration-500">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <span className="font-bold text-amber-200 text-base">Contract Environment Unconfigured</span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The escrow smart contract has not been linked to the frontend. Deploy your Soroban contract to Stellar Testnet (or check the walkthrough guide), copy the returned **Contract ID**, and add it to your <code className="text-amber-200 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">frontend/.env.local</code> file:
            </p>
            <pre className="text-[11px] bg-black/40 border border-white/5 p-3 rounded-lg font-mono text-emerald-400 select-all">
              NEXT_PUBLIC_CONTRACT_ID=YOUR_DEPLOYED_CONTRACT_ID
            </pre>
            <p className="text-[10px] text-neutral-400">
              * Remember to restart your Next.js development server (<code className="font-mono bg-neutral-800 px-1 py-0.5 rounded">Ctrl + C</code> and then <code className="font-mono bg-neutral-800 px-1 py-0.5 rounded">bun run dev</code>) after updating env parameters.
            </p>
          </div>
        </div>
      )}

      {/* 2. Freighter Wallet Locked Warning (If contract is set up but key is missing) */}
      {contractId && !publicKey && (
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-300 text-sm animate-in fade-in duration-500">
          <ShieldAlert className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-indigo-200 text-base">Freighter Wallet Locked or Disconnected</span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Unlock your Freighter extension in the browser, import or select an active account, and click **Connect Freighter Wallet** above. Make sure the wallet network is switched to **Testnet** (Settings → Network → Testnet).
            </p>
          </div>
        </div>
      )}

      {/* Alert Banners */}
      {errorMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm animate-in fade-in duration-300">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-red-200">Error: </span>
            {errorMsg}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-emerald-200">Success: </span>
            {successMsg}
          </div>
        </div>
      )}

      {/* Main Panel Box */}
      <div className={`w-full border border-white/5 bg-white/[0.01] backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden ${!contractId ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Glow Effects */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Dashboard Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 text-violet-400">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Escrow Payment Gateway</h1>
              <p className="text-xs text-neutral-400">Secure two-party Soroban Escrow System</p>
            </div>
          </div>
          <button
            onClick={() => refreshEscrowStatus()}
            disabled={fetching || !contractId}
            className="p-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white transition-all duration-300 disabled:opacity-40"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 1. SCENARIO A: NO ESCROW ACTIVE (INITIALIZE VIEW) */}
        {!escrow ? (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center max-w-lg mx-auto mb-8">
              <div className="inline-flex p-4 rounded-full bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 mb-4">
                <Hourglass className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-neutral-200">No Active Escrow Detected</h2>
              <p className="text-sm text-neutral-400 mt-1.5">
                The smart contract is ready. Enter details below as a buyer to deposit XLM and initialize the secure payment channel.
              </p>
            </div>

            <form onSubmit={handleDeposit} className="space-y-6 max-w-xl mx-auto">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Seller Public Key</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={sellerInput}
                    onChange={(e) => setSellerInput(e.target.value)}
                    placeholder="e.g. GCS3... (Stellar Public Address)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 focus:border-indigo-500/50 focus:bg-white/[0.04] text-white text-sm placeholder-neutral-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Amount (XLM)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      step="0.0000001"
                      required
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 focus:border-indigo-500/50 focus:bg-white/[0.04] text-white text-sm placeholder-neutral-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Dispute Timeout (Seconds)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Clock className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      required
                      value={timeoutInput}
                      onChange={(e) => setTimeoutInput(e.target.value)}
                      placeholder="e.g. 300 for 5 min"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 focus:border-indigo-500/50 focus:bg-white/[0.04] text-white text-sm placeholder-neutral-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !publicKey}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 active:scale-[0.99] text-white font-bold tracking-wide transition-all shadow-lg shadow-indigo-500/10 disabled:opacity-40"
              >
                {submitting ? 'Processing Deposit...' : 'Initialize & Deposit XLM'}
              </button>

              {!publicKey && (
                <p className="text-center text-xs text-amber-400 font-medium animate-pulse">
                  * Unlock Freighter wallet and connect first.
                </p>
              )}
            </form>
          </div>
        ) : (
          /* 2. SCENARIO B: ACTIVE ESCROW (DASHBOARD ACTION PANELS) */
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top State Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/[0.01] gap-4">
              <div className="space-y-1">
                <span className="text-xs text-neutral-400 font-semibold tracking-wider uppercase">Current Escrow State</span>
                <p className="text-sm text-neutral-300 font-medium">{stateMeta.desc}</p>
              </div>
              <div className={`px-4 py-2 rounded-xl border text-xs font-semibold tracking-wider uppercase ${stateMeta.color}`}>
                {stateMeta.label}
              </div>
            </div>

            {/* General Metadata grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-300 border-l-2 border-indigo-500 pl-2">Escrow Details</h3>
                <div className="space-y-3 p-4.5 rounded-2xl border border-white/5 bg-white/[0.01]">
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2.5">
                    <span className="text-neutral-400 font-medium">Buyer (Depositor)</span>
                    <span className="text-neutral-200 font-mono" title={escrow.buyer}>
                      {escrow.buyer.slice(0, 6)}...{escrow.buyer.slice(-6)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2.5">
                    <span className="text-neutral-400 font-medium">Seller (Beneficiary)</span>
                    <span className="text-neutral-200 font-mono" title={escrow.seller}>
                      {escrow.seller.slice(0, 6)}...{escrow.seller.slice(-6)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2.5">
                    <span className="text-neutral-400 font-medium">Asset Contract</span>
                    <span className="text-neutral-200 font-mono text-[10px]" title={escrow.token}>
                      {escrow.token.slice(0, 8)}...{escrow.token.slice(-8)} (Native XLM)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-neutral-400 font-medium">Deposit Value</span>
                    <div className="text-right">
                      <span className="text-white font-extrabold text-sm tracking-tight">
                        {formatStroopsToXlm(escrow.amount)} XLM
                      </span>
                      <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                        {escrow.amount.toLocaleString()} stroops
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Timelock countdown & state actions */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-300 border-l-2 border-purple-500 pl-2">Time-Lock Verification</h3>
                <div className="p-4.5 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-center gap-4">
                  {escrow.state === 1 ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                          <Clock className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-xs text-neutral-400 font-medium">Dispute Timeout Window</p>
                          <span className="text-white font-black text-xl tracking-tight">
                            {formatTimeLeft(timeLeft)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(100, (Number(timeLeft) / Number(escrow.timeout - BigInt(Math.floor(escrow.timeout as any - 300)))) * 100)}%`
                          }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        * Once expired, the buyer can no longer dispute, and the seller can safely claim the release of funds.
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 py-4 text-neutral-400 text-sm">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span>Escrow period completed. No dispute countdown active.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CTA action buttons based on status & caller */}
            {escrow.state === 1 && (
              <div className="border-t border-white/5 pt-8">
                <h3 className="text-sm font-semibold text-neutral-300 text-center mb-6">Escrow Execution Center</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {/* Buyer action: Confirm Release */}
                  <button
                    onClick={handleRelease}
                    disabled={submitting || !publicKey || publicKey !== escrow.buyer}
                    className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-30 disabled:pointer-events-none group"
                  >
                    <FileCheck2 className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm text-emerald-200">Confirm & Release</span>
                    <span className="text-[10px] text-neutral-400 text-center">
                      Only buyer can execute this at any time to release funds to the seller.
                    </span>
                  </button>

                  {/* Buyer action: Raise Dispute */}
                  <button
                    onClick={handleDispute}
                    disabled={submitting || !publicKey || publicKey !== escrow.buyer || timeLeft <= 0n}
                    className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-30 disabled:pointer-events-none group"
                  >
                    <AlertTriangle className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm text-red-200">Raise Dispute & Refund</span>
                    <span className="text-[10px] text-neutral-400 text-center font-medium">
                      Only buyer can execute this before the timeout. Funds return to buyer.
                    </span>
                  </button>
                </div>

                {/* Seller Claim if Timeout passed */}
                {timeLeft === 0n && publicKey === escrow.seller && (
                  <div className="mt-4 text-center animate-in fade-in duration-500">
                    <button
                      onClick={handleRelease}
                      disabled={submitting}
                      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold text-sm transition-all"
                    >
                      <Lock className="w-4 h-4 text-indigo-400" />
                      <span>Claim Released Funds (Timeout Expired)</span>
                    </button>
                  </div>
                )}

                {/* Verification/Warning info if wallet is not buyer/seller */}
                {publicKey && publicKey !== escrow.buyer && publicKey !== escrow.seller && (
                  <p className="text-center text-xs text-amber-400/80 font-medium mt-6">
                    * Connected wallet is neither the Buyer nor the Seller. Switch accounts to interact.
                  </p>
                )}
              </div>
            )}

            {/* Restart Escrow Gateway */}
            {escrow.state !== 1 && (
              <div className="border-t border-white/5 pt-8 text-center">
                <button
                  onClick={() => setEscrow(null)}
                  className="px-6 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 text-sm font-semibold text-white tracking-wide transition-all"
                >
                  Create New Escrow
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
