# 9. Deployment & Environment

---

## 9.1 Deployment Scripts

| Script | Contract Deployed | Command |
|--------|------------------|---------|
| [script/DeployFactory.s.sol](../script/DeployFactory.s.sol) | `NFTCollectionFactory` | `forge script script/DeployFactory.s.sol ...` |
| [script/DeployFactoryV2.s.sol](../script/DeployFactoryV2.s.sol) | `NFTCollectionFactoryV2` | `forge script script/DeployFactoryV2.s.sol ...` |
| [script/DeployMarketplace.s.sol](../script/DeployMarketplace.s.sol) | `NFTMarketplace` | `forge script script/DeployMarketplace.s.sol ...` |

All scripts read `PRIVATE_KEY` from environment via `vm.envUint("PRIVATE_KEY")` and use Foundry's `vm.startBroadcast` / `vm.stopBroadcast` mechanism. The deployer account becomes the `Ownable` owner of `NFTMarketplace`.

---

## 9.2 Deploy Commands

```bash
# Deploy V2 factory to Sepolia
forge script script/DeployFactoryV2.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Deploy marketplace to Sepolia
forge script script/DeployMarketplace.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

The `--verify` flag submits source to Sepolia Etherscan automatically after a successful broadcast, using the Foundry-built constructor argument encoding.

---

## 9.3 Required Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `PRIVATE_KEY` | All deploy scripts | Deployer EOA private key (uint256, no `0x` prefix) |
| `SEPOLIA_RPC_URL` | Foundry `--rpc-url` | HTTP/WS RPC endpoint for Sepolia |
| `ETHERSCAN_API_KEY` | Foundry `--verify` | Sepolia Etherscan API key for source verification |

These are read from `.env` at the project root (`.env` is in `.gitignore`).

---

## 9.4 Foundry Configuration

```toml
# foundry.toml
[profile.default]
src            = "src"
out            = "out"
libs           = ["lib"]
optimizer      = true
optimizer_runs = 200
```

The optimizer is enabled with 200 runs — the standard balance between deployment cost and per-call gas. See [Gas Optimization §5.9](05-gas-optimization.md#59-optimizer-configuration) for trade-offs.

---

## 9.5 Contract Verification

### Directly Deployed Contracts

`NFTCollectionFactory`, `NFTCollectionFactoryV2`, and `NFTMarketplace` are deployed directly by scripts. Foundry's `--verify` flag handles Etherscan verification automatically, including constructor argument ABI encoding.

### Factory-Deployed Child Contracts

`NFTCollection` and `NFTCollectionV2` instances are deployed by the factory `createCollection()` function, not by a script. Etherscan cannot automatically verify these. To verify manually:

1. Retrieve the constructor arguments from the `CollectionCreated` event emitted during creation. All constructor parameters are present in the event fields.
2. ABI-encode the constructor arguments:
   ```bash
   cast abi-encode "constructor(string,string,string,string,uint256,uint256,address,string)" \
     "Name" "SYM" "Description" "ipfs://image" 100 100000000000000 0xCreator "ipfs://contractURI"
   ```
3. Submit to Etherscan using the Foundry verification command or the Etherscan UI.

---

## 9.6 Sepolia-Specific Considerations

### `blockhash` Availability

On public Sepolia with standard ~12s block times, `blockhash(block.number - 1)` is always available and returns a non-zero value. The `BlockhashUnavailable` revert is only triggerable in edge cases:

- **Foundry local node (Anvil):** Without `--block-time`, blocks only advance on transaction. Use `vm.roll(block.number + 1)` in tests when needed.
- **Same-block inclusion:** Theoretically possible if the mint transaction is included in the very first transaction of block N, and block N-1 is not yet in the EVM's `BLOCKHASH` opcode window — not practically possible on Sepolia.

### Gas Prices

Sepolia uses regular EIP-1559 mechanics. The test constants (`MINT_PRICE = 0.0001 ETH`, `LIST_PRICE = 0.05 ETH`) are calibrated for testnet. For mainnet, mint price would be set by the collection creator to cover gas and desired revenue.

### Faucets

Sepolia ETH can be obtained from:
- Alchemy Sepolia Faucet
- Infura Sepolia Faucet
- Chainlink Faucet (requires mainnet activity)

---

## 9.7 Post-Deployment Checklist

After deploying both contracts:

- [ ] Factory address verified on Sepolia Etherscan
- [ ] Marketplace address verified on Sepolia Etherscan
- [ ] Factory address configured in frontend `.env` (`VITE_FACTORY_V2_ADDRESS` or equivalent)
- [ ] Marketplace address configured in frontend `.env` (`VITE_MARKETPLACE_ADDRESS`)
- [ ] Subgraph `subgraph.yaml` updated with both contract addresses and deployment block numbers
- [ ] Subgraph deployed to The Graph hosted service or decentralized network
- [ ] Frontend `SubgraphProxy` pointed to new subgraph endpoint
- [ ] End-to-end test: create collection → load URIs → commit seed → mint → list → buy
