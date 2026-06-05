'use client';

import { useState, useCallback } from 'react';

export type TxStatus = 'idle' | 'signing' | 'pending' | 'confirmed' | 'error';

export interface TxState {
  status: TxStatus;
  hash: string | null;
  error: string | null;
}

export interface UseTransaction {
  txState: TxState;
  run: (fn: () => Promise<{ hash: string; wait: () => Promise<unknown> }>) => Promise<boolean>;
  reset: () => void;
}

export function parseError(err: unknown): string {
  const e = err as { code?: number | string; name?: string; reason?: string; message?: string; shortMessage?: string; data?: { message?: string } };
  // User rejection: ethers (4001 / ACTION_REJECTED) and viem (UserRejectedRequestError / 4001)
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED' || e?.name === 'UserRejectedRequestError') return 'Transaction rejected by user.';
  if (e?.shortMessage?.includes('user rejected')) return 'Transaction rejected by user.';
  if (e?.reason) return e.reason;
  if (e?.data?.message) return e.data.message.replace('execution reverted: ', '');
  if (e?.shortMessage) return e.shortMessage.slice(0, 120);
  if (e?.message?.includes('insufficient funds')) return 'Insufficient ETH balance.';
  if (e?.message?.includes('user rejected')) return 'Transaction rejected by user.';
  if (e?.message?.includes('Connector not connected')) return 'Wallet not connected. Please connect your wallet first.';
  if (e?.message) return e.message.slice(0, 120);
  return 'Unknown error. Please try again.';
}

export function useTransaction(): UseTransaction {
  const [txState, setTxState] = useState<TxState>({ status: 'idle', hash: null, error: null });

  const reset = useCallback(() => {
    setTxState({ status: 'idle', hash: null, error: null });
  }, []);

  const run = useCallback(async (
    fn: () => Promise<{ hash: string; wait: () => Promise<unknown> }>
  ): Promise<boolean> => {
    setTxState({ status: 'signing', hash: null, error: null });
    try {
      const tx = await fn();
      setTxState({ status: 'pending', hash: tx.hash, error: null });
      await tx.wait();
      setTxState({ status: 'confirmed', hash: tx.hash, error: null });
      return true;
    } catch (err) {
      setTxState({ status: 'error', hash: null, error: parseError(err) });
      return false;
    }
  }, []);

  return { txState, run, reset };
}
