// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {NFTCollectionV2} from "./NFTCollectionV2.sol";

/// @title NFTCollectionFactoryV2
/// @author CryptoMint
/// @notice Factory for deploying NFTCollectionV2 instances.
///         Identical to NFTCollectionFactory except that `createCollection`
///         accepts an extra `contractURI` parameter that is stored immutably
///         on the deployed collection and emitted in `CollectionCreated`.
///         Indexers can parse the URI JSON to discover the collection's
///         per-collection trait schema without extra RPC calls.
contract NFTCollectionFactoryV2 {

    // ─── Custom errors ──────────────────────────────
    error NameRequired();
    error SupplyMustBePositive();

    // ─── State ──────────────────────────────────────

    /// @notice Metadata returned by view functions.
    struct CollectionInfo {
        address contractAddress;
        address creator;
        string  name;
        string  symbol;
        string  description;
        string  image;
        string  contractURI;
        uint256 maxSupply;
        uint256 mintPrice;
        uint256 createdAt;
    }

    CollectionInfo[] private _collections;

    mapping(address => uint256[]) private _creatorCollections;

    // ─── Events ──────────────────────────────────────

    /// @notice Emitted every time a new collection is deployed.
    /// @param creator         Deployer / collection owner.
    /// @param contractAddress Address of the newly deployed NFTCollectionV2.
    /// @param name            Collection name.
    /// @param collectionId    Index in the internal registry.
    /// @param contractURI     IPFS URI for the collection metadata + trait schema.
    event CollectionCreated(
        address indexed creator,
        address indexed contractAddress,
        string  name,
        uint256 indexed collectionId,
        string  contractURI
    );

    // ─── Write ───────────────────────────────────────

    /// @notice Deploys a new NFTCollectionV2 and registers it in the factory.
    /// @param name        Collection name (ERC-721 metadata).
    /// @param symbol      Collection symbol (ERC-721 metadata).
    /// @param description Off-chain description for the collection.
    /// @param image       Off-chain cover image URI (IPFS or HTTP).
    /// @param maxSupply   Maximum number of tokens that can be minted.
    /// @param mintPrice   Price per mint in wei.
    /// @param contractURI IPFS URI for the collection-level metadata JSON.
    ///                    Must include a `trait_schema` field for dynamic filters.
    ///                    Can be an empty string for schema-less collections.
    /// @return collectionAddress The address of the newly created collection.
    function createCollection(
        string memory name,
        string memory symbol,
        string memory description,
        string memory image,
        uint256 maxSupply,
        uint256 mintPrice,
        string memory contractURI
    ) external returns (address collectionAddress) {
        if (bytes(name).length == 0) revert NameRequired();
        if (maxSupply == 0) revert SupplyMustBePositive();

        NFTCollectionV2 collection = new NFTCollectionV2(
            name,
            symbol,
            description,
            image,
            maxSupply,
            mintPrice,
            msg.sender,
            contractURI
        );

        collectionAddress = address(collection);
        uint256 id = _collections.length;

        _collections.push(CollectionInfo({
            contractAddress: collectionAddress,
            creator:         msg.sender,
            name:            name,
            symbol:          symbol,
            description:     description,
            image:           image,
            contractURI:     contractURI,
            maxSupply:       maxSupply,
            mintPrice:       mintPrice,
            createdAt:       block.timestamp
        }));

        _creatorCollections[msg.sender].push(id);

        emit CollectionCreated(msg.sender, collectionAddress, name, id, contractURI);
    }

    // ─── Views ───────────────────────────────────────

    function getCollection(uint256 id) external view returns (CollectionInfo memory) {
        return _collections[id];
    }

    function getAllCollections() external view returns (CollectionInfo[] memory) {
        return _collections;
    }

    function getCollections(uint256 offset, uint256 limit)
        external view returns (CollectionInfo[] memory page)
    {
        uint256 total = _collections.length;
        if (offset >= total || limit == 0) return new CollectionInfo[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        page = new CollectionInfo[](count);
        for (uint256 i = 0; i < count; i++) {
            page[i] = _collections[offset + i];
        }
    }

    function getCreatorCollections(address creator) external view returns (uint256[] memory) {
        return _creatorCollections[creator];
    }

    function totalCollections() external view returns (uint256) {
        return _collections.length;
    }
}
