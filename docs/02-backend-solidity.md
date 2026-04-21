# 2. Backend — Smart Contracts (Solidity)

> **Nota:** No contexto de um DApp (*Decentralized Application*), os smart
> contracts exercem o papel do "backend". A tabela abaixo mapeia os conceitos
> do template clássico ao equivalente Solidity:
>
> | Template clássico | Equivalente CryptoMint |
> |---|---|
> | Controller | Função `external` do contrato |
> | Service | Função `internal` (ex.: `_calculateFees`) |
> | Repository / DAO | Mappings de storage (`listings`, `offers`) |
> | DTO / Model | `struct` empacotado (`Listing`, `Offer`) |
> | Autenticação | `msg.sender` + `Ownable` + validação ERC-721 |
> | Middleware | `modifier` (`onlyOwner`, `nonReentrant`) |

## 2.1 Estrutura do Diretório

```
blockchain/
├── foundry.toml           # Perfil Foundry (optimizer runs=200, src/out/libs)
├── remappings.txt         # @openzeppelin/ e erc721a/ mapeados para lib/
├── slither.config.json    # Análise estática: exclui lib/, test/, script/
├── .gitmodules            # Submódulos: forge-std, openzeppelin, ERC721A
├── lib/
│   ├── openzeppelin-contracts/   # v5.6.1 (ERC721, ERC2981, Ownable, ReentrancyGuard)
│   ├── forge-std/                # v1.15.0 (Test, Script)
│   └── ERC721A/                  # v4.3.0 (presente, não usado em produção)
├── src/
│   ├── NFTMarketplace.sol        # 655 linhas — contrato principal
│   ├── NFTCollection.sol         # 274 linhas — coleção ERC-721
│   └── NFTCollectionFactory.sol  # 158 linhas — factory + registry
├── script/
│   ├── DeployFactory.s.sol       # Deploy do factory na Sepolia
│   └── DeployMarketplace.s.sol   # Deploy do marketplace na Sepolia
└── test/
    └── NFTMarketplace.t.sol      # 1237 linhas — suite completa (Forge)
```

**Toolchain:** Foundry (forge/cast/anvil). Versão Solidity `^0.8.20`.
OpenZeppelin v5.6.1 via submódulo git. Sem Hardhat/Truffle.

## 2.2 Contrato `NFTMarketplace`

**Arquivo:** [`blockchain/src/NFTMarketplace.sol`](../blockchain/src/NFTMarketplace.sol)
**Herança:** `Ownable`, `ReentrancyGuard` (OpenZeppelin v5)
**Implantado em:** `0x32286F56e816ba139Cd52efdB6680aA0b0641C74` (Sepolia)

### Estado (Storage)

| Variável | Tipo | Valor padrão | Descrição |
|---|---|---|---|
| `marketplaceFee` | `uint256` | `250` | Taxa em basis points (2,5 %) |
| `accumulatedFees` | `uint256` | — | ETH acumulado de taxas (isolado do escrow) |
| `OFFER_DURATION` | `constant uint256` | `7 days` | Validade de cada oferta |
| `MAX_ROYALTY_BPS` | `constant uint256` | `1000` | Teto de royalty (10 %) |
| `RECLAIM_BOUNTY_BPS` | `constant uint256` | `50` | Recompensa por limpar oferta expirada (0,5 %) |
| `listings` | `mapping(addr ⇒ mapping(uint256 ⇒ Listing))` | — | Listagens por contrato NFT e tokenId |
| `offers` | `mapping(addr ⇒ mapping(uint256 ⇒ mapping(addr ⇒ Offer)))` | — | Ofertas por NFT e comprador |
| `pendingWithdrawals` | `mapping(addr ⇒ uint256)` | — | Ledger de pull-payment |
| `totalPendingWithdrawals` | `uint256` | — | Soma do ledger (para isolar escrow) |

### Structs (empacotados em 2 slots cada)

