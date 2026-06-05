'use client';

import { useState } from 'react';
import type { TxState } from '@/hooks/useTransaction';
import { TxStatus } from './TxStatus';

interface Props {
  onStake: (amount: string) => Promise<boolean>;
  stakeTx: TxState;
  resetStake: () => void;
}

export function StakeForm({ onStake, stakeTx, resetStake }: Props) {
  const [amount, setAmount] = useState('');
  const isBusy = stakeTx.status === 'signing' || stakeTx.status === 'pending';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    const ok = await onStake(amount);
    if (ok) setAmount('');
  };

  const aprLabel = () => {
    const val = parseFloat(amount);
    if (!val) return null;
    if (val >= 5) return '12% APR';
    if (val >= 1) return '8% APR';
    return '5% APR';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <h2 className="font-semibold text-gray-800">Stake ETH</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="number"
            step="0.001"
            min="0.001"
            placeholder="0.0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={isBusy}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-16 text-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">ETH</span>
        </div>

        {aprLabel() && (
          <p className="text-xs text-blue-600">
            This stake earns <strong>{aprLabel()}</strong>
            <span className="text-gray-400 ml-1">(Tier: {parseFloat(amount) >= 5 ? '5+ ETH' : parseFloat(amount) >= 1 ? '1–4.99 ETH' : '0–0.99 ETH'})</span>
          </p>
        )}

        <TxStatus state={stakeTx} onDismiss={resetStake} />

        <button
          type="submit"
          disabled={isBusy || !amount || parseFloat(amount) <= 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white
                     font-semibold py-3 rounded-lg transition-colors"
        >
          {isBusy ? 'Staking...' : 'Stake ETH'}
        </button>
      </form>

      <p className="text-xs text-gray-400">7-day lock period · 10% early withdrawal penalty</p>
    </div>
  );
}
