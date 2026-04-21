# 4. Frontend — Next.js 16

> **Aviso:** Este projeto usa **Next.js 16**, que contém breaking changes em
> relação a versões anteriores. APIs, convenções e estrutura de arquivos podem
> diferir do que foi publicado antes de agosto de 2025. Esta documentação reflete
> o código real do repositório, não o comportamento de versões anteriores.

## 4.1 Stack Tecnológico

| Categoria | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.0 |
| UI library | React | 19.2.4 |
| Tipagem | TypeScript 5 (modo strict total) | 5.x |
| Estilização | Tailwind CSS v4 (CSS-first config) | 4.x |
| Web3 hooks | wagmi | 3.5.0 |
| Cliente EVM | viem | 2.47.5 |
| Wallet UI | ConnectKit | 1.9.1 |
| GraphQL client | Apollo Client | 4.1.6 |
| Async state | React Query (`@tanstack/react-query`) | 5.91.0 |
| Validação | Zod | 4.3.6 |
| Toasts | sonner | 2.0.7 |
| Ícones | lucide-react | 0.577.0 |
| Tema | next-themes | 0.4.6 |
| Teste | Vitest + Testing Library | 4.1.2 / 16.3.2 |
| Package manager | npm | — |

### Configuração TypeScript (`tsconfig.json`)

Além de `strict: true`, habilitados explicitamente:

- `noImplicitOverride` — membros sobrescritos exigem `override` keyword
- `noFallthroughCasesInSwitch`
- `noUnusedLocals` e `noUnusedParameters` — variáveis mortas falham o build
- `isolatedModules` — cada arquivo deve ser compilável independentemente

## 4.2 Estrutura de Diretórios

```
frontend/src/
├── app/                        App Router
│   ├── layout.tsx              Provider pyramid + fontes
│   ├── error.tsx               Error boundary de rota
│   ├── not-found.tsx           Página 404
│   ├── page.tsx                Landing (hero + trending + stats)
│   ├── explore/                Grid do marketplace
│   ├── create/                 Mint em coleção existente
│   ├── collections/
│   │   ├── page.tsx            Lista de coleções
│   │   ├── create/             Wizard multi-step de criação
│   │   └── [address]/          Detalhe da coleção
│   ├── activity/               Feed de atividade on-chain
│   ├── asset/[id]/             Detalhe do NFT + painel de compra/oferta
│   ├── profile/                Tabs: Coletados / Favoritos / Criados / Atividade
│   └── api/                    Route Handlers (server-only)
│       ├── alchemy/[...path]/  Proxy da Alchemy NFT API
│       ├── rpc/                Proxy do RPC Sepolia
│       ├── upload/             Upload direto ao IPFS
│       ├── upload-auth/        Assina URL de upload (EIP-191)
│       └── upload-metadata/    Pinagem de JSON de metadados
├── components/
│   ├── Web3Provider.tsx        wagmi + ConnectKit config
│   ├── ApolloProvider.tsx      Apollo Client singleton
│   ├── ThemeProvider.tsx       next-themes
│   ├── ErrorBoundary.tsx       Boundary global (class component)
│   ├── WalletGuard.tsx         Gate: carteira conectada?
│   ├── GlobalSearch.tsx        Busca global (subgraph)
│   ├── navbar/                 Navbar, BellDropdown, WalletDropdown
│   ├── marketplace/            NFTCard, FilterSidebar, OffersTable, StatsSection, TrendingSection
│   ├── asset/                  ListingPanel, OfferPanel, PriceHistory
│   └── ui/                     EthAmountInput, NFTCardSkeleton, NFTImage, PageControls, Pagination
├── hooks/
│   ├── useContractMutation.ts
│   ├── useTwoStepContractMutation.ts
│   ├── useClock.ts / useNowBucketed.ts
│   ├── useBodyScrollLock.ts / useClickOutside.ts
│   ├── usePaginationState.ts / useStableArray.ts / useWrongNetwork.ts
│   ├── marketplace/            useListNFT, useBuyNFT, useAcceptOffer, useCancelListing,
│   │                           useOfferManagement, useNFTListing, useNFTOffers,
│   │                           useExploreNfts, useExploreFilters, useMarketplaceStats,
│   │                           useTrendingCollections
│   ├── collections/            useCollections, useCreatorCollections, useCollectionDetails,
│   │                           useCollectionNFTs, useCreateCollection, useMintToCollection,
│   │                           useProfileNFTs, useCreatedNFTs
│   ├── activity/               useActivityFeed
│   └── user/                   useFavorites
├── lib/
│   ├── env.ts                  Validação de env vars (SERVER ONLY)
│   ├── apolloClient.ts         RetryLink + cache config
│   ├── graphql/queries.ts      Todos os documentos gql
│   ├── apiProxy.ts             Rate-limiter Edge
│   ├── txErrors.ts             Taxonomia de erros de transação
│   ├── schemas.ts              Schemas Zod
│   ├── ipfs.ts                 resolveIpfsUrl + fetchIpfsJson
│   ├── alchemyMeta.ts          Wrappers Alchemy NFT API
│   ├── nftMetadata.ts          Resolver de metadata off-chain
│   ├── mintSeed.ts             Hashing commit-reveal
│   ├── logger.ts               Logger estruturado (único arquivo com console)
│   ├── estimateContractGas.ts  Gas com buffer de 20 %
│   └── utils.ts                cn(), shortAddr, formatEther utils
├── services/
│   ├── pinata.ts               Upload de mídia/metadata para IPFS
│   └── profile.ts              CRUD de perfil de usuário
├── constants/
│   ├── contracts.ts            Endereços + ABIs exportados
│   ├── polling.ts              POLL_ACTIVITY_MS, MAX_OFFER_BUYERS_MULTICALL
│   └── ui.ts                   PAGE_SIZE, constantes visuais
├── abi/                        ABIs JSON dos 3 contratos
└── types/                      Interfaces TypeScript do domínio
```

