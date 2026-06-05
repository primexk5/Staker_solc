// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ETHStaking is Ownable, Pausable, ReentrancyGuard {
    uint256 public constant LOCK_PERIOD      = 7 days;
    uint256 public constant PENALTY_BPS      = 1000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    uint256 public constant APR_TIER1 = 500;   // 5%   — 0 to <1 ETH
    uint256 public constant APR_TIER2 = 800;   // 8%   — 1 to <5 ETH
    uint256 public constant APR_TIER3 = 1200;  // 12%  — 5+ ETH

    struct StakePosition {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastClaimedAt;
        bool    active;
    }

    mapping(address => StakePosition[]) private _stakes;

    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    uint256 public totalPenaltiesCollected;

    bool public emergencyMode;

    event StakeCreated(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 timestamp);
    event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event StakeWithdrawn(address indexed user, uint256 indexed stakeId, uint256 principal, uint256 reward);
    event PenaltyApplied(address indexed user, uint256 indexed stakeId, uint256 penaltyAmount);
    event EmergencyModeSet(bool enabled);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function stake() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must stake more than 0 ETH");

        uint256 stakeId = _stakes[msg.sender].length;
        _stakes[msg.sender].push(StakePosition({
            amount:        msg.value,
            stakedAt:      block.timestamp,
            lastClaimedAt: block.timestamp,
            active:        true
        }));

        totalStaked += msg.value;
        emit StakeCreated(msg.sender, stakeId, msg.value, block.timestamp);
    }

    function claimRewards(uint256 stakeId) external nonReentrant whenNotPaused {
        StakePosition storage pos = _getActiveStake(msg.sender, stakeId);

        uint256 reward = _calculateReward(pos);
        require(reward > 0, "No rewards to claim");
        require(address(this).balance >= reward, "Insufficient contract balance");

        pos.lastClaimedAt = block.timestamp;
        totalRewardsPaid  += reward;

        emit RewardClaimed(msg.sender, stakeId, reward);

        (bool ok, ) = msg.sender.call{value: reward}("");
        require(ok, "Reward transfer failed");
    }

    function unstake(uint256 stakeId) external nonReentrant whenNotPaused {
        StakePosition storage pos = _getActiveStake(msg.sender, stakeId);

        uint256 principal = pos.amount;
        uint256 reward    = _calculateReward(pos);
        uint256 penalty   = 0;

        if (block.timestamp < pos.stakedAt + LOCK_PERIOD) {
            penalty = (principal * PENALTY_BPS) / 10_000;
            emit PenaltyApplied(msg.sender, stakeId, penalty);
        }

        uint256 payout = principal + reward - penalty;
        require(address(this).balance >= payout, "Insufficient contract balance");

        pos.active              = false;
        totalStaked            -= principal;
        totalRewardsPaid       += reward;
        totalPenaltiesCollected += penalty;

        emit StakeWithdrawn(msg.sender, stakeId, principal, reward);

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "Withdrawal transfer failed");
    }

    function emergencyWithdraw(uint256 stakeId) external nonReentrant {
        require(emergencyMode, "Emergency mode not active");

        StakePosition storage pos = _getActiveStake(msg.sender, stakeId);
        uint256 principal = pos.amount;
        require(address(this).balance >= principal, "Insufficient contract balance");

        pos.active   = false;
        totalStaked -= principal;

        emit StakeWithdrawn(msg.sender, stakeId, principal, 0);

        (bool ok, ) = msg.sender.call{value: principal}("");
        require(ok, "Emergency withdrawal failed");
    }

    // Withdraw surplus ETH (penalties collected + direct deposits) — cannot touch staked principal.
    function withdrawFunds(uint256 amount) external onlyOwner nonReentrant {
        uint256 surplus = address(this).balance - totalStaked;
        require(amount > 0, "Amount must be > 0");
        require(amount <= surplus, "Cannot withdraw staked funds");
        emit FundsWithdrawn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdrawal failed");
    }

    function pause() external onlyOwner { _pause(); }

    function unpause() external onlyOwner { _unpause(); }

    function setEmergencyMode(bool enabled) external onlyOwner {
        emergencyMode = enabled;
        emit EmergencyModeSet(enabled);
    }

    function getStake(address user, uint256 stakeId) external view returns (StakePosition memory) {
        require(stakeId < _stakes[user].length, "Invalid stake ID");
        return _stakes[user][stakeId];
    }

    function getStakeCount(address user) external view returns (uint256) {
        return _stakes[user].length;
    }

    function calculateReward(address user, uint256 stakeId) external view returns (uint256) {
        require(stakeId < _stakes[user].length, "Invalid stake ID");
        StakePosition storage pos = _stakes[user][stakeId];
        if (!pos.active) return 0;
        return _calculateReward(pos);
    }

    function _getActiveStake(address user, uint256 stakeId) internal view returns (StakePosition storage) {
        require(stakeId < _stakes[user].length, "Invalid stake ID");
        StakePosition storage pos = _stakes[user][stakeId];
        require(pos.active, "Stake already withdrawn");
        return pos;
    }

    function _calculateReward(StakePosition storage pos) internal view returns (uint256) {
        uint256 duration = block.timestamp - pos.lastClaimedAt;
        uint256 apr      = _getAPR(pos.amount);
        return (pos.amount * apr * duration) / (10_000 * SECONDS_PER_YEAR);
    }

    function _getAPR(uint256 amount) internal pure returns (uint256) {
        if (amount >= 5 ether) return APR_TIER3;
        if (amount >= 1 ether) return APR_TIER2;
        return APR_TIER1;
    }

    receive() external payable {}
}
