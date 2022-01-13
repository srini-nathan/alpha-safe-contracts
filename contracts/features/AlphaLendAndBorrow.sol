// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/SelfAuthorized.sol";

interface ICeth {
    function mint() external payable;

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
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
    event BorrowEthFromCompound(uint256 amount, address token);
    event RedeemErc20FromCompound(uint256 amount, address token);

    /**
     * @dev Supplies Eth to compound and gets cEth (compound Eth) in return.
     * cEth starts accumulating interests immediately and it is necessary to borrow against it.
     * @param _amount the amount in WEI to supply.
     * @param _cEth the contract address of Compound ether.
     */
    function supplyEthToCompound(uint256 _amount, address payable _cEth)
        public
        authorized
    {
        require(address(this).balance >= _amount, "ASLB01");
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
        require(cEth.redeemUnderlying(_amount) == 0, "ASLB02");
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
        uint256 _amount
    ) public authorized {
        IErc20 token = IErc20(_erc20Contract);
        ICErc20 cToken = ICErc20(_cErc20Contract);
        require(token.balanceOf(address(this)) >= _amount, "ASLB03");
        // Approve exact amount.
        require(token.approve(_cErc20Contract, _amount) == true, "ASLBO4");
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
        require(cToken.balanceOfUnderlying(address(this)) >= _amount, "ASLB05");
        require(cToken.redeemUnderlying(_amount) == 0, "ASLB06");
        emit RedeemErc20FromCompound(_amount, _cErc20Contract);
    }

    // TODO:
    // 1. BORROW ETH FROM COMPOUND
    // 2. BORROW ERC20 FROM COMPOUND
    // 3. REPAY BORROWS
    function borrowEthFromCompound(uint256 _amount, address _cErc20Contract)
        public
        authorized
    {}

    // /**
    //  * @dev Transfers the collateral asset to the protocol and creates a borrow balance
    //  * that begins accumulating interests based on the borrow rate. The amount borrowed must
    //  * be less than the user's Accound Liquidity and the market's available liquidity.
    //  */
    // function borrowErc20FromCompound(
    //     address payable _cEth,
    //     address _comptrollerAddress,
    //     address _erc20Contract,
    //     address _cErc20Contract,
    //     uint256 _borrowAmount
    // ) public authorized {
    //     ICeth cEth = ICeth(_cEth);
    //     IComptroller comptroller = IComptroller(_comptrollerAddress);
    //     ICErc20 cToken = ICErc20(_cErc20Contract);
    //     IErc20 token = IErc20(_erc20Contract);
    //     // Approve exact amount.
    //     require(token.approve(_cErc20Contract, _amount) == true, "ASLB05");
    //     address[] memory cTokens = new address[](2);
    //     cTokens[0] = _cEth;
    //     cTokens[1] = "";
    //     uint256[] memory errors = comptroller.enterMarkets(cTokens);
    //     if (errors[0] != 0) {
    //         revert("ASLB05");
    //     }
    // }
}
