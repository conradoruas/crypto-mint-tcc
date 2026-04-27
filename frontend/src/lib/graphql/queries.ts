import { gql } from "@apollo/client";

/** Which layers are authoritative for listings vs metadata: see `src/lib/DATA_SOURCES.md`. */

export const GET_COLLECTIONS_BY_CREATOR = gql`
  query GetCollectionsByCreator($creator: Bytes!, $first: Int!, $skip: Int!) {
    collections(
      where: { creator: $creator }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      contractAddress
      creator
      name
      symbol
      description
      image
      maxSupply
      mintPrice
      totalSupply
      createdAt
      collectionId
    }
  }
`;

export const GET_COLLECTIONS = gql`
  query GetCollections($first: Int!, $skip: Int!) {
    collections(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
      id
      contractAddress
      creator
      name
      symbol
      description
      image
      maxSupply
      mintPrice
      totalSupply
      createdAt
      collectionId
    }
  }
`;

export const GET_COLLECTION = gql`
  query GetCollection($id: ID!) {
    collection(id: $id) {
      id
      contractAddress
      creator
      name
      symbol
      description
      image
      maxSupply
      mintPrice
      totalSupply
      createdAt
    }
  }
`;

export const GET_ACTIVITY_FEED = gql`
  query GetActivityFeed($first: Int!, $nftContract: Bytes) {
    activityEvents(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { nftContract: $nftContract }
    ) {
      id
      type
      nftContract
      tokenId
      from
      to
      price
      timestamp
      txHash
    }
  }
`;

export const GET_ACTIVITY_FEED_ALL = gql`
  query GetActivityFeedAll($first: Int!) {
    activityEvents(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      type
      nftContract
      tokenId
      from
      to
      price
      timestamp
      txHash
    }
  }
`;

export const GET_NFTS_FOR_CONTRACT = gql`
  query GetNFTsForContract(
    $first: Int!
    $skip: Int!
    $orderBy: NFT_orderBy
    $orderDirection: OrderDirection
    $where: NFT_filter
    $now: BigInt!
  ) {
    nfts(
      where: $where
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      tokenId
      tokenUri
      owner
      attributes {
        traitType
        valueStr
        valueNum
        displayType
      }
      listing {
        id
        price
        active
        seller
      }
      offers(where: { active: true, expiresAt_gt: $now }, orderBy: amount, orderDirection: desc) {
        id
        amount
        buyer
        expiresAt
      }
    }
  }
`;



export const GET_ALL_NFTS = gql`
  query GetAllNFTs(
    $first: Int!
    $skip: Int!
    $orderBy: NFT_orderBy
    $orderDirection: OrderDirection
    $where: NFT_filter
    $now: BigInt!
  ) {
    nfts(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: $where
    ) {
      id
      tokenId
      tokenUri
      owner
      attributes {
        traitType
        valueStr
        valueNum
        displayType
      }
      collection {
        id
        contractAddress
        name
        symbol
      }
      listing {
        id
        price
        active
        seller
      }
      offers(where: { active: true, expiresAt_gt: $now }, orderBy: amount, orderDirection: desc) {
        id
        amount
        buyer
      }
    }
  }
`;

export const GET_COLLECTION_TRAIT_SCHEMA = gql`
  query GetCollectionTraitSchema($id: ID!) {
    collection(id: $id) {
      id
      contractURI
      traitSchemaCID
      traitDefinitions(orderBy: position) {
        id
        key
        label
        type
        required
        minValue
        maxValue
        options(orderBy: count, orderDirection: desc, first: 200) {
          value
          count
          frequency
        }
      }
    }
  }
`;



export const GET_NFT_ATTRIBUTES = gql`
  query GetNftAttributes($id: ID!) {
    nft(id: $id) {
      id
      metadataResolved
      attributes {
        traitType
        valueStr
        valueNum
        displayType
      }
      collection {
        id
        contractAddress
        traitDefinitions(orderBy: position) {
          key
          label
          type
          options(orderBy: count, orderDirection: desc, first: 200) {
            value
            count
            frequency
          }
        }
      }
    }
  }
`;

export const GET_NFTS_FOR_OWNER = gql`
  query GetNFTsForOwner($owner: Bytes!, $first: Int!, $skip: Int!) {
    nfts(
      where: { owner: $owner }
      first: $first
      skip: $skip
      orderBy: mintedAt
      orderDirection: desc
    ) {
      id
      tokenId
      tokenUri
      owner
      collection {
        id
        contractAddress
        name
        symbol
      }
    }
  }
`;

