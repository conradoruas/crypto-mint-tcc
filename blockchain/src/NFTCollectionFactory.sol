// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {NFTCollection} from "./NFTCollection.sol";

contract NFTCollectionFactory {

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

    CollectionInfo[] public collections;

    /// @notice creator => lista de índices das suas coleções
    mapping(address => uint256[]) public creatorCollections;

    event CollectionCreated(
        address indexed creator,
        address indexed contractAddress,
        string name,
        uint256 indexed collectionId
    );

    function createCollection(
        string memory name,
        string memory symbol,
        string memory description,
        string memory image,
        uint256 maxSupply,
        uint256 mintPrice
    ) external returns (address) {
        require(maxSupply > 0,   "Supply deve ser maior que 0");
        require(bytes(name).length > 0,   "Nome obrigatorio");
        require(bytes(symbol).length > 0, "Symbol obrigatorio");

        NFTCollection collection = new NFTCollection(
            name,
            symbol,
            description,
            image,
            maxSupply,
            mintPrice,
            msg.sender,      // creator vira owner da coleção
            address(this)
        );

        uint256 collectionId = collections.length;

        collections.push(CollectionInfo({
            contractAddress: address(collection),
            creator:         msg.sender,
            name:            name,
            symbol:          symbol,
            description:     description,
            image:           image,
            maxSupply:       maxSupply,
            mintPrice:       mintPrice,
            createdAt:       block.timestamp
        }));

        creatorCollections[msg.sender].push(collectionId);

        emit CollectionCreated(msg.sender, address(collection), name, collectionId);

        return address(collection);
    }

    function getCollection(uint256 id) external view returns (CollectionInfo memory) {
        return collections[id];
    }

    function getAllCollections() external view returns (CollectionInfo[] memory) {
        return collections;
    }

    function getCreatorCollections(address creator) external view returns (uint256[] memory) {
        return creatorCollections[creator];
    }

    function totalCollections() external view returns (uint256) {
        return collections.length;
    }
}