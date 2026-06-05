const { expect } = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("ETHStaking", function () {
  let staking, owner, alice, bob;

  const ONE_ETH   = ethers.parseEther("1");
  const HALF_ETH  = ethers.parseEther("0.5");
  const FIVE_ETH  = ethers.parseEther("5");
  const FUND_AMT  = ethers.parseEther("10");  // seed the contract for rewards

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ETHStaking");
    staking = await Factory.deploy();
    await staking.waitForDeployment();
    // fund the contract so reward payouts succeed
    await owner.sendTransaction({ to: await staking.getAddress(), value: FUND_AMT });
  });

  // ─── Staking Tests ──────────────────────────────────────────────────────────
  describe("Staking", function () {
    it("stakes ETH successfully and records position", async function () {
      await expect(staking.connect(alice).stake({ value: ONE_ETH }))
        .to.emit(staking, "StakeCreated")
        .withArgs(alice.address, 0, ONE_ETH, anyValue);

      const pos = await staking.getStake(alice.address, 0);
      expect(pos.amount).to.equal(ONE_ETH);
      expect(pos.active).to.be.true;
      expect(await staking.totalStaked()).to.equal(ONE_ETH);
    });

    it("allows multiple independent stakes per user", async function () {
      await staking.connect(alice).stake({ value: HALF_ETH });
      await staking.connect(alice).stake({ value: ONE_ETH });

      expect(await staking.getStakeCount(alice.address)).to.equal(2);

      const pos0 = await staking.getStake(alice.address, 0);
      const pos1 = await staking.getStake(alice.address, 1);
      expect(pos0.amount).to.equal(HALF_ETH);
      expect(pos1.amount).to.equal(ONE_ETH);
    });

    it("reverts when staking 0 ETH", async function () {
      await expect(staking.connect(alice).stake({ value: 0 }))
        .to.be.revertedWith("Must stake more than 0 ETH");
    });

    it("reverts when paused", async function () {
      await staking.connect(owner).pause();
      await expect(staking.connect(alice).stake({ value: ONE_ETH }))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
    });
  });

  // ─── Tiered APR Tests ────────────────────────────────────────────────────────
  describe("Tiered APR", function () {
    it("APR_TIER1 constant is 5% (500 bps)", async function () {
      expect(await staking.APR_TIER1()).to.equal(500);
    });

    it("APR_TIER2 constant is 8% (800 bps)", async function () {
      expect(await staking.APR_TIER2()).to.equal(800);
    });

    it("APR_TIER3 constant is 12% (1200 bps)", async function () {
      expect(await staking.APR_TIER3()).to.equal(1200);
    });

    it("reward for < 1 ETH uses 5% APR", async function () {
      await staking.connect(alice).stake({ value: HALF_ETH });
      await time.increase(365 * 24 * 60 * 60);
      const reward = await staking.calculateReward(alice.address, 0);
      // 0.5 ETH * 5% * 1 year = 0.025 ETH
      expect(reward).to.be.closeTo(ethers.parseEther("0.025"), ethers.parseEther("0.0001"));
    });

    it("reward for 1–4.99 ETH uses 8% APR", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(365 * 24 * 60 * 60);
      const reward = await staking.calculateReward(alice.address, 0);
      // 1 ETH * 8% * 1 year = 0.08 ETH
      expect(reward).to.be.closeTo(ethers.parseEther("0.08"), ethers.parseEther("0.0001"));
    });

    it("reward for 5+ ETH uses 12% APR", async function () {
      await staking.connect(alice).stake({ value: FIVE_ETH });
      await time.increase(365 * 24 * 60 * 60);
      const reward = await staking.calculateReward(alice.address, 0);
      // 5 ETH * 12% * 1 year = 0.6 ETH
      expect(reward).to.be.closeTo(ethers.parseEther("0.6"), ethers.parseEther("0.001"));
    });
  });

  // ─── Reward Tests ────────────────────────────────────────────────────────────
  describe("Rewards", function () {
    it("accumulates rewards over time", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });

      // Advance 30 days
      await time.increase(30 * 24 * 60 * 60);

      const reward = await staking.calculateReward(alice.address, 0);
      // Expected: 1 ETH * 8% * (30/365) ≈ 0.00657 ETH
      expect(reward).to.be.gt(0);
      // Sanity: reward < 1% of principal for 30 days
      expect(reward).to.be.lt(ethers.parseEther("0.01"));
    });

    it("claims rewards and resets lastClaimedAt", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(30 * 24 * 60 * 60);

      const rewardBefore = await staking.calculateReward(alice.address, 0);
      const balBefore    = await ethers.provider.getBalance(alice.address);

      const tx = await staking.connect(alice).claimRewards(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;

      const balAfter = await ethers.provider.getBalance(alice.address);
      expect(balAfter).to.be.closeTo(balBefore + rewardBefore - gasCost, ethers.parseEther("0.0001"));

      // Reward should reset to ~0 right after claim
      const rewardAfter = await staking.calculateReward(alice.address, 0);
      expect(rewardAfter).to.equal(0);
    });

    it("emits RewardClaimed event", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(365 * 24 * 60 * 60); // 1 year

      await expect(staking.connect(alice).claimRewards(0))
        .to.emit(staking, "RewardClaimed")
        .withArgs(alice.address, 0, anyValue);
    });

    it("reverts if stake is already withdrawn", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(8 * 24 * 60 * 60);
      await staking.connect(alice).unstake(0);
      await expect(staking.connect(alice).claimRewards(0))
        .to.be.revertedWith("Stake already withdrawn");
    });
  });

  // ─── Withdrawal Tests ────────────────────────────────────────────────────────
  describe("Withdrawal", function () {
    it("normal withdrawal after lock period returns principal + reward", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(8 * 24 * 60 * 60); // 8 days — past 7-day lock

      const balBefore = await ethers.provider.getBalance(alice.address);
      const reward    = await staking.calculateReward(alice.address, 0);

      const tx = await staking.connect(alice).unstake(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;

      const balAfter = await ethers.provider.getBalance(alice.address);
      const expected = balBefore + ONE_ETH + reward - gasCost;
      expect(balAfter).to.be.closeTo(expected, ethers.parseEther("0.0001"));

      const pos = await staking.getStake(alice.address, 0);
      expect(pos.active).to.be.false;
    });

    it("early withdrawal applies 10% penalty on principal", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(3 * 24 * 60 * 60); // 3 days — within lock

      const penalty = (ONE_ETH * 1000n) / 10_000n; // 0.1 ETH

      await expect(staking.connect(alice).unstake(0))
        .to.emit(staking, "PenaltyApplied")
        .withArgs(alice.address, 0, penalty);

      expect(await staking.totalPenaltiesCollected()).to.equal(penalty);
    });

    it("prevents double withdrawal", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(8 * 24 * 60 * 60);
      await staking.connect(alice).unstake(0);

      await expect(staking.connect(alice).unstake(0))
        .to.be.revertedWith("Stake already withdrawn");
    });

    it("emits StakeWithdrawn event", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(8 * 24 * 60 * 60);

      await expect(staking.connect(alice).unstake(0))
        .to.emit(staking, "StakeWithdrawn");
    });
  });

  // ─── Emergency Withdrawal Tests ──────────────────────────────────────────────
  describe("Emergency Withdrawal", function () {
    it("reverts if emergency mode is not active", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await expect(staking.connect(alice).emergencyWithdraw(0))
        .to.be.revertedWith("Emergency mode not active");
    });

    it("returns only principal, no rewards", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(30 * 24 * 60 * 60);
      await staking.connect(owner).setEmergencyMode(true);

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await staking.connect(alice).emergencyWithdraw(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;

      const balAfter = await ethers.provider.getBalance(alice.address);
      expect(balAfter).to.be.closeTo(balBefore + ONE_ETH - gasCost, ethers.parseEther("0.0001"));
    });
  });

  // ─── Ownership Tests ─────────────────────────────────────────────────────────
  describe("Ownership", function () {
    it("only owner can pause", async function () {
      await expect(staking.connect(alice).pause())
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("owner can pause and unpause", async function () {
      await staking.connect(owner).pause();
      expect(await staking.paused()).to.be.true;
      await staking.connect(owner).unpause();
      expect(await staking.paused()).to.be.false;
    });

    it("only owner can enable emergency mode", async function () {
      await expect(staking.connect(alice).setEmergencyMode(true))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("owner can enable emergency mode", async function () {
      await expect(staking.connect(owner).setEmergencyMode(true))
        .to.emit(staking, "EmergencyModeSet")
        .withArgs(true);
      expect(await staking.emergencyMode()).to.be.true;
    });

    it("anyone can fund the contract via receive()", async function () {
      const contractAddr = await staking.getAddress();
      const balBefore = await ethers.provider.getBalance(contractAddr);
      await alice.sendTransaction({ to: contractAddr, value: ONE_ETH });
      const balAfter = await ethers.provider.getBalance(contractAddr);
      expect(balAfter - balBefore).to.equal(ONE_ETH);
    });
  });

  // ─── Treasury Tests ───────────────────────────────────────────────────────────
  describe("Treasury", function () {
    it("tracks totalStaked correctly across multiple stakes", async function () {
      await staking.connect(alice).stake({ value: HALF_ETH });
      await staking.connect(bob).stake({ value: ONE_ETH });
      expect(await staking.totalStaked()).to.equal(HALF_ETH + ONE_ETH);
    });

    it("updates totalStaked after unstake", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(8 * 24 * 60 * 60);
      await staking.connect(alice).unstake(0);
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("tracks totalRewardsPaid after claim", async function () {
      await staking.connect(alice).stake({ value: ONE_ETH });
      await time.increase(30 * 24 * 60 * 60);
      await staking.connect(alice).claimRewards(0);
      expect(await staking.totalRewardsPaid()).to.be.gt(0);
    });
  });
});