export const GET_NFTS_FOR_OWNER_IN_COLLECTION = gql`
  query GetNFTsForOwnerInCollection($owner: Bytes!, $collection: String!) {
    nfts(
      where: { owner: $owner, collection: $collection }
      orderBy: tokenId
      orderDirection: asc
    ) {
      id
      tokenId
      tokenUri
      owner
      collection {
        id
        contractAddress
        name
        symbol
      }
    }
  }
`;

export const GET_LISTING = gql`
  query GetListing($id: ID!) {
    listing(id: $id) {
      id
      nftContract
      tokenId
      seller
      price
      active
    }
  }
`;

/** Primary list for the asset UI (fast); RPC reconciles rows when `getOfferBuyers` / `getOffer` return. */
export const GET_OFFERS_FOR_NFT = gql`
  query GetOffersForNFT($nftContract: Bytes!, $tokenId: BigInt!, $now: BigInt!) {
    offers(
      where: { nftContract: $nftContract, tokenId: $tokenId, active: true, expiresAt_gt: $now }
      orderBy: amount
      orderDirection: desc
    ) {
      id
      buyer
      amount
      expiresAt
      active
    }
  }
`;

export const GET_MY_OFFER = gql`
  query GetMyOffer($nftContract: Bytes!, $tokenId: BigInt!, $buyer: Bytes!) {
    offers(
      where: {
        nftContract: $nftContract
        tokenId: $tokenId
        buyer: $buyer
        active: true
      }
    ) {
      id
      amount
      expiresAt
      active
    }
  }
`;

export const GET_MARKETPLACE_STATS = gql`
  query GetMarketplaceStats {
    marketplaceStats(id: "global") {
      totalCollections
      totalNFTs
      totalListed
      totalVolume
      totalSales
    }
  }
`;

/**
 * Pre-sorted trending data from the CollectionStat entity.
 * Replaces the previous GET_TRENDING_DATA query that scanned 1200 entities
 * (activityEvents + listings + offers) on the client side.
 * The subgraph now maintains volume24h/sales24h with proper day-based resets
 * and DailyCollectionSnapshot entities for accurate historical aggregation.
 */
export const GET_COLLECTION_WITH_NFTS = gql`
  query GetCollectionWithNFTs($id: ID!, $first: Int!, $skip: Int!) {
    collection(id: $id) {
      id
      contractAddress
      creator
      name
      symbol
      description
      image
      maxSupply
      mintPrice
      totalSupply
    }
    nfts(
      where: { collection: $id }
      first: $first
      skip: $skip
      orderBy: tokenId
      orderDirection: asc
    ) {
      id
      tokenId
      tokenUri
      owner
    }
  }
`;

export const GET_TOP_OFFERS_BY_COLLECTION = gql`
  query GetTopOffersByCollection($now: BigInt!) {
    offers(
      first: 500
      where: { active: true, expiresAt_gt: $now }
      orderBy: amount
      orderDirection: desc
    ) {
      nftContract
      amount
    }
  }
`;

export const GET_COLLECTION_STATS_RANKED = gql`
  query GetCollectionStatRanked($first: Int!) {
    collectionStats(first: $first, orderBy: volume24h, orderDirection: desc) {
      id
      totalVolume
      totalSales
      floorPrice
      floorPriceDayStart
      volume24h
      sales24h
      collection {
        id
        contractAddress
        name
        symbol
        image
        dailySnapshots(first: 14, orderBy: dayId, orderDirection: desc) {
          dayId
          floor
        }
      }
    }
  }
`;

export const GET_SEARCH_SUGGESTIONS = gql`
  query GetSearchSuggestions($q: String!, $limit: Int!) {
    collections(
      first: $limit
      where: { name_contains_nocase: $q }
      orderBy: totalSupply
      orderDirection: desc
    ) {
      id
      contractAddress
      name
      symbol
      image
      totalSupply
    }
    nfts(
      first: $limit
      where: { collection_: { name_contains_nocase: $q } }
      orderBy: tokenId
      orderDirection: asc
    ) {
      id
      tokenId
      collection {
        contractAddress
        name
        symbol
      }
    }
  }
`;
