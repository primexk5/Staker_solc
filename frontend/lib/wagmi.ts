import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http, fallback } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet],
    },
    {
      groupName: 'Other Wallets',
      wallets: [rainbowWallet, walletConnectWallet],
    },
  ],
  { appName: 'ETH Staking DApp', projectId }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_RPC_URL),
      http('https://eth-sepolia.public.blastapi.io'),
      http('https://sepolia.drpc.org'),
      http(),
    ]),
  },
  ssr: true,
});
