// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NFTCollectionV2
/// @author CryptoMint
/// @notice ERC-721 collection with configurable supply, mint price, pseudo-random
///         URI assignment (Fisher-Yates), and an OpenSea-compatible `contractURI()`
///         that points to an IPFS JSON containing collection metadata and the
///         per-collection trait schema used for rarity and Explore-page filters.
/// @dev All minting mechanics are identical to NFTCollection v1.  The only addition
///      is the immutable `contractURIStorage` set at construction and exposed via
///      `contractURI()`.  Created via `NFTCollectionFactoryV2.createCollection()`.
contract NFTCollectionV2 is ERC721, ERC2981, Ownable, ReentrancyGuard {

    // ─── Custom errors ────────────────────────────────────────────────
    error MintingAlreadyStarted();
    error ExceedsMaxSupply();
    error SeedAlreadyCommitted();
    error EmptyCommitment();
    error URIsNotFullyLoaded();
    error NoSeedCommitted();
    error SeedAlreadyRevealed();
    error SeedMismatch();
    error SupplyExhausted();
    error URIsNotLoaded();
    error MintSeedNotCommitted();
    error InsufficientPayment();
    error BlockhashUnavailable();
    error ExcessRefundFailed();
    error NothingToWithdraw();
    error WithdrawalFailed();

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

    /// @notice Whether reveal has happened (all URIs have been consumed).
    bool public revealed;

    /// @notice Array of token-URI candidates; shuffled during each mint.
    string[] private _availableURIs;

    /// @notice Storage for each token's final URI.
    mapping(uint256 => string) private _tokenURIs;

    /// @notice keccak256 of a secret seed committed by the owner before minting.
    bytes32 public mintSeedCommitment;

    /// @notice The secret seed, revealed after minting for public auditing.
    bytes32 public mintSeedRevealed;

    /// @notice Guard flag — minting is disabled until this is true.
    bool public mintSeedCommitted;

    /// @notice Immutable URI pointing to the collection-level metadata JSON.
    ///         The JSON must conform to the OpenSea contractURI standard and
    ///         may include a `trait_schema` extension for per-collection traits.
    string public contractURIStorage;

    // ─── Events ────────────────────────────────────────────────────────

    /// @notice Emitted when a new token is minted.
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenUri);

    /// @notice Emitted once the owner pre-commits the mint seed hash.
    event MintSeedCommitted(bytes32 commitment);

    /// @notice Emitted once the owner reveals the mint seed for auditing.
    event MintSeedRevealed(bytes32 seed);

    /// @notice Emitted when the last URI is drawn from the pool.
    event Revealed();

    /// @notice Emitted when the owner withdraws accumulated mint funds.
    event Withdrawn(address indexed owner, uint256 amount);

    // ─── Constructor ───────────────────────────────────────────────────

    /// @param _name        Collection name (ERC-721 metadata).
    /// @param _symbol      Collection symbol (ERC-721 metadata).
    /// @param _description Off-chain description for the collection.
    /// @param _image       Off-chain cover image URI.
    /// @param _maxSupply   Maximum supply.
    /// @param _mintPrice   Price per mint in wei.
    /// @param _creator     Address that owns this collection.
    /// @param _contractURI IPFS URI for the collection-level metadata + trait schema.
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _image,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address _creator,
        string memory _contractURI
    ) ERC721(_name, _symbol) Ownable(_creator) {
        collectionDescription = _description;
        collectionImage       = _image;
        maxSupply             = _maxSupply;
        mintPrice             = _mintPrice;
        factory               = msg.sender;
        contractURIStorage    = _contractURI;

        // Default 5% royalty to collection creator
        _setDefaultRoyalty(_creator, 500);
    }

    // ─── contractURI ───────────────────────────────────────────────────

    /// @notice Returns the contract-level metadata URI (OpenSea standard).
    ///         Resolves to an IPFS JSON containing collection display metadata
    ///         and an optional `trait_schema` field defining per-collection traits.
    function contractURI() external view returns (string memory) {
        return contractURIStorage;
    }

    // ─── URI loading ───────────────────────────────────────────────────

    /// @notice Whether all URIs have been loaded and minting is enabled.
    function urisLoaded() external view returns (bool) {
        return _availableURIs.length > 0 || revealed;
    }

    /// @notice Loads a full set of token URIs.  Can only be called before the first mint.
    function loadTokenURIs(string[] calldata uris) external onlyOwner {
        _addURIs(uris);
    }

    /// @notice Appends additional URIs (useful for batched uploads).
    function appendTokenURIs(string[] calldata uris) external onlyOwner {
        _addURIs(uris);
    }

    function _addURIs(string[] calldata uris) internal {
        if (totalSupply != 0) revert MintingAlreadyStarted();
        if (_availableURIs.length + uris.length > maxSupply) revert ExceedsMaxSupply();
        for (uint256 i = 0; i < uris.length; i++) {
            _availableURIs.push(uris[i]);
        }
    }

    // ─── Commit-reveal mint seed ───────────────────────────────────────

    /// @notice Owner pre-commits the hash of a secret seed mixed into URI selection.
    function commitMintSeed(bytes32 commitment) external onlyOwner {
        if (mintSeedCommitted) revert SeedAlreadyCommitted();
        if (commitment == bytes32(0)) revert EmptyCommitment();
        if (_availableURIs.length != maxSupply) revert URIsNotFullyLoaded();
        mintSeedCommitment = commitment;
        mintSeedCommitted  = true;
        emit MintSeedCommitted(commitment);
    }

    /// @notice Owner publishes the pre-committed seed for public auditing.
    function revealMintSeed(bytes32 seed) external onlyOwner {
        if (!mintSeedCommitted) revert NoSeedCommitted();
        if (mintSeedRevealed != bytes32(0)) revert SeedAlreadyRevealed();
        if (keccak256(abi.encodePacked(seed)) != mintSeedCommitment) revert SeedMismatch();
        mintSeedRevealed = seed;
        emit MintSeedRevealed(seed);
    }

    // ─── Minting ───────────────────────────────────────────────────────

    // slither-disable-next-line weak-prng,incorrect-equality
    function mint(address to) external payable nonReentrant {
        if (totalSupply >= maxSupply) revert SupplyExhausted();
        if (_availableURIs.length == 0) revert URIsNotLoaded();
        if (!mintSeedCommitted) revert MintSeedNotCommitted();
        if (msg.value < mintPrice) revert InsufficientPayment();

        uint256 tokenId = totalSupply;
        totalSupply += 1;

        uint256 remaining = _availableURIs.length;
        bytes32 bhash = blockhash(block.number - 1);
        if (bhash == bytes32(0)) revert BlockhashUnavailable();

        uint256 index = uint256(
            keccak256(abi.encodePacked(mintSeedCommitment, bhash, to, tokenId))
        ) % remaining;

        string memory chosenUri = _availableURIs[index];
        _availableURIs[index]   = _availableURIs[remaining - 1];
        _availableURIs.pop();

        _tokenURIs[tokenId] = chosenUri;

        bool justRevealed = false;
        if (_availableURIs.length == 0 && !revealed) {
            revealed      = true;
            justRevealed  = true;
        }

        uint256 excess = msg.value - mintPrice;

        _safeMint(to, tokenId);

        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert ExcessRefundFailed();
        }

        emit NFTMinted(to, tokenId, chosenUri);
        if (justRevealed) emit Revealed();
    }

    // ─── Views ─────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ─── Owner utilities ───────────────────────────────────────────────

    // slither-disable-next-line incorrect-equality
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        emit Withdrawn(owner(), amount);
    }
}
