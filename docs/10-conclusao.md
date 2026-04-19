# 10. Conclusão

## 10.1 Desafios Enfrentados

### Aleatoriedade verificável on-chain sem oráculo pago

**Problema:** em coleções generativas, a atribuição de metadados deve ser
aleatória e auditável — os compradores precisam saber que o criador não
manipulou as raridades.

**Solução adotada:** esquema commit-reveal combinado com Fisher-Yates:

1. O criador compromete `keccak256(seed)` antes de qualquer mint.
2. Durante o mint, o índice é calculado com `keccak256(commitment, blockhash, to, tokenId) % remaining`.
3. O Fisher-Yates (swap-and-pop) garante que cada URI seja sorteada exatamente uma vez.
4. Após o mint completo, a semente é revelada publicamente — qualquer
   participante pode verificar que `keccak256(seed) == commitment`.

Sem custo de oráculo (Chainlink VRF cobra em LINK), e sem manipulação possível
pelo criador após o commit. Limitação reconhecida: o `blockhash` na Sepolia é
menos robusto que na mainnet, reduzindo a garantia contra manipulação de mineradores.

Implementação: [`blockchain/src/NFTCollection.sol:163-229`](../blockchain/src/NFTCollection.sol)

---

### Proteção contra receptores de royalty maliciosos

**Problema:** o padrão ERC-2981 permite que criadores designem qualquer endereço
como receptor de royalty — incluindo contratos que rejetam ETH no `receive()`.
Um receptor malicioso poderia bloquear todas as vendas ao fazer a transferência
de royalty reverter.

**Solução adotada:** *pull-payment* obrigatório para royalties — a transferência
de ETH usa `call{value}("")` com fallback para `pendingWithdrawals`. Se o push
falhar, o royalty é creditado no ledger e o receptor saca manualmente. A venda
**nunca reverte** por causa do receptor de royalty.

Cuidado extra: o código explicitamente **não redireciona** o royalty para o
vendedor em caso de falha — isso seria uma forma de evasão de royalties.

Implementação: [`blockchain/src/NFTMarketplace.sol:582-607`](../blockchain/src/NFTMarketplace.sol)

---

### Inconsistência eventual do subgraph em fluxos críticos

**Problema:** o subgraph pode estar segundos (ou minutos) atrás da blockchain
real. Mostrar um preço stale ao usuário antes de uma compra pode resultar em
uma transação revertida (`IncorrectPayment`).

**Solução adotada:** política de fontes de dados descrita em
[`frontend/src/lib/DATA_SOURCES.md`](../frontend/src/lib/DATA_SOURCES.md):

- **Subgraph** para descoberta, listas, atividade, estatísticas (eventual
  consistency aceitável).
- **RPC direto** para valores que impactam transações (`getListing`, `getOffer`,
  `ownerOf`).
- **RPC reconcilia** a tabela de ofertas após pintura inicial pelo subgraph.

---

### Ausência de `delete` e queries filtradas no AssemblyScript

**Problema:** os handlers do subgraph são escritos em AssemblyScript, que não
permite deletar entidades nem filtrar outras entidades dentro de um handler.
Isso impossibilita recalcular o floor price real após a remoção da listagem
mais barata.

**Solução adotada:** aproximação pragmática documentada em
[`subgraph/src/helpers.ts:90-119`](../subgraph/src/helpers.ts):

- Ao remover uma listagem que estava no floor, o `floorPrice` é anulado (`null`).
- O próximo evento `ItemListed` ou `ListingPriceUpdated` restaura o valor.
- Isso introduz um período curto em que o floor pode aparecer como `null` na
  UI — aceitável para analytics; nunca afeta transações (que usam RPC).

---

### Gas bomb em chamada externa a `royaltyInfo`

**Problema:** um contrato NFT adversarial pode implementar `royaltyInfo` de
forma a consumir todo o gas disponível ou retornar um payload enorme.

**Solução adotada:** `staticcall` via assembly inline com gas limitado a
30.000 e retorno limitado a 64 bytes:

```solidity
// NFTMarketplace.sol:554-566
assembly {
    success := staticcall(ROYALTY_INFO_GAS, nftContract, ..., 0, 0)
    if success {
        if gt(returndatasize(), 64) { success := 0 }  // cap return-bomb
        returndatacopy(ptr, 0, 64)
    }
}
```

Implementação: [`blockchain/src/NFTMarketplace.sol:545-577`](../blockchain/src/NFTMarketplace.sol)

---

### Dupla natureza de ofertas no subgraph (histórico vs. estado atual)

**Problema:** o The Graph não suporta deleção de entidades. Uma oferta
cancelada ou expirada não pode ser removida — apenas marcada como inativa. Mas
é necessário consultar o estado atual de uma oferta (canônico) E o histórico
completo de todas as ofertas de um comprador (tx-por-tx).

**Solução adotada:** dual-ID pattern descrito em §3.6:

- Entidade canônica: `nftContract-tokenId-buyer` — sobrescrita em cada nova
  oferta, reflete o estado atual.
- Entidade tx-única: `nftContract-tokenId-buyer-txHash` — nunca sobrescrita,
  histórico imutável.
- `latestOfferId` no canônico aponta para o registro mais recente.

---

### Gerenciamento de estado sem Context proliferado

**Problema:** React Context com atualizações frequentes (ex.: clock a cada
segundo, favoritos, `nowBucketed`) causa re-renders em cascata em toda a
subárvore de componentes.

