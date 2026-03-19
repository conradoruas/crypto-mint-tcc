// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFTMarketplace.sol";

contract NFTMarketplaceTest is Test {
    NFTMarketplace public marketplace;
    address public user = address(1);

    function setUp() public {
        // 1. Corrigido: Apenas 2 argumentos no constructor agora
        marketplace = new NFTMarketplace("NFT Pro", "PRO");
    }

    function testMint() public {
        hoax(user, 1 ether); // Simula o usuário com saldo
        
        // 2. Corrigido: Agora passamos uma STRING e não um número
        string memory fakeUri = "ipfs://test-hash";
        marketplace.mint{value: 0.05 ether}(fakeUri);

        // 3. Corrigido: Verificamos o saldo do dono do token em vez do totalSupply
        assertEq(marketplace.ownerOf(0), user);
        assertEq(marketplace.balanceOf(user), 1);
    }
}