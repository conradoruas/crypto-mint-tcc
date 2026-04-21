# 3. Camada de Indexação — The Graph (Subgraph)

## 3.1 Por que indexar?

Os smart contracts armazenam dados em mappings de storage lidos um por um via
`eth_call`. Consultas complexas — "todos os NFTs listados de uma coleção, com
preço e histórico de ofertas" — exigiriam dezenas de chamadas RPC e
pós-processamento no cliente, tornando a interface lenta e cara.

O **subgraph** resolve esse problema: é um serviço que escuta os eventos
emitidos pelos contratos e os transforma em um banco de dados GraphQL
estruturado, consultável com uma única query.

## 3.2 Configuração do Manifest (`subgraph.yaml`)

```
subgraph/subgraph.yaml
```

| Campo | Valor |
|---|---|
| `specVersion` | `0.0.5` |
| `apiVersion` | `0.0.7` |
| `language` | `wasm/assemblyscript` |
| Rede | `sepolia` |

### Data Sources estáticos

| Contrato | Endereço Sepolia | startBlock | Handler file |
|---|---|---|---|
| `NFTCollectionFactory` | `0xf17F507081ebe07F5E2Bb7BAaE36188B4751E6c3` | 10647287 | `src/factory.ts` |
| `NFTMarketplace` | `0x32286F56e816ba139Cd52efdB6680aA0b0641C74` | 10647296 | `src/marketplace.ts` |

### Template dinâmico

O template `NFTCollection` **não tem endereço fixo** — é instanciado em runtime
pelo handler `handleCollectionCreated` cada vez que uma nova coleção é criada.
Isso permite indexar N contratos de coleção sem alterar o manifest.

```typescript
// src/factory.ts:43
NFTCollection.create(event.params.contractAddress);
```

## 3.3 Schema GraphQL — Entidades

**Arquivo:** [`subgraph/schema.graphql`](../subgraph/schema.graphql)

O schema define 13 entidades, separadas em três categorias:

### Entidades mutáveis (estado atual)

| Entidade | ID strategy | Descrição |
|---|---|---|
| `Collection` | hex do endereço do contrato | Metadados da coleção + totais |
| `NFT` | `collectionAddr-tokenId` | Token individual com owner e URI |
| `Listing` | `nftContract-tokenId` | Listagem ativa ou histórica |
| `Offer` | `nftContract-tokenId-buyer` (canônico) | Oferta por comprador |
| `ActivityEvent` | `txHash-logIndex` | Feed de atividade unificado |
| `MarketplaceStats` | `"global"` (singleton) | Totais globais |
| `CollectionStat` | endereço da coleção | Agregados por coleção (volume, floor) |
| `DailyCollectionSnapshot` | `collectionAddr-dayId` | Snapshot diário (volume, vendas, floor) |
| `PendingBalance` | endereço do receptor | Saldo de pull-payment pendente |

### Entidades imutáveis (audit log — `@entity(immutable: true)`)

| Entidade | ID strategy | Evento Solidity origem |
|---|---|---|
| `FeeUpdate` | `txHash-logIndex` | `MarketplaceFeeUpdated` |
| `AdminWithdrawal` | `txHash-logIndex` | `FeesWithdrawn` |
| `RoyaltyPayment` | `txHash-logIndex` | `RoyaltyPaid` / `RoyaltyPending` |
| `PendingWithdrawalEvent` | `txHash-logIndex` | `PendingWithdrawn` |
| `CollectionWithdrawal` | `txHash-logIndex` | `Withdrawn` (NFTCollection) |

## 3.4 Tabela Cruzada — Eventos ↔ Handlers ↔ Hooks do Frontend

| Evento Solidity | Handler AssemblyScript | Entidades afetadas | Hook frontend consumidor |
|---|---|---|---|
| `CollectionCreated` | `handleCollectionCreated` | `Collection`, `MarketplaceStats`, template | `useCollections`, `useCreatorCollections` |
| `NFTMinted` | `handleNFTMinted` | `NFT`, `Collection.totalSupply`, `ActivityEvent`, `MarketplaceStats.totalNFTs` | `useMintToCollection` (refetch) |
| `Transfer` (ERC-721) | `handleTransfer` | `NFT.owner`, `Listing` (desativa), `CollectionStat`, `ActivityEvent` | `useCollectionNFTs`, `useProfileNFTs` |
| `MintSeedCommitted` | `handleMintSeedCommitted` | `Collection.mintSeedCommitted` | `useCollectionDetails` |
| `MintSeedRevealed` | `handleMintSeedRevealed` | `Collection.mintSeedRevealed` | `useCollectionDetails` |
| `Revealed` | `handleRevealed` | `Collection.revealed` | `useCollectionDetails` |
| `ItemListed` | `handleItemListed` | `Listing`, `NFT.listing`, `MarketplaceStats`, `CollectionStat`, `DailyCollectionSnapshot`, `ActivityEvent` | `useNFTListing`, `useExploreNfts` |
| `ListingPriceUpdated` | `handleListingPriceUpdated` | `Listing.price`, `CollectionStat.floorPrice`, `ActivityEvent` | `useNFTListing` (refetch) |
| `ItemSold` | `handleItemSold` | `Listing` (desativa), `NFT.owner`, `MarketplaceStats`, `CollectionStat`, `DailyCollectionSnapshot`, `ActivityEvent` | `useActivityFeed`, `useMarketplaceStats` |
| `ListingCancelled` | `handleListingCancelled` | `Listing` (desativa), `NFT.listing`, `CollectionStat`, `ActivityEvent` | `useCancelListing` (refetch) |
| `OfferMade` | `handleOfferMade` | `Offer` (canônico + tx-unique), `ActivityEvent` | `useNFTOffers` |
| `OfferAccepted` | `handleOfferAccepted` | `Offer` (desativa), `NFT.owner`, `Listing` (desativa), `CollectionStat`, `DailyCollectionSnapshot`, `ActivityEvent` | `useAcceptOffer` (refetch) |
| `OfferCancelled` | `handleOfferCancelled` | `Offer` (desativa), `ActivityEvent` | `useNFTOffers` |
| `OfferExpiredRefund` | `handleOfferExpiredRefund` | `Offer` (desativa), `ActivityEvent` | `useNFTOffers` |
| `MarketplaceFeeUpdated` | `handleMarketplaceFeeUpdated` | `FeeUpdate` (imutável) | — |
| `FeesWithdrawn` | `handleFeesWithdrawn` | `AdminWithdrawal` (imutável) | — |
| `RoyaltyPaid` | `handleRoyaltyPaid` | `RoyaltyPayment{pushed: true}` | — |
| `RoyaltyPending` | `handleRoyaltyPending` | `RoyaltyPayment{pushed: false}`, `PendingBalance` (credita) | — |
| `PendingWithdrawn` | `handlePendingWithdrawn` | `PendingWithdrawalEvent`, `PendingBalance` (debita) | — |

