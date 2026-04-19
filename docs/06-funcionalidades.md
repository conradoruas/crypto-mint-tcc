# 6. Funcionalidades Principais

## 6.1 Criação de Coleção

O criador passa por um wizard multi-step gerenciado por `useCollectionForm`
(reducer) na rota `/collections/create`.

```mermaid
sequenceDiagram
    participant U as Criador
    participant FE as Frontend
    participant PI as Pinata (IPFS)
    participant FC as NFTCollectionFactory
    participant NC as NFTCollection (novo)
    participant SG as Subgraph

    U->>FE: Preenche metadados + faz upload da imagem da coleção
    FE->>PI: POST /api/upload (imagem)
    PI-->>FE: ipfs://CID_imagem

    U->>FE: Adiciona NFTs + faz upload das imagens individuais
    FE->>PI: POST /api/upload (cada imagem)
    PI-->>FE: ipfs://CID_nft_N

    FE->>PI: POST /api/upload-metadata (JSON de cada NFT)
    PI-->>FE: ipfs://CID_metadata_N

    U->>FE: Confirma deploy
    FE->>FC: createCollection(name, symbol, desc, img, maxSupply, mintPrice)
    FC-->>FE: recibo (endereço do novo contrato)
    FE->>NC: loadTokenURIs([ipfs://CID_1, ...]) (chunked de 200)
    FE->>NC: commitMintSeed(keccak256(seed))
    NC-->>FE: confirmações

    FE-->>U: Coleção criada ✓

    Note over NC,SG: graph-node captura CollectionCreated
    SG->>SG: handleCollectionCreated → entidade Collection
    SG->>SG: NFTCollection.create(endereço) → template ativado
```

**Chunks de 200 URIs** em `loadTokenURIs`: evita ultrapassar o limite de gas
por bloco ao fazer upload em lotes.

## 6.2 Mint Aleatório

```mermaid
sequenceDiagram
    participant U as Comprador
    participant FE as Frontend
    participant NC as NFTCollection
    participant SG as Subgraph

    U->>FE: Seleciona coleção, clica "Mint"
    FE->>NC: mint(address to) {value: mintPrice}

    Note over NC: Computa índice aleatório
    Note over NC: keccak256(commitment, blockhash, to, tokenId) % remaining
    Note over NC: Fisher-Yates: troca e pop do pool
    NC-->>FE: emite NFTMinted(to, tokenId, tokenUri)

    FE->>FE: parseia logs da receipt → tokenId, tokenUri
    FE-->>U: Mostra NFT mintado ✓

    Note over NC,SG: graph-node captura NFTMinted
    SG->>SG: handleNFTMinted → cria NFT entity
    SG->>SG: incrementa Collection.totalSupply, MarketplaceStats.totalNFTs

    Note over NC: Se pool esgotado → emite Revealed()
    SG->>SG: handleRevealed → Collection.revealed = true
```

Após o mint de toda a coleção, o criador chama `revealMintSeed(seed)`. O
contrato valida `keccak256(seed) == mintSeedCommitment` e registra a semente
publicamente para auditoria.

## 6.3 Listagem (Two-Step)

```mermaid
sequenceDiagram
    participant U as Vendedor
    participant FE as Frontend (useTwoStepContractMutation)
    participant NFT as NFTCollection (ERC-721)
    participant MK as NFTMarketplace
    participant SG as Subgraph

    U->>FE: Define preço, clica "Listar"

    rect rgb(240,248,255)
        Note over FE,NFT: Fase 1 — Aprovação (se necessário)
        FE->>FE: verifica isApprovedForAll
        FE->>U: "Aprove o marketplace na sua carteira"
        U->>NFT: setApprovalForAll(marketplace, true)
        NFT-->>FE: tx confirmada (approve-confirm)
    end

    rect rgb(240,255,240)
        Note over FE,MK: Fase 2 — Listagem
        FE->>U: "Assine a listagem na sua carteira"
        U->>MK: listItem(nftContract, tokenId, price)
        MK-->>FE: emite ItemListed
        FE-->>U: NFT listado ✓
    end

    SG->>SG: handleItemListed → Listing, CollectionStat.floor, ActivityEvent
```

## 6.4 Compra a Preço Fixo

```mermaid
sequenceDiagram
    participant U as Comprador
    participant FE as Frontend
    participant MK as NFTMarketplace
    participant SEL as Vendedor
    participant ROY as Receptor de Royalty
    participant SG as Subgraph

    U->>FE: Clica "Comprar" no asset page
    FE->>MK: getListing(nftContract, tokenId)  [RPC — autoritativo]
    MK-->>FE: Listing{price, seller, active}

    U->>FE: Confirma preço
    U->>MK: buyItem(nftContract, tokenId) {value: price}

    Note over MK: CHECKS: ativo, msg.value == price, não é seller
    Note over MK: EFFECTS: listing.active = false; limpa ghost offer do comprador
    Note over MK: INTERACTIONS (por último):

    MK->>MK: _calculateFees → marketFee + royalty (cap 10%)
    MK->>SEL: _paySeller (push ETH, fallback pull)
    MK->>ROY: _payRoyalty (push ETH, fallback pull)
    MK->>NFT: safeTransferFrom(seller, comprador, tokenId)

    MK-->>FE: emite ItemSold
    FE-->>U: Compra confirmada ✓

    SG->>SG: handleItemSold → desativa Listing, atualiza NFT.owner
    SG->>SG: atualiza MarketplaceStats, CollectionStat, DailySnapshot, ActivityEvent
```

