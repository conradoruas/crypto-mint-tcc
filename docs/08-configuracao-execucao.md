# 8. Configuração e Execução

## 8.1 Pré-requisitos

| Ferramenta | Versão mínima | Propósito |
|---|---|---|
| **Node.js** | ≥ 20 | Executar o frontend Next.js |
| **npm** | incluído no Node.js | Gerenciador de pacotes do frontend |
| **Foundry** | estável recente | Compilar/testar/fazer deploy dos contratos |
| **Git** | qualquer | Clonar submódulos das bibliotecas Solidity |
| **MetaMask** (ou carteira compatível) | — | Interagir com a Sepolia |
| **Conta Alchemy** | — | Chave de API para RPC da Sepolia e NFT API |
| **Conta Pinata** | — | JWT para pinagem de arquivos no IPFS |
| **Graph Studio** (opcional) | — | Implantação do subgraph (necessário para indexação completa) |
| **Docker** (opcional) | ≥ 24 | Deploy da aplicação em contêiner |

## 8.2 Variáveis de Ambiente

As variáveis são declaradas em `.env.example` na raiz e validadas em
[`frontend/src/lib/env.ts`](../frontend/src/lib/env.ts) antes que qualquer rota
seja servida. Variáveis ausentes travam o servidor imediatamente (fail-fast).

| Variável | Obrigatória | Visibilidade | Origem | Descrição |
|---|---|---|---|---|
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | Sim | Client + Server | Build-time | Endereço do `NFTMarketplace` na Sepolia |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS` | Sim | Client + Server | Build-time | Endereço do `NFTCollectionFactory` na Sepolia |
| `ALCHEMY_API_KEY` | Sim | **Server-only** | Runtime | Chave Alchemy para RPC + NFT API |
| `PINATA_JWT` | Sim | **Server-only** | Runtime | JWT Pinata para pinagem IPFS |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Não | Client + Server | Build-time | Habilita WalletConnect no ConnectKit |
| `NEXT_PUBLIC_SUBGRAPH_URL` | Não | Client + Server | Build-time | URL do subgraph no Graph Studio; se ausente, usa RPC fallback |

> **Importante:** Variáveis `NEXT_PUBLIC_*` são injetadas no bundle JavaScript
> no momento do build — mudar seus valores exige reconstruir a imagem Docker.
> Variáveis sem o prefixo (`ALCHEMY_API_KEY`, `PINATA_JWT`) são injetadas em
> runtime e nunca chegam ao cliente.

## 8.3 Instalação Local (Desenvolvimento)

### 1. Clonar o repositório

```bash
git clone https://github.com/conradoruas/tcc.git
cd tcc
```

### 2. Instalar dependências do frontend

```bash
cd frontend
npm install
```

### 3. Instalar bibliotecas dos contratos

```bash
cd ../blockchain
forge install   # baixa submódulos git (openzeppelin, forge-std, ERC721A)
```

### 4. Instalar dependências do subgraph (opcional, para alterações no subgraph)

```bash
cd ../subgraph
npm install
```

### 5. Configurar variáveis de ambiente

```bash
cp .env.example frontend/.env.local
# Editar frontend/.env.local com os valores reais
```

### 6. Rodar testes dos contratos

```bash
cd blockchain
forge test -vvv
```

### 7. Iniciar o frontend em modo de desenvolvimento

```bash
cd frontend
npm run dev
# Acesse: http://localhost:3000
```

## 8.4 Deploy dos Smart Contracts na Sepolia

Os contratos precisam ser implantados antes de configurar o subgraph e o
frontend.

```bash
cd blockchain

# Deploy do Factory
PRIVATE_KEY=0x<sua_chave_privada> forge script script/DeployFactory.s.sol:DeployFactory \
    --rpc-url https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY \
    --broadcast \
    --verify   # verifica no Etherscan automaticamente

# Deploy do Marketplace
PRIVATE_KEY=0x<sua_chave_privada> forge script script/DeployMarketplace.s.sol:DeployMarketplace \
    --rpc-url https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY \
    --broadcast \
    --verify
```

Anote os endereços exibidos na saída. Eles serão usados em `frontend/.env.local`
e em `subgraph/subgraph.yaml`.

## 8.5 Deploy do Subgraph no Graph Studio

```bash
cd subgraph

# 1. Atualize subgraph.yaml com os endereços e startBlocks reais
#    (NFTCollectionFactory e NFTMarketplace)

