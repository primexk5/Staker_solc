require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const { PRIVATE_KEY, ALCHEMY_API_KEY, ETHERSCAN_API_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: ALCHEMY_API_KEY,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      timeout: 120000,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
