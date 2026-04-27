// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NFTCollectionV2} from "../src/NFTCollectionV2.sol";
import {NFTCollectionFactoryV2} from "../src/NFTCollectionFactoryV2.sol";

contract NFTCollectionV2Test is Test {

    NFTCollectionFactoryV2 public factory;
    NFTCollectionV2        public collection;

    address public creator  = makeAddr("creator");
    address public minter   = makeAddr("minter");
    address public stranger = makeAddr("stranger");

    uint256 constant MINT_PRICE = 0.0001 ether;
    uint256 constant MAX_SUPPLY = 5;
    string  constant COLLECTION_NAME   = "Sky Mages";
    string  constant COLLECTION_SYMBOL = "MAGE";
    string  constant CONTRACT_URI = "ipfs://QmTraitSchema123";
    string  constant EMPTY_CONTRACT_URI = "";

    function setUp() public {
        vm.deal(creator,  10 ether);
        vm.deal(minter,   10 ether);
        vm.deal(stranger, 10 ether);

        factory = new NFTCollectionFactoryV2();

        vm.prank(creator);
        address addr = factory.createCollection(
            COLLECTION_NAME,
            COLLECTION_SYMBOL,
            "A sky mage collection",
            "ipfs://QmCover",
            MAX_SUPPLY,
            MINT_PRICE,
            CONTRACT_URI
        );
        collection = NFTCollectionV2(addr);

        _loadURIs(collection, MAX_SUPPLY);
        _commitSeed(collection);
    }

    // ─── helpers ─────────────────────────────────────────────────────

    function _loadURIs(NFTCollectionV2 col, uint256 count) internal {
        string[] memory uris = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            uris[i] = string(abi.encodePacked("ipfs://QmNFT", vm.toString(i)));
        }
        vm.prank(col.owner());
        col.loadTokenURIs(uris);
    }

    function _commitSeed(NFTCollectionV2 col) internal {
        bytes32 seed = keccak256("test-seed-v2");
        bytes32 commitment = keccak256(abi.encodePacked(seed));
        vm.prank(col.owner());
        col.commitMintSeed(commitment);
    }

    function _mint(address to) internal returns (uint256 tokenId) {
        tokenId = collection.totalSupply();
        vm.prank(to);
        collection.mint{value: MINT_PRICE}(to);
    }

    // ─── contractURI ────────────────────────────────────────────────

    function test_contractURI_isSetAtConstruction() public view {
        assertEq(collection.contractURI(), CONTRACT_URI);
    }

    function test_contractURI_hasNoSetter() public {
        // contractURIStorage is public storage; there is no setContractURI function
        // Confirm by verifying the contract has no such selector
        bytes4 setterSig = bytes4(keccak256("setContractURI(string)"));
        (bool success, ) = address(collection).call(abi.encodeWithSelector(setterSig, "ipfs://new"));
        assertFalse(success, "setContractURI must not exist");
    }

    function test_contractURI_emptyStringAllowed() public {
        vm.prank(creator);
        address addr = factory.createCollection(
            "NoSchema", "NS", "desc", "ipfs://img", 3, MINT_PRICE, EMPTY_CONTRACT_URI
        );
        assertEq(NFTCollectionV2(addr).contractURI(), "");
    }

    // ─── Factory event ────────────────────────────────────────────────

    function test_factory_collectionCreatedEventIncludesContractURI() public {
        // Check creator, collectionId (indexed), and the non-indexed data fields.
        // Skip the contractAddress index (second param) since we can't pre-compute it.
        vm.prank(creator);
        vm.expectEmit(true, false, true, true);
        emit NFTCollectionFactoryV2.CollectionCreated(
            creator,
            address(0), // skipped — contractAddress is deterministic but not pre-computable here
            "NewColl",
            1,          // second collection, index 1
            "ipfs://QmNewSchema"
        );
        factory.createCollection("NewColl", "NC", "d", "ipfs://img", 2, 0, "ipfs://QmNewSchema");
    }

    function test_factory_storesContractURIInRegistry() public {
        NFTCollectionFactoryV2.CollectionInfo memory info = factory.getCollection(0);
        assertEq(info.contractURI, CONTRACT_URI);
    }

    // ─── Mint flow unchanged ─────────────────────────────────────────

    function test_mint_assignsTokenId() public {
        uint256 id = _mint(minter);
        assertEq(id, 0);
        assertEq(collection.totalSupply(), 1);
        assertEq(collection.ownerOf(0), minter);
    }

    function test_mint_tokenURIIsNonEmpty() public {
        _mint(minter);
        string memory uri = collection.tokenURI(0);
        assertGt(bytes(uri).length, 0);
    }

    function test_mint_allTokensUnique() public {
        string[] memory assigned = new string[](MAX_SUPPLY);
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            vm.prank(minter);
            collection.mint{value: MINT_PRICE}(minter);
            assigned[i] = collection.tokenURI(i);
        }
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            for (uint256 j = i + 1; j < MAX_SUPPLY; j++) {
                assertFalse(
                    keccak256(bytes(assigned[i])) == keccak256(bytes(assigned[j])),
                    "Duplicate URI assigned"
                );
            }
        }
    }

    function test_mint_revealedAfterSupplyExhausted() public {
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            vm.prank(minter);
            collection.mint{value: MINT_PRICE}(minter);
        }
        assertTrue(collection.revealed());
    }

    function test_mint_revertsIfSupplyExhausted() public {
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            vm.prank(minter);
            collection.mint{value: MINT_PRICE}(minter);
        }
        vm.prank(minter);
        vm.expectRevert(NFTCollectionV2.SupplyExhausted.selector);
        collection.mint{value: MINT_PRICE}(minter);
    }

    function test_mint_refundsExcessPayment() public {
        uint256 balanceBefore = minter.balance;
        uint256 excess = 0.5 ether;
        vm.prank(minter);
        collection.mint{value: MINT_PRICE + excess}(minter);
        assertApproxEqAbs(minter.balance, balanceBefore - MINT_PRICE, 1e12, "Excess not refunded");
    }

    // ─── Commit-reveal unchanged ─────────────────────────────────────

    function test_commitSeed_revertsIfAlreadyCommitted() public {
        vm.prank(creator);
        vm.expectRevert(NFTCollectionV2.SeedAlreadyCommitted.selector);
        collection.commitMintSeed(keccak256(abi.encodePacked(keccak256("another"))));
    }

    function test_revealSeed_verifiable() public {
        bytes32 seed = keccak256("test-seed-v2");
        vm.prank(creator);
        collection.revealMintSeed(seed);
        assertEq(collection.mintSeedRevealed(), seed);
    }

    // ─── Royalty unchanged ─────────────────────────────────────────

    function test_royalty_defaultFivePercent() public view {
        (address receiver, uint256 royalty) = collection.royaltyInfo(0, 1 ether);
        assertEq(receiver, creator);
        assertEq(royalty, 0.05 ether); // 5%
    }

    // ─── ERC-165 ────────────────────────────────────────────────────

    function test_supportsInterface_ERC721() public view {
        assertTrue(collection.supportsInterface(0x80ac58cd)); // ERC-721
    }

    function test_supportsInterface_ERC2981() public view {
        assertTrue(collection.supportsInterface(0x2a55205a)); // ERC-2981
    }

    // ─── Withdraw ───────────────────────────────────────────────────

    function test_withdraw_sendsBalanceToOwner() public {
        _mint(minter);
        uint256 expected = MINT_PRICE;
        uint256 before = creator.balance;
        vm.prank(creator);
        collection.withdraw();
        assertEq(creator.balance, before + expected);
    }

    function test_withdraw_revertsIfEmpty() public {
        vm.prank(creator);
        vm.expectRevert(NFTCollectionV2.NothingToWithdraw.selector);
        collection.withdraw();
    }

    // ─── Factory access control / validation ─────────────────────────

    function test_factory_revertsOnEmptyName() public {
        vm.prank(creator);
        vm.expectRevert(NFTCollectionFactoryV2.NameRequired.selector);
        factory.createCollection("", "SYM", "d", "ipfs://img", 5, 0, "");
    }

    function test_factory_revertsOnZeroSupply() public {
        vm.prank(creator);
        vm.expectRevert(NFTCollectionFactoryV2.SupplyMustBePositive.selector);
        factory.createCollection("Name", "NM", "d", "ipfs://img", 0, 0, "");
    }

    function test_factory_totalCollections() public view {
        assertEq(factory.totalCollections(), 1);
    }

    function test_factory_creatorCollections() public view {
        uint256[] memory ids = factory.getCreatorCollections(creator);
        assertEq(ids.length, 1);
        assertEq(ids[0], 0);
    }

    function test_factory_paginatedView() public {
        vm.prank(creator);
        factory.createCollection("C2", "C2", "d", "ipfs://img", 2, 0, "");

        NFTCollectionFactoryV2.CollectionInfo[] memory page =
            factory.getCollections(0, 1);
        assertEq(page.length, 1);
        assertEq(page[0].name, COLLECTION_NAME);

        NFTCollectionFactoryV2.CollectionInfo[] memory page2 =
            factory.getCollections(1, 1);
        assertEq(page2.length, 1);
        assertEq(page2[0].name, "C2");
    }

    function test_onlyOwnerCanLoadTokenUris() public {
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://QmNFT-extra";

        vm.prank(stranger);
        vm.expectRevert();
        collection.appendTokenURIs(uris);
    }

    function test_onlyOwnerCanRevealSeed() public {
        vm.prank(stranger);
        vm.expectRevert();
        collection.revealMintSeed(keccak256("test-seed-v2"));
    }

    function test_onlyOwnerCanWithdraw() public {
        _mint(minter);

        vm.prank(stranger);
        vm.expectRevert();
        collection.withdraw();
    }
}
