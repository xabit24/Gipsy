# Gipsy — Verifiable Storage Dashboard

Built for **Shelby Protocol Testnet** · by maincore69

## Stack

- React 18 + Vite
- `@aptos-labs/wallet-adapter-react` v4 (AIP-62 compliant)
- Shelby S3-compatible API (Shelbynet)
- Aptos Testnet for onchain receipt anchoring

## Supported Wallets

Petra, Pontem Wallet, OKX Wallet, Martian, Nightly, Rise Wallet, Fewcha

## Setup

```bash
npm install
npm run dev
```

## Get a Session Token

Apply at https://developers.shelby.xyz, then replace `YOUR_SESSION_TOKEN` in `src/App.jsx`:

```js
const SHELBY_SESSION_TOKEN = 'YOUR_TOKEN_HERE'
```

## Deploy

```bash
npm run build
# dist/ folder → Vercel / Netlify / IPFS
```
