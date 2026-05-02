# CryptoMint NFT Marketplace — Documentation

**Version:** V2  
**Network:** Sepolia (testnet)  
**Solidity:** `^0.8.20`  
**Framework:** Foundry  
**Audience:** Developers, security researchers, protocol integrators

---

## Contents

| # | Document | Description |
|---|----------|-------------|
| 1 | [System Overview](01-system-overview.md) | Architecture, contract interaction map, design philosophy |
| 2 | [Contract Architecture](02-contract-architecture.md) | Per-contract deep-dive: state, functions, access control |
| 3 | [Design Decisions](03-design-decisions.md) | Standard choices, trade-offs, indexing strategy |
| 4 | [Security Analysis](04-security-analysis.md) | Vulnerabilities, mitigations, trust assumptions |
| 5 | [Gas Optimization](05-gas-optimization.md) | Packed structs, patterns, and opportunities |
| 6 | [Core Workflows](06-core-workflows.md) | Step-by-step sequence flows for all major actions |
| 7 | [Events & Indexing](07-events-indexing.md) | All events, subgraph entity mapping, fallback strategy |
| 8 | [Testing & Validation](08-testing-validation.md) | Test coverage, edge cases, invariants |
| 9 | [Deployment & Environment](09-deployment-environment.md) | Scripts, env vars, Etherscan verification |
| 10 | [Limitations & Future Improvements](10-limitations-future.md) | Known gaps and enhancement suggestions |

---

## Contract Map

```
NFTCollectionFactoryV2
└── deploys → NFTCollectionV2 (ERC-721 + ERC-2981)

NFTCollectionFactory
└── deploys → NFTCollection   (ERC-721 + ERC-2981, no contractURI)

NFTMarketplace
└── integrates any ERC-721 collection (V1 or V2)
```

## Source Files

| File | Description |
|------|-------------|
| [src/NFTCollection.sol](../src/NFTCollection.sol) | V1 collection — mint, commit-reveal, royalties |
| [src/NFTCollectionV2.sol](../src/NFTCollectionV2.sol) | V2 collection — adds `contractURI` + trait schema |
| [src/NFTCollectionFactory.sol](../src/NFTCollectionFactory.sol) | Factory + registry for V1 collections |
| [src/NFTCollectionFactoryV2.sol](../src/NFTCollectionFactoryV2.sol) | Factory + registry for V2 collections |
| [src/NFTMarketplace.sol](../src/NFTMarketplace.sol) | Fixed-price listings, offers, royalties, pull-payments |
| [test/NFTMarketplace.t.sol](../test/NFTMarketplace.t.sol) | Marketplace + factory + collection unit/integration/fuzz tests |
| [test/NFTCollectionV2.t.sol](../test/NFTCollectionV2.t.sol) | V2-specific unit tests (contractURI, trait schema, mint) |
| [script/DeployFactory.s.sol](../script/DeployFactory.s.sol) | Deploy V1 factory |
| [script/DeployFactoryV2.s.sol](../script/DeployFactoryV2.s.sol) | Deploy V2 factory |
| [script/DeployMarketplace.s.sol](../script/DeployMarketplace.s.sol) | Deploy marketplace |
