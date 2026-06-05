'use client';

import { formatEther } from 'ethers';
import type { StakePosition } from '@/hooks/useStaking';
import type { TxState } from '@/hooks/useTransaction';
import { TxStatus } from './TxStatus';

interface Props {
  position: StakePosition;
  onClaim: (id: number) => void;
  onUnstake: (id: number) => void;
  claimTx: TxState;
  unstakeTx: TxState;
  resetClaim: () => void;
  resetUnstake: () => void;
  activeClaimId: number | null;
  activeUnstakeId: number | null;
}

export function StakeCard({
  position, onClaim, onUnstake,
  claimTx, unstakeTx, resetClaim, resetUnstake,
  activeClaimId, activeUnstakeId,
}: Props) {
  const isThisClaiming  = activeClaimId === position.id && claimTx.status !== 'idle';
  const isThisUnstaking = activeUnstakeId === position.id && unstakeTx.status !== 'idle';
  const isBusy = isThisClaiming || isThisUnstaking;

  const stakedDate = new Date(Number(position.stakedAt) * 1000).toLocaleDateString();
  const rewardEth  = Number(formatEther(position.reward)).toFixed(6);
  const amountEth  = Number(formatEther(position.amount)).toFixed(4);
  const penalty    = (Number(formatEther(position.amount)) * 0.1).toFixed(4);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Stake #{position.id}</p>
          <p className="text-2xl font-bold text-gray-900">{amountEth} ETH</p>
          <p className="text-xs text-gray-500 mt-0.5">Staked {stakedDate}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full
          ${position.apr === 12 ? 'bg-purple-100 text-purple-700' :
            position.apr === 8  ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'}`}>
          {position.apr}% APR
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">Claimable reward</span>
        <span className="font-mono font-semibold text-green-600">{rewardEth} ETH</span>
      </div>

      {position.isLocked && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
          🔒 Lock ends in ~{position.daysRemaining} day{position.daysRemaining !== 1 ? 's' : ''} —
          early unstake incurs 10% penalty ({penalty} ETH)
        </p>
      )}

      {isThisClaiming  && <TxStatus state={claimTx}   onDismiss={resetClaim} />}
      {isThisUnstaking && <TxStatus state={unstakeTx} onDismiss={resetUnstake} />}

      <div className="flex gap-2">
        <button
          onClick={() => onClaim(position.id)}
          disabled={isBusy || position.reward === 0n}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white
                     text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Claim Rewards
        </button>
        <button
          onClick={() => onUnstake(position.id)}
          disabled={isBusy}
          className="flex-1 bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white
                     text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {position.isLocked ? 'Unstake (Penalty)' : 'Unstake'}
        </button>
      </div>
    </div>
  );
}
