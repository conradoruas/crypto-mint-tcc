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

    // ─── Custom errors ──────────────────────────────
    error NotERC721();
    error NotNFTOwner();
    error PriceTooLow();
    error PriceExceedsUint128();
    error MarketplaceNotApproved();
    error AlreadyListed();
    error NotForSale();
    error IncorrectPayment();
    error SellerCannotBuyOwn();
    error GhostOfferRefundFailed();
    error NotListed();
    error NotAuthorizedToCancel();
    error TokenDoesNotExist();
    error OfferTooLow();
    error OfferExceedsUint128();
    error OwnerCannotOffer();
    error ActiveOfferExists();
    error OfferNotActive();
    error OfferExpired();
    error OfferNotExpired();
    error BountyPaymentFailed();
    error NothingToWithdraw();
    error WithdrawalFailed();
    error FeesExceedSalePrice();
    error MaxFeeExceeded();
    error NoFeesToWithdraw();

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Human-readable contract name (shown by MetaMask and block explorers)
    string public constant name = "CryptoMint Marketplace";

    /// @notice Platform fee charged on every sale (basis points, e.g. 250 = 2.5%)
    uint256 public marketplaceFee = 250;

    /// @notice Accumulated platform fees available for withdrawal (separate from escrow)
    uint256 public accumulatedFees;

    /// @notice Default offer validity period
    uint256 public constant OFFER_DURATION = 7 days;

    /// @notice Hard cap for ERC-2981 royalties (10%).  Protects sellers from
    ///         malicious collections that return absurd royaltyInfo values.
    uint256 public constant MAX_ROYALTY_BPS = 1000;

    /// @notice Gas forwarded to external ERC-2981 `royaltyInfo` calls.  Enough
    ///         for a normal storage read, not enough for a gas bomb.
    uint256 private constant ROYALTY_INFO_GAS = 30_000;

    /// @notice Bounty paid to a third party that reclaims an expired offer
    ///         for the original buyer (basis points of refund amount).
    ///         Creates an economic incentive for permissionless cleanup.
    uint256 public constant RECLAIM_BOUNTY_BPS = 50; // 0.5%

    /// @notice On-chain listing data (packed: 2 storage slots)
    struct Listing {
        address seller;   // 20 bytes ─┐
        bool    active;   //  1 byte  ─┘ slot 1
        uint128 price;    // 16 bytes ── slot 2
    }

    /// @notice On-chain offer data — buyer ETH is held in escrow (packed: 2 storage slots)
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

    /// @notice nftContract => tokenId => list of active-offer buyers
    mapping(address => mapping(uint256 => address[])) private _offerBuyers;

    /// @notice nftContract => tokenId => buyer => (index+1) in _offerBuyers (0 = absent).
    ///         Enables O(1) swap-and-pop removal when an offer is finalized.
    mapping(address => mapping(uint256 => mapping(address => uint256))) private _offerBuyerIndex;

    /// @notice Pull-payment ledger for recipients that cannot receive ETH
    ///         via a push `.call` (e.g. royalty receivers that revert on receive).
    ///         Prevents griefing and royalty evasion.
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Sum of all `pendingWithdrawals` — lets `totalEscrow()` stay accurate.
    uint256 public totalPendingWithdrawals;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingPriceUpdated(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 oldPrice, uint256 newPrice);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller);
    event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiresAt);
    event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 amount);
    event OfferCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed buyer);
    event OfferExpiredRefund(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount);
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event RoyaltyPaid(address indexed receiver, uint256 amount);
    event RoyaltyPending(address indexed receiver, uint256 amount);
    event PendingWithdrawn(address indexed receiver, uint256 amount);
    event ReclaimBountyPaid(address indexed caller, address indexed buyer, uint256 amount);
    event ExpiredOffersPruned(address indexed nftContract, uint256 indexed tokenId, uint256 prunedCount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Marketplace — Listing
    // ─────────────────────────────────────────────

    /// @notice Lists an ERC-721 NFT for sale at a fixed price.
    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        if (!IERC165(nftContract).supportsInterface(type(IERC721).interfaceId)) revert NotERC721();
        IERC721 nft = IERC721(nftContract);

        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        if (price < 0.0001 ether) revert PriceTooLow();
        if (price > type(uint128).max) revert PriceExceedsUint128();
        if (
            nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(msg.sender, address(this))
        ) revert MarketplaceNotApproved();
        if (listings[nftContract][tokenId].active) revert AlreadyListed();

        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            active: true,
            price:  uint128(price)
        });

        emit ItemListed(nftContract, tokenId, msg.sender, price);
    }

    /// @notice Updates the price of an active listing without cancelling it.
    ///         Avoids the cancel-then-relist gap that could be front-run.
    function updateListingPrice(address nftContract, uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[nftContract][tokenId];
        if (!listing.active) revert NotListed();
        if (listing.seller != msg.sender) revert NotNFTOwner();
        if (newPrice < 0.0001 ether) revert PriceTooLow();
        if (newPrice > type(uint128).max) revert PriceExceedsUint128();

        uint256 oldPrice = listing.price;
        listing.price = uint128(newPrice);

        emit ListingPriceUpdated(nftContract, tokenId, msg.sender, oldPrice, newPrice);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Purchase
    // ─────────────────────────────────────────────

    /// @notice Buys a listed NFT.  Respects ERC-2981 royalties (capped at
    ///         MAX_ROYALTY_BPS) and falls back to pull-payment if the
    ///         royalty receiver rejects ETH.
    function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];

        if (!listing.active) revert NotForSale();
        if (msg.value != listing.price) revert IncorrectPayment();
        if (msg.sender == listing.seller) revert SellerCannotBuyOwn();

        delete listings[nftContract][tokenId];

        // Ghost-offer prevention: if the buyer has any active offer on this NFT,
        // clear it and stage a refund so their ETH isn't locked in escrow against
        // an NFT they now own.
        Offer memory buyerOffer = offers[nftContract][tokenId][msg.sender];
        uint256 ghostRefund = 0;
        if (buyerOffer.active) {
            ghostRefund = buyerOffer.amount;
            delete offers[nftContract][tokenId][msg.sender];
            _removeOfferBuyer(nftContract, tokenId, msg.sender);
        }

        (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, listing.price);

        unchecked { accumulatedFees += marketFee; }

        // 1) Pay seller — pull-payment fallback if receiver rejects ETH
        _paySeller(listing.seller, sellerProceeds);

        // 2) Pay royalty (pull-fallback if receiver cannot accept push)
        _payRoyalty(royaltyReceiver, royaltyFee);

        // 3) Refund ghost offer (if any) — state already cleared above
        if (ghostRefund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: ghostRefund}("");
            if (!refunded) revert GhostOfferRefundFailed();
            emit OfferCancelled(nftContract, tokenId, msg.sender);
        }

        // 4) Transfer NFT last (doc step 5).  Reverts if seller revoked approval.
        IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(nftContract, tokenId, listing.seller, msg.sender, listing.price);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Cancel listing
    // ─────────────────────────────────────────────

    /// @notice Cancels an active listing.  May be called by the seller or
    ///         the marketplace owner (admin override).
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing memory listing = listings[nftContract][tokenId];

        if (!listing.active) revert NotListed();
        if (listing.seller != msg.sender && msg.sender != owner()) revert NotAuthorizedToCancel();

        delete listings[nftContract][tokenId];

        emit ListingCancelled(nftContract, tokenId, listing.seller);
    }

    // ─────────────────────────────────────────────
    // Offers — Make offer
    // ─────────────────────────────────────────────

    /// @notice Places an offer on any minted NFT.  ETH is held in escrow.
    ///         If the caller already has an *expired* offer, it is refunded
    ///         automatically before the new offer is accepted.
    function makeOffer(address nftContract, uint256 tokenId) external payable nonReentrant {
        if (!IERC165(nftContract).supportsInterface(type(IERC721).interfaceId)) revert NotERC721();
        IERC721 nft = IERC721(nftContract);

        address tokenOwner = nft.ownerOf(tokenId);
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
        if (msg.value < 0.0001 ether) revert OfferTooLow();
        if (msg.value > type(uint128).max) revert OfferExceedsUint128();
        if (tokenOwner == msg.sender) revert OwnerCannotOffer();

        Offer memory existing = offers[nftContract][tokenId][msg.sender];
        uint256 expiredRefund = 0;
        if (existing.active) {
            if (block.timestamp <= existing.expiresAt) revert ActiveOfferExists();
            expiredRefund = existing.amount;
        }

        uint256 expiresAt = block.timestamp + OFFER_DURATION;

        // Effects — overwrite slot with new offer before any external interaction.
        offers[nftContract][tokenId][msg.sender] = Offer({
            buyer:     msg.sender,
            active:    true,
            expiresAt: uint64(expiresAt),
            amount:    uint128(msg.value)
        });
        _addOfferBuyer(nftContract, tokenId, msg.sender);

        // Interactions — CEI-compliant: state already written above.
        // Pull-payment fallback so a contract buyer that rejects ETH
        // can still replace expired offers.
        if (expiredRefund > 0) {
            pendingWithdrawals[msg.sender] += expiredRefund;
            totalPendingWithdrawals += expiredRefund;

            (bool refunded, ) = payable(msg.sender).call{value: expiredRefund}("");
            if (refunded) {
                pendingWithdrawals[msg.sender] -= expiredRefund;
                totalPendingWithdrawals -= expiredRefund;
            }
            emit OfferExpiredRefund(nftContract, tokenId, msg.sender, expiredRefund);
        }

        emit OfferMade(nftContract, tokenId, msg.sender, msg.value, expiresAt);
    }

    // ─────────────────────────────────────────────
    // Offers — Accept offer
    // ─────────────────────────────────────────────

    /// @notice Accepts a specific buyer's offer on an NFT the caller owns.
    ///         If the NFT was also listed, the listing is cancelled automatically.
    function acceptOffer(address nftContract, uint256 tokenId, address buyer) external nonReentrant {
        IERC721 nft = IERC721(nftContract);

        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        if (
            nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(msg.sender, address(this))
        ) revert MarketplaceNotApproved();

        Offer memory offer = offers[nftContract][tokenId][buyer];
        if (!offer.active) revert OfferNotActive();
        if (block.timestamp > offer.expiresAt) revert OfferExpired();

        // Effects
        delete offers[nftContract][tokenId][buyer];
        _removeOfferBuyer(nftContract, tokenId, buyer);

        if (listings[nftContract][tokenId].active) {
            delete listings[nftContract][tokenId];
            emit ListingCancelled(nftContract, tokenId, msg.sender);
        }

        (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds) =
            _calculateFees(nftContract, tokenId, offer.amount);

        unchecked { accumulatedFees += marketFee; }

        // Interactions: pay seller, pay royalty, transfer NFT last.
        _paySeller(msg.sender, sellerProceeds);

        _payRoyalty(royaltyReceiver, royaltyFee);

        nft.safeTransferFrom(msg.sender, buyer, tokenId);

        emit OfferAccepted(nftContract, tokenId, msg.sender, buyer, offer.amount);
    }

    // ─────────────────────────────────────────────
    // Offers — Cancel / reclaim
    // ─────────────────────────────────────────────

    /// @notice Cancels the caller's active offer and refunds escrowed ETH.
    function cancelOffer(address nftContract, uint256 tokenId) external nonReentrant {
        Offer memory offer = offers[nftContract][tokenId][msg.sender];
        if (!offer.active) revert OfferNotActive();

        delete offers[nftContract][tokenId][msg.sender];
        _removeOfferBuyer(nftContract, tokenId, msg.sender);

        // Pull-payment fallback — prevents a contract-based buyer that
        // rejects ETH from being permanently unable to cancel.
        pendingWithdrawals[msg.sender] += offer.amount;
        totalPendingWithdrawals += offer.amount;

        (bool refunded, ) = payable(msg.sender).call{value: offer.amount}("");
        if (refunded) {
            pendingWithdrawals[msg.sender] -= offer.amount;
            totalPendingWithdrawals -= offer.amount;
        }

        emit OfferCancelled(nftContract, tokenId, msg.sender);
    }

    /// @notice Allows anyone to reclaim ETH from an expired offer back to
    ///         the original buyer.  If the caller is a third party (not the
    ///         buyer), a small bounty is taken from the refund to reward
    ///         permissionless cleanup.
    function reclaimExpiredOffer(address nftContract, uint256 tokenId, address buyer) external nonReentrant {
        Offer memory offer = offers[nftContract][tokenId][buyer];
        if (!offer.active) revert OfferNotActive();
        if (block.timestamp <= offer.expiresAt) revert OfferNotExpired();

        delete offers[nftContract][tokenId][buyer];
        _removeOfferBuyer(nftContract, tokenId, buyer);

        uint256 bounty = 0;
        uint256 refund = offer.amount;
        if (msg.sender != buyer) {
            bounty = (uint256(offer.amount) * RECLAIM_BOUNTY_BPS) / 10000;
            refund = offer.amount - bounty;
        }

        // Pull-payment fallback for the buyer refund
        pendingWithdrawals[buyer] += refund;
        totalPendingWithdrawals += refund;

        (bool refunded, ) = payable(buyer).call{value: refund}("");
        if (refunded) {
            pendingWithdrawals[buyer] -= refund;
            totalPendingWithdrawals -= refund;
        }

        if (bounty > 0) {
            (bool bountyPaid, ) = payable(msg.sender).call{value: bounty}("");
            if (!bountyPaid) revert BountyPaymentFailed();
            emit ReclaimBountyPaid(msg.sender, buyer, bounty);
        }

        emit OfferExpiredRefund(nftContract, tokenId, buyer, offer.amount);
    }

    /// @notice Permissionlessly refund every expired offer on an NFT in one call.
    ///         Pays the caller a bounty from each refunded offer (see
    ///         `RECLAIM_BOUNTY_BPS`).  A buyer whose refund `call` reverts is
    ///         credited via the pull-payment ledger instead of bricking the loop.
    /// @param nftContract   NFT contract address.
    /// @param tokenId       Token id.
    /// @param maxIterations Hard cap on how many buyers to inspect this call
    ///                      (0 = unbounded).  Pass a finite value to stay
    ///                      under the block gas limit on crowded tokens.
    /// @return pruned Number of offers actually pruned.
    function pruneExpiredOffers(
        address nftContract,
        uint256 tokenId,
        uint256 maxIterations
    ) external nonReentrant returns (uint256 pruned) {
        address[] storage buyers = _offerBuyers[nftContract][tokenId];
        uint256 cap = maxIterations == 0 ? type(uint256).max : maxIterations;
        uint256 inspected = 0;
        uint256 i = 0;

        while (i < buyers.length && inspected < cap) {
            address buyer = buyers[i];
            Offer memory offer = offers[nftContract][tokenId][buyer];

            if (offer.active && block.timestamp > offer.expiresAt) {
                // Effects
                delete offers[nftContract][tokenId][buyer];
                _removeOfferBuyer(nftContract, tokenId, buyer);
                // Do not advance i — swap-and-pop placed a new element at this slot.

                uint256 bounty = (uint256(offer.amount) * RECLAIM_BOUNTY_BPS) / 10000;
                uint256 refund = offer.amount - bounty;

                // Effect: optimistically credit the buyer's pull-payment ledger
                // before any external call.  CEI-safe even if the guard on this
                // function is ever removed.
                pendingWithdrawals[buyer] += refund;
                totalPendingWithdrawals += refund;

                // Interaction: try push refund; on success, undo the credit.
                // A rejecting buyer keeps the credit and can `withdrawPending`
                // themselves — one bad buyer can't brick the whole batch.
                (bool r, ) = payable(buyer).call{value: refund}("");
                if (r) {
                    pendingWithdrawals[buyer] -= refund;
                    totalPendingWithdrawals -= refund;
                }

                if (bounty > 0) {
                    (bool b, ) = payable(msg.sender).call{value: bounty}("");
                    if (!b) revert BountyPaymentFailed();
                    emit ReclaimBountyPaid(msg.sender, buyer, bounty);
                }

                emit OfferExpiredRefund(nftContract, tokenId, buyer, offer.amount);
                pruned += 1;
            } else {
                i += 1;
            }
            inspected += 1;
        }

        if (pruned > 0) {
            emit ExpiredOffersPruned(nftContract, tokenId, pruned);
        }
    }

    // ─────────────────────────────────────────────
    // Pull payments
    // ─────────────────────────────────────────────

    /// @notice Withdraws ETH credited to the caller via the pull-payment
    ///         ledger (e.g. royalty receivers that rejected a push).
    function withdrawPending() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        totalPendingWithdrawals -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert WithdrawalFailed();

        emit PendingWithdrawn(msg.sender, amount);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }

    function getOffer(address nftContract, uint256 tokenId, address buyer) external view returns (Offer memory) {
        return offers[nftContract][tokenId][buyer];
    }

    /// @notice Returns the currently tracked offer-maker addresses for a specific NFT.
    ///         Entries are removed when offers are accepted, cancelled or reclaimed.
    function getOfferBuyers(address nftContract, uint256 tokenId) external view returns (address[] memory) {
        return _offerBuyers[nftContract][tokenId];
    }

    /// @notice Paginated variant of `getOfferBuyers` — safe to call on tokens
    ///         with many historical offers without hitting RPC gas/size limits.
    /// @param nftContract NFT contract address.
    /// @param tokenId     Token id.
    /// @param start       Starting index into the buyer list.
    /// @param count       Maximum number of entries to return.
    /// @return page  Slice of buyer addresses [start, start+count).
    /// @return total Total number of tracked buyers (for client-side paging).
    function getOfferBuyersPaginated(
        address nftContract,
        uint256 tokenId,
        uint256 start,
        uint256 count
    ) external view returns (address[] memory page, uint256 total) {
        address[] storage list = _offerBuyers[nftContract][tokenId];
        total = list.length;
        if (start >= total || count == 0) {
            return (new address[](0), total);
        }
        uint256 end = start + count;
        if (end > total) end = total;
        uint256 len = end - start;
        page = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            page[i] = list[start + i];
        }
    }

    /// @notice Total ETH held in escrow for active offers (excludes fees and pull-payments).
    function totalEscrow() external view returns (uint256) {
        return address(this).balance - accumulatedFees - totalPendingWithdrawals;
    }

    // ─────────────────────────────────────────────
    // Internal — fees, royalties, offer-buyer index
    // ─────────────────────────────────────────────

    /// @notice Calculates marketplace fees and ERC-2981 royalties.
    /// @dev Uses `staticcall` with a hard gas ceiling so a malicious
    ///      `royaltyInfo` implementation cannot burn arbitrary gas.  The
    ///      returned royalty is capped at `MAX_ROYALTY_BPS`.
    function _calculateFees(address nftContract, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (uint256 marketFee, uint256 royaltyFee, address royaltyReceiver, uint256 sellerProceeds)
    {
        marketFee = (salePrice * marketplaceFee) / 10000;

        (bool ok, bytes memory data) = nftContract.staticcall{gas: ROYALTY_INFO_GAS}(
            abi.encodeWithSelector(IERC2981.royaltyInfo.selector, tokenId, salePrice)
        );
        if (ok && data.length >= 64) {
            (address receiver, uint256 amount) = abi.decode(data, (address, uint256));
            if (receiver != address(0) && amount > 0) {
                uint256 maxRoyalty = (salePrice * MAX_ROYALTY_BPS) / 10000;
                if (amount > maxRoyalty) amount = maxRoyalty;
                royaltyReceiver = receiver;
                royaltyFee = amount;
            }
        }

        if (marketFee + royaltyFee > salePrice) revert FeesExceedSalePrice();
        sellerProceeds = salePrice - marketFee - royaltyFee;
    }

    /// @notice Pays seller via push; falls back to pull-payment ledger if
    ///         the seller rejects ETH.  Prevents a rejecting seller from
    ///         bricking purchases on their listings.
    function _paySeller(address seller, uint256 amount) internal {
        if (amount == 0) return;

        pendingWithdrawals[seller] += amount;
        totalPendingWithdrawals += amount;

        (bool paid, ) = payable(seller).call{value: amount}("");
        if (paid) {
            pendingWithdrawals[seller] -= amount;
            totalPendingWithdrawals -= amount;
        }
    }

    /// @notice Pays royalty via push; falls back to pull-payment ledger if
    ///         the receiver rejects.  Never returns royalty to the seller —
    ///         that would let malicious sellers evade royalties by deploying
    ///         rejecting receiver contracts.
    /// @dev CEI-safe: the pull-payment ledger is credited *before* the push
    ///      attempt, then debited back on success.  This way the receiver
    ///      is never in a state where the contract owes them without the
    ///      accounting reflecting it, and the state-write-after-call on
    ///      the success path can't be exploited via reentrancy because the
    ///      receiver already has a pending balance when `call` returns.
    function _payRoyalty(address receiver, uint256 amount) internal {
        if (amount == 0 || receiver == address(0)) return;

        // Effect: optimistically credit the pull-payment ledger.
        pendingWithdrawals[receiver] += amount;
        totalPendingWithdrawals += amount;

        // Interaction: try push; on success, undo the credit.
        (bool paid, ) = payable(receiver).call{value: amount}("");
        if (paid) {
            pendingWithdrawals[receiver] -= amount;
            totalPendingWithdrawals -= amount;
            emit RoyaltyPaid(receiver, amount);
        } else {
            emit RoyaltyPending(receiver, amount);
        }
    }

    function _addOfferBuyer(address nftContract, uint256 tokenId, address buyer) internal {
        if (_offerBuyerIndex[nftContract][tokenId][buyer] != 0) return;
        _offerBuyers[nftContract][tokenId].push(buyer);
        _offerBuyerIndex[nftContract][tokenId][buyer] = _offerBuyers[nftContract][tokenId].length;
    }

    function _removeOfferBuyer(address nftContract, uint256 tokenId, address buyer) internal {
        uint256 idx = _offerBuyerIndex[nftContract][tokenId][buyer];
        if (idx == 0) return;

        address[] storage list = _offerBuyers[nftContract][tokenId];
        uint256 lastIdx = list.length;

        if (idx != lastIdx) {
            address last = list[lastIdx - 1];
            list[idx - 1] = last;
            _offerBuyerIndex[nftContract][tokenId][last] = idx;
        }
        list.pop();
        _offerBuyerIndex[nftContract][tokenId][buyer] = 0;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /// @notice Updates the marketplace fee (max 10% = 1000 basis points).
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        if (newFee > 1000) revert MaxFeeExceeded();
        uint256 oldFee = marketplaceFee;
        marketplaceFee = newFee;
        emit MarketplaceFeeUpdated(oldFee, newFee);
    }

    /// @notice Withdraws accumulated platform fees to the owner.
    ///         Only withdraws tracked fees — escrowed offer funds are never touched.
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        accumulatedFees = 0;
        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert WithdrawalFailed();

        emit FeesWithdrawn(owner(), amount);
    }
}
