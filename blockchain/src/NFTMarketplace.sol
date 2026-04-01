// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
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

    /// @notice Default offer validity period
    uint256 public constant OFFER_DURATION = 7 days;

    /// @notice On-chain listing data
    struct Listing {
        address seller;
        uint256 price;
        bool    active;
    }

    /// @notice On-chain offer data (buyer ETH is held in escrow)
    struct Offer {
        address buyer;
        uint256 amount;
        uint256 expiresAt;
        bool    active;
    }

    /// @notice nftContract => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    /// @notice nftContract => tokenId => buyer => Offer
    mapping(address => mapping(uint256 => mapping(address => Offer))) public offers;

    /// @notice nftContract => tokenId => list of buyers that have placed offers
    mapping(address => mapping(uint256 => address[])) private _offerBuyers;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
    event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt);
    event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 amount);
    event OfferCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed buyer);
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);

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
            price:  price,
            active: true
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

        (, uint256 royaltyFee, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, listing.price);

        // Transfer NFT
        IERC721(nftContract).transferFrom(listing.seller, msg.sender, tokenId);

        // Pay seller
        (bool sellerPaid, ) = payable(listing.seller).call{value: sellerProceeds}("");
        require(sellerPaid, "Seller payment failed");

        // Pay royalties
        if (royaltyFee > 0) {
            try IERC2981(nftContract).royaltyInfo(tokenId, listing.price) returns (address receiver, uint256) {
                if (receiver != address(0)) {
                    (bool royaltyPaid, ) = payable(receiver).call{value: royaltyFee}("");
                    require(royaltyPaid, "Royalty payment failed");
                }
            } catch {}
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
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) != address(0), "Token does not exist");
        require(msg.value >= 0.0001 ether, "Minimum offer is 0.0001 ETH");
        require(nft.ownerOf(tokenId) != msg.sender, "Owner cannot offer on own NFT");
        require(!offers[nftContract][tokenId][msg.sender].active, "You already have an active offer on this NFT");

        uint256 expiresAt = block.timestamp + OFFER_DURATION;

        offers[nftContract][tokenId][msg.sender] = Offer({
            buyer:     msg.sender,
            amount:    msg.value,
            expiresAt: expiresAt,
            active:    true
        });

        _offerBuyers[nftContract][tokenId].push(msg.sender);

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

        (, uint256 royaltyFee, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, offer.amount);

        nft.transferFrom(msg.sender, buyer, tokenId);

        // Pay seller
        (bool sellerPaid, ) = payable(msg.sender).call{value: sellerProceeds}("");
        require(sellerPaid, "Seller payment failed");

        // Pay royalties
        if (royaltyFee > 0) {
            try IERC2981(nftContract).royaltyInfo(tokenId, offer.amount) returns (address receiver, uint256) {
                if (receiver != address(0)) {
                    (bool royaltyPaid, ) = payable(receiver).call{value: royaltyFee}("");
                    require(royaltyPaid, "Royalty payment failed");
                }
            } catch {}
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

        emit OfferCancelled(nftContract, tokenId, buyer);
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

    /// @notice Calculates marketplace fees and ERC-2981 royalties.
    /// @param nftContract Address of the ERC-721 collection.
    /// @param tokenId     Token ID (needed for royaltyInfo call).
    /// @param salePrice   Total sale price in wei.
    /// @return marketFee      Platform fee portion.
    /// @return royaltyFee     Creator royalty (0 if ERC-2981 not supported).
    /// @return sellerProceeds Net amount the seller receives.
    function _calculateFees(address nftContract, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (uint256 marketFee, uint256 royaltyFee, uint256 sellerProceeds)
    {
        marketFee  = (salePrice * marketplaceFee) / 10000;
        royaltyFee = 0;

        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (address, uint256 royaltyAmount) {
            royaltyFee = royaltyAmount;
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

    /// @notice Withdraws all accumulated platform fees to the owner.
    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }

    /// @notice Accepts ETH sent directly (accumulated fees via buyItem/acceptOffer).
    receive() external payable {}
}