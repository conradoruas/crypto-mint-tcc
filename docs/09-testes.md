# 9. Testes

## 9.1 Visão Geral da Estratégia

O projeto adota estratégias de teste distintas por camada:

| Camada | Framework | Tipo de teste | Thresholds |
|---|---|---|---|
| Smart Contracts | Foundry (Forge) | Unitário, integração, fuzz, segurança | Sem threshold automático |
| Subgraph | — | Sem testes automatizados (gap identificado) | — |
| Frontend | Vitest + Testing Library | Unitário, integração de hooks e componentes | Stmt/Lines/Funcs ≥ 95 %, Branches ≥ 90 % |
| Análise estática (contratos) | Slither | SAST (fail-on: high) | Zero findings high |
| Lint (frontend) | ESLint | Qualidade de código | Zero warnings |
| Type check | TypeScript | Verificação de tipos | Zero erros |

## 9.2 Testes de Smart Contracts (Foundry)

**Arquivo:** [`blockchain/test/NFTMarketplace.t.sol`](../blockchain/test/NFTMarketplace.t.sol)
**Linhas:** 1237 | **Framework:** `forge-std/Test.sol`

### Setup

```solidity
// NFTMarketplace.t.sol:16-68 (simplificado)
address owner    = makeAddr("owner");
address seller   = makeAddr("seller");
address buyer    = makeAddr("buyer");
address buyer2   = makeAddr("buyer2");
address stranger = makeAddr("stranger");

NFTMarketplace marketplace;
NFTCollectionFactory factory;
NFTCollection collection;  // 5 tokens, URIs pré-carregadas

function setUp() public {
    vm.startPrank(owner);
    marketplace = new NFTMarketplace();
    factory     = new NFTCollectionFactory();
    // cria coleção, carrega URIs, commita seed
    vm.stopPrank();
}
```

### Organização dos testes

| Grupo | Casos | Descrição |
|---|---|---|
| `NFTCollection` | ~12 | `urisLoaded`, mint, events, revert cases, refund de excesso |
| `NFTCollectionFactory` | ~5 | createCollection, evento, índice do criador, reverts |
| Marketplace — Listing | ~8 | listItem sucesso, evento, reverts (not-owner, low-price, not-approved, already-listed) |
| Marketplace — Cancel | ~5 | seller cancela, admin override, evento, reverts |
| Marketplace — Buy | ~8 | compra, overpay rejeitado, evento, not-listed, pagamento incorreto, self-buy bloqueado |
| Marketplace — Offer | ~8 | makeOffer, lista de compradores, múltiplas ofertas, evento, duplicata rejeitada |
| Marketplace — Accept Offer | ~8 | acceptOffer, cancela listing, recebe valor, eventos, reverts |
| Marketplace — Cancel Offer | ~4 | cancelOffer sucesso, evento, revert sem oferta |
| Marketplace — Reclaim | ~4 | reclaimExpiredOffer, bounty verificado, reverts |
| Auto-refund em oferta stale | ~5 | Re-offer após expiração, evento OfferExpiredRefund, proteção contra oferta ativa |
| Admin | ~5 | setMarketplaceFee, withdraw, casos de erro |
| Integração end-to-end | ~8 | mint→listar→comprar, mint→oferta→aceitar, multi-coleção, seller recebe |
| Segurança | ~3 | withdraw não drena escrow, reentrancy em buyItem, reentrancy em cancelOffer |
| Fuzz | 2 invariantes | feeCalculation, offerAmount round-trip |

### Testes de Fuzz (Invariantes)

**`testFuzz_feeCalculation_invariants`** — verifica que, para qualquer preço
entre 0,0001 ETH e 1000 ETH, a soma de fee + royalty + seller exatamente
igual ao preço total, e que a taxa é exatamente 2,5 %:

```solidity
function testFuzz_feeCalculation_invariants(uint256 price) public {
    price = bound(price, MIN_PRICE, 1000 ether);
    // assert: marketFee + royalty + sellerAmount == price
    // assert: marketFee == price * 250 / 10000
}
```

