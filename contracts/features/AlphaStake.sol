// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import "../common/SelfAuthorized.sol";

interface IRocketStorage {
    function getAddress(bytes32 key) external view returns (address);
}

interface IRocketDepositPool {
    function deposit() external payable;
}

interface IRocketETHToken {
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title AlphaStake - A decentralized Ethereum staking contract, done through Rocket Pool or Lido.
 * @author Rodrigo Herrera I.
 */
contract AlphaStake is SelfAuthorized {
    address public constant ROCKET_STORAGE =
        0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46;

    event StakeEth(uint256 amount);
    event UnstakeEth(uint256 amount);

    /**
     * @dev Stakes Eth and gets rEth in return.
     * @param _amount The amount of Eth to stake.
     */
    function stakeEth(uint256 _amount) public authorized {
        require(_amount > 0, "ALS01");
        require(address(this).balance >= _amount, "ALS02");
        IRocketStorage rocketStorage = IRocketStorage(ROCKET_STORAGE);
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

    /**
     * @dev Withdraws stake Eth from Rocketpool. It needs to be at least 24 hours
     * after the staked.
     * @param _amount The amount of rEth to unstacke.
     */
    function withdrawStakedEth(uint256 _amount) public authorized {
        require(_amount > 0, "ALS01");
        IRocketStorage rocketStorage = IRocketStorage(ROCKET_STORAGE);
        address rocketETHTokenAddress = rocketStorage.getAddress(
            keccak256(abi.encodePacked("contract.address", "rocketETHToken"))
        );
        IRocketETHToken rocketETHToken = IRocketETHToken(rocketETHTokenAddress);
        require(rocketETHToken.transfer(address(this), _amount), "ALS03");
        emit UnstakeEth(_amount);
    }
}
