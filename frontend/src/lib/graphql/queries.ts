import { gql } from "@apollo/client";

export const GET_COLLECTIONS = gql`
  query GetCollections {
    collections(orderBy: createdAt, orderDirection: desc) {
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
  query GetNFTsForContract($collection: String!, $first: Int!, $skip: Int!) {
    nfts(
      where: { collection: $collection }
      first: $first
      skip: $skip
      orderBy: tokenId
      orderDirection: asc
    ) {
      id
      tokenId
      tokenUri
      owner
      listing {
        id
        price
        active
        seller
      }
      offers(where: { active: true }, orderBy: amount, orderDirection: desc) {
        id
        amount
        buyer
        expiresAt
      }
    }
  }
`;

export const GET_ALL_NFTS = gql`
  query GetAllNFTs($first: Int!, $skip: Int!) {
    nfts(first: $first, skip: $skip, orderBy: tokenId, orderDirection: asc) {
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
      listing {
        id
        price
        active
        seller
      }
      offers(where: { active: true }, orderBy: amount, orderDirection: desc) {
        id
        amount
        buyer
      }
    }
  }
`;

export const GET_NFTS_FOR_OWNER = gql`
  query GetNFTsForOwner($owner: Bytes!) {
    nfts(where: { owner: $owner }, orderBy: mintedAt, orderDirection: desc) {
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

export const GET_OFFERS_FOR_NFT = gql`
  query GetOffersForNFT($nftContract: Bytes!, $tokenId: BigInt!) {
    offers(
      where: { nftContract: $nftContract, tokenId: $tokenId, active: true }
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

export const GET_TRENDING_COLLECTIONS = gql`
  query GetTrendingCollections {
    collections(orderBy: createdAt, orderDirection: desc) {
      id
      contractAddress
      stats {
        totalVolume
        totalSales
      }
    }
  }
`;

export const GET_TRENDING_DATA = gql`
  query GetTrendingData($sevenDaysAgo: BigInt!, $now: BigInt!) {
    activityEvents(
      where: { type: "sale", timestamp_gt: $sevenDaysAgo }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      nftContract
      price
      timestamp
    }
    listings(
      where: { active: true }
      orderBy: price
      orderDirection: asc
      first: 1000
    ) {
      nftContract
      price
    }
    offers(
      where: { active: true, expiresAt_gt: $now }
      orderBy: amount
      orderDirection: desc
      first: 1000
    ) {
      nftContract
      amount
    }
  }
`;
