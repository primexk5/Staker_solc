'use client';

import { useEffect, useState } from 'react';
import { formatEther, Contract, JsonRpcProvider } from 'ethers';
import { ABI, CONTRACT_ADDRESS } from '@/lib/contract';

interface TxEntry {
  type: string;
  hash: string;
  time: number;
}

function storageKey(account: string) {
  return `staking_history_${account.toLowerCase()}`;
}

function saveEntry(account: string, entry: TxEntry) {
  const key  = storageKey(account);
  const prev: TxEntry[] = JSON.parse(localStorage.getItem(key) || '[]');
  if (prev.some(e => e.hash === entry.hash && e.type === entry.type)) return; // dedup re-seen logs
  localStorage.setItem(key, JSON.stringify([entry, ...prev].slice(0, 10)));
}

export function TransactionHistory({ account, refreshTrigger }: { account: string; refreshTrigger: number }) {
  const [entries, setEntries] = useState<TxEntry[]>([]);

  const reload = () =>
    setEntries(JSON.parse(localStorage.getItem(storageKey(account)) || '[]'));

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [account, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const provider = new JsonRpcProvider('/api/rpc', undefined, { staticNetwork: true });
    const iface = new Contract(CONTRACT_ADDRESS, ABI, provider).interface;
    let stopped = false;
    let lastBlock = -1; // -1 → first poll establishes the baseline (only catch *new* events)

    const describe = (name: string, a: { amount: bigint; reward: bigint; principal: bigint }): string | null => {
      if (name === 'StakeCreated')   return `Staked ${Number(formatEther(a.amount)).toFixed(4)} ETH`;
      if (name === 'RewardClaimed')  return `Claimed ${Number(formatEther(a.reward)).toFixed(6)} ETH reward`;
      if (name === 'StakeWithdrawn') return `Unstaked ${Number(formatEther(a.principal)).toFixed(4)} ETH`;
      return null;
    };

    const poll = async () => {
      try {
        const current = await provider.getBlockNumber();
        if (stopped) return;
        if (lastBlock < 0)      { lastBlock = current; return; }
        if (current <= lastBlock) return;

        const fromBlock = Math.max(lastBlock + 1, current - 9); // ≤10-block window (free tier)
        const logs = await provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock, toBlock: current });
        if (stopped) return;
        lastBlock = current;

        let changed = false;
        for (const log of logs) {
          const parsed = iface.parseLog(log);
          if (!parsed) continue;
          const a = parsed.args as unknown as { user: string; amount: bigint; reward: bigint; principal: bigint };
          if (a.user?.toLowerCase() !== account.toLowerCase()) continue;
          const type = describe(parsed.name, a);
          if (!type) continue;
          saveEntry(account, { type, hash: log.transactionHash, time: Date.now() });
          changed = true;
        }
        if (changed) reload();
      } catch {
        // swallow transient RPC errors (timeouts, rate limits); retry on the next tick
      }
    };

    poll();
    const id = setInterval(poll, 12_000); // ~Sepolia block time keeps the getLogs window tiny
    return () => { stopped = true; clearInterval(id); };
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="font-semibold text-gray-800 mb-3">Transaction History</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No transactions yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{e.type}</span>
              <div className="flex items-center gap-3 text-gray-400 text-xs">
                <span>{new Date(e.time).toLocaleTimeString()}</span>
                <a href={`https://sepolia.etherscan.io/tx/${e.hash}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Tx ↗</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
