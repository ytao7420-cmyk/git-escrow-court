require("@nomicfoundation/hardhat-viem");

/** Local Hardhat network only. No private key and no forked mainnet. */
module.exports = {
  solidity: "0.8.26",
  paths: {
    sources: "./contracts-evm",
    tests: "./test/evm",
    cache: "./artifacts/hardhat-cache",
    artifacts: "./artifacts/hardhat",
  },
};