## 3.5 Helpers e Agregações (`src/helpers.ts`)

O arquivo `helpers.ts` centraliza a lógica de agregação usada por múltiplos
handlers.

### `getOrCreateCollectionStat` — Reset diário de métricas 24h

```typescript
// Simplified — subgraph/src/helpers.ts:25-64
const currentDay = timestamp / SECONDS_PER_DAY;
const lastDay    = stat.lastUpdated / SECONDS_PER_DAY;

if (currentDay > lastDay) {
    // Novo dia: zera contadores 24h e captura floor do início do dia
    stat.volume24h          = BigInt.zero();
    stat.sales24h           = BigInt.zero();
    stat.floorPriceDayStart = stat.floorPrice; // base para delta 24h
    stat.lastUpdated        = timestamp;
}
```

### `removeActiveListingAndRecalcFloor` — Aproximação de floor

Como AssemblyScript não pode executar queries filtradas, a remoção de uma
listagem que estava no floor anula o valor do floor (setting `null`). Ele é
restaurado automaticamente pelo próximo evento `ItemListed` ou
`ListingPriceUpdated`.

```typescript
// subgraph/src/helpers.ts:90-120
if (stat.activeListingCount <= 0) {
    stat.floorPrice = null; // sem listagens ativas
} else if (removedPrice <= stat.floorPrice) {
    stat.floorPrice = null; // floor removido — aguarda próximo listing
}
// O floorPrice correto será restaurado no próximo handleItemListed
```

## 3.6 Padrões de Design do Subgraph

### Dual-ID em `Offer`

A entidade `Offer` é armazenada em dois registros:

- **Canônico** (`nftContract-tokenId-buyer`) — estado atual da oferta;
  sobrescrito quando o comprador faz uma nova oferta.
- **Tx-unique** (`nftContract-tokenId-buyer-txHash`) — histórico imutável de
  cada oferta individual.

O campo `latestOfferId` no registro canônico aponta para o tx-único mais
recente. Isso permite ao frontend mostrar o estado atual eficientemente e
consultar o histórico completo quando necessário.

### Anti-ghost-offer

Quando `handleItemSold` é chamado (compra a preço fixo), o handler verifica se
o comprador tinha uma oferta ativa no mesmo NFT e a desativa:

```typescript
// subgraph/src/marketplace.ts:173 (simplificado)
deactivateOfferForBuyer(nftId, event.params.buyer);
```

Isso espelha a lógica on-chain do marketplace, que também refunde a oferta
"fantasma" no mesmo momento.

### Entidades imutáveis como audit log

`FeeUpdate`, `AdminWithdrawal`, `RoyaltyPayment` e `PendingWithdrawalEvent` são
declarados com `@entity(immutable: true)` no schema. O The Graph otimiza
entidades imutáveis (sem overhead de MVCC), adequado para logs append-only.

## 3.7 Política de Fontes de Dados no Frontend

O frontend combina três origens de dados com papéis complementares:

| Dado | Fonte autoritativa | Justificativa |
|---|---|---|
| Preço exato antes de comprar | RPC (`getListing`) | O subgraph pode ter atraso; pagar o preço errado é crítico |
| Oferta do comprador (valor, expiração) | RPC (`getOffer`) | Dados financeiros; sem tolerância a stale |
| Grid de NFTs, coleções, atividade | Subgraph | Alta latência aceitável; queries complexas |
| Thumbnail, nome, metadata off-chain | Alchemy NFT API | Off-chain; subgraph não armazena mídia |
| Owner após Transfer externo | RPC (`ownerOf`) | Transfer fora do marketplace não emite evento indexado pelo marketplace |

Documentado em [`frontend/src/lib/DATA_SOURCES.md`](../frontend/src/lib/DATA_SOURCES.md).

---

[← Backend](./02-backend-solidity.md) | [Próximo: Frontend →](./04-frontend-nextjs.md)