# 2. Regenere os tipos AssemblyScript
npm run codegen

# 3. Compile o subgraph
npm run build

# 4. Faça deploy no Graph Studio
npm run deploy
# (Requer autenticação prévia: graph auth --studio <deploy-key>)
```

Após o deploy, copie a URL da API de consulta do Graph Studio para
`NEXT_PUBLIC_SUBGRAPH_URL` em `frontend/.env.local`.

### Desenvolvimento local do subgraph (com graph-node)

Para rodar o subgraph localmente sem depender do Graph Studio, é necessário
executar separadamente um stack graph-node + IPFS + PostgreSQL (não incluído no
`docker-compose.yml` deste repositório).

```bash
cd subgraph
npm run create-local   # cria o subgraph no graph-node local
npm run deploy-local   # faz deploy para http://localhost:8020/
```

## 8.6 Execução via Docker

### Docker Compose (recomendado)

```bash
# Na raiz do projeto
cp .env.example .env
# Editar .env com os valores reais

docker compose up --build
# Aplicação disponível em http://localhost:3000
```

O `docker-compose.yml` usa `build.args` para injetar variáveis `NEXT_PUBLIC_*`
no momento do build e `environment` para variáveis server-side em runtime.

### Docker direto

```bash
cd frontend

# Build com variáveis de build-time
docker build \
    --build-arg NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x32286F... \
    --build-arg NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS=0xf17F5... \
    --build-arg NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/... \
    -t cryptomint .

# Run com variáveis de runtime (server-only)
docker run -p 3000:3000 \
    -e ALCHEMY_API_KEY=<sua_chave> \
    -e PINATA_JWT=<seu_jwt> \
    cryptomint
```

A imagem Docker é multi-stage (`deps` → `builder` → `runner`) com usuário
não-root e healthcheck incluído, resultando em ~180 MB.

## 8.7 CI/CD

### Pipeline raiz (`.github/workflows/ci.yml`)

Dispara em push para `main`/`develop` e em pull requests para `main`. Três jobs
em paralelo:

**`contracts`** — Solidity
```
forge build --sizes
forge test -vvv
forge snapshot      (relatório de gas)
forge coverage --report lcov --report summary
```

**`security-contracts`** — Slither
```
crytic/slither-action@v0.4.0 (fail-on: high)
```

**`frontend`** — TypeScript / Next.js
```
npm ci
npm audit --audit-level=high
npm run lint          (eslint --max-warnings 0)
npx tsc --noEmit      (type check)
npm run test:run      (Vitest)
npm run build
```

### Pipeline dos contratos (`.github/workflows/test.yml`)

Pipeline independente dentro de `blockchain/`. Dispara em cada push. Executa:
`forge fmt --check`, `forge build --sizes`, `forge test -vvv`.

> **Nota:** Este pipeline é redundante com o job `contracts` do pipeline raiz.
> Em projetos futuros, recomenda-se consolidar.

## 8.8 Scripts Disponíveis

### Frontend (`frontend/package.json`)

| Script | Comando | Propósito |
|---|---|---|
| `dev` | `next dev --turbopack` | Servidor de desenvolvimento com Turbopack |
| `build` | `next build` | Build de produção |
| `start` | `next start` | Servidor de produção |
| `lint` | `eslint src --max-warnings 0` | Verificação de lint |
| `test` | `vitest` | Testes em modo watch |
| `test:run` | `vitest run` | Testes uma vez |
| `test:coverage` | `vitest run --coverage` | Testes com relatório de cobertura |

### Contratos (`blockchain/`)

| Comando | Propósito |
|---|---|
| `forge build` | Compila todos os contratos |
| `forge test -vvv` | Executa suite de testes com verbosidade |
| `forge coverage` | Relatório de cobertura |
| `forge fmt` | Formata código Solidity |
| `forge snapshot` | Relatório de gas por função |
| `forge script script/Deploy*.s.sol` | Script de deploy |

### Subgraph (`subgraph/package.json`)

| Script | Propósito |
|---|---|
| `codegen` | Gera tipos AssemblyScript do schema e ABIs |
| `build` | Compila o subgraph para WASM |
| `deploy` | Faz deploy no Graph Studio |
| `deploy-local` | Deploy em graph-node local |

---

[← Requisitos NF](./07-requisitos-nao-funcionais.md) | [Próximo: Testes →](./09-testes.md)