```solidity
struct Listing {
    address seller;   // slot 0 [0..159]
    bool    active;   // slot 0 [160]
    uint128 price;    // slot 1 [0..127]
}

struct Offer {
    address buyer;      // slot 0 [0..159]
    bool    active;     // slot 0 [160]
    uint64  expiresAt;  // slot 0 [161..224]
    uint128 amount;     // slot 1 [0..127]
}
```

### Funções Externas — "Endpoints"

| Função | Visibilidade | Pré-condições | Eventos emitidos |
|---|---|---|---|
| `listItem(nftContract, tokenId, price)` | external | caller é owner do NFT; marketplace tem aprovação; price ≥ 0,0001 ETH; não listado | `ItemListed` |
| `updateListingPrice(nftContract, tokenId, newPrice)` | external | caller é seller; price ≥ 0,0001 ETH | `ListingPriceUpdated` |
| `buyItem(nftContract, tokenId)` | external payable nonReentrant | item listado; `msg.value == price`; não é o seller | `ItemSold` |
| `cancelListing(nftContract, tokenId)` | external | caller é seller OU `owner()` | `ListingCancelled` |
| `makeOffer(nftContract, tokenId)` | external payable nonReentrant | não é owner; `msg.value` ≥ 0,0001 ETH; sem oferta ativa | `OfferMade` |
| `acceptOffer(nftContract, tokenId, buyer)` | external nonReentrant | caller é owner do NFT; oferta ativa e não expirada | `OfferAccepted` |
| `cancelOffer(nftContract, tokenId)` | external nonReentrant | caller tem oferta ativa | `OfferCancelled` |
| `reclaimExpiredOffer(nftContract, tokenId, buyer)` | external nonReentrant | oferta expirada | `OfferExpiredRefund`, `ReclaimBountyPaid` |
| `pruneExpiredOffers(nftContract, tokenId, maxIterations)` | external nonReentrant | — | por oferta: `OfferExpiredRefund`, `ReclaimBountyPaid` |
| `withdrawPending()` | external nonReentrant | saldo pendente > 0 | `PendingWithdrawn` |
| `setMarketplaceFee(newFee)` | external onlyOwner | newFee ≤ 1000 | `MarketplaceFeeUpdated` |
| `withdraw()` | external onlyOwner nonReentrant | accumulatedFees > 0 | `FeesWithdrawn` |

### Funções Internas

| Função | Propósito |
|---|---|
| `_calculateFees(price, nftContract, tokenId)` | Computa taxa do marketplace e royalty ERC-2981 via `staticcall` com gas cap 30.000 |
| `_paySeller(seller, amount)` | Push de ETH ao vendedor com fallback para pull-payment |
| `_payRoyalty(receiver, amount)` | Push de royalty com fallback; nunca redireciona ao seller |
| `_addOfferBuyer / _removeOfferBuyer` | Mantém lista enumerável de compradores com índice O(1) swap-and-pop |

### Eventos

```solidity
event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price);
event ListingPriceUpdated(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 oldPrice, uint256 newPrice);
event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt);
event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 amount);
event OfferCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed buyer);
event OfferExpiredRefund(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount);
event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);
event FeesWithdrawn(address indexed owner, uint256 amount);
event RoyaltyPaid(address indexed receiver, uint256 amount);
event RoyaltyPending(address indexed receiver, uint256 amount);
event PendingWithdrawn(address indexed receiver, uint256 amount);
event ReclaimBountyPaid(address indexed caller, address indexed buyer, uint256 amount);
event ExpiredOffersPruned(address indexed nftContract, uint256 indexed tokenId, uint256 prunedCount);
```

### Erros Customizados (24 no total)

Utilizam `error Name()` (Solidity ≥ 0.8.4) em vez de `require(..., string)`,
reduzindo o custo de gas em revert:

```
NotERC721 · NotNFTOwner · PriceTooLow · PriceExceedsUint128
MarketplaceNotApproved · AlreadyListed · NotForSale · IncorrectPayment
SellerCannotBuyOwn · GhostOfferRefundFailed · NotListed · NotAuthorizedToCancel
TokenDoesNotExist · OfferTooLow · OfferExceedsUint128 · OwnerCannotOffer
ActiveOfferExists · OfferNotActive · OfferExpired · OfferNotExpired
BountyPaymentFailed · NothingToWithdraw · WithdrawalFailed
FeesExceedSalePrice · MaxFeeExceeded · NoFeesToWithdraw
```

