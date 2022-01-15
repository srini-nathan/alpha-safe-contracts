import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import hre from "hardhat";


import { encodeFunctionData, executorSignature, singletonAbi, erc20Abi } from "../utils";
import { sign } from "crypto";


//latest abi.
const { abi } = require("../../artifacts/contracts/AlphaSafe.sol/AlphaSafe.json");
const cEth = "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5"; //Address of compound eth on mainnet.
const addressZero = "0x0000000000000000000000000000000000000000";
const uniToken = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"; //Address of uni token mainnet.
const cUni = "0x35a18000230da775cac24873d00ff85bccded550"; // Address of cUni token on mainnet.
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
        singletonAddress = await singleton.address;
        const tx = await proxyFactory.createProxyWithNonce(singletonAddress, data, 1111);
        const receipt = await tx.wait();
        proxyAddress = receipt.events[1].args.proxy;
        contract = new ethers.Contract(proxyAddress, abi, owner); //proxy
        // Funding the contract with 100 eth.
        await owner.sendTransaction({
            to: proxyAddress,
            value: ethers.utils.parseEther("100")
        });

    });

    describe("Correct setup", () => {
        it("should have a threshold of 1", async () => {
            let _threshold = await contract.getThreshold();
            expect(_threshold.toString()).to.equal("1");
        });
        it("should have a balance of 100 ether", async () => {
            const balance = await ethers.provider.getBalance(contract.address);
            expect(ethers.utils.formatEther(balance)).to.equal("100.0");
        });
        it("chainId should be '1' (mainnet)", async () => {
            const chainId = (await contract.getChainId()).toString();
            expect(chainId).to.equal("1");
        });
        it("should have the owner as owner", async () => {
            let arrayOfOwners = await contract.getOwners();
            expect(arrayOfOwners.length).to.equal(1);
            let result = await contract.isOwner(ownerAddress);
            expect(result).to.equal(true);
        });
    });

    describe("Supply eth to Compound", () => {
        let data: string;

        beforeEach(async () => {
            // data to supply 50 eth to Compound
            data = encodeFunctionData(abi, "supplyEthToCompound", [
                ethers.utils.parseEther("50"),
                cEth
            ]);
        });
        it("should have 0 balance in cEther", async () => {
            const balance = (await cEthContract.balanceOfUnderlying(contract.address)).toString();
            expect(balance).to.equal("0");
        });
        it("should supply 50 eth to Compound and update balance", async () => {
            // Supplying 50 eth to Compound.
            await contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            );
            const balance = (await cEthContract.balanceOfUnderlying(contract.address)).toString();
            expect((balance / 1e18)).to.be.greaterThan(49.98); //gas.
        });
        it("should fail by trying to supply more eth than the current balance", async () => {
            const txFailure = encodeFunctionData(abi, "supplyEthToCompound", [
                ethers.utils.parseEther("101"),
                cEth
            ]);
            await expect(contract.execTransaction(
                contract.address,
                0,
                txFailure,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            )).to.be.reverted;
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.supplyEthToCompound(100, cEth)).to.be.revertedWith("'GS031'");
        });
    });

    describe("Redeem eth from Compound", () => {
        let data: string;
        let redeemData: string;

        beforeEach(async () => {
            // data to supply 10 eth to Compound.
            data = encodeFunctionData(abi, "supplyEthToCompound", [
                ethers.utils.parseEther("10"),
                cEth
            ]);
            // data to redeem 5 eth from Compound.
            redeemData = encodeFunctionData(abi, "redeemEthFromCompound", [
                ethers.utils.parseEther("5"),
                cEth
            ]);
            // Supplying 10 eth to Compound
            await contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await contract.execTransaction(
                contract.address,
                0,
                redeemData,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await expect(contract.execTransaction(
                contract.address,
                0,
                txFailure,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            )).to.be.reverted;
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.redeemEthFromCompound(100, cEth)).to.be.revertedWith("'GS031'");
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
            await expect(contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await contract.execTransaction(
                contract.address,
                0,
                supplyData,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            expect(Math.trunc(Number(ethers.utils.formatEther(cBalance)))).to.be.greaterThan(998);
            expect(uniBalance).to.equal(0);
            await contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            );
            uniBalance = await uniContract.balanceOf(contract.address);
            expect(uniBalance).to.equal(amount); // we get uni tokens back.
        });
        it("should emit 'ReddemErc20FromCompound' event", async () => {
            expect(await contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            )).to.emit(contract, "RedeemErc20FromCompound");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.redeemErc20FromCompound(amount, cUni)).to.be.revertedWith("'GS031'");
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
            await contract.execTransaction(
                contract.address,
                0,
                supplyData,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await expect(contract.execTransaction(
                contract.address,
                0,
                txData,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            )).to.be.revertedWith("'GS013'");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.redeemErc20FromCompound(amount, cUni)).to.be.revertedWith("'GS031'");
        });
    });

    describe("Borrow Erc20 (Uni) from Compound", () => {
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
            await contract.execTransaction(
                contract.address,
                0,
                supplyData,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await contract.execTransaction(
                contract.address,
                0,
                data,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
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
            await expect(contract.execTransaction(
                contract.address,
                0,
                txData,
                0,
                0,
                0,
                0,
                addressZero,
                addressZero,
                signature
            )).to.be.revertedWith("'GS013'");
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.borrowErc20FromCompound(100, cEth, comptroller, cUni)).to.be.revertedWith("'GS031'");
        });
    });
}); 
