import React from 'react'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'

const OPT_IN_WALLETS = [
  'Petra', 'Pontem Wallet', 'OKX Wallet',
  'Martian', 'Nightly', 'Rise Wallet', 'Fewcha',
]

export default function WalletProvider({ children }) {
  return (
    <AptosWalletAdapterProvider
      optInWallets={OPT_IN_WALLETS}
      autoConnect={true}
      dappConfig={{ network: Network.TESTNET }}
      onError={(error) => console.warn('[WalletAdapter]', error)}
    >
      {children}
    </AptosWalletAdapterProvider>
  )
}
