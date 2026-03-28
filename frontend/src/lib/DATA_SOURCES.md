# Data sources: subgraph, Alchemy, and RPC

This app combines three read paths. They update at different speeds and serve different roles.

## Subgraph (The Graph)

- **What it is:** An indexer that reflects on-chain events after processing (eventually consistent, often seconds behind the latest block).
- **Used for:** Collection lists, NFT discovery grids, marketplace stats, activity feeds, search indexing (what exists on-chain, listing/offer hints, owner field on `nft` entities).
- **Do not rely on it alone** when the user sends ETH or signs a transaction that depends on exact listing/offer state.

## JSON-RPC (Sepolia via Alchemy in this project)

- **What it is:** Direct reads from the chain at a node’s tip.
- **Used for:** `getListing`, `getOffer`, `getOfferBuyers`, `ownerOf`, collection mint/URI flags, and all writes (transactions).
- **Treat as authoritative** for price, escrow amounts, active listing flag, ownership, and which buyers still have offers.

## Alchemy NFT API (NFT metadata)

- **What it is:** Off-chain index of token metadata, images, and ownership snapshots for NFTs.
- **Used for:** `getNFTMetadata`, `getNFTsForContract`, `getNFTsForOwner`, thumbnails in nav/search/favorites/profile.
- **Strengths:** Rich media and names.
- **Limits:** Cached, can disagree temporarily with chain ownership; not used to decide how much ETH to send in a purchase.

## Product rules implemented in the app

| Concern | Source of truth in UI |
|--------|------------------------|
| Buy / pay listing price | Asset page reads listing via `getListing` (RPC). |
| Offers table / accept offer | Asset page reads buyers via `getOfferBuyers` and each row via `getOffer` (RPC). |
| Explore grid price / “for sale” badges | Subgraph (+ Alchemy for images). Shown as **best-effort**; copy tells users to open the asset to confirm. |
| After a tx | Hooks refetch on-chain reads; explore uses `cache-and-network` and refetches when the tab becomes visible again to soften indexer lag. |

Activity and analytics remain subgraph-backed by design; they are historical and inherently eventual.