## 4.3 Páginas e Rotas (App Router)

| Rota | Tipo | Propósito |
|---|---|---|
| `/` | Client shell + Server sections | Landing: hero, `TrendingSection`, `StatsSection` |
| `/explore` | Client | Grid do marketplace com filtros (status, ordenação, coleção) |
| `/create` | Client + WalletGuard | Mint de NFT em coleção existente do usuário |
| `/collections` | Client | Lista de todas as coleções (trending/top/recentes) |
| `/collections/create` | Client + WalletGuard | Wizard multi-step para criar e configurar nova coleção |
| `/collections/[address]` | Client | Detalhe da coleção: NFTs, mint, revelar seed, sacar royalties |
| `/asset/[id]` | **Server** (metadata OG) + Client | Detalhe do NFT: comprar, listar, fazer oferta, aceitar oferta |
| `/profile` | Client + WalletGuard | Tabs: Coletados / Favoritos / Criados / Atividade |
| `/profile/edit` | Client + WalletGuard | Editar nome e avatar (upload Pinata) |
| `/activity` | Client | Feed de atividade on-chain com filtros de tipo |

A rota `/asset/[id]` usa `generateMetadata` em um Server Component para produzir
tags Open Graph e Twitter Card com `next: { revalidate: 3600 }` (ISR de 1 hora),
sem bloquear o render interativo que ocorre no `AssetPageClient.tsx`.

## 4.4 Integração Web3

### Web3Provider (`src/components/Web3Provider.tsx`)

```typescript
createConfig({
    chains: [sepolia],                // única rede suportada
    transport: http("/api/rpc"),      // proxy server-side — chave Alchemy não exposta
    // ...ConnectKit options
});
```

- **Rede:** Sepolia exclusivamente. Conexão em outra rede exibe alerta na navbar
  com botão `switchChain` via `useWrongNetwork` + `useSwitchChain`.
- **WalletGuard:** componente que envolve rotas que exigem carteira conectada;
  renderiza tela de "Conecte sua carteira" se `!isConnected`.

### `useContractMutation` — Mutation genérica tipada

Hook wrapper sobre `useWriteContract` + `useWaitForTransactionReceipt`:

