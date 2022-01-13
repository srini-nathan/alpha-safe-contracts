// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

interface ILendAndBorrow {
    function balanceOf(address owner) external view returns (uint256);

    function exchangeRateCurrent() external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function balanceOfUnderlying(address account)
        external
        view
        returns (uint256);
}
