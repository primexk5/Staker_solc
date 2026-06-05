require("dotenv").config();
const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  // Deploy
  const Factory = await ethers.getContractFactory("ETHStaking");
  const staking = await Factory.deploy();
  await staking.waitForDeployment();
  const address = await staking.getAddress();
  console.log("ETHStaking deployed to:", address);

  // Fund with 0.1 ETH to cover initial reward payouts
  const fundTx = await deployer.sendTransaction({
    to: address,
    value: ethers.parseEther("0.1"),
  });
  await fundTx.wait();
  console.log("Contract funded with 0.1 ETH");

  // Export ABI + address for the frontend
  const artifact = await hre.artifacts.readArtifact("ETHStaking");
  const exportData = {
    address,
    abi: artifact.abi,
  };

  const outDir = path.join(__dirname, "../../frontend/src/lib");
  if (fs.existsSync(path.join(__dirname, "../../frontend"))) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "contract.json"),
      JSON.stringify(exportData, null, 2)
    );
    console.log("ABI + address written to frontend/src/lib/contract.json");
  }

  console.log("\nNext steps:");
  console.log(
    `  npx hardhat verify --network sepolia ${address}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