```typescript
// src/hooks/useContractMutation.ts (simplificado)
function useContractMutation<TAbi, TFunc extends ContractFunctionName<TAbi>>() {
    const { writeContractAsync } = useWriteContract();
    const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

    async function mutate(args) {
        const gas = await estimateContractGasWithBuffer(args); // buffer 20%
        const hash = await writeContractAsync({ ...args, gas });
        // aguarda confirmação
    }

    return { mutate, isPending, isConfirming, isSuccess, hash, reset };
}
```

### `useTwoStepContractMutation` — Approve + Execute

Encapsula o padrão ERC-721 `setApprovalForAll` → ação principal em uma máquina
de 5 estados:

```
idle → approve-wallet → approve-confirm → exec-wallet → exec-confirm
```

Um `inFlightRef` previne duplo-clique/re-entrada. Cada fase tem UX distinta
(textos de botão, loading states).

### Hooks específicos de domínio (sobre os dois acima)

| Hook | Two-step? | Contrato | Função |
|---|---|---|---|
| `useListNFT` | Sim | NFTMarketplace | `setApprovalForAll` → `listItem` |
| `useBuyNFT` | Não | NFTMarketplace | `buyItem` (value = price) |
| `useAcceptOffer` | Sim | NFTMarketplace | `setApprovalForAll` → `acceptOffer` |
| `useCancelListing` | Não | NFTMarketplace | `cancelListing` |
| `useMakeOffer` | Não | NFTMarketplace | `makeOffer` (value = offer) |
| `useCancelOffer` | Não | NFTMarketplace | `cancelOffer` |
| `useReclaimExpiredOffer` | Não | NFTMarketplace | `reclaimExpiredOffer` |
| `useCreateCollection` | Não | NFTCollectionFactory | `createCollection` |
| `useMintToCollection` | Não | NFTCollection | `mint` |

## 4.5 Gerenciamento de Estado

O projeto **não usa Redux, Zustand nem Jotai**. O estado é distribuído em três
mecanismos coordenados:

### Apollo Client (dados do subgraph)

Cache `InMemoryCache` com `merge: false` em `collections`, `nfts`, `offers` e
`activityEvents` — garante que queries paginadas substituam o cache em vez de
concatenar. `fetchPolicy: "cache-and-network"` renderiza do cache e revalida em
background.

### React Query (dados Alchemy + IPFS)

- Usado para chamadas à Alchemy NFT API (profile, coleções via RPC fallback).
- Metadados IPFS com `staleTime: Infinity` — dados imutáveis (content-addressed)
  nunca precisam de revalidação.

### `useSyncExternalStore` — Stores sem Context

Em vez de React Context (que causa re-renders em cascata), stores globais são
implementados com `useSyncExternalStore`:

- **`useClock(interval)`** — registra o componente em um `setInterval` global;
  compartilha um único timer entre todos os assinantes (O(1) timers totais).
- **`useFavorites`** — armazena no `localStorage` com chave
  `nft_favorites_${address}`. Sincroniza abas via `StorageEvent`. Exporta três
  hooks:
  - `useIsFavorited(id)` — booleano reativo
  - `useFavorite(id)` — toggle
  - `useUserFavorites()` — lista com metadados

- **`useNowBucketed(bucketSeconds)`** — retorna timestamp arredondado para o
  bucket (padrão 60s). Isso evita que variáveis GraphQL mudem a cada segundo e
  invalidem o cache Apollo desnecessariamente.

### Estado local de componente

`useState` e `useReducer` para estado de formulários e UI. O reducer mais
complexo é `useCollectionForm.ts` (wizard de criação de coleção): gerencia
drafts de NFTs, imagem de capa, import CSV e erros de campo.

## 4.6 Formulários e Validação

Sem `react-hook-form` nem Formik. Padrão adotado:

1. Estado local via `useState`/`useReducer`.
2. Schema Zod em `src/lib/schemas.ts`.
3. Validação no submit: `schema.safeParse(data)` → erros acumulados no estado.
4. Utilitário `getZodErrors(schema, data)` retorna `{ [campo]: mensagem }`.
5. Componente `EthAmountInput` aceita prop `error` e exibe mensagem inline.

### Schemas definidos (`src/lib/schemas.ts`)

