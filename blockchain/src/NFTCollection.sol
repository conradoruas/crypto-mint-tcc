// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title NFTCollection
/// @author CryptoMint
/// @notice ERC-721 collection with configurable supply, mint price, and
///         pseudo-random URI assignment using a Fisher-Yates shuffle.
/// @dev Created via `NFTCollectionFactory.createCollection()`.  The owner
///      (collection creator) must call `loadTokenURIs()` before any mint
///      can proceed.  Each token gets a randomly chosen URI from the pool.
contract NFTCollection is ERC721, ERC2981, Ownable {

    /// @notice Maximum number of tokens that can be minted.
    uint256 public maxSupply;

    /// @notice Price per mint in wei.
    uint256 public mintPrice;

    /// @notice Description metadata for off-chain indexers.
    string public collectionDescription;

    /// @notice Image URI for off-chain indexers (IPFS or HTTP).
    string public collectionImage;

    /// @notice Address of the factory that deployed this contract.
    address public factory;

    /// @notice Total number of minted tokens.
    uint256 public totalSupply;

    /// @notice Whether reveal has happened (URIs have been loaded).
    bool public revealed;

    /// @notice Array of token-URI candidates; shuffled during each mint.
    string[] private _availableURIs;

    /// @notice Storage for each token's final URI.
    mapping(uint256 => string) private _tokenURIs;

    // ─── Events ────────────────────────────────────────────────────────

    /// @notice Emitted when a new token is minted.
    /// @param to       Recipient address.
    /// @param tokenId  Newly minted token ID.
    /// @param tokenUri The URI assigned to the token.
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenUri);

    // ─── Constructor ───────────────────────────────────────────────────

    /// @param _name        Collection name (ERC-721 metadata).
    /// @param _symbol      Collection symbol (ERC-721 metadata).
    /// @param _description Off-chain description for the collection.
    /// @param _image       Off-chain cover image URI.
    /// @param _maxSupply   Maximum supply.
    /// @param _mintPrice   Price per mint in wei.
    /// @param _creator     Address that owns this collection.
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _image,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address _creator
    ) ERC721(_name, _symbol) Ownable(_creator) {
        collectionDescription = _description;
        collectionImage       = _image;
        maxSupply             = _maxSupply;
        mintPrice             = _mintPrice;
        factory               = msg.sender;

        // Default 5% royalty to collection creator
        _setDefaultRoyalty(_creator, 500);
    }

    // ─── URI loading ───────────────────────────────────────────────────

    /// @notice Whether all URIs have been loaded and minting is enabled.
    function urisLoaded() external view returns (bool) {
        return _availableURIs.length > 0 || revealed;
    }

    /// @notice Loads a full set of token URIs (one per future token).
    ///         Can only be called once, before the first mint.
    /// @param uris Array of metadata URIs (length must equal `maxSupply`).
    function loadTokenURIs(string[] calldata uris) external onlyOwner {
        require(totalSupply == 0, "Minting already started");
        require(_availableURIs.length + uris.length <= maxSupply, "Exceeds maxSupply");
        for (uint256 i = 0; i < uris.length; i++) {
            _availableURIs.push(uris[i]);
        }
    }

    /// @notice Appends additional URIs (useful for batched uploads).
    ///         Must still be called before any mint occurs.
    /// @param uris Array of additional metadata URIs.
    function appendTokenURIs(string[] calldata uris) external onlyOwner {
        require(totalSupply == 0, "Minting already started");
        require(_availableURIs.length + uris.length <= maxSupply, "Exceeds maxSupply");
        for (uint256 i = 0; i < uris.length; i++) {
            _availableURIs.push(uris[i]);
        }
    }

    // ─── Minting ───────────────────────────────────────────────────────

    /// @notice Mints a new token with a pseudo-randomly selected URI.
    /// @param to Recipient address.
    function mint(address to) external payable {
        require(totalSupply < maxSupply, "Supply exhausted");
        require(_availableURIs.length > 0, "URIs not loaded");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = totalSupply;
        totalSupply += 1;

        // Fisher-Yates: pick a random index and swap with last
        uint256 remaining = _availableURIs.length;
        uint256 index = uint256(
            keccak256(abi.encodePacked(block.prevrandao, block.timestamp, to, tokenId))
        ) % remaining;

        string memory chosenUri = _availableURIs[index];
        _availableURIs[index] = _availableURIs[remaining - 1];
        _availableURIs.pop();

        _tokenURIs[tokenId] = chosenUri;
        if (_availableURIs.length == 0) {
            revealed = true;
        }

        _safeMint(to, tokenId);

        emit NFTMinted(to, tokenId, chosenUri);
    }

    // ─── Views ─────────────────────────────────────────────────────────

    /// @notice Returns the metadata URI for a minted token.
    /// @param tokenId Token ID.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    /// @notice ERC-165: declares support for ERC-721 and ERC-2981.
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ─── Owner utilities ───────────────────────────────────────────────

    /// @notice Withdraws accumulated mint funds to the collection owner.
    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }
}