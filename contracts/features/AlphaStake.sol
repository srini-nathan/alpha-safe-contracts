// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import "../common/SelfAuthorized.sol";

interface IRocketStorage {
    function getAddress(bytes32 key) external view returns (address);
}

interface IRocketDepositPool {
    function deposit() external payable;
}

/**
 * @title AlphaStake - A decentralized Ethereum staking contract, done through Rocket Pool or Lido.
 * @author Rodrigo Herrera I.
 */
contract AlphaStake is SelfAuthorized {
    event StakeEth(uint256 amount);

    /**
     * @dev Stakes Eth and gets rEth in return.
     */
    function stakeEth(uint256 _amount, address _rocketStorage)
        public
        authorized
    {
        require(_amount > 0, "ALS01");
        require(address(this).balance >= _amount, "ALS02");
        IRocketStorage rocketStorage = IRocketStorage(_rocketStorage);
        // Load contracts.
        address rocketDepositPoolAddress = rocketStorage.getAddress(
            keccak256(abi.encodePacked("contract.address", "rocketDepositPool"))
        );
        IRocketDepositPool rocketDepositPool = IRocketDepositPool(
            rocketDepositPoolAddress
        );
        rocketDepositPool.deposit{value: _amount}();
        emit StakeEth(_amount);
    }
}