## 2.3 Contrato `NFTCollection`

**Arquivo:** [`blockchain/src/NFTCollection.sol`](../blockchain/src/NFTCollection.sol)
**Herança:** `ERC721`, `ERC2981`, `Ownable`, `ReentrancyGuard`
**Implantado por:** `NFTCollectionFactory` a cada `createCollection()`

### Estado

| Variável | Tipo | Descrição |
|---|---|---|
| `maxSupply` | `uint256` | Quantidade máxima de NFTs da coleção |
| `mintPrice` | `uint256` | Preço em ETH por mint |
| `collectionDescription` | `string` | Texto descritivo |
| `collectionImage` | `string` | URI da imagem da coleção |
| `factory` | `address` | Endereço do factory que criou este contrato |
| `totalSupply` | `uint256` | Quantidade de NFTs já mintados |
| `revealed` | `bool` | `true` quando o pool de URIs é esgotado |
| `_availableURIs` | `string[]` | Pool de URIs para sorteio Fisher-Yates |
| `_tokenURIs` | `mapping(uint256 ⇒ string)` | URI final por tokenId |
| `mintSeedCommitment` | `bytes32` | Hash da semente antes do mint |
| `mintSeedRevealed` | `bytes32` | Semente revelada pós-venda |
| `mintSeedCommitted` | `bool` | Flag de compromisso |

### Royalty padrão

O construtor chama `_setDefaultRoyalty(creator, 500)`, configurando **5 % de
royalty ERC-2981** ao criador da coleção para toda revenda no marketplace.

### Mecanismo de Mint Aleatório

O mint combina commit-reveal com Fisher-Yates para garantir aleatoriedade não
manipulável:

```solidity
// (simplificado de NFTCollection.sol:204-222)
uint256 index = uint256(keccak256(abi.encodePacked(
    mintSeedCommitment,   // hash comprometido antes do mint
    blockhash(block.number - 1),  // imprevisível no bloco anterior
    to,                   // endereço do comprador
    tokenId               // ID sequencial
))) % remaining;

// Fisher-Yates: troca index com o último, remove o último
string memory uri = _availableURIs[index];
_availableURIs[index] = _availableURIs[remaining - 1];
_availableURIs.pop();
```

- A semente é comprometida (`keccak256(seed)`) antes de qualquer mint.
- Após o esgotamento do supply, o criador revela a semente para auditoria
  pública (`revealMintSeed`), que valida `keccak256(seed) == commitment`.
- O `blockhash(block.number - 1)` adiciona imprevisibilidade por bloco.
- O Fisher-Yates garante que cada URI seja sorteada exatamente uma vez.

### Funções Principais

| Função | Acesso | Propósito |
|---|---|---|
| `loadTokenURIs(uris[])` | onlyOwner | Carrega o pool de URIs antes do mint |
| `appendTokenURIs(uris[])` | onlyOwner | Adiciona URIs ao pool (upload em chunks) |
| `commitMintSeed(commitment)` | onlyOwner, uma vez | Compromete o hash da semente |
| `revealMintSeed(seed)` | onlyOwner, uma vez | Publica a semente para auditoria |
| `mint(address to)` | payable, nonReentrant | Executa o mint com URI aleatória |
| `withdraw()` | onlyOwner, nonReentrant | Saca receita de mint ao criador |

## 2.4 Contrato `NFTCollectionFactory`

**Arquivo:** [`blockchain/src/NFTCollectionFactory.sol`](../blockchain/src/NFTCollectionFactory.sol)
**Sem herança** — contrato permissionless, sem dono.

### Papel

Permite que **qualquer endereço** crie uma nova coleção NFT chamando
`createCollection()`. Mantém um registry append-only de todas as coleções,
indexável pelo subgraph via o evento `CollectionCreated`.

### Funções Principais

