// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import "../common/SelfAuthorized.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/**
 * @title AlphaSwap - Single Swap token integration through UniSwap for AlphaSafe.
 * @author Rodrigo Herrera I.
 */
contract AlphaSwap is SelfAuthorized {
    ISwapRouter private swapRouter;
}
