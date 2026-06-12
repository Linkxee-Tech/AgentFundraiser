// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title TreasuryManager
/// @notice Receives native PROS and ERC-20 funds, enforces spend limits, reserve floor, pause, and emergency withdrawal.
contract TreasuryManager is Ownable, ReentrancyGuard {
    struct WithdrawalRequest {
        address to;
        uint256 amount;
        address token;
        address requester;
        bool agentApproved;
        bool ownerApproved;
        bool executed;
        bool rejected;
        uint256 createdAt;
    }

    address public agent;
    address public pendingAgent;
    uint256 public dailyLimit;
    uint256 public reserveFloor;
    uint256 public multiSigThreshold;
    uint256 public nextWithdrawalRequestId;
    bool public emergencyPause;
    address public emergencySafeAddress;

    uint256 public spentToday;
    uint256 public lastReset;

    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    event Deposited(address indexed from, uint256 amount, address indexed token);
    event Withdrawn(address indexed to, uint256 amount, address indexed token);
    event WithdrawalRequestSubmitted(uint256 indexed requestId, address indexed to, uint256 amount, address indexed token);
    event WithdrawalRequestApproved(uint256 indexed requestId, address indexed approver);
    event WithdrawalRequestRejected(uint256 indexed requestId, address indexed rejector);
    event WithdrawalRequestExecuted(uint256 indexed requestId, address indexed to, uint256 amount, address indexed token);
    event AgentTransferStarted(address indexed oldAgent, address indexed pendingAgent);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event DailyLimitUpdated(uint256 newLimit);
    event ReserveFloorUpdated(uint256 newFloor);
    event MultiSigThresholdUpdated(uint256 newThreshold);
    event EmergencyPaused(bool paused);
    event EmergencySafeAddressUpdated(address indexed safeAddress);

    modifier onlyAgent() {
        require(msg.sender == agent, "TreasuryManager: caller is not agent");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(msg.sender == agent || msg.sender == owner(), "TreasuryManager: caller is not authorized");
        _;
    }

    modifier resetSpendIfNeeded() {
        if (block.timestamp >= lastReset + 1 days) {
            spentToday = 0;
            lastReset = block.timestamp;
        }
        _;
    }

    modifier notPaused() {
        require(!emergencyPause, "TreasuryManager: emergency pause active");
        _;
    }

    modifier emergencyOnly() {
        require(emergencyPause, "TreasuryManager: emergency mode required");
        _;
    }

    constructor(address initialAgent, uint256 initialDailyLimit, uint256 initialReserveFloor) {
        require(initialAgent != address(0), "TreasuryManager: invalid agent");
        agent = initialAgent;
        dailyLimit = initialDailyLimit;
        reserveFloor = initialReserveFloor;
        nextWithdrawalRequestId = 1;
        lastReset = block.timestamp;
        emit AgentUpdated(address(0), initialAgent);
        emit DailyLimitUpdated(initialDailyLimit);
        emit ReserveFloorUpdated(initialReserveFloor);
    }

    receive() external payable {
        require(msg.value > 0, "TreasuryManager: deposit must be positive");
        emit Deposited(msg.sender, msg.value, address(0));
    }

    /// @notice Deposit native PROS into the treasury.
    function deposit() external payable {
        require(msg.value > 0, "TreasuryManager: deposit must be positive");
        emit Deposited(msg.sender, msg.value, address(0));
    }

    /// @notice Deposit an ERC-20 token into the treasury.
    function depositERC20(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "TreasuryManager: invalid token");
        require(amount > 0, "TreasuryManager: amount must be positive");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TreasuryManager: token transfer failed");
        emit Deposited(msg.sender, amount, token);
    }

    /// @notice Owner-controlled immediate agent update for deployment and recovery.
    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "TreasuryManager: invalid agent");
        emit AgentUpdated(agent, newAgent);
        agent = newAgent;
        pendingAgent = address(0);
    }

    /// @notice Starts a controlled two-step transfer of the agent role.
    function transferAgentOwnership(address newAgent) external onlyAgentOrOwner {
        require(newAgent != address(0), "TreasuryManager: invalid agent");
        pendingAgent = newAgent;
        emit AgentTransferStarted(agent, newAgent);
    }

    /// @notice Accepts the pending agent role.
    function acceptAgentOwnership() external {
        require(msg.sender == pendingAgent, "TreasuryManager: caller is not pending agent");
        emit AgentUpdated(agent, pendingAgent);
        agent = pendingAgent;
        pendingAgent = address(0);
    }

    function setDailyLimit(uint256 newLimit) external onlyAgentOrOwner {
        dailyLimit = newLimit;
        emit DailyLimitUpdated(newLimit);
    }

    function setReserveFloor(uint256 newFloor) external onlyAgentOrOwner {
        reserveFloor = newFloor;
        emit ReserveFloorUpdated(newFloor);
    }

    function setMultiSigThreshold(uint256 newThreshold) external onlyAgentOrOwner {
        multiSigThreshold = newThreshold;
        emit MultiSigThresholdUpdated(newThreshold);
    }

    function setEmergencyPause(bool paused) external onlyAgentOrOwner {
        emergencyPause = paused;
        emit EmergencyPaused(paused);
    }

    function setEmergencySafeAddress(address safeAddress) public onlyAgentOrOwner {
        require(safeAddress != address(0), "TreasuryManager: invalid safe address");
        emergencySafeAddress = safeAddress;
        emit EmergencySafeAddressUpdated(safeAddress);
    }

    /// @notice Compatibility alias requested by the build spec.
    function setEmergencyWithdrawAddress(address safeAddress) external onlyAgentOrOwner {
        setEmergencySafeAddress(safeAddress);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    function tokenBalance(address token) external view returns (uint256) {
        require(token != address(0), "TreasuryManager: invalid token");
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Withdraw native PROS while respecting reserve floor and daily limit.
    function withdraw(address to, uint256 amount) external onlyAgent nonReentrant resetSpendIfNeeded notPaused {
        _requireBelowThreshold(amount);
        _withdrawNative(to, amount);
    }

    /// @notice Withdraw ERC-20 tokens while respecting the same daily spend accounting.
    function withdrawERC20(address token, address to, uint256 amount) external onlyAgent nonReentrant resetSpendIfNeeded notPaused {
        _requireBelowThreshold(amount);
        _withdrawToken(token, to, amount);
    }

    /// @notice Submits a large withdrawal request that requires both agent and owner approval before execution.
    function submitWithdrawalRequest(address to, uint256 amount, address token) external onlyAgentOrOwner notPaused returns (uint256 requestId) {
        require(token != address(0), "TreasuryManager: invalid token");
        require(to != address(0), "TreasuryManager: invalid recipient");
        require(amount > 0, "TreasuryManager: amount must be positive");

        requestId = nextWithdrawalRequestId++;
        withdrawalRequests[requestId] = WithdrawalRequest({
            to: to,
            amount: amount,
            token: token,
            requester: msg.sender,
            agentApproved: msg.sender == agent,
            ownerApproved: msg.sender == owner(),
            executed: false,
            rejected: false,
            createdAt: block.timestamp
        });
        emit WithdrawalRequestSubmitted(requestId, to, amount, token);
    }

    /// @notice Convenience native PROS request wrapper.
    function submitWithdrawalRequest(address to, uint256 amount) external onlyAgentOrOwner notPaused returns (uint256 requestId) {
        require(to != address(0), "TreasuryManager: invalid recipient");
        require(amount > 0, "TreasuryManager: amount must be positive");

        requestId = nextWithdrawalRequestId++;
        withdrawalRequests[requestId] = WithdrawalRequest({
            to: to,
            amount: amount,
            token: address(0),
            requester: msg.sender,
            agentApproved: msg.sender == agent,
            ownerApproved: msg.sender == owner(),
            executed: false,
            rejected: false,
            createdAt: block.timestamp
        });
        emit WithdrawalRequestSubmitted(requestId, to, amount, address(0));
    }

    function approveRequest(uint256 requestId) external onlyAgentOrOwner {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.createdAt != 0, "TreasuryManager: request not found");
        require(!request.executed, "TreasuryManager: request executed");
        require(!request.rejected, "TreasuryManager: request rejected");

        if (msg.sender == agent) {
            request.agentApproved = true;
        }
        if (msg.sender == owner()) {
            request.ownerApproved = true;
        }
        emit WithdrawalRequestApproved(requestId, msg.sender);
    }

    function rejectRequest(uint256 requestId) external onlyAgentOrOwner {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.createdAt != 0, "TreasuryManager: request not found");
        require(!request.executed, "TreasuryManager: request executed");
        require(!request.rejected, "TreasuryManager: request rejected");

        request.rejected = true;
        emit WithdrawalRequestRejected(requestId, msg.sender);
    }

    function executeRequest(uint256 requestId) external onlyAgentOrOwner nonReentrant resetSpendIfNeeded notPaused {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.createdAt != 0, "TreasuryManager: request not found");
        require(!request.executed, "TreasuryManager: request executed");
        require(!request.rejected, "TreasuryManager: request rejected");
        require(request.agentApproved && request.ownerApproved, "TreasuryManager: approvals required");

        request.executed = true;
        if (request.token == address(0)) {
            _withdrawNative(request.to, request.amount);
        } else {
            _withdrawToken(request.token, request.to, request.amount);
        }
        emit WithdrawalRequestExecuted(requestId, request.to, request.amount, request.token);
    }

    /// @notice Emergency withdrawal of all native PROS to the predefined safe address.
    function withdrawAll() external onlyAgentOrOwner emergencyOnly nonReentrant {
        require(emergencySafeAddress != address(0), "TreasuryManager: emergency safe address not set");
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            (bool sent, ) = payable(emergencySafeAddress).call{ value: nativeBalance }("");
            require(sent, "TreasuryManager: emergency transfer failed");
            emit Withdrawn(emergencySafeAddress, nativeBalance, address(0));
        }
    }

    /// @notice Emergency withdrawal of an ERC-20 token to the predefined safe address.
    function withdrawAllERC20(address token) external onlyAgentOrOwner emergencyOnly nonReentrant {
        require(token != address(0), "TreasuryManager: invalid token");
        require(emergencySafeAddress != address(0), "TreasuryManager: emergency safe address not set");
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount > 0) {
            require(IERC20(token).transfer(emergencySafeAddress, amount), "TreasuryManager: token transfer failed");
            emit Withdrawn(emergencySafeAddress, amount, token);
        }
    }

    function _requireBelowThreshold(uint256 amount) private view {
        require(multiSigThreshold == 0 || amount < multiSigThreshold, "TreasuryManager: large withdrawal requires request");
    }

    function _withdrawNative(address to, uint256 amount) private {
        require(to != address(0), "TreasuryManager: invalid recipient");
        require(amount > 0, "TreasuryManager: amount must be positive");
        require(address(this).balance >= amount, "TreasuryManager: insufficient balance");
        require(address(this).balance - amount >= reserveFloor, "TreasuryManager: reserve floor breach");
        require(spentToday + amount <= dailyLimit, "TreasuryManager: daily limit exceeded");

        spentToday += amount;
        (bool sent, ) = payable(to).call{ value: amount }("");
        require(sent, "TreasuryManager: native transfer failed");
        emit Withdrawn(to, amount, address(0));
    }

    function _withdrawToken(address token, address to, uint256 amount) private {
        require(token != address(0), "TreasuryManager: invalid token");
        require(to != address(0), "TreasuryManager: invalid recipient");
        require(amount > 0, "TreasuryManager: amount must be positive");
        require(IERC20(token).balanceOf(address(this)) >= amount, "TreasuryManager: insufficient token balance");
        require(spentToday + amount <= dailyLimit, "TreasuryManager: daily limit exceeded");

        spentToday += amount;
        require(IERC20(token).transfer(to, amount), "TreasuryManager: token transfer failed");
        emit Withdrawn(to, amount, token);
    }
}