| Função | Propósito |
|---|---|
| `createCollection(name, symbol, description, image, maxSupply, mintPrice)` | Deploya novo `NFTCollection`; adiciona ao registry |
| `getCollection(id)` | Retorna `CollectionInfo` por índice |
| `getCollections(offset, limit)` | Listagem paginada |
| `getCreatorCollections(creator)` | Índices das coleções de um criador |
| `totalCollections()` | Tamanho do registry |

**Evento chave:**
```solidity
event CollectionCreated(
    address indexed creator,
    address indexed contractAddress,
    string name,
    uint256 indexed collectionId
);
```

Este evento é o ponto de entrada do subgraph para descobrir novas coleções e
instanciar o template dinâmico `NFTCollection`.

## 2.5 Autenticação e Autorização

Nos smart contracts, a "autenticação" é feita pelo protocolo Ethereum:

- **`msg.sender`** — identidade irrefutável do chamador (autenticação implícita
  pela assinatura da transação com chave privada).
- **`Ownable` (OZ)** — controles administrativos (`setMarketplaceFee`,
  `withdraw`, `cancelListing` override).
- **Validação ERC-721** — em `listItem` e `makeOffer`, o contrato verifica
  que `nftContract` implementa `IERC721` via ERC-165.
- **Validação de dono** — `ownerOf(tokenId)` consultado na blockchain para
  aceitar ofertas e listar NFTs.

Não há sessões, tokens JWT nem login centralizado — cada transação é
autocontida e criptograficamente autenticada.

## 2.6 Tratamento de Erros

**Estratégia geral:** *fail-fast* via `revert`. Toda violação de pré-condição
reverte a transação antes de qualquer efeito colateral (sem estado parcialmente
modificado).

### Custom errors vs. `require(string)`

```solidity
// require clássico — caro (armazena string completa)
require(price >= MIN_PRICE, "Price too low");

// custom error — barato (4 bytes de selector)
if (price < MIN_PRICE) revert PriceTooLow();
```

### Pull-payment como fallback de erro de transferência

Quando `call{value: amount}("")` falha (receptor rejeita ETH ou usa mais gas
que o disponível), o valor é creditado no `pendingWithdrawals` em vez de
reverter toda a transação. O receptor saca manualmente via `withdrawPending()`.

Isso protege o marketplace contra:
- Contratos de royalty maliciosos que revértem no `receive()`.
- Sellers que tentam bloquear a venda ao rejeitar ETH.

## 2.7 Segurança — Padrões Aplicados

### CEI (Checks-Effects-Interactions)

```solidity
// buyItem (simplificado) — NFTMarketplace.sol:188-235
function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
    Listing storage listing = listings[nftContract][tokenId];

    // CHECKS
    if (!listing.active) revert NotForSale();
    if (msg.value != listing.price) revert IncorrectPayment();

    // EFFECTS — altera estado ANTES de qualquer interação externa
    listing.active = false;
    // ... limpa ghost offer do comprador ...

    // INTERACTIONS — transfere ETH e NFT por último
    _paySeller(listing.seller, sellerAmount);
    _payRoyalty(royaltyReceiver, royaltyAmount);
    IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);
}
```

### Gas-capped staticcall para royaltyInfo

```solidity
// NFTMarketplace.sol:554-566
uint256 gasLimit = ROYALTY_INFO_GAS; // 30.000
assembly {
    success := staticcall(gasLimit, nftContract, add(data, 32), mload(data), 0, 0)
    if success {
        if gt(returndatasize(), 64) { success := 0 }  // cap return-bomb
        returndatacopy(ptr, 0, 64)
    }
}
```

Protege contra contratos NFT adversariais que consomem todo o gas da chamada
(`gas bomb`) ou retornam payloads gigantes (`return bomb`).

### Slither no CI

`slither.config.json` configura a análise estática com `fail_on: high` no
pipeline CI, bloqueando merges com vulnerabilidades críticas detectadas.
Detectores desabilitados explicitamente: `timestamp`, `low-level-calls`,
`calls-loop` (todos com anotações `// slither-disable-next-line` no código).

---

[← Arquitetura](./01-arquitetura.md) | [Próximo: Subgraph →](./03-indexacao-subgraph.md)
