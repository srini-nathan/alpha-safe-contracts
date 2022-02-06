import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import hre from "hardhat";


import { encodeFunctionData, executorSignature, singletonAbi, erc20Abi, safeTx, addressZero } from "../utils";



//latest abi.
const { abi } = require("../../artifacts/contracts/AlphaSafe.sol/AlphaSafe.json");

const cEth = "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5"; //Address of compound eth on mainnet.
const uniToken = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"; //Address of uni token mainnet.
const cUni = "0x35A18000230DA775CAc24873d00Ff85BccdeD550"; // Address of cUni token on mainnet.
const comptroller = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"; //Comptroller address on mainnet.

describe("AlphaLendAndBorrow.sol", () => {
    let owner: Signer;
    let owners: string[];
    let threshold: number;
    let ownerAddress: string;
    let signature: string;
    let cEthContract: Contract;
    let proxyAddress: string;
    let contract: Contract; //proxy contract.
    let data: string;
    let ProxyFactory: any;
    let proxyFactory: Contract;
    let AlphaSafe: any;
    let singleton: Contract;
    let singletonAddress: string;
    let initialFunding: BigNumber;

    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        owners = [ownerAddress];
        threshold = 1;
        signature = "0x" + executorSignature(ownerAddress);
        cEthContract = await ethers.getContractAt("ILendAndBorrow", cEth);
        data = encodeFunctionData(singletonAbi, "setup", [owners, threshold]);
        ProxyFactory = await ethers.getContractFactory("AlphaSafeProxyFactory");
        proxyFactory = await ProxyFactory.deploy();
        AlphaSafe = await ethers.getContractFactory("AlphaSafe");
        singleton = await AlphaSafe.deploy();
        singletonAddress = singleton.address;
        const transaction = await proxyFactory.createProxyWithNonce(singletonAddress, data, 1111);
        const receipt = await transaction.wait();
        proxyAddress = receipt.events[1].args.proxy;
        contract = new ethers.Contract(proxyAddress, abi, owner); //proxy
        // Funding the contract with 100 eth.
        initialFunding = ethers.utils.parseEther("100");
        await owner.sendTransaction({
            to: proxyAddress,
            value: initialFunding
        });

    });

    describe("Correct setup", () => {
        it("should have a threshold of 1", async () => {
            const _threshold = await contract.getThreshold();
            expect(_threshold.toString()).to.equal("1");
        });
        it("should have a balance of 100 ether", async () => {
            const balance = await ethers.provider.getBalance(contract.address);
            expect(balance).to.equal(initialFunding);
        });
        it("chainId should be '1' (mainnet)", async () => {
            const chainId = (await contract.getChainId()).toString();
            expect(chainId).to.equal("1");
        });
        it("should have the owner as owner", async () => {
            const arrayOfOwners = await contract.getOwners();
            expect(arrayOfOwners.length).to.equal(1);
            const result = await contract.isOwner(ownerAddress);
            expect(result).to.equal(true);
        });
    });

    describe("Supply eth to Compound", () => {
        let data: string;
        let supplyAmount: BigNumber;

        beforeEach(async () => {
            // data to supply 50 eth to Compound
            supplyAmount = ethers.utils.parseEther("50");
            data = encodeFunctionData(abi, "supplyEthToCompound", [
                supplyAmount,
                cEth
            ]);
        });
        it("should have 0 balance in cEther", async () => {
            const balance = (await cEthContract.balanceOfUnderlying(contract.address)).toString();
            expect(balance).to.equal("0");
        });
        it("should supply 50 eth to Compound and update balance", async () => {
            // Supplying 50 eth to Compound.
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            const balance = (await cEthContract.balanceOfUnderlying(contract.address)).toString();
            expect((balance / 1e18)).to.be.greaterThan(49.98); //gas.
        });
        it("should fail by trying to supply more eth than the current balance", async () => {
            const txFailure = encodeFunctionData(abi, "supplyEthToCompound", [
                ethers.utils.parseEther("101"),
                cEth
            ]);
            const tx = safeTx(contract.address, 0, txFailure, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.be.reverted;
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.supplyEthToCompound(100, cEth)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "SupplyEthToCompound").withArgs(supplyAmount);
        });
    });

    describe("Redeem eth from Compound", () => {
        let data: string;
        let redeemAmount: BigNumber;
        let redeemData: string;

        beforeEach(async () => {
            // data to supply 10 eth to Compound.
            data = encodeFunctionData(abi, "supplyEthToCompound", [
                ethers.utils.parseEther("10"),
                cEth
            ]);
            // data to redeem 5 eth from Compound.
            redeemAmount = ethers.utils.parseEther("5");
            redeemData = encodeFunctionData(abi, "redeemEthFromCompound", [
                redeemAmount,
                cEth
            ]);
            // Supplying 10 eth to Compound
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
        });
        it("should have 10 eth in Compound", async () => {
            const balance = (await cEthContract.balanceOfUnderlying(contract.address)).toString();
            expect((balance / 1e18)).to.be.greaterThan(9.9998); //gas.
        });
        it("contract balance should be 90 eth", async () => {
            const balance = await ethers.provider.getBalance(contract.address);
            expect(ethers.utils.formatEther(balance)).to.equal("90.0");
        });
        it("should be able to redeem eth from Compound and update balance", async () => {
            const tx = safeTx(contract.address, 0, redeemData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            const balance = await ethers.provider.getBalance(contract.address);
            expect(ethers.utils.formatEther(balance)).to.equal("95.0");
            const cBalance = (await cEthContract.balanceOfUnderlying(contract.address)).toString();
            expect((cBalance / 1e18)).to.be.greaterThan(4.998); //Rounding HH errors..
            expect((cBalance / 1e18)).to.be.lessThan(5.01); //Rounding HH errors..
        });
        it("should fail by trying to redeem bigger balance", async () => {
            const txFailure = encodeFunctionData(abi, "redeemEthFromCompound", [
                ethers.utils.parseEther("150"), //larger than current balance.
                cEth
            ]);
            const tx = safeTx(contract.address, 0, txFailure, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.be.reverted;
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.redeemEthFromCompound(100, cEth)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, redeemData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "RedeemEthFromCompound").withArgs(redeemAmount);
        });
    });

    describe("Supply Erc20 to Compound", () => {
        // If this account's balance goes to 0, just change the address.
        let impAccount: Signer;
        let uniContract: Contract;
        let uniCompContract: Contract; //cUni token contract.
        let amount: BigNumber;
        let data: string;

        beforeEach(async () => {
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0x0ec9e8aa56e0425b60dee347c8efbad959579d0f"]
            });
            amount = ethers.utils.parseEther("1000");
            impAccount = await ethers.getSigner("0x0ec9e8aa56e0425b60dee347c8efbad959579d0f");
            uniContract = new ethers.Contract(uniToken, erc20Abi, impAccount);
            uniCompContract = new ethers.Contract(cUni, erc20Abi, impAccount);
            await uniContract.transfer(contract.address, amount);
            data = encodeFunctionData(abi, "supplyErc20ToCompound", [
                uniToken, //erc20 contract
                cUni, // cErc20 contract
                comptroller, // comptroller address.
                amount
            ]);

        });
        it("contract should have 1000 uni tokens", async () => {
            const balance = await uniContract.balanceOf(contract.address);
            expect(balance).to.equal(amount);
        });
        it("should be able to supply uni to compound and update balances accordingly", async () => {
            let balance = await uniContract.balanceOf(contract.address);
            let cBalance = await uniCompContract.balanceOf(contract.address); //uni token balance.
            expect(balance).to.equal(amount);
            expect(cBalance).to.equal(0); //prior.
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "ExecutionSuccess");
            balance = await uniContract.balanceOf(contract.address);
            // balance converted to uni exchange rate.
            cBalance = await uniCompContract.balanceOfUnderlying(contract.address);
            expect(balance).to.equal(0); // converted to cUni.
            expect(Math.trunc(Number(ethers.utils.formatEther(cBalance)))).to.be.greaterThan(998); // HH rounding errors.. 
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.supplyErc20ToCompound(uniToken, cUni, comptroller, amount)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "SupplyErc20ToCompound").withArgs(amount, uniToken);
        });
    });

    describe("Redeem Erc20 from Compound", () => {
        // If this account's balance goes to 0, just change the address.
        let impAccount: Signer;
        let uniContract: Contract;
        let uniCompContract: Contract; //cUni token contract.
        let amount: BigNumber;
        let data: string;
        let supplyData: string;

        beforeEach(async () => {
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0x0ec9e8aa56e0425b60dee347c8efbad959579d0f"]
            });
            amount = ethers.utils.parseEther("1000");
            impAccount = await ethers.getSigner("0x0ec9e8aa56e0425b60dee347c8efbad959579d0f");
            uniContract = new ethers.Contract(uniToken, erc20Abi, impAccount);
            uniCompContract = new ethers.Contract(cUni, erc20Abi, impAccount);
            await uniContract.transfer(contract.address, amount);
            data = encodeFunctionData(abi, "redeemErc20FromCompound", [
                amount,
                cUni
            ]);
            supplyData = encodeFunctionData(abi, "supplyErc20ToCompound", [
                uniToken, //erc20 contract
                cUni, // cErc20 contract
                comptroller, // comptroller address
                amount
            ]);
            // Converting uni to cUni.
            const tx = safeTx(contract.address, 0, supplyData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
        });
        it("should have correct balances", async () => {
            const uniBalance = await uniContract.balanceOf(contract.address);
            const cBalance = await uniCompContract.balanceOfUnderlying(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(cBalance)))).to.be.greaterThan(998);
            expect(uniBalance).to.equal(0);
        });
        it("should be able to redeem cUni back to uni", async () => {
            let uniBalance = await uniContract.balanceOf(contract.address);
            let cBalance = await uniCompContract.balanceOfUnderlying(contract.address);
            expect(uniBalance).to.equal(0);
            expect(Math.trunc(Number(ethers.utils.formatEther(cBalance)))).to.be.greaterThan(998);
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            uniBalance = await uniContract.balanceOf(contract.address);
            expect(uniBalance).to.equal(amount); // we get uni tokens back.
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.redeemErc20FromCompound(amount, cUni)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "RedeemErc20FromCompound").withArgs(amount, cUni);
        });
    });

    describe("Borrow Eth from Compound", () => {
        // If this account's balance goes to 0, just change the address.
        let impAccount: Signer;
        let uniContract: Contract;
        let uniCompContract: Contract; //cUni token contract.
        let amount: BigNumber;
        let data: string;
        let supplyData: string;
        let borrowAmount: BigNumber;

        beforeEach(async () => {
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0x0ec9e8aa56e0425b60dee347c8efbad959579d0f"]
            });
            amount = ethers.utils.parseEther("1000");
            borrowAmount = ethers.utils.parseEther("1"); // we are borrowing 1 eth.
            impAccount = await ethers.getSigner("0x0ec9e8aa56e0425b60dee347c8efbad959579d0f");
            uniContract = new ethers.Contract(uniToken, erc20Abi, impAccount);
            uniCompContract = new ethers.Contract(cUni, erc20Abi, impAccount);
            await uniContract.transfer(contract.address, amount);
            data = encodeFunctionData(abi, "borrowEthFromCompound", [
                borrowAmount,
                cEth,
                comptroller
            ]);
            supplyData = encodeFunctionData(abi, "supplyErc20ToCompound", [
                uniToken, //erc20 contract
                cUni, // cErc20 contract
                comptroller,
                amount
            ]);
            // Converting uni to cUni.
            const tx = safeTx(contract.address, 0, supplyData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
        });
        it("should have some collateral uni", async () => {
            const cUniBalance = (await uniCompContract.balanceOfUnderlying(contract.address)).toString();
            expect(Math.trunc(Number(ethers.utils.formatEther(cUniBalance)))).to.be.greaterThan(998);
        })
        it("should be able to borrow eth", async () => {
            const initialBalance = await ethers.provider.getBalance(contract.address);
            expect(initialBalance).to.equal(ethers.utils.parseEther("100"));
            // executing transaction to borrow eth.
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            const postBalance = await ethers.provider.getBalance(contract.address);
            expect(postBalance).to.equal(ethers.utils.parseEther("101"));
        });
        it("should revert: borrowing more than collateral balance", async () => {
            const txData = encodeFunctionData(abi, "borrowEthFromCompound", [
                ethers.utils.parseEther("100"), // larger amount than collateralized.
                cEth,
                comptroller
            ]);
            const tx = safeTx(contract.address, 0, txData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.be.revertedWith("'GS013'");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.redeemErc20FromCompound(amount, cUni)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "BorrowEthFromCompound").withArgs(borrowAmount);
        });
    });

    describe("Borrow Erc20 from Compound", () => {
        let data: string;
        let supplyData: string;
        let borrowAmount: BigNumber;
        let supplyAmount: BigNumber;
        let uniContract: Contract;

        beforeEach(async () => {
            borrowAmount = ethers.utils.parseEther("1000");
            data = encodeFunctionData(abi, "borrowErc20FromCompound", [
                borrowAmount,
                cEth,
                comptroller,
                cUni
            ]);
            supplyAmount = ethers.utils.parseEther("100");
            supplyData = encodeFunctionData(abi, "supplyEthToCompound", [
                supplyAmount,
                cEth
            ]);
            uniContract = new ethers.Contract(uniToken, erc20Abi, owner);
            // supplying 100 eth to compound.
            const tx = safeTx(contract.address, 0, supplyData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
        });
        it("should have 100 cEth", async () => {
            const balance = await cEthContract.balanceOfUnderlying(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(balance)))).to.be.greaterThan(98);

        });
        it("should have 0 uni", async () => {
            const uniBalance = await uniContract.balanceOf(contract.address);
            expect(uniBalance).to.equal(0);
        });
        it("should be able to borrow uni", async () => {
            // confirming that we have 0 uni
            const initialBalance = await uniContract.balanceOf(contract.address);
            expect(initialBalance).to.equal(0);
            // execute transaction
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            const postBalance = await uniContract.balanceOf(contract.address);
            expect(postBalance).to.equal(borrowAmount);
        });
        it("should revert: borrowing more than collateral balance", async () => {
            const txData = encodeFunctionData(abi, "borrowErc20FromCompound", [
                ethers.utils.parseEther("100000000"), // larger amount than collateralized.
                cEth,
                comptroller,
                cUni
            ]);
            const tx = safeTx(contract.address, 0, txData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.be.revertedWith("'GS013'");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.borrowErc20FromCompound(100, cEth, comptroller, cUni)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "BorrowErc20FromCompound").withArgs(borrowAmount, cUni);
        });
    });

    describe("Repay Eth to Compound", () => {
        let data: string;
        let borrowData: string;
        let supplyData: string;
        let repayAmount: BigNumber;
        let borrowAmount: BigNumber;
        let supplyAmount: BigNumber;

        beforeEach(async () => {
            repayAmount = ethers.utils.parseEther("5");
            borrowAmount = ethers.utils.parseEther("10");
            supplyAmount = ethers.utils.parseEther("50");
            data = encodeFunctionData(abi, "repayEthToCompound", [
                repayAmount,
                cEth
            ]);
            borrowData = encodeFunctionData(abi, "borrowEthFromCompound", [
                borrowAmount,
                cEth,
                comptroller,
            ]);
            supplyData = encodeFunctionData(abi, "supplyEthToCompound", [
                supplyAmount,
                cEth
            ]);
            // supplying 50 eth 
            let tx = safeTx(contract.address, 0, supplyData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            // borrowing 10 eth
            tx = safeTx(contract.address, 0, borrowData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
        });
        it("should have a borrowed balance", async () => {
            const borrowedBalance = await cEthContract.borrowBalanceCurrent(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(borrowedBalance)))).to.be.greaterThan(9);
        });
        it("should be able to repay borrowed eth", async () => {
            const initBalance = await cEthContract.borrowBalanceCurrent(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(initBalance)))).to.be.greaterThan(9);
            // Repaying 5 eth
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            const postBalance = await cEthContract.borrowBalanceCurrent(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(postBalance)))).to.be.lessThan(6);
        });
        it("should revert: repaying more than debt", async () => {
            const txData = encodeFunctionData(abi, "repayEthToCompound", [
                ethers.utils.parseEther("40"),
                cEth,
            ]);
            const tx = safeTx(contract.address, 0, txData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.be.revertedWith("'GS013'");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.repayEthToCompound(100, cEth)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "RepayEthToCompound").withArgs(repayAmount);
        });
    });

    describe("Repay Erc20 to Compound", () => {
        let data: string;
        let borrowData: string;
        let supplyData: string;
        let repayAmount: BigNumber;
        let borrowAmount: BigNumber;
        let supplyAmount: BigNumber;
        let uniCompContract: Contract;
        let uniContract: Contract;

        beforeEach(async () => {
            repayAmount = ethers.utils.parseEther("500"); // 500 uni
            borrowAmount = ethers.utils.parseEther("1000"); // 1000 uni
            supplyAmount = ethers.utils.parseEther("50"); // 50 ETH
            supplyData = encodeFunctionData(abi, "supplyEthToCompound", [
                supplyAmount,
                cEth
            ]);
            borrowData = encodeFunctionData(abi, "borrowErc20FromCompound", [
                borrowAmount,
                cEth,
                comptroller,
                cUni
            ]);
            data = encodeFunctionData(abi, "repayErc20ToCompound", [
                repayAmount,
                uniToken,
                cUni
            ]);
            uniCompContract = new ethers.Contract(cUni, erc20Abi, owner);
            uniContract = new ethers.Contract(uniToken, erc20Abi, owner);
            // supplying 50 eth
            let tx = safeTx(contract.address, 0, supplyData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            // borrowing 1000 uni
            tx = safeTx(contract.address, 0, borrowData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
        });
        it("should have UNI borrowed balance", async () => {
            const borrowedBalance = await uniCompContract.borrowBalanceCurrent(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(borrowedBalance)))).to.be.greaterThan(998); // we have 1000 uni borrowed.
            // we can check with exact precision by just calling uni contract directly.
            const uniBalance = await uniContract.balanceOf(contract.address);
            expect(uniBalance).to.equal(borrowAmount);
        });
        it("should be able to repay borrowed UNI", async () => {
            const initBalance = await uniCompContract.borrowBalanceCurrent(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(initBalance)))).to.be.greaterThan(998);
            // repaying 500 uni. 
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            );
            const postBalance = await uniCompContract.borrowBalanceCurrent(contract.address);
            expect(Math.trunc(Number(ethers.utils.formatEther(postBalance)))).to.be.lessThan(501);
        });
        it("should revert: repaying more than actual balance", async () => {
            const txData = encodeFunctionData(abi, "repayErc20ToCompound", [
                ethers.utils.parseEther("400"),
                uniToken,
                cEth,
            ]);
            const tx = safeTx(contract.address, 0, txData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.be.revertedWith("GS013");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.repayErc20ToCompound(100, uniToken, cUni)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "RepayErc20ToCompound").withArgs(repayAmount, uniToken);
        });
    });
});


