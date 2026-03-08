import React from 'react'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'

// optInWallets: only show wallets the user explicitly opts in to.
// The adapter auto-detects installed wallets from the AIP-62 registry.
const OPT_IN_WALLETS = [
  'Petra',
  'Pontem Wallet',
  'OKX Wallet',
  'Martian',
  'Nightly',
  'Rise Wallet',
  'Fewcha',
]

export default function WalletProvider({ children }) {
  return (
    <AptosWalletAdapterProvider
      optInWallets={OPT_IN_WALLETS}
      autoConnect={true}
      dappConfig={{
        network: 'testnet', // lock to Aptos Testnet
      }}
      onError={(error) => {
        console.warn('[WalletAdapter]', error)
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  )
}
