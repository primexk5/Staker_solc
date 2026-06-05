'use client';

import { useState, useCallback, useEffect } from 'react';
import { Contract, formatEther, parseEther, JsonRpcProvider } from 'ethers';
import { useWriteContract } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ABI, VIEM_ABI, CONTRACT_ADDRESS } from '@/lib/contract';
import { useTransaction } from './useTransaction';

// Reads use ethers JsonRpcProvider directly (no BrowserProvider / wagmi transport bridge).
// Writes use wagmi's useWriteContract which routes through the connected viem WalletClient —
// this is the only correct path in wagmi v2+. The old BrowserProvider(client.transport)
// bridge called eth_requestAccounts through wagmi's transport wrapper, which conflicted with
// wagmi's already-connected account state and silently prevented the wallet from prompting.
function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL!);
}

// Viem public client used only to wait for receipts after writeContractAsync returns a hash.
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StakePosition {
  id: number;
  amount: bigint;
  stakedAt: bigint;
  lastClaimedAt: bigint;
  active: boolean;
  reward: bigint;
  apr: number;
  isLocked: boolean;
  daysRemaining: number;
}

export interface StakingData {
  positions: StakePosition[];
  totalStaked: bigint;
  totalRewards: bigint;
  claimableTotal: bigint;
  isLoading: boolean;
}

const LOCK_PERIOD = 7n * 24n * 60n * 60n;

function getAPR(amount: bigint): number {
  if (amount >= parseEther('5')) return 12;
  if (amount >= parseEther('1')) return 8;
  return 5;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStaking(account: string | null) {
  const { writeContractAsync } = useWriteContract();

  const [data, setData] = useState<StakingData>({
    positions: [],
    totalStaked: 0n,
    totalRewards: 0n,
    claimableTotal: 0n,
    isLoading: false,
  });

  const { txState: stakeTx,   run: runStake,   reset: resetStake   } = useTransaction();
  const { txState: claimTx,   run: runClaim,   reset: resetClaim   } = useTransaction();
  const { txState: unstakeTx, run: runUnstake, reset: resetUnstake } = useTransaction();

  const readContract = useCallback(() => {
    return new Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
  }, []);

  const refresh = useCallback(async () => {
    if (!account) return;
    const contract = readContract();
    if (!contract) return;

    setData(d => ({ ...d, isLoading: true }));
    try {
      const count = Number(await contract.getStakeCount(account));
      const now   = BigInt(Math.floor(Date.now() / 1000));

      const positions: StakePosition[] = [];
      let claimableTotal = 0n;

      for (let i = 0; i < count; i++) {
        const pos    = await contract.getStake(account, i);
        if (!pos.active) continue;
        const reward = await contract.calculateReward(account, i);

        const lockEnd      = pos.stakedAt + LOCK_PERIOD;
        const isLocked     = now < lockEnd;
        const daysRemaining = isLocked ? Number((lockEnd - now) / 86400n) : 0;

        positions.push({
          id: i,
          amount: pos.amount,
          stakedAt: pos.stakedAt,
          lastClaimedAt: pos.lastClaimedAt,
          active: pos.active,
          reward,
          apr: getAPR(pos.amount),
          isLocked,
          daysRemaining,
        });
        claimableTotal += reward;
      }

      const totalStakedRaw  = await contract.totalStaked();
      const totalRewardsPaid = await contract.totalRewardsPaid();

      setData({ positions, totalStaked: totalStakedRaw, totalRewards: totalRewardsPaid, claimableTotal, isLoading: false });
    } catch {
      setData(d => ({ ...d, isLoading: false }));
    }
  }, [account, readContract]);

  useEffect(() => { refresh(); }, [refresh]);

  const stake = useCallback(async (ethAmount: string): Promise<boolean> => {
    const ok = await runStake(async () => {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: VIEM_ABI,
        functionName: 'stake',
        value: parseEther(ethAmount),
      });
      return { hash, wait: () => publicClient.waitForTransactionReceipt({ hash }) };
    });
    if (ok) await refresh();
    return ok;
  }, [writeContractAsync, runStake, refresh]);

  const claimRewards = useCallback(async (stakeId: number): Promise<boolean> => {
    const ok = await runClaim(async () => {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: VIEM_ABI,
        functionName: 'claimRewards',
        args: [BigInt(stakeId)],
      });
      return { hash, wait: () => publicClient.waitForTransactionReceipt({ hash }) };
    });
    if (ok) await refresh();
    return ok;
  }, [writeContractAsync, runClaim, refresh]);

  const unstake = useCallback(async (stakeId: number): Promise<boolean> => {
    const ok = await runUnstake(async () => {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: VIEM_ABI,
        functionName: 'unstake',
        args: [BigInt(stakeId)],
      });
      return { hash, wait: () => publicClient.waitForTransactionReceipt({ hash }) };
    });
    if (ok) await refresh();
    return ok;
  }, [writeContractAsync, runUnstake, refresh]);

  return {
    data,
    refresh,
    stake,    stakeTx,   resetStake,
    claimRewards, claimTx, resetClaim,
    unstake,  unstakeTx, resetUnstake,
    formatEther,
  };
}
