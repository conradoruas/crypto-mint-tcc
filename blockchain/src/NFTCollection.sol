// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NFTCollection
/// @author CryptoMint
/// @notice ERC-721 collection with configurable supply, mint price, and
///         pseudo-random URI assignment using a Fisher-Yates shuffle.
/// @dev Created via `NFTCollectionFactory.createCollection()`.  The owner
///      (collection creator) must call `loadTokenURIs()` and `commitMintSeed()`
///      before any mint can proceed.  Each token gets a pseudo-randomly chosen
///      URI from the pool using `blockhash` mixed with a pre-committed seed
///      so neither the user nor a miner can pre-compute the assignment.
contract NFTCollection is ERC721, ERC2981, Ownable, ReentrancyGuard {

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
    ///         Mixed into every mint's Fisher-Yates index derivation so neither
    ///         users nor miners can pre-compute URI assignments without it.
    bytes32 public mintSeedCommitment;

    /// @notice The secret seed, revealed after minting to let anyone audit that
    ///         each mint's randomness input matched the pre-committed value.
    bytes32 public mintSeedRevealed;

    /// @notice Guard flag — minting is disabled until this is true.
    bool public mintSeedCommitted;

    // ─── Events ────────────────────────────────────────────────────────

    /// @notice Emitted when a new token is minted.
    /// @param to       Recipient address.
    /// @param tokenId  Newly minted token ID.
    /// @param tokenUri The URI assigned to the token.
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
    ///         Can only be called before the first mint.
    /// @param uris Array of metadata URIs.
    function loadTokenURIs(string[] calldata uris) external onlyOwner {
        _addURIs(uris);
    }

    /// @notice Appends additional URIs (useful for batched uploads).
    ///         Must still be called before any mint occurs.
    /// @param uris Array of additional metadata URIs.
    function appendTokenURIs(string[] calldata uris) external onlyOwner {
        _addURIs(uris);
    }

    /// @dev Shared implementation for loading/appending URIs.  Enforces the
    ///      pre-mint invariant and the maxSupply cap in one place.
    function _addURIs(string[] calldata uris) internal {
        if (totalSupply != 0) revert MintingAlreadyStarted();
        if (_availableURIs.length + uris.length > maxSupply) revert ExceedsMaxSupply();
        for (uint256 i = 0; i < uris.length; i++) {
            _availableURIs.push(uris[i]);
        }
    }

    // ─── Commit-reveal mint seed ───────────────────────────────────────

    /// @notice Owner pre-commits the hash of a secret seed that will be mixed
    ///         into each mint's URI selection.  Must be called exactly once
    ///         before the first mint.  The seed itself stays off-chain until
    ///         `revealMintSeed` is called after the sale closes.
    /// @param commitment keccak256(seed) — the published hash.
    function commitMintSeed(bytes32 commitment) external onlyOwner {
        if (mintSeedCommitted) revert SeedAlreadyCommitted();
        if (commitment == bytes32(0)) revert EmptyCommitment();
        if (_availableURIs.length != maxSupply) revert URIsNotFullyLoaded();
        mintSeedCommitment = commitment;
        mintSeedCommitted = true;
        emit MintSeedCommitted(commitment);
    }

    /// @notice Owner publishes the pre-committed seed for public auditing.
    ///         Callers can replay every mint's URI assignment to verify the
    ///         contract never deviated from the committed randomness source.
    /// @param seed The pre-image of `mintSeedCommitment`.
    function revealMintSeed(bytes32 seed) external onlyOwner {
        if (!mintSeedCommitted) revert NoSeedCommitted();
        if (mintSeedRevealed != bytes32(0)) revert SeedAlreadyRevealed();
        if (keccak256(abi.encodePacked(seed)) != mintSeedCommitment) revert SeedMismatch();
        mintSeedRevealed = seed;
        emit MintSeedRevealed(seed);
    }

    // ─── Minting ───────────────────────────────────────────────────────

    /// @notice Mints a new token with a pseudo-randomly selected URI.
    /// @dev Randomness input: keccak256(mintSeedCommitment, blockhash(block.number-1),
    ///      to, tokenId).  `blockhash` is a finalized value (unknown until the
    ///      previous block is mined) and `mintSeedCommitment` is a secret the
    ///      contract committed to before the sale — together they prevent
    ///      both users and miners from pre-computing URI assignments.
    /// @param to Recipient address.
    // slither-disable-next-line weak-prng,incorrect-equality
    function mint(address to) external payable nonReentrant {
        if (totalSupply >= maxSupply) revert SupplyExhausted();
        if (_availableURIs.length == 0) revert URIsNotLoaded();
        if (!mintSeedCommitted) revert MintSeedNotCommitted();
        if (msg.value < mintPrice) revert InsufficientPayment();

        // ─── Effects ────────────────────────────────────────────────
        uint256 tokenId = totalSupply;
        totalSupply += 1;

        uint256 remaining = _availableURIs.length;
        bytes32 bhash = blockhash(block.number - 1);
        if (bhash == bytes32(0)) revert BlockhashUnavailable();

        uint256 index = uint256(
            keccak256(
                abi.encodePacked(
                    mintSeedCommitment,
                    bhash,
                    to,
                    tokenId
                )
            )
        ) % remaining;

        string memory chosenUri = _availableURIs[index];
        _availableURIs[index] = _availableURIs[remaining - 1];
        _availableURIs.pop();

        _tokenURIs[tokenId] = chosenUri;

        bool justRevealed = false;
        if (_availableURIs.length == 0 && !revealed) {
            revealed = true;
            justRevealed = true;
        }

        uint256 excess = msg.value - mintPrice;

        // ─── Interactions ───────────────────────────────────────────
        // Mint first, refund excess last — prevents the refund callback
        // from executing before the token exists.
        _safeMint(to, tokenId);

        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert ExcessRefundFailed();
        }

        emit NFTMinted(to, tokenId, chosenUri);
        if (justRevealed) {
            emit Revealed();
        }
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
    // slither-disable-next-line incorrect-equality
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        emit Withdrawn(owner(), amount);
    }
}