**`testFuzz_offerAmount_roundTrip`** — verifica que o escrow total do contrato
após um `makeOffer` seguido de `cancelOffer` retorna ao valor original (sem
vazamento de ETH):

```solidity
function testFuzz_offerAmount_roundTrip(uint256 amount) public {
    amount = bound(amount, MIN_PRICE, type(uint128).max);
    // makeOffer → cancelOffer → assert balance == balance inicial
}
```

### Testes de Segurança (Reentrancy)

Dois contratos atacantes são definidos no próprio arquivo de teste:

```solidity
// NFTMarketplace.t.sol:1184 — ataca buyItem
contract ReentrancyAttacker {
    NFTMarketplace marketplace;
    uint256 reentrancyCount;

    receive() external payable {
        if (reentrancyCount < 3) {
            reentrancyCount++;
            marketplace.buyItem{value: ...}(...); // tenta re-entrar
        }
    }
}

// NFTMarketplace.t.sol:1207 — ataca cancelOffer
contract ReentrancyCancelAttacker { ... }
```

Os testes verificam que `nonReentrant` impede a re-entrada e que o estado
permanece consistente após a tentativa frustrada.

### Execução

```bash
cd blockchain
forge test -vvv            # executa todos os testes
forge test -vvv --match-test testFuzz  # apenas fuzz
forge coverage --report lcov --report summary  # cobertura
```

## 9.3 Análise Estática — Slither

**Configuração:** [`blockchain/slither.config.json`](../blockchain/slither.config.json)

```json
{
    "filter_paths": ["lib/", "test/", "script/"],
    "detectors_to_exclude": ["timestamp", "low-level-calls", "calls-loop"]
}
```

- `timestamp` — falso positivo: `block.timestamp` em `expiresAt` é
  intencional e documentado como aceitável em Sepolia.
- `low-level-calls` — suprimido individualmente com
  `// slither-disable-next-line low-level-calls` nos `call{value}` de
  pull-payment (justificativa documentada no código).
- `calls-loop` — suprimido em `pruneExpiredOffers` que itera intencionalmente.

No CI, o job `security-contracts` usa `crytic/slither-action@v0.4.0` com
`fail_on: high` — qualquer finding crítico bloqueia o merge.

## 9.4 Testes do Frontend (Vitest)

**Framework:** Vitest 4.1.2 + `@testing-library/react` 16.3.2

### Configuração (`frontend/vitest.config.ts`)

```typescript
{
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
        provider: "v8",
        thresholds: {
            statements: 95,
            lines: 95,
            functions: 95,
            branches: 90,
        },
        include: [
            "src/lib/**",
            "src/hooks/**",
            "src/services/**",
            "src/components/**",
            "src/app/**/page.tsx",
            "src/app/**/*Client.tsx",
            "src/app/api/**/route.ts",
            "middleware.ts",
        ],
        exclude: [
            "src/types/**",
            "src/constants/**",
            "src/abi/**",
            "src/lib/graphql/queries.ts",
            // providers e arquivos de bootstrap excluídos
        ]
    }
}
```

### Setup de testes (`src/test/setup.ts`)

O setup resolve um problema crítico: `src/lib/env.ts` é um módulo SERVER ONLY
que lê `process.env` e lança exceção se variáveis obrigatórias estiverem
ausentes. O setup injeta variáveis dummy **antes** de qualquer import:

```typescript
// src/test/setup.ts (simplificado)
process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS    = "0x0000...0001";
process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS = "0x0000...0002";
process.env.ALCHEMY_API_KEY = "test-key";
process.env.PINATA_JWT      = "test-jwt";

// Polyfills para jsdom
Object.defineProperty(window, "matchMedia", { value: vi.fn() });
// IntersectionObserver, ResizeObserver, crypto.randomUUID, scrollTo...
```

### Inventário de testes

