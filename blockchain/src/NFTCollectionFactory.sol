// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {NFTCollection} from "./NFTCollection.sol";

/// @title NFTCollectionFactory
/// @author CryptoMint
/// @notice Factory contract for deploying new NFTCollection instances.
///         Maintains a registry of all deployed collections and their metadata.
/// @dev Anyone can call `createCollection()` — the caller becomes the
///      collection owner and royalty receiver.
contract NFTCollectionFactory {

    // ─── Custom errors ──────────────────────────────
    error NameRequired();
    error SupplyMustBePositive();

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Metadata returned by the `getCollection()` view.
    struct CollectionInfo {
        address contractAddress;
        address creator;
        string  name;
        string  symbol;
        string  description;
        string  image;
        uint256 maxSupply;
        uint256 mintPrice;
        uint256 createdAt;
    }

    /// @dev Flat list of all deployed collections (append-only).
    CollectionInfo[] private _collections;

    /// @notice Maps creator address => list of indices in `_collections`.
    mapping(address => uint256[]) private _creatorCollections;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    /// @notice Emitted every time a new collection is deployed.
    /// @param creator         Address of the deployer / collection owner.
    /// @param contractAddress Address of the newly deployed NFTCollection.
    /// @param name            Collection name.
    /// @param collectionId    Index in the internal registry.
    event CollectionCreated(
        address indexed creator,
        address indexed contractAddress,
        string  name,
        uint256 indexed collectionId
    );

    // ─────────────────────────────────────────────
    // Write
    // ─────────────────────────────────────────────

    /// @notice Deploys a new NFTCollection and registers it in the factory.
    /// @param name        Collection name (ERC-721 metadata).
    /// @param symbol      Collection symbol (ERC-721 metadata).
    /// @param description Off-chain description for the collection.
    /// @param image       Off-chain cover image URI (IPFS or HTTP).
    /// @param maxSupply   Maximum number of tokens that can be minted.
    /// @param mintPrice   Price per mint in wei.
    /// @return collectionAddress The address of the newly created collection.
    function createCollection(
        string memory name,
        string memory symbol,
        string memory description,
        string memory image,
        uint256 maxSupply,
        uint256 mintPrice
    ) external returns (address collectionAddress) {
        if (bytes(name).length == 0) revert NameRequired();
        if (maxSupply == 0) revert SupplyMustBePositive();

        NFTCollection collection = new NFTCollection(
            name,
            symbol,
            description,
            image,
            maxSupply,
            mintPrice,
            msg.sender
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
            maxSupply:       maxSupply,
            mintPrice:       mintPrice,
            createdAt:       block.timestamp
        }));

        _creatorCollections[msg.sender].push(id);

        emit CollectionCreated(msg.sender, collectionAddress, name, id);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns metadata for a collection by index.
    /// @param id Index in the collections registry.
    function getCollection(uint256 id) external view returns (CollectionInfo memory) {
        return _collections[id];
    }

    /// @notice Returns all registered collections.
    /// @dev Unbounded — only safe while the registry is small. Prefer
    ///      `getCollections(offset, limit)` for production use.
    function getAllCollections() external view returns (CollectionInfo[] memory) {
        return _collections;
    }

    /// @notice Returns a paginated slice of registered collections.
    /// @param offset Index of the first element to return.
    /// @param limit  Maximum number of elements to return.
    function getCollections(uint256 offset, uint256 limit)
        external
        view
        returns (CollectionInfo[] memory page)
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

    /// @notice Returns the collection indices created by a specific address.
    /// @param creator The creator/owner address to query.
    function getCreatorCollections(address creator) external view returns (uint256[] memory) {
        return _creatorCollections[creator];
    }

    /// @notice Returns the total number of registered collections.
    function totalCollections() external view returns (uint256) {
        return _collections.length;
    }
}