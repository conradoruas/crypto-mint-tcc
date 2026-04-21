# CryptoMint — Documentação Técnica (TCC)

Marketplace descentralizado de NFTs desenvolvido como Trabalho de Conclusão de
Curso. O sistema permite criar coleções ERC-721 com mint aleatório auditável,
negociar ativos em um contrato de marketplace com royalties automáticos
(ERC-2981) e acompanhar toda a atividade via indexação The Graph.

> **Stack real do projeto** — Solidity/Foundry · The Graph (GraphQL) ·
> Next.js 16 · TypeScript · wagmi 3 / viem 2 · IPFS via Pinata

---

## Índice

| # | Seção | Arquivo |
|---|---|---|
| 0 | Visão Geral do Projeto | [00-visao-geral.md](./00-visao-geral.md) |
| 1 | Arquitetura do Sistema | [01-arquitetura.md](./01-arquitetura.md) |
| 2 | Backend — Smart Contracts (Solidity) | [02-backend-solidity.md](./02-backend-solidity.md) |
| 3 | Camada de Indexação — The Graph (Subgraph) | [03-indexacao-subgraph.md](./03-indexacao-subgraph.md) |
| 4 | Frontend — Next.js 16 | [04-frontend-nextjs.md](./04-frontend-nextjs.md) |
| 5 | Modelagem de Dados | [05-modelagem-dados.md](./05-modelagem-dados.md) |
| 6 | Funcionalidades Principais | [06-funcionalidades.md](./06-funcionalidades.md) |
| 7 | Requisitos Não Funcionais | [07-requisitos-nao-funcionais.md](./07-requisitos-nao-funcionais.md) |
| 8 | Configuração e Execução | [08-configuracao-execucao.md](./08-configuracao-execucao.md) |
| 9 | Testes | [09-testes.md](./09-testes.md) |
| 10 | Conclusão | [10-conclusao.md](./10-conclusao.md) |

---

## Convenções deste documento

- **Português (BR)** como idioma principal; termos técnicos consagrados
  (`smart contract`, `hook`, `subgraph`, `mint`, `deploy`) permanecem em inglês.
- Referências a código usam o formato `[arquivo.ext:linha](../caminho/arquivo.ext#Llinha)`.
- Diagramas escritos em **Mermaid** — renderizam no GitHub, Obsidian e extensão
  do VS Code `Markdown Preview Mermaid Support`.
- Cada seção termina com links de navegação ← anterior | próximo →.

---

## Roadmap de leitura sugerido para a banca

1. **Visão Geral** → entender o problema e o escopo do projeto.
2. **Arquitetura** → compreender como as três camadas se comunicam.
3. **Backend (Contratos)** → detalhes dos smart contracts e padrões de segurança.
4. **Subgraph** → como os eventos on-chain são indexados e servidos via GraphQL.
5. **Frontend** → estrutura da aplicação Next.js e integração Web3.
6. **Funcionalidades** → fluxos end-to-end com diagramas de sequência.
7. **Testes** → estratégia e ferramentas de verificação.
8. **Conclusão** → desafios, aprendizados e trabalhos futuros.