**Componentes** (`src/components/__tests__/`)

| Arquivo de teste | Componente testado |
|---|---|
| `GlobalSearch.test.tsx` | Busca global (queries, debounce, resultados) |
| `NavBar.test.tsx` | Navbar (menu, wallet, wrong network alert) |
| `OffersTable.test.tsx` | Tabela de ofertas (countdown, botões accept, estados) |

**Hooks** (`src/hooks/__tests__/` e colocados)

| Arquivo de teste | Hook testado |
|---|---|
| `useActivityFeed.test.ts` | Polling, formatação de preço, filtros |
| `useCollections.test.ts` | Query Apollo, fallback RPC, paginação |
| `useContractMutation.test.ts` | Gas estimation, writeContract, waitForReceipt |
| `useFavorites.test.ts` | localStorage, cross-tab sync, toggle |
| `useMarketplaceStats.test.ts` | Query GraphQL, polling 60s |
| `useNFTOffers.test.ts` | Subgraph-first + RPC fallback, ghost offers |
| `useTwoStepContractMutation.test.ts` | 5 fases de estado, in-flight guard |
| `useAcceptOffer.test.ts` | Two-step, onSuccess callback |
| `useBuyNFT.test.ts` | Value em ETH, receipt parsing |
| `useListNFT.test.ts` | Two-step approve + listItem |

**Biblioteca** (`src/lib/__tests__/`)

| Arquivo de teste | Módulo testado |
|---|---|
| `alchemyMeta.test.ts` | Formatação de metadata Alchemy |
| `apiUpstream.test.ts` | Rate limiter, origin check |
| `env.test.ts` | Validação de vars obrigatórias e opcionais |
| `estimateContractGas.test.ts` | Buffer de 20 % |
| `ipfs.test.ts` | resolveIpfsUrl, timeout em fetchIpfsJson |
| `logger.test.ts` | Formato JSON em produção vs legível em dev |
| `mintSeed.test.ts` | keccak256 do seed, equivalência com Solidity |
| `nftMetadata.test.ts` | Resolução de metadata off-chain |
| `schemas.test.ts` | Cada schema Zod com casos válidos e inválidos |
| `txErrors.test.ts` | Cada TransactionErrorKind com inputs reais de viem |
| `uploadAuthClient.test.ts` | EIP-191 sign + verify round-trip |
| `uploadAuthMessage.test.ts` | Formato e expiração da mensagem |
| `utils.test.ts` | cn(), shortAddr, formatEther variants |

**Serviços** (`src/services/__tests__/`)

| Arquivo | Serviço |
|---|---|
| `pinata.test.ts` | Upload de arquivo + metadata, tratamento de erros |
| `profile.test.ts` | CRUD de perfil (nome, avatar IPFS) |

**API Routes** (`src/app/api/`)

| Arquivo | Rota |
|---|---|
| `upload/route.test.ts` | POST /api/upload (validação, resposta Pinata) |

### Execução

```bash
cd frontend
npm run test:run           # run único
npm run test:coverage      # com relatório HTML + LCOV
npm run test:coverage:ci   # dot reporter + JUnit XML para ./reports/junit.xml
```

## 9.5 Subgraph — Gap de Testes

O subgraph **não possui testes automatizados** neste repositório. Os handlers
AssemblyScript são verificados apenas pelo pipeline de build (`npm run codegen
&& npm run build`).

**Ferramenta recomendada para trabalho futuro:** [Matchstick](https://github.com/LimeChain/matchstick)
— framework oficial do The Graph para unit tests de handlers AssemblyScript,
com mock de eventos e asserções em entidades.

## 9.6 Auditoria de Dependências

```bash
cd frontend
npm audit --audit-level=high
```

Executado no CI, mas **não bloqueante** (`|| true`). O resultado é visível
nos logs do pipeline para triagem manual.

---

[← Configuração](./08-configuracao-execucao.md) | [Próximo: Conclusão →](./10-conclusao.md)
