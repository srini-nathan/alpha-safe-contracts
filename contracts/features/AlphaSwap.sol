// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import "../common/SelfAuthorized.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256 amount) external;
}

/**
 * @title AlphaSwap - Single Swap token integration through UniSwapV3 for AlphaSafe.
 * @author Rodrigo Herrera I.
 */
contract AlphaSwap is SelfAuthorized {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    event SwapExactInputSingle(
        uint256 amountIn,
        uint256 amountOut,
        address tokenIn,
        address tokenOut
    );

    function swapFromEth(
        uint256 _amountIn,
        ISwapRouter _swapRouter,
        address _tokenOut,
        uint256 _amountOutMinimum,
        uint24 _poolFee
    ) private {
        ISwapRouter swapRouter = _swapRouter;
        address _tokenIn = WETH;
        address _recipient = address(this);
        IWETH(WETH).deposit{value: _amountIn}();
        // Approve exact ammount.
        TransferHelper.safeApprove(_tokenIn, address(_swapRouter), _amountIn);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _poolFee,
                recipient: _recipient,
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: 0 // ONLY FOR TESTING!
            });
        uint256 amountOut = swapRouter.exactInputSingle(params);
        emit SwapExactInputSingle(_amountIn, amountOut, _tokenIn, _tokenOut);
    }

    function swapToEth(
        uint256 _amountIn,
        ISwapRouter _swapRouter,
        address _tokenIn,
        uint256 _amountOutMinimum,
        uint24 _poolFee
    ) private {
        ISwapRouter swapRouter = _swapRouter;
        address _tokenOut = WETH;
        address _recipient = address(this);
        TransferHelper.safeApprove(_tokenIn, address(_swapRouter), _amountIn);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _poolFee,
                recipient: _recipient,
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: 0 // ONLY FOR TESTING!
            });
        uint256 amountOut = swapRouter.exactInputSingle(params);
        IWETH(WETH).withdraw(_amountIn);
        emit SwapExactInputSingle(_amountIn, amountOut, _tokenIn, _tokenOut);
    }

    function swapErc20(
        uint256 _amountIn,
        ISwapRouter _swapRouter,
        address _tokenIn,
        address _tokenOut,
        uint256 _amountOutMinimum,
        uint24 _poolFee
    ) private {
        ISwapRouter swapRouter = _swapRouter;
        address _recipient = address(this);
        TransferHelper.safeApprove(_tokenIn, address(_swapRouter), _amountIn);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _poolFee,
                recipient: _recipient,
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: 0 // ONLY FOR TESTING!
            });
        uint256 amountOut = swapRouter.exactInputSingle(params);
        emit SwapExactInputSingle(_amountIn, amountOut, _tokenIn, _tokenOut);
    }

    /**
     * @dev swaps a fixed amount of one token for a max possible amount of another token.
     * @param _amountIn the amount of the underlying token to exchange.
     * @param _swapRouter the router contract address.
     * @param _tokenIn the contract address of the inbound token.
     * @param _tokenOut the contract address of the outbound token.
     * @param _amountOutMinimum the minimum amount of tokens to get in return.
     * @param _poolFee the fee tier of the pool, used to determine the correct pool contract
     * in which to execute the swap.
     */
    function swapExactInputSingle(
        uint256 _amountIn,
        ISwapRouter _swapRouter,
        address _tokenIn, // address(0) for Eth.
        address _tokenOut, // address(0) for Eth.
        uint256 _amountOutMinimum,
        uint24 _poolFee
    ) public authorized {
        if (_tokenIn == address(0)) {
            // if _tokenIn is address(0), then we are swapping eth -> weth -> _tokenOut.
            swapFromEth(
                _amountIn,
                _swapRouter,
                _tokenOut,
                _amountOutMinimum,
                _poolFee
            );
        } else if (_tokenOut == address(0)) {
            // if _tokenOut is address(0), then we are swapping _tokenIn --> weth --> eth.
            swapToEth(
                _amountIn,
                _swapRouter,
                _tokenIn,
                _amountOutMinimum,
                _poolFee
            );
        } else {
            // For this case, we are exchanging an erc20 for another erc20.
            swapErc20(
                _amountIn,
                _swapRouter,
                _tokenIn,
                _tokenOut,
                _amountOutMinimum,
                _poolFee
            );
        }
    }
}
