import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import hre from "hardhat";

import { encodeFunctionData, executorSignature, singletonAbi, erc20Abi, safeTx } from "../utils";


//latest abi. 
const { abi } = require("../../artifacts/contracts/AlphaSafe.sol/AlphaSafe.json");

const addressZero = "0x0000000000000000000000000000000000000000";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const swapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const uniToken = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"; //Address of uni token mainnet.

describe("AlphaSwap.sol", () => {
    let owner: Signer;
    let owners: string[];
    let threshold: number;
    let ownerAddress: string;
    let signature: string;
    let proxyAddress: string;
    let contract: Contract;
    let data: string;
    let ProxyFactory: any;
    let proxyFactory: Contract;
    let AlphaSafe: any;
    let singleton: Contract;
    let singletonAddress: string;
    let daiContract: Contract;
    let uniContract: Contract;
    let wethContract: Contract;
    let initialFunding: BigNumber;

    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        owners = [ownerAddress];
        threshold = 1;
        signature = "0x" + executorSignature(ownerAddress);
        data = encodeFunctionData(singletonAbi, "setup", [owners, threshold]);
        ProxyFactory = await ethers.getContractFactory("AlphaSafeProxyFactory");
        proxyFactory = await ProxyFactory.deploy();
        AlphaSafe = await ethers.getContractFactory("AlphaSafe");
        singleton = await AlphaSafe.deploy();
        singletonAddress = singleton.address;
        const tx = await proxyFactory.createProxyWithNonce(singletonAddress, data, 1111);
        const receipt = await tx.wait();
        proxyAddress = receipt.events[1].args.proxy;
        contract = new ethers.Contract(proxyAddress, abi, owner); //proxy
        // Funding the contract with 100 eth.
        initialFunding = ethers.utils.parseEther("100");
        await owner.sendTransaction({
            to: proxyAddress,
            value: initialFunding
        });
        daiContract = new ethers.Contract(DAI, erc20Abi, owner);
        wethContract = new ethers.Contract(WETH, erc20Abi, owner);
        uniContract = new ethers.Contract(uniToken, erc20Abi, owner);
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

    describe("Should swap from Eth", () => {
        let amount: BigNumber;
        let daiData: string;
        let uniData: string;

        beforeEach(async () => {
            amount = ethers.utils.parseEther("10");
            daiData = encodeFunctionData(abi, "swapExactInputSingle", [
                amount, swapRouter, addressZero, DAI, 0, 3000
            ]);
            uniData = encodeFunctionData(abi, "swapExactInputSingle", [
                amount, swapRouter, addressZero, uniToken, 0, 3000
            ]);
        });
        it("should swap Eth to Dai", async () => {
            const tx = safeTx(contract.address, 0, daiData, 0, 0, 0, 0, addressZero, addressZero, signature);
            // Check that the balance is 0 dai.
            let daiBalance = await daiContract.balanceOf(contract.address);
            expect(daiBalance).to.equal(0);
            const transaction = await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            const receipt = await transaction.wait();
            const amountOut = (receipt.events[5].args.amountOut).toString();
            daiBalance = await daiContract.balanceOf(contract.address);
            expect(Math.trunc(Number(daiBalance))).to.be.greaterThan(0);
            expect(daiBalance).to.equal(amountOut);
        });
        it("should swap Eth to UNI", async () => {
            const tx = safeTx(contract.address, 0, uniData, 0, 0, 0, 0, addressZero, addressZero, signature);
            // Check that the balance is 0 uni.
            let uniBalance = await uniContract.balanceOf(contract.address);
            expect(uniBalance).to.equal(0);
            const transaction = await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            const receipt = await transaction.wait();
            const amountOut = (receipt.events[5].args.amountOut).toString();
            uniBalance = await uniContract.balanceOf(contract.address);
            expect(Math.trunc(Number(uniBalance))).to.be.greaterThan(0);
            expect(uniBalance).to.equal(amountOut);
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.swapExactInputSingle(
                amount, swapRouter, addressZero, DAI, 0, 3000
            )).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, uniData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "SwapExactInputSingle");
        });
    });

    describe("Should swap to Eth", () => {
        let amount: BigNumber | string;
        let ethOut: BigNumber;
        let daiOut: BigNumber | string;
        let daiData: string;
        let data: string;

        beforeEach(async () => {
            // First we need to swap eth to dai so we have some erc-20.
            ethOut = initialFunding; // swapping all eth to dai.
            daiData = encodeFunctionData(abi, "swapExactInputSingle", [
                ethOut, swapRouter, addressZero, DAI, 0, 3000
            ]);
            const tx = safeTx(contract.address, 0, daiData, 0, 0, 0, 0, addressZero, addressZero, signature);
            const transaction = await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            const receipt = await transaction.wait();
            daiOut = (receipt.events[5].args.amountOut).toString();
            ///////////////////////////////////////////////////////////
            // This is the data to swap back to eth. 
            amount = daiOut.toString();
            data = encodeFunctionData(abi, "swapExactInputSingle", [
                amount, swapRouter, DAI, addressZero, 0, 3000
            ]);
        });
        it("should have some dai", async () => {
            const daiBalance = await daiContract.balanceOf(contract.address);
            expect(Math.trunc(Number(daiBalance))).to.be.greaterThan(0);
            expect(daiBalance).to.equal(daiOut);
            const bal = await ethers.provider.getBalance(contract.address);
        });
        it("should exchange dai to Eth", async () => {
            let ethBalance = await ethers.provider.getBalance(contract.address);
            expect(ethBalance).to.equal("0");
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            const transaction = await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            const receipt = await transaction.wait();
            const amountOut = (receipt.events[4].args.value).toString();
            ethBalance = await ethers.provider.getBalance(contract.address);
            expect(Math.trunc(Number(ethBalance))).to.be.greaterThan(0);
            expect(ethBalance).to.equal(amountOut);
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "SwapExactInputSingle");
        });
    });

    describe("Should swap from an erc20 to an erc20", () => {
        let daiOut: BigNumber | string;
        let uniOut: BigNumber | string;

        beforeEach(async () => {
            const ethOut = ethers.utils.parseEther("1");
            // 1. We need to swap eth to dai and eth to uni so we have 2 erc-20.
            ///////////ETH TO DAI///////////////////////////////////
            const daiData = encodeFunctionData(abi, "swapExactInputSingle", [
                ethOut, swapRouter, addressZero, DAI, 0, 3000
            ]);
            const daiTx = safeTx(contract.address, 0, daiData, 0, 0, 0, 0, addressZero, addressZero, signature);
            const daiTransaction = await contract.execTransaction(
                daiTx.to, daiTx.value, daiTx.data, daiTx.operation, daiTx.safeTxGas, daiTx.baseGas,
                daiTx.gasPrice, daiTx.gasToken, daiTx.refundReceiver, daiTx.signature
            );
            const daiReceipt = await daiTransaction.wait();
            daiOut = (daiReceipt.events[5].args.amountOut).toString();
            ////////////////////////////////////////////////////////////////////
            ///////////////ETH TO UNI
            const uniData = encodeFunctionData(abi, "swapExactInputSingle", [
                ethOut, swapRouter, addressZero, uniToken, 0, 3000
            ]);
            const uniTx = safeTx(contract.address, 0, uniData, 0, 0, 0, 0, addressZero, addressZero, signature);
            const uniTransaction = await contract.execTransaction(
                uniTx.to, uniTx.value, uniTx.data, uniTx.operation, uniTx.safeTxGas, uniTx.baseGas,
                uniTx.gasPrice, uniTx.gasToken, uniTx.refundReceiver, uniTx.signature
            );
            const uniReceipt = await uniTransaction.wait();
            uniOut = (uniReceipt.events[5].args.amountOut).toString();
        });
        it("should have UNI and DAI", async () => {
            const daiBalance = await daiContract.balanceOf(contract.address);
            const uniBalance = await uniContract.balanceOf(contract.address);
            expect(Math.trunc(Number(daiBalance))).to.be.greaterThan(0);
            expect(Math.trunc(Number(uniBalance))).to.be.greaterThan(0);
            expect(daiBalance).to.equal(daiOut);
            expect(uniBalance).to.equal(uniOut);
        });
        it("should swap uni to dai", async () => {
            const data = encodeFunctionData(abi, "swapExactInputSingle", [
                uniOut, swapRouter, uniToken, DAI, 0, 3000
            ]);
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            // post swap
            const uniBalance = await uniContract.balanceOf(contract.address);
            const daiBalance = await daiContract.balanceOf(contract.address);
            expect(uniBalance).to.equal(0);
            expect(Math.trunc(Number(daiBalance))).to.be.greaterThan(Math.trunc(Number(daiOut)));
        });
        it("should swap dai to uni", async () => {
            const data = encodeFunctionData(abi, "swapExactInputSingle", [
                daiOut, swapRouter, DAI, uniToken, 0, 3000
            ]);
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            // post swap
            const daiBalance = await daiContract.balanceOf(contract.address);
            const uniBalance = await uniContract.balanceOf(contract.address);
            expect(daiBalance).to.equal(0);
            expect(Math.trunc(Number(uniBalance))).to.be.greaterThan(Math.trunc(Number(uniOut)));

        });
        it("should emit correct events", async () => {
            const data = encodeFunctionData(abi, "swapExactInputSingle", [
                daiOut, swapRouter, DAI, uniToken, 0, 3000
            ]);
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "SwapExactInputSingle");
        });
    });
});










