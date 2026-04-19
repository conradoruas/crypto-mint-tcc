# 7. Requisitos Não Funcionais

## 7.1 Performance

### On-chain — Otimização de Gas

| Técnica | Onde | Benefício |
|---|---|---|
| **Struct packing** | `Listing` e `Offer` em 2 slots cada | Reduz SLOAD/SSTORE de 4 para 2 operações por leitura |
| **Custom errors** | 24 erros (`error PriceTooLow()`) | Selector de 4 bytes vs string completa em `require` |
| **Gas cap em staticcall** | `_calculateFees` (30.000 gas) | Previne gas bomb de contrato de royalty adversarial |
| **O(1) swap-and-pop** | `_offerBuyerIndex` | Remoção de comprador sem iteração do array |
| **Fisher-Yates com pop** | `NFTCollection.mint` | Sorteio O(1) sem duplicatas sem iteração |
| **`optimizer_runs = 200`** | `foundry.toml` | Bytecode otimizado para chamadas frequentes |

### Frontend — Desempenho percebido pelo usuário

| Técnica | Implementação |
|---|---|
| **Multicall batching** | `useReadContracts` para leitura de N coleções em uma chamada RPC |
| **Apollo `cache-and-network`** | Renderiza do cache imediatamente; revalida em background |
| **React Query `staleTime: Infinity`** | Metadados IPFS (content-addressed) nunca revalidam |
| **ISR (revalidate: 3600)** | Metadados OG de `/asset/[id]` com TTL de 1 hora |
| **`next/image` com `fill` + `sizes`** | Redimensionamento automático; `srcset` para cada breakpoint |
| **Lazy loading padrão** | `loading="lazy"` em todos os cards; `priority` só acima do fold |
| **IPFS multi-gateway failover** | `NFTImage` itera entre 4 gateways no `onError` |
| **Skeletons** | `NFTCardSkeleton` com `animate-pulse` durante carregamento |
| **Pagination** | Explore: 8 itens/página; Coleções: cursor Alchemy + "Carregar mais" |
| **`useClock` compartilhado** | Um único `setInterval` global para todos os countdowns |
| **`p-limit`** | Concorrência controlada em fetches IPFS paralelos |
| **Fontes com `display: swap`** | Sem FOIT; preloaded pelo `next/font/google` |

## 7.2 Escalabilidade

### Blockchain

- O marketplace é **collection-agnostic**: aceita qualquer ERC-721 via
  verificação ERC-165 em `listItem`. Não há registro centralizado no
  marketplace — qualquer coleção existente pode ser negociada.
- **Templates dinâmicos no subgraph:** cada nova coleção criada pelo factory
  gera automaticamente um novo listener sem mudanças no manifest.
- **Cleanup descentralizado:** `pruneExpiredOffers` com bounty de 0,5%
  incentiva qualquer participante da rede a limpar ofertas expiradas, sem
  cron jobs centralizados.
- **Paginação no factory:** `getCollections(offset, limit)` evita retornar
  arrays ilimitados — documentado no contrato que `getAllCollections` não deve
  ser usado em produção.

### Frontend e Infraestrutura

- **`output: "standalone"` no Next.js:** imagem Docker mínima com node_modules
  necessários apenas para o servidor, pronta para escala horizontal.
- **API Routes stateless:** `/api/rpc` e `/api/alchemy/*` não mantêm estado
  — compatíveis com múltiplas instâncias atrás de load balancer.
- **Rate limit em memória:** limitação por IP implementada no middleware Edge.
  Em produção com múltiplas réplicas, substituível por Redis (endpoint único
  para o estado do rate limiter).
- **Subgraph hospedado:** The Graph Studio gerencia a escalabilidade do
  graph-node + PostgreSQL + IPFS — zero operação de infraestrutura de indexação.

## 7.3 Segurança

### On-chain

