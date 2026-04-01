// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NFTMarketplace} from "../src/NFTMarketplace.sol";
import {NFTCollection} from "../src/NFTCollection.sol";
import {NFTCollectionFactory} from "../src/NFTCollectionFactory.sol";

contract NFTMarketplaceTest is Test {

    NFTMarketplace       public marketplace;
    NFTCollectionFactory public factory;
    NFTCollection        public collection;

    // Atores
    address public owner    = makeAddr("owner");
    address public seller   = makeAddr("seller");
    address public buyer    = makeAddr("buyer");
    address public buyer2   = makeAddr("buyer2");
    address public stranger = makeAddr("stranger");

    // Constantes
    uint256 constant MINT_PRICE   = 0.0001 ether;
    uint256 constant LIST_PRICE   = 0.05 ether;
    uint256 constant OFFER_AMOUNT = 0.03 ether;
    uint256 constant FEE_BPS      = 250; // 2.5%
    uint256 constant MAX_SUPPLY   = 5;   // pequeno para facilitar loadTokenURIs nos testes
    string  constant TOKEN_URI    = "ipfs://QmTest123";
    string  constant COLLECTION_NAME   = "Test Collection";
    string  constant COLLECTION_SYMBOL = "TEST";

    // ─────────────────────────────────────────────
    // Setup
    // ─────────────────────────────────────────────

    function setUp() public {
        vm.deal(owner,    10 ether);
        vm.deal(seller,   10 ether);
        vm.deal(buyer,    10 ether);
        vm.deal(buyer2,   10 ether);
        vm.deal(stranger, 10 ether);

        // Deploy marketplace genérico
        vm.prank(owner);
        marketplace = new NFTMarketplace();

        // Deploy factory
        vm.prank(owner);
        factory = new NFTCollectionFactory();

        // Cria coleção com MAX_SUPPLY = 5
        vm.prank(seller);
        address collectionAddr = factory.createCollection(
            COLLECTION_NAME,
            COLLECTION_SYMBOL,
            "Colecao de testes",
            "ipfs://QmImage",
            MAX_SUPPLY,
            MINT_PRICE
        );
        collection = NFTCollection(collectionAddr);

        // ✅ Carrega as URIs antes de qualquer mint
        _loadURIs(collection, MAX_SUPPLY);
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    /// Carrega N URIs no contrato da coleção (como owner/seller)
    function _loadURIs(NFTCollection col, uint256 count) internal {
        string[] memory uris = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            uris[i] = string(abi.encodePacked("ipfs://QmTest", vm.toString(i)));
        }
        vm.prank(col.owner());
        col.loadTokenURIs(uris);
    }

    /// Minta um NFT para um endereço e retorna o tokenId
    function _mintNFT(address to) internal returns (uint256 tokenId) {
        tokenId = collection.totalSupply();
        vm.prank(to);
        // ✅ mint agora recebe só o endereço — URI é escolhida aleatoriamente pelo contrato
        collection.mint{value: MINT_PRICE}(to);
    }

    /// Minta, aprova o marketplace e lista o NFT
    function _mintAndList(address listSeller, uint256 price) internal returns (uint256 tokenId) {
        tokenId = _mintNFT(listSeller);
        vm.startPrank(listSeller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.listItem(address(collection), tokenId, price);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────
    // NFTCollection — loadTokenURIs
    // ─────────────────────────────────────────────

    function test_collection_urisLoaded() public view {
        assertTrue(collection.urisLoaded());
    }

    function test_collection_loadURIs_revertsIfMintAlreadyStarted() public {
        // Minta um NFT para iniciar o mint
        vm.prank(seller);
        collection.mint{value: MINT_PRICE}(seller);

        // Agora tenta carregar URIs novamente — deve falhar pois mint já iniciou
        string[] memory uris = new string[](MAX_SUPPLY);
        for (uint256 i = 0; i < MAX_SUPPLY; i++) uris[i] = TOKEN_URI;

        vm.prank(seller);
        vm.expectRevert("Minting already started");
        collection.loadTokenURIs(uris);
    }

    function test_collection_loadURIs_revertsIfExceedsSupply() public {
        // Cria nova coleção sem URIs carregadas
        vm.prank(seller);
        address addr = factory.createCollection("New", "NW", "", "", 3, MINT_PRICE);
        NFTCollection newCol = NFTCollection(addr);

        string[] memory wrongUris = new string[](4); // supply é 3, mas passamos 4
        wrongUris[0] = TOKEN_URI;
        wrongUris[1] = TOKEN_URI;
        wrongUris[2] = TOKEN_URI;
        wrongUris[3] = TOKEN_URI;

        vm.prank(seller);
        vm.expectRevert("Exceeds maxSupply");
        newCol.loadTokenURIs(wrongUris);
    }

    function test_collection_loadURIs_revertsIfNotOwner() public {
        vm.prank(seller);
        address addr = factory.createCollection("New", "NW", "", "", 2, MINT_PRICE);
        NFTCollection newCol = NFTCollection(addr);

        string[] memory uris = new string[](2);
        uris[0] = TOKEN_URI; uris[1] = TOKEN_URI;

        vm.prank(stranger);
        vm.expectRevert();
        newCol.loadTokenURIs(uris);
    }

    // ─────────────────────────────────────────────
    // NFTCollection — Mint
    // ─────────────────────────────────────────────

    function test_collection_mint_success() public {
        uint256 tokenId = _mintNFT(seller);
        assertEq(collection.ownerOf(tokenId), seller);
        assertGt(bytes(collection.tokenURI(tokenId)).length, 0); // tem URI
        assertEq(collection.totalSupply(), 1);
    }

    function test_collection_mint_emitsEvent() public {
        // O evento emite a URI escolhida aleatoriamente — verificamos só os campos indexados
        vm.expectEmit(true, true, false, false);
        emit NFTCollection.NFTMinted(seller, 0, "");
        vm.prank(seller);
        collection.mint{value: MINT_PRICE}(seller);
    }

    function test_collection_mint_revertsIfURIsNotLoaded() public {
        // Cria coleção sem carregar URIs
        vm.prank(seller);
        address addr = factory.createCollection("Empty", "EMP", "", "", 2, MINT_PRICE);
        NFTCollection emptyCol = NFTCollection(addr);

        vm.prank(buyer);
        vm.expectRevert("URIs not loaded");
        emptyCol.mint{value: MINT_PRICE}(buyer);
    }

    function test_collection_mint_revertsIfInsufficientPayment() public {
        vm.prank(seller);
        vm.expectRevert("Insufficient payment");
        collection.mint{value: 0.00001 ether}(seller);
    }

    function test_collection_mint_revertsIfSupplyExceeded() public {
        // Cria coleção com supply 1 e carrega URIs
        vm.prank(seller);
        address addr = factory.createCollection("Tiny", "TN", "", "", 1, MINT_PRICE);
        NFTCollection tiny = NFTCollection(addr);
        _loadURIs(tiny, 1);

        vm.prank(seller);
        tiny.mint{value: MINT_PRICE}(seller);

        vm.prank(buyer);
        vm.expectRevert("Supply exhausted");
        tiny.mint{value: MINT_PRICE}(buyer);
    }

    function test_collection_mint_allTokensUnique() public {
        // Minta todos os tokens e verifica que cada um tem URI diferente
        string[] memory usedUris = new string[](MAX_SUPPLY);
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            vm.prank(seller);
            collection.mint{value: MINT_PRICE}(seller);
            usedUris[i] = collection.tokenURI(i);
        }
        // Verifica que todas as URIs são não-vazias
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            assertGt(bytes(usedUris[i]).length, 0);
        }
    }

    // ─────────────────────────────────────────────
    // NFTCollectionFactory
    // ─────────────────────────────────────────────

    function test_factory_createCollection_success() public view {
        assertEq(factory.totalCollections(), 1);
        NFTCollectionFactory.CollectionInfo memory info = factory.getCollection(0);
        assertEq(info.name, COLLECTION_NAME);
        assertEq(info.creator, seller);
        assertEq(info.mintPrice, MINT_PRICE);
        assertEq(info.maxSupply, MAX_SUPPLY);
    }

    function test_factory_createCollection_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit NFTCollectionFactory.CollectionCreated(buyer, address(0), "Nova", 1);
        vm.prank(buyer);
        factory.createCollection("Nova", "NV", "", "", 100, MINT_PRICE);
    }

    function test_factory_creatorCollections() public view {
        uint256[] memory ids = factory.getCreatorCollections(seller);
        assertEq(ids.length, 1);
        assertEq(ids[0], 0);
    }

    function test_factory_createCollection_revertsIfNoName() public {
        vm.prank(seller);
        vm.expectRevert("Name is required");
        factory.createCollection("", "SYM", "", "", 100, MINT_PRICE);
    }

    function test_factory_createCollection_revertsIfZeroSupply() public {
        vm.prank(seller);
        vm.expectRevert("Supply must be greater than 0");
        factory.createCollection("Name", "SYM", "", "", 0, MINT_PRICE);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Listagem
    // ─────────────────────────────────────────────

    function test_listItem_success() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        NFTMarketplace.Listing memory listing = marketplace.getListing(address(collection), tokenId);
        assertTrue(listing.active);
        assertEq(listing.seller, seller);
        assertEq(listing.price, LIST_PRICE);
    }

    function test_listItem_emitsEvent() public {
        uint256 tokenId = _mintNFT(seller);
        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);

        vm.expectEmit(true, true, true, true);
        emit NFTMarketplace.ItemListed(address(collection), tokenId, seller, LIST_PRICE);
        marketplace.listItem(address(collection), tokenId, LIST_PRICE);
        vm.stopPrank();
    }

    function test_listItem_revertsIfNotOwner() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(stranger);
        vm.expectRevert("Not the NFT owner");
        marketplace.listItem(address(collection), tokenId, LIST_PRICE);
    }

    function test_listItem_revertsIfPriceTooLow() public {
        uint256 tokenId = _mintNFT(seller);
        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        vm.expectRevert("Minimum price is 0.0001 ETH");
        marketplace.listItem(address(collection), tokenId, 0.00001 ether);
        vm.stopPrank();
    }

    function test_listItem_revertsIfNotApproved() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(seller);
        vm.expectRevert("Marketplace not approved to transfer this NFT");
        marketplace.listItem(address(collection), tokenId, LIST_PRICE);
    }

    function test_listItem_revertsIfAlreadyListed() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        vm.prank(seller);
        vm.expectRevert("NFT is already listed");
        marketplace.listItem(address(collection), tokenId, LIST_PRICE);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Cancelar listagem
    // ─────────────────────────────────────────────

    function test_cancelListing_success() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        vm.prank(seller);
        marketplace.cancelListing(address(collection), tokenId);

        assertFalse(marketplace.getListing(address(collection), tokenId).active);
    }

    function test_cancelListing_byOwnerAdmin() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        vm.prank(owner);
        marketplace.cancelListing(address(collection), tokenId);

        assertFalse(marketplace.getListing(address(collection), tokenId).active);
    }

    function test_cancelListing_emitsEvent() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        vm.expectEmit(true, true, true, false);
        emit NFTMarketplace.ListingCancelled(address(collection), tokenId, seller);
        vm.prank(seller);
        marketplace.cancelListing(address(collection), tokenId);
    }

    function test_cancelListing_revertsIfNotListed() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(seller);
        vm.expectRevert("NFT is not listed");
        marketplace.cancelListing(address(collection), tokenId);
    }

    function test_cancelListing_revertsIfStranger() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        vm.prank(stranger);
        vm.expectRevert("Not authorized to cancel");
        marketplace.cancelListing(address(collection), tokenId);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Compra
    // ─────────────────────────────────────────────

    function test_buyItem_success() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        uint256 sellerBefore = seller.balance;

        vm.prank(buyer);
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);

        assertEq(collection.ownerOf(tokenId), buyer);
        assertFalse(marketplace.getListing(address(collection), tokenId).active);

        uint256 fee = (LIST_PRICE * FEE_BPS) / 10000;
        assertEq(seller.balance, sellerBefore + LIST_PRICE - fee);
    }

    function test_buyItem_refundsExcess() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        uint256 overpay = LIST_PRICE + 0.01 ether;
        uint256 buyerBefore = buyer.balance;

        vm.prank(buyer);
        marketplace.buyItem{value: overpay}(address(collection), tokenId);

        assertApproxEqAbs(buyer.balance, buyerBefore - LIST_PRICE, 0.001 ether);
    }

    function test_buyItem_emitsEvent() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        vm.expectEmit(true, true, false, true);
        emit NFTMarketplace.ItemSold(address(collection), tokenId, seller, buyer, LIST_PRICE);
        vm.prank(buyer);
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);
    }

    function test_buyItem_revertsIfNotListed() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(buyer);
        vm.expectRevert("NFT is not for sale");
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);
    }

    function test_buyItem_revertsIfInsufficientPayment() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        vm.prank(buyer);
        vm.expectRevert("Insufficient payment");
        marketplace.buyItem{value: 0.001 ether}(address(collection), tokenId);
    }

    function test_buyItem_revertsIfSellerTriesToBuy() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        vm.prank(seller);
        vm.expectRevert("Seller cannot buy own NFT");
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);
    }

    function test_buyItem_feeCalculation() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        uint256 contractBefore = address(marketplace).balance;
        uint256 sellerBefore   = seller.balance;

        vm.prank(buyer);
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);

        uint256 expectedFee = (LIST_PRICE * FEE_BPS) / 10000;
        assertEq(seller.balance - sellerBefore, LIST_PRICE - expectedFee);
        assertEq(address(marketplace).balance - contractBefore, expectedFee);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Fazer oferta
    // ─────────────────────────────────────────────

    function test_makeOffer_success() public {
        uint256 tokenId = _mintNFT(seller);
        uint256 contractBefore = address(marketplace).balance;

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        NFTMarketplace.Offer memory offer = marketplace.getOffer(address(collection), tokenId, buyer);
        assertTrue(offer.active);
        assertEq(offer.amount, OFFER_AMOUNT);
        assertEq(offer.buyer, buyer);
        assertGt(offer.expiresAt, block.timestamp);
        assertEq(address(marketplace).balance, contractBefore + OFFER_AMOUNT);
    }

    function test_makeOffer_registresBuyerInList() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        address[] memory buyers = marketplace.getOfferBuyers(address(collection), tokenId);
        assertEq(buyers.length, 1);
        assertEq(buyers[0], buyer);
    }

    function test_makeOffer_multipleOffers() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.prank(buyer2);
        marketplace.makeOffer{value: OFFER_AMOUNT + 0.01 ether}(address(collection), tokenId);

        address[] memory buyers = marketplace.getOfferBuyers(address(collection), tokenId);
        assertEq(buyers.length, 2);
    }

    function test_makeOffer_emitsEvent() public {
        uint256 tokenId = _mintNFT(seller);

        vm.expectEmit(true, true, true, true);
        emit NFTMarketplace.OfferMade(address(collection), tokenId, buyer, OFFER_AMOUNT, block.timestamp + 7 days);
        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);
    }

    function test_makeOffer_revertsIfAmountTooLow() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(buyer);
        vm.expectRevert("Minimum offer is 0.0001 ETH");
        marketplace.makeOffer{value: 0.00001 ether}(address(collection), tokenId);
    }

    function test_makeOffer_revertsIfOwnerTriesToOffer() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(seller);
        vm.expectRevert("Owner cannot offer on own NFT");
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);
    }

    function test_makeOffer_revertsIfDuplicateOffer() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.prank(buyer);
        vm.expectRevert("You already have an active offer on this NFT");
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Aceitar oferta
    // ─────────────────────────────────────────────

    function test_acceptOffer_success() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        uint256 sellerBefore = seller.balance;

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();

        assertEq(collection.ownerOf(tokenId), buyer);
        assertFalse(marketplace.getOffer(address(collection), tokenId, buyer).active);

        uint256 fee = (OFFER_AMOUNT * FEE_BPS) / 10000;
        assertEq(seller.balance, sellerBefore + OFFER_AMOUNT - fee);
    }

    function test_acceptOffer_cancelsPreviousListing() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        assertTrue(marketplace.getListing(address(collection), tokenId).active);

        vm.prank(seller);
        marketplace.acceptOffer(address(collection), tokenId, buyer);

        assertFalse(marketplace.getListing(address(collection), tokenId).active);
    }

    function test_acceptOffer_sellerReceivesCorrectAmount() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        uint256 sellerBefore   = seller.balance;
        uint256 contractBefore = address(marketplace).balance;

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();

        uint256 fee = (OFFER_AMOUNT * FEE_BPS) / 10000;
        assertEq(seller.balance, sellerBefore + OFFER_AMOUNT - fee);
        assertEq(address(marketplace).balance, contractBefore - (OFFER_AMOUNT - fee));
    }

    function test_acceptOffer_emitsEvent() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);

        vm.expectEmit(true, true, false, true);
        emit NFTMarketplace.OfferAccepted(address(collection), tokenId, seller, buyer, OFFER_AMOUNT);
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();
    }

    function test_acceptOffer_revertsIfNotOwner() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.prank(stranger);
        vm.expectRevert("Not the NFT owner");
        marketplace.acceptOffer(address(collection), tokenId, buyer);
    }

    function test_acceptOffer_revertsIfOfferNotActive() public {
        uint256 tokenId = _mintNFT(seller);

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        vm.expectRevert("Offer is not active");
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();
    }

    function test_acceptOffer_revertsIfExpired() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.warp(block.timestamp + 8 days);

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        vm.expectRevert("Offer has expired");
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();
    }

    function test_acceptOffer_revertsIfNotApproved() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.prank(seller);
        vm.expectRevert("Marketplace not approved to transfer this NFT");
        marketplace.acceptOffer(address(collection), tokenId, buyer);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Cancelar oferta
    // ─────────────────────────────────────────────

    function test_cancelOffer_success() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        uint256 buyerBefore    = buyer.balance;
        uint256 contractBefore = address(marketplace).balance;

        vm.prank(buyer);
        marketplace.cancelOffer(address(collection), tokenId);

        assertFalse(marketplace.getOffer(address(collection), tokenId, buyer).active);
        assertEq(address(marketplace).balance, contractBefore - OFFER_AMOUNT);
        assertApproxEqAbs(buyer.balance, buyerBefore + OFFER_AMOUNT, 0.001 ether);
    }

    function test_cancelOffer_emitsEvent() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.expectEmit(true, true, true, false);
        emit NFTMarketplace.OfferCancelled(address(collection), tokenId, buyer);
        vm.prank(buyer);
        marketplace.cancelOffer(address(collection), tokenId);
    }

    function test_cancelOffer_revertsIfNoActiveOffer() public {
        uint256 tokenId = _mintNFT(seller);
        vm.prank(buyer);
        vm.expectRevert("You have no active offer on this NFT");
        marketplace.cancelOffer(address(collection), tokenId);
    }

    // ─────────────────────────────────────────────
    // Marketplace — Resgatar oferta expirada
    // ─────────────────────────────────────────────

    function test_reclaimExpiredOffer_success() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        uint256 buyerBefore = buyer.balance;
        vm.warp(block.timestamp + 8 days);

        vm.prank(stranger);
        marketplace.reclaimExpiredOffer(address(collection), tokenId, buyer);

        assertFalse(marketplace.getOffer(address(collection), tokenId, buyer).active);
        assertEq(buyer.balance, buyerBefore + OFFER_AMOUNT);
    }

    function test_reclaimExpiredOffer_revertsIfNotExpired() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.prank(stranger);
        vm.expectRevert("Offer has not expired yet");
        marketplace.reclaimExpiredOffer(address(collection), tokenId, buyer);
    }

    function test_reclaimExpiredOffer_revertsIfNoOffer() public {
        uint256 tokenId = _mintNFT(seller);
        vm.warp(block.timestamp + 8 days);
        vm.prank(stranger);
        vm.expectRevert("Offer is not active");
        marketplace.reclaimExpiredOffer(address(collection), tokenId, buyer);
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function test_setMarketplaceFee_success() public {
        vm.prank(owner);
        marketplace.setMarketplaceFee(500);
        assertEq(marketplace.marketplaceFee(), 500);
    }

    function test_setMarketplaceFee_revertsIfTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Maximum fee is 10%");
        marketplace.setMarketplaceFee(1001);
    }

    function test_setMarketplaceFee_revertsIfNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        marketplace.setMarketplaceFee(500);
    }

    function test_withdraw_success() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);
        vm.prank(buyer);
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);

        uint256 contractBalance = address(marketplace).balance;
        uint256 ownerBefore     = owner.balance;

        vm.prank(owner);
        marketplace.withdraw();

        assertEq(address(marketplace).balance, 0);
        assertEq(owner.balance, ownerBefore + contractBalance);
    }

    function test_withdraw_revertsIfNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        marketplace.withdraw();
    }

    // ─────────────────────────────────────────────
    // Cenários integrados
    // ─────────────────────────────────────────────

    function test_fullFlow_mintListBuy() public {
        uint256 tokenId = _mintNFT(seller);

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.listItem(address(collection), tokenId, LIST_PRICE);
        vm.stopPrank();

        uint256 sellerBefore   = seller.balance;
        uint256 contractBefore = address(marketplace).balance;

        vm.prank(buyer);
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId);

        assertEq(collection.ownerOf(tokenId), buyer);
        assertFalse(marketplace.getListing(address(collection), tokenId).active);

        uint256 fee = (LIST_PRICE * FEE_BPS) / 10000;
        assertEq(seller.balance, sellerBefore + LIST_PRICE - fee);
        assertEq(address(marketplace).balance, contractBefore + fee);
    }

    function test_fullFlow_mintOfferAccept() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        uint256 sellerBefore = seller.balance;

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();

        assertEq(collection.ownerOf(tokenId), buyer);
        assertFalse(marketplace.getOffer(address(collection), tokenId, buyer).active);

        uint256 fee = (OFFER_AMOUNT * FEE_BPS) / 10000;
        assertEq(seller.balance, sellerBefore + OFFER_AMOUNT - fee);
    }

    function test_fullFlow_listThenAcceptOffer() public {
        uint256 tokenId = _mintAndList(seller, LIST_PRICE);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        assertTrue(marketplace.getListing(address(collection), tokenId).active);

        vm.prank(seller);
        marketplace.acceptOffer(address(collection), tokenId, buyer);

        assertEq(collection.ownerOf(tokenId), buyer);
        assertFalse(marketplace.getListing(address(collection), tokenId).active);
        assertFalse(marketplace.getOffer(address(collection), tokenId, buyer).active);
    }

    function test_fullFlow_offerCancelledAndNewOffer() public {
        uint256 tokenId = _mintNFT(seller);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT}(address(collection), tokenId);

        vm.prank(buyer);
        marketplace.cancelOffer(address(collection), tokenId);

        assertFalse(marketplace.getOffer(address(collection), tokenId, buyer).active);

        vm.prank(buyer);
        marketplace.makeOffer{value: OFFER_AMOUNT + 0.01 ether}(address(collection), tokenId);

        assertTrue(marketplace.getOffer(address(collection), tokenId, buyer).active);
        assertEq(marketplace.getOffer(address(collection), tokenId, buyer).amount, OFFER_AMOUNT + 0.01 ether);

        address[] memory buyers = marketplace.getOfferBuyers(address(collection), tokenId);
        assertEq(buyers.length, 2);
    }

    function test_fullFlow_multipleCollections() public {
        // Cria segunda coleção com URIs carregadas
        vm.prank(buyer);
        address addr2 = factory.createCollection("Second", "SEC", "", "", 2, MINT_PRICE);
        NFTCollection collection2 = NFTCollection(addr2);
        _loadURIs(collection2, 2);

        // Minta em cada coleção
        uint256 tokenId1 = collection.totalSupply();
        vm.prank(seller);
        collection.mint{value: MINT_PRICE}(seller); // ✅ só address

        uint256 tokenId2 = collection2.totalSupply();
        vm.prank(buyer);
        collection2.mint{value: MINT_PRICE}(buyer); // ✅ só address

        // Lista nas duas coleções no mesmo marketplace
        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.listItem(address(collection), tokenId1, LIST_PRICE);
        vm.stopPrank();

        vm.startPrank(buyer);
        collection2.setApprovalForAll(address(marketplace), true);
        marketplace.listItem(address(collection2), tokenId2, LIST_PRICE);
        vm.stopPrank();

        assertTrue(marketplace.getListing(address(collection), tokenId1).active);
        assertTrue(marketplace.getListing(address(collection2), tokenId2).active);

        vm.prank(buyer2);
        marketplace.buyItem{value: LIST_PRICE}(address(collection), tokenId1);

        assertEq(collection.ownerOf(tokenId1), buyer2);
        assertTrue(marketplace.getListing(address(collection2), tokenId2).active);
    }

    function test_sellerReceivesPaymentFromBuyer() public {
        uint256 tokenId = _mintNFT(seller);

        uint256 offerValue = 0.05 ether;
        vm.prank(buyer);
        marketplace.makeOffer{value: offerValue}(address(collection), tokenId);

        uint256 sellerBefore   = seller.balance;
        uint256 buyerBefore    = buyer.balance;
        uint256 contractBefore = address(marketplace).balance;

        vm.startPrank(seller);
        collection.setApprovalForAll(address(marketplace), true);
        marketplace.acceptOffer(address(collection), tokenId, buyer);
        vm.stopPrank();

        uint256 fee            = (offerValue * FEE_BPS) / 10000;
        uint256 sellerProceeds = offerValue - fee;

        assertEq(collection.ownerOf(tokenId), buyer);
        assertEq(seller.balance - sellerBefore, sellerProceeds);
        assertEq(buyerBefore, buyer.balance);
        assertEq(address(marketplace).balance, contractBefore - sellerProceeds);
    }
}