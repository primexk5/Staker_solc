'use client';

import { useState } from 'react';
import { formatEther } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useStaking } from '@/hooks/useStaking';
import { StakeForm } from '@/components/StakeForm';
import { StakeCard } from '@/components/StakeCard';
import { TransactionHistory } from '@/components/TransactionHistory';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
  const wallet = useWallet();
  const staking = useStaking(wallet.account);

  const [activeClaimId, setActiveClaimId] = useState<number | null>(null);
  const [activeUnstakeId, setActiveUnstakeId] = useState<number | null>(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);

  const handleClaim = async (id: number) => {
    setActiveClaimId(id);
    await staking.claimRewards(id);
    setHistoryTrigger(n => n + 1);
  };

  const handleUnstake = async (id: number) => {
    setActiveUnstakeId(id);
    await staking.unstake(id);
    setHistoryTrigger(n => n + 1);
  };

  const handleStake = async (amount: string) => {
    const ok = await staking.stake(amount);
    if (ok) setHistoryTrigger(n => n + 1);
    return ok;
  };

  const totalStakedEth  = Number(formatEther(staking.data.totalStaked)).toFixed(4);
  const totalRewardsEth = Number(formatEther(staking.data.totalRewards)).toFixed(6);
  const claimableEth    = Number(formatEther(staking.data.claimableTotal)).toFixed(6);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-gray-900">ETH Staking</h1>
            <p className="text-xs text-gray-400">Sepolia Testnet</p>
          </div>

          {!wallet.account ? (
            <button
              onClick={wallet.openConnectModal}
              disabled={wallet.isConnecting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white
                         text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={wallet.openAccountModal}
                className="text-sm text-gray-600 font-mono hover:text-gray-900"
              >
                {shortAddr(wallet.account)}
              </button>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Sepolia
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Wrong network banner */}
      {wallet.isWrongNetwork && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-amber-800">Please switch to the Sepolia testnet to use this app.</p>
            <button onClick={wallet.switchToSepolia} className="text-sm font-medium text-amber-800 underline">
              Switch Network
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {!wallet.account ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-4xl">🔐</p>
            <h2 className="text-xl font-semibold text-gray-800">Connect your wallet to start staking</h2>
            <p className="text-gray-500 text-sm">Earn up to 12% APR on your Sepolia ETH</p>
            <button
              onClick={wallet.openConnectModal}
              disabled={wallet.isConnecting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white
                         font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Staked', value: `${totalStakedEth} ETH` },
                { label: 'Total Rewards Paid', value: `${totalRewardsEth} ETH` },
                { label: 'Claimable Rewards', value: `${claimableEth} ETH`, highlight: true },
              ].map(stat => (
                <div key={stat.label} className={`rounded-xl p-4 border shadow-sm
                  ${stat.highlight ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className={`text-lg font-bold ${stat.highlight ? 'text-green-700' : 'text-gray-900'}`}>
                    {staking.data.isLoading ? '...' : stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* APR tiers */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">APR Tiers</p>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-600">0–0.99 ETH: <strong className="text-gray-900">5%</strong></span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">1–4.99 ETH: <strong className="text-blue-700">8%</strong></span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">5+ ETH: <strong className="text-purple-700">12%</strong></span>
              </div>
            </div>

            {/* Stake form */}
            <StakeForm onStake={handleStake} stakeTx={staking.stakeTx} resetStake={staking.resetStake} />

            {/* Active stakes */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-3">
                Active Stakes
                {staking.data.isLoading && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">Loading...</span>
                )}
              </h2>
              {staking.data.positions.length === 0 && !staking.data.isLoading ? (
                <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-5">
                  No active stakes yet.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {staking.data.positions.map(pos => (
                    <StakeCard
                      key={pos.id}
                      position={pos}
                      onClaim={handleClaim}
                      onUnstake={handleUnstake}
                      claimTx={staking.claimTx}
                      unstakeTx={staking.unstakeTx}
                      resetClaim={staking.resetClaim}
                      resetUnstake={staking.resetUnstake}
                      activeClaimId={activeClaimId}
                      activeUnstakeId={activeUnstakeId}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Transaction history */}
            <TransactionHistory
              account={wallet.account}
              refreshTrigger={historyTrigger}
            />
          </>
        )}
      </div>
    </main>
  );
}