| Risco | Mitigação |
|---|---|
| **Reentrancy** | `nonReentrant` em toda função que move ETH ou NFT; CEI rigoroso (estado modificado antes de interações externas) |
| **Royalty evasion** | Pull-payment obrigatório para royalties: receptor não pode bloquear vendas rejeitando ETH |
| **Gas/return bomb** | `staticcall` para `royaltyInfo` limitado a 30.000 gas e 64 bytes de retorno |
| **Royalty excessiva** | `MAX_ROYALTY_BPS = 1000` (10%) — teto independente do que `royaltyInfo` retornar |
| **Ghost offers** | Em `buyItem`, a oferta do comprador é reembolsada no mesmo bloco se o NFT foi comprado a preço fixo |
| **Front-running de preço** | `updateListingPrice` evita gap cancel/relist; sem janela de listagem inativa |
| **Contrato não-ERC721** | `listItem` e `makeOffer` verificam ERC-165 antes de aceitar o NFT |
| **Manipulação de mint** | Commit-reveal + `blockhash` — criador não pode manipular após commit; minerador tem influência limitada |
| **Saque drena escrow** | `withdraw()` retira apenas `accumulatedFees`, nunca ETH de ofertas em aberto |
| **Análise estática** | Slither no CI com `fail-on: high`; supressões documentadas no código |

### Off-chain (Frontend e API)

| Risco | Mitigação |
|---|---|
| **Exposição de chaves API** | `ALCHEMY_API_KEY` e `PINATA_JWT` nunca chegam ao bundle JS do cliente — somente em Route Handlers |
| **Upload anônimo** | EIP-191 signed message com expiração de 5 min em `/api/upload-auth` |
| **Injeção via IPFS** | CSP restringe `script-src` e `connect-src`; gateways IPFS listados explicitamente em `next.config.ts` |
| **XSS** | `no-console` enforced; `editProfileSchema` rejeita `<>` em nomes; CSP bloqueia scripts inline |
| **Ataques de origem cruzada** | `apiProxy.ts` verifica `Origin` header em todas as rotas de proxy |
| **Flood de API** | Rate limit por IP: Alchemy 60 req/min, RPC 120 req/min — resposta 429 com `Retry-After: 60` |
| **XSS via `any` TypeScript** | `@typescript-eslint/no-explicit-any: "error"` — proibido em toda a base |
| **Clickjacking** | `X-Frame-Options: DENY` em `next.config.ts` |
| **Referrer leakage** | `Referrer-Policy: strict-origin-when-cross-origin` |
| **Acesso a câmera/microfone** | `Permissions-Policy: camera=(), microphone=(), geolocation=()` |

### Carteira e UX de segurança

- **Rede errada:** `useWrongNetwork` detecta chainId ≠ Sepolia e exibe alerta
  no topo da página com botão `switchChain` — impede transações na rede errada.
- **WalletGuard:** rotas sensíveis (profile, create, coleções do usuário)
  redirecionam para tela de conexão se não autenticado.
- **Confirmação explícita:** todas as mutations exigem assinatura na carteira;
  nunca há autoexecução de transações.

## 7.4 Observabilidade

### Logger estruturado (`src/lib/logger.ts`)

```typescript
// Em produção — linha única para ingesta em Datadog/CloudWatch
logger.error("Failed to fetch NFT metadata", error, { tokenId, contractAddress });
// → {"timestamp":"...","level":"error","message":"Failed to fetch NFT metadata",
//    "error":{"name":"FetchError","message":"...","stack":"..."},
//    "context":{"tokenId":42,"contractAddress":"0x..."}}
```

### Monitoramento de contratos

Todos os eventos emitidos pelos contratos ficam disponíveis via subgraph e
também indexados pelo Alchemy (block explorer + webhook). A rota `/activity`
do frontend serve como dashboard de saúde do sistema em tempo real.

## 7.5 Developer Experience (DX)

| Prática | Ferramenta |
|---|---|
| **Tipagem total** | TypeScript strict + `noUnusedLocals` + `noUnusedParameters` |
| **Lint zero tolerância** | ESLint `--max-warnings 0` no CI e pre-commit |
| **Format** | `forge fmt --check` para Solidity; `eslint --fix` via lint-staged para TypeScript |
| **Pre-commit** | Husky → lint-staged em `frontend/*.{ts,tsx}` |
| **Análise de segurança** | Slither no CI (contratos) |
| **Cobertura obrigatória** | Vitest threshold: statements/lines/functions ≥ 95%, branches ≥ 90% |
| **Auditoria de deps** | `npm audit --audit-level=high` no CI (não bloqueante, mas visível) |

---

[← Funcionalidades](./06-funcionalidades.md) | [Próximo: Configuração →](./08-configuracao-execucao.md)
