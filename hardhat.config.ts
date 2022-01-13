require("dotenv").config();
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";

const RINKEBY_URL = process.env.URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;

module.exports = {
  solidity: "0.8.3",
  networks: {
    //   rinkeby: {
    //     url: URL,
    //     accounts: [`0x${PRIVATE_KEY}`]
    //   }
    // }, etherscan: {
    //   apiKey: "WCG58ENQ5WV7RGV9QX3DWTT8ZTMIXTVHJY"
    hardhat: {
      forking: {
        url: ALCHEMY_URL
      }
    }
  }
};