**Solução adotada:** `useSyncExternalStore` com stores externos ao React:

- `useClock(interval)` — um único `setInterval` global compartilhado por todos
  os componentes; novo assinante recebe o valor atual sem criar um novo timer.
- `useFavorites` — `localStorage` como store externo com `StorageEvent` para
  sincronização entre abas.
- `useNowBucketed` — snapshots de tempo em buckets de 60s para variáveis
  GraphQL estáveis.

---

## 10.2 Aprendizados

| Aprendizado | Evidência no código |
|---|---|
| **CEI + nonReentrant são complementares**, não alternativas. Mesmo com `nonReentrant`, manter CEI evita bugs de estado intermediário em reentrâncias futuras que não usem o modifier. | `buyItem`, `acceptOffer`, `mint` |
| **Pull-payment é a única defesa robusta** contra receptores ETH adversariais em sistemas de marketplace. Push-only pode ser DoS-ado. | `_paySeller`, `_payRoyalty`, `withdrawPending` |
| **Dual-ID no subgraph** é uma solução não-óbvia que resolve a necessidade de estado mutable + histórico imutável sem deletes. | `marketplace.ts:handleOfferMade` |
| **Subgraph-first + RPC-fallback** não é apenas uma otimização de performance — é uma decisão de segurança: dados do subgraph nunca devem ser usados para determinar valores em transações. | `DATA_SOURCES.md`, `useNFTListing`, `useNFTOffers` |
| **TypeScript strict** com `noUnusedLocals` e `noImplicitOverride` força a remoção de código morto e documenta heranças explicitamente, sem overhead adicional de revisão. | `tsconfig.json`, `ErrorBoundary.tsx:26,32` |
| **`useSyncExternalStore` escala melhor que Context** para estado global de alta frequência — sem re-renders de componentes que não assinam o store. | `useClock.ts`, `useFavorites.ts` |
| **Gas optimization e legibilidade não são opostos**: structs empacotados, custom errors e Fisher-Yates resultam em código mais simples E mais barato. | `Listing`, `Offer`, `_availableURIs` |

## 10.3 Possíveis Melhorias Futuras

### Curto prazo (arquiteturalmente pequenas)

- **Testes do subgraph com Matchstick:** adicionar suite de testes para os
  handlers AssemblyScript, cobrindo especialmente o dual-ID de `Offer`, o
  reset diário de `CollectionStat` e o anti-ghost-offer.
- **EIP-2612 Permit:** suporte a `permit` no ERC-721 eliminaria a necessidade
  do passo `setApprovalForAll` em `listItem` e `acceptOffer`, reduzindo o
  fluxo de two-step para one-step.
- **Cache Redis no rate limiter:** substituir o store em memória do `apiProxy`
  por Redis — necessário quando múltiplas réplicas do frontend rodam em
  paralelo.
- **Self-hosted graph-node no docker-compose:** adicionar services
  `graph-node`, `ipfs` e `postgres` ao `docker-compose.yml` para um ambiente
  local completo sem dependência do Graph Studio.

### Médio prazo (impacto na arquitetura)

- **Proxy minimal EIP-1167 no factory:** em vez de `new NFTCollection()` (que
  deploya bytecode completo a cada coleção), usar um clone minimal. Reduz o
  custo de `createCollection` de ~2,5 M gas para ~50 k gas — viável em mainnet.
- **Auctions on-chain:** adicionar suporte a leilões à inglesa (highest bid
  wins) ou holandesa (preço cai até aceitação). Requer cuidado especial com
  TEE e front-running.
- **Multichain:** o marketplace já é collection-agnostic — funciona com qualquer
  ERC-721 via ERC-165. Estender para Base, Arbitrum ou Polygon exigiria apenas
  atualização do `Web3Provider` (chains array), novo subgraph por rede e
  atualização das variáveis de ambiente.

### Longo prazo (novos domínios)

- **Royalties fracionados:** ERC-2981 suporta apenas um receptor. Implementar
  divisão de royalty entre múltiplos artistas via contrato de splitter.
- **Auction house com cancellation insurance:** mecanismo de leilão com depósito
  do vendedor para evitar cancelamentos de última hora.
- **ENS / perfis on-chain:** integrar ENS para nomes de usuário e Avatar NFTs
  no perfil, substituindo o `localStorage` de nomes.

---

## Considerações Finais

O CryptoMint demonstra que é possível construir um marketplace de NFTs
seguro, testado e pronto para produção sem comprometer a descentralização.
Os principais diferenciais técnicos do projeto são:

1. **Segurança em profundidade** — CEI, nonReentrant, gas cap em chamadas
   externas e pull-payment combinados, não como alternativas.
2. **Aleatoriedade verificável** — commit-reveal + Fisher-Yates publicáveis
   e auditáveis sem custo de oráculo.
3. **Arquitetura de dados honesta** — distinção clara entre dados autoritativos
   (RPC) e dados de conveniência (subgraph), documentada e enforçada nos hooks.
4. **Qualidade de código** — TypeScript strict + 95 % de cobertura + zero
   warnings de lint + análise estática automatizada.

O projeto serve tanto como referência técnica para desenvolvedores Web3 quanto
como demonstração acadêmica da convergência entre engenharia de software
tradicional (DX, testes, CI/CD) e o ecossistema descentralizado.

---

[← Testes](./09-testes.md) | [↑ Índice](./README.md)
