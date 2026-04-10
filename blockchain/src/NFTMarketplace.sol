// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NFTMarketplace
/// @author CryptoMint
/// @notice A generic ERC-721 marketplace that supports listings, purchases,
///         offers, ERC-2981 royalties, and configurable platform fees.
/// @dev Integrates with NFTCollectionFactory — any collection created by the
///      factory can list, buy, make and accept offers here.  The marketplace
///      custodies offer ETH and collects a configurable fee (basis-points)
///      on every sale.
contract NFTMarketplace is Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Platform fee charged on every sale (basis points, e.g. 250 = 2.5%)
    uint256 public marketplaceFee = 250;

    /// @notice Accumulated platform fees available for withdrawal (separate from escrow)
    uint256 public accumulatedFees;

    /// @notice Default offer validity period
    uint256 public constant OFFER_DURATION = 7 days;

    /// @notice On-chain listing data (packed: 2 storage slots)
    /// Slot 1: seller (20 bytes) + active (1 byte) = 21 bytes
    /// Slot 2: price  (16 bytes, uint128 supports up to ~3.4e38 wei ≈ 340B ETH)
    struct Listing {
        address seller;   // 20 bytes ─┐
        bool    active;   //  1 byte  ─┘ slot 1
        uint128 price;    // 16 bytes ── slot 2
    }

    /// @notice On-chain offer data — buyer ETH is held in escrow (packed: 2 storage slots)
    /// Slot 1: buyer (20 bytes) + active (1 byte) + expiresAt (8 bytes) = 29 bytes
    /// Slot 2: amount (16 bytes, uint128)
    struct Offer {
        address buyer;      // 20 bytes ─┐
        bool    active;     //  1 byte   │ slot 1
        uint64  expiresAt;  //  8 bytes ─┘
        uint128 amount;     // 16 bytes ── slot 2
    }

    /// @notice nftContract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    /// @notice nftContract => tokenId => buyer => Offer
    mapping(address => mapping(uint256 => mapping(address => Offer))) public offers;

    /// @notice nftContract => tokenId => list of buyers that have placed offers
    mapping(address => mapping(uint256 => address[])) private _offerBuyers;

    /// @notice Tracks whether a buyer is already in _offerBuyers to prevent duplicates
    mapping(address => mapping(uint256 => mapping(address => bool))) private _isOfferBuyer;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
    event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt);
    event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 amount);
    event OfferCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed buyer);
    event OfferExpiredRefund(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount);
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Marketplace — Listing
    // ─────────────────────────────────────────────

    /// @notice Lists an ERC-721 NFT for sale at a fixed price.
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID to list.
    /// @param price       Asking price in wei (minimum 0.0001 ETH).
    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        require(
            IERC165(nftContract).supportsInterface(type(IERC721).interfaceId),
            "Contract does not support ERC-721"
        );
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) == msg.sender, "Not the NFT owner");
        require(price >= 0.0001 ether, "Minimum price is 0.0001 ETH");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to transfer this NFT"
        );
        require(!listings[nftContract][tokenId].active, "NFT is already listed");

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            active: true,
            price:  uint128(price)
        });

        emit ItemListed(nftContract, tokenId, msg.sender, price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Purchase
    // ─────────────────────────────────────────────

    /// @notice Buys a listed NFT.  Respects ERC-2981 royalties when implemented.
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID to buy.
    function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];

        require(listing.active, "NFT is not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Seller cannot buy own NFT");

        delete listings[nftContract][tokenId];

        (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, listing.price);

        // Track platform fees separately from escrow
        accumulatedFees += marketFee;

        // Transfer NFT (safe transfer to prevent locking in non-receiver contracts)
        IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

        // Pay seller
        (bool sellerPaid, ) = payable(listing.seller).call{value: sellerProceeds}("");
        require(sellerPaid, "Seller payment failed");

        // Pay royalties — if transfer fails, return royalty to seller instead of trapping ETH
        if (royaltyFee > 0) {
            if (royaltyReceiver != address(0)) {
                (bool royaltyPaid, ) = payable(royaltyReceiver).call{value: royaltyFee}("");
                if (!royaltyPaid) {
                    (bool fallbackPaid, ) = payable(listing.seller).call{value: royaltyFee}("");
                    require(fallbackPaid, "Royalty fallback to seller failed");
                }
            } else {
                // No valid receiver — return royalty portion to seller
                (bool fallbackPaid, ) = payable(listing.seller).call{value: royaltyFee}("");
                require(fallbackPaid, "Royalty fallback to seller failed");
            }
        }

        // Refund excess
        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Excess refund failed");
        }

        emit ItemSold(nftContract, tokenId, listing.seller, msg.sender, listing.price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Cancel listing
    // ─────────────────────────────────────────────

    /// @notice Cancels an active listing.  May be called by the seller or
    ///         the marketplace owner (admin override).
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID.
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing memory listing = listings[nftContract][tokenId];

        require(listing.active, "NFT is not listed");
        require(listing.seller == msg.sender || msg.sender == owner(), "Not authorized to cancel");

        delete listings[nftContract][tokenId];

        emit ListingCancelled(nftContract, tokenId, listing.seller);
    }

    // ─────────────────────────────────────────────
    // Offers — Make offer
    // ─────────────────────────────────────────────

    /// @notice Places an offer on any minted NFT.  The ETH sent with this
    ///         call is held in escrow by the marketplace until the offer is
    ///         accepted, cancelled, or reclaimed after expiry.
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID.
    function makeOffer(address nftContract, uint256 tokenId) external payable nonReentrant {
        require(
            IERC165(nftContract).supportsInterface(type(IERC721).interfaceId),
            "Contract does not support ERC-721"
        );
        IERC721 nft = IERC721(nftContract);

        address tokenOwner = nft.ownerOf(tokenId);
        require(tokenOwner != address(0), "Token does not exist");
        require(msg.value >= 0.0001 ether, "Minimum offer is 0.0001 ETH");
        require(tokenOwner != msg.sender, "Owner cannot offer on own NFT");

        // Auto-refund expired offer: if the caller has an active but expired
        // offer, refund it automatically so a new offer can be placed.
        Offer memory existing = offers[nftContract][tokenId][msg.sender];
        if (existing.active) {
            require(block.timestamp > existing.expiresAt, "You already have an active offer on this NFT");

            delete offers[nftContract][tokenId][msg.sender];

            (bool refunded, ) = payable(msg.sender).call{value: existing.amount}("");
            require(refunded, "Expired offer refund failed");

            emit OfferExpiredRefund(nftContract, tokenId, msg.sender, existing.amount);
        }

        uint256 expiresAt = block.timestamp + OFFER_DURATION;

        offers[nftContract][tokenId][msg.sender] = Offer({
            buyer:     msg.sender,
            active:    true,
            expiresAt: uint64(expiresAt),
            amount:    uint128(msg.value)
        });

        if (!_isOfferBuyer[nftContract][tokenId][msg.sender]) {
            _offerBuyers[nftContract][tokenId].push(msg.sender);
            _isOfferBuyer[nftContract][tokenId][msg.sender] = true;
        }

        emit OfferMade(nftContract, tokenId, msg.sender, msg.value, expiresAt);
    }

    // ─────────────────────────────────────────────
    // Offers — Accept offer
    // ─────────────────────────────────────────────

    /// @notice Accepts a specific buyer's offer on an NFT the caller owns.
    ///         If the NFT was also listed, the listing is cancelled automatically.
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID.
    /// @param buyer       Address of the buyer whose offer will be accepted.
    function acceptOffer(address nftContract, uint256 tokenId, address buyer) external nonReentrant {
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) == msg.sender, "Not the NFT owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to transfer this NFT"
        );

        Offer memory offer = offers[nftContract][tokenId][buyer];
        require(offer.active, "Offer is not active");
        require(block.timestamp <= offer.expiresAt, "Offer has expired");

        delete offers[nftContract][tokenId][buyer];

        if (listings[nftContract][tokenId].active) {
            delete listings[nftContract][tokenId];
            emit ListingCancelled(nftContract, tokenId, msg.sender);
        }

        (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, offer.amount);

        // Track platform fees separately from escrow
        accumulatedFees += marketFee;

        // Transfer NFT (safe transfer to prevent locking in non-receiver contracts)
        nft.safeTransferFrom(msg.sender, buyer, tokenId);

        // Pay seller
        (bool sellerPaid, ) = payable(msg.sender).call{value: sellerProceeds}("");
        require(sellerPaid, "Seller payment failed");

        // Pay royalties — if transfer fails, return royalty to seller instead of trapping ETH
        if (royaltyFee > 0) {
            if (royaltyReceiver != address(0)) {
                (bool royaltyPaid, ) = payable(royaltyReceiver).call{value: royaltyFee}("");
                if (!royaltyPaid) {
                    (bool fallbackPaid, ) = payable(msg.sender).call{value: royaltyFee}("");
                    require(fallbackPaid, "Royalty fallback to seller failed");
                }
            } else {
                (bool fallbackPaid, ) = payable(msg.sender).call{value: royaltyFee}("");
                require(fallbackPaid, "Royalty fallback to seller failed");
            }
        }

        emit OfferAccepted(nftContract, tokenId, msg.sender, buyer, offer.amount);
    }

    // ─────────────────────────────────────────────
    // Offers — Cancel offer
    // ─────────────────────────────────────────────

    /// @notice Cancels the caller's active offer and refunds escrowed ETH.
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID.
    function cancelOffer(address nftContract, uint256 tokenId) external nonReentrant {
        Offer memory offer = offers[nftContract][tokenId][msg.sender];
        require(offer.active, "You have no active offer on this NFT");

        delete offers[nftContract][tokenId][msg.sender];

        (bool refunded, ) = payable(msg.sender).call{value: offer.amount}("");
        require(refunded, "Refund failed");

        emit OfferCancelled(nftContract, tokenId, msg.sender);
    }

    /// @notice Allows anyone to reclaim ETH from an expired offer back to
    ///         the original buyer.
    /// @param nftContract Address of the ERC-721 collection contract.
    /// @param tokenId     Token ID.
    /// @param buyer       Address of the original offer maker.
    function reclaimExpiredOffer(address nftContract, uint256 tokenId, address buyer) external nonReentrant {
        Offer memory offer = offers[nftContract][tokenId][buyer];
        require(offer.active, "Offer is not active");
        require(block.timestamp > offer.expiresAt, "Offer has not expired yet");

        delete offers[nftContract][tokenId][buyer];

        (bool refunded, ) = payable(buyer).call{value: offer.amount}("");
        require(refunded, "Refund failed");

        emit OfferExpiredRefund(nftContract, tokenId, buyer, offer.amount);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns the listing for a specific NFT.
    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }

    /// @notice Returns a buyer's offer for a specific NFT.
    function getOffer(address nftContract, uint256 tokenId, address buyer) external view returns (Offer memory) {
        return offers[nftContract][tokenId][buyer];
    }

    /// @notice Returns all historical offer-maker addresses for a specific NFT.
    function getOfferBuyers(address nftContract, uint256 tokenId) external view returns (address[] memory) {
        return _offerBuyers[nftContract][tokenId];
    }

    // ─────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────

    /// @notice Calculates marketplace fees and ERC-2981 royalties in a single call.
    /// @param nftContract Address of the ERC-721 collection.
    /// @param tokenId     Token ID (needed for royaltyInfo call).
    /// @param salePrice   Total sale price in wei.
    /// @return marketFee        Platform fee portion.
    /// @return royaltyFee       Creator royalty (0 if ERC-2981 not supported).
    /// @return royaltyReceiver  Address to send royalty payment (address(0) if none).
    /// @return sellerProceeds   Net amount the seller receives.
    function _calculateFees(address nftContract, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds)
    {
        marketFee  = (salePrice * marketplaceFee) / 10000;
        royaltyFee = 0;
        royaltyReceiver = address(0);

        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (address receiver, uint256 royaltyAmount) {
            royaltyFee = royaltyAmount;
            royaltyReceiver = receiver;
        } catch {}

        require(marketFee + royaltyFee <= salePrice, "Fees exceed sale price");

        sellerProceeds = salePrice - marketFee - royaltyFee;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /// @notice Updates the marketplace fee (max 10% = 1000 basis points).
    /// @param newFee New fee in basis points (e.g. 250 = 2.5%).
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Maximum fee is 10%");
        uint256 oldFee = marketplaceFee;
        marketplaceFee = newFee;
        emit MarketplaceFeeUpdated(oldFee, newFee);
    }

    /// @notice Withdraws accumulated platform fees to the owner.
    ///         Only withdraws tracked fees — escrowed offer funds are never touched.
    function withdraw() external onlyOwner {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        accumulatedFees = 0;
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FeesWithdrawn(owner(), amount);
    }

    /// @notice Returns the total ETH held in escrow for active offers.
    function totalEscrow() external view returns (uint256) {
        return address(this).balance - accumulatedFees;
    }
}