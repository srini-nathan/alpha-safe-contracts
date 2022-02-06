import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

import { VERSION, addressZero } from "../utils";

describe("AlphaSafe.sol deployment", () => {
    let hacker: Signer;
    let AlphaSafe: any;
    let baseContract: Contract;

    beforeEach(async () => {
        [hacker] = await ethers.getSigners();
        AlphaSafe = await ethers.getContractFactory("AlphaSafe");
        baseContract = await AlphaSafe.deploy();
    });

    describe("Base contract correct deployemnent", () => {

        it("should deploy with a threshold of 1", async () => {
            let threshold = await baseContract.getThreshold();
            expect(threshold.toString()).to.equal("1");
        });
        it("should not allow to setup", async () => {
            let owners = [await hacker.getAddress()];
            let threshold = 1;
            await expect(baseContract.setup(
                owners,
                threshold
            )).to.be.revertedWith("'GS200'");

        });
        it("should not have owners", async () => {
            await expect(baseContract.getOwners()).to.be.revertedWith("0x32");
        });
        it(`should be version ${VERSION}`, async () => {
            let version = await baseContract.VERSION();
            expect(version === VERSION);
        });
        it("should have a nonce of 0", async () => {
            let nonce = await baseContract.nonce();
            expect(nonce.toString()).to.equal("0");
        });
    });

});


