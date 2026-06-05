'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useConnectModal, useAccountModal } from '@rainbow-me/rainbowkit';
import { SEPOLIA_CHAIN_ID } from '@/lib/contract';

export interface WalletState {
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  isWrongNetwork: boolean;
  openConnectModal: () => void;
  openAccountModal: () => void;
  switchToSepolia: () => void;
}

export function useWallet(): WalletState {
  const { address, isConnecting } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const isWrongNetwork = !!address && chainId !== SEPOLIA_CHAIN_ID;

  return {
    account: address ?? null,
    chainId: chainId ?? null,
    isConnecting,
    isWrongNetwork,
    openConnectModal: openConnectModal ?? (() => {}),
    openAccountModal: openAccountModal ?? (() => {}),
    switchToSepolia: () => switchChain({ chainId: SEPOLIA_CHAIN_ID }),
  };
}
