# CryptoMint — NFT Marketplace

Marketplace descentralizado para criação e negociação de NFTs com suporte a coleções, ofertas, royalties ERC2981 e listagens — tudo on-chain via Smart Contracts na rede Sepolia.

## 🏗️ Architecture

```
tcc/
├── blockchain/           # Smart Contracts (Foundry / Solidity)
│   ├── src/
│   │   ├── NFTMarketplace.sol       # Listagens, compras, ofertas
│   │   ├── NFTCollection.sol        # ERC721 com mint aleatório e ERC2981
│   │   └── NFTCollectionFactory.sol  # Factory para criar coleções
│   └── test/
│       └── NFTMarketplace.t.sol     # Foundry test suite (40+ cases)
│
├── frontend/             # Next.js 16 + TypeScript
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks (marketplace, collections, explore)
│   │   ├── lib/          # Utilities (schemas, errors, IPFS, security)
│   │   ├── services/     # Profile IPFS service
│   │   └── types/        # TypeScript interfaces
│   ├── middleware.ts      # Rate limiting & CORS
│   └── next.config.ts    # CSP headers & image optimization
│
└── subgraph/             # The Graph (indexing)
    ├── schema.graphql    # Data model
    └── src/              # Event handlers
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **Foundry** ([install](https://book.getfoundry.sh/getting-started/installation))
- **MetaMask** or compatible wallet

### 1. Clone & Install

```bash
git clone <repo-url> && cd tcc
cd frontend && npm install
cd ../blockchain && forge install
```

### 2. Configure Environment

```bash
cp .env.example frontend/.env.local
# Edit frontend/.env.local with your values
```

Required variables:
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | Deployed marketplace contract |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS` | Deployed factory contract |
| `ALCHEMY_API_KEY` | Alchemy API key (server-only) |
| `PINATA_JWT` | Pinata JWT for IPFS uploads |

### 3. Run Smart Contract Tests

```bash
cd blockchain
forge test -vvv
```

### 4. Start Frontend

```bash
cd frontend
npm run dev
```

## 🔒 Security

- **API Proxy**: Alchemy API key is never exposed to the browser — all RPC calls go through `/api/rpc`
- **Upload Auth**: IPFS uploads require EIP-191 signature verification with 5-minute expiry
- **Rate Limiting**: Per-IP and per-address sliding window buckets on API routes
- **CSP Headers**: Content Security Policy restricts script/connect/img sources
- **CORS**: Origin validation on proxy routes

## 🧪 Testing

### Smart Contracts (Foundry)
```bash
cd blockchain && forge test -vvv
```

### Frontend (Vitest)
```bash
cd frontend && npm run test:run
# With coverage:
npx vitest run --coverage
```

## 📊 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.20, OpenZeppelin v5, Foundry |
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4 |
| Web3 | Wagmi 3, Viem 2, ConnectKit |
| Data | Apollo Client 4, The Graph |
| Storage | IPFS via Pinata |
| Testing | Foundry (Solidity), Vitest (Frontend) |

## 📜 License

MIT