| Schema | Campos e restrições |
|---|---|
| `createCollectionSchema` | `name` 1-50 chars, `symbol` 1-8 `/^[A-Z0-9]+$/`, `mintPrice` ≥ 0,0001 ETH |
| `listPriceSchema` | `price` ≥ 0,0001 ETH |
| `offerAmountSchema` | `amount` ≥ 0,0001 ETH |
| `editProfileSchema` | `name` ≤ 50 chars, sem `<>` (XSS) |
| `addressSchema` | refinado com `viem.isAddress` |

## 4.7 Tratamento de Erros

### Taxonomia de erros de transação (`src/lib/txErrors.ts`)

```typescript
type TransactionErrorKind =
    | "user_rejected"       // usuário cancelou na carteira
    | "insufficient_funds"  // sem ETH para gas
    | "nonce_expired"       // nonce stale
    | "gas_too_low"         // estimativa insuficiente
    | "unauthorized"        // msg.sender não autorizado
    | "rate_limit"          // rate limit da API
    | "reverted"            // contrato reverteu (custom error)
    | "network"             // falha de conectividade
    | "unknown";
```

`formatTransactionError(error, fallback)` é a única função que o UI chama.
Retorna mensagens localizadas em português sem expor detalhes técnicos ao
usuário.

### Logger estruturado (`src/lib/logger.ts`)

- Único arquivo isento da regra ESLint `no-console: "error"`.
- **Desenvolvimento:** `console.error` legível com stack trace.
- **Produção:** JSON de uma linha `{timestamp, level, message, error, context}`
  para ingesta em Datadog/CloudWatch.

### Múltiplas camadas de error boundary

1. `app/error.tsx` — boundary de rota do App Router.
2. `ErrorBoundary` (class component) — boundary global em `layout.tsx`.
3. Toasts via `sonner` para erros de mutations (não fatais).

## 4.8 API Routes (Server-only)

Toda chamada a serviços externos com chaves de API passa por Route Handlers
Next.js, garantindo que nenhum segredo chegue ao bundle do cliente.

| Rota | Propósito | Proteção |
|---|---|---|
| `/api/rpc` | Proxy RPC Sepolia (Alchemy) | Rate-limit 120 req/min/IP, origin check |
| `/api/alchemy/[...path]` | Proxy Alchemy NFT API | Rate-limit 60 req/min/IP, origin check |
| `/api/upload` | Upload direto de arquivo ao IPFS | `PINATA_JWT` server-side |
| `/api/upload-auth` | Gera URL assinada (EIP-191, 5 min expiração) | Requer `Authorization: Bearer <assinatura>` |
| `/api/upload-metadata` | Pina JSON de metadados no IPFS | `PINATA_JWT` server-side |

**Middleware Edge** (`middleware.ts`) aplica `apiProxy()` em `/api/rpc` e
`/api/alchemy/:path*`: verifica origin (`Origin` header), aplica sliding-window
rate-limit por IP e retorna `429 Retry-After: 60` quando excedido.

## 4.9 Padrões de Performance

### Renderização

- `/asset/[id]` usa Server Component + `generateMetadata` com ISR de 1 hora
  para meta tags Open Graph (SEO) sem bloquear o render interativo.
- Restante das páginas são Client Components (dados em tempo real via wagmi/Apollo).

### Imagens

- `next/image` em todos os thumbnails com `fill` + `sizes` responsivos.
- `loading="lazy"` por padrão; `priority` explícito apenas para cards acima do
  fold.
- `NFTImage` implementa fallback multi-gateway IPFS (itera entre `ipfs.io`,
  `cloudflare-ipfs.com`, `nftstorage.link`, `*.ipfs.dweb.link` no `onError`).

### Batching e concorrência

- **Multicall** via `useReadContracts` em todos os fallbacks RPC (lê N coleções
  em uma única chamada).
- **`p-limit`** controla concorrência de fetches IPFS paralelos.
- **Paginação:** `/explore` usa pageSize=8 com paginação numérica; coleções usam
  cursor Alchemy `pageKey` com "Carregar mais".
- Polling com constantes centralizadas: atividade 30s, stats 60s, trending 300s.

---

[← Subgraph](./03-indexacao-subgraph.md) | [Próximo: Modelagem de Dados →](./05-modelagem-dados.md)
