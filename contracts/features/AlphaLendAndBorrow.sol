// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "../common/SelfAuthorized.sol";

interface ICeth {
    function mint() external payable;

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function borrow(uint256 borrowAmount) external returns (uint256);

    function repayBorrow() external payable;
}

interface IErc20 {
    function approve(address, uint256) external returns (bool);

    function transfer(address, uint256) external returns (bool);

    function balanceOf(address) external view returns (uint256);
}

interface ICErc20 {
    function mint(uint256) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function balanceOfUnderlying(address account) external returns (uint256);

    function borrow(uint256 borrowAmount) external returns (uint256);

    function repayBorrow(uint256 repayAmount) external returns (uint256);
}

interface IComptroller {
    function enterMarkets(address[] calldata)
        external
        returns (uint256[] memory);
}

/**
 * @title AlphaLendAndBorrow - A contract that allows lending and borrowing from Compound.
 * In order to use this contract, all transactions need to be executed from a safe transaction.
 * @author Rodrigo Herrera I.
 */
contract AlphaLendAndBorrow is SelfAuthorized {
    event SupplyEthToCompound(uint256 amount);
    event RedeemEthFromCompound(uint256 amount);
    event SupplyErc20ToCompound(uint256 amount, address token);
    event BorrowEthFromCompound(uint256 amount);
    event RedeemErc20FromCompound(uint256 amount, address token);
    event BorrowErc20FromCompound(uint256 amount, address token);
    event RepayEthToCompound(uint256 amount);
    event RepayErc20ToCompound(uint256, address token);

    /**
     * @dev Supplies Eth to compound and gets cEth (compound Eth) in return.
     * cEth starts accumulating interests immediately and it is necessary to borrow against it.
     * @param _amount the amount in WEI to supply.
     * @param _cEth the contract address of Compound ether.
     */
    function supplyEthToCompound(uint256 _amount, address _cEth)
        public
        authorized
    {
        ICeth cEth = ICeth(_cEth);
        cEth.mint{value: _amount}();
        emit SupplyEthToCompound(_amount);
    }

    /**
     * @dev Redeems cEth back to eth.
     * @param _amount amount to redeem.
     * @param _cEth the contract address of Compound ether.
     */
    function redeemEthFromCompound(uint256 _amount, address payable _cEth)
        public
        authorized
    {
        ICeth cEth = ICeth(_cEth);
        require(cEth.redeemUnderlying(_amount) == 0, "ASLB03");
        emit RedeemEthFromCompound(_amount);
    }

    /**
     * @dev Supplies an Erc-20 token to Compound.
     * @param _erc20Contract the contract address of the erc20 token.
     * @param _cErc20Contract the contract address of Compound erc20 token.
     * @param _amount the amount of tokens to supply, decimals can be 10 ** 18 (standard)
     * or something else, depending on the token's specifications.
     */
    function supplyErc20ToCompound(
        address _erc20Contract,
        address _cErc20Contract,
        address _comptrollerAddress,
        uint256 _amount
    ) public authorized {
        IComptroller comptroller = IComptroller(_comptrollerAddress);
        address[] memory cTokens = new address[](1);
        cTokens[0] = _cErc20Contract;
        IErc20 token = IErc20(_erc20Contract);
        ICErc20 cToken = ICErc20(_cErc20Contract);
        uint256[] memory errors = comptroller.enterMarkets(cTokens);
        if (errors[0] != 0) {
            revert("ASLB07");
        }
        // Approve exact amount.
        require(token.approve(_cErc20Contract, _amount), "ASLBO4");
        require(cToken.mint(_amount) == 0, "ASLB05");
        emit SupplyErc20ToCompound(_amount, _erc20Contract);
    }

    /**
     * @dev Redeems an Erc-20 token from Compound. It converts it to the native token.
     * @param _amount the amount of the underlying token to be redeemed.
     * @param _cErc20Contract the contract address of Compound erc20 token.
     */
    function redeemErc20FromCompound(uint256 _amount, address _cErc20Contract)
        public
        authorized
    {
        ICErc20 cToken = ICErc20(_cErc20Contract);
        require(cToken.redeemUnderlying(_amount) == 0, "ASLB07");
        emit RedeemErc20FromCompound(_amount, _cErc20Contract);
    }

    /**
     * @dev Borrows a given amount of eth from Compound. In order to borrow, this contract
     * needs to have enough collateral balance.
     * @param _amount amount of Eth to borrow.
     * @param _cEth the contract address of Compound ether.
     * @param _comptrollerAddress address of comptroller Compound.
     */
    function borrowEthFromCompound(
        uint256 _amount,
        address _cEth,
        address _comptrollerAddress
    ) public authorized {
        ICeth cEth = ICeth(_cEth);
        IComptroller comptroller = IComptroller(_comptrollerAddress);
        address[] memory cTokens = new address[](1);
        cTokens[0] = _cEth;
        uint256[] memory errors = comptroller.enterMarkets(cTokens);
        if (errors[0] != 0) {
            revert("ASLB07");
        }
        require(cEth.borrow(_amount) == 0, "ASLB09");
        emit BorrowEthFromCompound(_amount);
    }

    /**
     * @dev Borrows a given amount of an Erc20 token from Compound. In order to borrow, this contract
     * needs to have enough collateral balance.
     * @param _amount the amount of the underlying erc20 token to borrow.
     * @param _cEth the contract address of Compound ether.
     * @param _comptrollerAddress address of comptroller Compound.
     * @param _cErc20Contract the contract address of Compound erc20 token.
     */
    function borrowErc20FromCompound(
        uint256 _amount, // IMPORTANT --- Decimals should be checked on the client side.
        address _cEth,
        address _comptrollerAddress,
        address _cErc20Contract
    ) public authorized {
        ICErc20 cToken = ICErc20(_cErc20Contract);
        IComptroller comptroller = IComptroller(_comptrollerAddress);
        address[] memory cTokens = new address[](2);
        cTokens[0] = _cErc20Contract;
        cTokens[1] = _cEth;
        uint256[] memory errors = comptroller.enterMarkets(cTokens);
        if (errors[0] != 0) {
            revert("ASLB010");
        }
        require(cToken.borrow(_amount) == 0, "ASLB11");
        emit BorrowErc20FromCompound(_amount, _cErc20Contract);
    }

    /**
     * @dev Repays borrowed Eth to Compound.
     * @param _amount the amount to repay, there needs to be enough balance, if not
     * it will revert.
     * @param _cEth the contract address of Compound ether.
     */
    function repayEthToCompound(uint256 _amount, address _cEth)
        public
        authorized
    {
        ICeth cEth = ICeth(_cEth);
        cEth.repayBorrow{value: _amount}();
        emit RepayEthToCompound(_amount);
    }

    /**
     * @dev Repays borrowed Erc20 to compound.
     * @param _amount the amount to repay, there needs to be enough balance, if not
     * it will revert.
     * @param _erc20Contract the contract address of the erc20 token.
     * @param _cErc20Contract the contract address of Compound erc20 token.
     */
    function repayErc20ToCompound(
        uint256 _amount,
        address _erc20Contract,
        address _cErc20Contract
    ) public authorized {
        IErc20 token = IErc20(_erc20Contract);
        ICErc20 cToken = ICErc20(_cErc20Contract);
        require(token.approve(_cErc20Contract, _amount) == true, "ASLB04");
        uint256 error = cToken.repayBorrow(_amount);
        require(error == 0, "ASLB08");
        emit RepayErc20ToCompound(_amount, _erc20Contract);
    }
}

// TODO:
// Check error codes and document them.
