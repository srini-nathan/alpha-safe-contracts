import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import hre from "hardhat";

require("dotenv").config();

import { encodeFunctionData, executorSignature, singletonAbi, erc20Abi, safeTx, addressZero } from "../utils";

//latest abi
const { abi } = require("../../artifacts/contracts/AlphaSafe.sol/AlphaSafe.json");

const rEth = "0xae78736Cd615f374D3085123A210448E74Fc6393"; // Rocket Pool ETH.
const rocketStorage = "0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46";

describe("AlphaStake.sol", () => {
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
    let initialFunding: BigNumber;
    let rEthContract: Contract;


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
        contract = new ethers.Contract(proxyAddress, abi, owner);
        // Funding the contract with 100 eth.
        initialFunding = ethers.utils.parseEther("100");
        await owner.sendTransaction({
            to: proxyAddress,
            value: initialFunding
        });
        rEthContract = new ethers.Contract(rEth, erc20Abi, owner);
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

    describe("Staking eth and getting rEth in return", async () => {
        let stakingData: string;
        let stakingAmount: BigNumber;

        beforeEach(async () => {
            stakingAmount = ethers.utils.parseEther("1");
            stakingData = encodeFunctionData(abi, "stakeEth", [stakingAmount, rocketStorage]);
        });
        it("should not have any rEth", async () => {
            const balance = await rEthContract.balanceOf(contract.address);
            expect(balance).to.equal(0);
        });
        it("should be able to stake eth and get rEth", async () => {
            const tx = safeTx(contract.address, 0, stakingData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
        });
        it("should revert by calling the function directly", async () => {
            await expect(contract.stakeEth(stakingAmount, rocketStorage)).to.be.revertedWith("'GS031'");
        });
        it("should emit correct events", async () => {
            const tx = safeTx(contract.address, 0, stakingData, 0, 0, 0, 0, addressZero, addressZero, signature);
            await expect(contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken,
                tx.refundReceiver, tx.signature
            )).to.emit(contract, "StakeEth").withArgs(stakingAmount);
        });
    });
});








