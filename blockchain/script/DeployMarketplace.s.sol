// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 1. Usar named imports para manter o padrão que corrigimos no contrato
import {Script} from "forge-std/Script.sol";
import {NFTMarketplace} from "../src/NFTMarketplace.sol";

contract DeployMarketplace is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // O construtor não recebe mais o CID do IPFS
        new NFTMarketplace("NFT Pro TCC", "PRO"); 

        vm.stopBroadcast();
    }
}