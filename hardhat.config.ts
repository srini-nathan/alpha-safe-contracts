import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";

require("dotenv").config();

const RINKEBY_URL = process.env.URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

if (PRIVATE_KEY?.length != 64) {
  console.error(`Incorrect Private Key!, length should be 64 but it is: ${PRIVATE_KEY?.length}`);
}


module.exports = {
  solidity: {
    version: "0.8.3",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      }
    }
  },
  networks: {
    //   rinkeby: {
    //     url: ALCHEMY_URL,
    //     accounts: [`0x${PRIVATE_KEY}`]
    //   }
    // }, etherscan: {
    // apiKey: ALCHEMY_KEY
    hardhat: {
      forking: {
        url: ALCHEMY_URL
      }
    }
  },
  mocha: {
    timeout: 40000
  }
};