## 6.5 Ciclo de Oferta

```mermaid
sequenceDiagram
    participant B as Comprador
    participant FE as Frontend
    participant MK as NFTMarketplace
    participant S as Seller (owner do NFT)

    B->>MK: makeOffer(nftContract, tokenId) {value: offerAmount}
    Note over MK: ETH retido em escrow por 7 dias
    MK-->>FE: emite OfferMade(buyer, amount, expiresAt)

    alt Seller aceita
        S->>MK: acceptOffer(nftContract, tokenId, buyer)
        MK->>MK: verifica expiresAt > now
        MK->>MK: cancela listing ativo (se houver)
        MK->>B: cobra fee + royalty + paga seller
        MK->>NFT: safeTransferFrom(seller, buyer, tokenId)
        MK-->>FE: emite OfferAccepted
    else Comprador cancela
        B->>MK: cancelOffer(nftContract, tokenId)
        MK->>B: reembolsa ETH (push, fallback pull)
        MK-->>FE: emite OfferCancelled
    else Oferta expira (7 dias)
        Note over MK: Qualquer endereço pode limpar
        B->>MK: reclaimExpiredOffer(nftContract, tokenId, buyer)
        Note over MK: Reembolsa comprador + 0,5% bounty a quem limpou
        MK-->>FE: emite OfferExpiredRefund + ReclaimBountyPaid
    end
```

### Limpeza em lote de ofertas expiradas

`pruneExpiredOffers(nftContract, tokenId, maxIterations)` itera sobre o array
de compradores, reembolsando cada oferta expirada com o bounty de 0,5% para o
chamador. `maxIterations = 0` significa sem limite.

## 6.6 Autenticação de Usuário

O sistema não possui login tradicional. A identidade é derivada da **carteira
Ethereum**:

```mermaid
sequenceDiagram
    participant U as Usuário
    participant CK as ConnectKit (UI)
    participant W as Carteira (MetaMask)
    participant FE as Frontend

    U->>CK: Clica "Conectar Carteira"
    CK->>W: Solicita contas (eth_requestAccounts)
    W-->>U: Pop-up de aprovação
    U->>W: Aprova
    W-->>CK: address + chainId
    CK-->>FE: wagmi context atualizado

    FE->>FE: useAccount() → {address, isConnected}
    FE->>FE: useWrongNetwork() → mostra alerta se chainId ≠ Sepolia

    Note over FE: WalletGuard protege rotas que exigem carteira
```

### Upload autenticado (EIP-191)

Para uploads de mídia, o frontend exige que o usuário assine uma mensagem:

```
Upload autorizado por: {address}
Timestamp: {unix}
Expiração: 5 minutos
```

O servidor verifica a assinatura via `viem.recoverMessageAddress` e só processa
o upload se o endereço coincidir e o timestamp estiver dentro de 5 minutos.
Isso evita uploads anônimos sem exigir um sistema de sessão.

## 6.7 Favoritos

Favoritos são armazenados **exclusivamente no navegador** (sem backend):

```typescript
// src/hooks/user/useFavorites.ts (simplificado)
const key = `nft_favorites_${address.toLowerCase()}`;
// lê/escreve em localStorage
// sincroniza abas via StorageEvent
```

- `useIsFavorited(nftId)` — retorna booleano reativo.
- `useFavorite(nftId)` — toggle com atualização imediata do store.
- `useUserFavorites()` — lista os IDs favoritados e busca metadados via Alchemy.

O botão de favorito em `NFTCard` fica **fora** do `<Link>` que envolve o card,
evitando que o clique de favoritar navegue para o asset.

## 6.8 Activity Feed

```mermaid
sequenceDiagram
    participant FE as Frontend (useActivityFeed)
    participant SG as Subgraph
    participant BC as Blockchain

    loop A cada 30 segundos (POLL_ACTIVITY_MS)
        FE->>SG: GET_ACTIVITY_FEED (tipo, collection, page)
        SG-->>FE: [{type, from, to, price, txHash, timestamp}]
        FE->>FE: formata priceETH via formatEther
        FE-->>U: atualiza tabela / cards de atividade
    end

    Note over BC,SG: Cada evento on-chain vira ActivityEvent no subgraph
    Note over FE: Desktop: tabela; Mobile: cards empilhados
```

Filtros disponíveis: tipo de evento (listing, sale, offer, mint, transfer),
coleção específica.

---

[← Modelagem](./05-modelagem-dados.md) | [Próximo: Requisitos NF →](./07-requisitos-nao-funcionais.md)
