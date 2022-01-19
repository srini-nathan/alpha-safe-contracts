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
        await owner.sendTransaction({
            to: proxyAddress,
            value: ethers.utils.parseEther("100")
        });
    });

    // describe("Correct setup", () => {
    //     it("should have a threshold of 1", async () => {
    //         const _threshold = await contract.getThreshold();
    //         expect(_threshold.toString()).to.equal("1");
    //     });
    //     it("should have a balance of 100 ether", async () => {
    //         const balance = await ethers.provider.getBalance(contract.address);
    //         expect(ethers.utils.formatEther(balance)).to.equal("100.0");
    //     });
    //     it("chainId should be '1' (mainnet)", async () => {
    //         const chainId = (await contract.getChainId()).toString();
    //         expect(chainId).to.equal("1");
    //     });
    //     it("should have the owner as owner", async () => {
    //         const arrayOfOwners = await contract.getOwners();
    //         expect(arrayOfOwners.length).to.equal(1);
    //         const result = await contract.isOwner(ownerAddress);
    //         expect(result).to.equal(true);
    //     });
    // });

    describe("Swap Exact Input Single", () => {
        let daiContract: Contract;
        let wethContract: Contract;
        let data: string;
        let amount: BigNumber;
        let impAccount: Signer;

        beforeEach(async () => {
            daiContract = new ethers.Contract(DAI, erc20Abi, owner);
            wethContract = new ethers.Contract(WETH, erc20Abi, owner);
            amount = ethers.utils.parseEther("10");
            data = encodeFunctionData(abi, "swapExactInputSingle", [
                amount, swapRouter, addressZero, DAI, 0, 3000
            ]);
        });
        it("should swap Eth Dai", async () => {
            const tx = safeTx(contract.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
            // Check that the contract has 0 DAI
            let daiBalance = await daiContract.balanceOf(contract.address);
            let ethBalance = await ethers.provider.getBalance(contract.address);
            expect(daiBalance).to.equal(0);
            expect(ethBalance).to.equal(ethers.utils.parseEther("100"));
            await contract.execTransaction(
                tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas,
                tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.signature
            );
            daiBalance = await daiContract.balanceOf(contract.address);
            ethBalance = await ethers.provider.getBalance(contract.address);
            console.log(ethers.utils.formatEther(daiBalance));
            console.log(ethers.utils.formatEther(ethBalance));
        });
    });
});

