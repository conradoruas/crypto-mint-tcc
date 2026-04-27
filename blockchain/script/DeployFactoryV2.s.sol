// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {NFTCollectionFactoryV2} from "../src/NFTCollectionFactoryV2.sol";

contract DeployFactoryV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        new NFTCollectionFactoryV2();

        vm.stopBroadcast();
    }
}
