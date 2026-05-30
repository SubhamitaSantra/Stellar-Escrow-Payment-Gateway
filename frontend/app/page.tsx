'use client';

import React, { useState } from 'react';
import WalletConnect from '../components/WalletConnect';
import MainFeature from '../components/MainFeature';
import { Scale, Lock, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans overflow-x-hidden pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Visual Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-[140px] pointer-events-none -z-10"></div>

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-12">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Soroban Smart Contract</span>
              <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                Stellar Escrow
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-300 font-semibold tracking-wide">
            <Zap className="w-3.5 h-3.5" />
            <span>Soroban v21.0.0 Enabled</span>
          </div>
        </header>

        {/* Info Grid (Features) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300">
            <div className="p-2.5 w-fit bg-emerald-500/15 rounded-xl border border-emerald-500/25 text-emerald-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-200">100% Secure & Trustless</h3>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Deposited funds are held entirely inside a decentralized Soroban smart contract. Neither the buyer, seller, nor gateway can bypass contract conditions.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300">
            <div className="p-2.5 w-fit bg-amber-500/15 rounded-xl border border-amber-500/25 text-amber-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-200">Buyer Protection Timelock</h3>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              If the buyer is unsatisfied or the seller goes offline, the buyer can raise a dispute within the customizable timeout window and retrieve deposited XLM.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300">
            <div className="p-2.5 w-fit bg-indigo-500/15 rounded-xl border border-indigo-500/25 text-indigo-400 mb-4">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-neutral-200">Symmetric Seller Safeguards</h3>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              If the buyer is satisfied and remains unresponsive after delivery, the seller can claim funds directly after the timelock window expires.
            </p>
          </div>
        </section>

        {/* Freighter Wallet Connect Panel */}
        <WalletConnect publicKey={publicKey} setPublicKey={setPublicKey} />

        {/* Dashboard Area */}
        <MainFeature publicKey={publicKey} />
      </div>
    </main>
  );
}
