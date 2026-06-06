import { parseAbi } from 'viem';
import type { Address } from 'viem';

export const CONTRACT_ADDRESS = "0x2965Cd636020D1FdE8fb455B4aC54018F25438A1" as Address;
export const SEPOLIA_CHAIN_ID = 11155111;

export const ABI = [
  "function stake() external payable",
  "function claimRewards(uint256 stakeId) external",
  "function unstake(uint256 stakeId) external",
  "function emergencyWithdraw(uint256 stakeId) external",
  "function getStake(address user, uint256 stakeId) external view returns (tuple(uint256 amount, uint256 stakedAt, uint256 lastClaimedAt, bool active))",
  "function getStakeCount(address user) external view returns (uint256)",
  "function calculateReward(address user, uint256 stakeId) external view returns (uint256)",
  "function withdrawFunds(uint256 amount) external",
  "function pause() external",
  "function unpause() external",
  "function setEmergencyMode(bool enabled) external",
  "function totalStaked() external view returns (uint256)",
  "function totalRewardsPaid() external view returns (uint256)",
  "function totalPenaltiesCollected() external view returns (uint256)",
  "function emergencyMode() external view returns (bool)",
  "function paused() external view returns (bool)",
  "function LOCK_PERIOD() external view returns (uint256)",
  "function APR_TIER1() external view returns (uint256)",
  "function APR_TIER2() external view returns (uint256)",
  "function APR_TIER3() external view returns (uint256)",
  "event StakeCreated(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 timestamp)",
  "event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward)",
  "event StakeWithdrawn(address indexed user, uint256 indexed stakeId, uint256 principal, uint256 reward)",
  "event PenaltyApplied(address indexed user, uint256 indexed stakeId, uint256 penaltyAmount)",
  "event FundsWithdrawn(address indexed owner, uint256 amount)",
] as const;

export const VIEM_ABI = parseAbi([
  "function stake() external payable",
  "function claimRewards(uint256 stakeId) external",
  "function unstake(uint256 stakeId) external",
]);
