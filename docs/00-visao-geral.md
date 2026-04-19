# 0. Visão Geral do Projeto

## 0.1 Objetivo do Sistema

O **CryptoMint** é um marketplace de NFTs (*Non-Fungible Tokens*) totalmente
descentralizado, implantado na rede de testes Sepolia da Ethereum. O sistema
permite que criadores **publiquem coleções de arte digital**, realizem o mint
dos ativos com aleatoriedade verificável e os comercializem com royalties
automáticos pagos a cada revenda — tudo sem intermediários centralizados.

Os três pilares do sistema são:

| Pilar | Responsabilidade |
|---|---|
| **Smart Contracts** (Solidity) | Custódia dos ativos, regras de negócio, distribuição de pagamentos |
| **Subgraph** (The Graph) | Indexação de eventos on-chain em um banco de dados GraphQL consultável |
| **Frontend** (Next.js 16) | Interface do usuário, integração com carteira, chamadas aos contratos e ao subgraph |

## 0.2 Problema que o Sistema Resolve

Marketplaces de NFTs tradicionais concentram três problemas estruturais:

### Custódia centralizada
Plataformas como OpenSea v1 custodiavam os ativos dos usuários. Uma falha ou
decisão unilateral da plataforma pode resultar em perda de acesso aos ativos.
O CryptoMint opera com **custódia self-custodial**: os NFTs nunca saem da
carteira do usuário enquanto listados; o marketplace apenas recebe aprovação
(`setApprovalForAll`) para executar a transferência no momento da venda.

### Falta de transparência na aleatoriedade do mint
Coleções generativas comumente realizam o sorteio de metadados em um servidor
centralizado, possibilitando manipulação (*rug pull* de raridades). O CryptoMint
implementa um esquema de **commit-reveal + Fisher-Yates** diretamente no
contrato: o criador compromete um hash de semente antes do mint e só pode
revelá-la após a venda, tornando o resultado publicamente auditável.

### Evasão de royalties
Contratos antigos que ignoram o padrão ERC-2981 podem simplesmente não pagar
royalties a criadores em revendas. O `NFTMarketplace` consulta o padrão
ERC-2981 em cada transação e distribui automaticamente os royalties ao receptor
designado, com um teto obrigatório de **10 %** e um mecanismo de *pull-payment*
que impede que um receptor malicioso bloqueie vendas ao rejeitar ETH.

## 0.3 Público-alvo

- **Criadores de arte digital** que desejam lançar coleções generativas sem
  depender de plataformas centralizadas, preservando a propriedade dos royalties.
- **Colecionadores** com carteira Web3 (MetaMask ou compatível) que querem
  adquirir, fazer ofertas e revender NFTs com transparência total.
- **Desenvolvedores e pesquisadores** interessados em um sistema de referência
  de marketplace descentralizado com foco em segurança e qualidade de código.

## 0.4 Escopo e Limitações

O projeto foi desenvolvido com fins **acadêmicos e de pesquisa**; por isso:

- A rede utilizada é a **Sepolia** (testnet), não a mainnet da Ethereum.
- Não há leilões on-chain (somente preço fixo e ofertas com expiração de 7 dias).
- Favoritos são armazenados no `localStorage` do navegador (off-chain).
- A indexação depende de um nó The Graph hospedado no **Graph Studio** (serviço
  gerenciado); não há infraestrutura self-hosted no repositório.

## 0.5 Visão Geral da Arquitetura

```mermaid
graph TD
    U((Usuário\nCarteira Web3)) --> FE[Frontend\nNext.js 16]

    FE -->|GraphQL\nApollo Client 4| SG[The Graph Studio\nSubgraph / GraphQL API]
    FE -->|JSON-RPC\nwagmi + viem| RPC[/api/rpc\nProxy Alchemy]
    FE -->|IPFS upload\nPinata JWT| UP[/api/upload\nServer Route]

    RPC -->|HTTPS| AL[Alchemy\nSepolia RPC]
    UP -->|REST| PI[Pinata\nIPFS]
    AL --> BC[Ethereum\nSepolia]

    BC -->|Eventos| GN[graph-node\nThe Graph]
    GN --> SG

    BC --> C1[NFTMarketplace\n0x3228...1C74]
    BC --> C2[NFTCollectionFactory\n0xf17F...6c3]
    BC --> C3[NFTCollection\ninstâncias dinâmicas]
```

Fluxo principal de dados:

1. O usuário interage com o **frontend** via navegador.
2. Leituras de descoberta (listagens, coleções, atividade) chegam via
   **GraphQL** do subgraph — resposta rápida com dados desnormalizados.
3. Leituras autoritativas (preço exato antes de comprar, estado de oferta)
   e **escritas** (transações) vão direto ao **RPC da Sepolia** via proxy
   server-side (a chave Alchemy nunca chega ao bundle do cliente).
4. Mídias e metadados são fixados no **IPFS** via Pinata; a URL resultante
   é gravada no contrato no momento do mint.
5. Cada transação confirmada emite eventos Solidity que o **graph-node**
   captura e persiste como entidades GraphQL, fechando o ciclo.

---

[← Índice](./README.md) | [Próximo: Arquitetura →](./01-arquitetura.md)
